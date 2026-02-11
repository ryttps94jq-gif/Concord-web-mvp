'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Dna, Activity, Heart, Brain, Microscope } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface BioMetric {
  name: string;
  value: number;
}

interface GrowthOrgan {
  name: string;
  active: boolean;
  lastActivation?: string;
}

export default function BioLensPage() {
  useLensNav('bio');

  const [selectedSystem, setSelectedSystem] = useState('homeostasis');

  const { data: bioData, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['bio-systems'],
    queryFn: () => api.get('/api/bio/systems').then((r) => r.data),
  });

  const { data: growthData, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['growth-status'],
    queryFn: () => api.get('/api/growth/status').then((r) => r.data),
  });

  const systems = [
    { id: 'homeostasis', name: 'Homeostasis', icon: Heart, color: 'text-neon-pink' },
    { id: 'metabolism', name: 'Metabolism', icon: Activity, color: 'text-neon-green' },
    { id: 'neural', name: 'Neural Network', icon: Brain, color: 'text-neon-purple' },
    { id: 'genetic', name: 'Genetic Memory', icon: Dna, color: 'text-neon-blue' },
  ];


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
          <span className="text-2xl">🧬</span>
          <div>
            <h1 className="text-xl font-bold">Bio Lens</h1>
            <p className="text-sm text-gray-400">
              Biological system simulation and Growth OS metrics
            </p>
          </div>
        </div>
      </header>

      {/* Bio Age Display */}
      <div className="panel p-6 text-center">
        <Microscope className="w-12 h-12 mx-auto text-neon-cyan mb-4" />
        <p className="text-sm text-gray-400 mb-2">System Biological Age</p>
        <p className="text-5xl font-bold text-gradient-neon">
          {growthData?.bioAge || '0.00'}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Maturation: {((growthData?.maturationLevel || 0) * 100).toFixed(1)}%
        </p>
      </div>

      {/* System Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {systems.map((system) => {
          const Icon = system.icon;
          return (
            <button
              key={system.id}
              onClick={() => setSelectedSystem(system.id)}
              className={`lens-card text-center ${
                selectedSystem === system.id ? 'border-neon-cyan glow-blue' : ''
              }`}
            >
              <Icon className={`w-8 h-8 mx-auto mb-2 ${system.color}`} />
              <p className="font-medium text-sm">{system.name}</p>
            </button>
          );
        })}
      </div>

      {/* System Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metrics */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-green" />
            {systems.find((s) => s.id === selectedSystem)?.name} Metrics
          </h3>

          {bioData?.systems?.[selectedSystem]?.metrics?.map((metric: BioMetric) => (
            <div key={metric.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{metric.name}</span>
                <span className="font-mono">{metric.value.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-blue to-neon-cyan rounded-full transition-all"
                  style={{ width: `${Math.min(100, metric.value * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {!bioData?.systems?.[selectedSystem]?.metrics && (
            <p className="text-gray-500 text-center py-4">
              Loading system metrics...
            </p>
          )}
        </div>

        {/* Growth Organs */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Dna className="w-4 h-4 text-neon-purple" />
            Active Growth Organs
          </h3>

          <div className="space-y-2">
            {growthData?.organs?.map((organ: GrowthOrgan) => (
              <div
                key={organ.name}
                className={`lens-card ${
                  organ.active ? 'border-neon-green/50' : 'opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{organ.name}</span>
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
                {organ.lastActivation && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last: {new Date(organ.lastActivation).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Homeostasis Indicators */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-neon-pink" />
          Homeostasis Balance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Energy', value: bioData?.homeostasis?.energy || 0.85 },
            { name: 'Coherence', value: bioData?.homeostasis?.coherence || 0.92 },
            { name: 'Stability', value: bioData?.homeostasis?.stability || 0.78 },
            { name: 'Adaptation', value: bioData?.homeostasis?.adaptation || 0.88 },
          ].map((indicator) => (
            <div key={indicator.name} className="lens-card text-center">
              <p className="text-3xl font-bold text-neon-cyan">
                {(indicator.value * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-400 mt-1">{indicator.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
