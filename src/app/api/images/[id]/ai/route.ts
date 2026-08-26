import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromStorage } from '@/lib/storage';
import {
  analyzeImageWithVision,
  type AiVisionOptions,
} from '@/lib/ai-vision';
import { serializeImage } from '@/lib/utils';
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

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const authorization = await authorizeDashboardOrWriteApiKey(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) {
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let download;
  try {
    download = await getFromStorage(image.storagePath);
  } catch {
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    return NextResponse.json({ error: 'Unable to read image' }, { status: 502 });
  }

  const url = new URL(request.url).searchParams;
  try {
    const requestedTags = parseBoolean(url.get('tags'), true);
    const requestedCaption = parseBoolean(url.get('caption'), true);
    const requestedModeration = parseBoolean(url.get('moderation'), true);
    const analysis = await analyzeImageWithVision(download.buffer, image.mimeType, {
      tags: requestedTags,
      caption: requestedCaption,
      moderation: requestedModeration,
      signal: AbortSignal.timeout(30_000),
    } satisfies Partial<AiVisionOptions>);

    const replaceMetadata = parseBoolean(url.get('replace_metadata'), false);
    const updated = await prisma.image.update({
      where: { id },
      data: {
        ...(requestedTags
          ? { tags: mergeTags(image.tags, analysis.tags, replaceMetadata) }
          : {}),
        ...(requestedCaption
          ? {
              altText:
                replaceMetadata || !image.altText
                  ? analysis.altText ?? ''
                  : image.altText,
            }
          : {}),
        ...(requestedModeration
          ? {
              aiModerated: analysis.isSafe !== null || image.aiModerated,
              aiModerationScore: analysis.moderationScore ?? image.aiModerationScore,
            }
          : {}),
      },
    });
    await prisma.aiInsight.create({
      data: {
        imageId: id,
        provider: analysis.provider,
        model: analysis.model,
        kind: analysis.kind,
        tags: analysis.tags.join(','),
        altText: analysis.altText,
        moderationScore: analysis.moderationScore,
        isSafe: analysis.isSafe,
        rawMetadata: analysis.rawMetadata,
      },
    });

    await recordManagementApiKeyUsage(authorization.keyId, 'write', { assets: 1 });
    return NextResponse.json({
      insight: analysis,
      image: serializeImage(updated),
    });
  } catch (error) {
    console.error('AI vision analysis failed:', error);
    await recordManagementApiKeyUsage(authorization.keyId, 'write', { errors: 1 });
    const message =
      error instanceof Error && error.message === 'Server-side AI is not configured'
        ? 'AI is not configured. Set STORINARY_AI_API_KEY.'
        : 'AI analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
