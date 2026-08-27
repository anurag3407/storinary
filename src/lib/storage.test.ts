import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock Supabase and Appwrite clients before importing module ──────────────
const {
  getPublicUrlMock,
  removeMock,
  downloadMock,
  uploadMock,
  listMock,
  appwriteCreateFileMock,
  appwriteGetFileDownloadMock,
  appwriteGetFileMock,
  appwriteDeleteFileMock,
  appwriteListFilesMock,
} = vi.hoisted(() => ({
  getPublicUrlMock: vi.fn(),
  removeMock: vi.fn(),
  downloadMock: vi.fn(),
  uploadMock: vi.fn(),
  listMock: vi.fn(),
  appwriteCreateFileMock: vi.fn(),
  appwriteGetFileDownloadMock: vi.fn(),
  appwriteGetFileMock: vi.fn(),
  appwriteDeleteFileMock: vi.fn(),
  appwriteListFilesMock: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: getPublicUrlMock,
        remove: removeMock,
        download: downloadMock,
        upload: uploadMock,
        list: listMock,
      })),
    },
  })),
}));

vi.mock('node-appwrite', () => {
  class Client {
    setEndpoint = vi.fn().mockReturnThis();
    setProject = vi.fn().mockReturnThis();
    setKey = vi.fn().mockReturnThis();
  }
  class Storage {
    createFile = appwriteCreateFileMock;
    getFileDownload = appwriteGetFileDownloadMock;
    getFile = appwriteGetFileMock;
    deleteFile = appwriteDeleteFileMock;
    listFiles = appwriteListFilesMock;
  }
  return {
    Client,
    Storage,
    ID: { unique: () => 'unique_id_123' },
  };
});

vi.mock('node-appwrite/file', () => {
  class InputFile {
    static fromBuffer = vi.fn((buf: unknown, filename: string) => ({ buffer: buf, filename }));
  }
  return {
    InputFile,
  };
});

import {
  BUCKET,
  bulkDeleteFromStorage,
  deleteFromStorage,
  generateStorageKey,
  getFromStorage,
  getPublicUrl,
  getStorageProvider,
  getStorageProviderInfo,
  listStorageObjects,
  resetBackblazeCache,
  sanitizeAppwriteFileId,
  uploadToStorage,
} from './storage';

describe('Storage Provider Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetBackblazeCache();
  });

  it('prioritizes backblaze when all 3 credentials (backblaze, appwrite, supabase) are present', () => {
    delete process.env.STORAGE_PROVIDER;
    process.env.BACKBLAZE_APPLICATION_KEY_ID = 'b2_key_id';
    process.env.BACKBLAZE_APPLICATION_KEY = 'b2_app_key';
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'appwrite_project';
    process.env.APPWRITE_API_KEY = 'appwrite_key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase_key';

    expect(getStorageProvider()).toBe('backblaze');
  });

  it('prioritizes appwrite when appwrite and supabase credentials are provided (no backblaze)', () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.BACKBLAZE_APPLICATION_KEY_ID;
    delete process.env.BACKBLAZE_KEY_ID;
    delete process.env.B2_APPLICATION_KEY_ID;
    delete process.env.BACKBLAZE_APPLICATION_KEY;
    delete process.env.B2_APPLICATION_KEY;

    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'appwrite_project';
    process.env.APPWRITE_API_KEY = 'appwrite_key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase_key';

    expect(getStorageProvider()).toBe('appwrite');
  });

  it('selects backblaze when only backblaze credentials are provided', () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    delete process.env.APPWRITE_ENDPOINT;
    delete process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    delete process.env.APPWRITE_PROJECT_ID;
    delete process.env.APPWRITE_API_KEY;

    process.env.BACKBLAZE_APPLICATION_KEY_ID = 'b2_id_123';
    process.env.BACKBLAZE_APPLICATION_KEY = 'b2_key_secret';

    expect(getStorageProvider()).toBe('backblaze');
  });

  it('selects appwrite when only appwrite credentials are provided', () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.BACKBLAZE_APPLICATION_KEY_ID;
    delete process.env.BACKBLAZE_APPLICATION_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'appwrite_project_123';
    process.env.APPWRITE_API_KEY = 'appwrite_secret_key';

    expect(getStorageProvider()).toBe('appwrite');
  });

  it('selects supabase when only supabase credentials are provided', () => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.BACKBLAZE_APPLICATION_KEY_ID;
    delete process.env.BACKBLAZE_APPLICATION_KEY;
    delete process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    delete process.env.APPWRITE_ENDPOINT;
    delete process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    delete process.env.APPWRITE_PROJECT_ID;
    delete process.env.APPWRITE_API_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase_key';

    expect(getStorageProvider()).toBe('supabase');
  });

  it('respects explicit STORAGE_PROVIDER override', () => {
    process.env.STORAGE_PROVIDER = 'backblaze';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(getStorageProvider()).toBe('backblaze');

    process.env.STORAGE_PROVIDER = 'b2';
    expect(getStorageProvider()).toBe('backblaze');

    process.env.STORAGE_PROVIDER = 'appwrite';
    expect(getStorageProvider()).toBe('appwrite');

    process.env.STORAGE_PROVIDER = 'supabase';
    expect(getStorageProvider()).toBe('supabase');
  });
});

describe('sanitizeAppwriteFileId', () => {
  it('replaces slashes and invalid characters with hyphens', () => {
    const key = '2026/08/my photo@2x!.webp';
    const clean = sanitizeAppwriteFileId(key);
    expect(clean).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(clean).not.toContain('/');
    expect(clean).not.toContain('@');
    expect(clean).not.toContain('!');
  });

  it('strips leading special characters', () => {
    expect(sanitizeAppwriteFileId('---my-file.png')).toBe('my-file.png');
    expect(sanitizeAppwriteFileId('...dot-file.png')).toBe('dot-file.png');
    expect(sanitizeAppwriteFileId('___under.png')).toBe('under.png');
  });

  it('truncates keys longer than 36 chars while preserving extension', () => {
    const longName = 'this_is_an_extremely_long_image_filename_that_exceeds_limits.webp';
    const clean = sanitizeAppwriteFileId(longName);
    expect(clean.length).toBeLessThanOrEqual(36);
    expect(clean.endsWith('.webp')).toBe(true);
  });
});

describe('generateStorageKey', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds {year}/{month}/{name}-{id}.{format} for Supabase and Backblaze', () => {
    process.env.STORAGE_PROVIDER = 'supabase';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const key = generateStorageKey('My Photo.jpg', 'abc12345', 'webp');
    expect(key).toBe(`${year}/${month}/my-photo-abc12345.webp`);

    process.env.STORAGE_PROVIDER = 'backblaze';
    const keyB2 = generateStorageKey('My Photo.jpg', 'abc12345', 'webp');
    expect(keyB2).toBe(`${year}/${month}/my-photo-abc12345.webp`);
  });

  it('builds valid Appwrite fileId when provider is Appwrite', () => {
    process.env.STORAGE_PROVIDER = 'appwrite';
    const key = generateStorageKey('My Product Photo.jpg', 'abc12345', 'webp');
    expect(key.length).toBeLessThanOrEqual(36);
    expect(key).not.toContain('/');
    expect(key).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.webp$/);
  });
});

describe('Supabase Storage Operations', () => {
  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'supabase';
    uploadMock.mockReset();
    downloadMock.mockReset();
    removeMock.mockReset();
    listMock.mockReset();
    getPublicUrlMock.mockReset();
  });

  it('uploads with upsert and returns key', async () => {
    uploadMock.mockResolvedValue({ error: null });
    await expect(
      uploadToStorage(Buffer.from('data'), '2024/01/x.webp', 'image/webp')
    ).resolves.toBe('2024/01/x.webp');
    expect(uploadMock).toHaveBeenCalledWith(
      '2024/01/x.webp',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/webp', upsert: true })
    );
  });

  it('downloads file buffer and content type', async () => {
    downloadMock.mockResolvedValue({
      data: new Blob(['img'], { type: 'image/webp' }),
      error: null,
    });
    const result = await getFromStorage('2024/01/x.webp');
    expect(result.contentType).toBe('image/webp');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString()).toBe('img');
  });

  it('deletes a single key and bulk deletes', async () => {
    removeMock.mockResolvedValue({ error: null });
    await deleteFromStorage('2024/01/x.webp');
    expect(removeMock).toHaveBeenCalledWith(['2024/01/x.webp']);

    await bulkDeleteFromStorage(['a', 'b']);
    expect(removeMock).toHaveBeenCalledWith(['a', 'b']);

    await bulkDeleteFromStorage([]);
  });

  it('lists storage objects', async () => {
    listMock.mockResolvedValue({
      data: [
        {
          name: 'x.webp',
          metadata: { size: 100 },
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    const result = await listStorageObjects('folder');
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].key).toBe('folder/x.webp');
    expect(result.objects[0].size).toBe(100);
  });

  it('constructs public URL', () => {
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: `https://cdn.example/${BUCKET}/2024/01/x.webp` },
    });
    expect(getPublicUrl('2024/01/x.webp')).toContain('https://cdn.example');
  });
});

describe('Appwrite Storage Operations', () => {
  beforeEach(() => {
    process.env.STORAGE_PROVIDER = 'appwrite';
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'my_project';
    process.env.APPWRITE_BUCKET_ID = 'storinary';
    appwriteCreateFileMock.mockReset();
    appwriteGetFileDownloadMock.mockReset();
    appwriteGetFileMock.mockReset();
    appwriteDeleteFileMock.mockReset();
    appwriteListFilesMock.mockReset();
  });

  it('uploads file to Appwrite bucket and returns sanitized fileId', async () => {
    appwriteCreateFileMock.mockResolvedValue({ $id: 'photo-123.webp' });
    const fileId = await uploadToStorage(Buffer.from('appwrite-data'), 'photo-123.webp', 'image/webp');
    expect(fileId).toBe('photo-123.webp');
    expect(appwriteCreateFileMock).toHaveBeenCalledWith(
      'storinary',
      'photo-123.webp',
      expect.objectContaining({ filename: 'photo-123.webp' })
    );
  });

  it('handles 409 conflict on upload by deleting and recreating (upsert)', async () => {
    appwriteCreateFileMock
      .mockRejectedValueOnce({ code: 409, message: 'File already exists' })
      .mockResolvedValueOnce({ $id: 'conflict.webp' });
    appwriteDeleteFileMock.mockResolvedValue({});

    const fileId = await uploadToStorage(Buffer.from('new-data'), 'conflict.webp', 'image/webp');
    expect(fileId).toBe('conflict.webp');
    expect(appwriteDeleteFileMock).toHaveBeenCalledWith('storinary', 'conflict.webp');
    expect(appwriteCreateFileMock).toHaveBeenCalledTimes(2);
  });

  it('downloads file from Appwrite', async () => {
    const encoder = new TextEncoder();
    const arrayBuf = encoder.encode('appwrite-image-bytes').buffer;
    appwriteGetFileDownloadMock.mockResolvedValue(arrayBuf);
    appwriteGetFileMock.mockResolvedValue({ mimeType: 'image/webp' });

    const result = await getFromStorage('photo-123.webp');
    expect(result.contentType).toBe('image/webp');
    expect(result.buffer.toString()).toBe('appwrite-image-bytes');
  });

  it('deletes single file and bulk deletes from Appwrite', async () => {
    appwriteDeleteFileMock.mockResolvedValue({});
    await deleteFromStorage('photo-123.webp');
    expect(appwriteDeleteFileMock).toHaveBeenCalledWith('storinary', 'photo-123.webp');

    await bulkDeleteFromStorage(['a.webp', 'b.webp']);
    expect(appwriteDeleteFileMock).toHaveBeenCalledWith('storinary', 'a.webp');
    expect(appwriteDeleteFileMock).toHaveBeenCalledWith('storinary', 'b.webp');
  });

  it('lists objects from Appwrite', async () => {
    appwriteListFilesMock.mockResolvedValue({
      files: [
        {
          $id: 'file-1.webp',
          sizeOriginal: 2048,
          $createdAt: '2026-08-24T00:00:00.000Z',
        },
      ],
    });

    const result = await listStorageObjects();
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].key).toBe('file-1.webp');
    expect(result.objects[0].size).toBe(2048);
  });

  it('constructs public view URL for Appwrite', () => {
    const url = getPublicUrl('photo-123.webp');
    expect(url).toBe(
      'https://cloud.appwrite.io/v1/storage/buckets/storinary/files/photo-123.webp/view?project=my_project'
    );
  });
});

describe('Backblaze Storage Operations', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetBackblazeCache();
    process.env.STORAGE_PROVIDER = 'backblaze';
    process.env.BACKBLAZE_APPLICATION_KEY_ID = 'test_key_id';
    process.env.BACKBLAZE_APPLICATION_KEY = 'test_app_key';
    process.env.BACKBLAZE_BUCKET_NAME = 'storinary';
    delete process.env.BACKBLAZE_BUCKET_ID;
    delete process.env.NEXT_PUBLIC_BACKBLAZE_CDN_URL;

    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  const setupAuthAndBucketMocks = () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('b2_authorize_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accountId: 'acc_123',
            authorizationToken: 'auth_token_123',
            apiUrl: 'https://api005.backblazeb2.com',
            downloadUrl: 'https://f005.backblazeb2.com',
            allowed: { bucketId: 'bucket_abc123', bucketName: 'storinary' },
          }),
        } as Response;
      }
      return null;
    });
  };

  it('uploads file buffer to Backblaze B2', async () => {
    setupAuthAndBucketMocks();

    fetchMock.mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('b2_authorize_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accountId: 'acc_123',
            authorizationToken: 'auth_token_123',
            apiUrl: 'https://api005.backblazeb2.com',
            downloadUrl: 'https://f005.backblazeb2.com',
            allowed: { bucketId: 'bucket_abc123' },
          }),
        } as Response;
      }
      if (urlStr.includes('b2_get_upload_url')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            bucketId: 'bucket_abc123',
            uploadUrl: 'https://upload.backblazeb2.com/file/123',
            authorizationToken: 'upload_auth_token_789',
          }),
        } as Response;
      }
      if (urlStr.includes('upload.backblazeb2.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fileId: 'file_id_100',
            fileName: '2026/08/photo-abc12345.webp',
            contentLength: 4,
          }),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => 'Not found' } as Response;
    });

    const key = await uploadToStorage(
      Buffer.from('test'),
      '2026/08/photo-abc12345.webp',
      'image/webp'
    );
    expect(key).toBe('2026/08/photo-abc12345.webp');
  });

  it('downloads file from Backblaze B2', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('b2_authorize_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accountId: 'acc_123',
            authorizationToken: 'auth_token_123',
            apiUrl: 'https://api005.backblazeb2.com',
            downloadUrl: 'https://f005.backblazeb2.com',
          }),
        } as Response;
      }
      if (urlStr.includes('/file/storinary/2026/08/photo-abc12345.webp')) {
        const encoder = new TextEncoder();
        const data = encoder.encode('image-bytes-b2');
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/webp' }),
          arrayBuffer: async () => data.buffer,
        } as unknown as Response;
      }
      return { ok: false, status: 404, text: async () => 'Not found' } as Response;
    });

    const result = await getFromStorage('2026/08/photo-abc12345.webp');
    expect(result.contentType).toBe('image/webp');
    expect(result.buffer.toString()).toBe('image-bytes-b2');
  });

  it('deletes file versions and bulk deletes from Backblaze B2', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('b2_authorize_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accountId: 'acc_123',
            authorizationToken: 'auth_token_123',
            apiUrl: 'https://api005.backblazeb2.com',
            downloadUrl: 'https://f005.backblazeb2.com',
            allowed: { bucketId: 'bucket_abc123' },
          }),
        } as Response;
      }
      if (urlStr.includes('b2_list_file_versions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              {
                fileId: 'ver_1',
                fileName: '2026/08/photo.webp',
              },
            ],
          }),
        } as Response;
      }
      if (urlStr.includes('b2_delete_file_version')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fileId: 'ver_1',
            fileName: '2026/08/photo.webp',
          }),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => 'Not found' } as Response;
    });

    await deleteFromStorage('2026/08/photo.webp');
    await bulkDeleteFromStorage(['2026/08/photo.webp']);
  });

  it('lists files from Backblaze B2', async () => {
    fetchMock.mockImplementation(async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('b2_authorize_account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accountId: 'acc_123',
            authorizationToken: 'auth_token_123',
            apiUrl: 'https://api005.backblazeb2.com',
            downloadUrl: 'https://f005.backblazeb2.com',
            allowed: { bucketId: 'bucket_abc123' },
          }),
        } as Response;
      }
      if (urlStr.includes('b2_list_file_names')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [
              {
                fileName: '2026/08/item.webp',
                contentLength: 1024,
                uploadTimestamp: 1724000000000,
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => 'Not found' } as Response;
    });

    const result = await listStorageObjects('2026/08');
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].key).toBe('2026/08/item.webp');
    expect(result.objects[0].size).toBe(1024);
  });

  it('constructs public view URL for Backblaze B2 (default and custom CDN)', () => {
    const urlDefault = getPublicUrl('2026/08/photo.webp');
    expect(urlDefault).toBe('https://f000.backblazeb2.com/file/storinary/2026/08/photo.webp');

    process.env.NEXT_PUBLIC_BACKBLAZE_CDN_URL = 'https://cdn.example.com';
    const urlCdn = getPublicUrl('2026/08/photo.webp');
    expect(urlCdn).toBe('https://cdn.example.com/file/storinary/2026/08/photo.webp');
  });
});

describe('getStorageProviderInfo', () => {
  it('returns metadata for active provider', () => {
    process.env.STORAGE_PROVIDER = 'appwrite';
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test_proj';
    process.env.APPWRITE_BUCKET_ID = 'custom_bucket';

    const info = getStorageProviderInfo();
    expect(info.provider).toBe('appwrite');
    expect(info.providerName).toBe('Appwrite Storage');
    expect(info.bucket).toBe('custom_bucket');
    expect(info.endpoint).toBe('https://cloud.appwrite.io/v1');
    expect(info.isConfigured).toBe(true);

    process.env.STORAGE_PROVIDER = 'backblaze';
    process.env.BACKBLAZE_APPLICATION_KEY_ID = 'b2_id';
    process.env.BACKBLAZE_APPLICATION_KEY = 'b2_key';
    process.env.BACKBLAZE_BUCKET_NAME = 'b2_bucket';

    const infoB2 = getStorageProviderInfo();
    expect(infoB2.provider).toBe('backblaze');
    expect(infoB2.providerName).toBe('Backblaze B2 Storage');
    expect(infoB2.bucket).toBe('b2_bucket');
    expect(infoB2.isConfigured).toBe(true);
  });
});
