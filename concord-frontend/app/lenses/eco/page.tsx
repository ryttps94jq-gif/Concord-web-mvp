'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { Leaf, Sun, Droplet, Wind, TreeDeciduous, TrendingUp, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// Seed data — auto-created in backend if empty
const SEED_METRICS = [
  { title: 'Energy Flow', data: { id: 'energy', value: 0.85, unit: 'TJ/day', icon: 'Sun', color: 'text-yellow-500' } },
  { title: 'Water Cycle', data: { id: 'water', value: 0.92, unit: 'ML/day', icon: 'Droplet', color: 'text-neon-blue' } },
  { title: 'Carbon Balance', data: { id: 'carbon', value: 0.78, unit: 'kt CO2', icon: 'Wind', color: 'text-gray-400' } },
  { title: 'Biodiversity', data: { id: 'biodiversity', value: 0.88, unit: 'index', icon: 'TreeDeciduous', color: 'text-neon-green' } },
];

const SEED_ORGANISMS = [
  { title: 'Producers', data: { type: 'Producers', count: 1250, growth: 0.05 } },
  { title: 'Consumers', data: { type: 'Consumers', count: 340, growth: -0.02 } },
  { title: 'Decomposers', data: { type: 'Decomposers', count: 890, growth: 0.08 } },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun,
  Droplet,
  Wind,
  TreeDeciduous,
};

export default function EcoLensPage() {
  useLensNav('eco');

  const { items: metricItems, isLoading: metricsLoading } = useLensData('eco', 'metric', {
    seed: SEED_METRICS,
  });

  const { items: organismItems, isLoading: organismsLoading } = useLensData('eco', 'organism', {
    seed: SEED_ORGANISMS,
  });

  const isLoading = metricsLoading || organismsLoading;

  // Map fetched items to display shape
  const ecosystemMetrics = metricItems.map((item) => {
    const d = item.data as { id: string; value: number; unit: string; icon: string; color: string };
    return {
      id: d.id ?? item.id,
      name: item.title,
      value: d.value,
      unit: d.unit,
      icon: ICON_MAP[d.icon] ?? Sun,
      color: d.color ?? 'text-gray-400',
    };
  });

  const organisms = organismItems.map((item) => {
    const d = item.data as { type: string; count: number; growth: number };
    return { type: d.type ?? item.title, count: d.count, growth: d.growth };
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
        <span className="ml-3 text-gray-400">Loading ecosystem data...</span>
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
        <span className="text-2xl">🌿</span>
        <div>
          <h1 className="text-xl font-bold">Eco Lens</h1>
          <p className="text-sm text-gray-400">
            Ecosystem simulations with Growth OS analogs
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ecosystemMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="lens-card">
              <Icon className={`w-5 h-5 ${metric.color} mb-2`} />
              <p className="text-2xl font-bold">{(metric.value * 100).toFixed(0)}%</p>
              <p className="text-sm text-gray-400">{metric.name}</p>
            </div>
          );
        })}
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-neon-green" />
          Ecosystem Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {organisms.map((org) => (
            <div key={org.type} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{org.type}</p>
                <span className={`text-xs ${org.growth >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>
                  {org.growth >= 0 ? '+' : ''}{(org.growth * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-2xl font-bold text-neon-cyan">{org.count.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Population</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon-blue" />
          Growth OS Mapping
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Maps ecosystem dynamics to organism maturation kernel
        </p>
        <div className="h-32 flex items-end gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-neon-green to-neon-cyan rounded-t"
              style={{ height: `${30 + Math.sin(i * 0.5) * 50 + Math.random() * 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
