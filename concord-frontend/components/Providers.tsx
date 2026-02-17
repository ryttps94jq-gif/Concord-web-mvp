'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { AppShell } from '@/components/shell/AppShell';
import { observeWebVitals } from '@/lib/perf';
import { useUIStore } from '@/store/ui';

/**
 * Client-side providers wrapper.
 * Extracted from root layout so layout.tsx can remain a Server Component (FE-002).
 * Initializes Web Vitals observation (FE-018).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Note: Query error toasts are handled by the axios interceptor in lib/api/client.ts.
        // Do NOT add duplicate toasts via QueryCache.onError — that causes an error storm on page load.
        mutationCache: new MutationCache({
          onError: (error) => {
            // Only toast for mutations (user-initiated actions), not queries (background fetches)
            useUIStore.getState().addToast({
              type: 'error',
              message: `Operation failed: ${error.message}`,
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // FE-018: Start performance observation
  useEffect(() => {
    observeWebVitals();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>{children}</AppShell>
    </QueryClientProvider>
  );
}
