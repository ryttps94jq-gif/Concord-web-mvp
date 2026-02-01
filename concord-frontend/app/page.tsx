'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { DTUEmpireCard } from '@/components/dtu/DTUEmpireCard';
import { LockDashboard } from '@/components/sovereignty/LockDashboard';
import { CoherenceBadge } from '@/components/graphs/CoherenceBadge';

export default function DashboardPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  const { data: latestState } = useQuery({
    queryKey: ['state-latest'],
    queryFn: () => api.get('/api/state/latest').then((r) => r.data),
  });

  const { data: dtus } = useQuery({
    queryKey: ['dtus-recent'],
    queryFn: () => api.get('/api/dtus?limit=6').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-neon">
            Concord Empire Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            {status?.version || 'Loading...'} • {status?.dtus || 0} DTUs •{' '}
            {status?.llmReady ? 'LLM Ready' : 'Local Mode'}
          </p>
        </div>
        <CoherenceBadge score={latestState?.session?.turns || 0} />
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total DTUs"
          value={status?.dtus || 0}
          icon="📦"
          color="blue"
        />
        <MetricCard
          label="Wrappers"
          value={status?.wrappers || 0}
          icon="🔧"
          color="purple"
        />
        <MetricCard
          label="Active Layers"
          value={status?.layers || 0}
          icon="📊"
          color="pink"
        />
        <MetricCard
          label="Sovereignty"
          value="70%"
          icon="🔒"
          color="green"
          locked
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resonance Universe */}
        <div className="lg:col-span-2 panel p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-neon-blue">◉</span> Resonance Universe
          </h2>
          <div className="h-[400px]">
            <ResonanceEmpireGraph />
          </div>
        </div>

        {/* 70% Lock Dashboard */}
        <div className="panel p-4">
          <LockDashboard />
        </div>
      </div>

      {/* Recent DTUs */}
      <div className="panel p-4">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-neon-cyan">◈</span> Recent DTUs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dtus?.dtus?.slice(0, 6).map((dtu: any) => (
            <DTUEmpireCard key={dtu.id} dtu={dtu} />
          ))}
          {(!dtus?.dtus || dtus.dtus.length === 0) && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No DTUs yet. Start forging in the Chat or Forge lens.
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/lenses/chat" label="Chat" icon="💬" />
        <QuickAction href="/lenses/graph" label="Graph" icon="🕸️" />
        <QuickAction href="/lenses/resonance" label="Resonance" icon="🌊" />
        <QuickAction href="/lenses/council" label="Council" icon="⚖️" />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
  locked,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'purple' | 'pink' | 'green';
  locked?: boolean;
}) {
  const colorClasses = {
    blue: 'border-neon-blue/30 text-neon-blue',
    purple: 'border-neon-purple/30 text-neon-purple',
    pink: 'border-neon-pink/30 text-neon-pink',
    green: 'border-sovereignty-locked/30 text-sovereignty-locked',
  };

  return (
    <div
      className={`lens-card ${locked ? 'sovereignty-lock lock-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="lens-card flex items-center justify-center gap-2 py-4 hover:scale-105 transition-transform"
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}
