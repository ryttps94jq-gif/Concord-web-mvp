import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchFilter } from '@/lib/hooks/use-search-filter';

interface TestItem {
  title: string;
  data: {
    description: string;
    category: string;
  };
  meta: {
    status: string;
    priority: string;
  };
}

const mockItems: TestItem[] = [
  {
    title: 'Alpha Project',
    data: { description: 'First project about AI', category: 'tech' },
    meta: { status: 'active', priority: 'high' },
  },
  {
    title: 'Beta Release',
    data: { description: 'Second release notes', category: 'docs' },
    meta: { status: 'draft', priority: 'medium' },
  },
  {
    title: 'Gamma Experiment',
    data: { description: 'Testing new features', category: 'tech' },
    meta: { status: 'active', priority: 'low' },
  },
  {
    title: 'Delta Report',
    data: { description: 'Monthly analytics report', category: 'docs' },
    meta: { status: 'archived', priority: 'low' },
  },
];

describe('useSearchFilter', () => {
  describe('initial state', () => {
    it('returns all items with no filters', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      expect(result.current.filtered).toHaveLength(4);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.statusFilter).toBe('all');
      expect(result.current.isFiltered).toBe(false);
      expect(result.current.totalCount).toBe(4);
      expect(result.current.filteredCount).toBe(4);
    });

    it('respects initialStatus option', () => {
      const { result } = renderHook(() =>
        useSearchFilter(mockItems, { initialStatus: 'active' })
      );

      expect(result.current.statusFilter).toBe('active');
      expect(result.current.filtered).toHaveLength(2);
      expect(result.current.isFiltered).toBe(true);
    });
  });

  describe('search filtering', () => {
    it('filters by title (default searchField)', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setSearchQuery('alpha');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Alpha Project');
    });

    it('is case insensitive', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setSearchQuery('BETA');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Beta Release');
    });

    it('filters by custom search fields', () => {
      const { result } = renderHook(() =>
        useSearchFilter(mockItems, {
          searchFields: ['title', 'data.description'],
        })
      );

      act(() => {
        result.current.setSearchQuery('analytics');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Delta Report');
    });

    it('matches across multiple search fields', () => {
      const { result } = renderHook(() =>
        useSearchFilter(mockItems, {
          searchFields: ['title', 'data.description'],
        })
      );

      act(() => {
        result.current.setSearchQuery('AI');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Alpha Project');
    });

    it('returns empty when nothing matches', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setSearchQuery('nonexistent');
      });

      expect(result.current.filtered).toHaveLength(0);
      expect(result.current.filteredCount).toBe(0);
    });

    it('returns all when search query is empty', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setSearchQuery('alpha');
      });
      expect(result.current.filtered).toHaveLength(1);

      act(() => {
        result.current.setSearchQuery('');
      });
      expect(result.current.filtered).toHaveLength(4);
    });
  });

  describe('status filtering', () => {
    it('filters by status using default statusField (meta.status)', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setStatusFilter('active');
      });

      expect(result.current.filtered).toHaveLength(2);
      expect(
        result.current.filtered.every((i) => i.meta.status === 'active')
      ).toBe(true);
    });

    it('filters by custom status field', () => {
      const { result } = renderHook(() =>
        useSearchFilter(mockItems, { statusField: 'meta.priority' })
      );

      act(() => {
        result.current.setStatusFilter('high');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Alpha Project');
    });

    it('returns all when status is "all"', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setStatusFilter('active');
      });
      expect(result.current.filtered).toHaveLength(2);

      act(() => {
        result.current.setStatusFilter('all');
      });
      expect(result.current.filtered).toHaveLength(4);
    });

    it('returns empty when status has no matches', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setStatusFilter('deleted');
      });

      expect(result.current.filtered).toHaveLength(0);
    });
  });

  describe('combined filtering', () => {
    it('applies both search and status filters', () => {
      const { result } = renderHook(() =>
        useSearchFilter(mockItems, {
          searchFields: ['title', 'data.description'],
        })
      );

      act(() => {
        result.current.setSearchQuery('project');
        result.current.setStatusFilter('active');
      });

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].title).toBe('Alpha Project');
    });

    it('correctly reports isFiltered when either filter is active', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      expect(result.current.isFiltered).toBe(false);

      act(() => {
        result.current.setSearchQuery('test');
      });
      expect(result.current.isFiltered).toBe(true);

      act(() => {
        result.current.setSearchQuery('');
      });
      expect(result.current.isFiltered).toBe(false);

      act(() => {
        result.current.setStatusFilter('active');
      });
      expect(result.current.isFiltered).toBe(true);
    });
  });

  describe('clearFilters', () => {
    it('resets both search and status to defaults', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setSearchQuery('alpha');
        result.current.setStatusFilter('active');
      });

      expect(result.current.isFiltered).toBe(true);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.searchQuery).toBe('');
      expect(result.current.statusFilter).toBe('all');
      expect(result.current.filtered).toHaveLength(4);
      expect(result.current.isFiltered).toBe(false);
    });
  });

  describe('counts', () => {
    it('totalCount reflects source array length', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      expect(result.current.totalCount).toBe(4);
    });

    it('filteredCount reflects filtered array length', () => {
      const { result } = renderHook(() => useSearchFilter(mockItems));

      act(() => {
        result.current.setStatusFilter('active');
      });

      expect(result.current.filteredCount).toBe(2);
      expect(result.current.totalCount).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const { result } = renderHook(() => useSearchFilter([]));

      expect(result.current.filtered).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.filteredCount).toBe(0);
    });

    it('handles items with missing nested fields gracefully', () => {
      const items = [
        { title: 'Has nested', data: { description: 'test' }, meta: { status: 'active' } },
        { title: 'Missing nested' },
      ];

      const { result } = renderHook(() =>
        useSearchFilter(items as TestItem[], {
          searchFields: ['data.description'],
        })
      );

      act(() => {
        result.current.setSearchQuery('test');
      });

      expect(result.current.filtered).toHaveLength(1);
    });

    it('handles non-string nested values', () => {
      const items = [
        { title: 'Numeric', data: { count: 42 } },
      ];

      const { result } = renderHook(() =>
        useSearchFilter(items as unknown as TestItem[], {
          searchFields: ['data.count'],
        })
      );

      act(() => {
        result.current.setSearchQuery('42');
      });

      // Non-string values are not matched
      expect(result.current.filtered).toHaveLength(0);
    });
  });
});
