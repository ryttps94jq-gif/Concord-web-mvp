/**
 * useMediaUrl — Resolves media artifact URLs through the CDN layer.
 *
 * Returns the best available URL for a media artifact:
 *   1. CDN signed URL if CDN is configured and signing is requested
 *   2. CDN public URL if CDN is configured
 *   3. Direct API origin URL as fallback
 *
 * Handles:
 *   - Automatic signed URL refresh before expiration
 *   - Quality variant selection (original, hd, sd, thumbnail)
 *   - Loading and error states
 *   - Manual refresh trigger
 *
 * @example
 *   const { url, isLoading, error, refresh } = useMediaUrl('abc123', {
 *     signed: true,
 *     quality: 'hd',
 *   });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';

// ── Types ──────────────────────────────────────────────────────────────

interface UseMediaUrlOptions {
  /** Whether to request a signed (time-limited) URL. Default false. */
  signed?: boolean;
  /** Quality variant. Default 'original'. */
  quality?: 'original' | 'hd' | 'sd' | 'thumbnail';
  /** User ID for signed URL generation (if not available from auth context). */
  userId?: string;
  /** Signed URL expiry in seconds. Default 86400 (24h). */
  expiresIn?: number;
  /** Whether fetching is enabled. Default true. */
  enabled?: boolean;
}

interface UseMediaUrlReturn {
  /** The resolved media URL (CDN, signed, or direct API). */
  url: string | null;
  /** Whether the URL is currently being resolved. */
  isLoading: boolean;
  /** Error encountered during URL resolution. */
  error: Error | null;
  /** Manually refresh the URL (useful for expired signed URLs). */
  refresh: () => Promise<void>;
  /** ISO timestamp when the signed URL expires (null if unsigned). */
  expiresAt: string | null;
  /** Whether the URL is served through a CDN. */
  isCDN: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

/** Refresh signed URLs 5 minutes before they expire. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Minimum refresh interval to prevent rapid re-fetching on error. */
const MIN_REFRESH_INTERVAL_MS = 10 * 1000;

// ── CDN info cache (fetched once per session) ──────────────────────────

let cdnInfoCache: {
  provider: string;
  configured: boolean;
  baseUrl: string | null;
} | null = null;

let cdnInfoPromise: Promise<void> | null = null;

async function ensureCDNInfo(): Promise<typeof cdnInfoCache> {
  if (cdnInfoCache) return cdnInfoCache;

  if (!cdnInfoPromise) {
    cdnInfoPromise = (async () => {
      try {
        const resp = await api.get('/api/cdn/info');
        const data = resp.data as {
          cdn?: { provider?: string; configured?: boolean; baseUrl?: string | null };
        };
        cdnInfoCache = {
          provider: data.cdn?.provider || 'local',
          configured: data.cdn?.configured || false,
          baseUrl: data.cdn?.baseUrl || null,
        };
      } catch {
        // CDN info endpoint not available — assume local mode.
        cdnInfoCache = { provider: 'local', configured: false, baseUrl: null };
      }
    })();
  }

  await cdnInfoPromise;
  return cdnInfoCache;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaUrl(
  artifactHash: string,
  options: UseMediaUrlOptions = {}
): UseMediaUrlReturn {
  const {
    signed = false,
    quality = 'original',
    userId,
    expiresIn = 86400,
    enabled = true,
  } = options;

  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCDN, setIsCDN] = useState(false);

  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  /**
   * Build the direct (non-CDN) API URL for the artifact.
   */
  const buildDirectUrl = useCallback((hash: string, q: string): string => {
    const qualitySuffix = q !== 'original' ? `?quality=${q}` : '';
    if (q === 'thumbnail') {
      return `${BASE_URL}/api/media/${hash}/thumbnail`;
    }
    return `${BASE_URL}/api/media/${hash}/stream${qualitySuffix}`;
  }, []);

  /**
   * Resolve the URL — fetches CDN info, optionally gets a signed URL,
   * and falls back to direct API URL.
   */
  const resolve = useCallback(async () => {
    if (!artifactHash || !enabled) {
      setIsLoading(false);
      return;
    }

    // Throttle refresh to prevent rapid re-fetching
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    lastRefreshRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      // Get CDN configuration
      const cdnInfo = await ensureCDNInfo();
      const hasCDN = cdnInfo !== null && cdnInfo.provider !== 'local' && cdnInfo.configured;

      if (!mountedRef.current) return;

      if (signed) {
        // Request a signed URL from the CDN routes
        try {
          const params = new URLSearchParams();
          if (userId) params.set('userId', userId);
          params.set('expires', String(expiresIn));

          const resp = await api.get(
            `/api/cdn/signed-url/${artifactHash}?${params.toString()}`
          );
          const data = resp.data as {
            ok?: boolean;
            signedUrl?: string;
            expiresAt?: string;
          };

          if (!mountedRef.current) return;

          if (data.ok && data.signedUrl) {
            setUrl(data.signedUrl);
            setExpiresAt(data.expiresAt || null);
            setIsCDN(hasCDN);

            // Schedule automatic refresh before expiry
            if (data.expiresAt) {
              scheduleRefresh(data.expiresAt);
            }
          } else {
            // Signed URL not available — fall back to direct
            setUrl(buildDirectUrl(artifactHash, quality));
            setExpiresAt(null);
            setIsCDN(false);
          }
        } catch {
          // Signing endpoint failed — fall back to direct URL
          if (!mountedRef.current) return;
          setUrl(buildDirectUrl(artifactHash, quality));
          setExpiresAt(null);
          setIsCDN(false);
        }
      } else if (hasCDN && cdnInfo?.baseUrl) {
        // Use CDN public URL
        const qualitySuffix = quality !== 'original' ? `/${quality}` : '';
        setUrl(`${cdnInfo.baseUrl}/${artifactHash}${qualitySuffix}`);
        setExpiresAt(null);
        setIsCDN(true);
      } else {
        // Direct API URL
        setUrl(buildDirectUrl(artifactHash, quality));
        setExpiresAt(null);
        setIsCDN(false);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      // Still provide a fallback URL so content can load
      setUrl(buildDirectUrl(artifactHash, quality));
      setIsCDN(false);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [artifactHash, signed, quality, userId, expiresIn, enabled, buildDirectUrl]);

  /**
   * Schedule automatic URL refresh before signed URL expires.
   */
  const scheduleRefresh = useCallback((expiresAtISO: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const expiresMs = new Date(expiresAtISO).getTime();
    const refreshAt = expiresMs - REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();

    if (delay > 0) {
      refreshTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          resolve();
        }
      }, delay);
    }
  }, [resolve]);

  // Resolve on mount and when dependencies change
  useEffect(() => {
    resolve();
  }, [resolve]);

  return {
    url,
    isLoading,
    error,
    refresh: resolve,
    expiresAt,
    isCDN,
  };
}
