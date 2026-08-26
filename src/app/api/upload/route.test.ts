// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const {
  createMock,
  imageVersionCreateMock,
  uploadToStorageMock,
  getPublicUrlMock,
  generateStorageKeyMock,
  getImageMetadataMock,
} =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    imageVersionCreateMock: vi.fn(),
    uploadToStorageMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    generateStorageKeyMock: vi.fn(),
    getImageMetadataMock: vi.fn(),
  }));

const { authorizationMock, generateEagerTransformsMock } = vi.hoisted(() => ({
  authorizationMock: vi.fn(),
  authenticateApiKeyMock: vi.fn(),
  generateEagerTransformsMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: { create: createMock },
    imageVersion: { create: imageVersionCreateMock },
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadToStorage: uploadToStorageMock,
  getPublicUrl: getPublicUrlMock,
  generateStorageKey: generateStorageKeyMock,
}));

vi.mock('@/lib/image-processing', () => ({
  getImageMetadata: getImageMetadataMock,
}));

vi.mock('@/lib/media-auth', () => ({
  authorizeDashboardOrApiKey: authorizationMock,
}));

const { dispatchWebhooksMock } = vi.hoisted(() => ({ dispatchWebhooksMock: vi.fn() }));

vi.mock('@/lib/webhooks', () => ({ dispatchWebhooks: dispatchWebhooksMock }));

vi.mock('@/lib/eager-transforms', () => ({
  generateEagerTransforms: generateEagerTransformsMock,
}));

vi.mock('@/lib/asset-versions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/asset-versions')>(
    '@/lib/asset-versions'
  );
  return { ...actual };
});

const ROW = {
  id: 'img-1',
  originalName: 'photo.png',
  storagePath: '2024/01/photo-abc12345.png',
  publicUrl: 'https://cdn.example/2024/01/photo-abc12345.png',
  width: 640,
  height: 480,
  fileSize: 2048,
  format: 'png',
  mimeType: 'image/png',
  folder: '/',
  tags: '',
  altText: '',
  bgRemoved: false,
  aiModerated: false,
  aiModerationScore: null,
  compressed: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

function makeRequest(formData: FormData) {
  return new NextRequest('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

function setupSuccessfulUpload() {
  setupVersionCapture();
  getImageMetadataMock.mockResolvedValue({ width: 1, height: 1, format: 'png', size: 3 });
  generateStorageKeyMock.mockReturnValue('key.png');
  uploadToStorageMock.mockResolvedValue(undefined);
  getPublicUrlMock.mockReturnValue('https://cdn.example/key.png');
  createMock.mockResolvedValue(ROW);
}

function setupVersionCapture() {
  imageVersionCreateMock.mockImplementation(({ data }: { data: { version: number } }) =>
    Promise.resolve({
      id: `version-${data.version}`,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      ...data,
    })
  );
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    authorizationMock.mockReset().mockResolvedValue({ ok: true, keyId: null });
    generateEagerTransformsMock.mockReset().mockResolvedValue([]);
    dispatchWebhooksMock.mockReset();
    createMock.mockReset();
    uploadToStorageMock.mockReset();
    getPublicUrlMock.mockReset();
    generateStorageKeyMock.mockReset();
    getImageMetadataMock.mockReset();
  });

  it('rejects unauthenticated requests without credentials or a session', async () => {
    authorizationMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'Unauthorized',
    });
    const formData = new FormData();
    formData.append('file', new File(['png'], 'photo.png', { type: 'image/png' }));

    const response = await POST(makeRequest(formData));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('allows dashboard sessions without an API key', async () => {
    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    authorizationMock.mockResolvedValue({ ok: true, keyId: null });
    getImageMetadataMock.mockResolvedValue({ width: 1, height: 1, format: 'png', size: 4 });
    generateStorageKeyMock.mockReturnValue('key.png');
    createMock.mockResolvedValue(ROW);
    imageVersionCreateMock.mockReset().mockImplementation(({ data }: { data: { version: number } }) =>
      Promise.resolve({
        id: `version-${data.version}`,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        ...data,
      })
    );

    const response = await POST(makeRequest(formData));

    expect(response.status).toBe(200);
    expect(authorizationMock).toHaveBeenCalledTimes(1);
    const [request, receivedFormData] = authorizationMock.mock.calls[0];
    expect(request).toBeInstanceOf(NextRequest);
    expect(receivedFormData.get('file')).toBeInstanceOf(File);
  });

  it('rejects empty form data with 400', async () => {
    const response = await POST(makeRequest(new FormData()));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors[0].error).toBe('No files provided');
  });

  it('uploads a valid file and creates a db record', async () => {
    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', '/products');
    formData.append('tags', 'hero,product');
    formData.append('compressed', 'true');

    getImageMetadataMock.mockResolvedValue({ width: 640, height: 480, format: 'png', size: 2048 });
    generateStorageKeyMock.mockReturnValue('2024/01/photo-abc12345.png');
    uploadToStorageMock.mockResolvedValue(undefined);
    getPublicUrlMock.mockReturnValue('https://cdn.example/2024/01/photo-abc12345.png');
    createMock.mockResolvedValue(ROW);

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.images).toHaveLength(1);
    expect(body.images[0].id).toBe('img-1');
    expect(body.errors).toHaveLength(0);
    expect(imageVersionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imageId: 'img-1',
        version: 1,
        label: 'original',
        storagePath: '2024/01/photo-abc12345.png',
        fileSize: 2048,
      }),
    });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalName: 'photo.png',
        folder: '/products',
        tags: 'hero,product',
        compressed: true,
        bgRemoved: false,
        aiModerated: false,
        aiModerationScore: null,
      }),
    });
  });

  it('collects per-file errors for invalid files', async () => {
    const badType = new File(['x'], 'bad.zip', { type: 'application/zip' });
    const formData = new FormData();
    formData.append('file', badType);

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.images).toHaveLength(0);
    expect(body.errors[0]).toEqual({
      filename: 'bad.zip',
      error: expect.stringContaining('Unsupported format'),
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('persists valid moderation results and rejects malformed scores safely', async () => {
    const formData = new FormData();
    formData.append('file', new File(['png'], 'photo.png', { type: 'image/png' }));
    formData.append('moderated', 'true');
    formData.append('moderationScore', '0.42');
    setupSuccessfulUpload();
    await POST(makeRequest(formData));
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ aiModerated: true, aiModerationScore: 0.42 }),
    });

    const invalid = new FormData();
    invalid.append('file', new File(['png'], 'bad.png', { type: 'image/png' }));
    invalid.append('moderated', 'true');
    invalid.append('moderationScore', '2.5');
    createMock.mockClear();
    await POST(makeRequest(invalid));
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ aiModerated: true, aiModerationScore: null }),
    });
  });

  it('reports upload failures without aborting other files', async () => {
    const good = new File(['png'], 'good.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', good);

    getImageMetadataMock.mockResolvedValue({ width: 10, height: 10, format: 'png', size: 3 });
    generateStorageKeyMock.mockReturnValue('2024/01/good-123.png');
    uploadToStorageMock.mockRejectedValue(new Error('storage down'));

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.errors[0].error).toBe('storage down');
  });

  it('rejects SVGs containing scripts', async () => {
    const badSvg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'evil.svg',
      { type: 'image/svg+xml' }
    );
    const formData = new FormData();
    formData.append('file', badSvg);

    getImageMetadataMock.mockResolvedValue({
      width: 10,
      height: 10,
      format: 'svg',
      size: 70,
    });

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.errors[0].error).toContain('SVG contains unsafe content');
    expect(uploadToStorageMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('accepts a safe SVG', async () => {
    const goodSvg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],
      'ok.svg',
      { type: 'image/svg+xml' }
    );
    const formData = new FormData();
    formData.append('file', goodSvg);

    getImageMetadataMock.mockResolvedValue({
      width: 10,
      height: 10,
      format: 'svg',
      size: 70,
    });
    generateStorageKeyMock.mockReturnValue('2024/01/ok-123.svg');
    uploadToStorageMock.mockResolvedValue(undefined);
    getPublicUrlMock.mockReturnValue('https://cdn.example/2024/01/ok-123.svg');
    createMock.mockResolvedValue({ ...ROW, id: 'img-2' });
    setupSuccessfulUpload();

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  it('treats oversized files as errors', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    const formData = new FormData();
    formData.append('file', big);

    const response = await POST(makeRequest(formData));
    const body = await response.json();
    expect(body.errors[0].error).toContain('File too large');
  });
});
