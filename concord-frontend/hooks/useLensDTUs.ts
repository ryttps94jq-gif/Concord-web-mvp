'use client';

/**
 * useLensDTUs — Universal lens DTU hook
 *
 * Provides DTU context for any lens by combining:
 *   - Context DTUs (regular + MEGA + HYPER) via POST /api/macro/context/query
 *   - Domain-specific DTUs via GET /api/dtu/list
 *   - createDTU mutation via POST /api/macro/dtu/create
 *   - publishToMarketplace mutation via POST /api/macro/marketplace/list
 *
 * Exposes tier-split collections and a computed tier distribution for
 * display in LensContextPanel or any lens-specific UI.
 *
 * Usage:
 *   const {
 *     contextDTUs, hyperDTUs, megaDTUs, regularDTUs,
 *     domainDTUs, tierDistribution,
 *     createDTU, publishToMarketplace,
 *     isLoading, isError, refetch,
 *   } = useLensDTUs({ lens: 'research', domain: 'science' });
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DTU, DTUTier } from '@/lib/api/generated-types';

// ---- Types ----------------------------------------------------------------

export interface LensDTUOptions {
  /** Current lens identifier (e.g. 'research', 'code', 'art'). */
  lens: string;
  /** Optional domain scope for domain-specific DTU list. */
  domain?: string;
  /** Optional tags to filter context query. */
  tags?: string[];
  /** Max DTUs to return from context query. Default 100. */
  limit?: number;
  /** Disable fetching (e.g. when a prerequisite is missing). */
  enabled?: boolean;
  /** Stale time in ms for query cache. Default 30000 (30s). */
  staleTime?: number;
}

export interface TierDistribution {
  hyper: number;
  mega: number;
  regular: number;
  total: number;
}

interface ContextQueryResponse {
  ok: boolean;
  dtus: DTU[];
  total: number;
  tiers?: TierDistribution;
}

interface DomainListResponse {
  ok: boolean;
  dtus: DTU[];
  total: number;
}

interface CreateDTUInput {
  title?: string;
  content: string;
  tags?: string[];
  tier?: DTUTier;
  source?: string;
  parents?: string[];
  meta?: Record<string, unknown>;
}

interface CreateDTUResponse {
  ok: boolean;
  dtu: DTU;
}

interface PublishInput {
  dtuId: string;
  price?: number;
  description?: string;
  license?: string;
}

interface PublishResponse {
  ok: boolean;
  listingId: string;
}

// ---- Hook ------------------------------------------------------------------

export function useLensDTUs(options: LensDTUOptions) {
  const {
    lens,
    domain,
    tags,
    limit = 100,
    enabled = true,
    staleTime = 30_000,
  } = options;

  const qc = useQueryClient();

  // ---- Context DTUs query (regular + MEGA + HYPER) ----
  const contextBody = useMemo(
    () => ({ lens, tags, limit }),
    [lens, tags, limit],
  );

  const contextQuery = useQuery<ContextQueryResponse>({
    queryKey: ['lensDTUs', 'context', lens, { tags, limit }],
    queryFn: async () => {
      const { data } = await api.post('/api/macro/context/query', contextBody);
      return data as ContextQueryResponse;
    },
    enabled,
    staleTime,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // ---- Domain-specific DTUs query ----
  const domainQuery = useQuery<DomainListResponse>({
    queryKey: ['lensDTUs', 'domain', domain ?? lens],
    queryFn: async () => {
      const { data } = await api.get('/api/dtu/list', {
        params: { scope: domain ?? lens, limit },
      });
      return data as DomainListResponse;
    },
    enabled: enabled && Boolean(domain ?? lens),
    staleTime,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // ---- Derived collections ----
  const contextDTUs: DTU[] = contextQuery.data?.dtus ?? [];

  const hyperDTUs = useMemo(
    () => contextDTUs.filter((d) => d.tier === 'hyper'),
    [contextDTUs],
  );

  const megaDTUs = useMemo(
    () => contextDTUs.filter((d) => d.tier === 'mega'),
    [contextDTUs],
  );

  const regularDTUs = useMemo(
    () => contextDTUs.filter((d) => d.tier === 'regular'),
    [contextDTUs],
  );

  const domainDTUs: DTU[] = domainQuery.data?.dtus ?? [];

  // ---- Tier distribution ----
  const tierDistribution: TierDistribution = useMemo(() => {
    // Prefer server-side tiers when available
    if (contextQuery.data?.tiers) return contextQuery.data.tiers;
    return {
      hyper: hyperDTUs.length,
      mega: megaDTUs.length,
      regular: regularDTUs.length,
      total: contextDTUs.length,
    };
  }, [contextQuery.data?.tiers, hyperDTUs.length, megaDTUs.length, regularDTUs.length, contextDTUs.length]);

  // ---- Create DTU mutation ----
  const createMut = useMutation<CreateDTUResponse, Error, CreateDTUInput>({
    mutationFn: async (input) => {
      const { data } = await api.post('/api/macro/dtu/create', {
        ...input,
        lens,
      });
      return data as CreateDTUResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lensDTUs', 'context', lens] });
      qc.invalidateQueries({ queryKey: ['lensDTUs', 'domain'] });
    },
  });

  const createDTU = useCallback(
    (input: CreateDTUInput) => createMut.mutateAsync(input),
    [createMut],
  );

  // ---- Publish to marketplace mutation ----
  const publishMut = useMutation<PublishResponse, Error, PublishInput>({
    mutationFn: async (input) => {
      const { data } = await api.post('/api/macro/marketplace/list', {
        ...input,
        lens,
      });
      return data as PublishResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lensDTUs', 'context', lens] });
    },
  });

  const publishToMarketplace = useCallback(
    (input: PublishInput) => publishMut.mutateAsync(input),
    [publishMut],
  );

  // ---- Composite loading / error ----
  const isLoading = contextQuery.isLoading || domainQuery.isLoading;
  const isError = contextQuery.isError || domainQuery.isError;

  const refetch = useCallback(async () => {
    await Promise.all([contextQuery.refetch(), domainQuery.refetch()]);
  }, [contextQuery, domainQuery]);

  return {
    // DTU collections
    contextDTUs,
    hyperDTUs,
    megaDTUs,
    regularDTUs,
    domainDTUs,

    // Computed
    tierDistribution,

    // Mutations
    createDTU,
    publishToMarketplace,
    isCreating: createMut.isPending,
    isPublishing: publishMut.isPending,

    // Query state
    isLoading,
    isError,
    refetch,
  };
}
