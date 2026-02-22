import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  useArtifacts,
  useArtifactsByType,
  useArtifact,
  useCreateArtifact,
  useUpdateArtifact,
  useDeleteArtifact,
  useRunArtifact,
  useExportArtifact,
  useBulkCreateArtifacts,
} from '@/lib/hooks/use-lens-artifacts';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
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

describe('useArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches artifacts for a domain', async () => {
    const mockResponse = {
      ok: true,
      artifacts: [{ id: '1', domain: 'music', type: 'track', title: 'Song' }],
      total: 1,
      domain: 'music',
    };
    mockedApi.get.mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useArtifacts('music'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockedApi.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/lens/music')
    );
  });

  it('passes type, search, tags, status, limit, offset as query params', async () => {
    mockedApi.get.mockResolvedValue({ data: { ok: true, artifacts: [], total: 0 } });

    const { result } = renderHook(
      () =>
        useArtifacts('music', {
          type: 'track',
          search: 'jazz',
          tags: ['smooth', 'classic'],
          status: 'published',
          limit: 50,
          offset: 10,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = mockedApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('type=track');
    expect(calledUrl).toContain('search=jazz');
    expect(calledUrl).toContain('tags=smooth%2Cclassic');
    expect(calledUrl).toContain('status=published');
    expect(calledUrl).toContain('limit=50');
    expect(calledUrl).toContain('offset=10');
  });

  it('respects enabled=false', () => {
    const { result } = renderHook(
      () => useArtifacts('music', { enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useArtifactsByType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a convenience wrapper that passes type option', async () => {
    mockedApi.get.mockResolvedValue({
      data: { ok: true, artifacts: [], total: 0 },
    });

    const { result } = renderHook(
      () => useArtifactsByType('music', 'track'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const calledUrl = mockedApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('type=track');
  });
});

describe('useArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a single artifact by id', async () => {
    const mockArtifact = { id: 'abc', domain: 'music', title: 'My Song' };
    mockedApi.get.mockResolvedValue({
      data: { ok: true, artifact: mockArtifact },
    });

    const { result } = renderHook(() => useArtifact('music', 'abc'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedApi.get).toHaveBeenCalledWith('/api/lens/music/abc');
    expect(result.current.data?.artifact).toEqual(mockArtifact);
  });

  it('does not fetch when id is null', () => {
    renderHook(() => useArtifact('music', null), {
      wrapper: createWrapper(),
    });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('does not fetch when id is undefined', () => {
    renderHook(() => useArtifact('music', undefined), {
      wrapper: createWrapper(),
    });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });
});

describe('useCreateArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts to the correct endpoint', async () => {
    const mockResponse = {
      ok: true,
      artifact: { id: 'new-1', domain: 'music', title: 'New Track' },
    };
    mockedApi.post.mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useCreateArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        type: 'track',
        title: 'New Track',
        data: { bpm: 120 },
      });
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/api/lens/music', {
      type: 'track',
      title: 'New Track',
      data: { bpm: 120 },
    });
  });
});

describe('useUpdateArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('puts to the correct endpoint', async () => {
    mockedApi.put.mockResolvedValue({
      data: { ok: true, artifact: { id: 'abc' } },
    });

    const { result } = renderHook(() => useUpdateArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'abc',
        title: 'Updated Title',
        data: { bpm: 140 },
      });
    });

    expect(mockedApi.put).toHaveBeenCalledWith('/api/lens/music/abc', {
      title: 'Updated Title',
      data: { bpm: 140 },
    });
  });
});

describe('useDeleteArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes at the correct endpoint', async () => {
    mockedApi.delete.mockResolvedValue({
      data: { ok: true, deleted: 'abc' },
    });

    const { result } = renderHook(() => useDeleteArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('abc');
    });

    expect(mockedApi.delete).toHaveBeenCalledWith('/api/lens/music/abc');
  });
});

describe('useRunArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts run action to correct endpoint', async () => {
    mockedApi.post.mockResolvedValue({
      data: { ok: true, result: 'processed' },
    });

    const { result } = renderHook(() => useRunArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'abc',
        action: 'process',
        params: { quality: 'high' },
      });
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/api/lens/music/abc/run', {
      action: 'process',
      params: { quality: 'high' },
    });
  });
});

describe('useExportArtifact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports with default json format', async () => {
    mockedApi.get.mockResolvedValue({
      data: { ok: true, format: 'json', data: {} },
    });

    const { result } = renderHook(() => useExportArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'abc' });
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/lens/music/abc/export?format=json'
    );
  });

  it('exports with specified format', async () => {
    mockedApi.get.mockResolvedValue({
      data: { ok: true, format: 'csv', data: '' },
    });

    const { result } = renderHook(() => useExportArtifact('music'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'abc', format: 'csv' });
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/lens/music/abc/export?format=csv'
    );
  });
});

describe('useBulkCreateArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts bulk create to correct endpoint', async () => {
    mockedApi.post.mockResolvedValue({
      data: { ok: true, artifacts: [], count: 3 },
    });

    const { result } = renderHook(() => useBulkCreateArtifacts('music'), {
      wrapper: createWrapper(),
    });

    const items = [
      { title: 'Track 1', data: { bpm: 120 } },
      { title: 'Track 2', data: { bpm: 130 } },
      { title: 'Track 3', data: { bpm: 140 } },
    ];

    await act(async () => {
      await result.current.mutateAsync({ type: 'track', items });
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/api/lens/music/bulk', {
      type: 'track',
      items,
    });
  });
});
