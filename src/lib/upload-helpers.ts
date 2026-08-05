/**
 * Client-side image compression using the Canvas API.
 * Converts any image to WebP at specified quality.
 * Runs in the browser — do NOT import on the server.
 */

/**
 * localStorage key where the Settings page persists default upload options.
 * Shared with the upload flow via the useUpload hook.
 */
export const UPLOAD_DEFAULTS_KEY = 'storinary-upload-defaults';

export interface UploadDefaults {
  compress: boolean;
  quality: number;
  maxWidth: number;
  removeBg: boolean;
  folder: string;
  tags: string;
}

export const DEFAULT_UPLOAD_OPTIONS: UploadDefaults = {
  compress: true,
  quality: 80,
  maxWidth: 2048,
  removeBg: false,
  folder: '/',
  tags: '',
};

/**
 * Coerce unknown localStorage data into a valid UploadDefaults shape,
 * falling back to defaults for any missing or malformed field.
 */
export function sanitizeUploadDefaults(raw: unknown): UploadDefaults {
  const base: UploadDefaults = { ...DEFAULT_UPLOAD_OPTIONS };
  if (!raw || typeof raw !== 'object') return base;

  const o = raw as Record<string, unknown>;

  if (typeof o.compress === 'boolean') base.compress = o.compress;
  if (typeof o.removeBg === 'boolean') base.removeBg = o.removeBg;

  if (
    typeof o.quality === 'number' &&
    Number.isFinite(o.quality) &&
    o.quality >= 1 &&
    o.quality <= 100
  ) {
    base.quality = Math.round(o.quality);
  }

  if (
    typeof o.maxWidth === 'number' &&
    Number.isFinite(o.maxWidth) &&
    o.maxWidth >= 128 &&
    o.maxWidth <= 8192
  ) {
    base.maxWidth = Math.round(o.maxWidth);
  }

  if (typeof o.folder === 'string') {
    base.folder = o.folder
      ? `/${o.folder.replace(/^\/+|\/+$/g, '')}`
      : '/';
  }
  if (typeof o.tags === 'string') base.tags = o.tags;

  return base;
}

/**
 * Read persisted upload defaults from localStorage (sanitized).
 */
export function loadUploadDefaults(): UploadDefaults {
  if (typeof window === 'undefined') return { ...DEFAULT_UPLOAD_OPTIONS };
  try {
    const raw = window.localStorage.getItem(UPLOAD_DEFAULTS_KEY);
    return sanitizeUploadDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_UPLOAD_OPTIONS };
  }
}

/**
 * Persist upload defaults to localStorage.
 */
export function saveUploadDefaults(options: UploadDefaults): void {
  window.localStorage.setItem(
    UPLOAD_DEFAULTS_KEY,
    JSON.stringify(sanitizeUploadDefaults(options))
  );
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

const MAX_FILE_SIZE =
  parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

/**
 * Validate a file for upload.
 * Returns null if valid, error message string if invalid.
 */
export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported format: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF, SVG`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    return `File too large: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Max: ${maxMB} MB`;
  }
  return null;
}

/**
 * Compress an image file to WebP using the Canvas API.
 *
 * @param file - Source image file
 * @param maxWidth - Maximum width in pixels (maintains aspect ratio)
 * @param quality - WebP quality (0.0 to 1.0, default 0.8)
 * @returns Compressed WebP Blob
 */
export async function compressImage(
  file: File,
  maxWidth: number = 2048,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // SVGs don't need compression
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if wider than maxWidth
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Create a thumbnail preview URL for a file.
 * Returns an object URL that must be revoked when done.
 */
export function createPreviewUrl(file: File | Blob): string {
  return URL.createObjectURL(file);
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a date to relative time string (e.g., "2 hours ago").
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
