'use client';

/**
 * useCreativeRegistry — Hook for accessing Creative Global registry content.
 *
 * Provides real-time creative registry entries for a given domain,
 * with automatic refetch on socket events.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useSocket } from './useSocket';

interface CreativeRegistryEntry {
  dtuId: string;
  registeredAt: string;
  contentType: string;
  title: string;
  creator: string;
  tier: string;
  crossDomain?: boolean;
  primaryDomain?: string;
  dtu: {
    id: string;
    human: { summary: string; bullets?: string[]; examples?: string[] };
    core: { claims?: string[]; definitions?: string[] };
    domain: string;
    tier: string;
    artifact: {
      type: string;
      filename: string;
      sizeBytes: number;
      hasThumbnail: boolean;
      hasPreview: boolean;
    } | null;
    authority: { score: number };
    lineage: { parentCount: number };
    marketplace: { price: number; purchases: number } | null;
  } | null;
}

interface RegistryResponse {
  ok: boolean;
  domain: string;
  entries: CreativeRegistryEntry[];
  total: number;
  hasMore: boolean;
}

export function useCreativeRegistry(domain: string, contentType?: string) {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<RegistryResponse>({
    queryKey: ['creative-registry', domain, contentType],
    queryFn: async () => {
      const { data: resp } = await api.post('/api/creative/registry', {
        domain,
        contentType,
        limit: 30,
      });
      return resp as RegistryResponse;
    },
    staleTime: 30_000,
    enabled: !!domain,
  });

  // Listen for real-time updates via socket
  const { on, off } = useSocket({ autoConnect: true });

  const handleRegistryUpdate = useCallback(
    (event: unknown) => {
      const e = event as { domain?: string; relatedDomains?: string[] };
      if (e?.domain === domain || e?.relatedDomains?.includes(domain)) {
        refetch();
      }
    },
    [domain, refetch],
  );

  // Subscribe to creative registry updates
  // Note: Effect-based subscription handled in component via on/off

  return {
    entries: data?.entries || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading,
    refetch,
    on,
    off,
    handleRegistryUpdate,
  };
}
