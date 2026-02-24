'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Activity, Brain, Layers, Puzzle, Cpu, Users, Settings,
  AlertTriangle, Moon, FileText, Pause, Play,
  Save, Trash2, XCircle, Eye, Clock, ArrowUp,
  Zap, Send, MapPin, Focus, ShieldAlert,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface SystemHealth {
  ok: boolean;
  system?: { version: string; uptime: { seconds: number; formatted: string }; memory: { heapUsed: string; heapTotal: string; rss: string } };
  dtus?: { total: number; regular: number; mega: number; hyper: number; shadow: number };
  llm?: { openaiReady: boolean; ollamaEnabled: boolean };
  [key: string]: unknown;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'green' | 'yellow' | 'red' | 'gray' }) {
  const colors = { green: 'bg-green-400', yellow: 'bg-yellow-400', red: 'bg-red-400', gray: 'bg-gray-500' };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-lattice-surface rounded-lg p-3 border border-lattice-border">
      <p className="text-lg font-mono font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function BreakerBadge({ name, state }: { name: string; state: string }) {
  const color = state === 'closed' ? 'green' : state === 'half-open' ? 'yellow' : 'red';
  return (
    <div className="flex items-center gap-2 text-xs">
      <StatusDot status={color} />
      <span className="text-gray-300 capitalize">{name}</span>
      <span className="text-gray-500 ml-auto">{state}</span>
    </div>
  );
}

function ConfirmButton({ label, icon: Icon, color, onConfirm, description }: {
  label: string; icon: React.ElementType; color: 'red' | 'green' | 'yellow';
  onConfirm: () => void; description: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const colorClass = color === 'red' ? 'bg-red-600 hover:bg-red-500' : color === 'green' ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500';

  if (confirming) {
    return (
      <div className="bg-lattice-elevated border border-lattice-border rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-300">{description}</p>
        <div className="flex gap-2">
          <button onClick={() => { onConfirm(); setConfirming(false); }} className={`px-3 py-1.5 text-xs rounded ${colorClass} text-white`}>Confirm</button>
          <button onClick={() => setConfirming(false)} className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white ${colorClass} transition-colors`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────

function VitalsPanel() {
  const { data: health } = useQuery({ queryKey: ['cc-health'], queryFn: () => apiHelpers.guidance.health().then(r => r.data), refetchInterval: 15000 });
  const { data: queue } = useQuery({ queryKey: ['cc-queue'], queryFn: () => apiHelpers.backpressure.status().then(r => r.data), refetchInterval: 15000 });
  const { data: breakers } = useQuery({ queryKey: ['cc-breakers'], queryFn: () => apiHelpers.status.get().then(r => r.data), refetchInterval: 15000 });
  const { data: traces } = useQuery({ queryKey: ['cc-traces'], queryFn: () => apiHelpers.perf.metrics().then(r => r.data), refetchInterval: 15000 });

  const h = health as SystemHealth | undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">System Vitals</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Uptime" value={h?.system?.uptime?.formatted || '—'} />
        <Stat label="Memory" value={h?.system?.memory?.heapUsed || '—'} sub={`of ${h?.system?.memory?.heapTotal || '?'}`} />
        <Stat label="Total DTUs" value={h?.dtus?.total ?? '—'} sub={`${h?.dtus?.shadow || 0} shadows`} />
        <Stat label="Queue Depth" value={queue?.depth ?? '—'} sub={`${queue?.processing ?? 0} active`} />
        <Stat label="p50 Latency" value={traces?.p50 ? `${traces.p50}ms` : '—'} />
        <Stat label="p99 Latency" value={traces?.p99 ? `${traces.p99}ms` : '—'} />
      </div>
      {breakers?.breakers && (
        <div className="bg-lattice-deep rounded-lg p-3 space-y-2 border border-lattice-border">
          <p className="text-xs font-semibold text-gray-400 uppercase">Circuit Breakers</p>
          {Object.entries(breakers.breakers as Record<string, { state: string }>).map(([name, b]) => (
            <BreakerBadge key={name} name={name} state={b.state || 'unknown'} />
          ))}
        </div>
      )}
    </div>
  );
}

const DISTRICT_META: Record<string, { label: string; color: string; icon: string }> = {
  commons: { label: 'The Commons', color: 'text-blue-400', icon: 'cross-domain dialogue' },
  observatory: { label: 'The Observatory', color: 'text-cyan-400', icon: 'external data' },
  forge: { label: 'The Forge', color: 'text-orange-400', icon: 'plugin creation' },
  archive: { label: 'The Archive', color: 'text-amber-400', icon: 'first principles' },
  garden: { label: 'The Garden', color: 'text-green-400', icon: 'shadow patterns' },
  gate: { label: 'The Gate', color: 'text-red-400', icon: 'governance' },
  nursery: { label: 'The Nursery', color: 'text-purple-400', icon: 'emergence' },
};

function EmergentPanel() {
  const { data } = useQuery({ queryKey: ['cc-emergents'], queryFn: () => apiHelpers.macros.run('emergent.list').then(r => r.data).catch((err) => { console.error('Failed to fetch emergents:', err instanceof Error ? err.message : err); return { emergents: [] }; }), refetchInterval: 30000 });
  const { data: censusData } = useQuery({ queryKey: ['cc-census'], queryFn: () => apiHelpers.macros.run('emergent.district.census').then(r => r.data).catch((err) => { console.error('Failed to fetch census:', err instanceof Error ? err.message : err); return { census: {} }; }), refetchInterval: 30000 });

  const emergents = (data?.emergents || []) as Array<{ id: string; name: string; role: string; district?: string; instanceScope?: string; active: boolean; createdAt: string }>;
  const census = (censusData?.census || {}) as Record<string, Array<{ id: string; name: string; role: string }>>;
  const global = emergents.filter(e => (e.instanceScope || 'local') === 'global');
  const local = emergents.filter(e => (e.instanceScope || 'local') === 'local');

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Emergent Manager</h3>

      {/* District Map */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> District Map</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(DISTRICT_META).map(([id, meta]) => {
            const residents = census[id] || [];
            return (
              <div key={id} className="bg-lattice-surface rounded-lg p-2 border border-lattice-border">
                <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
                <p className="text-[10px] text-gray-600">{meta.icon}</p>
                <p className="text-lg font-mono font-bold text-white mt-1">{residents.length}</p>
                {residents.slice(0, 3).map(r => (
                  <p key={r.id} className="text-[10px] text-gray-400 truncate">{r.name}</p>
                ))}
                {residents.length > 3 && <p className="text-[10px] text-gray-600">+{residents.length - 3} more</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Emergents */}
      {global.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-neon-cyan font-semibold">Global ({global.length})</p>
          {global.map(e => (
            <div key={e.id} className="flex items-center gap-2 bg-lattice-surface rounded p-2 border border-lattice-border text-sm">
              <StatusDot status={e.active ? 'green' : 'gray'} />
              <span className="text-white font-medium flex-1 truncate">{e.name}</span>
              <span className={`text-[10px] ${DISTRICT_META[e.district || 'commons']?.color || 'text-gray-500'}`}>{DISTRICT_META[e.district || 'commons']?.label || e.district}</span>
              <span className="text-xs text-gray-500">{e.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Local Emergents */}
      <div className="space-y-2">
        <p className="text-xs text-neon-purple font-semibold">Local ({local.length})</p>
        {local.slice(0, 20).map(e => (
          <div key={e.id} className="flex items-center gap-2 bg-lattice-surface rounded p-2 border border-lattice-border text-sm">
            <StatusDot status={e.active ? 'green' : 'gray'} />
            <span className="text-white font-medium flex-1 truncate">{e.name}</span>
            <span className={`text-[10px] ${DISTRICT_META[e.district || 'commons']?.color || 'text-gray-500'}`}>{DISTRICT_META[e.district || 'commons']?.label || e.district}</span>
            <span className="text-xs text-gray-500">{e.role}</span>
          </div>
        ))}
        {local.length > 20 && <p className="text-xs text-gray-500">+ {local.length - 20} more</p>}
      </div>
    </div>
  );
}

function LatticePanel() {
  const { data: meta } = useQuery({ queryKey: ['cc-meta'], queryFn: () => apiHelpers.emergent.status().then(r => r.data), refetchInterval: 30000 });
  const { data: convergences } = useQuery({ queryKey: ['cc-convergences'], queryFn: () => apiHelpers.emergent.resonance().then(r => r.data), refetchInterval: 60000 });
  const { data: pending } = useQuery({ queryKey: ['cc-predictions'], queryFn: () => apiHelpers.metacognition.calibration().then(r => r.data), refetchInterval: 60000 });
  const qc = useQueryClient();
  const triggerMutation = useMutation({ mutationFn: () => apiHelpers.bridge.heartbeatTick(), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-meta'] }), onError: (err) => console.error('Meta-derivation trigger failed:', err instanceof Error ? err.message : err) });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Lattice Monitor</h3>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Meta-Invariants" value={meta?.totalMetaInvariants ?? '—'} />
        <Stat label="Convergences" value={convergences?.convergences?.length ?? '—'} />
        <Stat label="Pending Predictions" value={pending?.predictions?.length ?? '—'} />
        <Stat label="Cycles Run" value={meta?.cyclesRun ?? '—'} />
      </div>
      <button onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 disabled:opacity-50 transition-colors">
        <Zap className="w-4 h-4" /> {triggerMutation.isPending ? 'Running...' : 'Trigger Meta-Derivation'}
      </button>
    </div>
  );
}

function PluginPanel() {
  const { data } = useQuery({ queryKey: ['cc-plugins'], queryFn: () => apiHelpers.marketplace.installed().then(r => r.data), refetchInterval: 30000 });
  const { data: metrics } = useQuery({ queryKey: ['cc-plugin-metrics'], queryFn: () => apiHelpers.marketplace.listings().then(r => r.data), refetchInterval: 30000 });

  const plugins = (data?.plugins || []) as Array<{ id: string; name: string; version: string; isEmergentGen: boolean; author: string }>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Plugin Manager</h3>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Loaded" value={metrics?.loadedCount ?? 0} />
        <Stat label="Pending Governance" value={metrics?.pendingGovernanceCount ?? 0} />
      </div>
      <div className="space-y-2">
        {plugins.map(p => (
          <div key={p.id} className="flex items-center gap-2 bg-lattice-surface rounded p-2 border border-lattice-border text-sm">
            <Puzzle className="w-4 h-4 text-neon-green" />
            <span className="text-white flex-1 truncate">{p.name}</span>
            <span className="text-xs text-gray-500">v{p.version}</span>
            {p.isEmergentGen && <span className="text-[10px] bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded">emergent</span>}
          </div>
        ))}
        {plugins.length === 0 && <p className="text-xs text-gray-500 text-center py-3">No plugins loaded</p>}
      </div>
    </div>
  );
}

function PipelinePanel() {
  const { data: queue } = useQuery({ queryKey: ['cc-queue'], queryFn: () => apiHelpers.backpressure.status().then(r => r.data), refetchInterval: 10000 });
  const { data: breakers } = useQuery({ queryKey: ['cc-breakers'], queryFn: () => apiHelpers.status.get().then(r => r.data), refetchInterval: 15000 });
  const qc = useQueryClient();
  const resetBreakers = useMutation({ mutationFn: () => apiHelpers.perf.gc(), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-breakers'] }), onError: (err) => console.error('Circuit breaker reset failed:', err instanceof Error ? err.message : err) });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">LLM Pipeline</h3>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Queue Depth" value={queue?.depth ?? '—'} />
        <Stat label="Processing" value={queue?.processing ?? '—'} />
        <Stat label="Completed" value={queue?.completed ?? '—'} />
        <Stat label="Rejected" value={queue?.rejected ?? '—'} />
      </div>
      {breakers?.breakers && (
        <div className="bg-lattice-deep rounded-lg p-3 space-y-2 border border-lattice-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase">Breakers</p>
            <button onClick={() => resetBreakers.mutate()} disabled={resetBreakers.isPending} className="text-[10px] text-neon-cyan hover:underline disabled:opacity-50 disabled:cursor-not-allowed">{resetBreakers.isPending ? 'Resetting...' : 'Reset All'}</button>
          </div>
          {Object.entries(breakers.breakers as Record<string, { state: string }>).map(([name, b]) => (
            <BreakerBadge key={name} name={name} state={b.state || 'unknown'} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserPanel() {
  const { data } = useQuery({ queryKey: ['cc-admin-stats'], queryFn: () => apiHelpers.analytics.dashboard().then(r => r.data).catch((err) => { console.error('Failed to fetch admin stats:', err instanceof Error ? err.message : err); return {}; }), refetchInterval: 60000 });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">User Overview</h3>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total Users" value={data?.totalUsers ?? '—'} />
        <Stat label="Active (24h)" value={data?.activeUsers24h ?? '—'} />
        <Stat label="New Today" value={data?.newToday ?? '—'} />
        <Stat label="WS Connections" value={data?.wsConnections ?? '—'} />
      </div>
      <p className="text-[10px] text-gray-600 text-center">Aggregate metrics only. No individual user data exposed.</p>
    </div>
  );
}

function ConfigPanel() {
  const qc = useQueryClient();
  const settingsMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => apiHelpers.macros.run('settings.update', updates),
    onSuccess: () => qc.invalidateQueries(),
    onError: (err) => console.error('Settings update failed:', err instanceof Error ? err.message : err),
  });

  const settings = [
    { key: 'heartbeatEnabled', label: 'Heartbeat', type: 'boolean' as const },
    { key: 'heartbeatMs', label: 'Heartbeat Interval (ms)', type: 'number' as const, min: 2000, max: 120000 },
    { key: 'globalTickMs', label: 'Global Tick (ms)', type: 'number' as const, min: 60000, max: 600000 },
    { key: 'autogenEnabled', label: 'Autogen', type: 'boolean' as const },
    { key: 'registrationEnabled', label: 'Registration', type: 'boolean' as const },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Configuration</h3>
      <div className="space-y-2">
        {settings.map(s => (
          <div key={s.key} className="flex items-center justify-between bg-lattice-surface rounded p-2.5 border border-lattice-border">
            <span className="text-sm text-gray-300">{s.label}</span>
            {s.type === 'boolean' ? (
              <button
                onClick={() => settingsMutation.mutate({ [s.key]: true })}
                disabled={settingsMutation.isPending}
                className="text-xs px-2 py-1 rounded bg-neon-green/20 text-neon-green border border-neon-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsMutation.isPending ? '...' : 'Toggle'}
              </button>
            ) : (
              <span className="text-xs text-gray-500">{s.min}–{s.max}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmergencyPanel() {
  const qc = useQueryClient();
  const settingsMutation = useMutation({ mutationFn: (updates: Record<string, unknown>) => apiHelpers.macros.run('settings.update', updates), onSuccess: () => qc.invalidateQueries(), onError: (err) => console.error('Emergency settings update failed:', err instanceof Error ? err.message : err) });
  const saveMutation = useMutation({ mutationFn: () => apiHelpers.db.sync(), onError: (err) => console.error('State save failed:', err instanceof Error ? err.message : err) });
  const flushMutation = useMutation({ mutationFn: () => apiHelpers.perf.gc(), onError: (err) => console.error('Queue flush failed:', err instanceof Error ? err.message : err) });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Emergency Controls</h3>
      <div className="space-y-3">
        <ConfirmButton label="Pause All Processing" icon={Pause} color="red"
          description="Stops autogen, heartbeat, global tick, meta-derivation. User-facing requests still work."
          onConfirm={() => settingsMutation.mutate({ autogenEnabled: false, heartbeatEnabled: false })} />
        <ConfirmButton label="Disable Registration" icon={XCircle} color="red"
          description="No new user signups. Existing users unaffected."
          onConfirm={() => settingsMutation.mutate({ registrationEnabled: false })} />
        <ConfirmButton label="Force State Save" icon={Save} color="yellow"
          description="Immediately saves current state to disk."
          onConfirm={() => saveMutation.mutate()} />
        <ConfirmButton label="Flush LLM Queue" icon={Trash2} color="red"
          description="Drops all pending LLM calls. Active calls finish."
          onConfirm={() => flushMutation.mutate()} />
        <ConfirmButton label="Resume All" icon={Play} color="green"
          description="Restarts autogen, heartbeat, and all background processing."
          onConfirm={() => settingsMutation.mutate({ autogenEnabled: true, heartbeatEnabled: true })} />
      </div>
    </div>
  );
}

function DreamPanel() {
  const [text, setText] = useState('');
  const qc = useQueryClient();
  const submitMutation = useMutation({
    mutationFn: (body: { text: string; capturedAt: string }) => apiHelpers.dream.run({ seed: body.text }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['cc-meta'] }); },
    onError: (err) => console.error('Dream input submission failed:', err instanceof Error ? err.message : err),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Dream Input</h3>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What did you derive in your sleep?"
        className="w-full h-32 bg-lattice-deep border border-lattice-border rounded-lg p-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-neon-cyan/50"
      />
      <button
        onClick={() => submitMutation.mutate({ text, capturedAt: new Date().toISOString() })}
        disabled={!text.trim() || submitMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30 disabled:opacity-40 transition-colors"
      >
        <Send className="w-4 h-4" /> {submitMutation.isPending ? 'Submitting...' : 'Submit Derivation'}
      </button>
      {submitMutation.isSuccess && <p className="text-xs text-neon-green text-center">Submitted. The lattice will process it.</p>}
    </div>
  );
}

function LogsPanel() {
  const { data: errors } = useQuery({ queryKey: ['cc-errors'], queryFn: () => apiHelpers.eventsLog.list({ type: 'error', limit: 20 }).then(r => r.data), refetchInterval: 15000 });
  const { data: traces } = useQuery({ queryKey: ['cc-slow-traces'], queryFn: () => apiHelpers.perf.metrics().then(r => r.data), refetchInterval: 30000 });
  const { data: rejections } = useQuery({ queryKey: ['cc-rejections'], queryFn: () => apiHelpers.eventsLog.list({ type: 'governance-rejection', limit: 20 }).then(r => r.data), refetchInterval: 60000 });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Logs & Traces</h3>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-red-400">Recent Errors ({errors?.count ?? 0})</p>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {(errors?.errors || []).slice(0, 15).map((e: { source: string; message: string; at: string }, i: number) => (
            <div key={i} className="text-[11px] bg-red-950/30 border border-red-900/30 rounded p-2">
              <span className="text-red-400">{e.source}</span>
              <span className="text-gray-500 ml-2">{e.message?.slice(0, 80)}</span>
            </div>
          ))}
          {(!errors?.errors || errors.errors.length === 0) && <p className="text-xs text-gray-600">No recent errors</p>}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-yellow-400">Slow Requests ({traces?.traces?.length ?? 0})</p>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {(traces?.traces || []).slice(0, 10).map((t: { path: string; durationMs: number }, i: number) => (
            <div key={i} className="text-[11px] flex justify-between bg-lattice-surface rounded p-1.5 border border-lattice-border">
              <span className="text-gray-300 truncate">{t.path}</span>
              <span className="text-yellow-400 ml-2">{t.durationMs}ms</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400">Governance Rejections ({rejections?.count ?? 0})</p>
        {(rejections?.rejections || []).slice(0, 5).map((r: { type?: string; event?: string; reason?: string }, i: number) => (
          <div key={i} className="text-[11px] bg-lattice-surface rounded p-1.5 border border-lattice-border text-gray-400">
            {r.type || r.event || 'rejection'} — {r.reason || '—'}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── New Cognitive System Panels ─────────────────────────────────────────────

function BrainsPanel() {
  const { data } = useQuery({ queryKey: ['cc-brains'], queryFn: () => apiHelpers.brain.status().then(r => r.data), refetchInterval: 10000 });

  const brains = data?.brains as Record<string, { enabled: boolean; model: string; role: string; url: string; stats: { requests: number; totalMs: number; dtusGenerated: number; errors: number; fixes?: number; sleeping?: boolean; lastCallAt: string | null }; avgResponseMs: number }> | undefined;
  const mode = data?.mode || 'fallback';
  const onlineCount = data?.onlineCount ?? 0;
  const totalBrains = brains ? Object.keys(brains).length : 0;

  const modeColor = (mode === 'four_brain' || mode === 'three_brain') ? 'text-neon-green' : mode === 'partial' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Four-Brain Architecture</h3>
      <div className="flex items-center gap-3">
        <span className={`text-lg font-bold ${modeColor}`}>{mode.replace('_', '-')}</span>
        <span className="text-sm text-gray-500">{onlineCount}/{totalBrains} online</span>
      </div>
      {brains && Object.entries(brains).map(([name, brain]) => (
        <div key={name} className={`bg-lattice-surface rounded-lg p-3 border border-lattice-border ${!brain.enabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusDot status={brain.enabled ? 'green' : 'red'} />
              <span className="text-sm font-medium text-white capitalize">{name}</span>
              <span className="text-[10px] text-gray-500">{brain.model}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-2">{brain.role}</p>
          {brain.enabled && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Requests" value={brain.stats.requests} />
              <Stat label="Avg ms" value={brain.avgResponseMs || (brain.stats.requests > 0 ? Math.round(brain.stats.totalMs / brain.stats.requests) : 0)} />
              <Stat label="Errors" value={brain.stats.errors} />
            </div>
          )}
          {brain.stats.fixes !== undefined && (
            <div className="mt-2 text-xs text-gray-400">Fixes applied: <span className="font-mono text-neon-green">{brain.stats.fixes}</span></div>
          )}
        </div>
      ))}
    </div>
  );
}

function AttentionPanel() {
  const { data: status } = useQuery({ queryKey: ['cc-attention'], queryFn: () => apiHelpers.attentionAlloc.status().then(r => r.data), refetchInterval: 15000 });
  const qc = useQueryClient();
  const unfocusMutation = useMutation({ mutationFn: () => apiHelpers.attentionAlloc.unfocus(), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-attention'] }), onError: (err) => console.error('Unfocus failed:', err instanceof Error ? err.message : err) });

  const allocation = (status?.lastAllocation?.allocation || []) as Array<{ domain: string; budget: number; urgency: number; focused?: boolean }>;
  const focusOverride = status?.focusOverride as { domain: string; weight: number; expiresAt: string } | null;
  const totalBudget = allocation.reduce((sum: number, a: { budget: number }) => sum + a.budget, 0) || 1;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Attention Allocator</h3>
      {focusOverride && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <Focus className="w-4 h-4" />
            <span>Focus: <strong>{focusOverride.domain}</strong> @ {(focusOverride.weight * 100).toFixed(0)}%</span>
          </div>
          <button onClick={() => unfocusMutation.mutate()} disabled={unfocusMutation.isPending} className="text-xs text-red-400 hover:underline disabled:opacity-50">
            Clear
          </button>
        </div>
      )}
      <div className="space-y-2">
        {allocation.slice(0, 15).map((a: { domain: string; budget: number; urgency: number; focused?: boolean }) => (
          <div key={a.domain} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-gray-300" title={a.domain}>{a.domain}</span>
            <div className="flex-1 h-3 bg-lattice-deep rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${a.focused ? 'bg-yellow-500' : 'bg-neon-cyan/60'}`} style={{ width: `${Math.max(2, (a.budget / totalBudget) * 100)}%` }} />
            </div>
            <span className="w-8 text-right text-gray-500 font-mono">{a.budget}</span>
            <span className="w-12 text-right text-gray-500">{(a.urgency * 100).toFixed(0)}%</span>
          </div>
        ))}
        {allocation.length === 0 && <p className="text-xs text-gray-500 text-center py-3">No allocation data yet</p>}
      </div>
    </div>
  );
}

function ForgettingPanel() {
  const { data: status } = useQuery({ queryKey: ['cc-forgetting'], queryFn: () => apiHelpers.forgetting.status().then(r => r.data), refetchInterval: 30000 });
  const qc = useQueryClient();
  const runMutation = useMutation({ mutationFn: () => apiHelpers.forgetting.run(), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-forgetting'] }), onError: (err) => console.error('Forgetting cycle failed:', err instanceof Error ? err.message : err) });
  const { data: candidates } = useQuery({ queryKey: ['cc-forgetting-candidates'], queryFn: () => apiHelpers.forgetting.candidates().then(r => r.data), refetchInterval: 60000 });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Forgetting Engine</h3>
      {status && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tombstones" value={status.tombstones ?? 0} />
            <Stat label="Lifetime" value={status.lifetimeForgotten ?? 0} />
            <Stat label="Threshold" value={status.threshold ?? 0} />
          </div>
          {status.lastRun && (
            <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Last: {new Date(status.lastRun).toLocaleString()}</p>
          )}
        </>
      )}
      {candidates && (
        <p className="text-xs text-gray-400">{candidates.candidateCount ?? 0} candidates for forgetting</p>
      )}
      <div className="flex gap-2">
        <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-colors">
          <Trash2 className="w-4 h-4" /> {runMutation.isPending ? 'Running...' : 'Run Forgetting Cycle'}
        </button>
      </div>
    </div>
  );
}

function RepairCortexPanel() {
  const { data: status } = useQuery({ queryKey: ['cc-repair'], queryFn: () => apiHelpers.repairExtended.status().then(r => r.data), refetchInterval: 15000 });
  const qc = useQueryClient();
  const forceMutation = useMutation({ mutationFn: () => apiHelpers.repairExtended.force(), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-repair'] }), onError: (err) => console.error('Force repair failed:', err instanceof Error ? err.message : err) });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Repair Cortex</h3>
      {status ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Cycles" value={status.cycleCount ?? 0} />
            <Stat label="Error Accum" value={status.errorAccumulatorSize ?? 0} />
            <Stat label="Executors" value={`${status.executorsReady ?? 0}/${status.executorCount ?? 0}`} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatusDot status={status.running ? 'green' : 'red'} />
            <span className="text-gray-400">Loop: {status.running ? 'Active' : 'Stopped'}</span>
            {status.lastCycleAt && <span className="text-gray-500 ml-auto">Last: {new Date(status.lastCycleAt).toLocaleString()}</span>}
          </div>
          {status.networkStatus && (
            <p className="text-xs text-gray-500">Network: {status.networkStatus}</p>
          )}
          <button onClick={() => forceMutation.mutate()} disabled={forceMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-50 transition-colors">
            <ShieldAlert className="w-4 h-4" /> {forceMutation.isPending ? 'Running...' : 'Force Repair Cycle'}
          </button>
        </>
      ) : (
        <p className="text-xs text-gray-500">Loading...</p>
      )}
    </div>
  );
}

function PromotionPanel() {
  const { data } = useQuery({ queryKey: ['cc-promotions'], queryFn: () => apiHelpers.promotion.queue().then(r => r.data), refetchInterval: 30000 });
  const qc = useQueryClient();
  const approveMutation = useMutation({ mutationFn: (id: string) => apiHelpers.promotion.approve(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-promotions'] }), onError: (err) => console.error('Promotion approval failed:', err instanceof Error ? err.message : err) });
  const rejectMutation = useMutation({ mutationFn: (id: string) => apiHelpers.promotion.reject(id, 'Rejected from command center'), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-promotions'] }), onError: (err) => console.error('Promotion rejection failed:', err instanceof Error ? err.message : err) });

  const queue = (data?.queue || []) as Array<{ id: string; artifactName?: string; fromStage: string; toStage: string; status: string; requestedAt: string }>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Promotion Pipeline</h3>
      <div className="space-y-2">
        {queue.length === 0 && <p className="text-xs text-gray-500 text-center py-3">No pending promotions</p>}
        {queue.map(p => (
          <div key={p.id} className="bg-lattice-surface rounded-lg p-3 border border-lattice-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white font-medium">{p.artifactName || p.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : p.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {p.status}
              </span>
            </div>
            <p className="text-xs text-gray-400">{p.fromStage} → {p.toStage}</p>
            <p className="text-[10px] text-gray-500">{new Date(p.requestedAt).toLocaleString()}</p>
            {p.status === 'pending' && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => approveMutation.mutate(p.id)} disabled={approveMutation.isPending} className="flex-1 text-xs px-2 py-1.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 disabled:opacity-50">Approve</button>
                <button onClick={() => rejectMutation.mutate(p.id)} disabled={rejectMutation.isPending} className="flex-1 text-xs px-2 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab Navigation ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'brains', label: 'Brains', icon: Brain },
  { id: 'emergents', label: 'Emergents', icon: Cpu },
  { id: 'lattice', label: 'Lattice', icon: Layers },
  { id: 'attention', label: 'Attention', icon: Focus },
  { id: 'forgetting', label: 'Forgetting', icon: Trash2 },
  { id: 'repair', label: 'Repair', icon: ShieldAlert },
  { id: 'promotions', label: 'Promotions', icon: ArrowUp },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'pipeline', label: 'Pipeline', icon: Zap },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'dream', label: 'Dream', icon: Moon },
  { id: 'logs', label: 'Logs', icon: FileText },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Main Component ──────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  useLensNav('command-center');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('vitals');

  // Auth gate — check if user is owner, redirect silently if not
  const { data: me, isLoading: authLoading } = useQuery({
    queryKey: ['cc-auth'],
    queryFn: () => apiHelpers.auth.me().then(r => r.data),
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && me && !['owner', 'founder'].includes(me.role)) {
      router.push('/lenses');
    }
  }, [me, authLoading, router]);

  if (authLoading) return null;
  if (!me || !['owner', 'founder'].includes(me.role)) return null;

  const renderPanel = () => {
    switch (activeTab) {
      case 'vitals': return <VitalsPanel />;
      case 'brains': return <BrainsPanel />;
      case 'emergents': return <EmergentPanel />;
      case 'lattice': return <LatticePanel />;
      case 'attention': return <AttentionPanel />;
      case 'forgetting': return <ForgettingPanel />;
      case 'repair': return <RepairCortexPanel />;
      case 'promotions': return <PromotionPanel />;
      case 'plugins': return <PluginPanel />;
      case 'pipeline': return <PipelinePanel />;
      case 'users': return <UserPanel />;
      case 'config': return <ConfigPanel />;
      case 'emergency': return <EmergencyPanel />;
      case 'dream': return <DreamPanel />;
      case 'logs': return <LogsPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-lattice-void text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-lattice-deep/95 backdrop-blur border-b border-lattice-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-neon-cyan" />
          <h1 className="text-base font-bold">Command Center</h1>
        </div>
      </div>

      {/* Tab Bar — horizontal scroll on mobile */}
      <div className="sticky top-[52px] z-40 bg-lattice-deep border-b border-lattice-border overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? 'text-neon-cyan border-neon-cyan'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {renderPanel()}
      </div>
    </div>
  );
}
