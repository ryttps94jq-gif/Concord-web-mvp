'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  Users,
  Layers,
  RefreshCw,
  Settings,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  Box
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface DashboardData {
  ok: boolean;
  system: {
    version: string;
    uptime: { seconds: number; formatted: string };
    memory: { heapUsed: string; heapTotal: string; rss: string };
    nodeVersion: string;
  };
  dtus: {
    total: number;
    regular: number;
    mega: number;
    hyper: number;
    shadow: number;
  };
  sessions: {
    total: number;
    active: number;
  };
  organs: {
    total: number;
    healthy: number;
  };
  llm: {
    openaiReady: boolean;
    ollamaEnabled: boolean;
    defaultOn: boolean;
  };
  queues: {
    maintenance: number;
    synthesis: number;
    hypotheses: number;
  };
  plugins: {
    total: number;
    enabled: number;
  };
  searchIndex: {
    documents: number;
    terms: number;
    dirty: boolean;
  };
}

interface MetricsData {
  ok: boolean;
  chicken2: {
    continuityAvg: number;
    homeostasis: number;
    contradictionLoad: number;
    suffering: number;
    accepts: number;
    rejects: number;
  };
  growth: {
    bioAge: number;
    telomere: number;
    homeostasis: number;
    stress: { acute: number; chronic: number };
  };
  abstraction: {
    load: number;
    margin: number;
    enabled: boolean;
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'blue',
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'blue' | 'purple' | 'green' | 'pink' | 'orange';
  trend?: 'up' | 'down' | 'stable';
}) {
  const colorClasses = {
    blue: 'text-neon-blue bg-neon-blue/10 border-neon-blue/30',
    purple: 'text-neon-purple bg-neon-purple/10 border-neon-purple/30',
    green: 'text-neon-green bg-neon-green/10 border-neon-green/30',
    pink: 'text-neon-pink bg-neon-pink/10 border-neon-pink/30',
    orange: 'text-neon-orange bg-neon-orange/10 border-neon-orange/30',
  };

  return (
    <div className="dashboard-card">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <TrendingUp
            className={`w-4 h-4 ${
              trend === 'up'
                ? 'text-green-400'
                : trend === 'down'
                ? 'text-red-400 rotate-180'
                : 'text-gray-400'
            }`}
          />
        )}
      </div>
      <div className="mt-4">
        <p className="dashboard-stat">{value}</p>
        <p className="dashboard-label">{label}</p>
        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  max = 100,
  color = 'blue',
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const colorClass =
    color === 'green'
      ? 'bg-neon-green'
      : color === 'purple'
      ? 'bg-neon-purple'
      : color === 'pink'
      ? 'bg-neon-pink'
      : 'bg-neon-blue';

  return (
    <div>
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">{label}</span>
          <span className="text-white">{percentage.toFixed(1)}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div
          className={`progress-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'healthy' | 'warning' | 'error' }) {
  const classes = {
    healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const icons = {
    healthy: CheckCircle,
    warning: AlertCircle,
    error: AlertCircle,
  };
  const Icon = icons[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${classes[status]}`}
    >
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AdminDashboardPage() {
  useLensNav('admin');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    data: dashboard,
    refetch: refetchDashboard,
    isLoading: dashboardLoading, isError: isError, error: error,} = useQuery<DashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/api/admin/dashboard').then((r) => r.data),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: metrics, refetch: refetchMetrics, isError: isError2, error: error2,} = useQuery<MetricsData>({
    queryKey: ['admin-metrics'],
    queryFn: () => api.get('/api/admin/metrics').then((r) => r.data),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: logs, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => api.get('/api/admin/logs?limit=20').then((r) => r.data),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const handleRefresh = () => {
    refetchDashboard();
    refetchMetrics();
  };

  const systemHealth =
    dashboard?.llm.openaiReady || dashboard?.llm.ollamaEnabled
      ? 'healthy'
      : 'warning';
  const organHealth =
    (dashboard?.organs.healthy || 0) / (dashboard?.organs.total || 1) > 0.7
      ? 'healthy'
      : 'warning';


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neon-purple/10 border border-neon-purple/30">
            <Settings className="w-6 h-6 text-neon-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-gray-400">
              Concord v{dashboard?.system.version || '...'} • Uptime:{' '}
              {dashboard?.system.uptime.formatted || '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-lattice-deep border-lattice-border"
            />
            Auto-refresh
          </label>
          <button onClick={handleRefresh} className="btn-neon">
            <RefreshCw
              className={`w-4 h-4 mr-2 inline ${
                dashboardLoading ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>
        </div>
      </header>

      {/* Status Overview */}
      <div className="flex gap-4">
        <StatusBadge status={systemHealth} />
        <StatusBadge status={organHealth} />
        {dashboard?.searchIndex.dirty && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-orange-500/20 text-orange-400 border-orange-500/30">
            Search index needs rebuild
          </span>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Database}
          label="Total DTUs"
          value={dashboard?.dtus.total || 0}
          subValue={`${dashboard?.dtus.mega || 0} mega, ${
            dashboard?.dtus.hyper || 0
          } hyper`}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Sessions"
          value={dashboard?.sessions.total || 0}
          subValue={`${dashboard?.sessions.active || 0} active`}
          color="purple"
        />
        <StatCard
          icon={Brain}
          label="Organs"
          value={dashboard?.organs.total || 0}
          subValue={`${dashboard?.organs.healthy || 0} healthy`}
          color="green"
        />
        <StatCard
          icon={Box}
          label="Plugins"
          value={dashboard?.plugins.total || 0}
          subValue={`${dashboard?.plugins.enabled || 0} enabled`}
          color="pink"
        />
        <StatCard
          icon={Layers}
          label="Queue Items"
          value={
            (dashboard?.queues.maintenance || 0) +
            (dashboard?.queues.synthesis || 0) +
            (dashboard?.queues.hypotheses || 0)
          }
          color="orange"
        />
        <StatCard
          icon={Zap}
          label="Search Terms"
          value={dashboard?.searchIndex.terms || 0}
          subValue={`${dashboard?.searchIndex.documents || 0} docs`}
          color="blue"
        />
      </div>

      {/* Metrics Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Chicken2 Metrics */}
        <div className="panel p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-cyan" />
            Reality Guard (Chicken2)
          </h2>
          <div className="space-y-4">
            <ProgressBar
              value={(metrics?.chicken2.homeostasis || 0.8) * 100}
              label="Homeostasis"
              color="green"
            />
            <ProgressBar
              value={(metrics?.chicken2.continuityAvg || 0) * 100}
              label="Continuity"
              color="blue"
            />
            <ProgressBar
              value={(metrics?.chicken2.contradictionLoad || 0) * 100}
              label="Contradiction Load"
              color="pink"
            />
            <ProgressBar
              value={(metrics?.chicken2.suffering || 0) * 100}
              label="Suffering Boundary"
              color="purple"
            />
            <div className="flex justify-between text-sm mt-4">
              <span className="text-gray-400">
                Accepts: {metrics?.chicken2.accepts || 0}
              </span>
              <span className="text-gray-400">
                Rejects: {metrics?.chicken2.rejects || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Growth OS Metrics */}
        <div className="panel p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-neon-green" />
            Growth OS
          </h2>
          <div className="space-y-4">
            <div className="metric-card">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Bio Age</span>
                <span className="text-2xl font-bold text-neon-green">
                  {(metrics?.growth.bioAge || 0).toFixed(1)}
                </span>
              </div>
            </div>
            <ProgressBar
              value={(metrics?.growth.telomere || 1) * 100}
              label="Telomere"
              color="green"
            />
            <ProgressBar
              value={(metrics?.growth.homeostasis || 0.9) * 100}
              label="Homeostasis"
              color="blue"
            />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="metric-card text-center">
                <p className="text-xl font-bold text-yellow-400">
                  {((metrics?.growth.stress.acute || 0) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400">Acute Stress</p>
              </div>
              <div className="metric-card text-center">
                <p className="text-xl font-bold text-orange-400">
                  {((metrics?.growth.stress.chronic || 0) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400">Chronic Stress</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Resources */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="panel p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neon-blue" />
            Memory
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Heap Used</span>
              <span>{dashboard?.system.memory.heapUsed || '...'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Heap Total</span>
              <span>{dashboard?.system.memory.heapTotal || '...'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">RSS</span>
              <span>{dashboard?.system.memory.rss || '...'}</span>
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-neon-purple" />
            LLM Status
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">OpenAI</span>
              <span
                className={`status-dot ${
                  dashboard?.llm.openaiReady ? 'success' : 'error'
                }`}
              />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Ollama</span>
              <span
                className={`status-dot ${
                  dashboard?.llm.ollamaEnabled ? 'success' : 'warning'
                }`}
              />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Default On</span>
              <span
                className={`status-dot ${
                  dashboard?.llm.defaultOn ? 'success' : 'info'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-neon-green" />
            Queues
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Maintenance</span>
              <span>{dashboard?.queues.maintenance || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Synthesis</span>
              <span>{dashboard?.queues.synthesis || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Hypotheses</span>
              <span>{dashboard?.queues.hypotheses || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="panel p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-neon-cyan" />
          Recent Activity
        </h2>
        <div className="space-y-2 max-h-60 overflow-auto">
          {(logs?.logs || []).slice(0, 10).map((log: Record<string, unknown>, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 bg-lattice-deep rounded-lg text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-neon-purple font-mono">{String(log.type)}</span>
                <span className="text-gray-400">{String(log.message)}</span>
              </div>
              <span className="text-xs text-gray-500">{String(log.at)}</span>
            </div>
          ))}
          {(!logs?.logs || logs.logs.length === 0) && (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
