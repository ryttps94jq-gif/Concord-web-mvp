'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { FlaskConical, Play, Square, History, Zap } from 'lucide-react';

export default function LabLensPage() {
  useLensNav('lab');

  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [selectedOrgan, setSelectedOrgan] = useState('abstraction_governor');

  const { data: organs } = useQuery({
    queryKey: ['growth-organs'],
    queryFn: () => api.get('/api/growth/organs').then((r) => r.data),
  });

  const { data: experiments } = useQuery({
    queryKey: ['lab-experiments'],
    queryFn: () => api.get('/api/lab/experiments').then((r) => r.data),
  });

  const runExperiment = useMutation({
    mutationFn: (payload: { code: string; organ: string }) =>
      api.post('/api/lab/run', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-experiments'] });
    },
  });

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
              {organs?.organs?.map((organ: Record<string, unknown>) => (
                <option key={organ.name} value={organ.name}>
                  {organ.name}
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
            {organs?.organs?.map((organ: Record<string, unknown>) => (
              <div
                key={organ.name}
                className={`lens-card cursor-pointer ${
                  selectedOrgan === organ.name ? 'border-neon-purple' : ''
                }`}
                onClick={() => setSelectedOrgan(organ.name)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{organ.name}</span>
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

      {/* Experiment History */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-neon-blue" />
          Recent Experiments
        </h2>
        <div className="space-y-2">
          {experiments?.experiments?.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No experiments yet. Run your first experiment!
            </p>
          ) : (
            experiments?.experiments?.map((exp: Record<string, unknown>) => (
              <div key={exp.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{exp.organ}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(exp.timestamp).toLocaleString()}
                  </span>
                </div>
                <pre className="text-xs text-gray-300 mt-2 overflow-auto max-h-24">
                  {exp.result}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
