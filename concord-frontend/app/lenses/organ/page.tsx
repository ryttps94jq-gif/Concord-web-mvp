'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Heart, Activity, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface Organ {
  id: string;
  name: string;
  maturity: number;
  wear: number;
  plasticity: number;
  lastTick: string;
  dependencies: string[];
}

export default function OrganLensPage() {
  useLensNav('organ');
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);

  // Backend: GET /api/status for organ registry
  const { data: _status, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  // Mock organ data derived from system state
  const organs: Organ[] = [
    { id: 'growth_os', name: 'Growth OS', maturity: 0.85, wear: 0.12, plasticity: 0.92, lastTick: new Date().toISOString(), dependencies: ['kernel', 'memory'] },
    { id: 'council_engine', name: 'Council Engine', maturity: 0.78, wear: 0.08, plasticity: 0.88, lastTick: new Date().toISOString(), dependencies: ['governance', 'voting'] },
    { id: 'dtu_forge', name: 'DTU Forge', maturity: 0.92, wear: 0.15, plasticity: 0.95, lastTick: new Date().toISOString(), dependencies: ['synthesis', 'verification'] },
    { id: 'resonance_core', name: 'Resonance Core', maturity: 0.88, wear: 0.05, plasticity: 0.90, lastTick: new Date().toISOString(), dependencies: ['coherence', 'homeostasis'] },
    { id: 'terminal_hub', name: 'Terminal Hub', maturity: 0.72, wear: 0.20, plasticity: 0.85, lastTick: new Date().toISOString(), dependencies: ['entities', 'execution'] },
    { id: 'memory_lattice', name: 'Memory Lattice', maturity: 0.95, wear: 0.03, plasticity: 0.98, lastTick: new Date().toISOString(), dependencies: ['storage', 'retrieval'] },
  ];

  const avgHealth = organs.reduce((sum, o) => sum + (o.maturity - o.wear), 0) / organs.length;


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
          <span className="text-2xl">🫀</span>
          <div>
            <h1 className="text-xl font-bold">Organ Lens</h1>
            <p className="text-sm text-gray-400">
              Monitor organism health, maturity, and plasticity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Heart className={`w-5 h-5 ${avgHealth > 0.7 ? 'text-neon-green' : 'text-neon-pink'}`} />
          <span className="text-lg font-bold">{(avgHealth * 100).toFixed(0)}%</span>
        </div>
      </header>

      {/* Organism Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{organs.length}</p>
          <p className="text-sm text-gray-400">Active Organs</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{(organs.reduce((s, o) => s + o.maturity, 0) / organs.length * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Maturity</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{(organs.reduce((s, o) => s + o.plasticity, 0) / organs.length * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Plasticity</p>
        </div>
        <div className="lens-card">
          <TrendingDown className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{(organs.reduce((s, o) => s + o.wear, 0) / organs.length * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Wear</p>
        </div>
      </div>

      {/* Organ Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-neon-pink" />
          Organ Registry
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organs.map((organ) => (
            <button
              key={organ.id}
              onClick={() => setSelectedOrgan(organ.id === selectedOrgan ? null : organ.id)}
              className={`lens-card text-left transition-all ${
                selectedOrgan === organ.id ? 'border-neon-cyan ring-1 ring-neon-cyan' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{organ.name}</h3>
                <span className={`w-3 h-3 rounded-full ${
                  organ.maturity > 0.8 ? 'bg-neon-green' : organ.maturity > 0.5 ? 'bg-neon-blue' : 'bg-neon-pink'
                }`} />
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Maturity</span>
                    <span>{(organ.maturity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                    <div className="h-full bg-neon-green" style={{ width: `${organ.maturity * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Plasticity</span>
                    <span>{(organ.plasticity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                    <div className="h-full bg-neon-purple" style={{ width: `${organ.plasticity * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Wear</span>
                    <span>{(organ.wear * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                    <div className="h-full bg-neon-pink" style={{ width: `${organ.wear * 100}%` }} />
                  </div>
                </div>
              </div>

              {selectedOrgan === organ.id && (
                <div className="mt-4 pt-4 border-t border-lattice-border">
                  <p className="text-xs text-gray-400 mb-2">Dependencies:</p>
                  <div className="flex flex-wrap gap-1">
                    {organ.dependencies.map((dep) => (
                      <span key={dep} className="text-xs px-2 py-0.5 bg-lattice-surface rounded">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bio Age Indicator */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4">Organism Bio-Age</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-lattice-deep rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple"
                style={{ width: `${avgHealth * 100}%` }}
              />
            </div>
          </div>
          <span className="text-2xl font-bold text-neon-cyan">
            {Math.floor(avgHealth * 400)} years
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Projected continuity based on current organ health
        </p>
      </div>
    </div>
  );
}
