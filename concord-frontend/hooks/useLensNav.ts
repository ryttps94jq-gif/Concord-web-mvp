import { useEffect } from 'react';
import { useUIStore } from '@/store/ui';
import { getLensById } from '@/lib/lens-registry';

/**
 * Hook to register the current lens in the global UI state.
 * Call this at the top of each lens page component.
 *
 * Validates the lens slug against the registry. If not found,
 * still sets the activeLens for custom/dynamic lenses.
 */
export function useLensNav(lensSlug: string) {
  const setActiveLens = useUIStore((state) => state.setActiveLens);

  useEffect(() => {
    const lens = getLensById(lensSlug);
    if (!lens && process.env.NODE_ENV === 'development') {
      console.warn(`[useLensNav] Lens "${lensSlug}" not found in LENS_REGISTRY`);
    }
    setActiveLens(lensSlug);
  }, [lensSlug, setActiveLens]);
}
