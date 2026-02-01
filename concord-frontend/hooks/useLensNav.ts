import { useEffect } from 'react';
import { useUIStore } from '@/store/ui';

/**
 * Hook to register the current lens in the global UI state
 * Call this at the top of each lens page component
 */
export function useLensNav(lensSlug: string) {
  const setActiveLens = useUIStore((state) => state.setActiveLens);

  useEffect(() => {
    setActiveLens(lensSlug);
  }, [lensSlug, setActiveLens]);
}
