'use client';

import { useBrainHealth } from '@/hooks/useBrainHealth';

function BrainCard({ name, brain }: { name: string; brain: any }) {
  if (!brain) return null;
  const online = brain.online || brain.enabled;
  const statusColor = online ? 'bg-green-500' : 'bg-red-500';
  const avgMs = brain.avgResponseMs || 0;
  const healthColor = !online ? 'text-red-400' : avgMs > 5000 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold capitalize text-sm">{name}</h3>
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
      </div>
      <div className="text-xs text-neutral-400 space-y-1">
        <div>Model: <span className="text-neutral-200">{brain.model || 'N/A'}</span></div>
        <div>Role: <span className="text-neutral-200">{brain.role || 'N/A'}</span></div>
        <div className={healthColor}>
          Avg Response: {avgMs > 0 ? `${avgMs}ms` : 'N/A'}
        </div>
        <div>Requests: <span className="text-neutral-200">{brain.stats?.requests || 0}</span></div>
        <div>Errors: <span className={brain.stats?.errors > 0 ? 'text-red-400' : 'text-neutral-200'}>
          {brain.stats?.errors || 0}
        </span></div>
        <div>DTUs Generated: <span className="text-neutral-200">{brain.stats?.dtusGenerated || 0}</span></div>
        {brain.stats?.lastCallAt && (
          <div>Last Call: <span className="text-neutral-200">
            {new Date(brain.stats.lastCallAt).toLocaleTimeString()}
          </span></div>
        )}
      </div>
    </div>
  );
}

export default function BrainHealthPanel() {
  const { brainStatus, isLoading, refresh } = useBrainHealth();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-4 bg-neutral-800 rounded w-1/3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-neutral-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Brain Health</h2>
          <p className="text-xs text-neutral-400">
            Mode: <span className="text-neutral-200">{brainStatus.mode}</span>
            {' | '}Online: <span className="text-neutral-200">{brainStatus.onlineCount}/4</span>
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <BrainCard name="Conscious (7B)" brain={brainStatus.conscious} />
        <BrainCard name="Subconscious (1.5B)" brain={brainStatus.subconscious} />
        <BrainCard name="Utility (3B)" brain={brainStatus.utility} />
        <BrainCard name="Repair (0.5B)" brain={brainStatus.repair} />
      </div>
    </div>
  );
}
