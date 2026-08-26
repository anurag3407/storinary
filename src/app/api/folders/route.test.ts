// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH } from './route';

const mocks = vi.hoisted(() => ({
  canManageMedia: vi.fn(),
  listFolders: vi.fn(),
  renameFolder: vi.fn(),
  deleteEmptyFolder: vi.fn(),
}));

vi.mock('@/lib/media-auth', () => ({ canManageMedia: mocks.canManageMedia }));
vi.mock('@/lib/folders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/folders')>()),
  listFolders: mocks.listFolders,
  renameFolder: mocks.renameFolder,
  deleteEmptyFolder: mocks.deleteEmptyFolder,
}));

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/folders', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/folders', () => {
  it('protects every mutation and list operation', async () => {
    mocks.canManageMedia.mockResolvedValue(false);

    expect((await GET(new NextRequest('http://localhost/api/folders'))).status).toBe(401);
    expect((await PATCH(jsonRequest({ from: '/a', to: '/b' }))).status).toBe(401);
    expect(
      (
        await DELETE(new NextRequest('http://localhost/api/folders?path=%2Fa', { method: 'DELETE' }))
      ).status
    ).toBe(401);
    expect(mocks.listFolders).not.toHaveBeenCalled();
    expect(mocks.renameFolder).not.toHaveBeenCalled();
    expect(mocks.deleteEmptyFolder).not.toHaveBeenCalled();
  });

  it('rejects unsafe paths before renaming', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    const response = await PATCH(jsonRequest({ from: '/../secret', to: '/safe' }));

    expect(response.status).toBe(400);
    expect(mocks.renameFolder).not.toHaveBeenCalled();
  });

  it('renames normalized virtual folders across media types', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    mocks.renameFolder.mockResolvedValue({
      ok: true,
      status: 200,
      renamedImages: 2,
      renamedVideos: 3,
    });

    const response = await PATCH(jsonRequest({ from: 'old//path/', to: 'new/path' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.renameFolder).toHaveBeenCalledWith('/old/path', '/new/path');
    expect(body.renamedImages).toBe(2);
    expect(body.renamedVideos).toBe(3);
  });

  it('deletes only empty folders by path', async () => {
    mocks.canManageMedia.mockResolvedValue(true);
    mocks.deleteEmptyFolder.mockResolvedValue({ ok: true, status: 200 });

    const response = await DELETE(
      new NextRequest('http://localhost/api/folders?path=%2Fempty%2F', { method: 'DELETE' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.deleteEmptyFolder).toHaveBeenCalledWith('/empty');
    expect(body.success).toBe(true);
  });
});
