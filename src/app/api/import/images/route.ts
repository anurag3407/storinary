import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStorageKey, getPublicUrl, uploadToStorage } from '@/lib/storage';
import { getImageMetadata } from '@/lib/image-processing';
import { isSafeSvg } from '@/lib/svg-security';
import { generateShortId, serializeImage } from '@/lib/utils';
import { generateEagerTransforms } from '@/lib/eager-transforms';
import { authorizeDashboardOrApiKey } from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { dispatchWebhooks } from '@/lib/webhooks';
import {
  fetchRemoteAsset,
  validateImportPayload,
} from '@/lib/remote-import';

export const runtime = 'nodejs';

const ALLOWED_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];
const MAX_URLS = 10;
const MAX_FILE_SIZE =
  parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

function parseBody(request: NextRequest) {
  return request.json().catch(() => null);
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request);
  if (body === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const authorization = await authorizeDashboardOrApiKey(request, undefined, 'upload');
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const payload = validateImportPayload(body, MAX_URLS);
  if (typeof payload === 'string') {
    const response = NextResponse.json({ error: payload }, { status: 400 });
    if (authorization.keyId) void recordApiKeyUsage(authorization.keyId, 'upload', { errors: 1 });
    return response;
  }

  const results = await Promise.allSettled(
    payload.urls.map(async (url) => {
      const remote = await fetchRemoteAsset(url, ALLOWED_FORMATS, MAX_FILE_SIZE);
      const metadata = await getImageMetadata(remote.buffer);
      const mimeType = remote.contentType;
      const format = metadata.format;

      if (format === 'svg' || mimeType === 'image/svg+xml') {
        if (!isSafeSvg(remote.buffer)) {
          throw new Error('SVG contains unsafe content (scripts or event handlers are not allowed)');
        }
      }

      const shortId = generateShortId();
      const storageKey = generateStorageKey(remote.filename, shortId, format);
      await uploadToStorage(remote.buffer, storageKey, mimeType);

      const created = await prisma.image.create({
        data: {
          originalName: remote.filename,
          storagePath: storageKey,
          publicUrl: getPublicUrl(storageKey),
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.size,
          format,
          mimeType,
          folder: payload.folder,
          tags: payload.tags,
          altText: '',
          bgRemoved: false,
          compressed: false,
          aiModerated: false,
          aiModerationScore: null,
        },
      });

      try {
        await generateEagerTransforms(remote.buffer, storageKey, format);
      } catch {}

      return serializeImage(created);
    })
  );

  const images = [];
  const errors = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      images.push(result.value);
      void dispatchWebhooks('image.uploaded', { image: result.value });
    } else {
      errors.push({
        filename: payload.urls[index],
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });
    }
  }

  if (authorization.keyId) {
    await recordApiKeyUsage(authorization.keyId, 'upload', {
      assets: images.length,
      errors: errors.length,
      bytes: images.reduce((total, image) => total + image.fileSize, 0),
    });
  }

  return NextResponse.json({ success: errors.length === 0, images, errors }, { status: 200 });
}
