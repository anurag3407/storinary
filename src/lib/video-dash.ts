import { getPublicUrl } from '@/lib/storage';
import type { DashVariantRecord, VideoDashPackageRecord } from '@/types';

export type DashPackageInput = {
  label: string;
  manifestPath: string;
  publicUrl: string;
  variants: DashVariantRecord[];
  filePaths: string[];
  totalFileSize: number;
};

type PrismaDashPackage = {
  manifestPath: string;
  variants: unknown;
  filePaths: unknown;
};

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => Boolean(item && typeof item === 'object'));
}

export function normalizeDashPackage(rawPackage: PrismaDashPackage): VideoDashPackageRecord & {
  createdAt?: Date;
  updatedAt?: Date;
} {
  if (!isRecordArray(rawPackage.variants) || !Array.isArray(rawPackage.filePaths)) {
    throw new Error('Stored DASH package is invalid');
  }
  return {
    ...rawPackage,
    id: '',
    label: '',
    publicUrl: '',
    totalFileSize: 0,
    status: '',
    manifestPath: rawPackage.manifestPath,
    variants: rawPackage.variants as unknown as DashVariantRecord[],
    filePaths: rawPackage.filePaths.filter((path): path is string => typeof path === 'string'),
  };
}

export function createDashPackageMetadata(input: Omit<DashPackageInput, 'publicUrl'>): DashPackageInput {
  return { ...input, publicUrl: getPublicUrl(input.manifestPath) };
}

export async function deleteDashPackageFiles(
  rawPackage: PrismaDashPackage,
  deleteFile: (key: string) => Promise<void>
) {
  const dashPackage = normalizeDashPackage(rawPackage);
  for (const path of [dashPackage.manifestPath, ...dashPackage.filePaths]) {
    await deleteFile(path);
  }
}
