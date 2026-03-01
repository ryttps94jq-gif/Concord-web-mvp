'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { BarChart3, TrendingUp, AlertTriangle, Star, ArrowUpDown, Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface DTUWithCRETI {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  tier?: string;
  domain?: string;
  creti?: {
    coherence?: number;
    relevance?: number;
    evidence?: number;
    timeliness?: number;
    integration?: number;
    composite?: number;
  };
  createdAt?: string;
}

const CRETI_KEYS = ['coherence', 'relevance', 'evidence', 'timeliness', 'integration'] as const;
const CRETI_COLORS: Record<string, string> = {
  coherence: '#00d4ff',
  relevance: '#a855f7',
  evidence: '#22c55e',
  timeliness: '#f59e0b',
  integration: '#ec4899',
};

export default function CRILensPage() {
  useLensNav('cri');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('cri');

  const [sortKey, setSortKey] = useState<string>('composite');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedDtu, setSelectedDtu] = useState<DTUWithCRETI | null>(null);
  const [thresholdFilter, setThresholdFilter] = useState(0);
  const [showFeatures, setShowFeatures] = useState(false);

  const { data: dtusData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cri-dtus'],
    queryFn: () => api.get('/api/dtus?limit=300').then(r => r.data).catch(() => ({ dtus: [] })),
  });

  const dtus: DTUWithCRETI[] = useMemo(() => dtusData?.dtus || [], [dtusData]);

  // Compute composite score if not present
  const getComposite = (dtu: DTUWithCRETI): number => {
    if (dtu.creti?.composite != null) return dtu.creti.composite;
    const scores = CRETI_KEYS.map(k => (dtu.creti as Record<string, number>)?.[k] ?? 0);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  // Distribution stats
  const distribution = useMemo(() => {
    const composites = dtus.map(d => getComposite(d));
    if (composites.length === 0) return { avg: 0, min: 0, max: 0, median: 0, buckets: new Array(10).fill(0) };

    const sorted = [...composites].sort((a, b) => a - b);
    const buckets = new Array(10).fill(0);
    composites.forEach(c => {
      const bucket = Math.min(9, Math.floor(c * 10));
      buckets[bucket]++;
    });

    return {
      avg: composites.reduce((a, b) => a + b, 0) / composites.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      buckets,
    };
  }, [dtus]);

  // Per-dimension averages
  const dimAverages = useMemo(() => {
    const result: Record<string, number> = {};
    CRETI_KEYS.forEach(key => {
      const vals = dtus.map(d => (d.creti as Record<string, number>)?.[key]).filter(v => v != null) as number[];
      result[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    return result;
  }, [dtus]);

  // Filtered and sorted DTUs
  const sortedDtus = useMemo(() => {
    const filtered = dtus.filter(d => getComposite(d) >= thresholdFilter);

    filtered.sort((a, b) => {
      const aVal = sortKey === 'composite' ? getComposite(a) : ((a.creti as Record<string, number>)?.[sortKey] ?? 0);
      const bVal = sortKey === 'composite' ? getComposite(b) : ((b.creti as Record<string, number>)?.[sortKey] ?? 0);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [dtus, sortKey, sortDir, thresholdFilter]);

  // Outliers — top and bottom 5
  const outliers = useMemo(() => {
    const byScore = [...dtus].sort((a, b) => getComposite(b) - getComposite(a));
    return {
      top: byScore.slice(0, 5),
      bottom: byScore.slice(-5).reverse(),
    };
  }, [dtus]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={(error as Error)?.message} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-neon-cyan" />
        <div>
          <h1 className="text-xl font-bold">CRI - CRETI Scores</h1>
          <p className="text-sm text-gray-400">
            Coherence, Relevance, Evidence, Timeliness, Integration across all DTUs
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="cri" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-lattice-surface animate-pulse rounded-lg" />)}
        </div>
      ) : dtus.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No DTUs with CRETI scores yet.</p>
          <p className="text-xs text-gray-500 mt-1">Create DTUs in the Chat lens to see score distribution here.</p>
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-white">{dtus.length}</p>
              <p className="text-xs text-gray-400">Total DTUs</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-cyan">{(distribution.avg * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400">Avg Score</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-green">{(distribution.max * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400">Max Score</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-purple">{(distribution.median * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400">Median</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-gray-400">{(distribution.min * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400">Min Score</p>
            </div>
          </div>

          {/* Distribution chart */}
          <div className="panel p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-cyan" />
              Score Distribution
            </h2>
            <div className="flex items-end gap-1 h-32">
              {distribution.buckets.map((count, i) => {
                const maxBucket = Math.max(...distribution.buckets, 1);
                const height = (count / maxBucket) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500">{count}</span>
                    <div
                      className="w-full bg-neon-cyan/30 rounded-t transition-all"
                      style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                    />
                    <span className="text-[10px] text-gray-600">{i * 10}-{(i + 1) * 10}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-dimension averages */}
          <div className="panel p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Dimension Averages</h2>
            <div className="space-y-2">
              {CRETI_KEYS.map(key => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-24 capitalize">{key}</span>
                  <div className="flex-1 h-3 bg-lattice-deep rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${dimAverages[key] * 100}%`, backgroundColor: CRETI_COLORS[key] }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 w-12 text-right">{(dimAverages[key] * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outliers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-neon-green mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" /> Top Performers
              </h2>
              <div className="space-y-2">
                {outliers.top.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDtu(d)}
                    className="w-full text-left p-2 rounded-lg bg-lattice-deep hover:bg-lattice-elevated transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white truncate flex-1">{d.title || d.summary?.slice(0, 40) || d.id.slice(0, 8)}</span>
                      <span className="text-xs font-mono text-neon-green ml-2">{(getComposite(d) * 100).toFixed(0)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel p-4">
              <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Needs Improvement
              </h2>
              <div className="space-y-2">
                {outliers.bottom.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDtu(d)}
                    className="w-full text-left p-2 rounded-lg bg-lattice-deep hover:bg-lattice-elevated transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white truncate flex-1">{d.title || d.summary?.slice(0, 40) || d.id.slice(0, 8)}</span>
                      <span className="text-xs font-mono text-amber-400 ml-2">{(getComposite(d) * 100).toFixed(0)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full table */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">All DTU Scores</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Min score:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={thresholdFilter * 100}
                  onChange={(e) => setThresholdFilter(+e.target.value / 100)}
                  className="w-24"
                />
                <span className="text-xs text-gray-400">{(thresholdFilter * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-lattice-border">
                    <th className="text-left py-2 px-2 text-gray-400">DTU</th>
                    {['composite', ...CRETI_KEYS].map(key => (
                      <th key={key} className="text-right py-2 px-2">
                        <button
                          onClick={() => toggleSort(key)}
                          className={cn(
                            'flex items-center gap-1 ml-auto capitalize',
                            sortKey === key ? 'text-neon-cyan' : 'text-gray-500 hover:text-gray-300'
                          )}
                        >
                          {key.slice(0, 4)}
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedDtus.slice(0, 50).map(d => (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedDtu(d)}
                      className={cn(
                        'border-b border-lattice-border/30 cursor-pointer hover:bg-lattice-deep transition-colors',
                        selectedDtu?.id === d.id ? 'bg-lattice-deep' : ''
                      )}
                    >
                      <td className="py-2 px-2 text-white truncate max-w-[200px]">
                        {d.title || d.summary?.slice(0, 30) || d.id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-neon-cyan">
                        {(getComposite(d) * 100).toFixed(0)}%
                      </td>
                      {CRETI_KEYS.map(key => {
                        const val = (d.creti as Record<string, number>)?.[key] ?? 0;
                        return (
                          <td key={key} className="py-2 px-2 text-right font-mono" style={{ color: CRETI_COLORS[key] }}>
                            {(val * 100).toFixed(0)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedDtus.length > 50 && (
                <p className="text-xs text-gray-500 text-center py-2">Showing 50 of {sortedDtus.length} DTUs</p>
              )}
            </div>
          </div>

          {/* Selected DTU detail */}
          {selectedDtu && (
            <div className="panel p-4">
              <h2 className="font-semibold text-white mb-3">
                {selectedDtu.title || selectedDtu.summary?.slice(0, 60) || 'DTU Detail'}
              </h2>
              <div className="grid grid-cols-5 gap-3">
                {CRETI_KEYS.map(key => {
                  const val = (selectedDtu.creti as Record<string, number>)?.[key] ?? 0;
                  return (
                    <div key={key} className="text-center">
                      <div className="w-14 h-14 mx-auto rounded-full border-4 flex items-center justify-center"
                        style={{ borderColor: CRETI_COLORS[key] }}>
                        <span className="text-sm font-bold" style={{ color: CRETI_COLORS[key] }}>
                          {(val * 100).toFixed(0)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 capitalize">{key}</p>
                    </div>
                  );
                })}
              </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="cri"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
            </div>
          )}
        </>
      )}

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Lens Features & Capabilities
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-4">
            <LensFeaturePanel lensId="cri" />
          </div>
        )}
      </div>
    </div>
  );
}
