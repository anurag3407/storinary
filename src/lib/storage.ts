import { createClient } from '@supabase/supabase-js';

// ── Supabase Client Singleton ──────────────────────────────
// Use the service role key on the server for full storage access.
// The anon key is for client-side (limited permissions).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKET = process.env.SUPABASE_BUCKET_NAME || 'storinary';

// ── Helper Functions ───────────────────────────────────────

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the storage path.
 */
export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, {
      contentType,
      upsert: true, // overwrite if exists
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return key;
}

/**
 * Download a file from Supabase Storage.
 * Returns the file as a Buffer.
 */
export async function getFromStorage(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);

  if (error || !data)
    throw new Error(`Download failed: ${error?.message || 'No data'}`);

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  };
}

/**
 * Delete a single file from Supabase Storage.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Delete multiple files from Supabase Storage.
 * Supabase supports bulk delete natively.
 */
export async function bulkDeleteFromStorage(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(keys);

  if (error) throw new Error(`Bulk delete failed: ${error.message}`);
}

/**
 * List objects in Supabase Storage with optional folder path and pagination.
 */
export async function listStorageObjects(
  folder?: string,
  limit: number = 1000,
  offset: number = 0
): Promise<{
  objects: Array<{ key: string; size: number; lastModified: Date }>;
}> {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder || '', {
    limit,
    offset,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw new Error(`List failed: ${error.message}`);

  return {
    objects: (data || []).map((obj) => ({
      key: folder ? `${folder}/${obj.name}` : obj.name,
      size: obj.metadata?.size || 0,
      lastModified: new Date(obj.updated_at || obj.created_at || Date.now()),
    })),
  };
}

/**
 * Construct the public URL for a Supabase Storage object.
 * Requires the bucket to be set to "Public" in Supabase Dashboard.
 */
export function getPublicUrl(key: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);

  return data.publicUrl;
}

/**
 * Generate the storage path for an upload.
 * Format: {year}/{month}/{sanitized-name}-{shortId}.{ext}
 */
export function generateStorageKey(
  originalName: string,
  shortId: string,
  format: string
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Sanitize filename: lowercase, replace spaces/special chars with hyphens
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
    .substring(0, 50); // limit length

  return `${year}/${month}/${baseName}-${shortId}.${format}`;
}

export { supabase, BUCKET };
