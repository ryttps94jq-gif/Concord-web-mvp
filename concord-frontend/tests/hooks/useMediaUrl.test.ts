import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { useMediaUrl } from '@/hooks/useMediaUrl';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe('useMediaUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset CDN info cache by reloading the module
    // Default: CDN not configured, so it falls back to direct URL
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/cdn/info')) {
        return Promise.resolve({
          data: { cdn: { provider: 'local', configured: false, baseUrl: null } },
        });
      }
      if (url.includes('/api/cdn/signed-url/')) {
        return Promise.resolve({
          data: {
            ok: true,
            signedUrl: 'https://cdn.example.com/signed/abc123?token=xyz',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns direct API URL when CDN is not configured', async () => {
    const { result } = renderHook(() => useMediaUrl('abc123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('/api/media/abc123/stream');
    expect(result.current.isCDN).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns CDN URL when CDN is configured', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/cdn/info')) {
        return Promise.resolve({
          data: {
            cdn: {
              provider: 'cloudflare',
              configured: true,
              baseUrl: 'https://cdn.example.com',
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { result } = renderHook(() => useMediaUrl('abc123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('cdn.example.com');
    expect(result.current.url).toContain('abc123');
    expect(result.current.isCDN).toBe(true);
  });

  it('handles signed URL refresh', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/cdn/info')) {
        return Promise.resolve({
          data: { cdn: { provider: 'local', configured: false, baseUrl: null } },
        });
      }
      if (url.includes('/api/cdn/signed-url/')) {
        return Promise.resolve({
          data: {
            ok: true,
            signedUrl: 'https://cdn.example.com/signed/abc123?token=xyz',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { result } = renderHook(() =>
      useMediaUrl('abc123', { signed: true })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('signed');
    expect(result.current.expiresAt).not.toBeNull();
  });

  it('loading state during resolution', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMediaUrl('abc123'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.url).toBeNull();
  });

  it('error state when resolution fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('CDN error'));

    const { result } = renderHook(() => useMediaUrl('abc123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to direct URL even on error
    expect(result.current.url).toContain('/api/media/abc123/stream');
    expect(result.current.error).not.toBeNull();
  });

  it('handles empty artifactHash', async () => {
    const { result } = renderHook(() => useMediaUrl(''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toBeNull();
  });

  it('disabled option prevents fetching', async () => {
    const { result } = renderHook(() =>
      useMediaUrl('abc123', { enabled: false })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('quality variant is included in URL', async () => {
    const { result } = renderHook(() =>
      useMediaUrl('abc123', { quality: 'hd' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('quality=hd');
  });

  it('thumbnail quality builds thumbnail URL', async () => {
    const { result } = renderHook(() =>
      useMediaUrl('abc123', { quality: 'thumbnail' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('/api/media/abc123/thumbnail');
  });

  it('original quality does not add query param', async () => {
    const { result } = renderHook(() =>
      useMediaUrl('abc123', { quality: 'original' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('/api/media/abc123/stream');
    expect(result.current.url).not.toContain('quality=');
  });

  it('provides refresh function', async () => {
    const { result } = renderHook(() => useMediaUrl('abc123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refresh).toBe('function');
  });

  it('signed URL falls back to direct on signing failure', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/cdn/info')) {
        return Promise.resolve({
          data: { cdn: { provider: 'local', configured: false, baseUrl: null } },
        });
      }
      if (url.includes('/api/cdn/signed-url/')) {
        return Promise.reject(new Error('Signing failed'));
      }
      return Promise.resolve({ data: {} });
    });

    const { result } = renderHook(() =>
      useMediaUrl('abc123', { signed: true })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should fall back to direct URL
    expect(result.current.url).toContain('/api/media/abc123/stream');
    expect(result.current.isCDN).toBe(false);
  });

  it('CDN URL includes quality variant', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/cdn/info')) {
        return Promise.resolve({
          data: {
            cdn: {
              provider: 'cloudflare',
              configured: true,
              baseUrl: 'https://cdn.example.com',
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { result } = renderHook(() =>
      useMediaUrl('abc123', { quality: 'sd' })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toContain('cdn.example.com/abc123/sd');
  });
});
