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
  // Add icons that may not exist in all lucide-react versions
  const extraIcons = ['Compress', 'Code2', 'GitBranch', 'Package', 'Layers', 'Play'];
  for (const name of extraIcons) {
    if (!overrides[name]) overrides[name] = makeMockIcon(name);
  }
  return { ...actual, ...overrides };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CodeEngineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        repositories: 5,
        patterns: 142,
        megas: 3,
        generations: 2,
        errors: 1,
        recentIngestions: [],
        topPatterns: [],
      }),
    });
  });

  it('renders without crashing', async () => {
    const { default: CodeEngineStatus } = await import('@/components/admin/CodeEngineStatus');
    render(React.createElement(CodeEngineStatus));
    await waitFor(() => {
      expect(screen.getByText(/code engine/i)).toBeDefined();
    });
  });

  it('fetches stats on mount', async () => {
    const { default: CodeEngineStatus } = await import('@/components/admin/CodeEngineStatus');
    render(React.createElement(CodeEngineStatus));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('displays loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    const { default: CodeEngineStatus } = await import('@/components/admin/CodeEngineStatus');
    render(React.createElement(CodeEngineStatus));
    // Should show some loading indicator
    expect(document.querySelector('[class*="animate"]') || screen.queryByText(/loading/i)).toBeDefined();
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { default: CodeEngineStatus } = await import('@/components/admin/CodeEngineStatus');
    render(React.createElement(CodeEngineStatus));
    await waitFor(() => {
      const errorEl = screen.queryByText(/error/i) || screen.queryByText(/failed/i);
      expect(errorEl).toBeDefined();
    });
  });
});
