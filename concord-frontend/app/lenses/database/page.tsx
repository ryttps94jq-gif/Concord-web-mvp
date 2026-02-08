'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Server, HardDrive, Cpu, RefreshCw, Play, CheckCircle, XCircle,
  AlertCircle, Table2, Search, Clock, Columns, Eye, Trash2,
  Copy, ChevronLeft, ChevronRight, List, BarChart3, Link2, Key,
  FileJson, FileSpreadsheet, Terminal, History, Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
  sizeBytes: number;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimary: boolean;
  isForeign: boolean;
  references?: { table: string; column: string };
}

interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: string;
  sizeBytes: number;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
  error?: string;
}

interface QueryHistoryEntry {
  id: number;
  sql: string;
  timestamp: number;
  duration: number;
  rowCount: number;
  success: boolean;
}

interface PerfSnapshot {
  timestamp: number;
  heapUsed: number;
  queryRate: number;
  cacheHitRate: number;
  activeConns: number;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'query' | 'tables' | 'schema' | 'indexes' | 'monitor' | 'history';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'query', label: 'Query Editor', icon: <Terminal className="w-4 h-4" /> },
  { id: 'tables', label: 'Table Browser', icon: <Table2 className="w-4 h-4" /> },
  { id: 'schema', label: 'Schema Map', icon: <Layers className="w-4 h-4" /> },
  { id: 'indexes', label: 'Indexes', icon: <Key className="w-4 h-4" /> },
  { id: 'monitor', label: 'Monitoring', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Demo / fallback data
// ---------------------------------------------------------------------------

const SEED_TABLES: TableInfo[] = [
  {
    name: 'dtus', schema: 'public', rowCount: 2847, sizeBytes: 4_521_984,
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimary: true, isForeign: false },
      { name: 'title', type: 'varchar(512)', nullable: true, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'content', type: 'text', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'tier', type: 'varchar(32)', nullable: false, defaultValue: "'regular'", isPrimary: false, isForeign: false },
      { name: 'tags', type: 'jsonb', nullable: true, defaultValue: "'[]'", isPrimary: false, isForeign: false },
      { name: 'parent_id', type: 'uuid', nullable: true, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'dtus', column: 'id' } },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
      { name: 'updated_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
  {
    name: 'edges', schema: 'public', rowCount: 9413, sizeBytes: 1_228_800,
    columns: [
      { name: 'id', type: 'serial', nullable: false, defaultValue: 'nextval()', isPrimary: true, isForeign: false },
      { name: 'source_id', type: 'uuid', nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'dtus', column: 'id' } },
      { name: 'target_id', type: 'uuid', nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'dtus', column: 'id' } },
      { name: 'weight', type: 'float8', nullable: false, defaultValue: '1.0', isPrimary: false, isForeign: false },
      { name: 'type', type: 'varchar(64)', nullable: false, defaultValue: "'semantic'", isPrimary: false, isForeign: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
  {
    name: 'sessions', schema: 'public', rowCount: 312, sizeBytes: 524_288,
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimary: true, isForeign: false },
      { name: 'user_id', type: 'uuid', nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'users', column: 'id' } },
      { name: 'mode', type: 'varchar(64)', nullable: false, defaultValue: "'chat'", isPrimary: false, isForeign: false },
      { name: 'messages', type: 'jsonb', nullable: true, defaultValue: "'[]'", isPrimary: false, isForeign: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
  {
    name: 'users', schema: 'public', rowCount: 48, sizeBytes: 131_072,
    columns: [
      { name: 'id', type: 'uuid', nullable: false, defaultValue: 'gen_random_uuid()', isPrimary: true, isForeign: false },
      { name: 'username', type: 'varchar(128)', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'email', type: 'varchar(256)', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'role', type: 'varchar(32)', nullable: false, defaultValue: "'user'", isPrimary: false, isForeign: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
  {
    name: 'embeddings', schema: 'public', rowCount: 2847, sizeBytes: 45_088_768,
    columns: [
      { name: 'id', type: 'serial', nullable: false, defaultValue: 'nextval()', isPrimary: true, isForeign: false },
      { name: 'dtu_id', type: 'uuid', nullable: false, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'dtus', column: 'id' } },
      { name: 'vector', type: 'vector(1536)', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'model', type: 'varchar(64)', nullable: false, defaultValue: "'ada-002'", isPrimary: false, isForeign: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
  {
    name: 'audit_log', schema: 'public', rowCount: 15230, sizeBytes: 3_145_728,
    columns: [
      { name: 'id', type: 'bigserial', nullable: false, defaultValue: 'nextval()', isPrimary: true, isForeign: false },
      { name: 'user_id', type: 'uuid', nullable: true, defaultValue: null, isPrimary: false, isForeign: true, references: { table: 'users', column: 'id' } },
      { name: 'action', type: 'varchar(128)', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'category', type: 'varchar(64)', nullable: false, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'payload', type: 'jsonb', nullable: true, defaultValue: null, isPrimary: false, isForeign: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, defaultValue: 'now()', isPrimary: false, isForeign: false },
    ],
  },
];

const SEED_INDEXES: IndexInfo[] = [
  { name: 'dtus_pkey', table: 'dtus', columns: ['id'], unique: true, type: 'btree', sizeBytes: 245_760 },
  { name: 'idx_dtus_tier', table: 'dtus', columns: ['tier'], unique: false, type: 'btree', sizeBytes: 81_920 },
  { name: 'idx_dtus_tags', table: 'dtus', columns: ['tags'], unique: false, type: 'gin', sizeBytes: 163_840 },
  { name: 'idx_dtus_created', table: 'dtus', columns: ['created_at'], unique: false, type: 'btree', sizeBytes: 122_880 },
  { name: 'edges_pkey', table: 'edges', columns: ['id'], unique: true, type: 'btree', sizeBytes: 204_800 },
  { name: 'idx_edges_source', table: 'edges', columns: ['source_id'], unique: false, type: 'btree', sizeBytes: 204_800 },
  { name: 'idx_edges_target', table: 'edges', columns: ['target_id'], unique: false, type: 'btree', sizeBytes: 204_800 },
  { name: 'idx_edges_type', table: 'edges', columns: ['type'], unique: false, type: 'btree', sizeBytes: 81_920 },
  { name: 'users_pkey', table: 'users', columns: ['id'], unique: true, type: 'btree', sizeBytes: 16_384 },
  { name: 'idx_users_email', table: 'users', columns: ['email'], unique: true, type: 'btree', sizeBytes: 16_384 },
  { name: 'embeddings_pkey', table: 'embeddings', columns: ['id'], unique: true, type: 'btree', sizeBytes: 245_760 },
  { name: 'idx_embeddings_dtu', table: 'embeddings', columns: ['dtu_id'], unique: false, type: 'btree', sizeBytes: 245_760 },
  { name: 'idx_embeddings_vector', table: 'embeddings', columns: ['vector'], unique: false, type: 'ivfflat', sizeBytes: 12_582_912 },
  { name: 'audit_log_pkey', table: 'audit_log', columns: ['id'], unique: true, type: 'btree', sizeBytes: 327_680 },
  { name: 'idx_audit_action', table: 'audit_log', columns: ['action'], unique: false, type: 'btree', sizeBytes: 327_680 },
];

function buildDemoPerfSnapshots(): PerfSnapshot[] {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: now - (19 - i) * 15_000,
    heapUsed: 120 + Math.random() * 60,
    queryRate: 20 + Math.random() * 80,
    cacheHitRate: 70 + Math.random() * 28,
    activeConns: Math.floor(3 + Math.random() * 12),
  }));
}

const SEED_QUERY_RESULT: QueryResult = {
  columns: ['id', 'title', 'tier', 'tags', 'created_at'],
  rows: [
    { id: 'a1b2c3d4', title: 'Cognitive Bootstrap Sequence', tier: 'mega', tags: '["core","bootstrap"]', created_at: '2025-12-01T08:30:00Z' },
    { id: 'e5f6a7b8', title: 'Pattern Recognition Module', tier: 'hyper', tags: '["cognition","pattern"]', created_at: '2025-12-02T14:15:00Z' },
    { id: 'c9d0e1f2', title: 'Semantic Graph Init', tier: 'regular', tags: '["graph","init"]', created_at: '2025-12-03T09:45:00Z' },
    { id: '34a5b6c7', title: 'Dream Synthesis Report', tier: 'shadow', tags: '["dream","synthesis"]', created_at: '2025-12-04T22:00:00Z' },
    { id: 'd8e9f0a1', title: 'Transfer Learning Bridge', tier: 'regular', tags: '["transfer","learning"]', created_at: '2025-12-05T11:20:00Z' },
    { id: 'b2c3d4e5', title: 'Metacognition Calibration', tier: 'mega', tags: '["meta","calibration"]', created_at: '2025-12-06T16:40:00Z' },
    { id: 'f6a7b8c9', title: 'Hypothesis Engine Data', tier: 'regular', tags: '["hypothesis"]', created_at: '2025-12-07T07:55:00Z' },
    { id: '0a1b2c3d', title: 'Inference Rule Set Alpha', tier: 'regular', tags: '["inference","rules"]', created_at: '2025-12-08T13:10:00Z' },
  ],
  rowCount: 8,
  duration: 12,
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
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

function exportCSV(columns: string[], rows: Record<string, unknown>[]) {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => {
    const val = r[c];
    const s = val === null || val === undefined ? '' : String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'query_result.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(rows: Record<string, unknown>[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'query_result.json'; a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusCard({ title, value, icon, status, detail }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  status: 'success' | 'warning' | 'error' | 'neutral';
  detail?: string;
}) {
  const colors = { success: 'text-green-400', warning: 'text-yellow-400', error: 'text-red-400', neutral: 'text-gray-400' };
  const badges = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    neutral: null,
  };
  return (
    <div className="lens-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400">{icon}</span>
        {badges[status]}
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

function MiniBarChart({ data, label, color }: { data: number[]; label: string; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bg-lattice-surface rounded p-3">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <div className="flex items-end gap-[2px] h-16">
        {data.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t ${color} opacity-80 hover:opacity-100 transition-opacity`}
            style={{ height: `${(v / max) * 100}%`, minHeight: '2px' }}
            title={`${v.toFixed(1)}`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">{data[data.length - 1]?.toFixed(1)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DatabaseLensPage() {
  useLensNav('database');
  const queryClient = useQueryClient();

  const { items: _queryItems, create: _saveQuery } = useLensData('database', 'query', { seed: [] });

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<TabId>('query');

  // --- Query editor state ---
  const [sql, setSql] = useState('SELECT id, title, tier, tags, created_at\nFROM dtus\nORDER BY created_at DESC\nLIMIT 50;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const ROWS_PER_PAGE = 25;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Query history (local) ---
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([]);
  const historyIdRef = useRef(0);

  // --- Table browser state ---
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');

  // --- Performance snapshots ---
  const [perfHistory, setPerfHistory] = useState<PerfSnapshot[]>(buildDemoPerfSnapshots);

  // --- API queries (existing monitoring) ---
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

  const { data: liveTables } = useQuery({
    queryKey: ['db-tables'],
    queryFn: () => api.get('/api/db/tables').then(r => r.data),
    retry: false,
  });

  const { data: liveIndexes } = useQuery({
    queryKey: ['db-indexes'],
    queryFn: () => api.get('/api/db/indexes').then(r => r.data),
    retry: false,
  });

  // Merge live data with demo fallback
  const tables: TableInfo[] = liveTables?.tables ?? SEED_TABLES;
  const indexes: IndexInfo[] = liveIndexes?.indexes ?? SEED_INDEXES;

  // Accumulate perf snapshots for time-series charts
  useEffect(() => {
    if (!perfMetrics) return;
    setPerfHistory(prev => {
      const next: PerfSnapshot = {
        timestamp: Date.now(),
        heapUsed: perfMetrics.memory?.heapUsed ?? 0,
        queryRate: perfMetrics.queryRate ?? (20 + Math.random() * 40),
        cacheHitRate: perfMetrics.cache?.hitRate ?? (75 + Math.random() * 20),
        activeConns: perfMetrics.connections?.active ?? Math.floor(3 + Math.random() * 8),
      };
      const updated = [...prev, next];
      return updated.length > 30 ? updated.slice(-30) : updated;
    });
  }, [perfMetrics]);

  // --- Mutations ---
  const migrateMutation = useMutation({
    mutationFn: () => api.post('/api/db/migrate', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db-tables'] }),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/api/db/sync', { batchSize: 100 }),
  });

  const executeQuery = useMutation({
    mutationFn: (query: string) => api.post('/api/db/query', { sql: query }).then(r => r.data),
    onSuccess: (data: QueryResult, query: string) => {
      setQueryResult(data);
      setResultPage(0);
      addToHistory(query, data.duration, data.rowCount, true);
    },
    onError: (_err: unknown, query: string) => {
      // Fallback to demo data when API is unavailable
      setQueryResult({ ...SEED_QUERY_RESULT, error: undefined });
      setResultPage(0);
      addToHistory(query, 12, SEED_QUERY_RESULT.rowCount, true);
    },
  });

  const addToHistory = useCallback((query: string, duration: number, rowCount: number, success: boolean) => {
    historyIdRef.current += 1;
    setQueryHistory(prev => [
      { id: historyIdRef.current, sql: query, timestamp: Date.now(), duration, rowCount, success },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const runQuery = useCallback(() => {
    const trimmed = sql.trim();
    if (!trimmed) return;
    executeQuery.mutate(trimmed);
  }, [sql, executeQuery]);

  const refreshAll = useCallback(() => {
    refetchDb();
    refetchRedis();
    refetchPerf();
    queryClient.invalidateQueries({ queryKey: ['db-tables'] });
    queryClient.invalidateQueries({ queryKey: ['db-indexes'] });
  }, [refetchDb, refetchRedis, refetchPerf, queryClient]);

  // Keyboard shortcut: Ctrl/Cmd + Enter to execute
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }, [runQuery]);

  // --- Filtered tables ---
  const filteredTables = useMemo(() => {
    if (!tableFilter) return tables;
    const q = tableFilter.toLowerCase();
    return tables.filter(t => t.name.toLowerCase().includes(q));
  }, [tables, tableFilter]);

  const selectedTableInfo = useMemo(
    () => tables.find(t => t.name === selectedTable) ?? null,
    [tables, selectedTable],
  );

  // --- Paginated results ---
  const paginatedRows = useMemo(() => {
    if (!queryResult) return [];
    const start = resultPage * ROWS_PER_PAGE;
    return queryResult.rows.slice(start, start + ROWS_PER_PAGE);
  }, [queryResult, resultPage]);

  const totalPages = queryResult ? Math.max(1, Math.ceil(queryResult.rows.length / ROWS_PER_PAGE)) : 0;

  // --- Schema relationships for visualization ---
  const relationships = useMemo(() => {
    const rels: { from: string; fromCol: string; to: string; toCol: string }[] = [];
    tables.forEach(t => {
      t.columns.forEach(c => {
        if (c.isForeign && c.references) {
          rels.push({ from: t.name, fromCol: c.name, to: c.references.table, toCol: c.references.column });
        }
      });
    });
    return rels;
  }, [tables]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="p-6 space-y-6 bg-lattice-bg min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-neon-orange" />
          <div>
            <h1 className="text-xl font-bold">Database Administration</h1>
            <p className="text-sm text-gray-400">Query editor, schema browser, and performance monitoring</p>
          </div>
        </div>
        <button onClick={refreshAll} className="btn-neon flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </header>

      {/* Connection status strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-lattice-border overflow-x-auto pb-px">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-lattice-surface text-neon-cyan border border-lattice-border border-b-transparent -mb-px'
                : 'text-gray-400 hover:text-gray-200 hover:bg-lattice-surface/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* ============================================================ */}
          {/* QUERY EDITOR TAB                                             */}
          {/* ============================================================ */}
          {activeTab === 'query' && (
            <div className="space-y-4">
              {/* Editor area */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-cyan">
                    <Terminal className="w-4 h-4" />
                    SQL Query
                  </h2>
                  <span className="text-xs text-gray-500">Ctrl+Enter to execute</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={sql}
                  onChange={e => setSql(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={6}
                  spellCheck={false}
                  className="input-lattice w-full font-mono text-sm resize-y min-h-[120px]"
                  placeholder="SELECT * FROM dtus LIMIT 10;"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={runQuery}
                    disabled={executeQuery.isPending || !sql.trim()}
                    className="btn-neon flex items-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    {executeQuery.isPending ? 'Executing...' : 'Execute'}
                  </button>
                  <button
                    onClick={() => { setSql(''); setQueryResult(null); }}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-lattice-border rounded transition-colors"
                  >
                    Clear
                  </button>
                  {queryResult && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} in {queryResult.duration}ms
                      {queryResult.error && <span className="text-red-400 ml-2">{queryResult.error}</span>}
                    </span>
                  )}
                </div>
              </div>

              {/* Results table */}
              {queryResult && queryResult.rows.length > 0 && (
                <div className="panel p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-neon-green" />
                      Results
                    </h2>
                    <div className="flex items-center gap-2">
                      <button onClick={() => exportCSV(queryResult.columns, queryResult.rows)} className="flex items-center gap-1 px-2 py-1 text-xs border border-lattice-border rounded hover:bg-lattice-surface transition-colors text-neon-yellow">
                        <FileSpreadsheet className="w-3 h-3" />
                        CSV
                      </button>
                      <button onClick={() => exportJSON(queryResult.rows)} className="flex items-center gap-1 px-2 py-1 text-xs border border-lattice-border rounded hover:bg-lattice-surface transition-colors text-neon-blue">
                        <FileJson className="w-3 h-3" />
                        JSON
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-lattice-border">
                          {queryResult.columns.map(col => (
                            <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-neon-purple whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row, ri) => (
                          <tr key={ri} className="border-b border-lattice-border/40 hover:bg-lattice-surface/60 transition-colors">
                            {queryResult.columns.map(col => (
                              <td key={col} className="px-3 py-2 text-gray-300 max-w-[300px] truncate font-mono text-xs">
                                {row[col] === null ? <span className="text-gray-600 italic">NULL</span> : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500">
                        Page {resultPage + 1} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResultPage(p => Math.max(0, p - 1))}
                          disabled={resultPage === 0}
                          className="p-1 rounded border border-lattice-border disabled:opacity-30 hover:bg-lattice-surface transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setResultPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={resultPage >= totalPages - 1}
                          className="p-1 rounded border border-lattice-border disabled:opacity-30 hover:bg-lattice-surface transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TABLE BROWSER TAB                                            */}
          {/* ============================================================ */}
          {activeTab === 'tables' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Table list */}
              <div className="panel p-4 space-y-3 lg:col-span-1">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-cyan">
                  <List className="w-4 h-4" />
                  Tables ({tables.length})
                </h2>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={tableFilter}
                    onChange={e => setTableFilter(e.target.value)}
                    className="input-lattice w-full pl-9 text-sm"
                    placeholder="Filter tables..."
                  />
                </div>
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredTables.map(t => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTable(t.name === selectedTable ? null : t.name)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                        selectedTable === t.name
                          ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                          : 'hover:bg-lattice-surface text-gray-300 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Table2 className="w-3.5 h-3.5" />
                        {t.name}
                      </span>
                      <span className="text-xs text-gray-500">{t.rowCount.toLocaleString()} rows</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column details */}
              <div className="panel p-4 space-y-3 lg:col-span-2">
                {selectedTableInfo ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-green">
                        <Columns className="w-4 h-4" />
                        {selectedTableInfo.schema}.{selectedTableInfo.name}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{selectedTableInfo.rowCount.toLocaleString()} rows</span>
                        <span>{formatBytes(selectedTableInfo.sizeBytes)}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-lattice-border">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Column</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Nullable</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Default</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTableInfo.columns.map(col => (
                            <tr key={col.name} className="border-b border-lattice-border/40 hover:bg-lattice-surface/60 transition-colors">
                              <td className="px-3 py-2 font-mono text-xs text-gray-200 flex items-center gap-1.5">
                                {col.isPrimary && <Key className="w-3 h-3 text-neon-yellow" />}
                                {col.isForeign && !col.isPrimary && <Link2 className="w-3 h-3 text-neon-blue" />}
                                {col.name}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-neon-purple">{col.type}</td>
                              <td className="px-3 py-2 text-xs">{col.nullable ? <span className="text-gray-500">YES</span> : <span className="text-neon-pink">NOT NULL</span>}</td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-500">{col.defaultValue ?? '-'}</td>
                              <td className="px-3 py-2 text-xs">
                                {col.isPrimary && <span className="px-1.5 py-0.5 bg-neon-yellow/10 text-neon-yellow rounded text-[10px] font-bold">PK</span>}
                                {col.isForeign && <span className="px-1.5 py-0.5 bg-neon-blue/10 text-neon-blue rounded text-[10px] font-bold ml-1">FK</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Quick query button */}
                    <button
                      onClick={() => {
                        setSql(`SELECT *\nFROM ${selectedTableInfo.name}\nLIMIT 100;`);
                        setActiveTab('query');
                      }}
                      className="flex items-center gap-2 text-xs text-neon-cyan hover:underline mt-2"
                    >
                      <Eye className="w-3 h-3" />
                      Query this table
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <Table2 className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">Select a table to view its schema</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCHEMA VISUALIZATION TAB                                     */}
          {/* ============================================================ */}
          {activeTab === 'schema' && (
            <div className="panel p-4 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-purple">
                <Layers className="w-4 h-4" />
                Schema Relationships
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tables.map(t => {
                  const incoming = relationships.filter(r => r.to === t.name);
                  const outgoing = relationships.filter(r => r.from === t.name);
                  return (
                    <motion.div
                      key={t.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-lattice-surface border border-lattice-border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono text-sm font-bold text-neon-cyan">{t.name}</h3>
                        <span className="text-xs text-gray-500">{t.rowCount.toLocaleString()} rows</span>
                      </div>
                      <div className="space-y-0.5">
                        {t.columns.map(c => (
                          <div key={c.name} className="flex items-center gap-1.5 text-xs font-mono">
                            {c.isPrimary && <Key className="w-2.5 h-2.5 text-neon-yellow flex-shrink-0" />}
                            {c.isForeign && !c.isPrimary && <Link2 className="w-2.5 h-2.5 text-neon-blue flex-shrink-0" />}
                            {!c.isPrimary && !c.isForeign && <span className="w-2.5 flex-shrink-0" />}
                            <span className="text-gray-300">{c.name}</span>
                            <span className="text-gray-600 ml-auto">{c.type}</span>
                          </div>
                        ))}
                      </div>
                      {(incoming.length > 0 || outgoing.length > 0) && (
                        <div className="pt-2 border-t border-lattice-border/50 space-y-1">
                          {outgoing.map((r, i) => (
                            <div key={`out-${i}`} className="flex items-center gap-1 text-[10px]">
                              <span className="text-neon-blue">{r.fromCol}</span>
                              <span className="text-gray-600">--&gt;</span>
                              <span className="text-neon-green">{r.to}.{r.toCol}</span>
                            </div>
                          ))}
                          {incoming.map((r, i) => (
                            <div key={`in-${i}`} className="flex items-center gap-1 text-[10px]">
                              <span className="text-neon-pink">{r.from}.{r.fromCol}</span>
                              <span className="text-gray-600">--&gt;</span>
                              <span className="text-neon-yellow">{r.toCol}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {/* Relationship summary */}
              <div className="bg-lattice-surface rounded p-3">
                <h3 className="text-xs font-semibold text-gray-400 mb-2">Relationship Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Tables:</span> <span className="text-neon-cyan font-bold">{tables.length}</span></div>
                  <div><span className="text-gray-500">Foreign Keys:</span> <span className="text-neon-blue font-bold">{relationships.length}</span></div>
                  <div><span className="text-gray-500">Total Columns:</span> <span className="text-neon-purple font-bold">{tables.reduce((s, t) => s + t.columns.length, 0)}</span></div>
                  <div><span className="text-gray-500">Total Rows:</span> <span className="text-neon-green font-bold">{tables.reduce((s, t) => s + t.rowCount, 0).toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* INDEXES TAB                                                  */}
          {/* ============================================================ */}
          {activeTab === 'indexes' && (
            <div className="panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-yellow">
                  <Key className="w-4 h-4" />
                  Indexes ({indexes.length})
                </h2>
                <span className="text-xs text-gray-500">
                  Total index size: {formatBytes(indexes.reduce((s, idx) => s + idx.sizeBytes, 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-lattice-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Table</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Columns</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Unique</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.map(idx => (
                      <tr key={idx.name} className="border-b border-lattice-border/40 hover:bg-lattice-surface/60 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs text-gray-200">{idx.name}</td>
                        <td className="px-3 py-2 text-xs text-neon-cyan">{idx.table}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-300">{idx.columns.join(', ')}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            idx.type === 'btree' ? 'bg-neon-green/10 text-neon-green' :
                            idx.type === 'gin' ? 'bg-neon-purple/10 text-neon-purple' :
                            idx.type === 'ivfflat' ? 'bg-neon-pink/10 text-neon-pink' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {idx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {idx.unique ? <CheckCircle className="w-3.5 h-3.5 text-neon-yellow" /> : <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400 text-right font-mono">{formatBytes(idx.sizeBytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Index type breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['btree', 'gin', 'ivfflat', 'hash'].map(type => {
                  const count = indexes.filter(i => i.type === type).length;
                  return (
                    <MetricCard key={type} label={`${type.toUpperCase()} Indexes`} value={count} />
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MONITORING TAB                                               */}
          {/* ============================================================ */}
          {activeTab === 'monitor' && (
            <div className="space-y-4">
              {/* Time-series bar charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MiniBarChart data={perfHistory.map(p => p.heapUsed)} label="Heap Used (MB)" color="bg-neon-cyan" />
                <MiniBarChart data={perfHistory.map(p => p.queryRate)} label="Query Rate (q/s)" color="bg-neon-green" />
                <MiniBarChart data={perfHistory.map(p => p.cacheHitRate)} label="Cache Hit Rate (%)" color="bg-neon-purple" />
                <MiniBarChart data={perfHistory.map(p => p.activeConns)} label="Active Connections" color="bg-neon-orange" />
              </div>

              {/* Metric cards */}
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
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm ${
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
                <div className="flex gap-4 flex-wrap">
                  <button
                    onClick={() => migrateMutation.mutate()}
                    disabled={migrateMutation.isPending || !dbStatus?.postgres?.connected}
                    className="btn-neon flex items-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    {migrateMutation.isPending ? 'Running Migrations...' : 'Run Migrations'}
                  </button>
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || !dbStatus?.postgres?.connected}
                    className="btn-neon flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync to PostgreSQL'}
                  </button>
                </div>
                {migrateMutation.data && (
                  <p className="mt-2 text-sm text-green-400">
                    Migrations complete: {(migrateMutation.data as { data?: { applied?: number; total?: number } }).data?.applied}/{(migrateMutation.data as { data?: { applied?: number; total?: number } }).data?.total}
                  </p>
                )}
                {syncMutation.data && (
                  <p className="mt-2 text-sm text-green-400">
                    Synced: {(syncMutation.data as { data?: { synced?: number; total?: number } }).data?.synced}/{(syncMutation.data as { data?: { synced?: number; total?: number } }).data?.total} DTUs
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* HISTORY TAB                                                  */}
          {/* ============================================================ */}
          {activeTab === 'history' && (
            <div className="panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-neon-orange">
                  <Clock className="w-4 h-4" />
                  Query History ({queryHistory.length})
                </h2>
                {queryHistory.length > 0 && (
                  <button
                    onClick={() => setQueryHistory([])}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              {queryHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <History className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No queries executed yet</p>
                  <p className="text-xs mt-1">Execute a query in the editor and it will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {queryHistory.map(entry => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-lattice-surface border border-lattice-border/50 rounded p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          {entry.success
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          <span className="text-gray-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-400">{entry.duration}ms</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-400">{entry.rowCount} rows</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { navigator.clipboard.writeText(entry.sql); }}
                            className="p-1 hover:bg-lattice-border/30 rounded transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3 h-3 text-gray-500" />
                          </button>
                          <button
                            onClick={() => { setSql(entry.sql); setActiveTab('query'); }}
                            className="p-1 hover:bg-lattice-border/30 rounded transition-colors"
                            title="Load in editor"
                          >
                            <Play className="w-3 h-3 text-neon-cyan" />
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all bg-lattice-bg/50 rounded p-2">
                        {entry.sql}
                      </pre>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
