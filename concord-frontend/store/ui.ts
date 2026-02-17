/**
 * FE-009: UI State Store — Zustand (client-only, ephemeral + persisted subset).
 *
 * STATE OWNERSHIP BOUNDARIES:
 * ┌──────────────────────────────────────────────────────┐
 * │ Zustand (this store)                                 │
 * │  - UI chrome state (sidebar, palette, theme)         │
 * │  - Ephemeral: toasts, fullPageMode                   │
 * │  - Persisted to localStorage: sidebarCollapsed,      │
 * │    theme, activeLens                                 │
 * ├──────────────────────────────────────────────────────┤
 * │ React Query (TanStack Query)                         │
 * │  - Server data (DTUs, status, resonance, etc.)       │
 * │  - Cached with staleTime / refetchInterval           │
 * │  - Source of truth = backend API                     │
 * ├──────────────────────────────────────────────────────┤
 * │ Dexie / IndexedDB (lib/offline/db.ts)                │
 * │  - Offline persistence of DTUs and chat              │
 * │  - Pending sync queue                                │
 * │  - Source of truth = local when offline, server when  │
 * │    online (sync on reconnect)                        │
 * └──────────────────────────────────────────────────────┘
 *
 * RULE: Never duplicate server data in Zustand.
 * Use React Query for anything that comes from the API.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // Current lens
  activeLens: string;

  // Theme
  theme: 'dark' | 'light';

  // Full page mode (hides shell chrome)
  fullPageMode: boolean;

  // Toast notifications
  toasts: Toast[];

  // Operator-facing request failures
  requestErrors: RequestError[];

  // Active backend auth posture
  authPosture: AuthPosture;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveLens: (lens: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setFullPageMode: (mode: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  addRequestError: (error: Omit<RequestError, 'id' | 'at'>) => void;
  clearRequestErrors: () => void;
  setAuthPosture: (authPosture: Partial<AuthPosture>) => void;
}


interface RequestError {
  id: string;
  at: string;
  path?: string;
  method?: string;
  status?: number;
  code?: string;
  requestId?: string;
  message: string;
  reason?: string;
}

interface AuthPosture {
  mode: 'public' | 'apikey' | 'jwt' | 'hybrid' | 'unknown';
  usesJwt: boolean;
  usesApiKey: boolean;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      activeLens: 'chat',
      theme: 'dark',
      fullPageMode: false,
      toasts: [],
      requestErrors: [],
      authPosture: { mode: 'unknown', usesJwt: false, usesApiKey: false },

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      setActiveLens: (lens) => set({ activeLens: lens }),

      setTheme: (theme) => set({ theme }),

      setFullPageMode: (mode) => set({ fullPageMode: mode }),

      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
          ],
        })),

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      addRequestError: (error) =>
        set((state) => {
          // Deduplicate: skip if same path+status already exists within last 10 seconds
          const now = Date.now();
          const isDuplicate = state.requestErrors.some(
            (e) =>
              e.path === error.path &&
              e.status === error.status &&
              now - new Date(e.at).getTime() < 10_000
          );
          if (isDuplicate) return state;

          return {
            requestErrors: [
              ...state.requestErrors.slice(-19),
              {
                ...error,
                id: `reqerr-${now}-${Math.random().toString(36).slice(2, 9)}`,
                at: new Date().toISOString(),
              },
            ],
          };
        }),

      clearRequestErrors: () => set({ requestErrors: [] }),

      setAuthPosture: (authPosture) =>
        set((state) => ({ authPosture: { ...state.authPosture, ...authPosture } })),
    }),
    {
      name: 'concord-ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        activeLens: state.activeLens,
      }),
    }
  )
);
