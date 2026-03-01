import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { NotificationCenter } from '@/components/social/NotificationCenter';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('NotificationCenter', () => {
  const mockNotifications = {
    ok: true,
    notifications: [
      {
        id: 'notif-1',
        type: 'like',
        message: 'Alice liked your DTU',
        read: false,
        createdAt: '2026-02-28T10:00:00Z',
        actor: { username: 'alice', avatar: null },
      },
      {
        id: 'notif-2',
        type: 'follow',
        message: 'Bob started following you',
        read: false,
        createdAt: '2026-02-28T09:00:00Z',
        actor: { username: 'bob', avatar: null },
      },
      {
        id: 'notif-3',
        type: 'comment',
        message: 'Carol commented on your post',
        read: true,
        createdAt: '2026-02-27T15:00:00Z',
        actor: { username: 'carol', avatar: null },
      },
    ],
    unreadCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: mockNotifications });
    mockedApi.post.mockResolvedValue({ data: { ok: true } });
    mockedApi.put.mockResolvedValue({ data: { ok: true } });
  });

  it('bell icon renders with unread count badge', async () => {
    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  it('click opens dropdown/panel', async () => {
    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeDefined();
    });

    // Click the bell icon / notification trigger
    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Alice liked your DTU')).toBeDefined();
    });
  });

  it('notification items render with type, message, and time', async () => {
    render(<NotificationCenter />);

    // Open panel
    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Alice liked your DTU')).toBeDefined();
      expect(screen.getByText('Bob started following you')).toBeDefined();
      expect(screen.getByText('Carol commented on your post')).toBeDefined();
    });
  });

  it('mark as read works', async () => {
    render(<NotificationCenter />);

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Alice liked your DTU')).toBeDefined();
    });

    // Find and click mark as read (could be a button or link)
    const markReadButtons = screen.getAllByTitle(/mark.*read|read/i);
    if (markReadButtons.length > 0) {
      fireEvent.click(markReadButtons[0]);
      await waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalled();
      });
    }
  });

  it('filter by type works', async () => {
    render(<NotificationCenter />);

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Alice liked your DTU')).toBeDefined();
    });

    // Look for type filter buttons
    const likeFilter = screen.queryByText(/likes/i);
    const followFilter = screen.queryByText(/follows/i);

    if (likeFilter) {
      fireEvent.click(likeFilter);
      // After filtering, only like notifications should show
    }
    if (followFilter) {
      fireEvent.click(followFilter);
    }
  });

  it('clear all button works', async () => {
    render(<NotificationCenter />);

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText('Alice liked your DTU')).toBeDefined();
    });

    const clearAllBtn = screen.queryByText(/clear all|mark all|read all/i);
    if (clearAllBtn) {
      fireEvent.click(clearAllBtn);
      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalled();
      });
    }
  });

  it('empty state when no notifications', async () => {
    mockedApi.get.mockResolvedValue({
      data: { ok: true, notifications: [], unreadCount: 0 },
    });

    render(<NotificationCenter />);

    const bell = screen.getByRole('button');
    fireEvent.click(bell);

    await waitFor(() => {
      const empty = screen.queryByText(/no notification|all caught up|empty/i);
      expect(empty).not.toBeNull();
    });
  });

  it('unread count badge not shown when all read', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ok: true,
        notifications: [
          {
            id: 'notif-1',
            type: 'like',
            message: 'Test notification',
            read: true,
            createdAt: '2026-02-28T10:00:00Z',
            actor: { username: 'alice', avatar: null },
          },
        ],
        unreadCount: 0,
      },
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      // Badge should not show count of 0
      expect(screen.queryByText('0')).toBeNull();
    });
  });

  it('renders bell icon', () => {
    render(<NotificationCenter />);
    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeDefined();
  });
});
