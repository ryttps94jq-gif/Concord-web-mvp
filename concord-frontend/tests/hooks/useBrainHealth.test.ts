import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBrainHealth } from '@/hooks/useBrainHealth';

describe('useBrainHealth', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loading state initially', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'four-brain',
        onlineCount: 3,
        brains: {
          conscious: { enabled: true, model: '', role: 'conscious', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          subconscious: { enabled: true, model: '', role: 'subconscious', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          utility: { enabled: true, model: '', role: 'utility', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
        },
      }),
    });

    const { result } = renderHook(() => useBrainHealth());
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches brain health and returns status', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'four-brain',
        onlineCount: 2,
        brains: {
          conscious: { enabled: true, model: 'qwen2.5:7b', role: 'conscious', avgResponseMs: 100, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          subconscious: { enabled: true, model: 'qwen2.5:1.5b', role: 'subconscious', avgResponseMs: 50, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          utility: { enabled: false, model: 'qwen2.5:3b', role: 'utility', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
        },
      }),
    });

    const { result } = renderHook(() => useBrainHealth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.brainStatus.conscious?.online).toBe(true);
    expect(result.current.brainStatus.utility?.online).toBe(false);
  });

  it('sets all brains offline on fetch failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBrainHealth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.brainStatus.conscious?.online).toBe(false);
    expect(result.current.brainStatus.subconscious?.online).toBe(false);
    expect(result.current.brainStatus.utility?.online).toBe(false);
    expect(result.current.brainStatus.repair?.online).toBe(false);
  });

  it('displays four brain statuses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'four-brain',
        onlineCount: 4,
        brains: {
          conscious: { enabled: true, model: '', role: 'conscious', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          subconscious: { enabled: true, model: '', role: 'subconscious', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          utility: { enabled: true, model: '', role: 'utility', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
          repair: { enabled: true, model: '', role: 'repair', avgResponseMs: 0, stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null } },
        },
      }),
    });

    const { result } = renderHook(() => useBrainHealth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.brainStatus).toHaveProperty('conscious');
    expect(result.current.brainStatus).toHaveProperty('subconscious');
    expect(result.current.brainStatus).toHaveProperty('utility');
    expect(result.current.brainStatus).toHaveProperty('repair');
  });
});
