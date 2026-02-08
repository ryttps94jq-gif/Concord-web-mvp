'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Play, Sliders, Zap, Clock, Target } from 'lucide-react';

export default function SimLensPage() {
  useLensNav('sim');
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [assumptions, setAssumptions] = useState('');

  // Backend: GET /api/simulations
  const { data: simulations } = useQuery({
    queryKey: ['simulations'],
    queryFn: () => api.get('/api/simulations').then((r) => r.data),
  });

  // Backend: POST /api/simulations/whatif
  const runSim = useMutation({
    mutationFn: async () => {
      return api.post('/api/simulations/whatif', {
        title: 'Custom Simulation',
        prompt,
        assumptions: assumptions.split('\n').filter(Boolean),
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      setPrompt('');
      setAssumptions('');
    },
  });

  // Lens artifact persistence layer
  const { items: _scenarioArtifacts, create: _createScenario } = useLensData('sim', 'scenario', { noSeed: true });

  const sims = simulations?.simulations || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div>
          <h1 className="text-xl font-bold">Sim Lens</h1>
          <p className="text-sm text-gray-400">
            What-if simulations and WrapperJobs queue visualization
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{sims.length}</p>
          <p className="text-sm text-gray-400">Simulations</p>
        </div>
        <div className="lens-card">
          <Play className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-gray-400">Running</p>
        </div>
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Avg Time</p>
        </div>
        <div className="lens-card">
          <Target className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">v1</p>
          <p className="text-sm text-gray-400">Engine</p>
        </div>
      </div>

      {/* New Simulation */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-neon-purple" />
          New What-If Simulation
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Prompt</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What if we doubled the DTU synthesis rate?"
              className="input-lattice w-full"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Assumptions (one per line)</label>
            <textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder="LLM is available&#10;Network is stable&#10;Storage is sufficient"
              className="input-lattice w-full h-24 resize-none"
            />
          </div>
          <button
            onClick={() => runSim.mutate()}
            disabled={!prompt || runSim.isPending}
            className="btn-neon purple w-full"
          >
            <Play className="w-4 h-4 mr-2 inline" />
            {runSim.isPending ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Simulation History */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-blue" />
          Simulation History
        </h2>
        <div className="space-y-3">
          {sims.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No simulations yet</p>
          ) : (
            sims.slice(0, 10).map((sim: Record<string, unknown>) => (
              <details key={sim.id as string} className="bg-lattice-deep rounded-lg">
                <summary className="flex items-center justify-between p-4 cursor-pointer">
                  <div>
                    <p className="font-medium">{sim.title as string}</p>
                    <p className="text-xs text-gray-500">{sim.createdAt as string}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-neon-green/20 text-neon-green rounded">
                    Complete
                  </span>
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-400 mb-2">{sim.prompt as string}</p>
                  {Boolean(sim.results) && (
                    <div className="bg-lattice-void p-3 rounded text-xs font-mono">
                      <p>Summary: {(sim.results as Record<string, unknown>).summary as string}</p>
                      <p className="mt-2">Risks: {((sim.results as Record<string, unknown>).keyRisks as string[])?.join(', ')}</p>
                    </div>
                  )}
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
