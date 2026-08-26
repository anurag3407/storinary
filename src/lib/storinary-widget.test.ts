import { describe, expect, it, vi } from 'vitest';
import {
  buildStorinaryFormData,
  storinaryUploadFile,
} from './storinary-widget';

type MockXHR = XMLHttpRequest & {
  headers: Record<string, string>;
  open: ReturnType<typeof vi.fn>;
};

function makeFile(resourceType: 'image/png' | 'video/mp4' = 'image/png') {
  const name = resourceType === 'video/mp4' ? 'clip.mp4' : 'photo.png';
  return new File(['content'], name, { type: resourceType });
}

function createMockXHR(payload: unknown, status = 200) {
  return class MockXHR {
    static instances: MockXHR[] = [];

    upload = new EventTarget();

    status = status;

    response = JSON.stringify(payload);

    headers: Record<string, string> = {};

    open = vi.fn();

    setRequestHeader = vi.fn((name: string, value: string) => {
      this.headers[name] = value;
    });

    listeners = new Map<string, EventListener>();

    constructor() {
      MockXHR.instances.push(this as MockXHR);
    }

    getResponseHeader(name: string) {
      return name === 'Content-Type' ? 'application/json' : null;
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.set(type, listener as EventListener);
    }

    send() {
      this.listeners.get('load')?.call(this, new ProgressEvent('load'));
    }
  } as unknown as (new () => MockXHR) & { instances: MockXHR[] };
}

describe('buildStorinaryFormData', () => {
  it('includes only supplied upload metadata and credentials', () => {
    const data = buildStorinaryFormData(makeFile(), {
      uploadPreset: 'site_unsigned',
      folder: '/site',
      tags: 'hero,launch',
      apiKey: 'stor_live_test',
      timestamp: 1234.7,
      signature: 'signature',
      resourceType: 'video',
    });

    expect(data.get('file')).toBeInstanceOf(File);
    expect(data.get('upload_preset')).toBe('site_unsigned');
    expect(data.get('folder')).toBe('/site');
    expect(data.get('tags')).toBe('hero,launch');
    expect(data.get('api_key')).toBe('stor_live_test');
    expect(data.get('timestamp')).toBe('1234');
    expect(data.get('api_signature')).toBe('signature');
    expect(data.get('resource_type')).toBe('video');
  });
});

describe('storinaryUploadFile', () => {
  it('uploads to the configured endpoint and returns the first image', async () => {
    const MockXHR = createMockXHR({
      success: true,
      images: [{ id: 'img-1', publicUrl: 'https://cdn.example/photo.png', originalName: 'renamed.png' }],
      errors: [],
    });
    vi.stubGlobal('XMLHttpRequest', MockXHR);

    await expect(storinaryUploadFile(makeFile(), { endpoint: '/api/upload', uploadPreset: 'site' }))
      .resolves.toEqual({
        id: 'img-1',
        publicUrl: 'https://cdn.example/photo.png',
        originalName: 'renamed.png',
      });
    expect(MockXHR.instances[0].open).toHaveBeenCalledWith(
      'POST',
      'http://localhost:3000/api/upload'
    );
  });

  it('reports byte-level upload progress through XMLHttpRequest', async () => {
    const onProgress = vi.fn();
    const MockXHR = createMockXHR({
      success: true,
      images: [{ id: 'img-progress', publicUrl: '/photo.png' }],
      errors: [],
    });
    MockXHR.prototype.send = function send() {
      this.upload.dispatchEvent(new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 3,
        total: 4,
      }));
      this.listeners.get('load')?.call(this, new ProgressEvent('load'));
    };
    vi.stubGlobal('XMLHttpRequest', MockXHR);

    await expect(storinaryUploadFile(makeFile(), { endpoint: '/api/upload' }, onProgress))
      .resolves.toMatchObject({ id: 'img-progress' });

    expect(MockXHR.instances[0].open).toHaveBeenCalledWith(
      'POST',
      'http://localhost:3000/api/upload'
    );
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 4, progress: 0.75 });
  });

  it('uploads videos with the scoped header and returns the first video', async () => {
    const posterUrl = '/api/videos/vid-1/poster';
    const MockXHR = createMockXHR({
      success: true,
      videos: [{
        id: 'vid-1',
        publicUrl: 'https://cdn.example/clip.mp4',
        originalName: 'clip.mp4',
        posterUrl,
      }],
      errors: [],
    }, 201);
    vi.stubGlobal('XMLHttpRequest', MockXHR);

    await expect(storinaryUploadFile(makeFile('video/mp4'), {
      resourceType: 'video',
      uploadPreset: 'site_video',
      apiKey: 'stor_live_test',
    })).resolves.toEqual({
      id: 'vid-1',
      publicUrl: 'https://cdn.example/clip.mp4',
      originalName: 'clip.mp4',
      posterUrl,
    });

    expect(MockXHR.instances[0].open).toHaveBeenCalledWith(
      'POST',
      'http://localhost:3000/api/videos'
    );
    expect(MockXHR.instances[0].headers['X-API-Key']).toBe('stor_live_test');
  });

  it('routes default video uploads to the video API', async () => {
    const MockXHR = createMockXHR({
      success: false,
      videos: [],
      errors: [{ filename: 'clip.mp4', error: 'No video files provided' }],
    }, 400);
    vi.stubGlobal('XMLHttpRequest', MockXHR);

    await expect(storinaryUploadFile(makeFile('video/mp4'), { resourceType: 'video' }))
      .rejects.toThrow('No video files provided');
    expect(MockXHR.instances[0].open).toHaveBeenCalledWith(
      'POST',
      'http://localhost:3000/api/videos'
    );
  });

  it('throws the API error for failed uploads', async () => {
    const MockXHR = createMockXHR({
      success: false,
      images: [],
      errors: [{ filename: 'auth', error: 'Invalid or revoked API key' }],
    }, 401);
    vi.stubGlobal('XMLHttpRequest', MockXHR);

    await expect(storinaryUploadFile(makeFile())).rejects.toThrow(
      'Invalid or revoked API key'
    );
  });
});
