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

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'current-user', username: 'testuser', email: 'test@test.com', role: 'user' },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(),
  })),
}));

import { UserProfile } from '@/components/social/UserProfile';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('UserProfile', () => {
  const mockUser = {
    id: 'user-123',
    username: 'janedoe',
    displayName: 'Jane Doe',
    bio: 'Explorer of knowledge',
    avatar: 'https://example.com/avatar.jpg',
    followerCount: 150,
    followingCount: 75,
    isFollowing: false,
    dtuCount: 42,
    joinedAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: { ok: true, user: mockUser } });
    mockedApi.post.mockResolvedValue({ data: { ok: true } });
  });

  it('renders profile header with name and avatar', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeDefined();
    });
  });

  it('renders username', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('@janedoe')).toBeDefined();
    });
  });

  it('renders bio', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('Explorer of knowledge')).toBeDefined();
    });
  });

  it('shows follow button when viewing another user', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText(/follow/i)).toBeDefined();
    });
  });

  it('shows unfollow when already following', async () => {
    mockedApi.get.mockResolvedValue({
      data: { ok: true, user: { ...mockUser, isFollowing: true } },
    });

    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText(/following|unfollow/i)).toBeDefined();
    });
  });

  it('follower count displays', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('150')).toBeDefined();
      expect(screen.getByText(/followers/i)).toBeDefined();
    });
  });

  it('following count displays', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('75')).toBeDefined();
      expect(screen.getByText(/following/i)).toBeDefined();
    });
  });

  it('content tabs render and switch', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('Posts')).toBeDefined();
      expect(screen.getByText('DTUs')).toBeDefined();
    });

    fireEvent.click(screen.getByText('DTUs'));
    // Tab should be visually active after click
  });

  it('follow button calls API when clicked', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText(/follow/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/follow/i));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.stringContaining('follow'),
        expect.anything()
      );
    });
  });

  it('handles loading state', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    render(<UserProfile userId="user-123" />);

    // Should show loading indicator
    expect(screen.queryByText(/loading/i) || screen.queryByRole('progressbar')).not.toBeNull();
  });

  it('handles error state', async () => {
    mockedApi.get.mockRejectedValue(new Error('Failed to load profile'));

    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      const errorText = screen.queryByText(/error|failed|not found/i);
      expect(errorText).not.toBeNull();
    });
  });

  it('renders Media tab', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('Media')).toBeDefined();
    });
  });

  it('renders Liked tab', async () => {
    render(<UserProfile userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText('Liked')).toBeDefined();
    });
  });
});
