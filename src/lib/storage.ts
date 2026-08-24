import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client as AppwriteClient, Storage as AppwriteStorage } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

export type StorageProviderType = 'supabase' | 'appwrite';

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  contentType: string;
}

export interface StorageProviderInfo {
  provider: StorageProviderType;
  providerName: string;
  bucket: string;
  endpoint?: string;
  isConfigured: boolean;
}

// ── Provider Detection Logic ─────────────────────────────────

/**
 * Detect which storage provider to use based on configuration.
 *
 * Rules:
 * 1. If process.env.STORAGE_PROVIDER is explicitly set ('appwrite' or 'supabase'), use that.
 * 2. If both Supabase and Appwrite credentials are provided, Supabase takes precedence.
 * 3. If only Supabase credentials are provided, use Supabase.
 * 4. If only Appwrite credentials are provided, use Appwrite.
 * 5. Default fallback is Supabase.
 */
export function getStorageProvider(): StorageProviderType {
  const explicit = process.env.STORAGE_PROVIDER?.toLowerCase().trim();
  if (explicit === 'appwrite' || explicit === 'supabase') {
    return explicit;
  }

  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  const hasAppwrite = Boolean(
    (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT) &&
    (process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID) &&
    (process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  );

  if (hasSupabase && hasAppwrite) {
    return 'supabase';
  }
  if (hasSupabase) {
    return 'supabase';
  }
  if (hasAppwrite) {
    return 'appwrite';
  }

  return 'supabase';
}

// ── Sanitization & Key Formatting ────────────────────────────

/**
 * Sanitize any string/key into a valid Appwrite fileId:
 * - 1 to 36 characters long
 * - Allowed chars: a-z, A-Z, 0-9, period (.), hyphen (-), underscore (_)
 * - Cannot start with a special character (. - _)
 */
export function sanitizeAppwriteFileId(key: string): string {
  let clean = key;
  try {
    clean = decodeURIComponent(key);
  } catch {
    // leave as-is
  }

  // Replace forward slashes, backslashes, and invalid characters with hyphens
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '-');

  // Strip leading non-alphanumeric characters
  clean = clean.replace(/^[^a-zA-Z0-9]+/, '');

  if (!clean) {
    clean = 'file';
  }

  // If length > 36, preserve the extension and truncate the stem
  if (clean.length > 36) {
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > 0 && lastDot < clean.length - 1) {
      const ext = clean.slice(lastDot);
      const stem = clean.slice(0, lastDot);
      const maxStemLen = Math.max(1, 36 - ext.length);
      clean = stem.slice(0, maxStemLen) + ext;
    } else {
      clean = clean.slice(0, 36);
    }
  }

  return clean.slice(0, 36);
}

/**
 * Generate a unique storage key for an upload based on provider conventions.
 * - Supabase: {year}/{month}/{sanitized-name}-{shortId}.{ext}
 * - Appwrite: {sanitized-name}-{shortId}.{ext} (max 36 chars, safe for Appwrite fileId)
 */
export function generateStorageKey(
  originalName: string,
  shortId: string,
  format: string
): string {
  const provider = getStorageProvider();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  if (provider === 'appwrite') {
    const safeBase = (baseName || 'img').slice(0, 16);
    const key = `${safeBase}-${shortId}.${format}`;
    return sanitizeAppwriteFileId(key);
  }

  return `${year}/${month}/${baseName || 'image'}-${shortId}.${format}`;
}

// ── Lazy Client Singletons ───────────────────────────────────

let supabaseInstance: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'placeholder-key';
    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseInstance;
}

export function getSupabaseBucket(): string {
  return process.env.SUPABASE_BUCKET_NAME || 'storinary';
}

export function getAppwriteConfig() {
  const endpoint = (
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    'https://cloud.appwrite.io/v1'
  ).replace(/\/+$/, '');
  const projectId =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
    process.env.APPWRITE_PROJECT_ID ||
    '';
  const apiKey = process.env.APPWRITE_API_KEY || '';
  const bucketId =
    process.env.APPWRITE_BUCKET_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ||
    'storinary';

  return { endpoint, projectId, apiKey, bucketId };
}

let appwriteStorageInstance: AppwriteStorage | null = null;
export function getAppwriteStorage(): {
  storage: AppwriteStorage;
  config: ReturnType<typeof getAppwriteConfig>;
} {
  const config = getAppwriteConfig();
  if (!appwriteStorageInstance) {
    const client = new AppwriteClient()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId);

    if (config.apiKey) {
      client.setKey(config.apiKey);
    }
    appwriteStorageInstance = new AppwriteStorage(client);
  }
  return { storage: appwriteStorageInstance, config };
}

// ── Unified Storage API ──────────────────────────────────────

/**
 * Upload a file buffer to the active storage provider.
 * Returns the storage path / file ID.
 */
export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const { storage, config } = getAppwriteStorage();
    const fileId = sanitizeAppwriteFileId(key);
    const filename = key.split('/').pop() || `${fileId}.${contentType.split('/')[1] || 'bin'}`;
    const inputFile = InputFile.fromBuffer(buffer, filename);

    try {
      await storage.createFile(config.bucketId, fileId, inputFile);
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      // 409 Conflict: File already exists -> delete and recreate (upsert behavior)
      if (error?.code === 409) {
        try {
          await storage.deleteFile(config.bucketId, fileId);
        } catch {
          // ignore deletion failure if race
        }
        await storage.createFile(config.bucketId, fileId, inputFile);
      } else {
        throw new Error(`Upload failed: ${error?.message || String(err)}`);
      }
    }
    return fileId;
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return key;
}

/**
 * Download a file from the active storage provider.
 * Returns the file as a Buffer and its content type.
 */
export async function getFromStorage(key: string): Promise<StorageDownloadResult> {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const { storage, config } = getAppwriteStorage();
    const fileId = sanitizeAppwriteFileId(key);

    try {
      const arrayBuffer = await storage.getFileDownload(config.bucketId, fileId);
      let contentType = 'application/octet-stream';

      try {
        const metadata = await storage.getFile(config.bucketId, fileId);
        if (metadata.mimeType) {
          contentType = metadata.mimeType;
        }
      } catch {
        // Fallback to extension or octet-stream
      }

      return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
      };
    } catch (err: unknown) {
      const error = err as { message?: string };
      throw new Error(`Download failed: ${error?.message || String(err)}`);
    }
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { data, error } = await supabase.storage.from(bucket).download(key);

  if (error || !data) {
    throw new Error(`Download failed: ${error?.message || 'No data'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || 'application/octet-stream',
  };
}

/**
 * Delete a single file from the active storage provider.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const { storage, config } = getAppwriteStorage();
    const fileId = sanitizeAppwriteFileId(key);
    try {
      await storage.deleteFile(config.bucketId, fileId);
    } catch (err: unknown) {
      const error = err as { message?: string };
      throw new Error(`Delete failed: ${error?.message || String(err)}`);
    }
    return;
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { error } = await supabase.storage.from(bucket).remove([key]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Delete multiple files from the active storage provider.
 */
export async function bulkDeleteFromStorage(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const { storage, config } = getAppwriteStorage();
    const promises = keys.map(async (k) => {
      const fileId = sanitizeAppwriteFileId(k);
      try {
        await storage.deleteFile(config.bucketId, fileId);
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        // Ignore 404 if file was already removed
        if (error?.code !== 404) {
          throw err;
        }
      }
    });

    const results = await Promise.allSettled(promises);
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length === keys.length && keys.length > 0) {
      throw new Error('Bulk delete failed for all items');
    }
    return;
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { error } = await supabase.storage.from(bucket).remove(keys);

  if (error) throw new Error(`Bulk delete failed: ${error.message}`);
}

/**
 * List objects in the active storage provider with pagination.
 */
export async function listStorageObjects(
  folder?: string,
  limit: number = 1000,
  offset: number = 0
): Promise<{ objects: StorageObject[] }> {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const { storage, config } = getAppwriteStorage();
    try {
      const response = await storage.listFiles(config.bucketId);
      return {
        objects: (response.files || []).map((file) => ({
          key: file.$id,
          size: file.sizeOriginal || 0,
          lastModified: new Date(file.$createdAt || Date.now()),
        })),
      };
    } catch (err: unknown) {
      const error = err as { message?: string };
      throw new Error(`List failed: ${error?.message || String(err)}`);
    }
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { data, error } = await supabase.storage.from(bucket).list(folder || '', {
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
 * Construct the public CDN / view URL for a storage object.
 */
export function getPublicUrl(key: string): string {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const config = getAppwriteConfig();
    const fileId = sanitizeAppwriteFileId(key);
    return `${config.endpoint}/storage/buckets/${config.bucketId}/files/${fileId}/view?project=${config.projectId}&mode=admin`;
  }

  // Supabase
  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

/**
 * Retrieve metadata and status about the active storage provider.
 */
export function getStorageProviderInfo(): StorageProviderInfo {
  const provider = getStorageProvider();

  if (provider === 'appwrite') {
    const config = getAppwriteConfig();
    const isConfigured = Boolean(config.projectId && config.endpoint);
    return {
      provider: 'appwrite',
      providerName: 'Appwrite Storage',
      bucket: config.bucketId,
      endpoint: config.endpoint,
      isConfigured,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const bucket = getSupabaseBucket();
  const isConfigured = Boolean(
    supabaseUrl &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  return {
    provider: 'supabase',
    providerName: 'Supabase Storage',
    bucket,
    endpoint: supabaseUrl,
    isConfigured,
  };
}

// ── Backwards Compatibility Exports ──────────────────────────
export const BUCKET = getSupabaseBucket();
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
