#!/usr/bin/env node
/**
 * 🚚 FULL MIGRATION — Cloudinary → Storinary (Supabase Storage + database)
 *
 * Uploads every backed-up Cloudinary image into your Supabase bucket and
 * creates the matching database record (folder, tags, alt text, dimensions,
 * original creation date — all preserved), exactly like a Storinary upload.
 *
 * It writes `cloudinary-backup/mapping.json` (public_id → new storage path
 * + public URL), which powers the old-URL redirect route
 * (`/api/redirect/[...path]`) so your existing Cloudinary URLs keep working.
 *
 * Usage:
 *   node scripts/migrate-from-cloudinary.mjs                    # from local backup
 *   node scripts/migrate-from-cloudinary.mjs --source=cloudinary # directly from Cloudinary API
 *   node scripts/migrate-from-cloudinary.mjs --limit=50          # first 50 only (test run)
 *   node scripts/migrate-from-cloudinary.mjs --concurrency=8
 *
 * Required env vars (in .env):
 *   DATABASE_URL                      — your Storinary database
 *   NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY         — Supabase secret key
 *   SUPABASE_BUCKET_NAME              — bucket name (e.g. "storinary")
 *   CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET — only for --source=cloudinary
 *
 * IMPORTANT: the generated Prisma client must match DATABASE_URL.
 *   - PostgreSQL: npx prisma generate --schema prisma/postgres/schema.prisma
 *   - SQLite    : npx prisma generate
 *
 * Safe to re-run: already-migrated images are detected by their unique
 * storage path and skipped, so an interrupted run can be resumed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(ROOT, 'cloudinary-backup');
const MANIFEST_PATH = path.join(BACKUP_DIR, 'manifest.json');
const MAPPING_PATH = path.join(BACKUP_DIR, 'mapping.json');
const PROGRESS_PATH = path.join(BACKUP_DIR, 'migration-progress.json');

// ── Tiny .env loader (no dependencies) ─────────────────────────────
function loadEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

// ── CLI flags ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : def;
};
const SOURCE = flag('source', 'backup');
const LIMIT = flag('limit', null);
const CONCURRENCY = parseInt(flag('concurrency', '4'), 10);

// ── Validate env ───────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET_NAME || 'storinary';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL — set it in .env first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────
const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/** Sanitize one path segment to be URL- and storage-safe. */
function sanitizeSegment(seg) {
  return seg
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the Supabase storage path from a Cloudinary public_id.
 * The folder structure is preserved, which lets the redirect route map
 * old Cloudinary URLs back to the migrated files 1:1.
 * e.g. public_id "products/hero" + format "jpg" → "products/hero.jpg"
 */
function storagePathFor(publicId, format) {
  const segments = publicId
    .split('/')
    .map(sanitizeSegment)
    .filter(Boolean);
  const base = segments.length ? segments.join('/') : 'image';
  return `${base}.${format}`;
}

/** Map a Cloudinary folder ("products/hero") to Storinary's "/products/hero". */
function folderFor(publicId) {
  const dir = publicId.split('/').slice(0, -1).join('/');
  return dir ? `/${dir}` : '/';
}

async function uploadToBucket(buffer, storagePath, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function createRecord(entry, buffer, storagePath, publicUrl) {
  let metadata;
  try {
    const m = await sharp(buffer).metadata();
    metadata = {
      width: entry.width || m.width || 0,
      height: entry.height || m.height || 0,
      size: entry.bytes || buffer.length,
      format: (m.format && m.format !== 'unknown' ? m.format : entry.format).toLowerCase(),
    };
  } catch {
    metadata = {
      width: entry.width || 0,
      height: entry.height || 0,
      size: entry.bytes || buffer.length,
      format: entry.format,
    };
  }

  const baseName = (entry.publicId.split('/').pop() || 'image').replace(/[^A-Za-z0-9._-]/g, '-');
  const altText =
    (entry.context?.custom && typeof entry.context.custom === 'object'
      ? String(entry.context.custom.alt || entry.context.custom.alt_text || '')
      : '') || '';

  return prisma.image.create({
    data: {
      originalName: `${baseName}.${entry.format}`,
      storagePath,
      publicUrl,
      width: metadata.width,
      height: metadata.height,
      fileSize: metadata.size,
      format: metadata.format,
      mimeType: MIME[entry.format] || MIME[metadata.format] || 'application/octet-stream',
      folder: folderFor(entry.publicId),
      tags: (entry.tags || []).join(', '),
      altText,
      bgRemoved: false,
      compressed: false,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
    },
  });
}

// ── Load source entries ────────────────────────────────────────────
async function loadEntries() {
  if (SOURCE === 'cloudinary') {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !key || !secret) {
      console.error('--source=cloudinary needs CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET.');
      process.exit(1);
    }
    console.log('Listing resources directly from Cloudinary…');
    const entries = [];
    let nextCursor;
    do {
      const params = new URLSearchParams({ resource_type: 'image', type: 'upload', max_results: '500' });
      if (nextCursor) params.set('next_cursor', nextCursor);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image?${params}`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') },
      });
      if (!res.ok) throw new Error(`Cloudinary API ${res.status}`);
      const data = await res.json();
      for (const r of data.resources || []) {
        entries.push({
          publicId: r.public_id,
          format: r.format,
          width: r.width,
          height: r.height,
          bytes: r.bytes,
          createdAt: r.created_at,
          folder: r.folder || '',
          tags: r.tags || [],
          context: r.context || null,
          secureUrl: r.secure_url,
          file: `${r.public_id}.${r.format}`,
        });
      }
      nextCursor = data.next_cursor;
      if (nextCursor) await new Promise((r) => setTimeout(r, 500));
    } while (nextCursor);
    return entries;
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(
      'No backup found. Run the backup first:\n  node scripts/backup-cloudinary.mjs\n' +
        '…or pass --source=cloudinary to read directly from Cloudinary.'
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// ── Main ───────────────────────────────────────────────────────────
async function run() {
  console.log(`Source: ${SOURCE} · Concurrency: ${CONCURRENCY}\n`);
  let entries = await loadEntries();
  if (LIMIT) entries = entries.slice(0, parseInt(LIMIT, 10));
  console.log(`Images to migrate: ${entries.length}\n`);

  const progress = fs.existsSync(PROGRESS_PATH)
    ? JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'))
    : { migrated: [], failed: [] };
  const mapping = fs.existsSync(MAPPING_PATH)
    ? JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'))
    : {};

  // Map of storage path → owning public_id. Rows the app itself created get
  // a null owner; entries from mapping.json (created by this script) are
  // keyed by their real public_id, so re-runs can tell "same image" from
  // "different image that sanitized to the same path".
  const existing = new Map(
    (await prisma.image.findMany({ select: { storagePath: true } })).map((r) => [r.storagePath, null])
  );
  for (const [pid, m] of Object.entries(mapping)) {
    if (m && m.storagePath) existing.set(m.storagePath, pid);
  }

  /**
   * Allocate a storage path for a public_id. If the sanitized path is already
   * taken by a DIFFERENT image (e.g. "a:b" and "a-b" both sanitize to
   * "a-b"), append a numeric suffix instead of silently dropping one of two
   * distinct assets.
   */
  function uniqueStoragePath(publicId, format) {
    const base = storagePathFor(publicId, format);
    if (!existing.has(base) || existing.get(base) === publicId) return base;
    const dot = base.lastIndexOf('.');
    const name = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    for (let i = 2; i < 10000; i++) {
      const candidate = `${name}-${i}${ext}`;
      if (!existing.has(candidate) || existing.get(candidate) === publicId) return candidate;
    }
    throw new Error(`could not allocate a unique storage path for ${publicId}`);
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      const publicId = entry.publicId;

      try {
        // Re-run of an already-migrated image → skip
        if (existing.get(storagePathFor(publicId, entry.format)) === publicId) {
          skipped += 1;
          continue;
        }

        // SVGs pass through without the app's isSafeSvg scan — warn so the
        // operator can review them (the serve route sandboxes SVGs in
        // transform mode, but raw public URLs bypass those headers).
        if (entry.format === 'svg') {
          console.warn(
            `  ⚠ ${publicId}.svg — SVG files bypass the app's isSafeSvg scan; ` +
              'review this file if it did not come from a trusted source.'
          );
        }

        const storagePath = uniqueStoragePath(publicId, entry.format);

        // 1. Read the bytes (backup file, or live download)
        let buffer;
        if (SOURCE === 'backup') {
          const filePath = path.join(BACKUP_DIR, entry.file || `${publicId}.${entry.format}`);
          if (!fs.existsSync(filePath)) throw new Error(`missing backup file ${entry.file}`);
          buffer = fs.readFileSync(filePath);
        } else {
          const res = await fetch(entry.secureUrl);
          if (!res.ok) throw new Error(`download failed HTTP ${res.status}`);
          buffer = Buffer.from(await res.arrayBuffer());
        }

        // 2. Upload to Supabase Storage (keeps Cloudinary folder structure)
        const publicUrl = await uploadToBucket(
          buffer,
          storagePath,
          MIME[entry.format] || 'application/octet-stream'
        );

        // 3. Create the database record
        await createRecord(entry, buffer, storagePath, publicUrl);

        // 4. Record the mapping for old-URL redirects
        mapping[publicId] = {
          storagePath,
          publicUrl,
          format: entry.format,
          folder: folderFor(publicId),
          cloudinaryUrl: entry.secureUrl,
        };

        existing.set(storagePath, publicId);
        progress.migrated.push(publicId);
        migrated += 1;
      } catch (e) {
        failed += 1;
        progress.failed.push({ publicId, error: e.message });
        console.error(`  ✖ ${publicId}: ${e.message}`);
      }

      // Persist progress + mapping periodically
      if ((migrated + skipped + failed) % 5 === 0) {
        fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
        fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log(`✔ Migrated : ${migrated}`);
  console.log(`⏭  Skipped  : ${skipped} (already in Storinary)`);
  console.log(`✖ Failed   : ${failed}`);
  console.log('📄 mapping.json written — powers /api/redirect old-URL support');
  console.log('══════════════════════════════════════════════');
  if (failed > 0) {
    console.log('\nFailed items (re-run to retry, progress is saved):');
    for (const f of progress.failed.slice(-20)) console.log(`  - ${f.publicId}: ${f.error}`);
  }
}

run()
  .catch((e) => {
    console.error('\nMigration aborted:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
