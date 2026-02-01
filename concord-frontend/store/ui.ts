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

  // Toast notifications
  toasts: Toast[];

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveLens: (lens: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
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
      toasts: [],

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      setActiveLens: (lens) => set({ activeLens: lens }),

      setTheme: (theme) => set({ theme }),

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
