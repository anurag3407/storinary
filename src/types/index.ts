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
  aiModerated: boolean;
  aiModerationScore: number | null;
  metadata?: Record<string, string>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ImageVersionRecord {
  id: string;
  imageId: string;
  version: number;
  label: string;
  originalName: string;
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
  fileSize: number;
  format: string;
  mimeType: string;
  createdAt: string;
}

export interface VideoVersionRecord {
  id: string;
  videoId: string;
  version: number;
  label: string;
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
  createdAt: string;
}

export interface ModerationResult {
  moderated: boolean;
  score: number | null;
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

export interface ApiKeyUsageMetric {
  requests: number;
  assets: number;
  errors: number;
  bytes: number;
}

export type ApiKeyUsageAction = 'upload' | 'video-upload' | 'read' | 'write' | 'delete';

export interface ApiKeyUsageSummary {
  range: { days: number; from: string };
  keys: Array<{
    id: string;
    name: string;
    lastFour: string;
    scopes: string[];
    usage: ApiKeyUsageMetric & {
      byAction: Record<ApiKeyUsageAction, ApiKeyUsageMetric>;
    };
  }>;
}

export interface WebhookEndpointRecord {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: string;
}

export interface CreateWebhookResponse {
  webhook: WebhookEndpointRecord & { secret: string };
}

export interface UpdateWebhookResponse {
  webhook: WebhookEndpointRecord;
  secret?: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  eventType:
    | 'image.uploaded'
    | 'image.updated'
    | 'image.deleted'
    | 'video.uploaded'
    | 'video.updated'
    | 'video.deleted';
  data: unknown;
  status: 'pending' | 'delivered' | 'failed';
  responseCode: number | null;
  attempts: number;
  error: string | null;
  nextAttemptAt: string;
  deliveredAt: string | null;
  createdAt: string;
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
  aiModerated?: boolean;
  aiModerationScore?: number | null;
  status: string;
  metadata?: Record<string, string>;
  renditions: VideoRenditionRecord[];
  clips?: VideoClipRecord[];
  hlsPackages: VideoHlsPackageRecord[];
  dashPackages: VideoDashPackageRecord[];
  versions?: VideoVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface VideoClipRecord {
  id: string;
  videoId: string;
  name: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  muted: boolean;
  sourceLabel: string | null;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export type HlsVariantRecord = {
  label: '360p' | '720p';
  playlistPath: string;
  segmentPaths: string[];
  width: number;
  height: number;
  bandwidthKbps: number;
};

export interface VideoHlsPackageRecord {
  id: string;
  label: string;
  publicUrl: string;
  masterPath: string;
  variants: HlsVariantRecord[];
  segmentPaths: string[];
  totalFileSize: number;
  status: string;
}

export type DashVariantRecord = {
  label: '360p' | '720p';
  playlistPath: string;
  initPath: string;
  mediaSegmentPaths: string[];
  width: number;
  height: number;
  bandwidthKbps: number;
};

export interface VideoDashPackageRecord {
  id: string;
  label: string;
  publicUrl: string;
  manifestPath: string;
  variants: DashVariantRecord[];
  filePaths: string[];
  totalFileSize: number;
  status: string;
}

export interface VideoRenditionRecord {
  id: string;
  label: string;
  publicUrl: string;
  storagePath: string;
  width: number;
  height: number;
  bitrateKbps: number;
  fileSize: number;
  status: string;
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
  metadata?: string; // encoded field:value filters
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
  versions: ImageVersionRecord[];
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

// GET /api/serve/[...path]?w=800&h=600&q=80&fmt=auto&fit=cover&g=center
export interface TransformParams {
  t?: string;
  w?: number; // width (pixels)
  h?: number; // height (pixels)
  q?: number | 'auto'; // quality (1-100 or automatic)
  fmt?: 'jpeg' | 'webp' | 'avif' | 'png' | 'auto';
  fit?:
    | 'cover'
    | 'contain'
    | 'fill'
    | 'inside'
    | 'outside'
    | 'thumb'
    | 'limit';
  g?: TransformGravity;
  ar?: string;
  b?: string;
  a?: number;
  e?: Array<TransformEffect>;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  dpr?: number;
  text?: string;
  overlayId?: string;
}

export type TransformGravity =
  | 'center'
  | 'auto'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'face'
  | 'faces';

export interface TransformEffect {
  brightness?: number;
  contrast?: number;
  gamma?: number;
  grayscale?: boolean;
  sepia?: number;
  blur?: number;
  sharpen?: number;
  saturation?: number;
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
  directUrl: string;
  transformUrl?: string;
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
  | 'moderating'
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
  moderation?: ContentSafetyResult;
  result?: ImageRecord; // Server response after successful upload
  attempts?: number;
  options: {
    removeBg: boolean;
    compress: boolean;
    moderate: boolean;
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
    moderate: boolean; // Local subject-mask moderation toggle
  };
  isUploading: boolean;
  completedCount: number;
  errorCount: number;
}

export interface ContentSafetyResult {
  safe: boolean;
  score: number;
  threshold: number;
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
