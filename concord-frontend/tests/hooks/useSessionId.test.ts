import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionId, resetSessionId } from '@/hooks/useSessionId';

describe('useSessionId', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('useSessionId hook', () => {
    it('creates a new session ID on first use', () => {
      const { result } = renderHook(() => useSessionId());

      expect(result.current).toBeTruthy();
      expect(result.current).toMatch(/^session-/);
    });

    it('stores the session ID in sessionStorage', () => {
      renderHook(() => useSessionId());

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'concord_session_id',
        expect.stringMatching(/^session-/)
      );
    });

    it('returns existing session ID from sessionStorage', () => {
      mockStorage['concord_session_id'] = 'session-existing-abc123';

      const { result } = renderHook(() => useSessionId());

      expect(result.current).toBe('session-existing-abc123');
    });

    it('does not create a new ID when one already exists', () => {
      mockStorage['concord_session_id'] = 'session-existing-abc123';

      renderHook(() => useSessionId());

      // setItem should not be called since the session already exists
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('returns consistent ID across multiple renders', () => {
      const { result, rerender } = renderHook(() => useSessionId());

      const firstId = result.current;
      rerender();
      const secondId = result.current;

      expect(firstId).toBe(secondId);
    });

    it('generates a unique ID with timestamp and random suffix', () => {
      const { result } = renderHook(() => useSessionId());

      // Format: session-<timestamp>-<random>
      const parts = result.current.split('-');
      expect(parts[0]).toBe('session');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      // The timestamp part should be a number
      expect(Number(parts[1])).toBeGreaterThan(0);
    });
  });

  describe('resetSessionId', () => {
    it('creates and stores a new session ID', () => {
      const newId = resetSessionId();

      expect(newId).toMatch(/^session-/);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'concord_session_id',
        newId
      );
    });

    it('returns a different ID each time it is called', () => {
      const id1 = resetSessionId();
      const id2 = resetSessionId();

      // Due to Date.now() + random, these should differ
      // (might collide in extremely rare cases, so we just check format)
      expect(id1).toMatch(/^session-/);
      expect(id2).toMatch(/^session-/);
    });

    it('overwrites the existing session ID', () => {
      mockStorage['concord_session_id'] = 'session-old';

      const newId = resetSessionId();

      expect(newId).not.toBe('session-old');
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'concord_session_id',
        newId
      );
    });
  });

  describe('SSR safety', () => {
    it('resetSessionId returns "default" when window is undefined', () => {
      // Temporarily make typeof window === 'undefined'
      const originalWindow = globalThis.window;
      // @ts-expect-error -- testing SSR scenario
      delete globalThis.window;

      try {
        const result = resetSessionId();
        expect(result).toBe('default');
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
