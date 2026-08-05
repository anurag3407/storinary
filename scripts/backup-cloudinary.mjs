#!/usr/bin/env node
/**
 * ⚡ EMERGENCY BACKUP — Cloudinary → local disk
 *
 * Downloads EVERY original image from your Cloudinary account into
 * `./cloudinary-backup/` (folder structure preserved), plus a
 * `manifest.json` with all metadata (tags, folder, dimensions, alt text,
 * dates) needed by the migration step later.
 *
 * Run this FIRST — your Cloudinary account is being closed, so this gets
 * your images onto your own disk where nothing can delete them.
 *
 * Usage:
 *   node scripts/backup-cloudinary.mjs
 *
 * Required env vars (put in .env or export in your shell):
 *   CLOUDINARY_CLOUD_NAME      e.g. "my-company"
 *   CLOUDINARY_API_KEY         from Cloudinary Dashboard → Account → API Keys
 *   CLOUDINARY_API_SECRET      same place
 *
 * Output:
 *   cloudinary-backup/<public_id>.<format>   — the original files
 *   cloudinary-backup/manifest.json         — metadata for migration
 *
 * Safe to re-run: files that already exist (with the correct size) are
 * skipped, so an interrupted run can simply be started again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(ROOT, 'cloudinary-backup');
const MANIFEST_PATH = path.join(BACKUP_DIR, 'manifest.json');
const CONCURRENCY = 5;
const RETRIES = 3;

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

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD || !API_KEY || !API_SECRET) {
  console.error(
    'Missing Cloudinary credentials. Add these to .env and re-run:\n' +
      '  CLOUDINARY_CLOUD_NAME=your-cloud-name\n' +
      '  CLOUDINARY_API_KEY=your-api-key\n' +
      '  CLOUDINARY_API_SECRET=your-api-secret\n' +
      '(Find them at Cloudinary Dashboard → Account → API Keys — or Settings → API Keys.)'
  );
  process.exit(1);
}

const API_ROOT = `https://api.cloudinary.com/v1_1/${CLOUD}`;
const AUTH = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

async function apiGet(url) {
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** List every original image resource (paginated). */
async function listAllResources() {
  const resources = [];
  let nextCursor;
  let page = 0;
  do {
    const params = new URLSearchParams({
      resource_type: 'image',
      type: 'upload',
      max_results: '500',
    });
    if (nextCursor) params.set('next_cursor', nextCursor);
    const data = await apiGet(`${API_ROOT}/resources/image?${params}`);
    resources.push(...(data.resources || []));
    nextCursor = data.next_cursor;
    page += 1;
    console.log(
      `  …listed page ${page}: ${resources.length} resources so far` +
        (nextCursor ? '' : ' (done)')
    );
    if (nextCursor) await new Promise((r) => setTimeout(r, 500)); // be gentle
    if (page > 1000) throw new Error('Too many pages — aborting to be safe.');
  } while (nextCursor);
  return resources;
}

/** Download one file with retries. Throws on total failure. */
async function downloadFile(resource, filePath) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(resource.secure_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (resource.bytes && buf.length !== resource.bytes) {
        throw new Error(`size mismatch (got ${buf.length}, expected ${resource.bytes})`);
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buf);
      return;
    } catch (e) {
      if (attempt === RETRIES) throw e;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

async function run() {
  console.log(`Cloudinary: ${CLOUD}\nBacking up to: ${BACKUP_DIR}\n`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
    : [];
  const done = new Set(manifest.map((r) => r.publicId));
  console.log(`Resuming from existing manifest: ${done.size} entries already tracked\n`);

  console.log('Listing all images from Cloudinary Admin API…');
  const resources = await listAllResources();
  console.log(`Total resources on Cloudinary: ${resources.length}\n`);

  const queue = resources.filter((r) => !done.has(r.publicId));
  if (queue.length === 0) {
    console.log('Nothing new to download — backup already complete.');
  }

  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  // Worker pool
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const resource = queue[cursor++];
      const relPath = `${resource.public_id}.${resource.format}`;
      const filePath = path.join(BACKUP_DIR, relPath);

      let ok = false;
      if (fs.existsSync(filePath) && fs.statSync(filePath).size === (resource.bytes || 0)) {
        skipped += 1;
        ok = true;
      } else {
        try {
          await downloadFile(resource, filePath);
          downloaded += 1;
          ok = true;
        } catch (e) {
          failures.push({ publicId: resource.public_id, error: e.message });
        }
      }

      // Only successful downloads go into the manifest — a failed resource
      // must be retried on the next run, never marked as done prematurely.
      if (ok) {
        manifest.push({
          publicId: resource.public_id,
          format: resource.format,
          width: resource.width,
          height: resource.height,
          bytes: resource.bytes,
          createdAt: resource.created_at,
          folder: resource.folder || '',
          tags: resource.tags || [],
          context: resource.context || null,
          secureUrl: resource.secure_url,
          file: relPath,
        });
        done.add(resource.public_id);

        // Persist the manifest incrementally so progress survives interruptions
        if ((downloaded + skipped) % 10 === 0) {
          fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log(`✔ Downloaded : ${downloaded}`);
  console.log(`⏭  Skipped    : ${skipped} (already on disk)`);
  console.log(`✖ Failed     : ${failures.length}`);
  console.log(`📦 Total in manifest : ${manifest.length}`);
  if (failures.length > 0) {
    console.log('\nFailures (re-run to retry):');
    for (const f of failures) console.log(`  - ${f.publicId}: ${f.error}`);
  }
  console.log('\nBackup complete. Files are in ./cloudinary-backup/');
  console.log('Next step: node scripts/migrate-from-cloudinary.mjs');
  console.log('══════════════════════════════════════════════');
}

run().catch((e) => {
  console.error('\nBackup aborted:', e.message);
  process.exit(1);
});
