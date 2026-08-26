import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { MetadataFieldManager } from './MetadataFieldManager';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('MetadataFieldManager', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads and creates metadata fields', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({
        field: {
          id: 'field-1', externalId: 'campaign_code', label: 'Campaign code',
          type: 'enum', required: true, allowedValues: ['spring'], active: true,
        },
      }, true, 201);
      return jsonResponse({ fields: [] });
    });

    render(<MetadataFieldManager />, { wrapper: ToastProvider });
    await user.type(screen.getByLabelText('Metadata field ID'), 'campaign_code');
    await user.type(screen.getByLabelText('Metadata label'), 'Campaign code');
    await user.selectOptions(screen.getByLabelText('Metadata type'), 'enum');
    await user.type(screen.getByLabelText('Allowed metadata values'), 'spring');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Campaign code')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/metadata-fields', expect.objectContaining({ method: 'POST' }));
  });

  it('deletes a field and removes it from the list', async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? jsonResponse({ success: true })
        : jsonResponse({
          fields: [{
            id: 'field-1', externalId: 'rights', label: 'Rights',
            type: 'string', required: false, allowedValues: [], active: true,
          }],
        })
    );

    render(<MetadataFieldManager />, { wrapper: ToastProvider });
    expect(await screen.findByText('Rights')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Rights')).not.toBeInTheDocument());
  });
});
