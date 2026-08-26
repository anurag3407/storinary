// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const { canManageMediaMock, createMock, findManyMock } = vi.hoisted(() => ({
  canManageMediaMock: vi.fn(),
  createMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ canManageMedia: canManageMediaMock }));
vi.mock('@/lib/prisma', () => ({
  prisma: { webhookEndpoint: { create: createMock, findMany: findManyMock } },
}));

const ENDPOINT = {
  id: 'webhook-1',
  name: 'Site',
  url: 'https://example.com/hook',
  secret: 'whsec_hidden_at_rest_in_ui',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('/api/webhooks', () => {
  beforeEach(() => {
    canManageMediaMock.mockReset().mockResolvedValue(true);
    createMock.mockReset();
    findManyMock.mockReset().mockResolvedValue([ENDPOINT]);
  });

  it('requires dashboard authorization', async () => {
    canManageMediaMock.mockResolvedValue(false);
    const response = await GET(new NextRequest('http://localhost/api/webhooks'));
    expect(response.status).toBe(401);
  });

  it('lists endpoints without exposing signing secrets', async () => {
    const response = await GET(new NextRequest('http://localhost/api/webhooks'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.webhooks[0]).toEqual({
      id: ENDPOINT.id,
      name: ENDPOINT.name,
      url: ENDPOINT.url,
      active: true,
      createdAt: ENDPOINT.createdAt.toISOString(),
    });
  });

  it('creates a webhook with a generated secret', async () => {
    createMock.mockResolvedValue(ENDPOINT);
    const response = await POST(new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Site', url: 'https://example.com/hook' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.webhook.secret).toMatch(/^whsec_/);
    expect(createMock).toHaveBeenCalledWith({ data: expect.objectContaining({ active: true }) });
  });

  it('rejects invalid destinations before touching the database', async () => {
    const response = await POST(new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Local', url: 'https://127.0.0.1/hook' }),
    }));
    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
