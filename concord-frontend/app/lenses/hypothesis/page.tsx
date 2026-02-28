'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { useLensBridge } from '@/lib/hooks/use-lens-bridge';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  FlaskConical, Plus, CheckCircle2, XCircle, Beaker,
  FileText, TrendingUp, ArrowRight
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface Hypothesis {
  id: string;
  statement: string;
  domain?: string;
  status?: string;
  confidence?: number;
  evidence?: Record<string, unknown>[];
  createdAt?: string;
}

export default function HypothesisLensPage() {
  useLensNav('hypothesis');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('hypothesis');

  const queryClient = useQueryClient();
  const [newStatement, setNewStatement] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newEvidence, setNewEvidence] = useState('');
  const [evidenceSupports, setEvidenceSupports] = useState(true);

  // --- Lens Bridge ---
  const bridge = useLensBridge('hypothesis', 'hypothesis');

  const { data: hypothesesData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['hypotheses'],
    queryFn: () => apiHelpers.hypothesis.list().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: statusData, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['hypothesis-status'],
    queryFn: () => apiHelpers.hypothesis.status().then((r) => r.data),
  });

  const createHypothesis = useMutation({
    mutationFn: () =>
      apiHelpers.hypothesis.create({
        statement: newStatement,
        domain: newDomain || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hypotheses'] });
      setNewStatement('');
      setNewDomain('');
    },
    onError: (err) => console.error('createHypothesis failed:', err instanceof Error ? err.message : err),
  });

  const evaluateHypothesis = useMutation({
    mutationFn: (id: string) => apiHelpers.hypothesis.evaluate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hypotheses'] }),
    onError: (err) => console.error('evaluateHypothesis failed:', err instanceof Error ? err.message : err),
  });

  const addEvidence = useMutation({
    mutationFn: () => {
      if (!selectedId) return Promise.reject('No hypothesis selected');
      return apiHelpers.hypothesis.addEvidence(selectedId, {
        evidence: newEvidence,
        supports: evidenceSupports,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hypotheses'] });
      setNewEvidence('');
    },
    onError: (err) => console.error('addEvidence failed:', err instanceof Error ? err.message : err),
  });

  const runExperiment = useMutation({
    mutationFn: (id: string) => apiHelpers.hypothesis.experiment(id, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hypotheses'] }),
    onError: (err) => console.error('runExperiment failed:', err instanceof Error ? err.message : err),
  });

  const hypotheses: Hypothesis[] = hypothesesData?.hypotheses || hypothesesData || [];
  const status = statusData?.status || statusData || {};

  // Bridge hypotheses into lens artifacts
  useEffect(() => {
    bridge.syncList(hypotheses, (h) => {
      const hyp = h as Hypothesis;
      return { title: hyp.statement, data: h as Record<string, unknown>, meta: { status: hyp.status } };
    });
  }, [hypotheses, bridge]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading hypotheses...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div>
          <h1 className="text-xl font-bold">Hypothesis Lens</h1>
          <p className="text-sm text-gray-400">
            Scientific method — hypothesize, collect evidence, evaluate, experiment
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="hypothesis" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        <UniversalActions domain="hypothesis" artifactId={bridge.selectedId} compact />
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <FlaskConical className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{hypotheses.length}</p>
          <p className="text-sm text-gray-400">Hypotheses</p>
        </div>
        <div className="lens-card">
          <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{status.confirmed || 0}</p>
          <p className="text-sm text-gray-400">Confirmed</p>
        </div>
        <div className="lens-card">
          <XCircle className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-bold">{status.refuted || 0}</p>
          <p className="text-sm text-gray-400">Refuted</p>
        </div>
        <div className="lens-card">
          <Beaker className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{status.experiments || 0}</p>
          <p className="text-sm text-gray-400">Experiments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create + List */}
        <div className="space-y-4">
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-neon-purple" /> New Hypothesis
            </h2>
            <input
              type="text"
              value={newStatement}
              onChange={(e) => setNewStatement(e.target.value)}
              placeholder="Hypothesis statement..."
              className="input-lattice w-full"
            />
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="Domain (optional)..."
              className="input-lattice w-full"
            />
            <button
              onClick={() => createHypothesis.mutate()}
              disabled={!newStatement || createHypothesis.isPending}
              className="btn-neon purple w-full"
            >
              {createHypothesis.isPending ? 'Creating...' : 'Create Hypothesis'}
            </button>
          </div>

          <div className="panel p-4">
            <h2 className="font-semibold mb-3">Hypotheses</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {hypotheses.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No hypotheses yet. Create one above to get started.</p>
              )}
              {hypotheses.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className={`w-full text-left lens-card ${
                    selectedId === h.id ? 'border-neon-cyan' : ''
                  }`}
                >
                  <p className="text-sm font-medium truncate">{h.statement}</p>
                  <div className="flex gap-2 mt-1">
                    {h.domain && <span className="text-xs text-gray-400">{h.domain}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      h.status === 'confirmed' ? 'bg-green-400/20 text-green-400' :
                      h.status === 'refuted' ? 'bg-red-400/20 text-red-400' :
                      'bg-blue-400/20 text-blue-400'
                    }`}>
                      {h.status || 'pending'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          {selectedId ? (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-neon-cyan" /> Hypothesis Detail
              </h2>
              {(() => {
                const h = hypotheses.find((x) => x.id === selectedId);
                if (!h) return <p className="text-gray-500">Not found</p>;
                return (
                  <>
                    <p className="text-sm">{h.statement}</p>
                    {h.confidence != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Confidence:</span>
                        <div className="flex-1 h-2 bg-lattice-deep rounded-full overflow-hidden">
                          <div className="h-full bg-neon-cyan" style={{ width: `${h.confidence * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono">{(h.confidence * 100).toFixed(0)}%</span>
                      </div>
                    )}

                    {/* Evidence */}
                    <div>
                      <h3 className="text-sm font-medium mb-2">Evidence</h3>
                      <div className="space-y-1 mb-3">
                        {(h.evidence || []).map((e: Record<string, unknown>, i: number) => (
                          <div key={i} className={`lens-card text-xs border-l-4 ${
                            e.supports ? 'border-l-green-500' : 'border-l-red-500'
                          }`}>
                            <span>{typeof e === 'string' ? e : String(e.evidence || e.content)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newEvidence}
                          onChange={(e) => setNewEvidence(e.target.value)}
                          placeholder="Add evidence..."
                          className="input-lattice flex-1"
                        />
                        <select
                          value={evidenceSupports ? 'supports' : 'contradicts'}
                          onChange={(e) => setEvidenceSupports(e.target.value === 'supports')}
                          className="input-lattice w-32"
                        >
                          <option value="supports">Supports</option>
                          <option value="contradicts">Contradicts</option>
                        </select>
                        <button
                          onClick={() => addEvidence.mutate()}
                          disabled={!newEvidence || addEvidence.isPending}
                          className="btn-neon"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => evaluateHypothesis.mutate(h.id)}
                        disabled={evaluateHypothesis.isPending}
                        className="btn-neon purple flex-1 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <TrendingUp className="w-4 h-4" /> {evaluateHypothesis.isPending ? 'Evaluating...' : 'Evaluate'}
                      </button>
                      <button
                        onClick={() => runExperiment.mutate(h.id)}
                        disabled={runExperiment.isPending}
                        className="btn-neon flex-1 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Beaker className="w-4 h-4" /> {runExperiment.isPending ? 'Running...' : 'Experiment'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Select a hypothesis to view details and manage evidence</p>
            </div>
          )}
        </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="hypothesis"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>
    </div>
  );
}
