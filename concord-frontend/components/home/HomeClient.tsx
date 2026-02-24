'use client';

/**
 * HomeClient — Client-side home page logic
 *
 * Takes over from the SSR landing content once JS hydrates.
 * Hides the SSR content and shows either:
 *   - LandingPage (interactive) for new visitors
 *   - DashboardPage for returning users
 */

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import dynamic from 'next/dynamic';
const KnowledgeSpace3D = dynamic(
  () => import('@/components/graphs/KnowledgeSpace3D').then(mod => ({ default: mod.KnowledgeSpace3D })),
  { ssr: false, loading: () => (
    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading 3D lattice...
      </div>
    </div>
  )}
);
import { DTUEmpireCard } from '@/components/dtu/DTUEmpireCard';
import { LockDashboard } from '@/components/sovereignty/LockDashboard';
import { CoherenceBadge } from '@/components/graphs/CoherenceBadge';
import { LensErrorBoundary } from '@/components/common/LensErrorBoundary';
import { LandingPage } from '@/components/landing/LandingPage';
import { EmergentPanel } from '@/components/emergent/EmergentPanel';
import { GovernanceFeed } from '@/components/emergent/GovernanceFeed';
import { LiveDTUFeed } from '@/components/live/LiveDTUFeed';
import { ScopeIndicator } from '@/components/live/ScopeIndicator';
import { InspectorDrawer } from '@/components/guidance/InspectorDrawer';
import { useUIStore } from '@/store/ui';
import { CORE_LENSES } from '@/lib/lens-registry';
import {
  Activity, Zap, Compass, TrendingUp, Heart, Globe,
  MessageSquare, Layout, Share2, Code, Music,
} from 'lucide-react';

const ENTERED_KEY = 'concord_entered';

export function HomeClient() {
  const [hasEntered, setHasEntered] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const setFullPageMode = useUIStore((state) => state.setFullPageMode);
  const router = useRouter();
  const authCheckRef = useRef(false);

  useEffect(() => {
    // Hide SSR landing content once client takes over
    const ssrEl = document.getElementById('ssr-landing');
    if (ssrEl) ssrEl.style.display = 'none';

    const entered = localStorage.getItem(ENTERED_KEY);
    const isEntered = entered === 'true';
    setHasEntered(isEntered);
    setFullPageMode(!isEntered);

    // If user has entered before, verify they're still authenticated
    if (isEntered && !authCheckRef.current) {
      authCheckRef.current = true;

      // Race auth check against a timeout to prevent infinite loading
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 10_000)
      );

      const authCheck = api.get('/api/auth/me')
        .then(async () => {
          try { await api.get('/api/auth/csrf-token'); } catch {}
          return 'ok' as const;
        })
        .catch(() => {
          // Not authenticated — the 401 interceptor will redirect to /login
          return 'failed' as const;
        });

      Promise.race([authCheck, timeout]).then((result) => {
        if (result === 'timeout') {
          // Auth check hung — allow through so the page isn't stuck forever.
          // API calls will still get 401-redirected if session is truly dead.
          console.warn('[HomeClient] Auth check timed out after 10s');
        }
        setAuthChecked(true);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnter = () => {
    localStorage.setItem('concord_entered', 'true');
    setHasEntered(true);
  };

  // Still loading from localStorage
  if (hasEntered === null) {
    return null; // SSR content is visible until we know
  }

  // Show landing page for new visitors
  if (!hasEntered) {
    return <LandingPage onEnter={handleEnter} />;
  }

  // Wait for auth check before rendering dashboard
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Show dashboard for authenticated returning users
  return <DashboardPage />;
}

// ============================================================================
// Dashboard Page
// ============================================================================

function DashboardPage() {
  const [inspecting, setInspecting] = useState<{ type: string; id: string } | null>(null);

  // All queries are resilient — each catches errors independently so one failure
  // doesn't crash the dashboard. Each section renders a fallback on error.
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data).catch(() => null),
    retry: 1,
  });

  const { data: dtusData, isLoading: dtusLoading } = useQuery({
    queryKey: ['dtus'],
    queryFn: () => api.get('/api/dtus').then((r) => r.data).catch(() => ({ dtus: [] })),
    retry: 1,
  });

  const { data: scopeMetrics } = useQuery({
    queryKey: ['scope-metrics'],
    queryFn: () => apiHelpers.scope.metrics().then((r) => r.data).catch(() => null),
    refetchInterval: 30000,
    retry: false,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data).catch(() => ({ events: [] })),
    retry: false,
  });

  const { data: resonanceData } = useQuery({
    queryKey: ['resonance-quick'],
    queryFn: () => api.get('/api/lattice/resonance').then((r) => r.data).catch(() => null),
    refetchInterval: 30000,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.get('/api/system/health').then((r) => r.data).catch(() => null),
    refetchInterval: 60000,
    retry: false,
  });

  const { data: guidanceData } = useQuery({
    queryKey: ['guidance-suggestions'],
    queryFn: () => api.get('/api/guidance/suggestions').then((r) => r.data).catch(() => null),
    retry: false,
  });

  // Fetch graph visual data for the Resonance Universe
  const { data: _graphData } = useQuery({
    queryKey: ['graph-visual'],
    queryFn: () => apiHelpers.graph.visual({ limit: 200 }).then((r) => r.data).catch(() => null),
    retry: false,
    staleTime: 30000,
  });

  // Normalize DTU data to handle field name variations from backend
  const dtus = (dtusData?.dtus || []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    tier: ((d.tier as string) || 'regular') as 'regular' | 'mega' | 'hyper' | 'shadow',
    summary: ((d.summary || d.title || (d.human as Record<string, unknown>)?.summary || d.content || 'Untitled') as string),
    timestamp: ((d.timestamp || d.createdAt || d.created_at || new Date().toISOString()) as string),
    resonance: ((d.resonance ?? (d.machine as Record<string, unknown>)?.resonance ?? 0) as number),
    tags: ((d.tags || []) as string[]),
    parentId: d.parentId as string | undefined,
    childCount: (((d.lineage as Record<string, unknown>)?.children as unknown[] || []).length || (d.childCount as number) || 0) as number,
  }));
  const events = eventsData?.events || [];

  // Build 3D graph nodes from DTUs for the Resonance Universe
  const graph3DNodes = useMemo(() => {
    return dtus.slice(0, 100).map((dtu: { id: string; tier?: string; summary?: string; title?: string; resonance?: number; domain?: string }, i: number) => {
      // Spiral galaxy distribution
      const t = i / Math.max(dtus.length, 1);
      const radius = 3 + t * 18;
      const angle = t * Math.PI * 10;
      const y = (Math.sin(i * 0.7) * 3);

      return {
        id: dtu.id,
        label: dtu.title || dtu.summary?.slice(0, 24) || dtu.id.slice(0, 8),
        tier: (dtu.tier || 'regular') as 'regular' | 'mega' | 'hyper' | 'shadow',
        position: [
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        connections: [] as string[],
        resonance: dtu.resonance ?? (resonanceData?.coherence || 0),
      };
    });
  }, [dtus, resonanceData?.coherence]);

  // Build connections between nearby nodes
  const graph3DNodesWithEdges = useMemo(() => {
    const nodes = [...graph3DNodes];
    for (let i = 0; i < nodes.length; i++) {
      // Connect to next 1-3 nodes and some random cross-connections
      const connections: string[] = [];
      if (i + 1 < nodes.length) connections.push(nodes[i + 1].id);
      if (i + 2 < nodes.length && i % 3 === 0) connections.push(nodes[i + 2].id);
      if (i % 5 === 0 && nodes.length > 10) {
        const randomIdx = (i * 7 + 3) % nodes.length;
        if (randomIdx !== i) connections.push(nodes[randomIdx].id);
      }
      nodes[i] = { ...nodes[i], connections };
    }
    return nodes;
  }, [graph3DNodes]);

  const dtuCount = status?.counts?.dtus || dtus.length || 0;
  const coherence = resonanceData?.coherence || 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Concordos Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {statusLoading ? (
              <span className="animate-pulse">Connecting to lattice...</span>
            ) : (
              <>
                {status?.version || 'v5.0'} &middot; {dtuCount.toLocaleString()} DTUs &middot;{' '}
                {status?.llm?.enabled ? 'LLM Active' : 'Local Mode'} &middot;{' '}
                {healthData?.status === 'ok' ? (
                  <span className="text-neon-green">Healthy</span>
                ) : (
                  <span className="text-yellow-400">Checking...</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScopeIndicator />
          <CoherenceBadge score={events.length} />
          <Link
            href="/hub"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-lattice-surface border border-lattice-border hover:border-neon-cyan/50 transition-all text-sm text-gray-400 hover:text-white"
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Explore Lenses</span>
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="My DTUs"
          value={statusLoading ? '...' : (scopeMetrics?.localCount ?? dtuCount)}
          icon={<Zap className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          label="Global DTUs"
          value={statusLoading ? '...' : (scopeMetrics?.globalCount || dtuCount)}
          icon={<Globe className="w-5 h-5" />}
          color="purple"
        />
        <MetricCard
          label="Coherence"
          value={statusLoading ? '...' : `${(coherence * 100).toFixed(0)}%`}
          icon={<Activity className="w-5 h-5" />}
          color="pink"
        />
        <MetricCard
          label="Events"
          value={statusLoading ? '...' : status?.counts?.events || 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="pink"
        />
        <MetricCard
          label="Sovereignty"
          value="70%"
          icon={<Heart className="w-5 h-5" />}
          color="green"
          locked
        />
      </div>

      {/* Live Feed + Emergent Council + Governance — each wrapped independently */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <LensErrorBoundary name="Live DTU Feed">
          <LiveDTUFeed limit={12} />
        </LensErrorBoundary>
        <LensErrorBoundary name="Emergent Panel">
          <EmergentPanel />
        </LensErrorBoundary>
        <LensErrorBoundary name="Governance Feed">
          <GovernanceFeed />
        </LensErrorBoundary>
      </div>

      {/* Resonance Universe 3D + Sovereignty */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <LensErrorBoundary name="Resonance Universe">
          <div className="lg:col-span-2 rounded-xl border border-lattice-border bg-lattice-surface/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-lattice-border flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-neon-cyan" />
                Resonance Universe
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{graph3DNodesWithEdges.length} nodes</span>
                <span className="text-neon-cyan">{(coherence * 100).toFixed(0)}% coherence</span>
              </div>
            </div>
            <div className="h-[420px]">
              {graph3DNodesWithEdges.length > 0 ? (
                <KnowledgeSpace3D nodes={graph3DNodesWithEdges} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Lattice is forming...</p>
                    <p className="text-xs text-gray-600 mt-1">DTUs will appear here as they generate</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </LensErrorBoundary>
        <div className="rounded-xl border border-lattice-border bg-lattice-surface/50 p-4">
          <LockDashboard />
        </div>
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QueueCard label="Ingest Queue" value={status?.queues?.ingest || 0} color="blue" loading={statusLoading} />
        <QueueCard label="Autocrawl" value={status?.queues?.autocrawl || 0} color="purple" loading={statusLoading} />
        <QueueCard label="Domains" value={status?.macro?.domains?.length || 0} color="cyan" loading={statusLoading} />
        <QueueCard label="Wallets" value={status?.counts?.wallets || 0} color="green" loading={statusLoading} />
      </div>

      {/* Recent DTUs */}
      <div className="rounded-xl border border-lattice-border bg-lattice-surface/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-blue" />
            Recent DTUs
          </h2>
          <Link href="/lenses/graph" className="text-xs text-gray-500 hover:text-neon-cyan transition-colors">
            View all in Graph &rarr;
          </Link>
        </div>
        {dtusLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-lattice-deep animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dtus.slice(0, 6).map((dtu: { id: string; tier: 'regular' | 'mega' | 'hyper' | 'shadow'; summary: string; timestamp: string; resonance?: number; tags?: string[] }) => (
              <DTUEmpireCard key={dtu.id} dtu={dtu} onClick={(d) => setInspecting({ type: 'dtu', id: d.id })} />
            ))}
            {dtus.length === 0 && (
              <div className="col-span-full text-center py-10">
                <p className="text-gray-400 mb-1">No DTUs yet</p>
                <p className="text-gray-600 text-sm">Start forging in the Chat lens</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guidance Suggestions */}
      {guidanceData?.suggestions && guidanceData.suggestions.length > 0 && (
        <div className="rounded-xl border border-lattice-border bg-lattice-surface/50 p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-neon-purple" />
            Suggestions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {guidanceData.suggestions.slice(0, 4).map((s: { id?: string; title?: string; message?: string; action?: string }, i: number) => (
              <div key={s.id || i} className="p-3 rounded-lg bg-lattice-deep border border-lattice-border/50 text-sm text-gray-300">
                {s.title || s.message || s.action || 'Suggestion'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core 5 Quick Access */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CORE_LENSES.map((core) => {
          const coreIcons: Record<string, React.ReactNode> = {
            chat: <MessageSquare className="w-5 h-5" />,
            board: <Layout className="w-5 h-5" />,
            graph: <Share2 className="w-5 h-5" />,
            code: <Code className="w-5 h-5" />,
            studio: <Music className="w-5 h-5" />,
          };
          return (
            <Link
              key={core.id}
              href={core.path}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-lattice-border bg-lattice-surface/30 hover:border-neon-cyan/40 hover:bg-lattice-surface/60 transition-all"
            >
              <span className="text-gray-400 group-hover:text-neon-cyan transition-colors">
                {coreIcons[core.id]}
              </span>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {core.name}
              </span>
              <span className="text-[10px] text-gray-600">{core.tagline}</span>
            </Link>
          );
        })}
      </div>

      {/* Inspector Drawer — click a DTU card or graph node to inspect */}
      {inspecting && (
        <InspectorDrawer
          entityType={inspecting.type}
          entityId={inspecting.id}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function MetricCard({
  label, value, icon, color, locked,
}: {
  label: string; value: string | number; icon?: React.ReactNode;
  color: 'blue' | 'purple' | 'pink' | 'green'; locked?: boolean;
}) {
  const colorMap = {
    blue: 'text-neon-blue border-neon-blue/20 bg-neon-blue/5',
    purple: 'text-neon-purple border-neon-purple/20 bg-neon-purple/5',
    pink: 'text-neon-pink border-neon-pink/20 bg-neon-pink/5',
    green: 'text-neon-green border-neon-green/20 bg-neon-green/5',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]} ${locked ? 'sovereignty-lock lock-70' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="opacity-70">{icon}</span>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ label, value, color, loading }: { label: string; value: number; color: 'blue' | 'purple' | 'cyan' | 'green'; loading?: boolean }) {
  const colorClasses = { blue: 'text-neon-blue', purple: 'text-neon-purple', cyan: 'text-neon-cyan', green: 'text-neon-green' };
  return (
    <div className="rounded-lg border border-lattice-border bg-lattice-surface/30 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${colorClasses[color]}`}>{loading ? <span className="animate-pulse">...</span> : value}</p>
    </div>
  );
}
