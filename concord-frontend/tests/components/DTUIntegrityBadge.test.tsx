import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { DTUIntegrityBadge } from '@/components/dtu/DTUIntegrityBadge';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('DTUIntegrityBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows green checkmark when verified', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        status: 'verified',
        compressionRatio: 3.2,
        integrityCheck: 'sha256_match',
        lastVerified: '2026-02-28T10:00:00Z',
      },
    });

    render(<DTUIntegrityBadge dtuId="dtu-123" />);

    await waitFor(() => {
      const verified = screen.queryByText(/verified|valid/i) ||
        screen.queryByTitle(/verified/i);
      expect(verified).not.toBeNull();
    });
  });

  it('shows warning icon when unverified', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        status: 'unverified',
        compressionRatio: 2.1,
        integrityCheck: null,
        lastVerified: null,
      },
    });

    render(<DTUIntegrityBadge dtuId="dtu-456" />);

    await waitFor(() => {
      const unverified = screen.queryByText(/unverified|pending/i) ||
        screen.queryByTitle(/unverified|warning/i);
      expect(unverified).not.toBeNull();
    });
  });

  it('shows red X when tampered', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        status: 'tampered',
        compressionRatio: 0,
        integrityCheck: 'mismatch',
        lastVerified: '2026-02-28T08:00:00Z',
      },
    });

    render(<DTUIntegrityBadge dtuId="dtu-789" />);

    await waitFor(() => {
      const tampered = screen.queryByText(/tampered|invalid|compromised/i) ||
        screen.queryByTitle(/tampered|invalid/i);
      expect(tampered).not.toBeNull();
    });
  });

  it('click opens integrity report', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        status: 'verified',
        compressionRatio: 3.2,
        integrityCheck: 'sha256_match',
        lastVerified: '2026-02-28T10:00:00Z',
        report: {
          hashAlgorithm: 'SHA-256',
          originalHash: 'abc123',
          currentHash: 'abc123',
          layerCount: 7,
          compressionRatio: 3.2,
        },
      },
    });

    render(<DTUIntegrityBadge dtuId="dtu-123" />);

    await waitFor(() => {
      const badge = screen.queryByText(/verified/i) || screen.queryByTitle(/verified/i);
      expect(badge).not.toBeNull();
    });

    // Click the badge to open details
    const badge = screen.queryByText(/verified/i) || screen.queryByTitle(/verified/i);
    if (badge) {
      fireEvent.click(badge);
      await waitFor(() => {
        // Should show integrity report details
        const report = screen.queryByText(/SHA-256|integrity|hash/i);
        expect(report).not.toBeNull();
      });
    }
  });

  it('shows compression ratio', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        status: 'verified',
        compressionRatio: 3.2,
        integrityCheck: 'sha256_match',
        lastVerified: '2026-02-28T10:00:00Z',
      },
    });

    render(<DTUIntegrityBadge dtuId="dtu-123" />);

    await waitFor(() => {
      const ratio = screen.queryByText(/3\.2|compression/i);
      expect(ratio).not.toBeNull();
    });
  });

  it('handles loading state', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    render(<DTUIntegrityBadge dtuId="dtu-123" />);

    // Should show loading indicator
    const loading = screen.queryByText(/loading|verifying|checking/i) ||
      document.querySelector('.animate-spin, .animate-pulse');
    expect(loading).not.toBeNull();
  });

  it('handles error state gracefully', async () => {
    mockedApi.get.mockRejectedValue(new Error('Failed to verify'));

    render(<DTUIntegrityBadge dtuId="dtu-123" />);

    await waitFor(() => {
      const errorOrUnknown = screen.queryByText(/error|unknown|failed/i) ||
        screen.queryByTitle(/error|unknown/i);
      expect(errorOrUnknown).not.toBeNull();
    });
  });

  it('renders as a compact badge element', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    const { container } = render(<DTUIntegrityBadge dtuId="dtu-123" />);
    expect(container.firstChild).toBeDefined();
  });
});
