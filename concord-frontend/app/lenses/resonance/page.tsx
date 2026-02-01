'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { Waves, Activity, Zap } from 'lucide-react';

export default function ResonanceLensPage() {
  useLensNav('resonance');

  const { data: growth } = useQuery({
    queryKey: ['growth'],
    queryFn: () => api.get('/api/growth').then((r) => r.data),
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.get('/api/metrics').then((r) => r.data),
  });

  const homeostasis = growth?.growth?.homeostasis || 0;
  const bioAge = growth?.growth?.bioAge || 0;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🌊</span>
        <div>
          <h1 className="text-xl font-bold">Resonance Lens</h1>
          <p className="text-sm text-gray-400">
            System coherence, homeostasis, and lattice health
          </p>
        </div>
      </header>

      {/* Resonance Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResonanceMeter
          label="Homeostasis"
          value={homeostasis}
          icon={<Activity className="w-5 h-5" />}
          color="green"
        />
        <ResonanceMeter
          label="Bio Age"
          value={bioAge / 100}
          icon={<Waves className="w-5 h-5" />}
          color="blue"
          displayValue={bioAge.toFixed(1)}
        />
        <ResonanceMeter
          label="Continuity"
          value={metrics?.metrics?.continuityAvg || 0}
          icon={<Zap className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Resonance Universe */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Waves className="w-4 h-4 text-neon-cyan" />
          Resonance Field
        </h2>
        <div className="h-[400px]">
          <ResonanceEmpireGraph />
        </div>
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <HealthIndicator
          label="Stress (Acute)"
          value={growth?.growth?.stress?.acute || 0}
          threshold={0.5}
        />
        <HealthIndicator
          label="Stress (Chronic)"
          value={growth?.growth?.stress?.chronic || 0}
          threshold={0.3}
        />
        <HealthIndicator
          label="Repair Rate"
          value={growth?.growth?.maintenance?.repairRate || 0.5}
          threshold={0.4}
          inverted
        />
        <HealthIndicator
          label="Contradiction Load"
          value={growth?.growth?.functionalDecline?.contradictionLoad || 0}
          threshold={0.2}
        />
      </div>
    </div>
  );
}

function ResonanceMeter({
  label,
  value,
  icon,
  color,
  displayValue,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'purple';
  displayValue?: string;
}) {
  const colors = {
    green: 'bg-sovereignty-locked',
    blue: 'bg-neon-blue',
    purple: 'bg-neon-purple',
  };

  const percentage = Math.min(100, Math.max(0, value * 100));

  return (
    <div className="lens-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">{label}</span>
        <span className={`text-${color === 'green' ? 'sovereignty-locked' : `neon-${color}`}`}>
          {icon}
        </span>
      </div>
      <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
        <div
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-right text-sm mt-2 font-mono">
        {displayValue || `${percentage.toFixed(0)}%`}
      </p>
    </div>
  );
}

function HealthIndicator({
  label,
  value,
  threshold,
  inverted,
}: {
  label: string;
  value: number;
  threshold: number;
  inverted?: boolean;
}) {
  const isHealthy = inverted ? value >= threshold : value <= threshold;
  const percentage = Math.min(100, Math.max(0, value * 100));

  return (
    <div className="lens-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <span
          className={`w-2 h-2 rounded-full ${
            isHealthy ? 'bg-sovereignty-locked' : 'bg-sovereignty-danger'
          }`}
        />
      </div>
      <p className="text-xl font-mono mt-2">{percentage.toFixed(1)}%</p>
    </div>
  );
}
