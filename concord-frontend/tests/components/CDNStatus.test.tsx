import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock lucide-react icons for jsdom environment
vi.mock('lucide-react', async () => {
  const makeMockIcon = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, any>((props, ref) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ref, ...props })
    );
    Icon.displayName = name;
    return Icon;
  };

  return {
    __esModule: true,
    Globe: makeMockIcon('Globe'),
    Activity: makeMockIcon('Activity'),
    HardDrive: makeMockIcon('HardDrive'),
    RefreshCw: makeMockIcon('RefreshCw'),
    Trash2: makeMockIcon('Trash2'),
    CheckCircle: makeMockIcon('CheckCircle'),
    AlertTriangle: makeMockIcon('AlertTriangle'),
    XCircle: makeMockIcon('XCircle'),
    Search: makeMockIcon('Search'),
    ExternalLink: makeMockIcon('ExternalLink'),
    Wifi: makeMockIcon('Wifi'),
    WifiOff: makeMockIcon('WifiOff'),
    BarChart3: makeMockIcon('BarChart3'),
    Zap: makeMockIcon('Zap'),
  };
});

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock useApi hook
const mockRefetch = vi.fn();
vi.mock('@/hooks/useApi', () => ({
  useApi: vi.fn(() => ({
    data: {
      ok: true,
      health: {
        ok: true,
        provider: 'cloudflare_r2',
        status: 'healthy',
        message: 'CDN is operating normally',
      },
      provider: {
        provider: 'cloudflare_r2',
        description: 'Cloudflare R2 with Workers CDN',
        configured: true,
        baseUrl: 'https://cdn.concord.dev',
        r2Bucket: 'concord-media',
      },
      stats: {
        ok: true,
        provider: 'cloudflare_r2',
        hits: 15432,
        misses: 1230,
        pushes: 890,
        purges: 12,
        errors: 3,
        bytesServed: 52428800000,
        bytesPushed: 10485760000,
        cachedArtifacts: 2847,
        hitRate: '92.62%',
        uptime: 86400,
        startedAt: '2026-02-27T00:00:00Z',
        configured: true,
      },
    },
    loading: false,
    error: null,
    refetch: mockRefetch,
  })),
}));

import { CDNStatus } from '@/components/admin/CDNStatus';
import { api } from '@/lib/api/client';
import { useApi } from '@/hooks/useApi';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('CDNStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.post.mockResolvedValue({ data: { ok: true } });
    mockedApi.get.mockResolvedValue({
      data: { signedUrl: 'https://cdn.concord.dev/signed/abc?token=xyz', expiresAt: '2026-03-01T00:00:00Z' },
    });

    // Mock window.confirm for purge all
    global.confirm = vi.fn(() => true);
  });

  it('shows CDN provider info', () => {
    render(<CDNStatus />);
    expect(screen.getByText('cloudflare_r2')).toBeDefined();
    expect(screen.getByText('Cloudflare R2 with Workers CDN')).toBeDefined();
  });

  it('shows CDN Status heading', () => {
    render(<CDNStatus />);
    expect(screen.getByText('CDN Status')).toBeDefined();
  });

  it('shows healthy status indicator', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Healthy')).toBeDefined();
  });

  it('cache hit rate display', () => {
    render(<CDNStatus />);
    expect(screen.getByText('92.62%')).toBeDefined();
    expect(screen.getByText('Cache Hit Rate')).toBeDefined();
  });

  it('shows bandwidth served', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Bandwidth Served')).toBeDefined();
    expect(screen.getByText(/48\.83 GB|48.83/)).toBeDefined();
  });

  it('shows cached artifacts count', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Cached Artifacts')).toBeDefined();
    expect(screen.getByText('2847')).toBeDefined();
  });

  it('shows error count', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Errors')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('purge controls render', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Purge Controls')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter artifact hash...')).toBeDefined();
    expect(screen.getByText('Purge')).toBeDefined();
    expect(screen.getByText('Purge All Cached Content')).toBeDefined();
  });

  it('purge by hash calls API', async () => {
    render(<CDNStatus />);

    const input = screen.getByPlaceholderText('Enter artifact hash...');
    fireEvent.change(input, { target: { value: 'test-hash-123' } });

    const purgeBtn = screen.getByText('Purge');
    fireEvent.click(purgeBtn);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/api/cdn/purge', {
        artifactHash: 'test-hash-123',
      });
    });
  });

  it('purge all calls API after confirmation', async () => {
    render(<CDNStatus />);

    fireEvent.click(screen.getByText('Purge All Cached Content'));

    await waitFor(() => {
      expect(global.confirm).toHaveBeenCalled();
      expect(mockedApi.post).toHaveBeenCalledWith('/api/cdn/purge-all');
    });
  });

  it('purge all does not call API if cancelled', async () => {
    (global.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);

    render(<CDNStatus />);

    fireEvent.click(screen.getByText('Purge All Cached Content'));

    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('shows purge result message on success', async () => {
    render(<CDNStatus />);

    const input = screen.getByPlaceholderText('Enter artifact hash...');
    fireEvent.change(input, { target: { value: 'test-hash' } });
    fireEvent.click(screen.getByText('Purge'));

    await waitFor(() => {
      expect(screen.getByText(/purged test-hash/i)).toBeDefined();
    });
  });

  it('shows purge error message on failure', async () => {
    mockedApi.post.mockRejectedValue(new Error('Purge failed'));

    render(<CDNStatus />);

    const input = screen.getByPlaceholderText('Enter artifact hash...');
    fireEvent.change(input, { target: { value: 'test-hash' } });
    fireEvent.click(screen.getByText('Purge'));

    await waitFor(() => {
      expect(screen.getByText(/purge failed/i)).toBeDefined();
    });
  });

  it('shows cache metrics section', () => {
    render(<CDNStatus />);
    expect(screen.getByText('Cache Metrics')).toBeDefined();
    expect(screen.getByText('Hits')).toBeDefined();
    expect(screen.getByText('15432')).toBeDefined();
    expect(screen.getByText('Misses')).toBeDefined();
    expect(screen.getByText('1230')).toBeDefined();
    expect(screen.getByText('Pushes')).toBeDefined();
    expect(screen.getByText('890')).toBeDefined();
    expect(screen.getByText('Purges')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('shows provider base URL', () => {
    render(<CDNStatus />);
    expect(screen.getByText('https://cdn.concord.dev')).toBeDefined();
  });

  it('shows uptime', () => {
    render(<CDNStatus />);
    expect(screen.getByText(/24h 0m|24h/)).toBeDefined();
  });

  it('URL preview/test tool renders', () => {
    render(<CDNStatus />);
    expect(screen.getByText('URL Preview / Test')).toBeDefined();
    expect(screen.getByPlaceholderText(/signed url/i)).toBeDefined();
    expect(screen.getByText('Generate')).toBeDefined();
  });

  it('URL test generates signed URL', async () => {
    render(<CDNStatus />);

    const testInput = screen.getByPlaceholderText(/signed url/i);
    fireEvent.change(testInput, { target: { value: 'test-hash-456' } });
    fireEvent.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/cdn/signed-url/test-hash-456')
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/cdn\.concord\.dev\/signed/)).toBeDefined();
    });
  });

  it('refresh button calls refetch', () => {
    render(<CDNStatus />);
    const refreshBtn = screen.getByTitle('Refresh status');
    fireEvent.click(refreshBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const mockedUseApi = vi.mocked(useApi);
    mockedUseApi.mockReturnValueOnce({
      data: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<CDNStatus />);
    expect(screen.getByText('Loading CDN status...')).toBeDefined();
  });

  it('shows error state', () => {
    const mockedUseApi = vi.mocked(useApi);
    mockedUseApi.mockReturnValueOnce({
      data: null,
      loading: false,
      error: new Error('Connection refused'),
      refetch: mockRefetch,
    });

    render(<CDNStatus />);
    expect(screen.getByText('Failed to load CDN status')).toBeDefined();
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('retry button calls refetch on error', () => {
    const mockedUseApi = vi.mocked(useApi);
    mockedUseApi.mockReturnValueOnce({
      data: null,
      loading: false,
      error: new Error('Connection refused'),
      refetch: mockRefetch,
    });

    render(<CDNStatus />);
    fireEvent.click(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('purge button is disabled when input is empty', () => {
    render(<CDNStatus />);
    const purgeBtn = screen.getByText('Purge') as HTMLButtonElement;
    expect(purgeBtn.disabled).toBe(true);
  });

  it('generate button is disabled when test input is empty', () => {
    render(<CDNStatus />);
    const generateBtn = screen.getByText('Generate') as HTMLButtonElement;
    expect(generateBtn.disabled).toBe(true);
  });
});
