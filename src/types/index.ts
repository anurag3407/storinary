// ════════════════════════════════════════════════════════════
// DATABASE TYPES (mirrors Prisma model, used in API responses)
// ════════════════════════════════════════════════════════════

export interface ImageRecord {
  id: string;
  originalName: string;
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
  folder: string;
  tags: string;
  altText: string;
  bgRemoved: boolean;
  compressed: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ════════════════════════════════════════════════════════════
// PROGRAMMATIC API CREDENTIALS
// ════════════════════════════════════════════════════════════

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastFour: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  key: ApiKeyRecord & {
    secret: string;
  };
}

export interface VideoRecord {
  id: string;
  originalName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  posterPath: string | null;
  format: string;
  width: number;
  height: number;
  duration: number;
  fileSize: number;
  folder: string;
  tags: string;
  altText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type VideoSortField = 'createdAt' | 'duration' | 'fileSize' | 'originalName';

export interface VideoListResponse {
  videos: VideoRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ════════════════════════════════════════════════════════════
// API REQUEST / RESPONSE TYPES
// ════════════════════════════════════════════════════════════

// POST /api/upload — Request is FormData, not JSON
// FormData fields:
//   - files: File[] (multiple files)
//   - folder: string (optional, default "/")
//   - tags: string (optional, comma-separated)
//   - bgRemoved: "true" | "false" (per file, sent as bgRemoved_0, bgRemoved_1, etc.)
//   - compressed: "true" | "false"

export interface UploadResponse {
  success: boolean;
  images: ImageRecord[];
  errors: Array<{ filename: string; error: string }>;
}

// GET /api/images?page=1&limit=20&search=hello&folder=/products&sort=createdAt&order=desc
export interface ImagesListParams {
  page: number; // 1-indexed
  limit: number; // items per page (default 20, max 100)
  search?: string; // search by originalName or tags
  folder?: string; // filter by folder
  sort: 'createdAt' | 'fileSize' | 'originalName'; // sort field
  order: 'asc' | 'desc'; // sort direction
}

export interface ImagesListResponse {
  images: ImageRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /api/images/:id
export interface ImageDetailResponse {
  image: ImageRecord;
  links: GeneratedLinks;
}

// DELETE /api/images — bulk delete
export interface BulkDeleteRequest {
  ids: string[];
}

export interface BulkDeleteResponse {
  success: boolean;
  deleted: number;
  errors: Array<{ id: string; error: string }>;
}

// GET /api/serve/[...path]?w=800&h=600&q=80&fmt=webp&fit=cover
export interface TransformParams {
  w?: number; // width (pixels)
  h?: number; // height (pixels)
  q?: number; // quality (1-100, default 80)
  fmt?: 'jpeg' | 'webp' | 'avif' | 'png'; // output format
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'; // resize fit mode
}

// GET /api/stats
export interface StatsResponse {
  totalImages: number;
  totalVideos?: number;
  totalVideoBytes?: number;
  totalStorageBytes: number;
  totalStorageFormatted: string; // e.g., "1.2 GB"
  imagesByFormat: Record<string, number>; // e.g., { "webp": 500, "jpeg": 300 }
  imagesByFolder: Record<string, number>; // e.g., { "/": 200, "/products": 100 }
  recentUploads: ImageRecord[]; // last 10 uploads
  uploadsThisMonth: number;
  provider?: 'backblaze' | 'appwrite' | 'supabase';
  providerName?: string;
  storageBucket?: string;
  storageEndpoint?: string;
  isConfigured?: boolean;
  supabaseBucket?: string; // bucket name (for Settings connection display backwards compat)
}

// ════════════════════════════════════════════════════════════
// LINK GENERATION TYPES
// ════════════════════════════════════════════════════════════

export interface GeneratedLinks {
  direct: string; // https://cdn.example.com/2024/08/photo.webp
  html: string; // <img src="..." alt="..." />
  markdown: string; // ![alt](url)
  css: string; // background-image: url('...');
  transformBase: string; // /api/serve/2024/08/photo.webp (append ?w=800&fmt=webp etc.)
}

// ════════════════════════════════════════════════════════════
// CLIENT-SIDE UPLOAD TYPES
// ════════════════════════════════════════════════════════════

export type UploadItemStatus =
  | 'pending'
  | 'compressing'
  | 'removing-bg'
  | 'uploading'
  | 'done'
  | 'error';

export interface UploadItem {
  id: string; // nanoid for client-side tracking
  file: File; // Original file object
  processedBlob?: Blob; // After compression / bg removal
  previewUrl: string; // Object URL for thumbnail preview
  status: UploadItemStatus;
  progress: number; // 0-100 upload progress
  error?: string; // Error message if failed
  result?: ImageRecord; // Server response after successful upload
  options: {
    removeBg: boolean;
    compress: boolean;
    folder: string;
    tags: string;
  };
}

export interface UploadState {
  items: UploadItem[];
  globalOptions: {
    removeBg: boolean; // Default bg removal toggle
    compress: boolean; // Default compression toggle
    quality: number; // Compression quality (1-100, default 80)
    maxWidth: number; // Max width for compression (default 2048)
    folder: string; // Target folder (default "/")
    tags: string; // Default tags
  };
  isUploading: boolean;
  completedCount: number;
  errorCount: number;
}

// ════════════════════════════════════════════════════════════
// COMPONENT PROP TYPES
// ════════════════════════════════════════════════════════════

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'info' | 'warning';
}

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number; // ms, default 4000
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string; // CSS variable name, e.g., "var(--nb-yellow)"
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
