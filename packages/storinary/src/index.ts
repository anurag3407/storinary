export type Resource = {
  id?: string;
  publicUrl?: string;
  storagePath?: string;
  secure_url?: string;
  public_id?: string;
  originalName?: string;
  posterPath?: string | null;
  [key: string]: unknown;
};

export type UploadOptions = {
  file: File;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  uploadPreset?: string;
  folder?: string;
  tags?: string;
  altText?: string;
  renditions?: boolean;
  signal?: AbortSignal;
};

export type TransformationOptions = {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  format?: 'jpeg' | 'webp' | 'avif' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' | 'thumb' | 'limit';
  gravity?: 'center' | 'auto' | 'north' | 'south' | 'east' | 'west' | 'face' | 'faces';
  aspectRatio?: string;
  background?: string;
  angle?: number;
  grayscale?: boolean;
  sepia?: number;
  blur?: number;
  sharpen?: number;
  saturation?: number;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  dpr?: number | 'auto';
  namedTransform?: string;
  text?: string;
  overlayId?: string;
};

export type AiInsight = {
  provider: string;
  model: string;
  kind: string;
  tags: string[];
  altText: string | null;
  moderationScore: number | null;
  isSafe: boolean | null;
};

export type MetadataField = {
  id: string;
  externalId: string;
  label: string;
  type: 'string' | 'integer' | 'boolean' | 'enum';
  required: boolean;
  allowedValues: string[];
  active: boolean;
};

export type StructuredMetadata = Record<string, string | number | boolean | null | undefined>;

export type VideoClip = {
  id: string;
  videoId: string;
  name: string;
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
};

export type CreateVideoClipOptions = RequestOptions & {
  start?: number;
  duration?: number;
  end?: number;
  name?: string;
  persist?: boolean;
  rendition?: string;
  format?: 'mp4' | 'webm';
  muted?: boolean;
};

export type RestoreVersionOptions = RequestOptions & {
  resourceType: 'image' | 'video';
  versionId: string;
};

export type ListOptions = {
  limit?: number;
  cursor?: string;
  folder?: string;
  collectionId?: string;
  resourceType?: 'image' | 'video' | 'all';
  signal?: AbortSignal;
};

export type CollectionRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    image?: Record<string, unknown>;
    video?: Record<string, unknown>;
  }>;
};

export type MediaListResponse<ResourceType extends Resource> = {
  resources: ResourceType[];
  pagination: { nextCursor: string | null };
};

export type RestoreVersionResponse = {
  restoredVersion?: {
    id: string;
    version: number;
  };
  resources: Array<Resource>;
};

export type RequestOptions = {
  signal?: AbortSignal;
};

export class StorinaryApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StorinaryApiError';
    this.status = status;
  }
}

export type StorinaryClientConfig = {
  baseUrl?: string;
  apiKey?: string;
};

export type SignatureParameters = Record<string, string>;

export function buildTransformQuery(transforms: TransformationOptions = {}): string {
  const query = new URLSearchParams();
  if (transforms.width !== undefined) query.set('w', String(transforms.width));
  if (transforms.height !== undefined) query.set('h', String(transforms.height));
  if (transforms.quality !== undefined) query.set('q', String(transforms.quality));
  if (transforms.format) query.set('fmt', transforms.format);
  if (transforms.fit) query.set('fit', transforms.fit);
  if (transforms.gravity) query.set('g', transforms.gravity);
  if (transforms.aspectRatio) query.set('ar', transforms.aspectRatio);
  if (transforms.background) query.set('b', transforms.background);
  if (transforms.angle !== undefined) query.set('a', String(transforms.angle));
  if (transforms.grayscale) query.append('e', 'grayscale');

  const effects: Array<[string, number]> = [];
  for (const [name, value] of Object.entries({
    sepia: transforms.sepia,
    blur: transforms.blur,
    sharpen: transforms.sharpen,
    saturation: transforms.saturation,
  })) {
    if (value !== undefined) effects.push([name, value]);
  }
  for (const [name, value] of effects) {
    query.append('e', `${name}:${Math.round(value)}`);
  }

  for (const [name, value] of Object.entries({
    brightness: transforms.brightness,
    contrast: transforms.contrast,
    gamma: transforms.gamma,
    dpr: transforms.dpr,
  })) {
    if (value !== undefined) query.set(name, String(value));
  }

  if (transforms.namedTransform) query.set('t', transforms.namedTransform);
  if (transforms.text) query.set('text', transforms.text);
  if (transforms.overlayId) query.set('overlay', transforms.overlayId);
  return query.toString();
}

export async function createUploadSignature(
  secret: string,
  parameters: SignatureParameters,
  timestamp = Math.floor(Date.now() / 1000)
): Promise<{ timestamp: number; signature: string }> {
  const canonical = Object.keys(parameters)
    .filter((name) => name !== 'file' && name !== 'api_signature')
    .sort()
    .map((name) => `${name}=${parameters[name]}`)
    .join('&');
  const message = new TextEncoder().encode(`${canonical}${timestamp}`);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return {
    timestamp,
    signature: Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export class StorinaryClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: StorinaryClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? '/').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  private requestHeaders(json = false): HeadersInit | undefined {
    if (!this.apiKey && !json) return undefined;
    return {
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private async parse<T>(response: Response, allowEmptyBody = false): Promise<T> {
    if (response.ok) {
      const text = await response.text();
      return text ? JSON.parse(text) as T : undefined as T;
    }
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json() as { error?: unknown; errors?: Array<{ error?: unknown }> };
      const nestedError = payload.errors?.[0]?.error;
      if (typeof nestedError === 'string') message = nestedError;
      else if (typeof payload.error === 'string') message = payload.error;
    } catch {
    }
    throw new StorinaryApiError(message, response.status);
  }

  private async uploadRequest<T>(
    endpoint: string,
    options: UploadOptions,
    signedFields?: { timestamp: number; signature: string; secret: string }
  ): Promise<T> {
    const formData = new FormData();
    formData.set('file', options.file);
    if (options.uploadPreset) formData.set('upload_preset', options.uploadPreset);
    if (options.folder) formData.set('folder', options.folder);
    if (options.tags) formData.set('tags', options.tags);
    if (options.altText) formData.set('altText', options.altText);
    if (options.renditions !== undefined) formData.set('renditions', String(options.renditions));

    if (signedFields) {
      formData.set('api_key', signedFields.secret);
      formData.set('timestamp', String(signedFields.timestamp));
      formData.set('api_signature', signedFields.signature);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: endpoint === '/videos' ? { 'X-API-Key': signedFields?.secret ?? this.apiKey ?? '' } : undefined,
      body: formData,
      signal: options.signal,
    });
    return await this.parse<T>(response);
  }

  private normalizeResource(resource: Record<string, unknown>): Resource {
    return {
      ...resource,
      id: typeof resource.id === 'string'
        ? resource.id
        : typeof resource.public_id === 'string' ? resource.public_id : undefined,
      publicUrl: typeof resource.publicUrl === 'string'
        ? resource.publicUrl
        : typeof resource.secure_url === 'string' ? resource.secure_url : undefined,
    };
  }

  private extractResources<T extends Resource>(payload: unknown, kind: 'image' | 'video'): T[] {
    if (!payload || typeof payload !== 'object') return [];
    const container = payload as Record<string, unknown>;
    const resources = kind === 'video' ? container.videos : container.images;
    return Array.isArray(resources) ? resources.map((item) =>
      this.normalizeResource(item as Record<string, unknown>)
    ) as T[] : [];
  }

  transformUrl(resourceOrPath: Resource | string, transforms: TransformationOptions = {}): string {
    const storagePath = typeof resourceOrPath === 'string'
      ? resourceOrPath
      : typeof resourceOrPath.storagePath === 'string'
        ? resourceOrPath.storagePath
        : undefined;
    if (!storagePath) throw new StorinaryApiError('Resource has no storage path', 400);
    const query = buildTransformQuery(transforms);
    return `${this.baseUrl}/serve/${storagePath}${query ? `?${query}` : ''}`;
  }

  async uploadImage(options: UploadOptions): Promise<Resource> {
    const payload = await this.uploadRequest<{ images?: Record<string, unknown>[]; errors?: Array<{ error?: string }>; success?: boolean }>(
      '/upload',
      options,
      options.apiKey && options.signature && options.timestamp !== undefined
        ? { secret: options.apiKey, signature: options.signature, timestamp: options.timestamp }
        : undefined
    );
    if (!payload.success) {
      throw new StorinaryApiError(
        payload.errors?.[0]?.error ?? 'Upload failed',
        500
      );
    }
    const image = this.extractResources(payload, 'image')[0];
    if (!image || !payload.success) throw new StorinaryApiError('Upload failed', 500);
    return image;
  }

  async uploadVideo(options: UploadOptions): Promise<Resource> {
    const payload = await this.uploadRequest<{ videos?: Record<string, unknown>[]; errors?: Array<{ error?: string }>; success?: boolean }>(
      '/videos',
      options,
      options.apiKey && options.signature && options.timestamp !== undefined
        ? { secret: options.apiKey, signature: options.signature, timestamp: options.timestamp }
        : undefined
    );
    const video = this.extractResources(payload, 'video')[0];
    if (!video) throw new StorinaryApiError('Upload failed', 500);
    return video;
  }

  async listMedia<T extends Resource>(options: ListOptions = {}): Promise<MediaListResponse<T>> {
    const params = new URLSearchParams({
      limit: String(Math.min(Math.max(options.limit ?? 20, 1), 100)),
      resource_type: options.resourceType ?? 'all',
    });
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.folder) params.set('folder', options.folder);
    if (options.collectionId) params.set('collection_id', options.collectionId);
    const response = await fetch(`${this.baseUrl}/v1/media?${params}`, {
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    return await this.parse<MediaListResponse<T>>(response);
  }

  async getResource(id: string, options: RequestOptions & { resourceType?: 'image' | 'video' } = {}): Promise<Resource> {
    const params = new URLSearchParams({ resource_type: options.resourceType ?? 'image' });
    const response = await fetch(`${this.baseUrl}/v1/media/${encodeURIComponent(id)}?${params}`, {
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    const payload = await this.parse<{ resources?: Array<Record<string, unknown>> }>(response);
    const resource = payload.resources?.[0];
    if (!resource) throw new StorinaryApiError('Not found', 404);
    return this.normalizeResource(resource) as Resource;
  }

  async updateMetadata(id: string, data: { tags?: string; altText?: string; folder?: string }, options: RequestOptions & { resourceType?: 'image' | 'video' } = {}): Promise<void> {
    const params = new URLSearchParams({ resource_type: options.resourceType ?? 'image' });
    const response = await fetch(`${this.baseUrl}/v1/media/${encodeURIComponent(id)}?${params}`, {
      method: 'PATCH',
      headers: this.requestHeaders(true),
      body: JSON.stringify(data),
      signal: options.signal,
    });
    await this.parse(response);
  }

  async restoreVersion(
    id: string,
    options: RestoreVersionOptions
  ): Promise<RestoreVersionResponse> {
    const params = new URLSearchParams({ resource_type: options.resourceType });
    const response = await fetch(`${this.baseUrl}/v1/media/${encodeURIComponent(id)}?${params}`, {
      method: 'PATCH',
      headers: this.requestHeaders(true),
      body: JSON.stringify({ restoreVersionId: options.versionId }),
      signal: options.signal,
    });
    return await this.parse(response);
  }

  async destroy(id: string, options: RequestOptions & { resourceType?: 'image' | 'video' | 'all' } = {}): Promise<void> {
    const params = new URLSearchParams({ resource_type: options.resourceType ?? 'image' });
    const response = await fetch(`${this.baseUrl}/v1/media/${encodeURIComponent(id)}?${params}`, {
      method: 'DELETE',
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    await this.parse(response);
  }

  async analyzeImage(
    id: string,
    options: RequestOptions & { tags?: boolean; caption?: boolean; moderation?: boolean; replaceMetadata?: boolean } = {}
  ): Promise<{ insight: AiInsight }> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      tags: options.tags,
      caption: options.caption,
      moderation: options.moderation,
      replace_metadata: options.replaceMetadata,
    })) {
      if (typeof value === 'boolean') query.set(key, String(value));
    }
    const response = await fetch(`${this.baseUrl}/images/${encodeURIComponent(id)}/ai?${query}`, {
      method: 'POST',
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    return await this.parse(response);
  }

  async analyzeVideo(
    id: string,
    options: RequestOptions & { tags?: boolean; caption?: boolean; moderation?: boolean; replaceMetadata?: boolean } = {}
  ): Promise<{ insight: AiInsight }> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({
      tags: options.tags,
      caption: options.caption,
      moderation: options.moderation,
      replace_metadata: options.replaceMetadata,
    })) {
      if (typeof value === 'boolean') query.set(key, String(value));
    }
    const response = await fetch(`${this.baseUrl}/videos/${encodeURIComponent(id)}/ai?${query}`, {
      method: 'POST',
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    return await this.parse(response);
  }

  async createVideoClip(
    videoId: string,
    options: CreateVideoClipOptions & { apiKey?: string } = {}
  ): Promise<{ clip: VideoClip }> {
    const { apiKey, signal, ...body } = options;
    const response = await fetch(
      `${this.baseUrl}/videos/${encodeURIComponent(videoId)}/clip`,
      {
        method: 'POST',
        headers: {
          ...this.requestHeaders(true),
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({ ...body, persist: body.persist ?? true }),
        signal,
      }
    );
    return await this.parse(response);
  }

  async listVideoClips(videoId: string, options: RequestOptions = {}): Promise<Array<VideoClip>> {
    const response = await fetch(
      `${this.baseUrl}/videos/${encodeURIComponent(videoId)}/clip`,
      {
        headers: this.requestHeaders(),
        signal: options.signal,
      }
    );
    const payload = await this.parse<{ clips: Array<VideoClip> }>(response);
    return payload.clips;
  }

  async deleteVideoClip(videoId: string, name: string, options: RequestOptions = {}): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/videos/${encodeURIComponent(videoId)}/clip/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
        headers: this.requestHeaders(),
        signal: options.signal,
      }
    );
    await this.parse(response);
  }

  async listMetadataFields(options: RequestOptions = {}): Promise<MetadataField[]> {
    const response = await fetch(`${this.baseUrl}/metadata-fields`, {
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    const payload = await this.parse<{ fields: MetadataField[] }>(response);
    return payload.fields;
  }

  async createCollection(input: { name: string; description?: string }, options: RequestOptions & { apiKey?: string } = {}): Promise<CollectionRecord> {
    const response = await fetch(`${this.baseUrl}/collections`, {
      method: 'POST',
      headers: {
        ...this.requestHeaders(true),
        ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
      },
      body: JSON.stringify({ name: input.name, description: input.description ?? '' }),
      signal: options.signal,
    });
    const payload = await this.parse<{ collection: CollectionRecord }>(response);
    return payload.collection;
  }

  async listCollections(options: RequestOptions = {}): Promise<Array<CollectionRecord>> {
    const response = await fetch(`${this.baseUrl}/collections`, {
      headers: this.requestHeaders(),
      signal: options.signal,
    });
    const payload = await this.parse<{ collections: Array<CollectionRecord> }>(response);
    return payload.collections;
  }

  async addToCollection(
    collectionId: string,
    assets: { imageIds?: Array<string>; videoIds?: Array<string> },
    options: RequestOptions & { apiKey?: string } = {}
  ): Promise<{ collection: CollectionRecord }> {
    const response = await fetch(
      `${this.baseUrl}/collections/${encodeURIComponent(collectionId)}`,
      {
        method: 'PATCH',
        headers: {
          ...this.requestHeaders(true),
          ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
        },
        body: JSON.stringify({
          action: 'add',
          imageIds: assets.imageIds ?? [],
          videoIds: assets.videoIds ?? [],
        }),
        signal: options.signal,
      }
    );
    return await this.parse(response);
  }

  async removeFromCollection(
    collectionId: string,
    assets: { imageIds?: Array<string>; videoIds?: Array<string> },
    options: RequestOptions & { apiKey?: string } = {}
  ): Promise<{ collection: CollectionRecord }> {
    const response = await fetch(
      `${this.baseUrl}/collections/${encodeURIComponent(collectionId)}`,
      {
        method: 'PATCH',
        headers: {
          ...this.requestHeaders(true),
          ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
        },
        body: JSON.stringify({
          action: 'remove',
          imageIds: assets.imageIds ?? [],
          videoIds: assets.videoIds ?? [],
        }),
        signal: options.signal,
      }
    );
    return await this.parse(response);
  }

  async createMetadataField(field: {
    externalId: string;
    label: string;
    type: MetadataField['type'];
    required?: boolean;
    allowedValues?: Array<string>;
    active?: boolean;
  }, options: RequestOptions & { apiKey?: string } = {}): Promise<MetadataField> {
    const response = await fetch(`${this.baseUrl}/metadata-fields`, {
      method: 'POST',
      headers: {
        ...this.requestHeaders(true),
        ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
      },
      body: JSON.stringify({
        required: false,
        active: true,
        allowedValues: [],
        ...field,
      }),
      signal: options.signal,
    });
    const payload = await this.parse<{ field: MetadataField }>(response);
    return payload.field;
  }
}

export function createStorinaryClient(config?: StorinaryClientConfig) {
  return new StorinaryClient(config);
}
