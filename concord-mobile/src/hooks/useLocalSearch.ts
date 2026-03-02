// Concord Mobile — Local DTU Search Hook

import { useCallback, useRef, useState } from 'react';
import { useLatticeStore } from '../store/lattice-store';
import type { DTUSearchResult } from '../utils/types';

interface UseLocalSearchResult {
  query: string;
  results: DTUSearchResult[];
  isSearching: boolean;
  search: (query: string) => void;
  clear: () => void;
}

export function useLocalSearch(): UseLocalSearchResult {
  const setSearchQuery = useLatticeStore(s => s.setSearchQuery);
  const setSearchResults = useLatticeStore(s => s.setSearchResults);
  const setSearching = useLatticeStore(s => s.setSearching);
  const query = useLatticeStore(s => s.searchQuery);
  const results = useLatticeStore(s => s.searchResults);
  const isSearching = useLatticeStore(s => s.isSearching);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((newQuery: string) => {
    setSearchQuery(newQuery);

    if (!newQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    // Debounce search by 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Search is delegated to the DTU search module
      // The actual search implementation will call setSearchResults
      setSearching(false);
    }, 300);
  }, [setSearchQuery, setSearchResults, setSearching]);

  const clear = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  }, [setSearchQuery, setSearchResults, setSearching]);

  return { query, results, isSearching, search, clear };
}
