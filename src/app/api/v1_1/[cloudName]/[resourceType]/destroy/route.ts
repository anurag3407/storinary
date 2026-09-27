import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma, rawPrisma } from '@/lib/prisma';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { deleteFromStorage } from '@/lib/storage';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { dispatchWebhooks } from '@/lib/webhooks';

export const runtime = 'nodejs';

/**
 * Cloudinary REST Destroy API:
 * POST /api/v1_1/:cloudName/:resourceType/destroy
 *
 * Fully compatible with official Cloudinary SDKs:
 *   cloudinary.v2.uploader.destroy(public_id, options)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ cloudName: string; resourceType: string }> }
) {
  const { cloudName, resourceType } = await context.params;

  if (resourceType !== 'image' && resourceType !== 'video') {
    return NextResponse.json(
      { error: { message: 'Invalid resource_type: must be image or video' } },
      { status: 400 }
    );
  }

  // Lookup organization by cloudName (slug)
  const orgLookup = rawPrisma?.organization?.findUnique
    ? rawPrisma.organization.findUnique
    : prisma.organization.findUnique;

  const org = await orgLookup({
    where: { slug: cloudName },
    select: { id: true, slug: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: { message: `Cloud name '${cloudName}' not found` } },
      { status: 404 }
    );
  }

  let bodyData: Record<string, unknown> = {};
  const contentTypeHeader = request.headers.get('content-type') || '';
  if (contentTypeHeader.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      for (const [key, val] of formData.entries()) {
        bodyData[key] = val;
      }
    }
  } else if (contentTypeHeader.includes('application/json')) {
    bodyData = await request.json().catch(() => ({}));
  }

  const publicId = typeof bodyData.public_id === 'string' ? bodyData.public_id.trim() : '';
  if (!publicId) {
    return NextResponse.json(
      { error: { message: 'Missing required parameter - public_id' } },
      { status: 400 }
    );
  }

  const presentedKey =
    (typeof bodyData.api_key === 'string' ? bodyData.api_key : null) ||
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!presentedKey) {
    return NextResponse.json(
      { error: { message: 'Must supply api_key' } },
      { status: 401 }
    );
  }

  const keyLookup = rawPrisma?.apiKey?.findUnique
    ? rawPrisma.apiKey.findUnique
    : prisma.apiKey.findUnique;

  const apiKeyRow = await keyLookup({
    where: { hashedKey: createHash('sha256').update(presentedKey).digest('hex') },
    select: { id: true, organizationId: true, revokedAt: true },
  });

  if (!apiKeyRow || apiKeyRow.revokedAt || apiKeyRow.organizationId !== org.id) {
    return NextResponse.json(
      { error: { message: 'Invalid or revoked API key' } },
      { status: 401 }
    );
  }

  return runWithTenantScope(org.id, async () => {
    const candidateKeys = [
      publicId,
      `${org.slug}/${publicId}`,
      `${org.slug}/${publicId}.jpg`,
      `${org.slug}/${publicId}.png`,
      `${org.slug}/${publicId}.webp`,
      `${org.slug}/${publicId}.mp4`,
    ];

    if (resourceType === 'image') {
      const image = await prisma.image.findFirst({
        where: {
          OR: [
            { storagePath: { in: candidateKeys } },
            { storagePath: { contains: publicId } },
            { id: publicId },
          ],
        },
      });

      if (!image) {
        return NextResponse.json({ result: 'not found' }, { status: 200 });
      }

      await deleteFromStorage(image.storagePath).catch(() => {});
      await prisma.image.delete({ where: { id: image.id } });

      void recordApiKeyUsage(apiKeyRow.id, 'delete', { assets: 1 }).catch(() => {});
      void dispatchWebhooks('image.deleted', { id: image.id, storagePath: image.storagePath }).catch(() => {});

      return NextResponse.json({ result: 'ok' }, { status: 200 });
    }

    if (resourceType === 'video') {
      const video = await prisma.video.findFirst({
        where: {
          OR: [
            { storagePath: { in: candidateKeys } },
            { storagePath: { contains: publicId } },
            { id: publicId },
          ],
        },
      });

      if (!video) {
        return NextResponse.json({ result: 'not found' }, { status: 200 });
      }

      await deleteFromStorage(video.storagePath).catch(() => {});
      if (video.posterPath) await deleteFromStorage(video.posterPath).catch(() => {});
      await prisma.video.delete({ where: { id: video.id } });

      void recordApiKeyUsage(apiKeyRow.id, 'delete', { assets: 1 }).catch(() => {});
      void dispatchWebhooks('video.deleted', { id: video.id, storagePath: video.storagePath }).catch(() => {});

      return NextResponse.json({ result: 'ok' }, { status: 200 });
    }

    return NextResponse.json({ error: { message: 'Unsupported resource type' } }, { status: 400 });
  });
}
