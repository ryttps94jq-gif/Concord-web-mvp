'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { FlaskConical, Play, Square, History, Zap, Search, Plus, Trash2, CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';

export default function LabLensPage() {
  useLensNav('lab');

  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [selectedOrgan, setSelectedOrgan] = useState('abstraction_governor');

  const { items: organItems, isLoading, isError: isError, error: error, refetch: refetch } = useLensData<Record<string, unknown>>('lab', 'organ', { seed: [] });
  const organs = organItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const { items: experimentItems, isError: isError2, error: error2, refetch: refetch2, create: createExperiment } = useLensData<Record<string, unknown>>('lab', 'experiment', { seed: [] });
  const experiments = experimentItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const runExperiment = useMutation({
    mutationFn: (payload: { code: string; organ: string }) =>
      createExperiment({ title: `experiment-${Date.now()}`, data: { ...payload, ranAt: new Date().toISOString() } }),
    onSuccess: () => {
      refetch2();
    },
    onError: (err) => console.error('runExperiment failed:', err instanceof Error ? err.message : err),
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
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
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <h1 className="text-xl font-bold">Lab Lens</h1>
            <p className="text-sm text-gray-400">
              Experiment sandbox for Growth OS organs
            </p>
          </div>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="lab" artifactId={items[0]?.id} compact />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Experiment Editor */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-neon-purple" />
              Experiment Sandbox
            </h2>
            <select
              value={selectedOrgan}
              onChange={(e) => setSelectedOrgan(e.target.value)}
              className="input-lattice w-auto"
            >
              {organs?.map((organ: Record<string, unknown>) => (
                <option key={organ.name as string} value={organ.name as string}>
                  {String(organ.name)}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Write experiment code here..."
            className="input-lattice font-mono text-sm h-64 resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => runExperiment.mutate({ code, organ: selectedOrgan })}
              disabled={runExperiment.isPending}
              className="btn-neon purple flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {runExperiment.isPending ? 'Running...' : 'Run Experiment'}
            </button>
            <button
              onClick={() => setCode('')}
              className="btn-neon flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Organ Status */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-green" />
            Growth Organs
          </h2>
          <div className="space-y-2">
            {organs?.map((organ: Record<string, unknown>) => (
              <div
                key={organ.name as string}
                className={`lens-card cursor-pointer ${
                  selectedOrgan === (organ.name as string) ? 'border-neon-purple' : ''
                }`}
                onClick={() => setSelectedOrgan(organ.name as string)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{String(organ.name)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      organ.active
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {organ.active ? 'Active' : 'Dormant'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Adjacent Reality Explorer */}
      <RealityExplorerSection />

      {/* Experiment History */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-neon-blue" />
          Recent Experiments
        </h2>
        <div className="space-y-2">
          {experiments?.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No experiments yet. Run your first experiment!
            </p>
          ) : (
            experiments?.map((exp: Record<string, unknown>) => (
              <div key={exp.id as string} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{String(exp.organ)}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(exp.timestamp as string).toLocaleString()}
                  </span>
                </div>
                <pre className="text-xs text-gray-300 mt-2 overflow-auto max-h-24">
                  {String(exp.result)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Adjacent Reality Explorer Section ──────────────────────────────────── */

interface ExploreConstraint { key: string; min: string; max: string; }

function RealityExplorerSection() {
  const [domain, setDomain] = useState('');
  const [constraints, setConstraints] = useState<ExploreConstraint[]>([{ key: '', min: '', max: '' }]);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const addConstraint = () => setConstraints([...constraints, { key: '', min: '', max: '' }]);
  const removeConstraint = (idx: number) => setConstraints(constraints.filter((_, i) => i !== idx));
  const updateConstraint = (idx: number, field: keyof ExploreConstraint, value: string) => {
    const updated = [...constraints];
    updated[idx] = { ...updated[idx], [field]: value };
    setConstraints(updated);
  };

  const explore = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    const constraintObj: Record<string, { min: number; max: number }> = {};
    for (const c of constraints) {
      if (c.key.trim() && c.min && c.max) {
        constraintObj[c.key.trim()] = { min: parseFloat(c.min), max: parseFloat(c.max) };
      }
    }
    try {
      const resp = await apiHelpers.explore.run(domain, constraintObj);
      setResults(resp.data);
    } catch { /* silent */ }
    setLoading(false);
  };

  const adjacentRealities = (results as Record<string, unknown>)?.adjacentRealities as Array<{
    configuration: Record<string, unknown>; confidence: number;
    physicsCheck: { valid: boolean }; nextStep: string;
  }> | undefined;

  return (
    <div className="panel p-4 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Search className="w-4 h-4 text-neon-cyan" />
        Adjacent Reality Explorer
      </h2>
      <p className="text-xs text-gray-400">
        Explore what COULD BE. Define constraints, discover configurations beyond known data.
      </p>

      <div className="flex items-center gap-3">
        <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)}
          placeholder="Domain (e.g., physics)" className="flex-1 input-lattice" />
      </div>

      <div className="space-y-2">
        {constraints.map((c, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input type="text" value={c.key} onChange={(e) => updateConstraint(idx, 'key', e.target.value)}
              placeholder="parameter" className="flex-1 input-lattice text-sm" />
            <input type="text" value={c.min} onChange={(e) => updateConstraint(idx, 'min', e.target.value)}
              placeholder="min" className="w-20 input-lattice text-sm" />
            <span className="text-gray-500">–</span>
            <input type="text" value={c.max} onChange={(e) => updateConstraint(idx, 'max', e.target.value)}
              placeholder="max" className="w-20 input-lattice text-sm" />
            {constraints.length > 1 && (
              <button onClick={() => removeConstraint(idx)} className="text-gray-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addConstraint} className="text-xs text-neon-cyan flex items-center gap-1 hover:underline">
          <Plus className="w-3 h-3" /> Add constraint
        </button>
      </div>

      <button onClick={explore} disabled={loading}
        className="btn-neon cyan flex items-center gap-2">
        <FlaskConical className="w-4 h-4" />
        {loading ? 'Exploring...' : 'Explore'}
      </button>

      {adjacentRealities && adjacentRealities.length > 0 && (
        <div className="space-y-2 mt-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            {adjacentRealities.length} configurations found
          </h3>
          {adjacentRealities.slice(0, 8).map((cfg, idx) => (
            <div key={idx} className="lens-card text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className={`font-mono ${cfg.confidence > 0.7 ? 'text-green-400' : cfg.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {(cfg.confidence * 100).toFixed(0)}%
                </span>
                {cfg.physicsCheck.valid
                  ? <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> valid</span>
                  : <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> violation</span>
                }
              </div>
              <pre className="text-gray-300 bg-black/30 rounded p-1 overflow-x-auto">{JSON.stringify(cfg.configuration, null, 2)}</pre>
              <p className="text-gray-400">{cfg.nextStep}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
