'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Database, Server, HardDrive, Cpu, RefreshCw, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function DatabaseLensPage() {
  useLensNav('database');

  const { data: dbStatus, refetch: refetchDb } = useQuery({
    queryKey: ['db-status'],
    queryFn: () => api.get('/api/db/status').then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: redisStats, refetch: refetchRedis } = useQuery({
    queryKey: ['redis-stats'],
    queryFn: () => api.get('/api/redis/stats').then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: perfMetrics, refetch: refetchPerf } = useQuery({
    queryKey: ['perf-metrics'],
    queryFn: () => api.get('/api/perf/metrics').then(r => r.data),
    refetchInterval: 5000,
  });

  const { data: backpressure } = useQuery({
    queryKey: ['backpressure'],
    queryFn: () => api.get('/api/backpressure/status').then(r => r.data),
  });

  const migrateMutation = useMutation({
    mutationFn: () => api.post('/api/db/migrate', {}),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/api/db/sync', { batchSize: 100 }),
  });

  const refreshAll = () => {
    refetchDb();
    refetchRedis();
    refetchPerf();
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-neon-orange" />
          <div>
            <h1 className="text-xl font-bold">Database & Performance</h1>
            <p className="text-sm text-gray-400">
              PostgreSQL, Redis, and system metrics
            </p>
          </div>
        </div>
        <button onClick={refreshAll} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </header>

      {/* Connection Status */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          title="Storage Mode"
          value={dbStatus?.mode || 'in-memory'}
          icon={<HardDrive className="w-6 h-6" />}
          status={dbStatus?.mode === 'postgresql' ? 'success' : 'warning'}
        />
        <StatusCard
          title="PostgreSQL"
          value={dbStatus?.postgres?.connected ? 'Connected' : 'Disconnected'}
          icon={<Database className="w-6 h-6" />}
          status={dbStatus?.postgres?.connected ? 'success' : dbStatus?.postgres?.enabled ? 'error' : 'neutral'}
          detail={dbStatus?.postgres?.pool ? `Pool: ${dbStatus.postgres.pool.total} total, ${dbStatus.postgres.pool.idle} idle` : undefined}
        />
        <StatusCard
          title="Redis Cache"
          value={redisStats?.enabled ? 'Connected' : 'Fallback Mode'}
          icon={<Server className="w-6 h-6" />}
          status={redisStats?.enabled ? 'success' : 'warning'}
          detail={redisStats?.keys ? `${redisStats.keys} keys cached` : 'Using in-memory cache'}
        />
      </div>

      {/* Performance Metrics */}
      <div className="panel p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-neon-cyan" />
          Performance Metrics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Heap Used" value={`${perfMetrics?.memory?.heapUsed || 0} MB`} />
          <MetricCard label="Heap Total" value={`${perfMetrics?.memory?.heapTotal || 0} MB`} />
          <MetricCard label="RSS" value={`${perfMetrics?.memory?.rss || 0} MB`} />
          <MetricCard label="Uptime" value={formatUptime(perfMetrics?.uptime)} />
          <MetricCard label="DTUs" value={perfMetrics?.dtus?.total || 0} />
          <MetricCard label="Shadow DTUs" value={perfMetrics?.dtus?.shadow || 0} />
          <MetricCard label="Cache Size" value={perfMetrics?.cache?.hot || 0} />
          <MetricCard label="Graph Nodes" value={perfMetrics?.graph?.nodes || 0} />
        </div>
      </div>

      {/* Backpressure */}
      <div className="panel p-4">
        <h2 className="text-lg font-semibold mb-4">System Load</h2>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg ${
            backpressure?.level === 'normal' ? 'bg-green-500/20 text-green-400' :
            backpressure?.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {backpressure?.level?.toUpperCase() || 'NORMAL'}
          </div>
          <div className="text-sm text-gray-400">
            {backpressure?.dtuCount || 0} DTUs
            (Warning: {backpressure?.thresholds?.warning}, Critical: {backpressure?.thresholds?.critical})
          </div>
        </div>
        {backpressure?.recommendations?.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-yellow-400 mb-1">Recommendations:</p>
            <ul className="text-sm text-gray-400 list-disc list-inside">
              {backpressure.recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Database Actions */}
      <div className="panel p-4">
        <h2 className="text-lg font-semibold mb-4">Database Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={() => migrateMutation.mutate()}
            disabled={migrateMutation.isPending || !dbStatus?.postgres?.connected}
            className="btn-secondary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {migrateMutation.isPending ? 'Running Migrations...' : 'Run Migrations'}
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !dbStatus?.postgres?.connected}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {syncMutation.isPending ? 'Syncing...' : 'Sync to PostgreSQL'}
          </button>
        </div>
        {migrateMutation.data && (
          <p className="mt-2 text-sm text-green-400">
            Migrations complete: {migrateMutation.data.data?.applied}/{migrateMutation.data.data?.total}
          </p>
        )}
        {syncMutation.data && (
          <p className="mt-2 text-sm text-green-400">
            Synced: {syncMutation.data.data?.synced}/{syncMutation.data.data?.total} DTUs
          </p>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, value, icon, status, detail }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  status: 'success' | 'warning' | 'error' | 'neutral';
  detail?: string;
}) {
  const colors = {
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
    neutral: 'text-gray-400',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    neutral: null,
  };

  return (
    <div className="lens-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400">{icon}</span>
        {icons[status]}
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className={`text-lg font-bold ${colors[status]}`}>{value}</p>
      {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-lattice-surface rounded p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
