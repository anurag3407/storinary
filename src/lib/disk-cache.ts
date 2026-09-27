/**
 * Filesystem-backed persistent cache for on-the-fly image transforms.
 *
 * In-memory LRU (TransformCache) is fast but per-process — cold starts on
 * serverless platforms lose everything.  This disk layer survives cold starts
 * within the same deployment and provides much larger capacity.
 *
 * Keys are SHA-256 hashed to produce safe filenames.  Each entry stores the
 * binary transform in a `.bin` file and the content-type in a `.meta` file.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { computeEtag } from '@/lib/transform-cache';

const CACHE_DIR =
  process.env.STORINARY_DISK_CACHE_DIR ||
  path.join(process.cwd(), '.cache', 'transforms');

const MAX_DISK_CACHE_BYTES =
  (parseInt(process.env.STORINARY_DISK_CACHE_MB || '1024', 10) || 1024) * 1024 * 1024;

export interface DiskCacheEntry {
  buffer: Buffer;
  contentType: string;
  etag?: string;
  imageId?: string;
  originalName?: string;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

let writeCounter = 0;

/**
 * Non-blocking background prune to ensure disk cache never exceeds capacity.
 */
async function pruneDiskCacheIfNeeded(): Promise<void> {
  try {
    const entries = await fs.readdir(CACHE_DIR);
    const binFiles = entries.filter((f) => f.endsWith('.bin'));
    
    // Check total size of bin files
    const stats = await Promise.all(
      binFiles.map(async (f) => {
        const filePath = path.join(CACHE_DIR, f);
        const fileStat = await fs.stat(filePath).catch(() => null);
        return { file: f, path: filePath, size: fileStat?.size || 0, mtime: fileStat?.mtimeMs || 0 };
      })
    );

    let totalBytes = stats.reduce((acc, curr) => acc + curr.size, 0);
    if (totalBytes <= MAX_DISK_CACHE_BYTES) return;

    // Sort oldest first
    stats.sort((a, b) => a.mtime - b.mtime);

    // Evict down to 80% capacity
    const targetBytes = MAX_DISK_CACHE_BYTES * 0.8;
    for (const item of stats) {
      if (totalBytes <= targetBytes) break;
      const metaPath = path.join(CACHE_DIR, item.file.replace(/\.bin$/, '.meta'));
      await Promise.all([
        fs.unlink(item.path).catch(() => {}),
        fs.unlink(metaPath).catch(() => {}),
      ]);
      totalBytes -= item.size;
    }
  } catch {
    // best-effort
  }
}

export const diskCache = {
  /**
   * Retrieve a cached transform from disk.
   * Returns null on cache miss or any I/O error (missing file, permission, etc.).
   */
  async get(key: string): Promise<DiskCacheEntry | null> {
    const hash = hashKey(key);
    const binPath = path.join(CACHE_DIR, `${hash}.bin`);
    const metaPath = path.join(CACHE_DIR, `${hash}.meta`);

    try {
      const [buffer, metaRaw] = await Promise.all([
        fs.readFile(binPath),
        fs.readFile(metaPath, 'utf-8'),
      ]);
      const meta = JSON.parse(metaRaw) as {
        contentType: string;
        etag?: string;
        imageId?: string;
        originalName?: string;
      };
      const etag = meta.etag || computeEtag(buffer);
      return {
        buffer,
        contentType: meta.contentType,
        etag,
        imageId: meta.imageId,
        originalName: meta.originalName,
      };
    } catch {
      return null;
    }
  },

  /**
   * Store a transformed image on disk.
   * Creates the cache directory if it doesn't exist. Errors are silently
   * swallowed — the disk cache is a best-effort optimisation.
   */
  async set(key: string, entry: DiskCacheEntry): Promise<void> {
    const hash = hashKey(key);
    const binPath = path.join(CACHE_DIR, `${hash}.bin`);
    const metaPath = path.join(CACHE_DIR, `${hash}.meta`);
    const etag = entry.etag || computeEtag(entry.buffer);

    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await Promise.all([
        fs.writeFile(binPath, entry.buffer),
        fs.writeFile(
          metaPath,
          JSON.stringify({
            contentType: entry.contentType,
            etag,
            imageId: entry.imageId,
            originalName: entry.originalName,
          })
        ),
      ]);

      // Trigger background prune once every 50 writes without blocking request
      writeCounter++;
      if (writeCounter % 50 === 0) {
        void pruneDiskCacheIfNeeded();
      }
    } catch {
      // best-effort — disk full or permission error shouldn't break the request
    }
  },

  /** Current entry count (used for tests / observability). */
  async size(): Promise<number> {
    try {
      const entries = await fs.readdir(CACHE_DIR);
      // count .bin files only
      return entries.filter((f) => f.endsWith('.bin')).length;
    } catch {
      return 0;
    }
  },

  /** Remove all cached entries. */
  async clear(): Promise<void> {
    try {
      const entries = await fs.readdir(CACHE_DIR);
      await Promise.all(
        entries.map((f) => fs.unlink(path.join(CACHE_DIR, f)).catch(() => {}))
      );
    } catch {
      // directory doesn't exist yet — nothing to clear
    }
  },
};
