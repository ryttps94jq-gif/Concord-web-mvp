/**
 * TypeScript types for system state objects returned by the backend.
 * Brain metrics, repair status, attention, forgetting, etc.
 */

// ── Brain Architecture ──────────────────────────────────────────

export interface BrainMetric {
  name: string;
  url: string;
  model: string;
  role: string;
  enabled: boolean;
  stats: {
    requests: number;
    totalMs: number;
    dtusGenerated: number;
    errors: number;
    fixes?: number;
    sleeping?: boolean;
    lastCallAt: string | null;
  };
}

export type BrainName = 'conscious' | 'subconscious' | 'utility' | 'repair';

export type BrainMetrics = Record<BrainName, BrainMetric>;

// ── Repair Cortex ───────────────────────────────────────────────

export interface RepairStatus {
  running: boolean;
  cycleCount: number;
  errorAccumulatorSize: number;
  lastCycleAt: string | null;
  executorCount: number;
  executorsReady: number;
  networkStatus?: string;
}

// ── Attention Allocator ─────────────────────────────────────────

export interface AttentionAllocation {
  domain: string;
  budget: number;
  urgency: number;
  focused?: boolean;
}

export interface FocusOverride {
  domain: string;
  weight: number;
  expiresAt: string;
}

// ── Forgetting Engine ───────────────────────────────────────────

export interface ForgettingStats {
  running: boolean;
  threshold: number;
  lastRun: string | null;
  nextRun: string | null;
  lifetimeForgotten: number;
  tombstones: number;
  interval: number;
}

export interface Tombstone {
  id: string;
  originalId: string;
  title: string;
  tier: string;
  score: number;
  forgottenAt: string;
}

// ── Dream Capture ───────────────────────────────────────────────

export interface Dream {
  id: string;
  title: string;
  summary: string;
  convergence: boolean;
  capturedAt: string;
  tags: string[];
}

export interface DreamConvergence {
  dreamId: string;
  matchedDtuId: string;
  score: number;
  foundAt: string;
}

// ── Promotion Pipeline ──────────────────────────────────────────

export interface Promotion {
  id: string;
  artifactId: string;
  artifactName: string;
  fromStage: string;
  toStage: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  reason?: string;
}

// ── Ghost Fleet ─────────────────────────────────────────────────

export interface GhostFleetModule {
  name: string;
  loaded: boolean;
}

export interface GhostFleetStatus {
  totalLoaded: number;
  totalFailed: number;
  loadedAt: string | null;
  modules: GhostFleetModule[];
}

// ── System Status (aggregate) ───────────────────────────────────

export interface SystemStatus {
  ok: boolean;
  version: string;
  uptime: number;
  llmReady: boolean;
  counts: {
    dtus: number;
    wrappers: number;
    layers: number;
    personas: number;
    events: number;
    emergents: number;
  };
  ghostFleet: GhostFleetStatus;
  brains?: BrainMetrics;
  attentionAllocator?: {
    active: boolean;
    domainCount: number;
  };
  dreamCapture?: {
    pendingMetaDerivation: number;
  };
}

// ── LLM Queue ───────────────────────────────────────────────────

export interface LLMQueueMetrics {
  queued: number;
  inflight: number;
  completed: number;
  rejected: number;
  avgLatencyMs: number;
  byPriority: Record<string, {
    queued: number;
    inflight: number;
    completed: number;
    rejected: number;
    avgLatencyMs: number;
  }>;
}

// ── Notifications ───────────────────────────────────────────────

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: string;
  acknowledged?: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}
