import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ImageMeta } from './ImageMeta';
import type { ImageRecord, ImageVersionRecord } from '@/types';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const image: ImageRecord = {
  id: 'img-1',
  originalName: 'hero.webp',
  storagePath: '2024/01/hero-abc.webp',
  publicUrl: 'https://cdn.example/hero.webp',
  width: 800,
  height: 600,
  fileSize: 20480,
  format: 'webp',
  mimeType: 'image/webp',
  folder: '/',
  tags: 'hero,banner',
  altText: 'Hero image',
  bgRemoved: true,
  aiModerated: false,
  aiModerationScore: null,
  compressed: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const versions: ImageVersionRecord[] = [{
  id: 'version-1',
  imageId: 'img-1',
  version: 2,
  label: 'replaced',
  originalName: 'previous.webp',
  storagePath: '2024/01/previous.webp',
  publicUrl: 'https://cdn.example/previous.webp',
  width: 640,
  height: 480,
  fileSize: 1024,
  format: 'webp',
  mimeType: 'image/webp',
  createdAt: '2024-01-01T00:00:00.000Z',
}];

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('ImageMeta', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn().mockReturnValue('blob:replacement');
  });

  it('renders the metadata table', () => {
    render(<ImageMeta image={image} />, { wrapper });
    expect(screen.getByText('hero.webp')).toBeInTheDocument();
    expect(screen.getByText('800 × 600 px')).toBeInTheDocument();
    expect(screen.getByText('WEBP')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('renders tags as badges', () => {
    render(<ImageMeta image={image} />, { wrapper });
    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('banner')).toBeInTheDocument();
  });

  it('shows persisted local AI moderation state', () => {
    render(<ImageMeta image={image} />, { wrapper });
    expect(screen.getByText('Not analyzed')).toBeInTheDocument();

    render(
      <ImageMeta
        image={{ ...image, aiModerated: true, aiModerationScore: 0.32 }}
      />,
      { wrapper }
    );
    expect(screen.getByText('Score 32%')).toBeInTheDocument();
  });

  it('requests server-side vision analysis and refreshes the detail', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<ImageMeta image={image} />, { wrapper });

    await user.click(screen.getByRole('button', { name: 'Analyze with AI' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/images/img-1/ai', { method: 'POST' })
    );
    expect(refreshMock).toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/metadata-fields', { cache: 'no-store' }));
  });

  it('saves structured enum metadata through the v1 API', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => (
        String(input) === '/api/metadata-fields'
          ? {
            fields: [{
              id: 'field-rights', externalId: 'rights', label: 'Rights',
              type: 'enum', required: false, allowedValues: ['approved'], active: true,
            }],
          }
          : {}
      ),
    }));
    render(
      <ImageMeta image={{ ...image, metadata: undefined }} versions={[]} />,
      { wrapper }
    );

    await screen.findByLabelText('Rights');
    await user.selectOptions(screen.getByLabelText('Rights'), 'approved');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/media/img-1?resource_type=image', expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ metadata: { rights: 'approved' } }),
      }));
    });
  });

  it('edits and saves a field via PATCH', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<ImageMeta image={image} />, { wrapper });

    fireEvent.click(screen.getByLabelText('Edit Alt Text'));
    const input = screen.getByPlaceholderText('Alt Text');
    fireEvent.change(input, { target: { value: 'New alt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/images/img-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
    const metadataCall = fetchMock.mock.calls.find(([url]) => url === '/api/images/img-1');
    const body = JSON.parse(metadataCall?.[1]?.body as string);
    expect(body).toEqual({ altText: 'New alt' });
    expect(refreshMock).toHaveBeenCalled();
  });


  it('shows an error toast when saving fails', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<ImageMeta image={image} />, { wrapper });

    fireEvent.click(screen.getByLabelText('Edit Folder'));
    const input = screen.getByPlaceholderText('Folder');
    fireEvent.change(input, { target: { value: '/new' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Failed to save changes')).toBeInTheDocument();
  });

  it('cancels editing on Escape', () => {
    render(<ImageMeta image={image} />, { wrapper });
    fireEvent.click(screen.getByLabelText('Edit Tags'));
    const input = screen.getByPlaceholderText('Tags');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Tags')).not.toBeInTheDocument();
  });

  it('restores a historical version through the API', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<ImageMeta image={image} versions={versions} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/images/img-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ restoreVersionId: 'version-1' }),
        })
      );
    });
    expect(await screen.findByText('Version restored')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
