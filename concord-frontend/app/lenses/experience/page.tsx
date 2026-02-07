'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Brain, TrendingUp, Search, Layers,
  BarChart3, Zap, BookOpen, RefreshCw
} from 'lucide-react';

interface Pattern {
  id: string;
  domain: string;
  bestStrategy: string;
  confidence: number;
  episodeCount: number;
  keywords: string[];
}

interface Strategy {
  domain: string;
  strategy: string;
  uses: number;
  avgQuality: number;
}

export default function ExperienceLensPage() {
  useLensNav('experience');

  const queryClient = useQueryClient();
  const [retrieveDomain, setRetrieveDomain] = useState('general');
  const [retrieveTopic, setRetrieveTopic] = useState('');
  const [retrieveResult, setRetrieveResult] = useState<unknown>(null);

  const { data: status } = useQuery({
    queryKey: ['experience-status'],
    queryFn: () => apiHelpers.experience.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: patterns } = useQuery({
    queryKey: ['experience-patterns'],
    queryFn: () => apiHelpers.experience.patterns().then((r) => r.data),
  });

  const { data: strategies } = useQuery({
    queryKey: ['experience-strategies'],
    queryFn: () => apiHelpers.experience.strategies().then((r) => r.data),
  });

  const { data: recent } = useQuery({
    queryKey: ['experience-recent'],
    queryFn: () => apiHelpers.experience.recent(10).then((r) => r.data),
  });

  const consolidate = useMutation({
    mutationFn: () => apiHelpers.experience.consolidate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experience-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['experience-status'] });
    },
  });

  const retrieve = useMutation({
    mutationFn: () => apiHelpers.experience.retrieve({ domain: retrieveDomain, topic: retrieveTopic }),
    onSuccess: (res) => setRetrieveResult(res.data),
  });

  const patternList: Pattern[] = patterns?.patterns || [];
  const strategyList: Strategy[] = strategies?.strategies || [];
  const recentEpisodes = recent?.episodes || [];
  const stats = status?.stats || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="text-xl font-bold">Experience Learning Lens</h1>
          <p className="text-sm text-gray-400">
            Permanent interaction memory — learns what works from every conversation
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{status?.episodes || 0}</p>
          <p className="text-sm text-gray-400">Episodes</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{status?.patterns || 0}</p>
          <p className="text-sm text-gray-400">Patterns</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{status?.strategies || 0}</p>
          <p className="text-sm text-gray-400">Strategies</p>
        </div>
        <div className="lens-card">
          <BarChart3 className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{stats.retrievalsUsed || 0}</p>
          <p className="text-sm text-gray-400">Retrievals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retrieve Experience */}
        <div className="panel p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-neon-purple" /> Retrieve Experience
          </h2>
          <select value={retrieveDomain} onChange={(e) => setRetrieveDomain(e.target.value)} className="input-lattice w-full">
            <option value="general">General</option>
            <option value="technical">Technical</option>
            <option value="scientific">Scientific</option>
            <option value="creative">Creative</option>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
          </select>
          <input type="text" value={retrieveTopic} onChange={(e) => setRetrieveTopic(e.target.value)}
            placeholder="Topic to look up..." className="input-lattice w-full" />
          <button onClick={() => retrieve.mutate()} disabled={retrieve.isPending}
            className="btn-neon purple w-full">
            {retrieve.isPending ? 'Searching...' : 'Search Experience'}
          </button>
          <button onClick={() => consolidate.mutate()} disabled={consolidate.isPending}
            className="btn-neon w-full flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {consolidate.isPending ? 'Consolidating...' : 'Consolidate Patterns'}
          </button>

          {retrieveResult && (
            <div className="mt-3 bg-lattice-surface p-3 rounded-lg text-xs">
              {retrieveResult.bestStrategy && (
                <p className="text-neon-green mb-1">Best strategy: <strong>{retrieveResult.bestStrategy}</strong> (confidence: {((retrieveResult.confidence || 0) * 100).toFixed(0)}%)</p>
              )}
              {retrieveResult.warnings?.length > 0 && (
                <div className="text-yellow-400 mb-1">{retrieveResult.warnings.map((w: string, i: number) => <p key={i}>{w}</p>)}</div>
              )}
              {retrieveResult.relevantPatterns?.length > 0 && (
                <p className="text-gray-400">{retrieveResult.relevantPatterns.length} matching patterns found</p>
              )}
            </div>
          )}
        </div>

        {/* Patterns */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-neon-cyan" /> Learned Patterns
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {patternList.map((p) => (
              <div key={p.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.domain}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">{p.bestStrategy}</span>
                </div>
                <div className="mt-2">
                  <div className="h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                    <div className="h-full bg-neon-cyan" style={{ width: `${p.confidence * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{(p.confidence * 100).toFixed(0)}% confidence — {p.episodeCount} episodes</p>
                </div>
                {p.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.keywords.slice(0, 5).map((kw, i) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-lattice-surface text-gray-400">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {patternList.length === 0 && (
              <p className="text-center py-4 text-gray-500 text-sm">No patterns yet — interact more to build experience</p>
            )}
          </div>
        </div>

        {/* Recent Episodes + Strategies */}
        <div className="panel p-4 space-y-4">
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-neon-yellow" /> Top Strategies
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {strategyList.slice(0, 10).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{s.domain}: {s.strategy}</span>
                  <span className="text-xs text-neon-green">{(s.avgQuality * 100).toFixed(0)}% ({s.uses})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-lattice-border pt-3">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-neon-blue" /> Recent Episodes
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentEpisodes.slice(0, 8).map((ep: Record<string, unknown>, i: number) => (
                <div key={i} className="lens-card text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-300 truncate">{ep.context?.topic || ep.context?.domain || 'Unknown'}</span>
                    <span className={`${ep.outcome?.quality > 0.6 ? 'text-neon-green' : 'text-yellow-400'}`}>
                      {((ep.outcome?.quality || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
