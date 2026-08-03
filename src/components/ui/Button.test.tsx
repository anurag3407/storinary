import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and is clickable', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant and size classes', () => {
    render(<Button variant="danger" size="lg">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('danger');
    expect(button.className).toContain('lg');
  });

  it('adds fullWidth class when requested', () => {
    render(<Button fullWidth>Wide</Button>);
    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain(
      'fullWidth'
    );
  });

  it('renders an icon alongside children', () => {
    render(<Button icon={<span>✨</span>}>Action</Button>);
    expect(screen.getByText('✨')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Action/ })).toBeInTheDocument();
  });

  it('disables the button when disabled or loading', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();

    render(<Button loading>Busy</Button>);
    const busy = screen.getByRole('button', { name: /Busy/ });
    expect(busy).toBeDisabled();
    expect(busy.getAttribute('aria-busy')).toBe('true');
  });

  it('submits with a custom type', () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute(
      'type',
      'submit'
    );
  });
});
