// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVideoDashPackage } from './video-renditions';

const { execFileAsyncMock, writeFileMock, mkdirMock, readdirMock, readFileMock, rmMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
  writeFileMock: vi.fn(),
  mkdirMock: vi.fn(),
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
  rmMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: (_file: string, args: string[], options: unknown, callback: (error: Error | null) => void) => {
    void args;
    void options;
    execFileAsyncMock().then(() => callback(null));
  },
}));

vi.mock('node:fs/promises', () => ({
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  readdir: readdirMock,
  readFile: readFileMock,
  rm: rmMock,
}));

describe('createVideoDashPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    mkdirMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    execFileAsyncMock.mockResolvedValue({ stdout: Buffer.alloc(0), stderr: '' });
  });

  it('creates explicit DASH manifests, initialization segments, and media chunks', async () => {
    readdirMock.mockResolvedValue([
      'stamp-360p.mpd',
      'stamp-360p-init.mp4',
      'stamp-360p-chunk-000.m4s',
      'stamp-720p.mpd',
      'stamp-720p-init.mp4',
      'stamp-720p-chunk-000.m4s',
    ]);
    readFileMock.mockImplementation(async (path: string) =>
      Buffer.from(path.endsWith('.mpd') ? 'manifest' : 'segment')
    );

    const result = await createVideoDashPackage(Buffer.from('source'), 'video-1', ['360p', '720p'], 'stamp');

    expect(execFileAsyncMock).toHaveBeenCalledTimes(2);
    expect(result.files).toHaveLength(6);
    expect(result.manifestPath).toBe('videos/dash/video-1/stamp-360p.mpd');
    expect(result.variants[0].initPath).toBe('videos/dash/video-1/stamp-360p-init.mp4');
    expect(result.variants[1].mediaSegmentPaths).toEqual(['videos/dash/video-1/stamp-720p-chunk-000.m4s']);
    expect(result.totalFileSize).toBe(result.files.reduce((sum, file) => sum + file.buffer.length, 0));
  });

  it('rejects an empty variant list before processing', async () => {
    await expect(createVideoDashPackage(Buffer.from('source'), 'video-1', [], 'stamp')).rejects.toThrow(
      'At least one DASH variant is required'
    );
  });
});
