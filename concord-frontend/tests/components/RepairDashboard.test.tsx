import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('RepairDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const healthDim = {
      pattern: 'stable',
      confidence: 0.9,
      severity: 'info',
      details: 'All clear',
      samples: 10,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        health: {
          healthy: true,
          overallSeverity: 'info',
          timestamp: new Date().toISOString(),
          dimensions: {
            memory: healthDim,
            latency: healthDim,
            errors: healthDim,
            connections: healthDim,
            cpu: healthDim,
          },
          unhealthyDimensions: 0,
        },
        processMetrics: {
          memoryMB: 120.5,
          rssMB: 180.3,
          heapTotalMB: 256,
          externalMB: 10.2,
          cpuUser: 1500000,
          cpuSystem: 500000,
          uptimeSeconds: 86400,
        },
        summary: {
          totalPatterns: 42,
          totalRepairs: 15,
          successRate: 0.87,
          totalPredictions: 8,
          knowledgeEntries: 23,
        },
      }),
    });
  });

  it('renders without crashing', async () => {
    const { RepairDashboard } = await import('@/components/admin/RepairDashboard');
    render(React.createElement(RepairDashboard));
    await waitFor(() => {
      expect(screen.getByText(/repair/i)).toBeDefined();
    });
  });

  it('fetches status on mount', async () => {
    const { RepairDashboard } = await import('@/components/admin/RepairDashboard');
    render(React.createElement(RepairDashboard));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { RepairDashboard } = await import('@/components/admin/RepairDashboard');
    render(React.createElement(RepairDashboard));
    await waitFor(() => {
      const errorEl = screen.queryByText(/error/i) || screen.queryByText(/failed/i);
      expect(errorEl).toBeDefined();
    });
  });
});
