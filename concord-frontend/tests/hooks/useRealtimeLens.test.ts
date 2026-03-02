import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock socket with event listeners
const socketListeners: Record<string, Array<(...args: unknown[]) => void>> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!socketListeners[event]) socketListeners[event] = [];
    socketListeners[event].push(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (socketListeners[event]) {
      socketListeners[event] = socketListeners[event].filter((h) => h !== handler);
    }
  }),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock('@/hooks/useSocket', () => ({
  useSocket: vi.fn(() => ({
    socket: mockSocket,
    isConnected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

import { useRealtimeLens } from '@/hooks/useRealtimeLens';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function emitSocketEvent(event: string, data: unknown) {
  if (socketListeners[event]) {
    socketListeners[event].forEach((handler) => handler(data));
  }
}

describe('useRealtimeLens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all listeners
    Object.keys(socketListeners).forEach((key) => {
      delete socketListeners[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns null latestData initially', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(result.current.latestData).toBeNull();
    });

    it('returns empty alerts initially', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(result.current.alerts).toEqual([]);
    });

    it('returns empty insights initially', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(result.current.insights).toEqual([]);
    });

    it('returns isLive based on socket connection', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLive).toBe(true);
    });

    it('returns null lastUpdated initially', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe('domain event mapping', () => {
    it('subscribes to known domain events for finance', () => {
      renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      // Finance should subscribe to finance:ticker, finance:market_update, finance:alert
      expect(mockSocket.on).toHaveBeenCalledWith('finance:ticker', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('finance:market_update', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('finance:alert', expect.any(Function));
    });

    it('subscribes to fallback domain:update for unknown domains', () => {
      renderHook(() => useRealtimeLens('custom-domain'), {
        wrapper: createWrapper(),
      });

      expect(mockSocket.on).toHaveBeenCalledWith('custom-domain:update', expect.any(Function));
    });

    it('subscribes to agent:insights', () => {
      renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(mockSocket.on).toHaveBeenCalledWith('agent:insights', expect.any(Function));
    });

    it('subscribes to domain-specific insight events', () => {
      renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      expect(mockSocket.on).toHaveBeenCalledWith('finance:insight', expect.any(Function));
    });
  });

  describe('data updates', () => {
    it('updates latestData when a domain event fires', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:ticker', {
          symbol: 'AAPL',
          price: 150.25,
          fetchedAt: '2026-01-01T00:00:00Z',
        });
      });

      expect(result.current.latestData).toEqual(
        expect.objectContaining({ symbol: 'AAPL', price: 150.25 })
      );
    });

    it('updates lastUpdated when data arrives', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:ticker', {
          fetchedAt: '2026-01-01T12:00:00Z',
        });
      });

      expect(result.current.lastUpdated).toBe('2026-01-01T12:00:00Z');
    });

    it('uses current time when fetchedAt is not provided', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:ticker', { data: 'test' });
      });

      expect(result.current.lastUpdated).toBeTruthy();
    });
  });

  describe('alerts', () => {
    it('captures alerts from alert-type events', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:alert', {
          message: 'Market crash detected',
          severity: 'critical',
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].message).toBe('Market crash detected');
      expect(result.current.alerts[0].severity).toBe('critical');
      expect(result.current.alerts[0].id).toMatch(/^alert-/);
    });

    it('caps alerts at 20', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      for (let i = 0; i < 25; i++) {
        act(() => {
          emitSocketEvent('finance:alert', {
            message: `Alert ${i}`,
            severity: 'info',
          });
        });
      }

      expect(result.current.alerts.length).toBeLessThanOrEqual(20);
    });
  });

  describe('clearAlerts', () => {
    it('clears all alerts', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:alert', { message: 'Test', severity: 'info' });
      });

      expect(result.current.alerts).toHaveLength(1);

      act(() => {
        result.current.clearAlerts();
      });

      expect(result.current.alerts).toEqual([]);
    });
  });

  describe('insights', () => {
    it('captures insights from agent:insights for matching domain', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('agent:insights', {
          domain: 'finance',
          insight: 'Bull market detected',
          confidence: 0.85,
          timestamp: '2026-01-01T00:00:00Z',
        });
      });

      expect(result.current.insights).toHaveLength(1);
      expect(result.current.insights[0].insight).toBe('Bull market detected');
      expect(result.current.insights[0].confidence).toBe(0.85);
    });

    it('ignores insights from agent:insights for non-matching domain', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('agent:insights', {
          domain: 'healthcare',
          insight: 'Health trend',
          confidence: 0.9,
          timestamp: '2026-01-01T00:00:00Z',
        });
      });

      expect(result.current.insights).toHaveLength(0);
    });

    it('captures domain-specific insights', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      act(() => {
        emitSocketEvent('finance:insight', {
          insight: 'Sector rotation underway',
          confidence: 0.78,
          timestamp: '2026-01-01T00:00:00Z',
        });
      });

      expect(result.current.insights).toHaveLength(1);
      expect(result.current.insights[0].domain).toBe('finance');
    });

    it('caps insights at 10', () => {
      const { result } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      for (let i = 0; i < 15; i++) {
        act(() => {
          emitSocketEvent('agent:insights', {
            domain: 'finance',
            insight: `Insight ${i}`,
            confidence: 0.5,
            timestamp: '2026-01-01T00:00:00Z',
          });
        });
      }

      expect(result.current.insights.length).toBeLessThanOrEqual(10);
    });
  });

  describe('cleanup on unmount', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeLens('finance'), {
        wrapper: createWrapper(),
      });

      unmount();

      // Should have called off for each registered handler
      expect(mockSocket.off).toHaveBeenCalled();
    });
  });
});
