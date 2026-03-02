import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import {
  useTip,
  useBounties,
  usePostBounty,
  useClaimBounty,
  useMeritCredit,
  useLoanEligibility,
  useCreateDTU,
  useListDTU,
  usePurchaseDTU,
  useCRETIScore,
  useRecalculateCRETI,
  useCompressToMega,
  useCompressToHyper,
  useForkDTU,
  useForkTree,
  useDTUPreview,
  useDTUSearch,
  useEntities,
  useRegisterEmergent,
  useRegisterBot,
} from '@/hooks/useConnectiveTissue';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useConnectiveTissue hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Mutation hooks ──────────────────────────────────────────

  describe('useTip', () => {
    it('calls POST /api/ct/tip with correct data', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useTip(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          tipperId: 'user-1',
          creatorId: 'user-2',
          contentId: 'content-1',
          amount: 10,
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/tip', {
        tipperId: 'user-1',
        creatorId: 'user-2',
        contentId: 'content-1',
        amount: 10,
      });
    });

    it('returns error on failed tip', async () => {
      mockedApi.post.mockRejectedValue(new Error('Insufficient balance'));

      const { result } = renderHook(() => useTip(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          tipperId: 'user-1',
          creatorId: 'user-2',
          contentId: 'content-1',
          amount: 10,
        })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('usePostBounty', () => {
    it('calls POST /api/ct/bounties with correct data', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true, bountyId: 'b-1' } });

      const { result } = renderHook(() => usePostBounty(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          posterId: 'user-1',
          title: 'Test Bounty',
          amount: 50,
          tags: ['test'],
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/bounties', {
        posterId: 'user-1',
        title: 'Test Bounty',
        amount: 50,
        tags: ['test'],
      });
    });
  });

  describe('useClaimBounty', () => {
    it('calls POST /api/ct/bounties/:id/claim', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useClaimBounty(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bountyId: 'bounty-1',
          claimerId: 'user-2',
          posterId: 'user-1',
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/ct/bounties/bounty-1/claim',
        { claimerId: 'user-2', posterId: 'user-1' }
      );
    });
  });

  describe('useCreateDTU', () => {
    it('calls POST /api/ct/dtu/create', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true, dtuId: 'dtu-1' } });

      const { result } = renderHook(() => useCreateDTU(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          creatorId: 'user-1',
          title: 'Test DTU',
          content: 'Test content',
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/create', {
        creatorId: 'user-1',
        title: 'Test DTU',
        content: 'Test content',
      });
    });
  });

  describe('useListDTU', () => {
    it('calls POST /api/ct/dtu/list', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useListDTU(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          dtuId: 'dtu-1',
          sellerId: 'user-1',
          price: 100,
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/list', {
        dtuId: 'dtu-1',
        sellerId: 'user-1',
        price: 100,
      });
    });
  });

  describe('usePurchaseDTU', () => {
    it('calls POST /api/ct/dtu/purchase', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => usePurchaseDTU(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          buyerId: 'user-2',
          dtuId: 'dtu-1',
          sellerId: 'user-1',
          amount: 50,
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/purchase', {
        buyerId: 'user-2',
        dtuId: 'dtu-1',
        sellerId: 'user-1',
        amount: 50,
      });
    });
  });

  describe('useRecalculateCRETI', () => {
    it('calls POST /api/ct/dtu/:id/creti/recalculate', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true, score: 85 } });

      const { result } = renderHook(() => useRecalculateCRETI(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('dtu-1');
      });

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/api/ct/dtu/dtu-1/creti/recalculate'
      );
    });
  });

  describe('useCompressToMega', () => {
    it('calls POST /api/ct/dtu/compress/mega', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useCompressToMega(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          creatorId: 'user-1',
          title: 'Mega DTU',
          childDtuIds: ['dtu-1', 'dtu-2'],
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/compress/mega', {
        creatorId: 'user-1',
        title: 'Mega DTU',
        childDtuIds: ['dtu-1', 'dtu-2'],
      });
    });
  });

  describe('useCompressToHyper', () => {
    it('calls POST /api/ct/dtu/compress/hyper', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useCompressToHyper(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          creatorId: 'user-1',
          title: 'Hyper DTU',
          megaDtuIds: ['mega-1', 'mega-2'],
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/compress/hyper', {
        creatorId: 'user-1',
        title: 'Hyper DTU',
        megaDtuIds: ['mega-1', 'mega-2'],
      });
    });
  });

  describe('useForkDTU', () => {
    it('calls POST /api/ct/dtu/fork', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useForkDTU(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          forkerId: 'user-1',
          originalDtuId: 'dtu-1',
          newTitle: 'Forked DTU',
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/dtu/fork', {
        forkerId: 'user-1',
        originalDtuId: 'dtu-1',
        newTitle: 'Forked DTU',
      });
    });
  });

  describe('useRegisterEmergent', () => {
    it('calls POST /api/ct/emergent/register', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useRegisterEmergent(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'Test Emergent',
          modelId: 'model-1',
          capabilities: ['chat', 'code'],
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/emergent/register', {
        name: 'Test Emergent',
        modelId: 'model-1',
        capabilities: ['chat', 'code'],
      });
    });
  });

  describe('useRegisterBot', () => {
    it('calls POST /api/ct/bot/register', async () => {
      mockedApi.post.mockResolvedValue({ data: { ok: true } });

      const { result } = renderHook(() => useRegisterBot(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'Test Bot',
          ownerId: 'user-1',
          botType: 'assistant',
        });
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/api/ct/bot/register', {
        name: 'Test Bot',
        ownerId: 'user-1',
        botType: 'assistant',
      });
    });
  });

  // ── Query hooks ──────────────────────────────────────────────

  describe('useBounties', () => {
    it('fetches bounties with default status OPEN', async () => {
      mockedApi.get.mockResolvedValue({ data: { bounties: [] } });

      const { result } = renderHook(() => useBounties('lens-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/bounties', {
        params: { lensId: 'lens-1', status: 'OPEN' },
      });
    });

    it('fetches bounties with custom status', async () => {
      mockedApi.get.mockResolvedValue({ data: { bounties: [] } });

      const { result } = renderHook(() => useBounties('lens-1', 'CLAIMED'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/bounties', {
        params: { lensId: 'lens-1', status: 'CLAIMED' },
      });
    });
  });

  describe('useMeritCredit', () => {
    it('fetches merit for a given user', async () => {
      mockedApi.get.mockResolvedValue({ data: { score: 100, tier: 'gold' } });

      const { result } = renderHook(() => useMeritCredit('user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/merit/user-1');
    });

    it('does not fetch when userId is empty', async () => {
      const { result } = renderHook(() => useMeritCredit(''), {
        wrapper: createWrapper(),
      });

      // Should remain in loading because enabled is false and query never executes
      // TanStack Query sets isLoading to false when disabled
      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('useLoanEligibility', () => {
    it('fetches loan eligibility for a given user', async () => {
      mockedApi.get.mockResolvedValue({ data: { eligible: true, maxAmount: 500 } });

      const { result } = renderHook(() => useLoanEligibility('user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/loan-eligibility/user-1');
    });

    it('does not fetch when userId is empty', async () => {
      const { result } = renderHook(() => useLoanEligibility(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('useCRETIScore', () => {
    it('fetches CRETI score for a given DTU', async () => {
      mockedApi.get.mockResolvedValue({ data: { score: 85 } });

      const { result } = renderHook(() => useCRETIScore('dtu-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/dtu/dtu-1/creti');
    });

    it('does not fetch when dtuId is empty', async () => {
      const { result } = renderHook(() => useCRETIScore(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('useForkTree', () => {
    it('fetches fork tree for a DTU', async () => {
      mockedApi.get.mockResolvedValue({ data: { forks: [] } });

      const { result } = renderHook(() => useForkTree('dtu-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/dtu/dtu-1/forks');
    });

    it('does not fetch when dtuId is empty', async () => {
      const { result } = renderHook(() => useForkTree(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('useDTUPreview', () => {
    it('fetches preview for a DTU', async () => {
      mockedApi.get.mockResolvedValue({ data: { preview: 'content...' } });

      const { result } = renderHook(() => useDTUPreview('dtu-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/dtu/dtu-1/preview');
    });

    it('does not fetch when dtuId is empty', async () => {
      const { result } = renderHook(() => useDTUPreview(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('useDTUSearch', () => {
    it('fetches search results with query', async () => {
      mockedApi.get.mockResolvedValue({ data: { dtus: [], total: 0 } });

      const { result } = renderHook(
        () => useDTUSearch({ query: 'test', limit: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/search', {
        params: expect.objectContaining({
          q: 'test',
          limit: 10,
        }),
      });
    });

    it('does not fetch when neither query nor lensId provided', async () => {
      const { result } = renderHook(
        () => useDTUSearch({}),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('fetches when lensId is provided without query', async () => {
      mockedApi.get.mockResolvedValue({ data: { dtus: [], total: 0 } });

      const { result } = renderHook(
        () => useDTUSearch({ lensId: 'research' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/search', {
        params: expect.objectContaining({ lensId: 'research' }),
      });
    });
  });

  describe('useEntities', () => {
    it('fetches entities', async () => {
      mockedApi.get.mockResolvedValue({ data: { entities: [] } });

      const { result } = renderHook(() => useEntities('human'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/entities', {
        params: { substrate: 'human' },
      });
    });

    it('fetches without substrate filter', async () => {
      mockedApi.get.mockResolvedValue({ data: { entities: [] } });

      const { result } = renderHook(() => useEntities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.get).toHaveBeenCalledWith('/api/ct/entities', {
        params: { substrate: undefined },
      });
    });
  });
});
