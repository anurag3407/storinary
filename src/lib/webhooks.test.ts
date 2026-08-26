// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchWebhooks,
  signWebhookPayload,
  validateWebhookUrl,
  verifyWebhookSignature,
} from './webhooks';

const { deliveryCreateMock, deliveryFindManyMock, deliveryFindUniqueMock, deliveryUpdateMock, endpointFindManyMock } =
  vi.hoisted(() => ({
    deliveryCreateMock: vi.fn(),
    deliveryFindManyMock: vi.fn(),
    deliveryFindUniqueMock: vi.fn(),
    deliveryUpdateMock: vi.fn(),
    endpointFindManyMock: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEndpoint: { findMany: endpointFindManyMock },
    webhookDelivery: {
      create: deliveryCreateMock,
      findMany: deliveryFindManyMock,
      findUnique: deliveryFindUniqueMock,
      update: deliveryUpdateMock,
    },
  },
}));

const ENDPOINT = {
  id: 'endpoint-1',
  name: 'Site',
  url: 'https://example.com/hook',
  secret: 'whsec_test',
  active: true,
};

describe('webhook URL validation', () => {
  it('accepts public HTTPS URLs', () => {
    expect(validateWebhookUrl('https://example.com/hook')).toBe('https://example.com/hook');
  });

  it('rejects plaintext and private destinations', () => {
    expect(validateWebhookUrl('http://example.com')).toBeNull();
    expect(validateWebhookUrl('https://localhost/hook')).toBeNull();
    expect(validateWebhookUrl('https://192.168.1.8/hook')).toBeNull();
    expect(validateWebhookUrl('not-a-url')).toBeNull();
  });
});

describe('webhook signatures', () => {
  it('signs timestamp plus raw body and verifies exact values only', () => {
    const body = '{"ok":true}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signWebhookPayload(ENDPOINT.secret, Number(timestamp), body);
    expect(verifyWebhookSignature(ENDPOINT.secret, timestamp, signature, body)).toBe(true);
    expect(verifyWebhookSignature(ENDPOINT.secret, timestamp, signature, '{"ok":false}')).toBe(false);
    expect(verifyWebhookSignature('wrong', timestamp, signature, body)).toBe(false);
    expect(verifyWebhookSignature(ENDPOINT.secret, 'invalid', signature, body)).toBe(false);
  });
});

describe('dispatchWebhooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    endpointFindManyMock.mockReset().mockResolvedValue([ENDPOINT]);
    deliveryCreateMock.mockReset().mockResolvedValue({ id: 'delivery-1' });
    deliveryFindManyMock.mockReset().mockResolvedValue([]);
    deliveryFindUniqueMock.mockReset();
    deliveryUpdateMock.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and delivers an event with signature headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const row = {
      id: 'delivery-1',
      endpointId: ENDPOINT.id,
      eventType: 'image.uploaded',
      payload: '{"data":{"image":{"id":"image-1"}}}',
      status: 'pending',
      responseCode: null,
      attempts: 0,
      error: null,
      nextAttemptAt: new Date(),
      deliveredAt: null,
      createdAt: new Date(),
      endpoint: ENDPOINT,
    };
    deliveryFindUniqueMock.mockResolvedValue(row);

    await dispatchWebhooks('image.uploaded', { image: { id: 'image-1' } });

    expect(deliveryCreateMock).toHaveBeenCalledWith({
      data: { endpointId: ENDPOINT.id, eventType: 'image.uploaded', payload: expect.any(String) },
    });
    const [url, init] = fetchMock.mock.calls[0];
    const timestamp = init.headers['X-Storinary-Timestamp'];
    const signature = init.headers['X-Storinary-Signature'].replace('sha256=', '');
    expect(url).toBe(ENDPOINT.url);
    expect(init.headers['X-Storinary-Event']).toBe('image.uploaded');
    expect(verifyWebhookPayloadTest(ENDPOINT.secret, timestamp, signature, row.payload)).toBe(true);
    expect(deliveryUpdateMock).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'delivered', responseCode: 200, attempts: { increment: 1 } }),
    });
  });

  it('schedules one retry after a failed HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    deliveryFindUniqueMock.mockResolvedValue({
      id: 'delivery-1',
      endpointId: ENDPOINT.id,
      eventType: 'video.deleted',
      payload: '{}',
      status: 'pending',
      responseCode: null,
      attempts: 0,
      error: null,
      nextAttemptAt: new Date('2026-01-01T00:00:00Z'),
      deliveredAt: null,
      createdAt: new Date(),
      endpoint: ENDPOINT,
    });

    await dispatchWebhooks('video.deleted', { id: 'video-1' });

    expect(deliveryUpdateMock).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'pending', responseCode: 500 }),
    });
    const nextAttemptAt = deliveryUpdateMock.mock.calls[0][0].data.nextAttemptAt;
    expect(nextAttemptAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime());
  });
});

function verifyWebhookPayloadTest(secret: string, timestamp: string, signature: string, body: string) {
  return signWebhookPayload(secret, Number(timestamp), body) === signature;
}
