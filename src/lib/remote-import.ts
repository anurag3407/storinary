import { lookup } from 'node:dns/promises';

export const MAX_IMPORT_URL_LENGTH = 2_048;
const MAX_REDIRECTS = 4;
const IMPORT_TIMEOUT_MS = 30_000;

export type RemoteImportRequest = {
  urls: string[];
  folder: string;
  tags: string;
};

function isPrivateAddress(address: string): boolean {
  const normalized = address.replace(/^%.*$/, '').toLowerCase();
  const ipv4Mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  const ipv4 = ipv4Mapped ? ipv4Mapped[1] : normalized;

  if (/^(0\.|10\.|127\.|169\.254\.|192\.168\.)/.test(ipv4)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ipv4)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ipv4)) return true;
  if (
    /^::$/.test(normalized) ||
    /^::1$/.test(normalized) ||
    /^(f[cd]|fe[89a-f]|ff)/.test(normalized) ||
    /^(2001:|2002:|64:ff9b:)/.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!normalized || normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  return isPrivateAddress(normalized);
}

export function normalizeImportUrl(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim() || input.length > MAX_IMPORT_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (isPrivateHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateImportPayload(input: unknown, maximumUrls: number): RemoteImportRequest | string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'Invalid request body';
  }

  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.urls) || raw.urls.length === 0) {
    return 'At least one URL is required';
  }
  if (raw.urls.length > maximumUrls) {
    return `Maximum ${maximumUrls} URLs per request`;
  }

  const urls = raw.urls.map(normalizeImportUrl);
  if (urls.some((url) => !url)) {
    return 'URLs must be public HTTPS addresses';
  }

  const folder = typeof raw.folder === 'string' && raw.folder.trim() ? raw.folder.trim() : '/';
  const tags = typeof raw.tags === 'string' ? raw.tags.trim() : '';
  return { urls: urls as string[], folder, tags };
}

async function assertPublicDns(hostname: string): Promise<void> {
  if (isPrivateHostname(hostname)) throw new Error('Public HTTPS URL required');
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
      throw new Error('Host resolves to a private address');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('private address')) throw error;
    throw new Error('Could not resolve import host');
  }
}

async function readBoundedBody(response: Response, maximumSize: number): Promise<Buffer> {
  const declaredLength = Number.parseInt(response.headers.get('content-length') || '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumSize) {
    throw new Error(`Remote asset exceeds ${(maximumSize / (1024 * 1024)).toFixed(0)} MB limit`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Remote response had no body');

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maximumSize) {
      await reader.cancel();
      throw new Error(`Remote asset exceeds ${(maximumSize / (1024 * 1024)).toFixed(0)} MB limit`);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export function contentTypeToExtension(contentType: string): string {
  const mappings: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return mappings[contentType] || 'bin';
}

export function remoteFilename(url: string, contentType: string): string {
  let name = '';
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    name = '';
  }
  name = name.trim().replace(/[\r\n\t\0]/g, '').slice(0, 180);
  const extension = contentTypeToExtension(contentType);
  return /\.[a-z0-9]{2,8}$/i.test(name) ? name : `${name || 'remote-asset'}.${extension}`;
}

export async function fetchRemoteAsset(
  inputUrl: string,
  allowedContentTypes: string[],
  maximumSize: number
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  let currentUrl = normalizeImportUrl(inputUrl);
  if (!currentUrl) throw new Error('Public HTTPS URL required');

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    await assertPublicDns(new URL(currentUrl).hostname);
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
      headers: { accept: allowedContentTypes.join(', ') },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Remote redirect had no destination');
      currentUrl = normalizeImportUrl(new URL(location, currentUrl).toString());
      if (!currentUrl) throw new Error('Redirect must be a public HTTPS URL');
      continue;
    }

    if (!response.ok) throw new Error(`Remote server returned ${response.status}`);
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!allowedContentTypes.includes(contentType)) {
      await response.body?.cancel();
      throw new Error(`Unsupported remote content type: ${contentType || 'unknown'}`);
    }

    const buffer = await readBoundedBody(response, maximumSize);
    if (buffer.length === 0) throw new Error('Remote asset was empty');
    return { buffer, contentType, filename: remoteFilename(currentUrl, contentType) };
  }

  throw new Error('Too many redirects');
}
