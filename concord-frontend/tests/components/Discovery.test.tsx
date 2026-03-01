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

import { Discovery } from '@/components/social/Discovery';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('Discovery', () => {
  const mockTrending = {
    ok: true,
    items: [
      {
        id: 'trend-1',
        title: 'Quantum Computing Breakthroughs',
        category: 'Technology',
        resonance: 0.95,
        engagements: 230,
      },
      {
        id: 'trend-2',
        title: 'Mindfulness and Cognitive Science',
        category: 'Health',
        resonance: 0.88,
        engagements: 180,
      },
    ],
    categories: ['Technology', 'Health', 'Science', 'Creative'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.get.mockResolvedValue({ data: mockTrending });
  });

  it('renders search input', () => {
    render(<Discovery />);
    const searchInput = screen.getByPlaceholderText(/search|discover|explore/i);
    expect(searchInput).toBeDefined();
  });

  it('renders tab switching options', () => {
    render(<Discovery />);
    expect(screen.getByText('Trending')).toBeDefined();
    expect(screen.getByText('Topics')).toBeDefined();
    expect(screen.getByText('People')).toBeDefined();
    expect(screen.getByText('Media')).toBeDefined();
  });

  it('tab switching works', () => {
    render(<Discovery />);

    fireEvent.click(screen.getByText('People'));
    // People tab should become active
    const peopleTab = screen.getByText('People');
    expect(peopleTab.closest('button')?.className || peopleTab.className).toContain('neon');

    fireEvent.click(screen.getByText('Topics'));
    const topicsTab = screen.getByText('Topics');
    expect(topicsTab.closest('button')?.className || topicsTab.className).toContain('neon');
  });

  it('search submits on enter', () => {
    render(<Discovery />);
    const searchInput = screen.getByPlaceholderText(/search|discover|explore/i);

    fireEvent.change(searchInput, { target: { value: 'quantum' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    // API should be called with search query
    expect(mockedApi.get).toHaveBeenCalled();
  });

  it('category filters render', async () => {
    render(<Discovery />);

    await waitFor(() => {
      const categoryTech = screen.queryByText('Technology');
      const categoryHealth = screen.queryByText('Health');
      expect(categoryTech).not.toBeNull();
      expect(categoryHealth).not.toBeNull();
    });
  });

  it('trending items display', async () => {
    render(<Discovery />);

    await waitFor(() => {
      expect(screen.getByText('Quantum Computing Breakthroughs')).toBeDefined();
      expect(screen.getByText('Mindfulness and Cognitive Science')).toBeDefined();
    });
  });

  it('loading skeleton during fetch', () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    render(<Discovery />);

    // Should show loading skeletons or spinner
    const loading = screen.queryByText(/loading/i) ||
      screen.queryByRole('progressbar') ||
      document.querySelector('.animate-pulse');
    expect(loading).not.toBeNull();
  });

  it('empty state display when no results', async () => {
    mockedApi.get.mockResolvedValue({ data: { ok: true, items: [], categories: [] } });

    render(<Discovery />);

    await waitFor(() => {
      const emptyState = screen.queryByText(/no results|nothing found|no trending|empty/i);
      expect(emptyState).not.toBeNull();
    });
  });

  it('clicking category filter updates the results', async () => {
    render(<Discovery />);

    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Technology'));

    // API should be called again with category filter
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(2); // initial + filter
    });
  });

  it('search input updates value', () => {
    render(<Discovery />);
    const searchInput = screen.getByPlaceholderText(/search|discover|explore/i) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: 'neural networks' } });
    expect(searchInput.value).toBe('neural networks');
  });
});
