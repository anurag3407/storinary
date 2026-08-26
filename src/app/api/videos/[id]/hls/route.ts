import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoFromStorage, uploadToStorage } from '@/lib/storage';
import {
  authorizeDashboardOrWriteApiKey,
  recordManagementApiKeyUsage,
} from '@/lib/media-management-auth';
import {
  HLS_VARIANT_PRESETS,
  createVideoHlsPackage,
  isFfmpegAvailable,
  type HlsVariantLabel,
} from '@/lib/video-renditions';
import { createHlsPackageMetadata } from '@/lib/video-hls';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function parseLabels(value: string | null): HlsVariantLabel[] {
  if (!value) return Object.keys(HLS_VARIANT_PRESETS) as HlsVariantLabel[];
  const requested = value.split(',').map((label) => label.trim()).filter(Boolean);
  const labels = [...new Set(requested)].filter((label): label is HlsVariantLabel =>
    Object.prototype.hasOwnProperty.call(HLS_VARIANT_PRESETS, label)
  );
  if (labels.length !== requested.length) throw new Error('Invalid variant label');
  return labels;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let labels: HlsVariantLabel[];
  try {
    labels = parseLabels(request.nextUrl.searchParams.get('variants'));
  } catch {
    return NextResponse.json({
      error: 'variants must contain only supported values',
      supportedVariants: Object.keys(HLS_VARIANT_PRESETS),
    }, { status: 400 });
  }

  const { id } = await context.params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: { renditions: true },
  });
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  if (!(await isFfmpegAvailable())) {
    return NextResponse.json({ error: 'FFmpeg is not available' }, { status: 503 });
  }

  const sourceLabel = request.nextUrl.searchParams.get('source');
  const source = sourceLabel
    ? video.renditions.find((rendition) => rendition.label === sourceLabel)
    : null;
  if (sourceLabel && !source) {
    return NextResponse.json({ error: 'Source rendition not found' }, { status: 404 });
  }

  let input;
  try {
    input = await getVideoFromStorage(source?.storagePath ?? video.storagePath);
  } catch {
    return NextResponse.json({ error: 'Source video unavailable' }, { status: 502 });
  }

  try {
    const generated = await createVideoHlsPackage(input.buffer, video.id, labels);
    const metadata = createHlsPackageMetadata({
      label: labels.join('-'),
      masterPath: generated.masterManifest,
      variants: generated.variants,
      segmentPaths: generated.segments,
      totalFileSize: generated.totalFileSize,
    });

    for (const file of generated.files) {
      await uploadToStorage(file.buffer, file.path, file.contentType);
    }

    const hlsPackage = await prisma.videoHlsPackage.upsert({
      where: { videoId_label: { videoId: video.id, label: metadata.label } },
      update: {
        masterPath: metadata.masterPath,
        publicUrl: metadata.publicUrl,
        variants: metadata.variants,
        segmentPaths: metadata.segmentPaths,
        totalFileSize: metadata.totalFileSize,
        status: 'ready',
      },
      create: { videoId: video.id, ...metadata },
    });

    void recordManagementApiKeyUsage(authorization.keyId, 'write', {
      assets: 1,
      bytes: generated.totalFileSize,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      hlsPackage: {
        ...hlsPackage,
        playbackUrl: `/api/videos/${video.id}/hls/${hlsPackage.label}/master.m3u8`,
      },
    }, { status: 201 });
  } catch (error) {
    void recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 }).catch(() => {});
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'HLS generation failed',
    }, { status: 502 });
  }
}
