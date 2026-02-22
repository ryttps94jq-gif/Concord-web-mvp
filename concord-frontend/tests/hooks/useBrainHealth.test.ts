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
        conscious: { online: true },
        subconscious: { online: true },
        utility: { online: true },
      }),
    });

    const { result } = renderHook(() => useBrainHealth());
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches brain health and returns status', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        conscious: { online: true, model: 'qwen2.5:7b' },
        subconscious: { online: true, model: 'qwen2.5:1.5b' },
        utility: { online: false, model: 'qwen2.5:3b' },
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
  });

  it('displays three brain statuses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        conscious: { online: true },
        subconscious: { online: true },
        utility: { online: true },
      }),
    });

    const { result } = renderHook(() => useBrainHealth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.brainStatus).toHaveProperty('conscious');
    expect(result.current.brainStatus).toHaveProperty('subconscious');
    expect(result.current.brainStatus).toHaveProperty('utility');
  });
});
