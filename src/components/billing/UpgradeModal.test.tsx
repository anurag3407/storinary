import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeModal } from './UpgradeModal';

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
  }),
}));

describe('UpgradeModal', () => {
  it('renders all three tiers with 100 MB free allocation notice', () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} currentUsageFormatted="12 MB" />);

    expect(screen.getByText('Storinary Cloud Plans & Storage')).toBeInTheDocument();
    expect(screen.getByText('Free Developer')).toBeInTheDocument();
    expect(screen.getByText('Pro Creator')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();

    // Check 100 MB free tier features
    expect(screen.getByText('Currently Active (12 MB used)')).toBeInTheDocument();
    expect(screen.getByText(/Account Cloud Storage/i)).toBeInTheDocument();
    expect(screen.getByText(/High-Performance Cloud Storage/i)).toBeInTheDocument();
  });

  it('allows joining the Pro waitlist with toast feedback', () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} currentUsageFormatted="12 MB" />);

    const joinBtn = screen.getByText('Join Pro Waitlist');
    fireEvent.click(joinBtn);

    expect(screen.getByText('Priority Granted')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<UpgradeModal isOpen={false} onClose={vi.fn()} currentUsageFormatted="12 MB" />);
    expect(screen.queryByText('Storinary Cloud Plans & Storage')).not.toBeInTheDocument();
  });
});
