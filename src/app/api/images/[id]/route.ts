import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  deleteFromStorage,
  generateStorageKey,
  getPublicUrl,
} from '@/lib/storage';
import { generateShortId, getMimeType, serializeImage } from '@/lib/utils';
import { getImageDetail } from '@/lib/image-detail';
import { dispatchWebhooks } from '@/lib/webhooks';
import {
  buildSignedImageUrl,
  buildSignedTransformImageUrl,
  normalizeSignedUrlTtl,
} from '@/lib/signed-delivery';
import {
  archiveCurrentAsImageVersion,
  restoreImageFromVersion,
  serializeImageVersion,
} from '@/lib/asset-versions';
import { getImageMetadata } from '@/lib/image-processing';
import { isSafeSvg } from '@/lib/svg-security';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/images/:id — get a single image with generated links.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const data = await getImageDetail(id);
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const transforms = ['w', 'h', 'q', 'fmt', 'fit', 'ar', 'g', 'b', 'e', 'a', 'dpr']
    .map((key) => [key, request.nextUrl.searchParams.get(key)])
    .filter((entry): entry is [string, string] => Boolean(entry[1]));
  const transformRecord = Object.fromEntries(transforms);
  const ttl = normalizeSignedUrlTtl(request.nextUrl.searchParams.get('ttl'));

  return NextResponse.json({
    ...data,
    links: {
      ...data.links,
      direct: buildSignedImageUrl(
        request,
        { publicUrl: data.image.publicUrl, storagePath: data.image.storagePath },
        ttl,
        transformRecord
      ),
      directUrl: buildSignedImageUrl(
        request,
        { publicUrl: data.image.publicUrl, storagePath: data.image.storagePath },
        ttl
      ),
      transformUrl:
        transforms.length > 0
          ? buildSignedTransformImageUrl(request, data.image, ttl, transformRecord)
          : undefined,
    },
  });
}

/**
 * DELETE /api/images/:id — delete a single image.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const image = await prisma.image.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!image) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Best-effort storage delete — never block DB removal on storage failure
  try {
    await deleteFromStorage(image.storagePath);
    for (const version of image.versions) {
      await deleteFromStorage(version.storagePath);
    }
  } catch {
    // continue with DB delete
  }

  await prisma.image.delete({ where: { id } });
  void dispatchWebhooks('image.deleted', { id, image: serializeImage(image) });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/images/:id — update image metadata (tags, altText, folder).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const image = await prisma.image.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!image) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    body.file &&
    typeof body.file === 'object' &&
    typeof (body.file as { data?: unknown }).data === 'string' &&
    typeof (body.file as { name?: unknown }).name === 'string'
  ) {
    const uploadedFile = body.file as { name: string; type?: string; data: string };
    const buffer = Buffer.from(uploadedFile.data, 'base64');
    const metadata = await getImageMetadata(buffer);
    const mimeType = uploadedFile.type || getMimeType(uploadedFile.name);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'].includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported format: ${mimeType || 'unknown'}` },
        { status: 400 }
      );
    }
    if ((metadata.format === 'svg' || mimeType === 'image/svg+xml') && !isSafeSvg(buffer)) {
      return NextResponse.json(
        { error: 'SVG contains unsafe content (scripts or event handlers are not allowed)' },
        { status: 400 }
      );
    }

    await archiveCurrentAsImageVersion(image);
    const storagePath = generateStorageKey(uploadedFile.name, generateShortId(), metadata.format);
    const updated = await prisma.image.update({
      where: { id },
      data: {
        originalName: uploadedFile.name,
        storagePath,
        publicUrl: getPublicUrl(storagePath),
        width: metadata.width,
        height: metadata.height,
        fileSize: metadata.size,
        format: metadata.format,
        mimeType,
      },
    });
    void dispatchWebhooks('image.updated', { image: serializeImage(updated), action: 'replaced' });
    return NextResponse.json(serializeImage(updated));
  }

  if (typeof body.restoreVersionId === 'string') {
    const version = image.versions.find((candidate) => candidate.id === body.restoreVersionId);
    if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    const restored = await restoreImageFromVersion(image, serializeImageVersion(version));
    void dispatchWebhooks('image.updated', { image: serializeImage(restored.updated), action: 'restored' });
    return NextResponse.json(serializeImage(restored.updated));
  }

  const data: { tags?: string; altText?: string; folder?: string } = {};
  if (typeof body.tags === 'string') data.tags = body.tags;
  if (typeof body.altText === 'string') data.altText = body.altText;
  if (typeof body.folder === 'string') data.folder = body.folder || '/';

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.image.update({ where: { id }, data });
  void dispatchWebhooks('image.updated', { image: serializeImage(updated) });

  return NextResponse.json(serializeImage(updated));
}
