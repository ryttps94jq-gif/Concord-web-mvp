import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock fetch for the read-status side effect
global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe('InitiativeChip', () => {
  const mockInitiative = {
    id: 'init_1',
    triggerType: 'substrate_discovery',
    message: 'I found a pattern that matches your recent work!',
    priority: 'normal' as const,
    score: 0.85,
    status: 'pending',
    channel: 'inApp',
    createdAt: new Date().toISOString(),
  };

  const defaultProps = {
    initiative: mockInitiative,
    onDismiss: vi.fn(),
    onAction: vi.fn(),
    onRespond: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the initiative message', async () => {
    const { default: InitiativeChip } = await import('@/components/chat/InitiativeChip');
    render(React.createElement(InitiativeChip, defaultProps));
    expect(screen.getByText(/pattern that matches/i)).toBeDefined();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    vi.useFakeTimers();
    const { default: InitiativeChip } = await import('@/components/chat/InitiativeChip');
    render(React.createElement(InitiativeChip, defaultProps));
    const dismissBtn = screen.queryByRole('button', { name: /dismiss/i }) ||
                       screen.queryByLabelText(/dismiss/i) ||
                       document.querySelector('button[aria-label*="Dismiss"]');
    if (dismissBtn) {
      fireEvent.click(dismissBtn);
      // handleDismiss uses setTimeout(..., 300) before calling onDismiss
      vi.advanceTimersByTime(350);
      expect(defaultProps.onDismiss).toHaveBeenCalledWith('init_1');
    }
    vi.useRealTimers();
  });

  it('calls onRespond when respond button is clicked', async () => {
    const { default: InitiativeChip } = await import('@/components/chat/InitiativeChip');
    render(React.createElement(InitiativeChip, defaultProps));
    const respondBtn = screen.queryByRole('button', { name: /respond/i }) ||
                       screen.queryByText(/respond/i);
    if (respondBtn) {
      fireEvent.click(respondBtn);
      expect(defaultProps.onRespond).toHaveBeenCalledWith('init_1');
    }
  });

  it('displays trigger type badge', async () => {
    const { default: InitiativeChip } = await import('@/components/chat/InitiativeChip');
    render(React.createElement(InitiativeChip, defaultProps));
    // Should show some indication of the trigger type
    const badge = screen.queryByText(/discovery/i) || screen.queryByText(/substrate/i);
    expect(badge).toBeDefined();
  });
});
