// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const { deleteManyMock } = vi.hoisted(() => ({
  deleteManyMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    image: {
      deleteMany: deleteManyMock,
    },
  },
}));

describe('DELETE /api/reset', () => {
  it('deletes all records and returns success', async () => {
    deleteManyMock.mockResolvedValue({ count: 5 });
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(deleteManyMock).toHaveBeenCalledWith({});
  });

  it('returns a 500 when deletion fails', async () => {
    deleteManyMock.mockRejectedValue(new Error('db down'));
    const response = await DELETE();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Reset failed' });
  });
});
