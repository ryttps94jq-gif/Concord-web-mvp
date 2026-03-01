import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    HardDrive: makeMockIcon('HardDrive'),
    Cloud: makeMockIcon('Cloud'),
    CloudOff: makeMockIcon('CloudOff'),
    CheckCircle: makeMockIcon('CheckCircle'),
    AlertTriangle: makeMockIcon('AlertTriangle'),
    XCircle: makeMockIcon('XCircle'),
    Clock: makeMockIcon('Clock'),
    RefreshCw: makeMockIcon('RefreshCw'),
    Play: makeMockIcon('Play'),
    Database: makeMockIcon('Database'),
    Archive: makeMockIcon('Archive'),
    Loader2: makeMockIcon('Loader2'),
  };
});

import { BackupHealth } from '@/components/admin/BackupHealth';

describe('BackupHealth', () => {
  const mockStatus = {
    ok: true,
    healthy: true,
    status: 'healthy',
    schedulerRunning: true,
    schedule: '0 */6 * * *',
    s3Enabled: true,
    backupInProgress: false,
    currentBackupId: null,
    lastBackup: {
      id: 'backup-1',
      type: 'local',
      status: 'completed',
      db_size_bytes: 15000000,
      compressed_size_bytes: 5000000,
      artifacts_size_bytes: 100000000,
      s3_key: null,
      s3_etag: null,
      integrity_check: 'ok',
      duration_ms: 3500,
      error: null,
      started_at: '2026-02-28T06:00:00Z',
      completed_at: '2026-02-28T06:00:03Z',
      metadata: null,
    },
    lastSuccessfulBackup: null,
    age: {
      ms: 7200000,
      hours: 2,
      human: '2 hours ago',
    },
    alertThresholdHours: 12,
    counts: {
      total: 48,
      failed: 1,
      successful: 47,
      local: 48,
      s3: 24,
    },
    localFiles: {
      db: 10,
      artifacts: 5,
      totalSizeBytes: 150000000,
    },
  };

  const mockHistory = {
    ok: true,
    history: [
      {
        id: 'backup-1',
        type: 'local' as const,
        status: 'completed' as const,
        db_size_bytes: 15000000,
        compressed_size_bytes: 5000000,
        artifacts_size_bytes: null,
        s3_key: null,
        s3_etag: null,
        integrity_check: 'ok',
        duration_ms: 3500,
        error: null,
        started_at: '2026-02-28T06:00:00Z',
        completed_at: '2026-02-28T06:00:03Z',
        metadata: null,
      },
      {
        id: 'backup-2',
        type: 's3' as const,
        status: 'failed' as const,
        db_size_bytes: null,
        compressed_size_bytes: null,
        artifacts_size_bytes: null,
        s3_key: null,
        s3_etag: null,
        integrity_check: null,
        duration_ms: 1200,
        error: 'S3 connection timed out',
        started_at: '2026-02-28T00:00:00Z',
        completed_at: null,
        metadata: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatus),
        });
      }
      if (url.includes('/run')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, backupId: 'new-backup' }),
        });
      }
      // History
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders status badge (green for healthy)', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0);
    });
  });

  it('renders warning status badge', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockStatus, status: 'warning', healthy: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      });
    });

    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    });
  });

  it('renders critical status badge', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockStatus, status: 'critical', healthy: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      });
    });

    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
    });
  });

  it('shows last backup time', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('2 hours ago')).toBeDefined();
    });
  });

  it('shows storage metrics', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('10 files')).toBeDefined();
    });
  });

  it('shows S3 status', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText(/24 uploads/)).toBeDefined();
    });
  });

  it('Backup Now button renders', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('Backup Now')).toBeDefined();
    });
  });

  it('Backup Now button triggers API call', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('Backup Now')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Backup Now'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/backups/run'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows loading state initially', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<BackupHealth />);

    expect(screen.getByText('Loading backup status...')).toBeDefined();
  });

  it('shows scheduler status', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('Scheduler active')).toBeDefined();
    });
  });

  it('shows total backup counts', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText(/Total: 48/)).toBeDefined();
      expect(screen.getByText(/Successful: 47/)).toBeDefined();
    });
  });

  it('shows failed count when > 0', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText(/Failed: 1/)).toBeDefined();
    });
  });

  it('shows backup history table', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('Recent Backups')).toBeDefined();
      expect(screen.getByText('completed')).toBeDefined();
      expect(screen.getByText('failed')).toBeDefined();
    });
  });

  it('shows error details for failed backups', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText(/S3 connection timed out/)).toBeDefined();
    });
  });

  it('shows schedule info', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('0 */6 * * *')).toBeDefined();
    });
  });

  it('Backup Health heading renders', async () => {
    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('Backup Health')).toBeDefined();
    });
  });

  it('shows "No backups recorded yet" when history is empty', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatus),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, history: [] }),
      });
    });

    render(<BackupHealth />);

    await waitFor(() => {
      expect(screen.getByText('No backups recorded yet')).toBeDefined();
    });
  });

  it('handles API error gracefully', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server unreachable'));

    render(<BackupHealth />);

    await waitFor(() => {
      // Should show error message
      const errorEl = screen.queryByText(/server unreachable|failed to fetch/i);
      expect(errorEl).not.toBeNull();
    });
  });
});
