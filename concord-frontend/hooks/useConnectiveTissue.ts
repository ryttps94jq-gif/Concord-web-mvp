'use client';

/**
 * useConnectiveTissue — Frontend hooks for the Concord connective tissue layer.
 *
 * Provides React hooks for: CC tipping, bounties, merit credit, DTU creation,
 * CRETI scoring, compression, forking, previews, search, and entity management.
 *
 * All hooks use TanStack Query for caching and automatic invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

const CT_BASE = '/api/ct';

// ── TIPPING ─────────────────────────────────────────────────────────────

export function useTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      tipperId: string; creatorId: string; contentId: string;
      contentType?: string; lensId?: string; amount: number;
    }) => api.post(`${CT_BASE}/tip`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merit'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

// ── BOUNTIES ────────────────────────────────────────────────────────────

export function useBounties(lensId?: string, status = 'OPEN') {
  return useQuery({
    queryKey: ['bounties', lensId, status],
    queryFn: () => api.get(`${CT_BASE}/bounties`, {
      params: { lensId, status },
    }),
  });
}

export function usePostBounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      posterId: string; title: string; description?: string;
      lensId?: string; amount: number; tags?: string[];
    }) => api.post(`${CT_BASE}/bounties`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bounties'] }),
  });
}

export function useClaimBounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bountyId, ...data }: {
      bountyId: string; claimerId: string; posterId: string; solutionDtuId?: string;
    }) => api.post(`${CT_BASE}/bounties/${bountyId}/claim`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bounties'] }),
  });
}

// ── MERIT CREDIT ────────────────────────────────────────────────────────

export function useMeritCredit(userId: string) {
  return useQuery({
    queryKey: ['merit', userId],
    queryFn: () => api.get(`${CT_BASE}/merit/${userId}`),
    enabled: !!userId,
  });
}

export function useLoanEligibility(userId: string) {
  return useQuery({
    queryKey: ['loan-eligibility', userId],
    queryFn: () => api.get(`${CT_BASE}/loan-eligibility/${userId}`),
    enabled: !!userId,
  });
}

// ── DTU CREATION & PUBLICATION ──────────────────────────────────────────

export function useCreateDTU() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      creatorId: string; title: string; content: string;
      contentType?: string; lensId?: string; tier?: string;
      tags?: string[]; citations?: Array<{ parentId: string; parentCreatorId?: string }>;
      price?: number; previewPolicy?: string;
    }) => api.post(`${CT_BASE}/dtu/create`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dtus'] });
      qc.invalidateQueries({ queryKey: ['merit'] });
    },
  });
}

export function useListDTU() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { dtuId: string; sellerId: string; price: number; licenseType?: string }) =>
      api.post(`${CT_BASE}/dtu/list`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace'] }),
  });
}

export function usePurchaseDTU() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      buyerId: string; dtuId: string; sellerId: string; amount: number; lensId?: string;
    }) => api.post(`${CT_BASE}/dtu/purchase`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dtus'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
      qc.invalidateQueries({ queryKey: ['merit'] });
    },
  });
}

// ── CRETI SCORING ───────────────────────────────────────────────────────

export function useCRETIScore(dtuId: string) {
  return useQuery({
    queryKey: ['creti', dtuId],
    queryFn: () => api.get(`${CT_BASE}/dtu/${dtuId}/creti`),
    enabled: !!dtuId,
  });
}

export function useRecalculateCRETI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dtuId: string) => api.post(`${CT_BASE}/dtu/${dtuId}/creti/recalculate`),
    onSuccess: (_, dtuId) => qc.invalidateQueries({ queryKey: ['creti', dtuId] }),
  });
}

// ── DTU COMPRESSION ─────────────────────────────────────────────────────

export function useCompressToMega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      creatorId: string; title: string; childDtuIds: string[];
      lensId?: string; price?: number;
    }) => api.post(`${CT_BASE}/dtu/compress/mega`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dtus'] }),
  });
}

export function useCompressToHyper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      creatorId: string; title: string; megaDtuIds: string[];
      lensId?: string; price?: number;
    }) => api.post(`${CT_BASE}/dtu/compress/hyper`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dtus'] }),
  });
}

// ── FORK MECHANISM ──────────────────────────────────────────────────────

export function useForkDTU() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      forkerId: string; originalDtuId: string; newTitle?: string;
      newContent?: string; lensId?: string;
    }) => api.post(`${CT_BASE}/dtu/fork`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dtus'] });
      qc.invalidateQueries({ queryKey: ['forks'] });
    },
  });
}

export function useForkTree(dtuId: string) {
  return useQuery({
    queryKey: ['forks', dtuId],
    queryFn: () => api.get(`${CT_BASE}/dtu/${dtuId}/forks`),
    enabled: !!dtuId,
  });
}

// ── PREVIEW SYSTEM ──────────────────────────────────────────────────────

export function useDTUPreview(dtuId: string) {
  return useQuery({
    queryKey: ['preview', dtuId],
    queryFn: () => api.get(`${CT_BASE}/dtu/${dtuId}/preview`),
    enabled: !!dtuId,
  });
}

// ── CROSS-LENS SEARCH ───────────────────────────────────────────────────

export function useDTUSearch(params: {
  query?: string; lensId?: string; tier?: string;
  minCreti?: number; maxPrice?: number; sortBy?: string;
  limit?: number; offset?: number;
}) {
  return useQuery({
    queryKey: ['dtu-search', params],
    queryFn: () => api.get(`${CT_BASE}/search`, {
      params: {
        q: params.query,
        lensId: params.lensId,
        tier: params.tier,
        minCreti: params.minCreti,
        maxPrice: params.maxPrice,
        sortBy: params.sortBy,
        limit: params.limit,
        offset: params.offset,
      },
    }),
    enabled: !!(params.query || params.lensId),
  });
}

// ── ENTITY MANAGEMENT ───────────────────────────────────────────────────

export function useEntities(substrate?: string) {
  return useQuery({
    queryKey: ['entities', substrate],
    queryFn: () => api.get(`${CT_BASE}/entities`, { params: { substrate } }),
  });
}

export function useRegisterEmergent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string; modelId?: string; capabilities?: string[];
      sponsorId?: string;
    }) => api.post(`${CT_BASE}/emergent/register`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entities'] }),
  });
}

export function useRegisterBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string; botType?: string; ownerId: string;
      capabilities?: string[]; lensIds?: string[];
    }) => api.post(`${CT_BASE}/bot/register`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entities'] }),
  });
}
