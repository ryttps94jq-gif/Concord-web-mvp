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

import { useLensData } from '@/lib/hooks/use-lens-data';
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

describe('useLensData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetching', () => {
    it('fetches lens data for domain+type', async () => {
      const mockResponse = {
        ok: true,
        artifacts: [
          { id: '1', title: 'Item 1', data: {}, meta: { tags: [], status: 'active', visibility: 'public' }, createdAt: '', updatedAt: '', version: 1 },
        ],
        total: 1,
      };
      mockedApi.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useLensData('music', 'track'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.items).toHaveLength(1);
      expect(result.current.total).toBe(1);
      expect(result.current.isError).toBe(false);

      const calledUrl = mockedApi.get.mock.calls[0][0];
      expect(calledUrl).toContain('/api/lens/music');
      expect(calledUrl).toContain('type=track');
    });

    it('passes search, tags, status, limit as query params', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });

      const { result } = renderHook(
        () =>
          useLensData('music', 'track', {
            search: 'jazz',
            tags: ['smooth'],
            status: 'published',
            limit: 50,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const calledUrl = mockedApi.get.mock.calls[0][0];
      expect(calledUrl).toContain('search=jazz');
      expect(calledUrl).toContain('tags=smooth');
      expect(calledUrl).toContain('status=published');
      expect(calledUrl).toContain('limit=50');
    });

    it('returns empty items when loading (before fetch resolves)', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(
        () => useLensData('music', 'track'),
        { wrapper: createWrapper() }
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.isLoading).toBe(true);
    });

    it('respects enabled=false', () => {
      const { result } = renderHook(
        () => useLensData('music', 'track', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(mockedApi.get).not.toHaveBeenCalled();
      expect(result.current.items).toEqual([]);
    });
  });

  describe('auto-seeding', () => {
    it('triggers bulk seed when backend returns empty and seed data is provided', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const seedItems = [
        { title: 'Seed 1', data: { bpm: 120 } },
        { title: 'Seed 2', data: { bpm: 130 } },
      ];

      renderHook(
        () => useLensData('music', 'track', { seed: seedItems }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith(
          '/api/lens/music/bulk',
          { type: 'track', items: seedItems },
          { timeout: 60000 }
        );
      });
    });

    it('does not seed when noSeed=true', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });

      const { result } = renderHook(
        () =>
          useLensData('music', 'track', {
            seed: [{ title: 'Seed 1' }],
            noSeed: true,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // post should not be called for bulk seeding
      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('does not seed when backend has data', async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          ok: true,
          artifacts: [{ id: '1', title: 'Existing' }],
          total: 1,
        },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track', { seed: [{ title: 'Seed' }] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('does not seed when no seed data is provided', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.post).not.toHaveBeenCalled();
    });

    it('handles seed failure gracefully', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });
      mockedApi.post.mockRejectedValue(new Error('Bulk insert failed'));

      renderHook(
        () => useLensData('music', 'track', { seed: [{ title: 'Seed' }] }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalled();
      });

      // Should not throw - error is caught and logged
      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalled();
      });

      errorSpy.mockRestore();
    });
  });

  describe('create mutation', () => {
    it('creates a new item', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });
      mockedApi.post.mockResolvedValue({
        data: { ok: true, artifact: { id: 'new-1' } },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track', { noSeed: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.create({
          title: 'New Song',
          data: { bpm: 120 },
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/lens/music', {
        type: 'track',
        title: 'New Song',
        data: { bpm: 120 },
      });
    });
  });

  describe('update mutation', () => {
    it('updates an existing item', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });
      mockedApi.put.mockResolvedValue({
        data: { ok: true, artifact: { id: 'item-1' } },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track', { noSeed: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.update('item-1', { title: 'Updated Title' });
      });

      expect(mockedApi.put).toHaveBeenCalledWith('/api/lens/music/item-1', {
        title: 'Updated Title',
      });
    });
  });

  describe('delete mutation', () => {
    it('deletes an item', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });
      mockedApi.delete.mockResolvedValue({
        data: { ok: true, deleted: 'item-1' },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track', { noSeed: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.remove('item-1');
      });

      expect(mockedApi.delete).toHaveBeenCalledWith('/api/lens/music/item-1');
    });
  });

  describe('returned interface', () => {
    it('exposes all expected properties and methods', async () => {
      mockedApi.get.mockResolvedValue({
        data: { ok: true, artifacts: [], total: 0 },
      });

      const { result } = renderHook(
        () => useLensData('music', 'track', { noSeed: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('items');
      expect(result.current).toHaveProperty('total');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isError');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isSeeding');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.create).toBe('function');
      expect(typeof result.current.update).toBe('function');
      expect(typeof result.current.remove).toBe('function');
      expect(result.current).toHaveProperty('createMut');
      expect(result.current).toHaveProperty('updateMut');
      expect(result.current).toHaveProperty('deleteMut');
    });
  });
});
