import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { getImageDetailMock, notFoundMock } = vi.hoisted(() => ({
  getImageDetailMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('@/lib/image-detail', () => ({
  getImageDetail: getImageDetailMock,
  ImageDetailError: class ImageDetailError extends Error {},
}));

vi.mock('@/components/image-detail/DetailView', () => ({
  DetailView: () => <div data-testid="detail-view" />,
}));

import ImageDetailPage, { generateMetadata } from './page';

const params = () => Promise.resolve({ id: 'img-1' });

const DETAIL = {
  image: {
    id: 'img-1',
    originalName: 'hero.webp',
    storagePath: '2024/01/hero.webp',
    publicUrl: 'https://cdn.example/hero.webp',
    width: 800,
    height: 600,
    fileSize: 20480,
    format: 'webp',
    mimeType: 'image/webp',
    folder: '/',
    tags: '',
    altText: '',
    bgRemoved: false,
    aiModerated: false,
    aiModerationScore: null,
    compressed: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  versions: [],
  links: { transformBase: 'https://cdn.example/api/serve/2024/01/hero.webp' },
};

describe('image detail page', () => {
  beforeEach(() => {
    getImageDetailMock.mockReset();
    notFoundMock.mockClear();
  });

  it('renders a distinct server-error state (not 404) when the lookup fails', async () => {
    getImageDetailMock.mockRejectedValue(new Error('db down'));

    const ui = await ImageDetailPage({ params: params() });
    render(ui);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByText('Could not load this image')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to gallery/i })
    ).toHaveAttribute('href', '/gallery');
    expect(screen.queryByTestId('detail-view')).not.toBeInTheDocument();
  });

  it('calls notFound for a genuinely missing image', async () => {
    getImageDetailMock.mockResolvedValue(null);

    await expect(ImageDetailPage({ params: params() })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('renders the detail view for an existing image', async () => {
    getImageDetailMock.mockResolvedValue(DETAIL);

    const ui = await ImageDetailPage({ params: params() });
    render(ui);

    expect(screen.getByTestId('detail-view')).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('generateMetadata falls back to a generic title when the lookup fails', async () => {
    getImageDetailMock.mockRejectedValue(new Error('db down'));

    await expect(generateMetadata({ params: params() })).resolves.toEqual({
      title: 'Image unavailable',
    });
  });

  it('generateMetadata uses the image name on success', async () => {
    getImageDetailMock.mockResolvedValue(DETAIL);

    await expect(generateMetadata({ params: params() })).resolves.toMatchObject({
      title: 'hero.webp',
    });
  });
});
