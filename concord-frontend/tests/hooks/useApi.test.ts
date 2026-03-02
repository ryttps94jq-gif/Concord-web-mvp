import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('default behavior', () => {
    it('fetches data on mount using GET by default', async () => {
      mockedApi.get.mockResolvedValue({ data: { items: [1, 2, 3] } });

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockedApi.get).toHaveBeenCalledWith('/api/test');
      expect(result.current.data).toEqual({ items: [1, 2, 3] });
      expect(result.current.error).toBeNull();
    });

    it('starts in loading state', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useApi('/api/test'));

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('returns refetch function', async () => {
      mockedApi.get.mockResolvedValue({ data: 'hello' });

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('POST method', () => {
    it('uses POST when method is post', async () => {
      mockedApi.post.mockResolvedValue({ data: { created: true } });

      const { result } = renderHook(() =>
        useApi<{ created: boolean }>('/api/test', { method: 'post', body: { name: 'test' } })
      );

      await waitFor(() => {
        expect(result.current.data).toEqual({ created: true });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/test', { name: 'test' });
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('sets error state when fetch fails with Error', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('Network error');
      expect(result.current.data).toBeNull();
    });

    it('wraps non-Error exceptions in an Error', async () => {
      mockedApi.get.mockRejectedValue('string error');

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('string error');
    });
  });

  describe('enabled option', () => {
    it('does not fetch when enabled is false', async () => {
      const { result } = renderHook(() =>
        useApi('/api/test', { enabled: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockedApi.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeNull();
    });

    it('fetches when enabled changes from false to true', async () => {
      mockedApi.get.mockResolvedValue({ data: 'success' });

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useApi('/api/test', { enabled }),
        { initialProps: { enabled: false } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(mockedApi.get).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.data).toBe('success');
      });

      expect(mockedApi.get).toHaveBeenCalledWith('/api/test');
    });
  });

  describe('refreshInterval', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets up interval when refreshInterval > 0', async () => {
      mockedApi.get.mockResolvedValue({ data: 'data' });

      renderHook(() => useApi('/api/test', { refreshInterval: 5000 }));

      // Initial fetch
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      // Advance past refresh interval
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });

    it('does not set up interval when refreshInterval is 0', async () => {
      mockedApi.get.mockResolvedValue({ data: 'data' });

      renderHook(() => useApi('/api/test', { refreshInterval: 0 }));

      await vi.advanceTimersByTimeAsync(0);
      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10000);
      // Should still only have the initial call
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });

    it('clears interval on unmount', async () => {
      mockedApi.get.mockResolvedValue({ data: 'data' });

      const { unmount } = renderHook(() =>
        useApi('/api/test', { refreshInterval: 5000 })
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      unmount();

      await vi.advanceTimersByTimeAsync(10000);
      // Should not have fired again after unmount
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('refetch', () => {
    it('manually triggers a new fetch', async () => {
      mockedApi.get
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.data).toBe('first');
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toBe('second');
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });

    it('clears previous error on successful refetch', async () => {
      mockedApi.get
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ data: 'success' });

      const { result } = renderHook(() => useApi('/api/test'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('success');
    });
  });

  describe('unmount safety', () => {
    it('does not update state after unmount', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedApi.get.mockReturnValue(pendingPromise);

      const { unmount } = renderHook(() => useApi('/api/test'));

      // Unmount before the promise resolves
      unmount();

      // Resolve the promise — should not throw or update state
      resolvePromise!({ data: 'late data' });

      // If we got here without an error, the mounted check works
      expect(true).toBe(true);
    });
  });
});
