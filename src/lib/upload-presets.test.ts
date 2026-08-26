import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadPreset, parseUploadPreset } from './upload-presets';

const { createMock, findManyMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadPreset: { create: createMock, findMany: findManyMock },
  },
}));

describe('upload presets', () => {
  beforeEach(() => {
    createMock.mockReset().mockImplementation(async ({ data }) => ({
      id: 'preset-1',
      ...data,
      createdAt: new Date(),
    }));
  });

  it('normalizes and clamps preset values', () => {
    const parsed = parseUploadPreset({
      name: ' Hero ',
      folder: '/website//hero/',
      quality: 999,
      maxWidth: 10,
      unsigned: true,
      moderate: true,
      resourceType: 'video',
      renditions: true,
    });

    expect(parsed).toEqual(expect.objectContaining({
      name: 'Hero',
      folder: '/website/hero',
      quality: 100,
      maxWidth: 128,
      active: true,
      unsigned: true,
      moderate: true,
      resourceType: 'video',
      renditions: true,
    }));
  });

  it('requires a name', () => {
    expect(() => parseUploadPreset({ folder: '/' })).toThrow('Preset name is required');
  });

  it('creates a normalized policy', async () => {
    const preset = await createUploadPreset(parseUploadPreset({ name: 'site', unsigned: true }));
    expect(preset.name).toBe('site');
    expect(preset.unsigned).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'site',
        folder: '/',
        unsigned: true,
        resourceType: 'image',
        renditions: false,
      }),
    });
  });
});
