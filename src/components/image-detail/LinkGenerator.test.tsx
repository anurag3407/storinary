import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { LinkGenerator } from './LinkGenerator';
import type { GeneratedLinks } from '@/types';

const links: GeneratedLinks = {
  direct: 'https://cdn.example/hero.webp',
  directUrl: 'https://cdn.example/hero.webp',
  html: '<img src="https://cdn.example/hero.webp" alt="Hero image" loading="lazy" />',
  markdown: '![Hero image](https://cdn.example/hero.webp)',
  css: "background-image: url('https://cdn.example/hero.webp');",
  transformBase: 'http://localhost:3000/api/serve/2024/01/hero-abc.webp',
};

const baseLinks = links;

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('LinkGenerator', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the core link rows', () => {
    render(<LinkGenerator links={links} />, { wrapper });
    expect(screen.getByText('Direct URL')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    expect(screen.queryByText('Transform URL')).not.toBeInTheDocument();
  });

  it('shows a transform row when transform params are provided', () => {
    render(
      <LinkGenerator
        links={links}
        transformParams={{ w: 150, h: 150, fit: 'cover', q: 80 }}
      />,
      { wrapper }
    );
    expect(screen.getByText('Transform URL')).toBeInTheDocument();
    expect(screen.getByText(/w=150/)).toBeInTheDocument();
    expect(screen.getByText(/fit=cover/)).toBeInTheDocument();
  });

  it('copies the direct URL on click', async () => {
    render(<LinkGenerator links={links} />, { wrapper });
    fireEvent.click(screen.getAllByRole('button', { name: /Copy/ })[0]);

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(links.direct);
  });

  it('copies all links via the bulk button', async () => {
    render(<LinkGenerator links={links} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Copy All Links/ }));

    expect(await screen.findByText('All links copied!')).toBeInTheDocument();
    const text = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as string;
    expect(text).toContain('Direct URL:');
    expect(text).toContain('Markdown:');
  });
});

describe('signed transform link generation', () => {
  it('preserves a pre-signed transform token instead of rebuilding an unauthorized URL', () => {
    render(
      <LinkGenerator
        links={{
          ...baseLinks,
          transformUrl: '/api/serve/2024/01/hero.webp?w=400&q=80&token=safe-token',
        }}
        transformParams={{ w: 400, q: 80 }}
      />,
      { wrapper }
    );

    expect(screen.getAllByText(/token=safe-token/).length).toBeGreaterThan(0);
    expect(screen.queryByText('?w=400&q=80')).not.toBeInTheDocument();
  });
});
