import { zipSync, type Zippable } from 'fflate';

export const MAX_ARCHIVE_FILES = 100;
export const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;

export type ArchiveSource = {
  id: string;
  originalName: string;
  storagePath: string;
};

export type ArchiveEntry = {
  path: string;
  data: Uint8Array;
};

function uniqueArchivePath(name: string, usedNames: Set<string>): string {
  const safe = (name || 'image').replace(/[\\/]+/g, '-').replace(/[\u0000-\u001f]/g, '').trim() || 'image';
  let candidate = safe;
  let counter = 1;
  while (usedNames.has(candidate.toLowerCase())) {
    const dot = safe.lastIndexOf('.');
    candidate = dot > 0
      ? `${safe.slice(0, dot)}-${counter}${safe.slice(dot)}`
      : `${safe}-${counter}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return `storinary/${candidate}`;
}

export function createZipArchive(entries: ArchiveEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error('No archive entries');
  if (entries.length > MAX_ARCHIVE_FILES) throw new Error('Archive file limit exceeded');

  let total = 0;
  const files: Zippable = {};
  for (const entry of entries) {
    if (entry.data.byteLength > MAX_ENTRY_BYTES) {
      throw new Error(`Archive entry too large: ${entry.path}`);
    }
    total += entry.data.byteLength;
    if (total > MAX_ARCHIVE_BYTES) throw new Error('Archive size limit exceeded');
    files[entry.path] = entry.data;
  }

  return zipSync(files, { level: 0 });
}

export async function collectArchiveEntries(
  sources: ArchiveSource[],
  download: (storagePath: string) => Promise<StorageDownloadLike>
): Promise<ArchiveEntry[]> {
  if (sources.length === 0 || sources.length > MAX_ARCHIVE_FILES) {
    throw new Error('Archive must contain between 1 and 100 images');
  }

  const usedNames = new Set<string>();
  const entries: ArchiveEntry[] = [];
  let totalBytes = 0;

  for (const source of sources) {
    const result = await download(source.storagePath);
    if (result.buffer.byteLength > MAX_ENTRY_BYTES) {
      throw new Error(`Archive entry too large: ${source.originalName}`);
    }
    totalBytes += result.buffer.byteLength;
    if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error('Archive size limit exceeded');
    entries.push({
      path: uniqueArchivePath(source.originalName, usedNames),
      data: new Uint8Array(result.buffer),
    });
  }

  return entries;
}

type StorageDownloadLike = {
  buffer: Buffer | Uint8Array;
};
