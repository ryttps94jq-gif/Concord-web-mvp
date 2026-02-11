'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
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
        queryCache: new QueryCache({
          onError: (error) => {
            useUIStore.getState().addToast({
              type: 'error',
              message: `Failed to load data: ${error.message}`,
            });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
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
