import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicUrl, generateStorageKey, uploadToStorage } from '@/lib/storage';
import { getImageMetadata } from '@/lib/image-processing';
import { isSafeSvg } from '@/lib/svg-security';
import { generateShortId, getMimeType, serializeImage } from '@/lib/utils';
import type { UploadResponse } from '@/types';

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

  const files = formData
    .getAll('file')
    .filter((f): f is File => f instanceof File && f.size > 0);

  const folder = (formData.get('folder') as string) || '/';
  const tags = (formData.get('tags') as string) || '';
  const compressed = formData.get('compressed') === 'true';
  const bgRemoved = formData.get('bgRemoved') === 'true';

  const images: UploadResponse['images'] = [];
  const errors: UploadResponse['errors'] = [];

  if (files.length === 0) {
    return NextResponse.json(
      { success: false, images: [], errors: [{ filename: 'form', error: 'No files provided' }] },
      { status: 400 }
    );
  }

  for (const file of files) {
    try {
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
        },
      });

      images.push(serializeImage(created));
    } catch (error) {
      errors.push({
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
