import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma, rawPrisma } from '@/lib/prisma';
import { runWithTenantScope } from '@/lib/prisma-scope';
import { uploadToStorage, getPublicUrl } from '@/lib/storage';
import { getImageMetadata } from '@/lib/image-processing';
import { fetchRemoteAsset, contentTypeToExtension } from '@/lib/remote-import';
import { isSafeSvg } from '@/lib/svg-security';
import { generateShortId, getMimeType } from '@/lib/utils';
import { buildCloudinaryUrl } from '@/lib/cloudinary-syntax';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { dispatchWebhooks } from '@/lib/webhooks';
import { recordInitialImageVersion } from '@/lib/asset-versions';
import { tenantStoragePath } from '@/lib/tenant';
import { checkStorageQuota, releasePendingBytes } from '@/lib/quota';

export const runtime = 'nodejs';

const ALLOWED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

const ALLOWED_VIDEO_FORMATS = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
];

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 150 * 1024 * 1024; // 150 MB

interface ParsedUploadPayload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

async function parseIncomingFile(
  rawFile: unknown,
  allowedMimes: string[],
  maxSize: number
): Promise<ParsedUploadPayload> {
  if (rawFile instanceof File) {
    const arrayBuffer = await rawFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > maxSize) {
      throw new Error(`File exceeds maximum size limit of ${Math.round(maxSize / (1024 * 1024))}MB`);
    }
    const mimeType = rawFile.type || getMimeType(rawFile.name);
    return {
      buffer,
      filename: rawFile.name || 'upload',
      mimeType,
      size: buffer.length,
    };
  }

  if (typeof rawFile === 'string' && rawFile.trim()) {
    const str = rawFile.trim();

    // Data URI Base64: data:image/png;base64,...
    if (str.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(str);
      if (!match) throw new Error('Invalid base64 data URI');
      const mimeType = match[1].toLowerCase();
      if (!allowedMimes.includes(mimeType)) {
        throw new Error(`Unsupported MIME type in data URI: ${mimeType}`);
      }
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > maxSize) {
        throw new Error(`File exceeds maximum size limit of ${Math.round(maxSize / (1024 * 1024))}MB`);
      }
      const ext = contentTypeToExtension(mimeType);
      return {
        buffer,
        filename: `data-upload.${ext}`,
        mimeType,
        size: buffer.length,
      };
    }

    // Remote HTTPS URL
    if (str.startsWith('https://')) {
      const fetched = await fetchRemoteAsset(str, allowedMimes, maxSize);
      return {
        buffer: fetched.buffer,
        filename: fetched.filename,
        mimeType: fetched.contentType,
        size: fetched.buffer.length,
      };
    }
  }

  throw new Error('No valid file, base64 data URI, or HTTPS URL provided');
}

/**
 * Cloudinary REST Uploader API:
 * POST /api/v1_1/:cloudName/:resourceType/upload
 *
 * Fully compatible with official Cloudinary SDKs:
 *   cloudinary.v2.uploader.upload(file, options)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ cloudName: string; resourceType: string }> }
) {
  const { cloudName, resourceType } = await context.params;

  if (resourceType !== 'image' && resourceType !== 'video' && resourceType !== 'auto') {
    return NextResponse.json(
      { error: { message: 'Invalid resource_type: must be image, video, or auto' } },
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

  // Parse multipart form-data or JSON body
  let bodyData: Record<string, unknown> = {};
  let rawFile: unknown = null;

  const contentTypeHeader = request.headers.get('content-type') || '';
  if (contentTypeHeader.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: { message: 'Invalid form data' } }, { status: 400 });
    }
    for (const [key, val] of formData.entries()) {
      if (key === 'file') rawFile = val;
      else bodyData[key] = val;
    }
  } else if (contentTypeHeader.includes('application/json')) {
    bodyData = await request.json().catch(() => ({}));
    rawFile = bodyData.file;
  }

  if (!rawFile) {
    return NextResponse.json(
      { error: { message: 'Missing required parameter - file' } },
      { status: 400 }
    );
  }

  // Authenticate: check unsigned preset OR apiKey
  let authorizedKeyId: string | null = null;
  const requestedPreset = typeof bodyData.upload_preset === 'string' ? bodyData.upload_preset.trim() : '';

  if (requestedPreset) {
    const presetLookup = rawPrisma?.uploadPreset?.findFirst
      ? rawPrisma.uploadPreset.findFirst
      : prisma.uploadPreset.findFirst;

    const preset = await presetLookup({
      where: { name: requestedPreset, organizationId: org.id },
    });

    if (!preset || !preset.active) {
      return NextResponse.json(
        { error: { message: `Upload preset '${requestedPreset}' not found or inactive` } },
        { status: 400 }
      );
    }

    if (!preset.unsigned) {
      // Signed preset requires API credentials
      const presentedKey =
        (typeof bodyData.api_key === 'string' ? bodyData.api_key : null) ||
        request.headers.get('x-api-key') ||
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

      if (!presentedKey) {
        return NextResponse.json(
          { error: { message: 'Signed preset requires api_key' } },
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
      authorizedKeyId = apiKeyRow.id;
    }
  } else {
    // No preset: require valid API key
    const presentedKey =
      (typeof bodyData.api_key === 'string' ? bodyData.api_key : null) ||
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!presentedKey) {
      return NextResponse.json(
        { error: { message: 'Must supply api_key or unsigned upload_preset' } },
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
    authorizedKeyId = apiKeyRow.id;
  }

  return runWithTenantScope(org.id, async () => {
    // Resolve resource type (handle auto)
    const effectiveResourceType =
      resourceType === 'auto'
        ? (typeof rawFile === 'object' && rawFile && 'type' in rawFile && String((rawFile as { type?: string }).type).startsWith('video/') ? 'video' : 'image')
        : resourceType;

    const allowedMimes = effectiveResourceType === 'video' ? ALLOWED_VIDEO_FORMATS : ALLOWED_IMAGE_FORMATS;
    const maxSize = effectiveResourceType === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    let parsedFile: ParsedUploadPayload;
    try {
      parsedFile = await parseIncomingFile(rawFile, allowedMimes, maxSize);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse file';
      return NextResponse.json({ error: { message: msg } }, { status: 400 });
    }

    // Enforce SaaS account storage quota (100 MB free tier) with in-flight reservation
    const quotaCheck = await checkStorageQuota(org.id, parsedFile.size, { reserve: true });
    if (!quotaCheck.allowed) {
      if (authorizedKeyId) {
        void recordApiKeyUsage(authorizedKeyId, effectiveResourceType === 'video' ? 'video-upload' : 'upload', { errors: 1 });
      }
      return NextResponse.json(
        { error: { message: quotaCheck.error || 'Storage quota exceeded (100 MB free tier limit)' } },
        { status: 403 }
      );
    }

    try {
      const folder = (typeof bodyData.folder === 'string' ? bodyData.folder.trim() : '').replace(/^\/+|\/+$/g, '');
    const customPublicId = typeof bodyData.public_id === 'string' ? bodyData.public_id.trim() : '';
    const rawTags = typeof bodyData.tags === 'string' ? bodyData.tags.trim() : '';

    const ext = contentTypeToExtension(parsedFile.mimeType);
    const publicId = customPublicId || `${folder ? folder + '/' : ''}${generateShortId()}`;
    const filenameWithExt = `${publicId}.${ext}`;
    const storagePath = await tenantStoragePath(org.id, filenameWithExt);

    const versionTimestamp = Math.floor(Date.now() / 1000);
    const origin = request.nextUrl.origin;

    if (effectiveResourceType === 'image') {
      if (parsedFile.mimeType === 'image/svg+xml' && !isSafeSvg(parsedFile.buffer)) {
        return NextResponse.json(
          { error: { message: 'SVG contained disallowed script tags or event handlers' } },
          { status: 400 }
        );
      }

      let meta = { width: 0, height: 0, format: ext };
      try {
        meta = await getImageMetadata(parsedFile.buffer);
      } catch {
        // fallback
      }

      await uploadToStorage(parsedFile.buffer, storagePath, parsedFile.mimeType);

      const createdImage = await prisma.image.create({
        data: {
          originalName: parsedFile.filename,
          storagePath,
          publicUrl: getPublicUrl(storagePath),
          fileSize: parsedFile.size,
          width: meta.width,
          height: meta.height,
          format: meta.format || ext,
          mimeType: parsedFile.mimeType,
          folder: folder || '/',
          tags: rawTags,
        },
      });

      await recordInitialImageVersion(createdImage);

      if (authorizedKeyId) {
        void recordApiKeyUsage(authorizedKeyId, 'upload', { assets: 1 }).catch(() => {});
      }

      void dispatchWebhooks('image.uploaded', {
        id: createdImage.id,
        storagePath: createdImage.storagePath,
        publicUrl: createdImage.publicUrl,
        fileSize: createdImage.fileSize,
      }).catch(() => {});

      const standardUrl = buildCloudinaryUrl({
        cloudName: org.slug,
        resourceType: 'image',
        publicId,
        format: ext,
        version: versionTimestamp,
        origin,
      });

      return NextResponse.json(
        {
          asset_id: createdImage.id,
          public_id: publicId,
          version: versionTimestamp,
          version_id: createdImage.id,
          signature: createHash('sha1').update(`${publicId}${versionTimestamp}`).digest('hex'),
          width: meta.width,
          height: meta.height,
          format: meta.format || ext,
          resource_type: 'image',
          created_at: new Date().toISOString(),
          tags: rawTags ? rawTags.split(',').map((t) => t.trim()) : [],
          bytes: parsedFile.size,
          type: 'upload',
          etag: createHash('md5').update(parsedFile.buffer).digest('hex'),
          placeholder: false,
          url: standardUrl.replace(/^https:/, 'http:'),
          secure_url: standardUrl,
          folder: folder || '',
          original_filename: parsedFile.filename.replace(/\.[^.]+$/, ''),
        },
        { status: 200 }
      );
    }

    if (effectiveResourceType === 'video') {
      await uploadToStorage(parsedFile.buffer, storagePath, parsedFile.mimeType);

      const createdVideo = await prisma.video.create({
        data: {
          originalName: parsedFile.filename,
          storagePath,
          publicUrl: getPublicUrl(storagePath),
          fileSize: parsedFile.size,
          duration: 0,
          width: 0,
          height: 0,
          format: ext,
          mimeType: parsedFile.mimeType,
          folder: folder || '/',
          tags: rawTags,
        },
      });

      if (authorizedKeyId) {
        void recordApiKeyUsage(authorizedKeyId, 'upload', { assets: 1 }).catch(() => {});
      }

      void dispatchWebhooks('video.uploaded', {
        id: createdVideo.id,
        storagePath: createdVideo.storagePath,
        publicUrl: createdVideo.publicUrl,
        fileSize: createdVideo.fileSize,
      }).catch(() => {});

      const standardUrl = buildCloudinaryUrl({
        cloudName: org.slug,
        resourceType: 'video',
        publicId,
        format: ext,
        version: versionTimestamp,
        origin,
      });

      return NextResponse.json(
        {
          asset_id: createdVideo.id,
          public_id: publicId,
          version: versionTimestamp,
          version_id: createdVideo.id,
          signature: createHash('sha1').update(`${publicId}${versionTimestamp}`).digest('hex'),
          width: 0,
          height: 0,
          format: ext,
          resource_type: 'video',
          created_at: new Date().toISOString(),
          tags: rawTags ? rawTags.split(',').map((t) => t.trim()) : [],
          bytes: parsedFile.size,
          type: 'upload',
          etag: createHash('md5').update(parsedFile.buffer).digest('hex'),
          url: standardUrl.replace(/^https:/, 'http:'),
          secure_url: standardUrl,
          folder: folder || '',
          original_filename: parsedFile.filename.replace(/\.[^.]+$/, ''),
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: { message: 'Unsupported resource type' } }, { status: 400 });
  } finally {
    releasePendingBytes(org.id, parsedFile.size);
  }
});
}
