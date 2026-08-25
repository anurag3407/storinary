import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client as AppwriteClient, Storage as AppwriteStorage } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

export type StorageProviderType = 'backblaze' | 'appwrite' | 'supabase';

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  contentType: string;
}

export interface StorageRangeResult {
  buffer: Buffer;
  contentType: string;
  totalSize?: number;
  rangeStatus?: number;
  contentRange?: string;
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
 * 1. If process.env.STORAGE_PROVIDER is explicitly set ('backblaze' / 'b2', 'appwrite', or 'supabase'), use that.
 * 2. If multiple provider credentials are provided, priority is:
 *    - Backblaze B2 (first priority)
 *    - Appwrite (second priority)
 *    - Supabase (third priority)
 * 3. Default fallback is Supabase.
 */
export function getStorageProvider(): StorageProviderType {
  const explicit = process.env.STORAGE_PROVIDER?.toLowerCase().trim();
  if (explicit === 'backblaze' || explicit === 'b2') {
    return 'backblaze';
  }
  if (explicit === 'appwrite' || explicit === 'supabase') {
    return explicit;
  }

  const hasBackblaze = Boolean(
    (process.env.BACKBLAZE_APPLICATION_KEY_ID ||
      process.env.BACKBLAZE_KEY_ID ||
      process.env.B2_APPLICATION_KEY_ID ||
      process.env.B2_KEY_ID) &&
    (process.env.BACKBLAZE_APPLICATION_KEY ||
      process.env.BACKBLAZE_APP_KEY ||
      process.env.B2_APPLICATION_KEY ||
      process.env.B2_APP_KEY)
  );

  const hasAppwrite = Boolean(
    (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT) &&
    (process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID) &&
    (process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  );

  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  if (hasBackblaze) {
    return 'backblaze';
  }
  if (hasAppwrite) {
    return 'appwrite';
  }
  if (hasSupabase) {
    return 'supabase';
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

// ── Backblaze B2 Client Helpers ──────────────────────────────

export function getBackblazeConfig() {
  const keyId =
    process.env.BACKBLAZE_APPLICATION_KEY_ID ||
    process.env.BACKBLAZE_KEY_ID ||
    process.env.B2_APPLICATION_KEY_ID ||
    process.env.B2_KEY_ID ||
    '';
  const appKey =
    process.env.BACKBLAZE_APPLICATION_KEY ||
    process.env.BACKBLAZE_APP_KEY ||
    process.env.B2_APPLICATION_KEY ||
    process.env.B2_APP_KEY ||
    '';
  const bucketName =
    process.env.BACKBLAZE_BUCKET_NAME ||
    process.env.B2_BUCKET_NAME ||
    process.env.NEXT_PUBLIC_BACKBLAZE_BUCKET_NAME ||
    'storinary';
  const bucketId =
    process.env.BACKBLAZE_BUCKET_ID ||
    process.env.B2_BUCKET_ID ||
    '';
  const endpoint = (
    process.env.BACKBLAZE_ENDPOINT ||
    process.env.B2_ENDPOINT ||
    'https://api.backblazeb2.com'
  ).replace(/\/+$/, '');
  const cdnUrl = (
    process.env.NEXT_PUBLIC_BACKBLAZE_CDN_URL ||
    process.env.BACKBLAZE_CDN_URL ||
    process.env.BACKBLAZE_DOWNLOAD_URL ||
    process.env.B2_DOWNLOAD_URL ||
    ''
  ).replace(/\/+$/, '');

  return { keyId, appKey, bucketName, bucketId, endpoint, cdnUrl };
}

interface BackblazeAuth {
  accountId: string;
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  allowedBucketId?: string;
  expiresAt: number;
}

let backblazeAuthCache: BackblazeAuth | null = null;
let backblazeResolvedBucketId: string | null = null;

export function resetBackblazeCache(): void {
  backblazeAuthCache = null;
  backblazeResolvedBucketId = null;
}

export async function getBackblazeAuth(): Promise<BackblazeAuth> {
  if (backblazeAuthCache && Date.now() < backblazeAuthCache.expiresAt) {
    return backblazeAuthCache;
  }

  const config = getBackblazeConfig();
  if (!config.keyId || !config.appKey) {
    throw new Error('Backblaze B2 credentials missing: Key ID and Application Key are required');
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.appKey}`).toString('base64');
  const res = await fetch(`${config.endpoint}/b2api/v2/b2_authorize_account`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Backblaze authorize account failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const auth: BackblazeAuth = {
    accountId: data.accountId,
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    allowedBucketId: data.allowed?.bucketId || undefined,
    // Tokens last 24 hours; refresh after 23 hours
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };

  backblazeAuthCache = auth;
  return auth;
}

export async function getBackblazeBucketId(): Promise<string> {
  const config = getBackblazeConfig();
  if (config.bucketId) return config.bucketId;
  if (backblazeResolvedBucketId) return backblazeResolvedBucketId;

  const auth = await getBackblazeAuth();
  if (auth.allowedBucketId) {
    backblazeResolvedBucketId = auth.allowedBucketId;
    return auth.allowedBucketId;
  }

  // Lookup bucketId by bucketName using b2_list_buckets
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accountId: auth.accountId,
      bucketName: config.bucketName,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Backblaze list buckets failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const bucket = (data.buckets || []).find(
    (b: { bucketName: string; bucketId: string }) => b.bucketName === config.bucketName
  );
  if (!bucket) {
    throw new Error(`Backblaze bucket "${config.bucketName}" not found`);
  }

  backblazeResolvedBucketId = bucket.bucketId;
  return bucket.bucketId;
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

  if (provider === 'backblaze') {
    const auth = await getBackblazeAuth();
    const bucketId = await getBackblazeBucketId();

    // 1. Get upload URL
    const getUploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucketId }),
    });

    if (!getUploadUrlRes.ok) {
      const errText = await getUploadUrlRes.text();
      throw new Error(`Upload failed: Backblaze get upload URL error (${getUploadUrlRes.status}): ${errText}`);
    }

    const uploadUrlData = await getUploadUrlRes.json();
    const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlData;

    // 2. Upload file
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const safeEncodedKey = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: uploadAuthToken,
        'X-Bz-File-Name': safeEncodedKey,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'X-Bz-Content-Sha1': sha1,
        'X-Bz-Info-src_last_modified_millis': String(Date.now()),
      },
      body: buffer as unknown as BodyInit,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed: Backblaze upload error (${uploadRes.status}): ${errText}`);
    }

    return key;
  }

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

  if (provider === 'backblaze') {
    const config = getBackblazeConfig();
    const auth = await getBackblazeAuth();
    const safeEncodedKey = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const downloadBase = config.cdnUrl || auth.downloadUrl;
    const downloadUrl = `${downloadBase}/file/${config.bucketName}/${safeEncodedKey}`;

    const res = await fetch(downloadUrl, {
      headers: {
        Authorization: auth.authorizationToken,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Download failed: Backblaze download error (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
    };
  }

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

export async function getVideoFromStorage(
  key: string,
  rangeHeader?: string | null
): Promise<StorageRangeResult> {
  const provider = getStorageProvider();

  if (provider === 'backblaze') {
    const config = getBackblazeConfig();
    const auth = await getBackblazeAuth();
    const safeEncodedKey = key.split('/').map(encodeURIComponent).join('/');
    const downloadUrl = `${config.cdnUrl || auth.downloadUrl}/file/${config.bucketName}/${safeEncodedKey}`;
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: auth.authorizationToken,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });
    if (!response.ok && response.status !== 206) {
      throw new Error(`Video download failed (${response.status})`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'video/mp4',
      totalSize: Number(response.headers.get('content-range')?.split('/')[1] ?? response.headers.get('content-length') ?? 0),
      rangeStatus: response.status,
      contentRange: response.headers.get('content-range') || undefined,
    };
  }

  if (provider === 'appwrite') {
    const full = await getFromStorage(key);
    return { ...full, totalSize: full.buffer.length };
  }

  const supabase = getSupabaseClient();
  const bucket = getSupabaseBucket();
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error || !data) throw new Error(`Video download failed: ${error?.message || 'No data'}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, contentType: data.type || 'video/mp4', totalSize: buffer.length };
}

/**
 * Delete a single file from the active storage provider.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  const provider = getStorageProvider();

  if (provider === 'backblaze') {
    const auth = await getBackblazeAuth();
    const bucketId = await getBackblazeBucketId();

    const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_versions`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucketId,
        startFileName: key,
        prefix: key,
        maxFileCount: 100,
      }),
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`Delete failed: Backblaze list file versions error (${listRes.status}): ${errText}`);
    }

    const listData = await listRes.json();
    const matchingFiles = (listData.files || []).filter(
      (f: { fileName: string; fileId: string }) => f.fileName === key
    );

    for (const file of matchingFiles) {
      const delRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
        method: 'POST',
        headers: {
          Authorization: auth.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.fileName,
          fileId: file.fileId,
        }),
      });
      if (!delRes.ok) {
        const errText = await delRes.text();
        throw new Error(`Delete failed: Backblaze delete file version error (${delRes.status}): ${errText}`);
      }
    }
    return;
  }

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

  if (provider === 'backblaze') {
    const promises = keys.map((k) => deleteFromStorage(k));
    const results = await Promise.allSettled(promises);
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length === keys.length && keys.length > 0) {
      throw new Error('Bulk delete failed for all items');
    }
    return;
  }

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

  if (provider === 'backblaze') {
    const auth = await getBackblazeAuth();
    const bucketId = await getBackblazeBucketId();

    const listRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucketId,
        prefix: folder || '',
        maxFileCount: limit,
      }),
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`List failed: Backblaze list files error (${listRes.status}): ${errText}`);
    }

    const listData = await listRes.json();
    return {
      objects: (listData.files || []).map(
        (file: { fileName: string; contentLength?: number; uploadTimestamp?: number }) => ({
          key: file.fileName,
          size: file.contentLength || 0,
          lastModified: new Date(file.uploadTimestamp || Date.now()),
        })
      ),
    };
  }

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

  if (provider === 'backblaze') {
    const config = getBackblazeConfig();
    const safeEncodedKey = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const downloadBase =
      config.cdnUrl || backblazeAuthCache?.downloadUrl || 'https://f000.backblazeb2.com';
    return `${downloadBase}/file/${config.bucketName}/${safeEncodedKey}`;
  }

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

  if (provider === 'backblaze') {
    const config = getBackblazeConfig();
    const isConfigured = Boolean(config.keyId && config.appKey);
    return {
      provider: 'backblaze',
      providerName: 'Backblaze B2 Storage',
      bucket: config.bucketName,
      endpoint: config.cdnUrl || config.endpoint,
      isConfigured,
    };
  }

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
