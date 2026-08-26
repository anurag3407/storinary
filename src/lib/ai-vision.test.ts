// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeImageWithVision, getImageDataUrl } from './ai-vision';

function jsonResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
    text: async () => content,
  };
}

describe('AI vision', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('rejects non-images and oversized images without calling the provider', async () => {
    expect(() => getImageDataUrl(Buffer.from('x'), 'text/plain')).toThrow(
      'Only image files can be analyzed'
    );
    expect(() =>
      getImageDataUrl(Buffer.alloc(21 * 1024 * 1024), 'image/png')
    ).toThrow('Image is too large for AI analysis');
  });

  it('sanitizes provider output and records requested features', async () => {
    process.env = {
      ...originalEnv,
      STORINARY_AI_API_KEY: 'test-key',
      STORINARY_AI_BASE_URL: 'https://ai.example/v1/',
      STORINARY_AI_MODEL: 'vision-test',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        `{"tags":[" Nature ", "nature","${'a'.repeat(100)}"],"alt_text":"  A forest.  ","moderation_score":1.4,"junk":true}`
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeImageWithVision(Buffer.from('image'), 'image/png');

    expect(result).toMatchObject({
      provider: 'openai-compatible',
      model: 'vision-test',
      kind: 'tags,caption,moderation',
      tags: ['Nature', 'nature', 'a'.repeat(48)],
      altText: 'A forest.',
      moderationScore: 1,
      isSafe: false,
      rawMetadata: '{"requestedFeatures":["tags","caption","moderation"]}',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ai.example/v1/chat/completions');
  });

  it('respects disabled features', async () => {
    process.env = { ...originalEnv, STORINARY_AI_API_KEY: 'test-key' };
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        '{"tags":["nature"],"alt_text":"A forest.","moderation_score":0,"ignored":true}'
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeImageWithVision(Buffer.from('image'), 'image/png', {
      tags: false,
      caption: true,
      moderation: false,
    });

    expect(result.kind).toBe('caption');
    expect(result.moderationScore).toBeNull();
    expect(result.isSafe).toBeNull();
  });
});
