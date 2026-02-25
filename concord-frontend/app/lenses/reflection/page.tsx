'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useEffect } from 'react';
import { useLensBridge } from '@/lib/hooks/use-lens-bridge';
import { UniversalActions } from '@/components/lens/UniversalActions';
import {
  TrendingUp, AlertTriangle, CheckCircle2,
  Brain, Eye, Shield, BarChart3
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// Mirror icon alias
const Mirror = Eye;

interface Reflection {
  id: string;
  timestamp: string;
  quality: number;
  checks: Record<string, number>;
  insights: { type: string; message: string; severity: number }[];
  corrections: string[];
}

export default function ReflectionLensPage() {
  useLensNav('reflection');

  // --- Lens Bridge ---
  const bridge = useLensBridge('reflection', 'reflection');

  const { data: status, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['reflection-status'],
    queryFn: () => apiHelpers.reflection.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: recent, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['reflection-recent'],
    queryFn: () => apiHelpers.reflection.recent(20).then((r) => r.data),
  });

  const { data: selfModel, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['reflection-self-model'],
    queryFn: () => apiHelpers.reflection.selfModel().then((r) => r.data),
  });

  const reflections: Reflection[] = recent?.reflections || [];
  const model = selfModel?.selfModel || status?.selfModel || {};
  const stats = status?.stats || {};

  // Bridge reflections into lens artifacts
  useEffect(() => {
    bridge.syncList(reflections, (r) => {
      const ref = r as Reflection;
      return { title: `Reflection ${ref.id}`, data: r as Record<string, unknown>, meta: { quality: String(ref.quality) } };
    });
  }, [reflections, bridge]);

  const avgQuality = reflections.length > 0
    ? reflections.reduce((s, r) => s + r.quality, 0) / reflections.length
    : 0;

  const checkNames: Record<string, string> = {
    factConsistency: 'Fact Consistency',
    relevance: 'Relevance',
    grounding: 'Evidence Grounding',
    completeness: 'Completeness',
    selfConsistency: 'Self-Consistency',
  };


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
        <span className="text-2xl">🪞</span>
        <div>
          <h1 className="text-xl font-bold">Reflection Lens</h1>
          <p className="text-sm text-gray-400">
            Self-critique loop — evaluates response quality and learns from output analysis
          </p>
        </div>
      </header>

      {/* AI Actions */}
      <UniversalActions domain="reflection" artifactId={bridge.selectedId} compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Mirror className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{status?.reflections || 0}</p>
          <p className="text-sm text-gray-400">Reflections</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{(avgQuality * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Quality</p>
        </div>
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{stats.insightsGenerated || 0}</p>
          <p className="text-sm text-gray-400">Insights</p>
        </div>
        <div className="lens-card">
          <Shield className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{((model.confidenceCalibration || 0) * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Calibration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Self-Model */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-neon-purple" /> Self-Model
          </h2>

          {model.strengths?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Strengths</p>
              <div className="space-y-1">
                {model.strengths.map((s: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-neon-green">
                    <CheckCircle2 className="w-3 h-3" /> {checkNames[s] || s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {model.weaknesses?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Weaknesses</p>
              <div className="space-y-1">
                {model.weaknesses.map((w: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-yellow-400">
                    <AlertTriangle className="w-3 h-3" /> {checkNames[w] || w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {model.biases?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Detected Biases</p>
              {model.biases.map((b: string, i: number) => (
                <p key={i} className="text-sm text-red-400">{b}</p>
              ))}
            </div>
          )}

          {!model.strengths?.length && !model.weaknesses?.length && (
            <p className="text-sm text-gray-500">Self-model builds over time as reflections accumulate</p>
          )}

          <div className="border-t border-lattice-border pt-3 space-y-2">
            <p className="text-xs text-gray-500 uppercase">Stats</p>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Reflections run</span>
              <span className="text-gray-300">{stats.reflectionsRun || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Self-corrections</span>
              <span className="text-gray-300">{stats.selfCorrections || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Quality improvements</span>
              <span className="text-neon-green">{stats.qualityImprovements || 0}</span>
            </div>
          </div>
        </div>

        {/* Quality Breakdown */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-cyan" /> Quality Dimensions
          </h2>
          {reflections.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(checkNames).map(([key, label]) => {
                const avg = reflections.reduce((s, r) => s + (r.checks[key] || 0), 0) / reflections.length;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{label}</span>
                      <span className={`${avg > 0.7 ? 'text-neon-green' : avg > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {(avg * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${avg > 0.7 ? 'bg-neon-green' : avg > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${avg * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500 text-sm">No reflections yet — interact with the system to generate data</p>
          )}
        </div>

        {/* Recent Reflections */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Mirror className="w-4 h-4 text-neon-green" /> Recent Reflections
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {reflections.map((r) => (
              <div key={r.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleString()}</span>
                  <span className={`text-sm font-bold ${r.quality > 0.7 ? 'text-neon-green' : r.quality > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(r.quality * 100).toFixed(0)}%
                  </span>
                </div>
                {r.insights.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {r.insights.map((ins, i) => (
                      <p key={i} className="text-xs text-yellow-400">{ins.message}</p>
                    ))}
                  </div>
                )}
                {r.corrections.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {r.corrections.map((c, i) => (
                      <p key={i} className="text-xs text-red-400">{c}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {reflections.length === 0 && (
              <p className="text-center py-4 text-gray-500 text-sm">No reflections recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
