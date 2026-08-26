export type StorinaryWidgetMode = 'auto' | 'manual';

export type StorinaryWidgetOptions = {
  endpoint?: string;
  uploadPreset?: string;
  resourceType?: 'image' | 'video';
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  tags?: string;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  mode?: StorinaryWidgetMode;
  signal?: AbortSignal;
};

export type UploadProgress = {
  loaded: number;
  total: number | null;
  progress: number;
};

export type StorinaryWidgetResult = {
  id?: string;
  publicUrl?: string;
  originalName?: string;
  posterUrl?: string;
};

export type StorinaryUploadResponse = {
  success: boolean;
  images: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  errors: Array<{ filename: string; error: string }>;
};

const DEFAULT_ENDPOINT = '/api/upload';

function normalizeEndpoint(endpoint: string): string {
  return new URL(endpoint, window.location.href).toString();
}

export function buildStorinaryFormData(
  file: File,
  options: StorinaryWidgetOptions
): FormData {
  const formData = new FormData();
  formData.set('file', file);

  if (options.uploadPreset) formData.set('upload_preset', options.uploadPreset);
  if (options.resourceType === 'video') formData.set('resource_type', 'video');
  if (options.folder) formData.set('folder', options.folder);
  if (options.tags) formData.set('tags', options.tags);
  if (options.apiKey) formData.set('api_key', options.apiKey);
  if (typeof options.timestamp === 'number') {
    formData.set('timestamp', String(Math.floor(options.timestamp)));
  }
  if (options.signature) formData.set('api_signature', options.signature);

  return formData;
}

export async function storinaryUploadFile(
  file: File,
  options: StorinaryWidgetOptions = {},
  onProgress?: (progress: UploadProgress) => void
): Promise<StorinaryWidgetResult> {
  const isVideo = options.resourceType === 'video';
  const endpoint = isVideo && options.endpoint !== undefined && options.endpoint !== DEFAULT_ENDPOINT
    ? options.endpoint
    : isVideo ? '/api/videos' : (options.endpoint || DEFAULT_ENDPOINT);
  const headers = isVideo ? { 'X-API-Key': options.apiKey || '' } : undefined;
  const response = await new Promise<Response>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', normalizeEndpoint(endpoint));
    if (headers) {
      Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    }
    if (options.signal) {
      options.signal.addEventListener('abort', () => request.abort(), { once: true });
    }
    request.upload.addEventListener('progress', (event) => {
      onProgress?.({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : null,
        progress: event.lengthComputable ? Math.min(1, event.loaded / event.total) : 0,
      });
    });
    request.addEventListener('load', () => resolve(new Response(request.response, {
      status: request.status,
      statusText: request.statusText,
      headers: { 'Content-Type': request.getResponseHeader('Content-Type') || 'application/json' },
    })));
    request.addEventListener('error', () => reject(new TypeError('Network request failed')));
    request.addEventListener('abort', () => reject(new DOMException('Upload aborted', 'AbortError')));
    request.send(buildStorinaryFormData(file, options));
  });
  let payload: StorinaryUploadResponse | null;
  try {
    payload = await response.json() as StorinaryUploadResponse;
  } catch {
    payload = null;
  }

  const resources = isVideo ? payload?.videos : payload?.images;
  if (!response.ok || !payload?.success || !resources?.length) {
    const error = payload?.errors[0]?.error;
    throw new Error(error && typeof error === 'string' ? error : `Upload failed (${response.status})`);
  }

  const image = resources[0] as {
    id?: string;
    publicUrl?: string;
    originalName?: string;
    posterUrl?: string | null;
  };
  return {
    id: image.id,
    publicUrl: image.publicUrl,
    posterUrl: image.posterUrl ?? undefined,
    originalName: image.originalName ?? file.name,
  };
}
