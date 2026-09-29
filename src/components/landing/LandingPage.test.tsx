import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingPage } from './LandingPage';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAppAuth: () => ({
    session: null,
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

describe('LandingPage', () => {
  it('renders landing page with navigation and pricing section', () => {
    render(<LandingPage />);

    // Check navbar brand
    expect(screen.getByText('STORINARY')).toBeInTheDocument();
    expect(screen.getByText('Plans & Pricing')).toBeInTheDocument();

    // Check pricing section
    expect(screen.getByText('Predictable SaaS Pricing')).toBeInTheDocument();
    expect(screen.getByText(/100 MB free cloud storage/i)).toBeInTheDocument();

    // Check tiers
    expect(screen.getByText('Free Developer')).toBeInTheDocument();
    expect(screen.getByText('Pro Creator')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Scale')).toBeInTheDocument();

    // Check 100 MB quota mention
    expect(screen.getAllByText(/100 MB/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Deploy Free ➔')).toBeInTheDocument();
  });
});
