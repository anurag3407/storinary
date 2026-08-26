import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import {
  analyzeImageWithVision,
  type AiVisionOptions,
} from '@/lib/ai-vision';
import { serializeVideo } from '@/lib/video-helpers';
import {
  createVideoFramePoster,
} from '@/lib/video-renditions';
import { normalizeDashPackage } from '@/lib/video-dash';
import { normalizeHlsPackage } from '@/lib/video-hls';
import { serializeVideoVersion } from '@/lib/asset-versions';
import {
  authorizeDashboardOrWriteApiKey,
  recordManagementApiKeyUsage,
} from '@/lib/media-management-auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

type Request = Parameters<typeof authorizeDashboardOrWriteApiKey>[0];

function parseBoolean(value: string | null, fallback: boolean) {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function mergeTags(existing: string, generatedTags: readonly string[], replace: boolean) {
  if (replace) return [...generatedTags].join(',');
  return [
    ...new Set(
      existing
        .split(',')
        .map((tag) => tag.trim().slice(0, 48))
        .filter(Boolean)
        .concat(generatedTags),
    ),
  ].join(',');
}

async function getPosterBuffer(
  video: { posterPath: string | null },
  originalBuffer: Buffer
) {
  if (video.posterPath) {
    try {
      return await getFromStorage(video.posterPath);
    } catch {
      // Fall back to extracting a frame from the source.
    }
  }
  return { buffer: await createVideoFramePoster(originalBuffer), contentType: 'image/webp' };
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) {
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let download;
  try {
    download = await getFromStorage(video.storagePath);
  } catch {
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    return NextResponse.json({ error: 'Unable to read video' }, { status: 502 });
  }

  try {
    const poster = await getPosterBuffer(video, download.buffer).catch(() => null);
    if (!poster || !poster.contentType.startsWith('image/')) {
      throw new Error('A poster image is required for video analysis');
    }

    const url = new URL(request.url).searchParams;
    const requestedTags = parseBoolean(url.get('tags'), true);
    const requestedCaption = parseBoolean(url.get('caption'), true);
    const requestedModeration = parseBoolean(url.get('moderation'), true);
    const analysis = await analyzeImageWithVision(poster.buffer, poster.contentType, {
      tags: requestedTags,
      caption: requestedCaption,
      moderation: requestedModeration,
      signal: AbortSignal.timeout(45_000),
    } satisfies Partial<AiVisionOptions>);

    const replaceMetadata = parseBoolean(url.get('replace_metadata'), false);
    const updated = await prisma.video.update({
      where: { id },
      data: {
        ...(requestedTags
          ? { tags: mergeTags(video.tags, analysis.tags, replaceMetadata) }
          : {}),
        ...(requestedCaption
          ? {
              altText:
                replaceMetadata || !video.altText ? analysis.altText ?? '' : video.altText,
            }
          : {}),
        ...(requestedModeration
          ? {
              aiModerated: analysis.isSafe !== null || Boolean(video.aiModerated),
              aiModerationScore:
                analysis.moderationScore ?? video.aiModerationScore,
            }
          : {}),
      },
      include: {
        renditions: true,
        hlsPackages: true,
        dashPackages: true,
        versions: { orderBy: { version: 'desc' } },
        metadata: { include: { field: { select: { externalId: true } } } },
      },
    });

    await prisma.aiInsight.create({
      data: {
        videoId: id,
        provider: analysis.provider,
        model: analysis.model,
        kind: analysis.kind,
        tags: analysis.tags.join(','),
        altText: analysis.altText,
        moderationScore: analysis.moderationScore,
        isSafe: analysis.isSafe,
        rawMetadata: JSON.stringify({
          ...(analysis.rawMetadata ? JSON.parse(analysis.rawMetadata) : {}),
          analyzedSource: video.posterPath ? 'stored-poster' : 'extracted-frame',
        }),
      },
    });

    await recordManagementApiKeyUsage(authorization.keyId, 'write', { assets: 1 });
    const serialized = serializeVideo({
      ...updated,
      hlsPackages: updated.hlsPackages.map(normalizeHlsPackage),
      dashPackages: updated.dashPackages.map(normalizeDashPackage),
      versions: updated.versions.map(serializeVideoVersion),
    });
    return NextResponse.json({ insight: analysis, video: serialized });
  } catch (error) {
    console.error('AI video analysis failed:', error);
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    const message =
      error instanceof Error && error.message === 'Server-side AI is not configured'
        ? 'AI is not configured. Set STORINARY_AI_API_KEY.'
        : 'AI analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
