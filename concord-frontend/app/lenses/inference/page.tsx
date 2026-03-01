'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useMemo, useEffect } from 'react';
import { useLensBridge } from '@/lib/hooks/use-lens-bridge';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  GitMerge, Plus, ArrowRight, Database, Search, Zap,
  Clock, Gauge, Activity, ListOrdered, ChevronDown, ChevronUp,
  RefreshCw, AlertCircle, CheckCircle2, Timer, Layers
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface InferenceHistoryEntry {
  id?: string;
  type: string;
  query?: string;
  result?: unknown;
  confidence?: number;
  latencyMs?: number;
  timestamp?: string;
  status?: string;
}

const MODEL_OPTIONS = [
  { id: 'default', label: 'Default Engine', description: 'Built-in logical inference' },
  { id: 'forward-chain', label: 'Forward Chaining', description: 'Rule-based forward reasoning' },
  { id: 'backward-chain', label: 'Backward Chaining', description: 'Goal-directed reasoning' },
  { id: 'probabilistic', label: 'Probabilistic', description: 'Bayesian inference model' },
];

export default function InferenceLensPage() {
  useLensNav('inference');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('inference');

  const queryClient = useQueryClient();
  const [factInput, setFactInput] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [majorPremise, setMajorPremise] = useState('');
  const [minorPremise, setMinorPremise] = useState('');
  const [results, setResults] = useState<unknown>(null);
  const [tab, setTab] = useState<'facts' | 'query' | 'syllogism' | 'forward'>('facts');
  const [selectedModel, setSelectedModel] = useState('default');
  const [inferenceHistory, setInferenceHistory] = useState<InferenceHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  // --- Lens Bridge ---
  const bridge = useLensBridge('inference', 'snapshot');

  const { data: status, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inference-status'],
    queryFn: () => apiHelpers.inference.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const trackInference = (type: string, query: string | undefined, result: unknown, startTime: number) => {
    const entry: InferenceHistoryEntry = {
      id: `inf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      query,
      result,
      confidence: typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>).confidence as number | undefined
        : undefined,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    setInferenceHistory(prev => [entry, ...prev].slice(0, 50));
  };

  const addFacts = useMutation({
    mutationFn: () => {
      const startTime = Date.now();
      return apiHelpers.inference.facts({ facts: factInput.split('\n').filter(Boolean) }).then(res => {
        trackInference('add-facts', `${factInput.split('\n').filter(Boolean).length} facts`, res.data, startTime);
        return res;
      });
    },
    onSuccess: (res) => {
      setResults(res.data);
      queryClient.invalidateQueries({ queryKey: ['inference-status'] });
      setFactInput('');
    },
    onError: (err) => console.error('addFacts failed:', err instanceof Error ? err.message : err),
  });

  const runQuery = useMutation({
    mutationFn: () => {
      const startTime = Date.now();
      return apiHelpers.inference.query({ query: queryInput }).then(res => {
        trackInference('query', queryInput, res.data, startTime);
        return res;
      });
    },
    onSuccess: (res) => setResults(res.data),
    onError: (err) => console.error('runQuery failed:', err instanceof Error ? err.message : err),
  });

  const runSyllogism = useMutation({
    mutationFn: () => {
      const startTime = Date.now();
      return apiHelpers.inference.syllogism({ major: majorPremise, minor: minorPremise }).then(res => {
        trackInference('syllogism', `${majorPremise} + ${minorPremise}`, res.data, startTime);
        return res;
      });
    },
    onSuccess: (res) => setResults(res.data),
    onError: (err) => console.error('runSyllogism failed:', err instanceof Error ? err.message : err),
  });

  const runForwardChain = useMutation({
    mutationFn: () => {
      const startTime = Date.now();
      return apiHelpers.inference.forwardChain({}).then(res => {
        trackInference('forward-chain', 'Full forward chain', res.data, startTime);
        return res;
      });
    },
    onSuccess: (res) => setResults(res.data),
    onError: (err) => console.error('runForwardChain failed:', err instanceof Error ? err.message : err),
  });

  const statusInfo = status?.status || status || {};

  // Bridge inference status into lens artifacts
  useEffect(() => {
    if (Object.keys(statusInfo).length > 0) {
      bridge.sync(statusInfo as Record<string, unknown>, 'Inference Engine Status');
    }
  }, [statusInfo, bridge]);

  const avgLatency = useMemo(() => {
    if (inferenceHistory.length === 0) return 0;
    return inferenceHistory.reduce((s, h) => s + (h.latencyMs || 0), 0) / inferenceHistory.length;
  }, [inferenceHistory]);

  const resultConfidence = useMemo(() => {
    if (!results || typeof results !== 'object') return null;
    const r = results as Record<string, unknown>;
    return r.confidence as number | undefined ?? r.score as number | undefined ?? null;
  }, [results]);

  const isPending = addFacts.isPending || runQuery.isPending || runSyllogism.isPending || runForwardChain.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading inference engine...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitMerge className="w-7 h-7 text-neon-blue" />
          <div>
            <h1 className="text-xl font-bold">Inference Lens</h1>
            <p className="text-sm text-gray-400">
              Logical inference engine -- facts, rules, syllogisms, forward chaining
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="inference" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <div className="flex items-center gap-2">
          <UniversalActions domain="inference" artifactId={bridge.selectedId} compact />
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-lattice-surface hover:bg-lattice-border transition-colors text-gray-400 hover:text-white"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{statusInfo.factCount || 0}</p>
          <p className="text-sm text-gray-400">Facts</p>
        </div>
        <div className="lens-card">
          <GitMerge className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{statusInfo.ruleCount || 0}</p>
          <p className="text-sm text-gray-400">Rules</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{statusInfo.inferences || 0}</p>
          <p className="text-sm text-gray-400">Inferences</p>
        </div>
        <div className="lens-card">
          <Search className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{statusInfo.queries || 0}</p>
          <p className="text-sm text-gray-400">Queries</p>
        </div>
        <div className="lens-card">
          <Timer className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{avgLatency > 0 ? `${avgLatency.toFixed(0)}ms` : '--'}</p>
          <p className="text-sm text-gray-400">Avg Latency</p>
        </div>
      </div>

      {/* Model Selector */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-neon-cyan" /> Inference Model
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedModel === m.id
                  ? 'bg-neon-cyan/10 border-neon-cyan/40 text-white'
                  : 'bg-lattice-surface border-lattice-border text-gray-400 hover:border-gray-500'
              }`}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-gray-500 mt-1">{m.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['facts', 'query', 'syllogism', 'forward'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setResults(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              tab === t
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                : 'bg-lattice-surface text-gray-400 hover:text-gray-300'
            }`}
          >
            {t === 'forward' ? 'Forward Chain' : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="panel p-4 space-y-4">
          {tab === 'facts' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-neon-purple" /> Add Facts
              </h2>
              <textarea
                value={factInput}
                onChange={(e) => setFactInput(e.target.value)}
                placeholder="Enter facts (one per line)..."
                className="input-lattice w-full h-40 resize-none font-mono text-sm"
              />
              <button
                onClick={() => addFacts.mutate()}
                disabled={!factInput || addFacts.isPending}
                className="btn-neon purple w-full"
              >
                {addFacts.isPending ? 'Adding...' : 'Add Facts'}
              </button>
            </>
          )}

          {tab === 'query' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Search className="w-4 h-4 text-neon-cyan" /> Query Inference
              </h2>
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter query..."
                className="input-lattice w-full"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && queryInput && !runQuery.isPending) runQuery.mutate();
                }}
              />
              <p className="text-xs text-gray-500">
                Using model: <span className="text-neon-cyan">{MODEL_OPTIONS.find(m => m.id === selectedModel)?.label}</span>
              </p>
              <button
                onClick={() => runQuery.mutate()}
                disabled={!queryInput || runQuery.isPending}
                className="btn-neon purple w-full"
              >
                {runQuery.isPending ? 'Querying...' : 'Run Query'}
              </button>
            </>
          )}

          {tab === 'syllogism' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-neon-purple" /> Syllogism
              </h2>
              <input
                type="text"
                value={majorPremise}
                onChange={(e) => setMajorPremise(e.target.value)}
                placeholder="Major premise: All X are Y"
                className="input-lattice w-full"
              />
              <input
                type="text"
                value={minorPremise}
                onChange={(e) => setMinorPremise(e.target.value)}
                placeholder="Minor premise: Z is X"
                className="input-lattice w-full"
              />
              <button
                onClick={() => runSyllogism.mutate()}
                disabled={!majorPremise || !minorPremise || runSyllogism.isPending}
                className="btn-neon purple w-full"
              >
                {runSyllogism.isPending ? 'Reasoning...' : 'Derive Conclusion'}
              </button>
            </>
          )}

          {tab === 'forward' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-neon-green" /> Forward Chaining
              </h2>
              <p className="text-sm text-gray-400">
                Apply all known rules to derive new facts from the existing knowledge base.
              </p>
              <div className="lens-card text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current facts</span>
                  <span className="text-gray-300">{statusInfo.factCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active rules</span>
                  <span className="text-gray-300">{statusInfo.ruleCount || 0}</span>
                </div>
              </div>
              <button
                onClick={() => runForwardChain.mutate()}
                disabled={runForwardChain.isPending}
                className="btn-neon purple w-full"
              >
                {runForwardChain.isPending ? 'Chaining...' : 'Run Forward Chain'}
              </button>
            </>
          )}

          {/* Queue / Pending Indicator */}
          {isPending && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-neon-blue/10 border border-neon-blue/20">
              <Activity className="w-4 h-4 text-neon-blue animate-pulse" />
              <span className="text-sm text-neon-blue">Inference in progress...</span>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-neon-green" /> Results
          </h2>

          {/* Confidence Score Bar */}
          {resultConfidence !== null && resultConfidence !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Confidence</span>
                <span className={`font-bold ${
                  resultConfidence > 0.7 ? 'text-neon-green' :
                  resultConfidence > 0.4 ? 'text-neon-yellow' : 'text-red-400'
                }`}>
                  {(resultConfidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    resultConfidence > 0.7 ? 'bg-neon-green' :
                    resultConfidence > 0.4 ? 'bg-neon-yellow' : 'bg-red-400'
                  }`}
                  style={{ width: `${resultConfidence * 100}%` }}
                />
              </div>
            </div>
          )}

          {results ? (
            <div className="bg-lattice-surface p-3 rounded-lg">
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-96 overflow-y-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-center py-12 text-gray-500">
              Run a query or operation to see results
            </p>
          )}
        </div>
      </div>

      {/* Inference History */}
      <div className="panel p-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between font-semibold"
        >
          <span className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-neon-purple" /> Inference History
            <span className="text-xs text-gray-500 font-normal">({inferenceHistory.length} entries)</span>
          </span>
          {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showHistory && (
          <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {inferenceHistory.length > 0 ? inferenceHistory.map((entry) => (
              <div
                key={entry.id}
                className="lens-card cursor-pointer hover:bg-lattice-border/30 transition-colors"
                onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : (entry.id ?? null))}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {entry.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-neon-green flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-neon-yellow flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-sm font-medium capitalize">{entry.type.replace('-', ' ')}</span>
                      {entry.query && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">{entry.query}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {entry.confidence != null && (
                      <span className={`font-medium ${
                        entry.confidence > 0.7 ? 'text-neon-green' :
                        entry.confidence > 0.4 ? 'text-neon-yellow' : 'text-red-400'
                      }`}>
                        {(entry.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {entry.latencyMs != null && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {entry.latencyMs}ms
                      </span>
                    )}
                    {entry.timestamp && (
                      <span className="text-gray-600">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                {expandedHistoryId === entry.id && !!entry.result && (
                  <div className="mt-2 pt-2 border-t border-lattice-border">
                    <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {JSON.stringify(entry.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )) : (
              <p className="text-center py-8 text-gray-500 text-sm">
                No inference history yet -- run queries to build history
              </p>
            )}
          </div>
        )}

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="inference"
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
            <LensFeaturePanel lensId="inference" />
          </div>
        )}
      </div>
    </div>
  );
}
