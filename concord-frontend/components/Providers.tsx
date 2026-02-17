'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PermissionProvider } from '@/components/common/PermissionGate';
import { observeWebVitals } from '@/lib/perf';
import { connectSocket, disconnectSocket } from '@/lib/realtime/socket';
import { api } from '@/lib/api/client';
import { useUIStore } from '@/store/ui';

/**
 * Client-side providers wrapper.
 * Extracted from root layout so layout.tsx can remain a Server Component (FE-002).
 * Initializes Web Vitals observation (FE-018), WebSocket connection, and permission context.
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

  const [userScopes, setUserScopes] = useState<string[]>([]);

  // FE-018: Start performance observation
  useEffect(() => {
    observeWebVitals();
  }, []);

  // Connect WebSocket and fetch user scopes on mount (if authenticated)
  useEffect(() => {
    const entered = localStorage.getItem('concord_entered');
    if (!entered) return;

    // Connect WebSocket with existing session cookie
    connectSocket();

    // Fetch user scopes for PermissionGate
    api.get('/api/auth/me')
      .then((res) => {
        const scopes = res.data?.scopes || res.data?.permissions || [];
        if (Array.isArray(scopes)) setUserScopes(scopes);
      })
      .catch(() => {
        // Not authenticated — middleware will redirect
      });

    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PermissionProvider scopes={userScopes}>
          <AppShell>{children}</AppShell>
        </PermissionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
