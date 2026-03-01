import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrossLensMemory } from '@/components/chat/useCrossLensMemory';

describe('useCrossLensMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  it('initializes with empty trail', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));
    expect(result.current.trail).toEqual([]);
    expect(result.current.totalLensCount).toBe(0);
    expect(result.current.memoryPreserved).toBe(true);
  });

  it('recordMessage adds current lens entry and increments message count', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));

    act(() => {
      result.current.recordMessage();
    });

    expect(result.current.trail.length).toBe(1);
    expect(result.current.trail[0].lens).toBe('healthcare');
    expect(result.current.trail[0].messageCount).toBe(1);
  });

  it('recordMessage increments count on subsequent calls', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));

    act(() => {
      result.current.recordMessage();
    });
    act(() => {
      result.current.recordMessage();
    });
    act(() => {
      result.current.recordMessage();
    });

    expect(result.current.trail.length).toBe(1);
    expect(result.current.trail[0].lens).toBe('healthcare');
    expect(result.current.trail[0].messageCount).toBe(3);
  });

  it('lens change adds new trail entry', () => {
    const { result, rerender } = renderHook(
      ({ lens }) => useCrossLensMemory(lens),
      { initialProps: { lens: 'healthcare' } }
    );

    // Record a message in healthcare
    act(() => {
      result.current.recordMessage();
    });

    // Switch lens
    rerender({ lens: 'finance' });

    expect(result.current.trail.length).toBe(2);
    expect(result.current.trail[0].lens).toBe('healthcare');
    expect(result.current.trail[1].lens).toBe('finance');
    expect(result.current.totalLensCount).toBe(2);
  });

  it('clearTrail resets everything to current lens only', () => {
    const { result, rerender } = renderHook(
      ({ lens }) => useCrossLensMemory(lens),
      { initialProps: { lens: 'healthcare' } }
    );

    act(() => {
      result.current.recordMessage();
    });

    rerender({ lens: 'finance' });

    act(() => {
      result.current.recordMessage();
    });

    expect(result.current.trail.length).toBe(2);

    act(() => {
      result.current.clearTrail();
    });

    expect(result.current.trail.length).toBe(1);
    expect(result.current.trail[0].lens).toBe('finance');
    expect(result.current.trail[0].messageCount).toBe(0);
    expect(result.current.totalLensCount).toBe(1);
    expect(result.current.memoryPreserved).toBe(true);
  });

  it('toggleMemoryPreserved toggles the flag', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));

    expect(result.current.memoryPreserved).toBe(true);

    act(() => {
      result.current.toggleMemoryPreserved();
    });

    expect(result.current.memoryPreserved).toBe(false);

    act(() => {
      result.current.toggleMemoryPreserved();
    });

    expect(result.current.memoryPreserved).toBe(true);
  });

  it('totalLensCount returns correct count', () => {
    const { result, rerender } = renderHook(
      ({ lens }) => useCrossLensMemory(lens),
      { initialProps: { lens: 'healthcare' } }
    );

    act(() => {
      result.current.recordMessage();
    });

    rerender({ lens: 'finance' });
    act(() => {
      result.current.recordMessage();
    });

    rerender({ lens: 'education' });
    act(() => {
      result.current.recordMessage();
    });

    expect(result.current.totalLensCount).toBe(3);
  });

  it('persists trail to sessionStorage', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));

    act(() => {
      result.current.recordMessage();
    });

    const stored = sessionStorage.getItem('concord_cross_lens_memory');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.trail).toBeDefined();
    expect(parsed.trail.length).toBe(1);
    expect(parsed.trail[0].lens).toBe('healthcare');
  });

  it('loads from sessionStorage on init', () => {
    // Pre-populate sessionStorage
    const state = {
      trail: [
        { lens: 'healthcare', enteredAt: '2026-01-01T00:00:00Z', messageCount: 5 },
        { lens: 'finance', enteredAt: '2026-01-01T00:01:00Z', messageCount: 3 },
      ],
      totalLensCount: 2,
      memoryPreserved: false,
    };
    sessionStorage.setItem('concord_cross_lens_memory', JSON.stringify(state));

    const { result } = renderHook(() => useCrossLensMemory('finance'));

    expect(result.current.trail.length).toBe(2);
    expect(result.current.totalLensCount).toBe(2);
    expect(result.current.memoryPreserved).toBe(false);
  });

  it('revisiting a lens moves it to end of trail', () => {
    const { result, rerender } = renderHook(
      ({ lens }) => useCrossLensMemory(lens),
      { initialProps: { lens: 'healthcare' } }
    );

    act(() => {
      result.current.recordMessage();
    });

    rerender({ lens: 'finance' });
    act(() => {
      result.current.recordMessage();
    });

    rerender({ lens: 'healthcare' });

    // Healthcare should be at the end now
    const lastEntry = result.current.trail[result.current.trail.length - 1];
    expect(lastEntry.lens).toBe('healthcare');
    // totalLensCount should still be 2 (not 3)
    expect(result.current.totalLensCount).toBe(2);
  });

  it('provides all expected return properties', () => {
    const { result } = renderHook(() => useCrossLensMemory('healthcare'));

    expect(result.current).toHaveProperty('trail');
    expect(result.current).toHaveProperty('totalLensCount');
    expect(result.current).toHaveProperty('memoryPreserved');
    expect(result.current).toHaveProperty('recordMessage');
    expect(result.current).toHaveProperty('toggleMemoryPreserved');
    expect(result.current).toHaveProperty('clearTrail');
  });
});
