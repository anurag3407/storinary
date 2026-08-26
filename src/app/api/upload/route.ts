import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicUrl, generateStorageKey, uploadToStorage } from '@/lib/storage';
import { getImageMetadata } from '@/lib/image-processing';
import { isSafeSvg } from '@/lib/svg-security';
import { generateShortId, getMimeType, serializeImage } from '@/lib/utils';
import { generateEagerTransforms } from '@/lib/eager-transforms';
import { authorizeDashboardOrApiKey } from '@/lib/media-auth';
import { recordApiKeyUsage } from '@/lib/api-keys';
import { dispatchWebhooks } from '@/lib/webhooks';
import { recordInitialImageVersion } from '@/lib/asset-versions';
import type { UploadResponse } from '@/types';
import type { ModerationResult } from '@/types';

export const runtime = 'nodejs';

const ALLOWED_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];

const MAX_FILE_SIZE =
  parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

function parseModeration(formData: FormData): ModerationResult {
  if (formData.get('moderated') !== 'true') return { moderated: false, score: null };
  const parsedScore = Number.parseFloat(formData.get('moderationScore')?.toString() || '');
  return {
    moderated: true,
    score: Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 1 ? parsedScore : null,
  };
}

/**
 * POST /api/upload — bulk upload handler.
 * Accepts multipart/form-data with multiple files under field name "file".
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, images: [], errors: [{ filename: 'form', error: 'Invalid form data' }] },
      { status: 400 }
    );
  }

  const requestedPreset = formData.get('upload_preset');
  let preset = null;
  if (typeof requestedPreset === 'string' && requestedPreset.trim()) {
    preset = await prisma.uploadPreset.findUnique({
      where: { name: requestedPreset.trim() },
    });
    if (!preset || !preset.active) {
      return NextResponse.json(
        { success: false, images: [], errors: [{ filename: 'upload_preset', error: 'Upload preset not found or inactive' }] },
        { status: 400 }
      );
    }
    if (!preset.unsigned) {
      formData.delete('api_key');
      if (!request.headers.get('x-api-key') && !request.headers.get('authorization')) {
        return NextResponse.json(
          { success: false, images: [], errors: [{ filename: 'auth', error: 'Signed preset requires API credentials' }] },
          { status: 401 }
        );
      }
    }
  }

  const authorization = await authorizeDashboardOrApiKey(request, formData, 'upload', preset);
  if (!authorization.ok) {
    return NextResponse.json(
      { success: false, images: [], errors: [{ filename: 'auth', error: authorization.error }] },
      { status: authorization.status }
    );
  }

  const files = formData
    .getAll('file')
    .filter((f): f is File => f instanceof File && f.size > 0);

  const folder = preset?.folder ?? ((formData.get('folder') as string) || '/');
  const tags = preset?.tags ?? ((formData.get('tags') as string) || '');
  const compressed = preset ? preset.compress : formData.get('compressed') === 'true';
  const bgRemoved = preset ? preset.removeBg : formData.get('bgRemoved') === 'true';
  if (preset) {
    formData.set('compressed', String(preset.compress));
    formData.set('bgRemoved', String(preset.removeBg));
    if (preset.moderate) {
      formData.set('moderated', 'true');
      formData.set('moderationScore', String(0));
    }
  }
  const moderation = parseModeration(formData);

  const images: UploadResponse['images'] = [];
  const errors: UploadResponse['errors'] = [];

  if (files.length === 0) {
    const response = NextResponse.json(
      { success: false, images: [], errors: [{ filename: 'form', error: 'No files provided' }] },
      { status: 400 }
    );
    if (authorization.keyId) void recordApiKeyUsage(authorization.keyId, 'upload', { errors: 1 });
    return response;
  }

  // Process all files concurrently with Promise.allSettled
  const results = await Promise.allSettled(
    files.map(async (file) => {
      // 1. Validate file type and size
      if (!ALLOWED_FORMATS.includes(file.type)) {
        throw new Error(`Unsupported format: ${file.type || 'unknown'}`);
      }
      if (file.size > MAX_FILE_SIZE) {
        const maxMB = MAX_FILE_SIZE / (1024 * 1024);
        throw new Error(`File too large: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Max: ${maxMB} MB`);
      }

      // 2. Convert to Buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // 3. Extract metadata with sharp
      const metadata = await getImageMetadata(buffer);

      // 4. Determine MIME type and format
      const mimeType = file.type || getMimeType(file.name);
      const format = metadata.format;

      // Reject SVGs with scripts / event handlers (stored-XSS prevention)
      if (format === 'svg' || mimeType === 'image/svg+xml') {
        if (!isSafeSvg(buffer)) {
          throw new Error(
            'SVG contains unsafe content (scripts or event handlers are not allowed)'
          );
        }
      }

      // 5. Generate storage key
      const shortId = generateShortId();
      const storageKey = generateStorageKey(file.name, shortId, format);

      // 6. Upload to Supabase Storage
      await uploadToStorage(buffer, storageKey, mimeType);

      // 7. Get public URL
      const publicUrl = getPublicUrl(storageKey);

      // 8. Save to database
      const created = await prisma.image.create({
        data: {
          originalName: file.name,
          storagePath: storageKey,
          publicUrl,
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.size,
          format,
          mimeType,
          folder: folder || '/',
          tags,
          altText: '',
          bgRemoved,
          compressed,
          aiModerated: moderation.moderated,
          aiModerationScore: moderation.score,
        },
      });
      const version = await recordInitialImageVersion(created);

      // 9. Generate eager transform variants (thumbnail, medium, large)
      //    Runs in the background of this upload slot — doesn't block the
      //    overall response but the variant URLs are included in the result.
      let variants: Array<{ label: string; width: number; publicUrl: string }> = [];
      try {
        const generated = await generateEagerTransforms(buffer, storageKey, format);
        variants = generated.map((v) => ({
          label: v.label,
          width: v.width,
          publicUrl: v.publicUrl,
        }));
      } catch {
        // Variant generation is best-effort — don't fail the upload
      }

      return { image: serializeImage(created), initialVersion: version, variants };
    })
  );

  // Collect results and errors
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      images.push(result.value.image);
      void dispatchWebhooks('image.uploaded', {
        image: result.value.image,
        versions: [result.value.initialVersion],
      });
    } else {
      errors.push({
        filename: files[i].name,
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

  return NextResponse.json(
    {
      success: errors.length === 0,
      images,
      errors,
    },
    { status: 200 }
  );
}
