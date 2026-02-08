/**
 * Generic Lens Artifact Hooks
 *
 * Reusable React Query hooks for any lens domain.
 * Replaces MOCK_* patterns with real persistence via the lens artifact runtime.
 *
 * Usage:
 *   const { data, isLoading } = useArtifacts('music', 'track');
 *   const { data: track } = useArtifact('music', trackId);
 *   const create = useCreateArtifact('music');
 *   const update = useUpdateArtifact('music');
 *   const remove = useDeleteArtifact('music');
 *   const run = useRunArtifact('music');
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ---- Types ----

export interface LensArtifact<T = Record<string, unknown>> {
  id: string;
  domain: string;
  type: string;
  ownerId: string;
  title: string;
  data: T;
  meta: {
    tags: string[];
    status: string;
    visibility: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ListResponse<T = Record<string, unknown>> {
  ok: boolean;
  artifacts: LensArtifact<T>[];
  total: number;
  domain: string;
  type?: string;
}

export interface SingleResponse<T = Record<string, unknown>> {
  ok: boolean;
  artifact: LensArtifact<T>;
}

interface ListOptions {
  type?: string;
  search?: string;
  tags?: string[];
  status?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

// ---- Query Hooks ----

/**
 * List artifacts for a lens domain, with optional type/search/tag filtering.
 */
export function useArtifacts<T = Record<string, unknown>>(
  domain: string,
  options: ListOptions = {}
) {
  const { type, search, tags, status, limit = 100, offset = 0, enabled = true } = options;

  return useQuery<ListResponse<T>>({
    queryKey: ['lens', domain, 'list', { type, search, tags, status, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      if (tags?.length) params.set('tags', tags.join(','));
      if (status) params.set('status', status);
      if (limit) params.set('limit', String(limit));
      if (offset) params.set('offset', String(offset));
      const { data } = await api.get(`/api/lens/${domain}?${params.toString()}`);
      return data;
    },
    enabled,
    staleTime: 5000,
  });
}

/**
 * List artifacts of a specific type within a domain.
 * Convenience wrapper around useArtifacts.
 */
export function useArtifactsByType<T = Record<string, unknown>>(
  domain: string,
  type: string,
  options: Omit<ListOptions, 'type'> = {}
) {
  return useArtifacts<T>(domain, { ...options, type });
}

/**
 * Get a single artifact by ID.
 */
export function useArtifact<T = Record<string, unknown>>(
  domain: string,
  id: string | null | undefined
) {
  return useQuery<SingleResponse<T>>({
    queryKey: ['lens', domain, 'get', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/lens/${domain}/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Mutation Hooks ----

/**
 * Create a new artifact in a domain.
 * Automatically invalidates list queries for that domain.
 */
export function useCreateArtifact<T = Record<string, unknown>>(domain: string) {
  const qc = useQueryClient();

  return useMutation<SingleResponse<T>, Error, { type: string; title?: string; data?: Partial<T>; meta?: Record<string, unknown> }>({
    mutationFn: async (input) => {
      const { data } = await api.post(`/api/lens/${domain}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lens', domain, 'list'] });
    },
  });
}

/**
 * Update an existing artifact.
 * Invalidates both the list and the specific artifact cache.
 */
export function useUpdateArtifact<T = Record<string, unknown>>(domain: string) {
  const qc = useQueryClient();

  return useMutation<SingleResponse<T>, Error, { id: string; title?: string; data?: Partial<T>; meta?: Record<string, unknown> }>({
    mutationFn: async ({ id, ...rest }) => {
      const { data } = await api.put(`/api/lens/${domain}/${id}`, rest);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['lens', domain, 'list'] });
      qc.invalidateQueries({ queryKey: ['lens', domain, 'get', variables.id] });
    },
  });
}

/**
 * Delete an artifact.
 * Invalidates list queries for that domain.
 */
export function useDeleteArtifact(domain: string) {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; deleted: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/api/lens/${domain}/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lens', domain, 'list'] });
    },
  });
}

/**
 * Run a domain-specific action on an artifact.
 */
export function useRunArtifact(domain: string) {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; result: unknown }, Error, { id: string; action: string; params?: Record<string, unknown> }>({
    mutationFn: async ({ id, ...rest }) => {
      const { data } = await api.post(`/api/lens/${domain}/${id}/run`, rest);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['lens', domain, 'get', variables.id] });
      qc.invalidateQueries({ queryKey: ['lens', domain, 'list'] });
    },
  });
}

/**
 * Export an artifact in a given format.
 */
export function useExportArtifact(domain: string) {
  return useMutation<{ ok: boolean; format: string; data: unknown }, Error, { id: string; format?: string }>({
    mutationFn: async ({ id, format = 'json' }) => {
      const { data } = await api.get(`/api/lens/${domain}/${id}/export?format=${format}`);
      return data;
    },
  });
}

/**
 * Bulk create artifacts in a domain.
 */
export function useBulkCreateArtifacts<T = Record<string, unknown>>(domain: string) {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; artifacts: LensArtifact<T>[]; count: number }, Error, { type: string; items: Array<{ title?: string; data?: Partial<T>; meta?: Record<string, unknown> }> }>({
    mutationFn: async (input) => {
      const { data } = await api.post(`/api/lens/${domain}/bulk`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lens', domain, 'list'] });
    },
  });
}
