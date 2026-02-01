'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { Network, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function GraphLensPage() {
  useLensNav('graph');

  const { data: dtus } = useQuery({
    queryKey: ['dtus-all'],
    queryFn: () => api.get('/api/dtus?limit=500').then((r) => r.data),
  });

  const { data: megas } = useQuery({
    queryKey: ['megas'],
    queryFn: () => api.get('/api/megas').then((r) => r.data),
  });

  const { data: hypers } = useQuery({
    queryKey: ['hypers'],
    queryFn: () => api.get('/api/hypers').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🕸️</span>
          <div>
            <h1 className="text-xl font-bold">Graph Lens</h1>
            <p className="text-sm text-gray-400">
              DTU knowledge graph visualization with lineage
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-lattice-surface rounded-lg transition-colors">
            <ZoomIn className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-lattice-surface rounded-lg transition-colors">
            <ZoomOut className="w-5 h-5 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-lattice-surface rounded-lg transition-colors">
            <Maximize2 className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Regular DTUs" value={dtus?.total || 0} color="blue" />
        <StatCard label="Mega DTUs" value={megas?.megas?.length || 0} color="purple" />
        <StatCard label="Hyper DTUs" value={hypers?.hypers?.length || 0} color="pink" />
        <StatCard label="Connections" value="—" color="cyan" />
      </div>

      {/* Graph Container */}
      <div className="flex-1 panel p-4 min-h-[500px]">
        <ResonanceEmpireGraph fullHeight />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neon-blue" />
          <span className="text-gray-400">Regular</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neon-purple" />
          <span className="text-gray-400">Mega</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neon-pink" />
          <span className="text-gray-400">Hyper</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-gray-400">Shadow</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: 'blue' | 'purple' | 'pink' | 'cyan';
}) {
  const colors = {
    blue: 'text-neon-blue',
    purple: 'text-neon-purple',
    pink: 'text-neon-pink',
    cyan: 'text-neon-cyan',
  };

  return (
    <div className="lens-card">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}
