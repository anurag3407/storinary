import { prisma } from '@/lib/prisma';
import {
  bulkDeleteFromStorage,
  listStorageObjects,
} from '@/lib/storage';

export type OrphanedObject = {
  key: string;
  size: number;
  lastModified: string;
};

export type StorageAuditResult = {
  scanned: number;
  orphans: OrphanedObject[];
  nextOffset?: number;
};

const MAX_DELETE_PER_REQUEST = 200;
const MAX_SCAN_PAGES = 20;
const PAGE_SIZE = 500;

async function collectReferencedPaths(): Promise<Set<string>> {
  const [images, videos, renditions] = await Promise.all([
    prisma.image.findMany({ select: { storagePath: true } }),
    prisma.video.findMany({ select: { storagePath: true, posterPath: true } }),
    prisma.videoRendition.findMany({ select: { storagePath: true } }),
  ]);

  const paths = [
    ...images.map((image) => image.storagePath),
    ...videos.flatMap((video) => [video.storagePath, video.posterPath].filter(Boolean)),
    ...renditions.map((rendition) => rendition.storagePath),
  ];
  return new Set(paths.filter((path): path is string => Boolean(path)));
}

function toOrphan(objects: Array<{ key: string; size: number; lastModified: Date }>): OrphanedObject[] {
  return objects.map((object) => ({
    key: object.key,
    size: object.size,
    lastModified: object.lastModified.toISOString(),
  }));
}

async function resolveTenantPrefix(): Promise<string | null> {
  try {
    const { getTenantIdOrNull } = await import('@/lib/tenant');
    const tenantId = await getTenantIdOrNull();
    if (!tenantId) return null;
    const { rawPrisma } = await import('@/lib/prisma');
    if (!rawPrisma?.organization?.findUnique) return null;
    const org = await rawPrisma.organization.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    return org?.slug || null;
  } catch {
    return null;
  }
}

export async function auditOrphanedStorage(
  startOffset = 0,
  explicitPrefix?: string
): Promise<StorageAuditResult> {
  const tenantPrefix = explicitPrefix ?? (await resolveTenantPrefix());
  const referenced = await collectReferencedPaths();
  let offset = Math.max(0, Math.floor(startOffset));
  let scanned = 0;
  const orphans: OrphanedObject[] = [];
  let nextOffset: number | undefined;

  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const response = await listStorageObjects(tenantPrefix ?? undefined, PAGE_SIZE, offset);
    const matchedPrefix = tenantPrefix
      ? response.objects.filter((obj) => obj.key.startsWith(`${tenantPrefix}/`))
      : response.objects;
    const unmatched = matchedPrefix.filter((object) => !referenced.has(object.key));
    orphans.push(...toOrphan(unmatched));
    scanned += matchedPrefix.length;
    nextOffset = response.nextOffset;

    if (nextOffset === undefined || response.objects.length === 0) {
      return { scanned, orphans };
    }
    offset = nextOffset;
  }

  return { scanned, orphans, nextOffset };
}

export async function deleteOrphanedStorage(
  keys: string[],
  explicitPrefix?: string
): Promise<{ deleted: number }> {
  if (keys.length === 0) return { deleted: 0 };
  if (keys.length > MAX_DELETE_PER_REQUEST) {
    throw new Error(`Maximum ${MAX_DELETE_PER_REQUEST} objects per delete request`);
  }

  const tenantPrefix = explicitPrefix ?? (await resolveTenantPrefix());
  if (tenantPrefix) {
    for (const key of keys) {
      if (!key.startsWith(`${tenantPrefix}/`)) {
        throw new Error('Cannot delete storage object outside active organization');
      }
    }
  }

  const uniqueKeys = [...new Set(keys)];
  const referenced = await collectReferencedPaths();
  const safeKeys = uniqueKeys.filter((key) => !referenced.has(key));
  if (safeKeys.length === 0) return { deleted: 0 };

  await bulkDeleteFromStorage(safeKeys);
  return { deleted: safeKeys.length };
}
