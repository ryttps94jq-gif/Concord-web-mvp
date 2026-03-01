'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { useLensBridge } from '@/lib/hooks/use-lens-bridge';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  GraduationCap, Plus, TrendingUp, Award,
  ArrowRight, BarChart3, Zap, BookOpen, Layers, ChevronDown
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface Strategy {
  id: string;
  name: string;
  type: string;
  successRate?: number;
  uses?: number;
}

export default function MetalearningLensPage() {
  useLensNav('metalearning');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('metalearning');

  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('exploration');
  const [curriculumTopic, setCurriculumTopic] = useState('');
  const [results, setResults] = useState<unknown>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  // --- Lens Bridge ---
  const bridge = useLensBridge('metalearning', 'strategy');

  const { data: status, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['metalearning-status'],
    queryFn: () => apiHelpers.metalearning.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: strategies, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['metalearning-strategies'],
    queryFn: () => apiHelpers.metalearning.strategies().then((r) => r.data),
  });

  const { data: best, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['metalearning-best'],
    queryFn: () => apiHelpers.metalearning.bestStrategy().then((r) => r.data),
  });

  const createStrategy = useMutation({
    mutationFn: () => apiHelpers.metalearning.createStrategy({ name: newName, type: newType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metalearning-strategies'] });
      setNewName('');
    },
    onError: (err) => console.error('createStrategy failed:', err instanceof Error ? err.message : err),
  });

  const runCurriculum = useMutation({
    mutationFn: () => apiHelpers.metalearning.curriculum({ topic: curriculumTopic }),
    onSuccess: (res) => {
      setResults(res.data);
      setCurriculumTopic('');
    },
    onError: (err) => console.error('runCurriculum failed:', err instanceof Error ? err.message : err),
  });

  const strategyList: Strategy[] = strategies?.strategies || strategies || [];
  const statusInfo = status?.status || status || {};
  const bestStrategy = best?.strategy || best || null;

  // Bridge strategies into lens artifacts
  useEffect(() => {
    bridge.syncList(strategyList, (s) => {
      const strat = s as Strategy;
      return { title: strat.name, data: s as Record<string, unknown>, meta: { type: strat.type } };
    });
  }, [strategyList, bridge]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🎓</span>
        <div>
          <h1 className="text-xl font-bold">Meta-Learning Lens</h1>
          <p className="text-sm text-gray-400">
            Learning to learn — strategies, curriculum generation, and adaptation
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="metalearning" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      </header>

      {/* AI Actions */}
      <UniversalActions domain="metalearning" artifactId={bridge.selectedId} compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <GraduationCap className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{strategyList.length}</p>
          <p className="text-sm text-gray-400">Strategies</p>
        </div>
        <div className="lens-card">
          <Award className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">
            {bestStrategy ? bestStrategy.name?.slice(0, 8) || '—' : '—'}
          </p>
          <p className="text-sm text-gray-400">Best Strategy</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{statusInfo.adaptations || 0}</p>
          <p className="text-sm text-gray-400">Adaptations</p>
        </div>
        <div className="lens-card">
          <BookOpen className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{statusInfo.curricula || 0}</p>
          <p className="text-sm text-gray-400">Curricula</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Strategy */}
        <div className="panel p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-neon-purple" /> New Strategy
          </h2>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Strategy name..." className="input-lattice w-full" />
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="input-lattice w-full">
            <option value="exploration">Exploration</option>
            <option value="exploitation">Exploitation</option>
            <option value="hybrid">Hybrid</option>
            <option value="curriculum">Curriculum</option>
          </select>
          <button
            onClick={() => createStrategy.mutate()}
            disabled={!newName || createStrategy.isPending}
            className="btn-neon purple w-full"
          >
            {createStrategy.isPending ? 'Creating...' : 'Create Strategy'}
          </button>

          <div className="border-t border-lattice-border pt-3 mt-3">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="w-3 h-3 text-neon-cyan" /> Curriculum
            </h3>
            <input type="text" value={curriculumTopic} onChange={(e) => setCurriculumTopic(e.target.value)}
              placeholder="Topic to learn..." className="input-lattice w-full" />
            <button
              onClick={() => runCurriculum.mutate()}
              disabled={!curriculumTopic || runCurriculum.isPending}
              className="btn-neon w-full mt-2"
            >
              {runCurriculum.isPending ? 'Generating...' : 'Generate Curriculum'}
            </button>
          </div>
        </div>

        {/* Strategy List */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-blue" /> Strategies
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {strategyList.map((s) => (
              <div key={s.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-lattice-surface text-gray-400">{s.type}</span>
                </div>
                {s.successRate != null && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                      <div className="h-full bg-neon-green" style={{ width: `${s.successRate * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{(s.successRate * 100).toFixed(0)}% success</p>
                  </div>
                )}
              </div>
            ))}
            {strategyList.length === 0 && (
              <p className="text-center py-4 text-gray-500 text-sm">No strategies yet</p>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-neon-green" /> Results
          </h2>
          {results ? (
            <pre className="bg-lattice-surface p-3 rounded-lg whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-96 overflow-y-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          ) : (
            <p className="text-center py-12 text-gray-500 text-sm">
              Generate a curriculum or adapt a strategy to see results
            </p>
          )}
        </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="metalearning"
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
            <LensFeaturePanel lensId="metalearning" />
          </div>
        )}
      </div>
    </div>
  );
}
