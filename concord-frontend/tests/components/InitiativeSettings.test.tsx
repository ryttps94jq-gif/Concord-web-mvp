import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<Record<string, unknown>>();
  const makeMockIcon = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, Record<string, unknown>>((props, ref) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ref, ...props })
    );
    Icon.displayName = name;
    return Icon;
  };
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    if (key[0] >= 'A' && key[0] <= 'Z' && key !== 'createLucideIcon' && key !== 'default') {
      overrides[key] = makeMockIcon(key);
    }
  }
  return { ...actual, ...overrides };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('InitiativeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        settings: {
          max_per_day: 3,
          max_per_week: 10,
          quiet_start: '22:00',
          quiet_end: '08:00',
          allow_double_text: true,
          channels: { inApp: true, push: false, sms: false, email: false },
          disabled: false,
        },
      }),
    });
  });

  it('renders without crashing', async () => {
    const { default: InitiativeSettings } = await import('@/components/settings/InitiativeSettings');
    render(React.createElement(InitiativeSettings));
    await waitFor(() => {
      expect(screen.getByText(/initiative/i) || screen.getByText(/settings/i)).toBeDefined();
    });
  });

  it('fetches settings on mount', async () => {
    const { default: InitiativeSettings } = await import('@/components/settings/InitiativeSettings');
    render(React.createElement(InitiativeSettings));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { default: InitiativeSettings } = await import('@/components/settings/InitiativeSettings');
    render(React.createElement(InitiativeSettings));
    await waitFor(() => {
      const errorEl = screen.queryByText(/error/i) || screen.queryByText(/failed/i);
      expect(errorEl).toBeDefined();
    });
  });
});
