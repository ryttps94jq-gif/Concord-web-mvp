'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Terminal, Eye, RefreshCw, Play, Database, Cpu, HardDrive,
  AlertTriangle, CheckCircle, Clock, Trash2, Download, Copy,
  ChevronDown, ChevronRight, Search, X, Filter, MemoryStick,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

export default function DebugLensPage() {
  useLensNav('debug');
  const [activeTab, setActiveTab] = useState<'status' | 'events' | 'test' | 'inspector' | 'logs'>('status');
  const [debugOutput, setDebugOutput] = useState<string[]>(['$ concord debug', 'Ready. Type command or click button above.']);
  const [customCmd, setCustomCmd] = useState('');
  const [logFilter, setLogFilter] = useState<LogLevel>('all');
  const [logSearch, setLogSearch] = useState('');
  const [inspectEntity, setInspectEntity] = useState('');
  const [inspectType, setInspectType] = useState('dtu');
  const [inspectResult, setInspectResult] = useState<unknown>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debugOutput]);

  const debugCmd = useMutation({
    mutationFn: async (cmd: string) => {
      setDebugOutput(prev => [...prev, `$ ${cmd}...`]);
      if (cmd === 'tick') return apiHelpers.bridge.heartbeatTick();
      if (cmd === 'organs') return apiHelpers.guidance.health();
      if (cmd === 'invariants') return apiHelpers.emergent.status();
      if (cmd === 'growth') return apiHelpers.pipeline.metrics();
      if (cmd === 'db-status') return apiHelpers.db.status();
      if (cmd === 'redis-stats') return apiHelpers.redis.stats();
      if (cmd === 'perf') return apiHelpers.perf.metrics();
      if (cmd === 'backpressure') return apiHelpers.backpressure.status();
      if (cmd === 'gc') return apiHelpers.perf.gc();
      return api.get('/api/status');
    },
    onSuccess: (res) => setDebugOutput(prev => [...prev, JSON.stringify(res.data, null, 2).slice(0, 800)]),
    onError: (err) => setDebugOutput(prev => [...prev, `Error: ${err instanceof Error ? err.message : 'Unknown'}`]),
  });

  const inspectMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      return apiHelpers.guidance.inspect(type, id);
    },
    onSuccess: (res) => setInspectResult(res.data),
    onError: (err) => setInspectResult({ error: err instanceof Error ? err.message : 'Inspect failed' }),
  });

  // Backend: GET /api/status
  const { data: status, isLoading, refetch: refetchStatus, isError, error } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  // Backend: GET /api/events
  const { data: events, refetch: refetchEvents, isError: isError2, error: error2 } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data),
  });

  // Backend: GET /api/jobs/status
  const { data: jobs, isError: isError3, error: error3, refetch: refetch3 } = useQuery({
    queryKey: ['jobs-status'],
    queryFn: () => api.get('/api/jobs/status').then((r) => r.data),
  });

  // Backend: GET /api/db/status
  const { data: dbStatus } = useQuery({
    queryKey: ['db-status'],
    queryFn: () => apiHelpers.db.status().then((r) => r.data),
  });

  // Backend: GET /api/perf/metrics
  const { data: perfMetrics } = useQuery({
    queryKey: ['perf-metrics'],
    queryFn: () => apiHelpers.perf.metrics().then((r) => r.data),
    refetchInterval: 15000,
  });

  const handleCustomCmd = useCallback(() => {
    if (!customCmd.trim()) return;
    debugCmd.mutate(customCmd.trim());
    setCustomCmd('');
  }, [customCmd, debugCmd]);

  const clearConsole = () => {
    setDebugOutput(['$ concord debug', 'Console cleared.']);
  };

  const copyConsole = () => {
    navigator.clipboard?.writeText(debugOutput.join('\n'));
  };

  const toggleEventExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build log entries from events
  const logEntries: LogEntry[] = (events?.events || []).map((e: Record<string, unknown>) => ({
    timestamp: String(e.at || e.timestamp || ''),
    level: String(e.type || '').includes('error') ? 'error' : String(e.type || '').includes('warn') ? 'warn' : 'info',
    message: `[${String(e.type)}] ${JSON.stringify(e.payload || {}).slice(0, 200)}`,
    source: String(e.source || e.type || 'system'),
  }));

  const filteredLogs = logEntries.filter((log) => {
    if (logFilter !== 'all' && log.level !== logFilter) return false;
    if (logSearch && !log.message.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading debug data...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetchStatus(); refetchEvents(); refetch3(); }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🐛</span>
          <div>
            <h1 className="text-xl font-bold">Debug Lens</h1>
            <p className="text-sm text-gray-400">
              System state, organs, events, and diagnostics
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            refetchStatus();
            refetchEvents();
            refetch3();
          }}
          className="btn-neon"
        >
          <RefreshCw className="w-4 h-4 mr-2 inline" />
          Refresh All
        </button>
      </header>

      {/* Quick Health Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthCard
          label="System"
          status={status?.ok ? 'ok' : 'error'}
          detail={status?.version || 'unknown'}
        />
        <HealthCard
          label="Database"
          status={dbStatus?.ok !== false ? 'ok' : 'error'}
          detail={dbStatus?.engine || 'checking'}
        />
        <HealthCard
          label="Jobs"
          status={jobs?.active !== undefined ? 'ok' : 'warn'}
          detail={`${jobs?.active || 0} active`}
        />
        <HealthCard
          label="Memory"
          status="ok"
          detail={perfMetrics?.memory ? `${Math.round((perfMetrics.memory.heapUsed || 0) / 1024 / 1024)}MB` : 'N/A'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['status', 'events', 'logs', 'inspector', 'test'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg capitalize text-sm whitespace-nowrap ${
              activeTab === tab
                ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                : 'bg-lattice-surface text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* System Status */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-neon-blue" />
              System Status
            </h2>
            <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-96 text-sm font-mono text-gray-300">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>

          {/* Performance Metrics */}
          {perfMetrics && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-neon-cyan" />
                Performance Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {perfMetrics.uptime && (
                  <div className="bg-lattice-deep p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Uptime</p>
                    <p className="text-lg font-mono text-neon-green">{formatUptime(perfMetrics.uptime)}</p>
                  </div>
                )}
                {perfMetrics.memory?.heapUsed && (
                  <div className="bg-lattice-deep p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Heap Used</p>
                    <p className="text-lg font-mono text-neon-blue">{Math.round(perfMetrics.memory.heapUsed / 1024 / 1024)}MB</p>
                  </div>
                )}
                {perfMetrics.memory?.heapTotal && (
                  <div className="bg-lattice-deep p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Heap Total</p>
                    <p className="text-lg font-mono text-gray-300">{Math.round(perfMetrics.memory.heapTotal / 1024 / 1024)}MB</p>
                  </div>
                )}
              </div>
              <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-48 text-xs font-mono text-gray-400">
                {JSON.stringify(perfMetrics, null, 2)}
              </pre>
            </div>
          )}

          {/* Jobs Status */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-neon-green" />
              Jobs Status
            </h2>
            <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-60 text-sm font-mono text-gray-300">
              {JSON.stringify(jobs, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-neon-cyan" />
            Recent Events ({events?.events?.length || 0})
          </h2>
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {(events?.events || []).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Eye className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No events recorded yet</p>
              </div>
            ) : (
              (events?.events || []).slice(0, 100).map((event: Record<string, unknown>, idx: number) => {
                const id = (event.id as string) || `evt-${idx}`;
                const isExpanded = expandedEvents.has(id);
                return (
                  <div key={id} className="bg-lattice-deep rounded-lg border border-lattice-border">
                    <button
                      onClick={() => toggleEventExpand(id)}
                      className="flex items-center justify-between p-3 w-full text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                        <span className={`font-mono text-sm ${
                          String(event.type).includes('error') ? 'text-red-400' :
                          String(event.type).includes('created') ? 'text-neon-green' :
                          'text-neon-purple'
                        }`}>
                          {String(event.type)}
                        </span>
                        <span className="text-xs text-gray-500">{String(event.at || event.timestamp || '')}</span>
                      </div>
                    </button>
                    {isExpanded && (
                      <pre className="px-3 pb-3 text-xs text-gray-400 overflow-auto max-h-48 border-t border-lattice-border pt-2 mx-3">
                        {JSON.stringify(event.payload || event, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neon-green" />
              System Logs ({filteredLogs.length})
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as LogLevel)}
                className="px-2 py-1 bg-lattice-surface border border-lattice-border rounded text-xs"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
            </div>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="w-full pl-10 pr-8 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-cyan outline-none"
              placeholder="Filter logs..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
            />
            {logSearch && (
              <button onClick={() => setLogSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="bg-lattice-void rounded-lg overflow-auto max-h-[500px] font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Terminal className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>No matching log entries</p>
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <div key={i} className={`flex gap-3 px-3 py-1.5 border-b border-lattice-border/30 hover:bg-lattice-surface/30 ${
                  log.level === 'error' ? 'bg-red-500/5' : log.level === 'warn' ? 'bg-yellow-500/5' : ''
                }`}>
                  <span className="text-gray-600 shrink-0 w-20">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}</span>
                  <span className={`shrink-0 w-12 uppercase ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'debug' ? 'text-gray-500' :
                    'text-neon-blue'
                  }`}>{log.level}</span>
                  <span className="text-gray-300 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'inspector' && (
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neon-blue" />
            Object Inspector
          </h2>
          <div className="flex gap-3">
            <select
              className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm"
              value={inspectType}
              onChange={(e) => setInspectType(e.target.value)}
            >
              <option value="dtu">DTU</option>
              <option value="artifact">Artifact</option>
              <option value="job">Job</option>
              <option value="listing">Listing</option>
            </select>
            <input
              className="flex-1 px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-blue outline-none font-mono"
              placeholder="Enter entity ID..."
              value={inspectEntity}
              onChange={(e) => setInspectEntity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inspectEntity.trim()) {
                  inspectMutation.mutate({ type: inspectType, id: inspectEntity.trim() });
                }
              }}
            />
            <button
              className="btn-neon text-sm"
              disabled={!inspectEntity.trim() || inspectMutation.isPending}
              onClick={() => inspectMutation.mutate({ type: inspectType, id: inspectEntity.trim() })}
            >
              {inspectMutation.isPending ? 'Inspecting...' : 'Inspect'}
            </button>
          </div>
          {inspectResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-300">Result</h3>
                <button
                  onClick={() => navigator.clipboard?.writeText(JSON.stringify(inspectResult, null, 2))}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="bg-lattice-void p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono text-gray-300">
                {JSON.stringify(inspectResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'test' && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neon-green" />
            Test Console
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CmdButton label="Tick Kernel" color="neon-green" onClick={() => debugCmd.mutate('tick')} disabled={debugCmd.isPending} />
              <CmdButton label="Check Organs" color="neon-blue" onClick={() => debugCmd.mutate('organs')} disabled={debugCmd.isPending} />
              <CmdButton label="Verify Invariants" color="neon-purple" onClick={() => debugCmd.mutate('invariants')} disabled={debugCmd.isPending} />
              <CmdButton label="Sim Growth" color="neon-cyan" onClick={() => debugCmd.mutate('growth')} disabled={debugCmd.isPending} />
              <CmdButton label="DB Status" color="neon-blue" onClick={() => debugCmd.mutate('db-status')} disabled={debugCmd.isPending} />
              <CmdButton label="Redis Stats" color="neon-pink" onClick={() => debugCmd.mutate('redis-stats')} disabled={debugCmd.isPending} />
              <CmdButton label="Perf Metrics" color="neon-cyan" onClick={() => debugCmd.mutate('perf')} disabled={debugCmd.isPending} />
              <CmdButton label="Run GC" color="neon-green" onClick={() => debugCmd.mutate('gc')} disabled={debugCmd.isPending} />
            </div>

            {/* Custom Command */}
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm font-mono focus:border-neon-green outline-none"
                placeholder="Enter custom endpoint (e.g., 'status')..."
                value={customCmd}
                onChange={(e) => setCustomCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomCmd();
                }}
              />
              <button
                className="btn-neon text-sm"
                disabled={!customCmd.trim() || debugCmd.isPending}
                onClick={handleCustomCmd}
              >
                Run
              </button>
            </div>

            {/* Console Output */}
            <div className="relative">
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button onClick={copyConsole} className="p-1 text-gray-500 hover:text-white" title="Copy">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={clearConsole} className="p-1 text-gray-500 hover:text-white" title="Clear">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="bg-lattice-void p-4 rounded-lg h-64 font-mono text-sm text-gray-400 overflow-y-auto">
                {debugOutput.map((line, i) => (
                  <p key={i} className={
                    line.startsWith('$') ? 'text-neon-green' :
                    line.startsWith('Error') ? 'text-red-400' :
                    ''
                  }>{line}</p>
                ))}
                <p className="animate-pulse">_</p>
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({ label, status, detail }: { label: string; status: 'ok' | 'warn' | 'error'; detail: string }) {
  const colors = {
    ok: 'text-neon-green border-neon-green/20',
    warn: 'text-yellow-400 border-yellow-400/20',
    error: 'text-red-400 border-red-400/20',
  };
  const icons = {
    ok: <CheckCircle className="w-4 h-4" />,
    warn: <AlertTriangle className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
  };
  return (
    <div className={`lens-card border ${colors[status]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className={colors[status]}>{icons[status]}</span>
      </div>
      <p className="text-xs text-gray-500 font-mono">{detail}</p>
    </div>
  );
}

function CmdButton({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`lens-card text-center hover:border-${color} transition-colors disabled:opacity-50`}
    >
      <p className="text-sm font-medium">{label}</p>
    </button>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}
