import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the socket hook
vi.mock('@/hooks/useSocket', () => ({
  useResonanceSocket: vi.fn(() => ({
    resonanceData: null,
    isConnected: false,
  })),
}));

// Mock the lattice store
const mockSetResonance = vi.fn();
const mockResonance = {
  overall: 0.75,
  coherence: 0.8,
  stability: 0.7,
  homeostasis: 0.85,
  bioAge: 0.9,
  continuity: 0.65,
};

vi.mock('@/store/lattice', () => ({
  useLatticeStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setResonance: mockSetResonance,
      resonance: mockResonance,
    })
  ),
}));

import { useResonance, useResonanceStatus } from '@/hooks/useResonance';
import { useResonanceSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};
const mockedUseResonanceSocket = vi.mocked(useResonanceSocket);

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

describe('useResonance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseResonanceSocket.mockReturnValue({
      resonanceData: null,
      isConnected: false,
    });
  });

  it('returns initial state while loading', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.resonance).toEqual(mockResonance);
    expect(result.current.dtuCounts).toBeUndefined();
    expect(result.current.isRealtime).toBe(false);
    expect(typeof result.current.refetch).toBe('function');
  });

  it('fetches resonance data from API', async () => {
    const mockData = {
      overall: 0.92,
      coherence: 0.88,
      stability: 0.85,
      homeostasis: 0.90,
      bioAge: 0.95,
      continuity: 0.80,
      dtuCounts: { regular: 100, mega: 10, hyper: 5, shadow: 2 },
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    mockedApi.get.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedApi.get).toHaveBeenCalledWith('/api/lattice/resonance');
    expect(result.current.dtuCounts).toEqual({
      regular: 100,
      mega: 10,
      hyper: 5,
      shadow: 2,
    });
  });

  it('calls setResonance when data is fetched', async () => {
    const mockData = {
      overall: 0.92,
      coherence: 0.88,
      stability: 0.85,
      homeostasis: 0.90,
      bioAge: 0.95,
      continuity: 0.80,
      dtuCounts: { regular: 100, mega: 10, hyper: 5, shadow: 2 },
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    mockedApi.get.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSetResonance).toHaveBeenCalledWith({
      overall: 0.92,
      coherence: 0.88,
      stability: 0.85,
      homeostasis: 0.90,
      bioAge: 0.95,
      continuity: 0.80,
    });
  });

  it('returns error when API fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it('reports isRealtime from socket connection', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        overall: 0.8,
        coherence: 0.8,
        stability: 0.8,
        homeostasis: 0.8,
        bioAge: 0.8,
        continuity: 0.8,
        dtuCounts: { regular: 0, mega: 0, hyper: 0, shadow: 0 },
        lastUpdated: '',
      },
    });

    mockedUseResonanceSocket.mockReturnValue({
      resonanceData: null,
      isConnected: true,
    });

    const { result } = renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRealtime).toBe(true);
  });

  it('calls setResonance when socket data arrives', async () => {
    const socketData = {
      overall: 0.99,
      coherence: 0.98,
      stability: 0.97,
      homeostasis: 0.96,
      bioAge: 0.95,
      continuity: 0.94,
      dtuCounts: { regular: 50, mega: 5, hyper: 3, shadow: 1 },
      lastUpdated: '2026-02-01T00:00:00Z',
    };

    mockedApi.get.mockReturnValue(new Promise(() => {}));
    mockedUseResonanceSocket.mockReturnValue({
      resonanceData: socketData,
      isConnected: true,
    });

    renderHook(() => useResonance(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockSetResonance).toHaveBeenCalledWith({
        overall: 0.99,
        coherence: 0.98,
        stability: 0.97,
        homeostasis: 0.96,
        bioAge: 0.95,
        continuity: 0.94,
      });
    });
  });
});

describe('useResonanceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns optimal for values >= 0.8', () => {
    mockResonance.overall = 0.9;
    mockResonance.coherence = 0.8;
    mockResonance.stability = 0.85;
    mockResonance.homeostasis = 1.0;
    mockResonance.bioAge = 0.95;
    mockResonance.continuity = 0.82;

    const { result } = renderHook(() => useResonanceStatus());

    expect(result.current.overall.status).toBe('optimal');
    expect(result.current.coherence.status).toBe('optimal');
    expect(result.current.stability.status).toBe('optimal');
    expect(result.current.homeostasis.status).toBe('optimal');
    expect(result.current.bioAge.status).toBe('optimal');
    expect(result.current.continuity.status).toBe('optimal');
  });

  it('returns good for values >= 0.6 and < 0.8', () => {
    mockResonance.overall = 0.6;
    mockResonance.coherence = 0.7;
    mockResonance.stability = 0.79;
    mockResonance.homeostasis = 0.65;
    mockResonance.bioAge = 0.75;
    mockResonance.continuity = 0.6;

    const { result } = renderHook(() => useResonanceStatus());

    expect(result.current.overall.status).toBe('good');
    expect(result.current.coherence.status).toBe('good');
    expect(result.current.stability.status).toBe('good');
    expect(result.current.homeostasis.status).toBe('good');
    expect(result.current.bioAge.status).toBe('good');
    expect(result.current.continuity.status).toBe('good');
  });

  it('returns warning for values >= 0.4 and < 0.6', () => {
    mockResonance.overall = 0.4;
    mockResonance.coherence = 0.5;

    const { result } = renderHook(() => useResonanceStatus());

    expect(result.current.overall.status).toBe('warning');
    expect(result.current.coherence.status).toBe('warning');
  });

  it('returns critical for values < 0.4', () => {
    mockResonance.overall = 0.39;
    mockResonance.coherence = 0.0;
    mockResonance.stability = 0.1;

    const { result } = renderHook(() => useResonanceStatus());

    expect(result.current.overall.status).toBe('critical');
    expect(result.current.coherence.status).toBe('critical');
    expect(result.current.stability.status).toBe('critical');
  });

  it('returns value alongside status', () => {
    mockResonance.overall = 0.75;

    const { result } = renderHook(() => useResonanceStatus());

    expect(result.current.overall.value).toBe(0.75);
    expect(result.current.overall.status).toBe('good');
  });
});
