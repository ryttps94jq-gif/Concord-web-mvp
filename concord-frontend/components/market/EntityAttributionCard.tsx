'use client';

/**
 * EntityAttributionCard — Shows entity profile for marketplace artifacts.
 * Displays species, maturity, production stats, and domain expertise.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface EntityAttributionCardProps {
  entityId: string;
  compact?: boolean;
}

function EntityAttributionCardInner({ entityId, compact = false }: EntityAttributionCardProps) {
  const { data: entity } = useQuery({
    queryKey: ['entity-profile', entityId],
    queryFn: () => api.get(`/api/entity/${entityId}/profile`).then(r => r.data),
    enabled: !!entityId,
    retry: false,
  });

  if (!entity) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue
          flex items-center justify-center text-white text-[10px] font-bold">
          {entity.species?.[0]?.toUpperCase() || 'E'}
        </div>
        <span>Entity {entity.id?.slice(-6)}</span>
        <span className="text-zinc-600">|</span>
        <span>{(entity.organMaturity * 100).toFixed(0)}% mature</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue
        flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {entity.species?.[0]?.toUpperCase() || 'E'}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">
          Entity {entity.id?.slice(-6)}
          {entity.species && <span className="text-zinc-500 ml-1">({entity.species})</span>}
        </p>
        <div className="flex gap-3 text-xs text-zinc-400 flex-wrap">
          <span>Maturity: {(entity.organMaturity * 100).toFixed(0)}%</span>
          <span>Produced: {entity.totalArtifacts}</span>
          <span>Approved: {entity.approvedRate}%</span>
        </div>
        {entity.topDomains?.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {entity.topDomains.slice(0, 3).map((d: { domain: string }) => (
              <span key={d.domain} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                {d.domain}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const EntityAttributionCard = React.memo(EntityAttributionCardInner);
export default EntityAttributionCard;
