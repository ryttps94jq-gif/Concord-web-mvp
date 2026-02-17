/**
 * useSearchFilter — Shared search + status filter hook
 *
 * Eliminates the repeated pattern of searchQuery/statusFilter/filtered
 * memoization found across nearly every lens that renders a list.
 *
 * Usage:
 *   const { filtered, searchQuery, setSearchQuery, statusFilter, setStatusFilter } =
 *     useSearchFilter(items, {
 *       searchFields: ['title', 'data.description'],
 *       statusField: 'meta.status',
 *     });
 */

import { useState, useMemo, useCallback } from 'react';

interface SearchFilterOptions {
  /** Dot-paths into each item to search against (default: ['title']) */
  searchFields?: string[];
  /** Dot-path to the status field (default: 'meta.status') */
  statusField?: string;
  /** Initial status filter (default: 'all') */
  initialStatus?: string;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((curr: unknown, key: string) => {
    if (curr && typeof curr === 'object') return (curr as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function useSearchFilter<T>(
  items: T[],
  options: SearchFilterOptions = {}
) {
  const {
    searchFields = ['title'],
    statusField = 'meta.status',
    initialStatus = 'all',
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const filtered = useMemo(() => {
    let list = items;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        searchFields.some(field => {
          const val = getNestedValue(item, field);
          return typeof val === 'string' && val.toLowerCase().includes(q);
        })
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter(item => {
        const val = getNestedValue(item, statusField);
        return val === statusFilter;
      });
    }

    return list;
  }, [items, searchQuery, statusFilter, searchFields, statusField]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
  }, []);

  return {
    filtered,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    clearFilters,
    isFiltered: searchQuery !== '' || statusFilter !== 'all',
    totalCount: items.length,
    filteredCount: filtered.length,
  };
}
