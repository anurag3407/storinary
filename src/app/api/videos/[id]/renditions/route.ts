import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoFromStorage, getPublicUrl, uploadToStorage } from '@/lib/storage';
import { authorizeDashboardOrWriteApiKey, recordManagementApiKeyUsage } from '@/lib/media-management-auth';
import {
  RENDITION_PRESETS,
  createVideoRendition,
  isFfmpegAvailable,
  type RenditionLabel,
} from '@/lib/video-renditions';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function parseLabels(value: string | null): RenditionLabel[] {
  if (!value) return Object.keys(RENDITION_PRESETS) as RenditionLabel[];
  const requested = value.split(',').map((label) => label.trim()).filter(Boolean);
  const labels = [...new Set(requested)].filter((label): label is RenditionLabel =>
    Object.prototype.hasOwnProperty.call(RENDITION_PRESETS, label)
  );
  if (labels.length !== requested.length) throw new Error('Invalid rendition label');
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

  let labels: RenditionLabel[];
  try {
    labels = parseLabels(request.nextUrl.searchParams.get('labels'));
  } catch {
    return NextResponse.json({
      error: 'labels must contain only supported values',
      supportedLabels: Object.keys(RENDITION_PRESETS),
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

  let source;
  try {
    source = await getVideoFromStorage(video.storagePath);
  } catch {
    return NextResponse.json({ error: 'Source video unavailable' }, { status: 502 });
  }

  const existing = new Map(video.renditions.map((rendition) => [rendition.label, rendition]));
  const results = [];
  const errors = [];

  for (const label of labels) {
    try {
      const generated = await createVideoRendition(source.buffer, label);
      const shortId = `${id}-${label}`.replace(/[^a-z0-9-]/gi, '');
      const storagePath = `videos/renditions/${shortId}.mp4`;
      await uploadToStorage(generated.buffer, storagePath, 'video/mp4');
      const rendition = await prisma.videoRendition.upsert({
        where: { videoId_label: { videoId: video.id, label } },
        update: {
          storagePath,
          publicUrl: getPublicUrl(storagePath),
          width: generated.width,
          height: generated.height,
          bitrateKbps: generated.bitrateKbps,
          fileSize: generated.buffer.length,
          status: 'ready',
        },
        create: {
          videoId: video.id,
          label,
          storagePath,
          publicUrl: getPublicUrl(storagePath),
          width: generated.width,
          height: generated.height,
          bitrateKbps: generated.bitrateKbps,
          fileSize: generated.buffer.length,
          status: 'ready',
        },
      });
      results.push(rendition);
      void recordManagementApiKeyUsage(authorization.keyId, 'write', {
        assets: 1,
        bytes: generated.buffer.length,
      }).catch(() => {});
    } catch (error) {
      errors.push({
        label,
        error: error instanceof Error ? error.message : 'Rendition generation failed',
      });
      void recordManagementApiKeyUsage(authorization.keyId, 'write', {
        errors: 1,
      }).catch(() => {});
    }
  }

  const replaced = labels.filter((label) => existing.has(label)).length;
  return NextResponse.json({
    success: errors.length === 0,
    created: results.length - replaced,
    updated: replaced,
    renditions: results,
    errors,
  }, { status: errors.length === 0 ? 201 : 207 });
}
