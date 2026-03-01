import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { OAuthButtons } from '@/components/auth/OAuthButtons';

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '', search: '', pathname: '/auth' },
    });

    // Mock fetch for providers endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, providers: ['google', 'apple'] }),
    });
  });

  it('renders loading state initially', () => {
    render(<OAuthButtons />);
    // Should show spinner while fetching providers
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('renders Google button after providers load', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      expect(screen.getByText(/google/i)).toBeDefined();
    });
  });

  it('renders Apple button after providers load', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      expect(screen.getByText(/apple/i)).toBeDefined();
    });
  });

  it('Google button renders with correct styling', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      const googleButton = screen.getByText(/google/i).closest('button')!;
      expect(googleButton.className).toContain('bg-white');
    });
  });

  it('Apple button renders with correct styling', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      const appleButton = screen.getByText(/apple/i).closest('button')!;
      expect(appleButton.className).toContain('bg-black');
    });
  });

  it('click redirects to OAuth URL for Google', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      expect(screen.getByText(/google/i)).toBeDefined();
    });

    const googleButton = screen.getByText(/google/i).closest('button')!;
    fireEvent.click(googleButton);

    expect(window.location.href).toContain('/api/auth/google');
  });

  it('click redirects to OAuth URL for Apple', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      expect(screen.getByText(/apple/i)).toBeDefined();
    });

    const appleButton = screen.getByText(/apple/i).closest('button')!;
    fireEvent.click(appleButton);

    expect(window.location.href).toContain('/api/auth/apple');
  });

  it('loading state during redirect (disables other buttons)', async () => {
    render(<OAuthButtons />);

    await waitFor(() => {
      expect(screen.getByText(/google/i)).toBeDefined();
    });

    // Click Google
    const googleButton = screen.getByText(/google/i).closest('button')!;
    fireEvent.click(googleButton);

    // Apple button should be disabled
    const appleButton = screen.getByText(/apple/i).closest('button')!;
    expect(appleButton.disabled).toBe(true);
  });

  it('uses custom labelPrefix', async () => {
    render(<OAuthButtons labelPrefix="Sign up with" />);

    await waitFor(() => {
      expect(screen.getByText(/sign up with google/i)).toBeDefined();
    });
  });

  it('renders nothing when no providers available', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, providers: [] }),
    });

    const { container } = render(<OAuthButtons />);

    await waitFor(() => {
      // Loading spinner should disappear and nothing should render
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });

    // Container should be empty or null-like
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('calls onError when error query param is present', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '', search: '?error=oauth_failed', pathname: '/auth' },
    });

    const onError = vi.fn();
    render(<OAuthButtons onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });

  it('handles fetch providers failure gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

    const { container } = render(<OAuthButtons />);

    await waitFor(() => {
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });
  });

  it('Apple button always says "Sign in with" regardless of prefix', async () => {
    render(<OAuthButtons labelPrefix="Sign up with" />);

    await waitFor(() => {
      // Apple button should say "Sign in with Apple" per the component code
      expect(screen.getByText(/sign in with apple/i)).toBeDefined();
    });
  });
});
