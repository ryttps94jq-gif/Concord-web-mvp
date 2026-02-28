'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Search, Filter, ArrowRight, BookOpen, Tag, Calendar, Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { LensContextPanel } from '@/components/lens/LensContextPanel';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface DTUResult {
  id: string;
  title?: string;
  content?: string;
  summary?: string;
  domain?: string;
  tier?: string;
  tags?: string[];
  createdAt?: string;
  creti?: Record<string, number>;
}

export default function ResearchLensPage() {
  useLensNav('research');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('research');

  const {
    hyperDTUs, megaDTUs, regularDTUs,
    tierDistribution, publishToMarketplace,
    isLoading: dtusLoading, refetch: refetchDTUs,
  } = useLensDTUs({ lens: 'research' });

  const [query, setQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'tier'>('date');
  const [selectedDtu, setSelectedDtu] = useState<DTUResult | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  const { data: dtusData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['research-dtus'],
    queryFn: () => api.get('/api/dtus?limit=200').then(r => r.data).catch(() => ({ dtus: [] })),
  });

  const dtus: DTUResult[] = useMemo(() => dtusData?.dtus || [], [dtusData]);

  // Extract unique domains and tags for filters
  const domains = useMemo(() => {
    const set = new Set<string>();
    dtus.forEach(d => { if (d.domain) set.add(d.domain); });
    return Array.from(set).sort();
  }, [dtus]);

  // Full-text search + filtering
  const results = useMemo(() => {
    let filtered = [...dtus];

    // Text search
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(d => {
        const text = [d.title, d.content, d.summary, ...(d.tags || [])].join(' ').toLowerCase();
        return text.includes(q);
      });
    }

    // Domain filter
    if (domainFilter) {
      filtered = filtered.filter(d => d.domain === domainFilter);
    }

    // Tier filter
    if (tierFilter) {
      filtered = filtered.filter(d => d.tier === tierFilter);
    }

    // Sort
    if (sortBy === 'date') {
      filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } else if (sortBy === 'tier') {
      const tierOrder: Record<string, number> = { hyper: 0, mega: 1, regular: 2, shadow: 3 };
      filtered.sort((a, b) => (tierOrder[a.tier || 'regular'] || 2) - (tierOrder[b.tier || 'regular'] || 2));
    }

    return filtered;
  }, [dtus, query, domainFilter, tierFilter, sortBy]);

  // Snippet generation
  const getSnippet = (dtu: DTUResult): string => {
    const text = dtu.content || dtu.summary || dtu.title || '';
    if (!query) return text.slice(0, 200);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, 200);
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + query.length + 100);
    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
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
        <BookOpen className="w-6 h-6 text-neon-cyan" />
        <div>
          <h1 className="text-xl font-bold">Research</h1>
          <p className="text-sm text-gray-400">
            Search across all DTUs with full-text search and filters
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="research" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      </header>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search DTUs by title, content, tags..."
          className="w-full pl-12 pr-4 py-3 bg-lattice-surface border border-lattice-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan text-sm"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="px-3 py-1.5 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white"
          >
            <option value="">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-3 py-1.5 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white"
        >
          <option value="">All Tiers</option>
          <option value="hyper">Hyper</option>
          <option value="mega">Mega</option>
          <option value="regular">Regular</option>
          <option value="shadow">Shadow</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date' | 'tier')}
          className="px-3 py-1.5 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white"
        >
          <option value="date">Sort by Date</option>
          <option value="tier">Sort by Tier</option>
          <option value="relevance">Sort by Relevance</option>
        </select>
        <span className="text-sm text-gray-500 self-center ml-auto">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results list */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 bg-lattice-surface animate-pulse rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {query ? `No results for "${query}"` : 'No DTUs found. Create some in the Chat lens.'}
              </p>
            </div>
          ) : (
            results.map(dtu => (
              <button
                key={dtu.id}
                onClick={() => setSelectedDtu(dtu)}
                className={cn(
                  'w-full text-left p-4 rounded-lg border transition-colors',
                  selectedDtu?.id === dtu.id
                    ? 'bg-lattice-surface border-neon-cyan/50'
                    : 'bg-lattice-surface/50 border-lattice-border hover:border-gray-600'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {dtu.title || dtu.summary?.slice(0, 80) || `DTU ${dtu.id.slice(0, 8)}`}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{getSnippet(dtu)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {dtu.domain && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan">{dtu.domain}</span>
                      )}
                      {dtu.tier && dtu.tier !== 'regular' && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded',
                          dtu.tier === 'hyper' ? 'bg-pink-500/20 text-pink-400' :
                          dtu.tier === 'mega' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-gray-500/20 text-gray-400'
                        )}>{dtu.tier}</span>
                      )}
                      {(dtu.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="panel p-4 space-y-4 sticky top-4">
          {selectedDtu ? (
            <>
              <h2 className="font-semibold text-white">
                {selectedDtu.title || selectedDtu.summary?.slice(0, 60) || 'DTU Detail'}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Layers className="w-4 h-4" />
                  <span>Tier: {selectedDtu.tier || 'regular'}</span>
                </div>
                {selectedDtu.domain && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <BookOpen className="w-4 h-4" />
                    <span>Domain: {selectedDtu.domain}</span>
                  </div>
                )}
                {selectedDtu.createdAt && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(selectedDtu.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
                {(selectedDtu.tags || []).length > 0 && (
                  <div className="flex items-center gap-2 text-gray-400 flex-wrap">
                    <Tag className="w-4 h-4" />
                    {selectedDtu.tags!.map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-lattice-deep text-gray-300">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="pt-3 border-t border-lattice-border">
                  <p className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">
                    {selectedDtu.content || selectedDtu.summary || 'No content available.'}
                  </p>
                </div>
                {selectedDtu.creti && (
                  <div className="pt-3 border-t border-lattice-border">
                    <p className="text-xs font-medium text-gray-400 mb-2">CRETI Scores</p>
                    <div className="space-y-1">
                      {Object.entries(selectedDtu.creti).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20">{key}</span>
                          <div className="flex-1 h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                            <div className="h-full bg-neon-cyan rounded-full" style={{ width: `${(val as number) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">{((val as number) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a result to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* DTU Context */}
      <div className="mt-6 space-y-3">
        <LensContextPanel
          hyperDTUs={hyperDTUs}
          megaDTUs={megaDTUs}
          regularDTUs={regularDTUs}
          tierDistribution={tierDistribution}
          onPublish={(dtu) => publishToMarketplace({ dtuId: dtu.id })}
          title="Research DTUs"
        />
        <FeedbackWidget targetType="lens" targetId="research" />

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="research"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>

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
            <LensFeaturePanel lensId="research" />
          </div>
        )}
      </div>
    </div>
  );
}
