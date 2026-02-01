// DTU (Discrete Thought Unit) types

export type DTUTier = 'regular' | 'mega' | 'hyper' | 'shadow';

export interface DTU {
  id: string;
  tier: DTUTier;
  content: string;
  summary: string;
  timestamp: string;
  updatedAt?: string;

  // Relationships
  parentId?: string;
  childIds?: string[];
  relatedIds?: string[];

  // Metrics
  resonance?: number;
  coherence?: number;
  stability?: number;

  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;

  // Governance
  ownerId?: string;
  permissions?: DTUPermissions;
}

export interface DTUPermissions {
  read: string[];
  write: string[];
  delete: string[];
  promote: string[];
}

export interface DTULineage {
  dtu: DTU;
  ancestors: DTU[];
  descendants: DTU[];
  depth: number;
}

export interface DTUCreateInput {
  content: string;
  tier?: DTUTier;
  parentId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DTUUpdateInput {
  content?: string;
  summary?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DTUPromoteInput {
  targetTier: DTUTier;
  reason?: string;
}

export interface DTUSearchParams {
  query?: string;
  tier?: DTUTier | DTUTier[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'resonance' | 'coherence';
  sortOrder?: 'asc' | 'desc';
}

export interface DTUSearchResult {
  dtus: DTU[];
  total: number;
  hasMore: boolean;
}

// Tier configuration
export const DTU_TIER_CONFIG: Record<
  DTUTier,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    minResonance: number;
    maxChildren: number;
  }
> = {
  regular: {
    label: 'Regular',
    color: 'text-neon-blue',
    bgColor: 'bg-neon-blue/10',
    borderColor: 'border-neon-blue/30',
    minResonance: 0,
    maxChildren: 10,
  },
  mega: {
    label: 'Mega',
    color: 'text-neon-purple',
    bgColor: 'bg-neon-purple/10',
    borderColor: 'border-neon-purple/30',
    minResonance: 0.5,
    maxChildren: 50,
  },
  hyper: {
    label: 'Hyper',
    color: 'text-neon-pink',
    bgColor: 'bg-neon-pink/10',
    borderColor: 'border-neon-pink/30',
    minResonance: 0.8,
    maxChildren: 100,
  },
  shadow: {
    label: 'Shadow',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    minResonance: 0,
    maxChildren: 5,
  },
};

export function canPromote(currentTier: DTUTier, targetTier: DTUTier): boolean {
  const tierOrder: DTUTier[] = ['regular', 'mega', 'hyper'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  // Shadow DTUs cannot be promoted
  if (currentTier === 'shadow') return false;

  // Can only promote to higher tier
  return targetIndex > currentIndex;
}
