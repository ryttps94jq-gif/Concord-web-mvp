/**
 * useFreshness — Hooks for DTU freshness scoring.
 *
 * Provides access to the freshness scoring system:
 * - useFreshness(dtuId) — get freshness for a single DTU
 * - useFreshnessBatch(domain?, sort?) — batch freshness for domain/all
 *
 * Freshness is calculated server-side based on:
 * - Age (exponential decay with 30-day half-life)
 * - Access frequency (recently viewed items stay fresh)
 * - Tier (HYPER/MEGA DTUs decay slower)
 * - Connections (well-connected DTUs decay slower)
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface FreshnessResult {
  id: string;
  freshness: number;
  label: 'fresh' | 'warm' | 'cooling' | 'stale';
  factors: {
    ageDays: number;
    accessCount: number;
    tier: string;
    connections: number;
  };
}

interface FreshnessBatchItem {
  id: string;
  title: string;
  freshness: number;
  label: string;
  tier: string;
  tags: string[];
  updatedAt: string;
}

/**
 * Get freshness score for a single DTU.
 * Also records an access event for the DTU.
 */
export function useFreshness(dtuId: string | null | undefined) {
  return useQuery<FreshnessResult>({
    queryKey: ['freshness', dtuId],
    queryFn: async () => {
      const { data } = await api.get(`/api/dtus/${dtuId}/freshness`);
      return data;
    },
    enabled: !!dtuId,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Batch freshness scores for a domain or all DTUs.
 */
export function useFreshnessBatch(options: {
  domain?: string;
  limit?: number;
  sort?: 'fresh' | 'stale';
  enabled?: boolean;
} = {}) {
  const { domain, limit = 50, sort, enabled = true } = options;

  return useQuery<{ ok: boolean; items: FreshnessBatchItem[]; total: number }>({
    queryKey: ['freshness-batch', domain, limit, sort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (limit) params.set('limit', String(limit));
      if (sort) params.set('sort', sort);
      const { data } = await api.get(`/api/freshness/batch?${params.toString()}`);
      return data;
    },
    enabled,
    staleTime: 30000, // Cache for 30 seconds
  });
}
