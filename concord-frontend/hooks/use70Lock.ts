import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useCallback } from 'react';

interface SovereigntyStatus {
  lockPercentage: number;
  invariants: Invariant[];
  lastAudit: string;
  isHealthy: boolean;
}

interface Invariant {
  id: string;
  name: string;
  status: 'enforced' | 'warning' | 'violated';
  description: string;
  lastChecked: string;
}

/**
 * Hook for managing the 70% sovereignty lock
 * The 70% lock ensures that core ethos invariants are always enforced
 */
export function use70Lock() {
  const queryClient = useQueryClient();

  // Fetch sovereignty status
  const {
    data: status,
    isLoading,
    error,
  } = useQuery<SovereigntyStatus>({
    queryKey: ['sovereignty-status'],
    queryFn: () => api.get('/api/sovereignty/status').then((r) => r.data),
    refetchInterval: 60000, // Check every minute
  });

  // Trigger manual audit
  const auditMutation = useMutation({
    mutationFn: () => api.post('/api/sovereignty/audit'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sovereignty-status'] });
    },
  });

  // Check if above 70% threshold
  const isLocked = (status?.lockPercentage ?? 0) >= 70;

  // Get lock color based on percentage
  const getLockColor = useCallback((percentage: number) => {
    if (percentage >= 70) return 'sovereignty-locked'; // Green
    if (percentage >= 50) return 'sovereignty-warning'; // Yellow
    return 'sovereignty-danger'; // Red
  }, []);

  // Get invariant status summary
  const invariantSummary = {
    enforced: status?.invariants.filter((i) => i.status === 'enforced').length ?? 0,
    warning: status?.invariants.filter((i) => i.status === 'warning').length ?? 0,
    violated: status?.invariants.filter((i) => i.status === 'violated').length ?? 0,
  };

  return {
    // State
    lockPercentage: status?.lockPercentage ?? 0,
    invariants: status?.invariants ?? [],
    lastAudit: status?.lastAudit,
    isHealthy: status?.isHealthy ?? true,

    // Computed
    isLocked,
    lockColor: getLockColor(status?.lockPercentage ?? 0),
    invariantSummary,

    // Loading state
    isLoading,
    error,

    // Actions
    runAudit: auditMutation.mutate,
    isAuditing: auditMutation.isPending,
  };
}

// Default ethos invariants (used when server is unavailable)
export const DEFAULT_INVARIANTS: Invariant[] = [
  {
    id: 'no-telemetry',
    name: 'NO_TELEMETRY',
    status: 'enforced',
    description: 'No external analytics or tracking',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'no-ads',
    name: 'NO_ADS',
    status: 'enforced',
    description: 'No advertisements or sponsored content',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'no-resale',
    name: 'NO_RESALE',
    status: 'enforced',
    description: 'User data is never sold',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'local-first',
    name: 'LOCAL_FIRST',
    status: 'enforced',
    description: 'Local processing prioritized over cloud',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'owner-control',
    name: 'OWNER_CONTROL',
    status: 'enforced',
    description: 'Owner maintains full control of data',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'transparent-ops',
    name: 'TRANSPARENT_OPS',
    status: 'enforced',
    description: 'All operations are auditable',
    lastChecked: new Date().toISOString(),
  },
  {
    id: 'no-dark-patterns',
    name: 'NO_DARK_PATTERNS',
    status: 'enforced',
    description: 'No manipulative UI/UX patterns',
    lastChecked: new Date().toISOString(),
  },
];
