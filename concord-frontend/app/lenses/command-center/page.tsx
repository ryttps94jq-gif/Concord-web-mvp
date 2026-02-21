'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Activity, Brain, Layers, Puzzle, Cpu, Users, Settings,
  AlertTriangle, Moon, FileText, Pause, Play,
  Save, Trash2, XCircle,
  Zap, Send, MapPin,
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
  const { data: health } = useQuery({ queryKey: ['cc-health'], queryFn: () => api.get('/api/system/health').then(r => r.data), refetchInterval: 15000 });
  const { data: queue } = useQuery({ queryKey: ['cc-queue'], queryFn: () => api.get('/api/system/llm-queue').then(r => r.data), refetchInterval: 15000 });
  const { data: breakers } = useQuery({ queryKey: ['cc-breakers'], queryFn: () => api.get('/api/system/circuit-breakers').then(r => r.data), refetchInterval: 15000 });
  const { data: traces } = useQuery({ queryKey: ['cc-traces'], queryFn: () => api.get('/api/system/trace-metrics').then(r => r.data), refetchInterval: 15000 });

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
  const { data } = useQuery({ queryKey: ['cc-emergents'], queryFn: () => api.get('/api/macro/run', { params: { domain: 'emergent', name: 'list' } }).then(r => r.data).catch(() => ({ emergents: [] })), refetchInterval: 30000 });
  const { data: censusData } = useQuery({ queryKey: ['cc-census'], queryFn: () => api.get('/api/macro/run', { params: { domain: 'emergent', name: 'district.census' } }).then(r => r.data).catch(() => ({ census: {} })), refetchInterval: 30000 });

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
  const { data: meta } = useQuery({ queryKey: ['cc-meta'], queryFn: () => api.get('/api/meta/metrics').then(r => r.data), refetchInterval: 30000 });
  const { data: convergences } = useQuery({ queryKey: ['cc-convergences'], queryFn: () => api.get('/api/meta/convergences').then(r => r.data), refetchInterval: 60000 });
  const { data: pending } = useQuery({ queryKey: ['cc-predictions'], queryFn: () => api.get('/api/meta/predictions/pending').then(r => r.data), refetchInterval: 60000 });
  const qc = useQueryClient();
  const triggerMutation = useMutation({ mutationFn: () => api.post('/api/meta/trigger'), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-meta'] }) });

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
  const { data } = useQuery({ queryKey: ['cc-plugins'], queryFn: () => api.get('/api/plugins').then(r => r.data), refetchInterval: 30000 });
  const { data: metrics } = useQuery({ queryKey: ['cc-plugin-metrics'], queryFn: () => api.get('/api/plugins/metrics').then(r => r.data), refetchInterval: 30000 });

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
  const { data: queue } = useQuery({ queryKey: ['cc-queue'], queryFn: () => api.get('/api/system/llm-queue').then(r => r.data), refetchInterval: 10000 });
  const { data: breakers } = useQuery({ queryKey: ['cc-breakers'], queryFn: () => api.get('/api/system/circuit-breakers').then(r => r.data), refetchInterval: 15000 });
  const qc = useQueryClient();
  const resetBreakers = useMutation({ mutationFn: () => api.post('/api/system/circuit-breakers/reset'), onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-breakers'] }) });

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
            <button onClick={() => resetBreakers.mutate()} className="text-[10px] text-neon-cyan hover:underline">Reset All</button>
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
  const { data } = useQuery({ queryKey: ['cc-admin-stats'], queryFn: () => api.get('/api/admin/stats').then(r => r.data).catch(() => ({})), refetchInterval: 60000 });

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
    mutationFn: (updates: Record<string, unknown>) => api.post('/api/settings', updates),
    onSuccess: () => qc.invalidateQueries(),
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
                className="text-xs px-2 py-1 rounded bg-neon-green/20 text-neon-green border border-neon-green/30"
              >
                Toggle
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
  const settingsMutation = useMutation({ mutationFn: (updates: Record<string, unknown>) => api.post('/api/settings', updates), onSuccess: () => qc.invalidateQueries() });
  const saveMutation = useMutation({ mutationFn: () => api.post('/api/admin/save-state') });
  const flushMutation = useMutation({ mutationFn: () => api.post('/api/system/llm-queue/flush') });

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
    mutationFn: (body: { text: string; capturedAt: string }) => api.post('/api/meta/dream-input', body),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['cc-meta'] }); },
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
  const { data: errors } = useQuery({ queryKey: ['cc-errors'], queryFn: () => api.get('/api/system/errors/recent').then(r => r.data), refetchInterval: 15000 });
  const { data: traces } = useQuery({ queryKey: ['cc-slow-traces'], queryFn: () => api.get('/api/system/traces', { params: { minDuration: 500, limit: 20 } }).then(r => r.data), refetchInterval: 30000 });
  const { data: rejections } = useQuery({ queryKey: ['cc-rejections'], queryFn: () => api.get('/api/admin/governance-rejections').then(r => r.data), refetchInterval: 60000 });

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

// ── Tab Navigation ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'emergents', label: 'Emergents', icon: Brain },
  { id: 'lattice', label: 'Lattice', icon: Layers },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'pipeline', label: 'Pipeline', icon: Cpu },
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
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
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
      case 'emergents': return <EmergentPanel />;
      case 'lattice': return <LatticePanel />;
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
