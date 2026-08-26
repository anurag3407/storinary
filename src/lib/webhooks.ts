import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const WEBHOOK_EVENT_TYPES = [
  'image.uploaded',
  'image.updated',
  'image.deleted',
  'video.uploaded',
  'video.updated',
  'video.deleted',
  'video.clip_created',
  'video.clip_deleted',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [30_000, 5 * 60_000];
const MAX_ENDPOINTS = 20;

type WebhookEvent = {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: Record<string, unknown>;
};

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (/^(10\.|127\.|0\.|169\.254\.)/.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return true;
  if (/^::1$|^fc|^fd|^fe80:/.test(normalized)) return true;
  return false;
}

export function validateWebhookUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    if (isPrivateHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function serializeWebhookEndpoint(endpoint: {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    active: endpoint.active,
    createdAt: endpoint.createdAt.toISOString(),
  };
}

export function serializeWebhookDelivery(delivery: {
  id: string;
  endpointId: string;
  eventType: string;
  payload: string;
  status: string;
  responseCode: number | null;
  attempts: number;
  error: string | null;
  nextAttemptAt: Date;
  deliveredAt: Date | null;
  createdAt: Date;
}) {
  let data: unknown = null;
  try {
    data = JSON.parse(delivery.payload).data;
  } catch {
    data = null;
  }

  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    eventType: delivery.eventType as WebhookEventType,
    data,
    status: delivery.status as 'pending' | 'delivered' | 'failed',
    responseCode: delivery.responseCode,
    attempts: delivery.attempts,
    error: delivery.error,
    nextAttemptAt: delivery.nextAttemptAt.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
  };
}

export function signWebhookPayload(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: string
): boolean {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const parsedTimestamp = Number(timestamp);
  if (Math.abs(Date.now() / 1000 - parsedTimestamp) > 300) return false;
  const expected = signWebhookPayload(secret, parsedTimestamp, body);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function deliver(deliveryId: string, event: WebhookEvent) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || !delivery.endpoint.active || delivery.status !== 'pending') return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(delivery.endpoint.secret, timestamp, delivery.payload);

  try {
    const response = await fetch(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Storinary-Event': event.type,
        'X-Storinary-Timestamp': String(timestamp),
        'X-Storinary-Signature': `sha256=${signature}`,
      },
      body: delivery.payload,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const success = response.status >= 200 && response.status < 300;
    const exhausted = !success && delivery.attempts + 1 >= MAX_ATTEMPTS;
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: success ? 'delivered' : exhausted ? 'failed' : 'pending',
        responseCode: response.status,
        attempts: { increment: 1 },
        deliveredAt: success ? new Date() : null,
        nextAttemptAt: success || exhausted ? delivery.nextAttemptAt : new Date(Date.now() + RETRY_DELAYS_MS[delivery.attempts]),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delivery failed';
    const exhausted = delivery.attempts + 1 >= MAX_ATTEMPTS;
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: exhausted ? 'failed' : 'pending',
        attempts: { increment: 1 },
        responseCode: null,
        error: message.slice(0, 500),
        nextAttemptAt: exhausted ? delivery.nextAttemptAt : new Date(Date.now() + RETRY_DELAYS_MS[delivery.attempts]),
      },
    });
  }
}

async function retryDueDeliveries() {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: 'pending', nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { nextAttemptAt: 'asc' },
    take: 10,
    include: { endpoint: true },
  });
  await Promise.allSettled(due.map((delivery) => deliver(delivery.id, {
    id: delivery.id,
    type: delivery.eventType as WebhookEventType,
    createdAt: delivery.createdAt.toISOString(),
    data: JSON.parse(delivery.payload).data,
  })));
}

export async function dispatchWebhooks(type: WebhookEventType, data: Record<string, unknown>) {
  const event: WebhookEvent = {
    id: randomBytes(16).toString('hex'),
    type,
    createdAt: new Date().toISOString(),
    data,
  };
  const payload = JSON.stringify(event);

  const endpoints = await prisma.webhookEndpoint.findMany({ where: { active: true }, take: MAX_ENDPOINTS });
  if (endpoints.length === 0) return;

  const deliveries = await Promise.all(
    endpoints.map((endpoint) =>
      prisma.webhookDelivery.create({
        data: { endpointId: endpoint.id, eventType: type, payload },
      })
    )
  );
  await Promise.allSettled(deliveries.map((delivery) => deliver(delivery.id, event)));
  void retryDueDeliveries();
}

export async function listWebhookDeliveries(endpointId?: string, limit = 25) {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: endpointId ? { endpointId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
  return deliveries.map(serializeWebhookDelivery);
}
