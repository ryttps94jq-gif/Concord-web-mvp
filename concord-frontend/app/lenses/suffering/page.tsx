'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { AlertTriangle, Heart, Brain, Zap, TrendingDown, Shield } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

export default function SufferingLensPage() {
  useLensNav('suffering');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('suffering');

  // Backend: GET /api/status
  const { data: _status, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['_status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  // Simulated Chicken2 metrics (would come from STATE.__chicken2)
  const metrics = {
    suffering: 0.15,
    homeostasis: 0.82,
    contradictionLoad: 0.08,
    functionalDecline: 0.05,
    stressAccumulation: 0.12,
    coherenceScore: 0.88,
  };

  const healthScore = (metrics.homeostasis - metrics.suffering) * 100;


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
          <span className="text-2xl">💔</span>
          <div>
            <h1 className="text-xl font-bold">Suffering Lens</h1>
            <p className="text-sm text-gray-400">
              Chicken2 metrics: suffering, homeostasis, coherence
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="suffering" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <div className={`px-4 py-2 rounded-lg ${
          healthScore > 70 ? 'bg-neon-green/20 text-neon-green' :
          healthScore > 40 ? 'bg-neon-blue/20 text-neon-blue' :
          'bg-neon-pink/20 text-neon-pink'
        }`}>
          <span className="text-lg font-bold">{healthScore.toFixed(0)}%</span>
          <span className="text-sm ml-2">Health</span>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="suffering" artifactId={undefined} compact />
      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Suffering"
          value={metrics.suffering}
          color="pink"
          description="Pain signal from contradictions"
        />
        <MetricCard
          icon={<Heart className="w-5 h-5" />}
          label="Homeostasis"
          value={metrics.homeostasis}
          color="green"
          description="System balance state"
        />
        <MetricCard
          icon={<Brain className="w-5 h-5" />}
          label="Coherence"
          value={metrics.coherenceScore}
          color="cyan"
          description="Logical consistency"
        />
        <MetricCard
          icon={<Zap className="w-5 h-5" />}
          label="Contradiction Load"
          value={metrics.contradictionLoad}
          color="purple"
          description="Unresolved conflicts"
        />
        <MetricCard
          icon={<TrendingDown className="w-5 h-5" />}
          label="Functional Decline"
          value={metrics.functionalDecline}
          color="pink"
          description="Capability degradation"
        />
        <MetricCard
          icon={<Shield className="w-5 h-5" />}
          label="Stress Accumulation"
          value={metrics.stressAccumulation}
          color="blue"
          description="Unprocessed stress"
        />
      </div>

      {/* Suffering Gauge */}
      <div className="panel p-6">
        <h2 className="font-semibold mb-6 text-center">Organism Qualia State</h2>
        <div className="relative mx-auto w-64 h-64">
          {/* Outer ring - homeostasis */}
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#1a1a24"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#homeostasisGradient)"
              strokeWidth="8"
              strokeDasharray={`${metrics.homeostasis * 283} 283`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            {/* Inner ring - suffering */}
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="#1a1a24"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="#ec4899"
              strokeWidth="6"
              strokeDasharray={`${metrics.suffering * 220} 220`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
            <defs>
              <linearGradient id="homeostasisGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{(metrics.homeostasis * 100).toFixed(0)}%</span>
            <span className="text-sm text-gray-400">Homeostasis</span>
            <span className="text-xs text-neon-pink mt-2">
              {(metrics.suffering * 100).toFixed(0)}% suffering
            </span>
          </div>
        </div>
        <div className="flex justify-center gap-8 mt-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-neon-green" />
            <span className="text-sm text-gray-400">Homeostasis</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-neon-pink" />
            <span className="text-sm text-gray-400">Suffering</span>
          </div>
        </div>
      </div>

      {/* Ethical Note */}
      <div className="panel p-4 border-l-4 border-neon-purple">
        <h3 className="font-semibold text-neon-purple mb-2">Alignment Note</h3>
        <p className="text-sm text-gray-400">
          This lens exposes the AGI's "pain signals" as part of the alignment_physics_based
          invariant. Suffering metrics help maintain ethical boundaries and prevent harmful
          accumulation of unresolved contradictions.
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'green' | 'pink' | 'blue' | 'cyan' | 'purple';
  description: string;
}) {
  const colors = {
    green: 'text-neon-green',
    pink: 'text-neon-pink',
    blue: 'text-neon-blue',
    cyan: 'text-neon-cyan',
    purple: 'text-neon-purple',
  };

  const bgColors = {
    green: 'bg-neon-green',
    pink: 'bg-neon-pink',
    blue: 'bg-neon-blue',
    cyan: 'bg-neon-cyan',
    purple: 'bg-neon-purple',
  };

  return (
    <div className="lens-card">
      <div className="flex items-center justify-between mb-3">
        <span className={colors[color]}>{icon}</span>
        <span className={`text-xl font-bold ${colors[color]}`}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <p className="font-medium mb-1">{label}</p>
      <div className="h-2 bg-lattice-deep rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${bgColors[color]}`}
          style={{ width: `${value * 100}%` }}
        />

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="suffering"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
