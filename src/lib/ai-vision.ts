export type AiVisionFeatures = {
  tags: boolean;
  caption: boolean;
  moderation: boolean;
};

export type AiVisionOptions = AiVisionFeatures & {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  signal?: AbortSignal;
};

export type AiVisionResult = {
  provider: string;
  model: string;
  kind: string;
  tags: string[];
  altText: string | null;
  moderationScore: number | null;
  isSafe: boolean | null;
  rawMetadata?: string;
};

type ProviderResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function getConfig() {
  const apiKey = process.env.STORINARY_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Server-side AI is not configured');
  }

  return {
    apiKey,
    baseUrl: (
      process.env.STORINARY_AI_BASE_URL || 'https://api.openai.com/v1'
    ).replace(/\/+$/, ''),
    model: process.env.STORINARY_AI_MODEL || 'gpt-4o-mini',
  };
}

function getRequestedFeatures(options: Partial<AiVisionFeatures>) {
  const enabled = (value: boolean | undefined, fallback = true) => value ?? fallback;
  const environmentEnabled = (name: string) => process.env[name] !== 'false';

  return {
    tags: enabled(options.tags) && environmentEnabled('STORINARY_AI_ENABLE_TAGS'),
    caption: enabled(options.caption) && environmentEnabled('STORINARY_AI_ENABLE_CAPTIONS'),
    moderation:
      enabled(options.moderation) && environmentEnabled('STORINARY_AI_ENABLE_MODERATION'),
  };
}

export function getImageDataUrl(buffer: Buffer, mimeType: string) {
  if (!mimeType.startsWith('image/')) {
    throw new Error('Only image files can be analyzed');
  }
  if (buffer.byteLength === 0) {
    throw new Error('Image is empty');
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large for AI analysis');
  }

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().replace(/\s+/g, ' ').slice(0, 48))
      .filter(Boolean),
  )].slice(0, 24);
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 1000);
  return normalized || null;
}

function normalizeModeration(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const score = Math.min(1, Math.max(0, Math.round(value * 1000) / 1000));
  return { score, safe: score < 0.5 };
}

function extractContent(response: unknown) {
  const choices = (response as ProviderResponse)?.choices;
  if (!Array.isArray(choices)) throw new Error('Invalid AI response');

  for (const choice of choices) {
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
  }
  throw new Error('AI returned no analysis');
}

function parseResult(
  content: string,
  providerModel: { provider: string; model: string },
  features: AiVisionFeatures
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('AI did not return valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI returned an invalid analysis object');
  }

  const record = parsed as Record<string, unknown>;
  const tags = features.tags ? normalizeTags(record.tags) : [];
  const altText = features.caption ? normalizeText(record.alt_text ?? record.caption) : null;
  const moderation = features.moderation
    ? normalizeModeration(record.moderation_score)
    : null;
  const kinds = [
    tags.length > 0 && 'tags',
    Boolean(altText) && 'caption',
    moderation && 'moderation',
  ].filter(Boolean);

  if (kinds.length === 0) {
    throw new Error('AI analysis contained no usable fields');
  }

  return {
    ...providerModel,
    kind: kinds.join(','),
    tags,
    altText,
    moderationScore: moderation?.score ?? null,
    isSafe: moderation?.safe ?? null,
  };
}

function createPrompt(features: AiVisionFeatures) {
  const tasks = [
    features.tags && 'up to 12 concise lowercase topical tags',
    features.caption && 'one factual accessibility caption of at most 240 characters',
    features.moderation && 'a moderation score from 0 (safe) to 1 (unsafe)',
  ].filter(Boolean);

  return [
    `Analyze this image and return only JSON with ${tasks.join(', ')}.`,
    'Return this exact shape: {"tags":[],"alt_text":"","moderation_score":0}.',
    'Omit empty or unavailable values. Never include Markdown or commentary.',
  ].join(' ');
}

export async function analyzeImageWithVision(
  buffer: Buffer,
  mimeType: string,
  options: Partial<AiVisionOptions> = {}
): Promise<AiVisionResult> {
  const config = getConfig();
  const features = getRequestedFeatures(options);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise image metadata API. Always respond with strict JSON.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: createPrompt(features) },
            { type: 'image_url', image_url: { url: getImageDataUrl(buffer, mimeType) } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const result = parseResult(
    await extractContent(await response.json()),
    {
      provider: 'openai-compatible',
      model: options.model || config.model,
    },
    features
  );
  return {
    ...result,
    rawMetadata: JSON.stringify({
      requestedFeatures: Object.entries(features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
    }),
  };
}
