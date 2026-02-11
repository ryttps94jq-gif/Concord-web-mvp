/**
 * Emergent Agent Governance — Deep Health Checks
 *
 * Risk Category 5: Operational Risks ("one founder, one droplet")
 *
 * Problems addressed:
 *   - Health endpoint returns 200 while users experience "half-dead" behavior
 *     (timeouts, queue buildup, partial writes)
 *   - No visibility into internal store health, queue depths, memory pressure
 *   - Small changes breaking far-away pages (monolith + many lenses)
 *
 * Approach:
 *   1. Deep Health Probe — checks every subsystem, not just "is the process alive"
 *   2. Queue Depth Monitor — detects buildup in scheduler, proposals, governance
 *   3. Store Consistency Check — verifies internal data structures aren't corrupted
 *   4. Memory Pressure Tracker — monitors in-memory store sizes
 *   5. Degradation Detector — identifies partial failures before they go full
 */

import { getEmergentState } from "./store.js";

// ── Health Status ───────────────────────────────────────────────────────────

export const HEALTH_STATUS = Object.freeze({
  HEALTHY:   "healthy",     // all systems nominal
  DEGRADED:  "degraded",    // some issues but functional
  UNHEALTHY: "unhealthy",   // significant problems
  CRITICAL:  "critical",    // system should be restarted / investigated
});

// ── Deep Health Store ───────────────────────────────────────────────────────

export function getDeepHealthStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._deepHealth) {
    es._deepHealth = {
      // Health check history
      history: [],                  // { timestamp, status, checks }

      // Degradation tracking
      degradations: [],             // { subsystem, started, resolved, duration }

      // Memory usage snapshots
      memorySnapshots: [],          // { timestamp, sizes }

      // Configuration
      thresholds: {
        maxQueueDepth: 100,          // scheduler queue items
        maxPendingProposals: 50,     // unreviewed proposals
        maxActiveAllocations: 20,    // concurrent work
        maxStoreEntries: 100000,     // any single store
        maxMemoryMB: 512,            // memory warning threshold
        maxEventLogSize: 50000,      // journal/audit log
        maxStalenessMs: 300000,      // 5 min — if stores haven't updated
      },

      metrics: {
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        unhealthyChecks: 0,
        criticalChecks: 0,
        lastCheck: null,
      },
    };
  }
  return es._deepHealth;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEEP HEALTH PROBE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a comprehensive health check across all subsystems.
 *
 * @param {Object} STATE
 * @returns {{ ok: boolean, status: string, checks: Object[], score: number }}
 */
export function runDeepHealthCheck(STATE) {
  const es = getEmergentState(STATE);
  const store = getDeepHealthStore(STATE);
  const checks = [];

  // 1. Core state
  checks.push(checkCoreState(es));

  // 2. Scheduler queue
  checks.push(checkSchedulerHealth(es, store.thresholds));

  // 3. Proposal backlog
  checks.push(checkProposalBacklog(es, store.thresholds));

  // 4. Evidence store
  checks.push(checkEvidenceStore(es, store.thresholds));

  // 5. Journal health
  checks.push(checkJournalHealth(es, store.thresholds));

  // 6. Memory pressure
  checks.push(checkMemoryPressure(es, store.thresholds));

  // 7. Store consistency
  checks.push(checkStoreConsistency(STATE, es));

  // 8. Constitution integrity
  checks.push(checkConstitutionIntegrity(es));

  // Compute overall status
  const statuses = checks.map(c => c.status);
  let overallStatus;
  if (statuses.includes(HEALTH_STATUS.CRITICAL)) overallStatus = HEALTH_STATUS.CRITICAL;
  else if (statuses.includes(HEALTH_STATUS.UNHEALTHY)) overallStatus = HEALTH_STATUS.UNHEALTHY;
  else if (statuses.includes(HEALTH_STATUS.DEGRADED)) overallStatus = HEALTH_STATUS.DEGRADED;
  else overallStatus = HEALTH_STATUS.HEALTHY;

  // Compute health score (0-100)
  const weights = { healthy: 1, degraded: 0.6, unhealthy: 0.3, critical: 0 };
  const score = Math.round(
    (checks.reduce((sum, c) => sum + (weights[c.status] || 0), 0) / checks.length) * 100
  );

  // Record history
  const result = {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    score,
    checkCount: checks.length,
  };
  store.history.push(result);
  if (store.history.length > 1000) store.history = store.history.slice(-500);

  // Update metrics
  store.metrics.totalChecks++;
  store.metrics[`${overallStatus}Checks`]++;
  store.metrics.lastCheck = result.timestamp;

  // Track degradation transitions
  const prevStatus = store.history.length > 1 ? store.history[store.history.length - 2]?.status : null;
  if (prevStatus === HEALTH_STATUS.HEALTHY && overallStatus !== HEALTH_STATUS.HEALTHY) {
    store.degradations.push({
      started: result.timestamp,
      status: overallStatus,
      resolved: null,
    });
  } else if (prevStatus !== HEALTH_STATUS.HEALTHY && overallStatus === HEALTH_STATUS.HEALTHY) {
    const lastDeg = store.degradations[store.degradations.length - 1];
    if (lastDeg && !lastDeg.resolved) {
      lastDeg.resolved = result.timestamp;
      lastDeg.durationMs = new Date(result.timestamp).getTime() - new Date(lastDeg.started).getTime();
    }
  }

  if (store.degradations.length > 200) store.degradations = store.degradations.slice(-100);

  return { ok: true, status: overallStatus, score, checks };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INDIVIDUAL HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

function checkCoreState(es) {
  const issues = [];

  if (!es.initialized) {
    issues.push("Emergent system not initialized");
    return { subsystem: "core", status: HEALTH_STATUS.CRITICAL, issues };
  }

  if (!es.emergents || !(es.emergents instanceof Map)) {
    issues.push("Emergent registry is missing or corrupted");
  }
  if (!es.sessions || !(es.sessions instanceof Map)) {
    issues.push("Session registry is missing or corrupted");
  }

  return {
    subsystem: "core",
    status: issues.length > 0 ? HEALTH_STATUS.UNHEALTHY : HEALTH_STATUS.HEALTHY,
    issues,
    data: {
      initialized: es.initialized,
      emergentCount: es.emergents?.size || 0,
      sessionCount: es.sessions?.size || 0,
    },
  };
}

function checkSchedulerHealth(es, thresholds) {
  const issues = [];
  const scheduler = es._scheduler;

  if (!scheduler) {
    return { subsystem: "scheduler", status: HEALTH_STATUS.HEALTHY, issues: [], data: { initialized: false } };
  }

  const queueSize = scheduler.queue?.length || 0;
  const activeCount = scheduler.activeAllocations?.size || 0;

  if (queueSize > thresholds.maxQueueDepth) {
    issues.push(`Queue depth: ${queueSize} (threshold: ${thresholds.maxQueueDepth})`);
  }
  if (activeCount > thresholds.maxActiveAllocations) {
    issues.push(`Active allocations: ${activeCount} (threshold: ${thresholds.maxActiveAllocations})`);
  }

  const status = issues.length > 0
    ? (queueSize > thresholds.maxQueueDepth * 2 ? HEALTH_STATUS.UNHEALTHY : HEALTH_STATUS.DEGRADED)
    : HEALTH_STATUS.HEALTHY;

  return { subsystem: "scheduler", status, issues, data: { queueSize, activeCount } };
}

function checkProposalBacklog(es, thresholds) {
  const issues = [];
  const lattice = es._lattice;

  if (!lattice) {
    return { subsystem: "proposals", status: HEALTH_STATUS.HEALTHY, issues: [], data: { initialized: false } };
  }

  const pendingCount = lattice.pendingProposals?.size || 0;

  if (pendingCount > thresholds.maxPendingProposals) {
    issues.push(`Pending proposals: ${pendingCount} (threshold: ${thresholds.maxPendingProposals})`);
  }

  return {
    subsystem: "proposals",
    status: issues.length > 0 ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.HEALTHY,
    issues,
    data: { pendingCount },
  };
}

function checkEvidenceStore(es, thresholds) {
  const issues = [];
  const evidenceStore = es._evidence;

  if (!evidenceStore) {
    return { subsystem: "evidence", status: HEALTH_STATUS.HEALTHY, issues: [], data: { initialized: false } };
  }

  const evidenceCount = evidenceStore.evidence?.size || 0;
  const maintenanceLogSize = evidenceStore.maintenanceLog?.length || 0;

  if (evidenceCount > thresholds.maxStoreEntries) {
    issues.push(`Evidence count: ${evidenceCount} (threshold: ${thresholds.maxStoreEntries})`);
  }
  if (maintenanceLogSize > thresholds.maxEventLogSize) {
    issues.push(`Maintenance log size: ${maintenanceLogSize} (threshold: ${thresholds.maxEventLogSize})`);
  }

  return {
    subsystem: "evidence",
    status: issues.length > 0 ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.HEALTHY,
    issues,
    data: { evidenceCount, maintenanceLogSize },
  };
}

function checkJournalHealth(es, thresholds) {
  const issues = [];
  const journal = es._journal;

  if (!journal) {
    return { subsystem: "journal", status: HEALTH_STATUS.HEALTHY, issues: [], data: { initialized: false } };
  }

  const eventCount = journal.events?.length || 0;

  if (eventCount > thresholds.maxEventLogSize) {
    issues.push(`Journal event count: ${eventCount} (threshold: ${thresholds.maxEventLogSize})`);
  }

  // Check if journal is stale (no recent events)
  if (eventCount > 0) {
    const lastEvent = journal.events[eventCount - 1];
    if (lastEvent?.timestamp) {
      const staleness = Date.now() - new Date(lastEvent.timestamp).getTime();
      if (staleness > thresholds.maxStalenessMs && eventCount > 10) {
        issues.push(`Journal stale: last event ${Math.round(staleness / 1000)}s ago`);
      }
    }
  }

  return {
    subsystem: "journal",
    status: issues.length > 0 ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.HEALTHY,
    issues,
    data: { eventCount },
  };
}

function checkMemoryPressure(es, thresholds) {
  const issues = [];
  const sizes = {};

  // Count entries in all stores
  const stores = [
    ["emergents", es.emergents],
    ["sessions", es.sessions],
    ["patterns", es.patterns],
    ["outcomes", es._outcomes?.records],
    ["skills", es._skills?.skills],
    ["projects", es._projects?.projects],
    ["observations", es._institutionalMemory?.observations],
    ["evidence", es._evidence?.evidence],
    ["pipelines", es._verificationPipelines?.pipelines],
    ["goals_active", es._goals?.active],
    ["constitution_rules", es._constitution?.rules],
  ];

  let totalEntries = 0;
  for (const [name, store] of stores) {
    const size = store?.size || store?.length || 0;
    sizes[name] = size;
    totalEntries += size;
  }

  if (totalEntries > thresholds.maxStoreEntries) {
    issues.push(`Total in-memory entries: ${totalEntries} (threshold: ${thresholds.maxStoreEntries})`);
  }

  // Check Node.js process memory if available
  let memoryMB = null;
  if (typeof process !== "undefined" && process.memoryUsage) {
    const usage = process.memoryUsage();
    memoryMB = Math.round(usage.heapUsed / (1024 * 1024));
    sizes._heapUsedMB = memoryMB;
    sizes._heapTotalMB = Math.round(usage.heapTotal / (1024 * 1024));
    sizes._rssMB = Math.round(usage.rss / (1024 * 1024));

    if (memoryMB > thresholds.maxMemoryMB) {
      issues.push(`Heap usage: ${memoryMB}MB (threshold: ${thresholds.maxMemoryMB}MB)`);
    }
  }

  const status = issues.length > 0
    ? (memoryMB && memoryMB > thresholds.maxMemoryMB * 1.5 ? HEALTH_STATUS.UNHEALTHY : HEALTH_STATUS.DEGRADED)
    : HEALTH_STATUS.HEALTHY;

  return { subsystem: "memory", status, issues, data: { totalEntries, sizes } };
}

function checkStoreConsistency(STATE, es) {
  const issues = [];

  // Check that DTU IDs in edge store actually exist
  const edgeStore = es._edges;
  if (edgeStore && STATE.dtus) {
    let orphanedEdges = 0;
    const sampleSize = Math.min(100, edgeStore.edges?.size || 0);
    let checked = 0;

    if (edgeStore.edges) {
      for (const edge of edgeStore.edges.values()) {
        if (checked >= sampleSize) break;
        if (!STATE.dtus.has(edge.sourceId) || !STATE.dtus.has(edge.targetId)) {
          orphanedEdges++;
        }
        checked++;
      }
    }

    if (orphanedEdges > 0) {
      issues.push(`${orphanedEdges}/${checked} sampled edges reference non-existent DTUs`);
    }
  }

  // Check evidence store references
  const evidenceStore = es._evidence;
  if (evidenceStore && STATE.dtus) {
    let orphanedEvidence = 0;
    let checked = 0;

    for (const [dtuId] of evidenceStore.byDtu) {
      if (checked >= 50) break;
      if (!STATE.dtus.has(dtuId)) orphanedEvidence++;
      checked++;
    }

    if (orphanedEvidence > 0) {
      issues.push(`${orphanedEvidence}/${checked} sampled evidence entries reference non-existent DTUs`);
    }
  }

  return {
    subsystem: "consistency",
    status: issues.length > 0 ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.HEALTHY,
    issues,
  };
}

function checkConstitutionIntegrity(es) {
  const issues = [];
  const constitution = es._constitution;

  if (!constitution) {
    return { subsystem: "constitution", status: HEALTH_STATUS.HEALTHY, issues: [], data: { initialized: false } };
  }

  // Verify immutable rules are still present and active
  const immutableIds = ["IMM-001", "IMM-002", "IMM-003", "IMM-004", "IMM-005",
                        "IMM-006", "IMM-007", "IMM-008", "IMM-009", "IMM-010"];
  const missingImmutables = [];
  const deactivatedImmutables = [];

  for (const id of immutableIds) {
    const rule = constitution.rules.get(id);
    if (!rule) {
      missingImmutables.push(id);
    } else if (!rule.active) {
      deactivatedImmutables.push(id);
    }
  }

  if (missingImmutables.length > 0) {
    issues.push(`Missing immutable rules: ${missingImmutables.join(", ")}`);
  }
  if (deactivatedImmutables.length > 0) {
    issues.push(`Deactivated immutable rules: ${deactivatedImmutables.join(", ")}`);
  }

  const status = missingImmutables.length > 0 ? HEALTH_STATUS.CRITICAL
    : deactivatedImmutables.length > 0 ? HEALTH_STATUS.UNHEALTHY
    : HEALTH_STATUS.HEALTHY;

  return {
    subsystem: "constitution",
    status,
    issues,
    data: {
      totalRules: constitution.rules.size,
      immutableCount: immutableIds.length - missingImmutables.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. QUERY & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get health check history.
 */
export function getHealthHistory(STATE, count = 20) {
  const store = getDeepHealthStore(STATE);
  return { ok: true, history: store.history.slice(-count), total: store.history.length };
}

/**
 * Get degradation history.
 */
export function getDegradationHistory(STATE) {
  const store = getDeepHealthStore(STATE);
  return { ok: true, degradations: store.degradations.slice(-50), total: store.degradations.length };
}

/**
 * Update health check thresholds.
 */
export function updateHealthThresholds(STATE, overrides = {}) {
  const store = getDeepHealthStore(STATE);
  for (const [key, value] of Object.entries(overrides)) {
    if (key in store.thresholds && typeof value === "number") {
      store.thresholds[key] = value;
    }
  }
  return { ok: true, thresholds: { ...store.thresholds } };
}

/**
 * Get deep health metrics.
 */
export function getDeepHealthMetrics(STATE) {
  const store = getDeepHealthStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    thresholds: { ...store.thresholds },
    degradationCount: store.degradations.length,
    activeDegradation: store.degradations.find(d => !d.resolved) || null,
  };
}
