import { getPublicUrl } from '@/lib/storage';
import type { HlsVariantRecord, VideoHlsPackageRecord } from '@/types';

export type HlsPackageInput = {
  label: string;
  masterPath: string;
  publicUrl: string;
  variants: HlsVariantRecord[];
  segmentPaths: string[];
  totalFileSize: number;
};

type HlsPackageWithFiles = Pick<VideoHlsPackageRecord, 'variants' | 'segmentPaths'> & {
  masterPath: string;
};

type PrismaHlsPackage = Omit<HlsPackageWithFiles, 'variants' | 'segmentPaths'> & {
  variants: unknown;
  segmentPaths: unknown;
};

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => Boolean(item && typeof item === 'object'));
}

export function normalizeHlsPackage(hlsPackage: PrismaHlsPackage): VideoHlsPackageRecord & {
  createdAt?: Date;
  updatedAt?: Date;
} {
  if (!isRecordArray(hlsPackage.variants) || !Array.isArray(hlsPackage.segmentPaths)) {
    throw new Error('Stored HLS package is invalid');
  }
  return {
    ...hlsPackage,
    id: '',
    label: '',
    publicUrl: '',
    totalFileSize: 0,
    status: '',
    variants: hlsPackage.variants as unknown as HlsVariantRecord[],
    segmentPaths: hlsPackage.segmentPaths.filter((path): path is string => typeof path === 'string'),
  };
}

export function createHlsPackageMetadata(input: Omit<HlsPackageInput, 'publicUrl'>): HlsPackageInput {
  return { ...input, publicUrl: getPublicUrl(input.masterPath) };
}

export async function deleteHlsPackageFiles(
  rawPackage: PrismaHlsPackage,
  deleteFile: (key: string) => Promise<void>
) {
  const hlsPackage = normalizeHlsPackage(rawPackage);
  const paths = [
    hlsPackage.masterPath,
    ...hlsPackage.variants.map((variant) => variant.playlistPath),
    ...hlsPackage.segmentPaths,
  ];
  for (const path of paths) {
    await deleteFile(path);
  }
}
