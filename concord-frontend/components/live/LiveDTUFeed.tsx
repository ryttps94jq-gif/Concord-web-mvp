'use client';

import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { subscribe, connectSocket } from '@/lib/realtime/socket';
import { Zap, Sparkles, Star, Ghost } from 'lucide-react';

interface DTUEvent {
  id: string;
  title?: string;
  summary?: string;
  tier?: string;
  emergent?: string;
  actor?: string;
  timestamp: string;
  isNew?: boolean;
}

const TIER_CONFIG: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  regular: { icon: Zap, color: 'text-gray-400', label: 'Regular' },
  mega: { icon: Star, color: 'text-neon-cyan', label: 'Mega' },
  hyper: { icon: Sparkles, color: 'text-neon-purple', label: 'Hyper' },
  shadow: { icon: Ghost, color: 'text-gray-500', label: 'Shadow' },
};

export function LiveDTUFeed({ limit = 10 }: { limit?: number }) {
  const [liveDtus, setLiveDtus] = useState<DTUEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch recent DTUs as initial state
  const { data: dtusData } = useQuery({
    queryKey: ['dtus-recent'],
    queryFn: () => apiHelpers.dtus.paginated({ limit, pageSize: limit }).then(r => r.data),
    refetchInterval: 60000,
  });

  // Populate initial list from query
  useEffect(() => {
    const items = (dtusData as { dtus?: DTUEvent[]; items?: DTUEvent[] })?.dtus
      || (dtusData as { dtus?: DTUEvent[]; items?: DTUEvent[] })?.items
      || [];
    if (items.length > 0 && liveDtus.length === 0) {
      setLiveDtus(items.slice(0, limit).map((d: Record<string, unknown>) => ({
        id: d.id as string || '',
        title: d.title as string || d.summary as string || '',
        summary: d.summary as string || '',
        tier: d.tier as string || 'regular',
        emergent: d.emergent as string || d.actor as string || '',
        timestamp: d.timestamp as string || d.created_at as string || new Date().toISOString(),
        isNew: false,
      })));
    }
  }, [dtusData, limit]);

  // Subscribe to real-time DTU creation
  useEffect(() => {
    connectSocket();

    const unsub = subscribe<Record<string, unknown>>('dtu:created', (data) => {
      const newDtu: DTUEvent = {
        id: data.id as string || crypto.randomUUID(),
        title: data.title as string || data.summary as string || 'New DTU',
        summary: data.summary as string || '',
        tier: data.tier as string || 'regular',
        emergent: data.emergent as string || data.actor as string || '',
        timestamp: data.timestamp as string || new Date().toISOString(),
        isNew: true,
      };

      setLiveDtus(prev => [newDtu, ...prev].slice(0, limit));

      // Clear "new" flag after animation
      setTimeout(() => {
        setLiveDtus(prev => prev.map(d => d.id === newDtu.id ? { ...d, isNew: false } : d));
      }, 2000);
    });

    return unsub;
  }, [limit]);

  return (
    <div className="rounded-xl border border-lattice-border bg-lattice-surface/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon-blue" />
          Live DTU Birth Feed
        </h2>
        <span className="text-xs text-gray-500">{liveDtus.length} recent</span>
      </div>

      <div ref={feedRef} className="space-y-1 max-h-[320px] overflow-y-auto no-scrollbar">
        {liveDtus.length === 0 ? (
          <div className="text-center py-6">
            <Zap className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">Waiting for new DTUs...</p>
          </div>
        ) : (
          liveDtus.map((dtu) => {
            const tierConf = TIER_CONFIG[dtu.tier || 'regular'] || TIER_CONFIG.regular;
            const TierIcon = tierConf.icon;
            return (
              <div
                key={dtu.id}
                className={`flex items-start gap-2 px-2 py-2 rounded-lg transition-all ${
                  dtu.isNew
                    ? 'bg-neon-cyan/10 border border-neon-cyan/30 animate-pulse'
                    : 'hover:bg-lattice-deep/50'
                }`}
              >
                <TierIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tierConf.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">
                    {dtu.title || dtu.summary || dtu.id.slice(0, 12)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {dtu.emergent && (
                      <span className="text-[10px] text-neon-purple">{dtu.emergent}</span>
                    )}
                    <span className={`text-[10px] ${tierConf.color}`}>{tierConf.label}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0">
                  {new Date(dtu.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
