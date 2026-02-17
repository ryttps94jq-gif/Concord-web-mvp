import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/ui';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    const store = useUIStore.getState();
    store.setSidebarOpen(true);
    store.setSidebarCollapsed(false);
    store.setCommandPaletteOpen(false);
    store.setActiveLens('chat');
    store.setTheme('dark');
    store.setFullPageMode(false);
    store.clearRequestErrors();
    // Clear toasts
    useUIStore.setState({ toasts: [] });
  });

  describe('sidebar', () => {
    it('toggles sidebar open state', () => {
      const store = useUIStore.getState();
      const initial = store.sidebarOpen;
      store.toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(!initial);
    });

    it('sets sidebar open explicitly', () => {
      useUIStore.getState().setSidebarOpen(false);
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().setSidebarOpen(true);
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it('sets sidebar collapsed state', () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });
  });

  describe('command palette', () => {
    it('toggles command palette', () => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
      useUIStore.getState().toggleCommandPalette();
      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
      useUIStore.getState().toggleCommandPalette();
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });

    it('sets command palette open state directly', () => {
      useUIStore.getState().setCommandPaletteOpen(true);
      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });
  });

  describe('active lens', () => {
    it('sets active lens', () => {
      useUIStore.getState().setActiveLens('board');
      expect(useUIStore.getState().activeLens).toBe('board');
    });
  });

  describe('theme', () => {
    it('sets theme to light', () => {
      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('sets theme to dark', () => {
      useUIStore.getState().setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');
    });
  });

  describe('full page mode', () => {
    it('enables full page mode', () => {
      useUIStore.getState().setFullPageMode(true);
      expect(useUIStore.getState().fullPageMode).toBe(true);
    });
  });

  describe('toasts', () => {
    it('adds a toast with generated id', () => {
      useUIStore.getState().addToast({ type: 'success', message: 'Test toast' });
      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test toast');
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].id).toMatch(/^toast-/);
    });

    it('adds multiple toasts', () => {
      useUIStore.getState().addToast({ type: 'success', message: 'First' });
      useUIStore.getState().addToast({ type: 'error', message: 'Second' });
      expect(useUIStore.getState().toasts).toHaveLength(2);
    });

    it('removes a toast by id', () => {
      useUIStore.getState().addToast({ type: 'info', message: 'Removable' });
      const toastId = useUIStore.getState().toasts[0].id;
      useUIStore.getState().removeToast(toastId);
      expect(useUIStore.getState().toasts).toHaveLength(0);
    });

    it('supports optional duration', () => {
      useUIStore.getState().addToast({ type: 'warning', message: 'Quick', duration: 2000 });
      expect(useUIStore.getState().toasts[0].duration).toBe(2000);
    });
  });

  describe('request errors', () => {
    it('adds request error with generated id and timestamp', () => {
      useUIStore.getState().addRequestError({
        path: '/api/test',
        method: 'GET',
        status: 500,
        message: 'Server error',
      });
      const errors = useUIStore.getState().requestErrors;
      expect(errors).toHaveLength(1);
      expect(errors[0].id).toMatch(/^reqerr-/);
      expect(errors[0].at).toBeTruthy();
      expect(errors[0].message).toBe('Server error');
    });

    it('deduplicates errors within 10 second window', () => {
      useUIStore.getState().addRequestError({
        path: '/api/test',
        status: 500,
        message: 'Error 1',
      });
      useUIStore.getState().addRequestError({
        path: '/api/test',
        status: 500,
        message: 'Error 2',
      });
      // Second should be deduplicated
      expect(useUIStore.getState().requestErrors).toHaveLength(1);
    });

    it('allows different paths/status to be added', () => {
      useUIStore.getState().addRequestError({
        path: '/api/test',
        status: 500,
        message: 'Error 1',
      });
      useUIStore.getState().addRequestError({
        path: '/api/other',
        status: 404,
        message: 'Error 2',
      });
      expect(useUIStore.getState().requestErrors).toHaveLength(2);
    });

    it('keeps max 20 errors', () => {
      for (let i = 0; i < 25; i++) {
        useUIStore.getState().addRequestError({
          path: `/api/test-${i}`,
          status: 500,
          message: `Error ${i}`,
        });
      }
      expect(useUIStore.getState().requestErrors.length).toBeLessThanOrEqual(20);
    });

    it('clears all request errors', () => {
      useUIStore.getState().addRequestError({ message: 'Error' });
      useUIStore.getState().clearRequestErrors();
      expect(useUIStore.getState().requestErrors).toHaveLength(0);
    });
  });

  describe('auth posture', () => {
    it('sets auth posture partially', () => {
      useUIStore.getState().setAuthPosture({ mode: 'jwt', usesJwt: true });
      const posture = useUIStore.getState().authPosture;
      expect(posture.mode).toBe('jwt');
      expect(posture.usesJwt).toBe(true);
      expect(posture.usesApiKey).toBe(false); // Default preserved
    });

    it('merges partial auth posture updates', () => {
      useUIStore.getState().setAuthPosture({ mode: 'hybrid' });
      useUIStore.getState().setAuthPosture({ usesApiKey: true });
      const posture = useUIStore.getState().authPosture;
      expect(posture.mode).toBe('hybrid');
      expect(posture.usesApiKey).toBe(true);
    });
  });
});
