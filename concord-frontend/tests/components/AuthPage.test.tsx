import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock OAuthButtons
vi.mock('@/components/auth/OAuthButtons', () => ({
  OAuthButtons: ({ labelPrefix, onError, className }: { labelPrefix?: string; onError?: (e: string) => void; className?: string }) =>
    React.createElement('div', { 'data-testid': 'oauth-buttons', className }, [
      React.createElement('button', { key: 'google', onClick: () => {} }, `${labelPrefix || 'Continue with'} Google`),
      React.createElement('button', { key: 'apple', onClick: () => {} }, `${labelPrefix || 'Continue with'} Apple`),
    ]),
}));

import { AuthPage } from '@/components/auth/AuthPage';

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    // Mock fetch for form submissions
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, user: { id: '1', username: 'test', email: 'test@test.com' } }),
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '', search: '', pathname: '/auth' },
    });
  });

  it('renders OAuth buttons', () => {
    render(<AuthPage />);
    expect(screen.getByTestId('oauth-buttons')).toBeDefined();
    expect(screen.getByText(/Google/)).toBeDefined();
    expect(screen.getByText(/Apple/)).toBeDefined();
  });

  it('renders sign in form by default', () => {
    render(<AuthPage />);
    expect(screen.getByText(/sign in to concord/i)).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('toggle between Sign In and Sign Up', () => {
    render(<AuthPage />);

    // Default is sign in
    expect(screen.getByText(/sign in to concord/i)).toBeDefined();

    // Click "Sign up" toggle
    fireEvent.click(screen.getByText(/sign up/i));

    expect(screen.getByText(/create your account/i)).toBeDefined();
    // Username field should appear in sign up mode
    expect(screen.getByLabelText(/username/i)).toBeDefined();
  });

  it('toggle back to Sign In from Sign Up', () => {
    render(<AuthPage />);

    // Switch to sign up
    fireEvent.click(screen.getByText(/sign up/i));
    expect(screen.getByText(/create your account/i)).toBeDefined();

    // Switch back to sign in
    fireEvent.click(screen.getByText(/sign in/i));
    expect(screen.getByText(/sign in to concord/i)).toBeDefined();
  });

  it('email/password form validation - email required', () => {
    render(<AuthPage />);
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.required).toBe(true);
  });

  it('email/password form validation - password required', () => {
    render(<AuthPage />);
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.required).toBe(true);
  });

  it('submit calls login API in sign-in mode', async () => {
    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'mypassword123' },
    });

    fireEvent.submit(screen.getByRole('form') || screen.getByText(/sign in$/i).closest('form')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test@test.com'),
        })
      );
    });
  });

  it('submit calls register API in sign-up mode', async () => {
    render(<AuthPage />);

    // Switch to sign up
    fireEvent.click(screen.getByText(/sign up/i));

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'securepassword12' },
    });

    // Find and submit the form
    const submitButton = screen.getByText(/create account/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('newuser'),
        })
      );
    });
  });

  it('error display on authentication failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'Invalid credentials' }),
    });

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' },
    });

    const submitButton = screen.getByText(/sign in$/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeDefined();
    });
  });

  it('error display on network failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<AuthPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByText(/sign in$/i));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeDefined();
    });
  });

  it('shows loading state while checking auth', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(<AuthPage />);
    expect(screen.getByText(/checking authentication/i)).toBeDefined();
  });

  it('password toggle show/hide works', () => {
    render(<AuthPage />);
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // Find the eye toggle button
    const toggleButtons = screen.getAllByRole('button');
    const eyeToggle = toggleButtons.find(b => b.getAttribute('tabindex') === '-1');
    if (eyeToggle) {
      fireEvent.click(eyeToggle);
      expect(passwordInput.type).toBe('text');
    }
  });

  it('calls onAuthSuccess callback on successful auth', async () => {
    const onAuthSuccess = vi.fn();
    render(<AuthPage onAuthSuccess={onAuthSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'mypassword123' },
    });

    fireEvent.click(screen.getByText(/sign in$/i));

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', username: 'test' })
      );
    });
  });

  it('shows OAuth label prefix based on mode', () => {
    render(<AuthPage />);
    expect(screen.getByText(/sign in with google/i)).toBeDefined();

    fireEvent.click(screen.getByText(/sign up/i));
    expect(screen.getByText(/sign up with google/i)).toBeDefined();
  });

  it('shows terms of service text', () => {
    render(<AuthPage />);
    expect(screen.getByText(/terms of service/i)).toBeDefined();
  });
});
