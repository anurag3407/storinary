import { prisma } from '@/lib/prisma';
import { DEFAULT_UPLOAD_OPTIONS, type UploadDefaults } from '@/lib/upload-helpers';

export type UploadPresetRecord = {
  id: string;
  name: string;
  resourceType: 'image' | 'video';
  folder: string;
  tags: string;
  compress: boolean;
  quality: number;
  maxWidth: number;
  removeBg: boolean;
  moderate: boolean;
  renditions: boolean;
  active: boolean;
  unsigned: boolean;
  createdAt: string;
};

export type UploadPresetInput = Omit<UploadDefaults, never> & {
  active?: boolean;
  unsigned?: boolean;
  resourceType?: 'image' | 'video';
  renditions?: boolean;
};

function normalizeFolder(folder: unknown): string {
  if (typeof folder !== 'string' || !folder.trim()) return '/';
  const clean = folder.split('/').filter(Boolean).join('/');
  return clean ? `/${clean}` : '/';
}

function normalizeTags(tags: unknown): string {
  return typeof tags === 'string' ? tags.slice(0, 300) : '';
}

export function serializeUploadPreset(preset: {
  id: string;
  name: string;
  resourceType: string;
  folder: string;
  tags: string;
  compress: boolean;
  quality: number;
  maxWidth: number;
  removeBg: boolean;
  moderate: boolean;
  renditions: boolean;
  active: boolean;
  unsigned: boolean;
  createdAt: Date;
}): UploadPresetRecord {
  return {
    ...preset,
    resourceType: preset.resourceType === 'video' ? 'video' : 'image',
    renditions: preset.resourceType === 'video' ? preset.renditions : false,
    createdAt: preset.createdAt.toISOString(),
  };
}

export function parseUploadPreset(body: unknown): UploadPresetInput & { name: string } {
  const defaults: UploadPresetInput = { ...DEFAULT_UPLOAD_OPTIONS };
  const source = (body ?? {}) as Record<string, unknown>;
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, 80) : '';
  if (!name) throw new Error('Preset name is required');

  const numeric = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
  };

  return {
    resourceType: source.resourceType === 'video' ? 'video' : 'image',
    folder: normalizeFolder(source.folder),
    tags: normalizeTags(source.tags),
    compress: source.compress !== false,
    quality: numeric(source.quality, defaults.quality, 1, 100),
    maxWidth: numeric(source.maxWidth, defaults.maxWidth, 128, 8192),
    removeBg: source.removeBg === true,
    moderate: source.moderate === true,
    renditions: source.renditions === true,
    active: source.active !== false,
    unsigned: source.unsigned === true,
    name,
  };
}

export async function listUploadPresets(activeOnly = false) {
  const presets = await prisma.uploadPreset.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { createdAt: 'asc' },
  });
  return presets.map(serializeUploadPreset);
}

export async function createUploadPreset(input: UploadPresetInput & { name: string }) {
  const { name, ...options } = input;
  const preset = await prisma.uploadPreset.create({ data: { ...options, name } });
  return serializeUploadPreset(preset);
}

export async function updateUploadPreset(
  id: string,
  input: Partial<UploadPresetInput> & { name?: string }
) {
  try {
    const preset = await prisma.uploadPreset.update({ where: { id }, data: input });
    return serializeUploadPreset(preset);
  } catch {
    return null;
  }
}

export async function deleteUploadPreset(id: string) {
  try {
    await prisma.uploadPreset.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
