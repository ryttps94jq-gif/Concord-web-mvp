/**
 * Standard data-fetching hook for all lenses.
 *
 * Wraps the axios API client with loading, error, and auto-refresh support.
 * Provides consistent behavior across all components:
 *   - Loading state during fetch
 *   - Error state with retry
 *   - Optional auto-refresh interval
 *   - Manual refetch trigger
 *   - Conditional fetching via `enabled`
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';

interface UseApiOptions {
  /** Auto-refresh interval in ms. 0 = no refresh. */
  refreshInterval?: number;
  /** Set false to defer fetching until ready. Default true. */
  enabled?: boolean;
  /** HTTP method. Default 'get'. */
  method?: 'get' | 'post';
  /** Request body for POST requests. */
  body?: unknown;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useApi<T = unknown>(
  endpoint: string,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const {
    refreshInterval = 0,
    enabled = true,
    method = 'get',
    body,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const resp = method === 'post'
        ? await api.post(endpoint, body)
        : await api.get(endpoint);
      if (mountedRef.current) {
        setData(resp.data);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, method, body]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetch();

    if (refreshInterval > 0) {
      const timer = setInterval(fetch, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [fetch, enabled, refreshInterval]);

  return { data, loading, error, refetch: fetch };
}
