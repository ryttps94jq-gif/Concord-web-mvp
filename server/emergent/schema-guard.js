/**
 * Emergent Agent Governance — Schema Guard
 *
 * Risk Category 4: Data Integrity + Offline Sync
 *
 * Problems addressed:
 *   - Schema evolution: any DTU shape change breaks old objects unless
 *     migrations are solid and tested
 *   - Conflict resolution correctness: field-level merges can produce
 *     subtle corruption if timestamps/clock normalization go sideways
 *   - Event ordering assumptions: event-sourcing / journaling can misbehave
 *     under concurrency spikes
 *
 * Approach:
 *   1. Schema Version Registry — track all known DTU shapes, detect drift
 *   2. Migration Pipeline — upgrade old-format DTUs to current schema
 *   3. Conflict Validator — verify field-level merge results for corruption
 *   4. Clock Skew Detector — identify timestamp anomalies that could cause
 *      ordering bugs
 *   5. Event Ordering Verifier — detect out-of-order or duplicate events
 */

import { getEmergentState } from "./store.js";

// ── Schema Versions ─────────────────────────────────────────────────────────

export const CURRENT_DTU_SCHEMA_VERSION = 2;

// ── Schema Guard Store ──────────────────────────────────────────────────────

export function getSchemaGuardStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._schemaGuard) {
    es._schemaGuard = {
      // Schema registry: version -> { fields, required, types, addedAt }
      schemaVersions: new Map(),

      // Migration log
      migrations: [],              // { dtuId, fromVersion, toVersion, timestamp, fields }

      // Conflict validation log
      conflictValidations: [],     // { dtuId, field, expected, actual, valid, timestamp }

      // Clock skew observations
      clockSkew: {
        observations: [],          // { sourceA, sourceB, skewMs, timestamp }
        maxObservedSkew: 0,
        avgSkew: 0,
      },

      // Event ordering issues
      orderingIssues: [],          // { eventA, eventB, issue, timestamp }

      // DTU version tracking
      dtuVersions: new Map(),      // dtuId -> schemaVersion

      metrics: {
        totalValidations: 0,
        totalMigrations: 0,
        migrationFailures: 0,
        conflictsDetected: 0,
        orderingIssuesDetected: 0,
        clockSkewAlerts: 0,
      },
    };

    // Seed known schema versions
    seedSchemaVersions(es._schemaGuard);
  }
  return es._schemaGuard;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SCHEMA VERSION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

function seedSchemaVersions(store) {
  // Version 1: Original DTU shape
  store.schemaVersions.set(1, {
    version: 1,
    required: ["id", "title", "content", "tier"],
    optional: ["tags", "meta", "resonance", "coherence", "stability", "timestamp"],
    types: {
      id: "string",
      title: "string",
      content: "string",
      tier: "string",
      tags: "array",
      meta: "object",
      resonance: "number",
      coherence: "number",
      stability: "number",
      timestamp: "string",
    },
    addedAt: "2024-01-01T00:00:00.000Z",
  });

  // Version 2: Added evidence, provenance, schemaVersion
  store.schemaVersions.set(2, {
    version: 2,
    required: ["id", "title", "content", "tier"],
    optional: [
      "tags", "meta", "resonance", "coherence", "stability", "timestamp",
      "summary", "ownerId", "createdAt", "updatedAt", "schemaVersion",
      "provenance", "epistemicStatus",
    ],
    types: {
      id: "string",
      title: "string",
      content: "string",
      tier: "string",
      tags: "array",
      meta: "object",
      resonance: "number",
      coherence: "number",
      stability: "number",
      timestamp: "string",
      summary: "string",
      ownerId: "string",
      createdAt: "string",
      updatedAt: "string",
      schemaVersion: "number",
      provenance: "object",
      epistemicStatus: "string",
    },
    addedAt: new Date().toISOString(),
  });
}

/**
 * Validate a DTU against its schema version.
 *
 * @param {Object} STATE
 * @param {Object} dtu
 * @returns {{ ok: boolean, valid: boolean, version: number, issues: string[] }}
 */
export function validateDtuSchema(STATE, dtu) {
  const store = getSchemaGuardStore(STATE);
  store.metrics.totalValidations++;

  if (!dtu || typeof dtu !== "object") {
    return { ok: false, valid: false, error: "invalid_dtu" };
  }

  const version = dtu.schemaVersion || 1;
  const schema = store.schemaVersions.get(version);

  if (!schema) {
    return { ok: true, valid: false, version, issues: [`unknown schema version: ${version}`] };
  }

  const issues = [];

  // Check required fields
  for (const field of schema.required) {
    if (dtu[field] === undefined || dtu[field] === null) {
      issues.push(`missing required field: ${field}`);
    }
  }

  // Check types
  for (const [field, expectedType] of Object.entries(schema.types)) {
    if (dtu[field] === undefined || dtu[field] === null) continue;

    const actualType = Array.isArray(dtu[field]) ? "array" : typeof dtu[field];
    if (actualType !== expectedType) {
      issues.push(`type mismatch: ${field} expected ${expectedType}, got ${actualType}`);
    }
  }

  // Track DTU version
  store.dtuVersions.set(dtu.id, version);

  return {
    ok: true,
    valid: issues.length === 0,
    version,
    currentVersion: CURRENT_DTU_SCHEMA_VERSION,
    needsMigration: version < CURRENT_DTU_SCHEMA_VERSION,
    issues,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MIGRATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Migrate a DTU from its current schema version to the latest.
 *
 * @param {Object} STATE
 * @param {Object} dtu - The DTU to migrate (mutated in place)
 * @returns {{ ok: boolean, migrated: boolean, fromVersion: number, toVersion: number, changes: string[] }}
 */
export function migrateDtu(STATE, dtu) {
  const store = getSchemaGuardStore(STATE);

  if (!dtu || typeof dtu !== "object") {
    return { ok: false, error: "invalid_dtu" };
  }

  const fromVersion = dtu.schemaVersion || 1;
  if (fromVersion >= CURRENT_DTU_SCHEMA_VERSION) {
    return { ok: true, migrated: false, fromVersion, toVersion: fromVersion, changes: [] };
  }

  const changes = [];

  try {
    // v1 → v2 migration
    if (fromVersion < 2) {
      // Add new fields with defaults
      if (!dtu.updatedAt) {
        dtu.updatedAt = dtu.timestamp || new Date().toISOString();
        changes.push("added updatedAt");
      }
      if (!dtu.createdAt) {
        dtu.createdAt = dtu.timestamp || new Date().toISOString();
        changes.push("added createdAt");
      }
      if (!dtu.summary && dtu.content) {
        dtu.summary = dtu.content.slice(0, 200);
        changes.push("added summary (truncated content)");
      }
      if (dtu.provenance === undefined) {
        dtu.provenance = { source: "migration", migratedAt: new Date().toISOString() };
        changes.push("added provenance");
      }
      if (dtu.epistemicStatus === undefined) {
        dtu.epistemicStatus = "unverified";
        changes.push("added epistemicStatus=unverified");
      }
    }

    // Stamp new version
    dtu.schemaVersion = CURRENT_DTU_SCHEMA_VERSION;
    changes.push(`version: ${fromVersion} → ${CURRENT_DTU_SCHEMA_VERSION}`);

    // Log migration
    store.migrations.push({
      dtuId: dtu.id,
      fromVersion,
      toVersion: CURRENT_DTU_SCHEMA_VERSION,
      changes,
      timestamp: new Date().toISOString(),
    });
    store.metrics.totalMigrations++;

    // Cap log
    if (store.migrations.length > 10000) {
      store.migrations = store.migrations.slice(-5000);
    }

    store.dtuVersions.set(dtu.id, CURRENT_DTU_SCHEMA_VERSION);

    return { ok: true, migrated: true, fromVersion, toVersion: CURRENT_DTU_SCHEMA_VERSION, changes };
  } catch (err) {
    store.metrics.migrationFailures++;
    return { ok: false, error: "migration_failed", message: err.message, fromVersion };
  }
}

/**
 * Scan and report DTUs that need migration.
 *
 * @param {Object} STATE
 * @returns {{ ok: boolean, needsMigration: number, byVersion: Object }}
 */
export function scanForMigrations(STATE) {
  const store = getSchemaGuardStore(STATE);
  const byVersion = {};
  let needsMigration = 0;

  if (!STATE.dtus) return { ok: true, needsMigration: 0, byVersion: {} };

  for (const dtu of STATE.dtus.values()) {
    const version = dtu.schemaVersion || 1;
    byVersion[version] = (byVersion[version] || 0) + 1;
    if (version < CURRENT_DTU_SCHEMA_VERSION) {
      needsMigration++;
    }
  }

  return {
    ok: true,
    needsMigration,
    totalDtus: STATE.dtus.size,
    currentVersion: CURRENT_DTU_SCHEMA_VERSION,
    byVersion,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CONFLICT VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a field-level merge result for corruption.
 *
 * After a merge, check that:
 *   - No required fields were lost
 *   - No type mismatches were introduced
 *   - Numeric fields stayed within valid ranges
 *   - Timestamps didn't go backward
 *
 * @param {Object} STATE
 * @param {Object} beforeDtu - DTU state before merge
 * @param {Object} afterDtu - DTU state after merge
 * @returns {{ ok: boolean, valid: boolean, issues: Object[] }}
 */
export function validateMergeResult(STATE, beforeDtu, afterDtu) {
  const store = getSchemaGuardStore(STATE);
  const issues = [];

  if (!beforeDtu || !afterDtu) {
    return { ok: false, error: "both_dtu_states_required" };
  }

  // Check required fields weren't lost
  const required = ["id", "title", "content", "tier"];
  for (const field of required) {
    if (beforeDtu[field] !== undefined && (afterDtu[field] === undefined || afterDtu[field] === null)) {
      issues.push({
        field,
        type: "field_lost",
        severity: "critical",
        message: `Required field "${field}" was present before merge but missing after`,
      });
    }
  }

  // Check type consistency
  for (const field of Object.keys(afterDtu)) {
    if (beforeDtu[field] !== undefined && afterDtu[field] !== undefined) {
      const beforeType = Array.isArray(beforeDtu[field]) ? "array" : typeof beforeDtu[field];
      const afterType = Array.isArray(afterDtu[field]) ? "array" : typeof afterDtu[field];
      if (beforeType !== afterType) {
        issues.push({
          field,
          type: "type_changed",
          severity: "warning",
          message: `Field "${field}" changed type: ${beforeType} → ${afterType}`,
        });
      }
    }
  }

  // Check numeric ranges
  for (const field of ["resonance", "coherence", "stability"]) {
    const val = afterDtu[field];
    if (val !== undefined && (typeof val !== "number" || val < 0 || val > 1)) {
      issues.push({
        field,
        type: "range_violation",
        severity: "warning",
        message: `Field "${field}" out of [0,1] range: ${val}`,
      });
    }
  }

  // Check timestamp didn't go backward
  if (beforeDtu.updatedAt && afterDtu.updatedAt) {
    if (afterDtu.updatedAt < beforeDtu.updatedAt) {
      issues.push({
        field: "updatedAt",
        type: "timestamp_regression",
        severity: "warning",
        message: `updatedAt went backward: ${beforeDtu.updatedAt} → ${afterDtu.updatedAt}`,
      });
    }
  }

  // Log validation
  store.conflictValidations.push({
    dtuId: afterDtu.id,
    valid: issues.length === 0,
    issueCount: issues.length,
    timestamp: new Date().toISOString(),
  });
  if (issues.length > 0) store.metrics.conflictsDetected += issues.length;

  // Cap log
  if (store.conflictValidations.length > 5000) {
    store.conflictValidations = store.conflictValidations.slice(-2500);
  }

  return { ok: true, valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CLOCK SKEW DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a timestamp observation from a data source for skew detection.
 *
 * @param {Object} STATE
 * @param {string} source - Data source identifier
 * @param {string} timestamp - ISO timestamp from the source
 * @returns {{ ok: boolean, skewMs: number, suspicious: boolean }}
 */
export function recordTimestamp(STATE, source, timestamp) {
  const store = getSchemaGuardStore(STATE);
  const now = Date.now();
  const sourceTime = new Date(timestamp).getTime();

  if (isNaN(sourceTime)) {
    return { ok: false, error: "invalid_timestamp" };
  }

  const skewMs = Math.abs(now - sourceTime);
  const suspicious = skewMs > 5000; // >5 seconds of skew

  store.clockSkew.observations.push({
    source,
    skewMs,
    serverTime: new Date(now).toISOString(),
    sourceTime: timestamp,
    timestamp: new Date().toISOString(),
  });

  // Update stats
  if (skewMs > store.clockSkew.maxObservedSkew) {
    store.clockSkew.maxObservedSkew = skewMs;
  }

  const recent = store.clockSkew.observations.slice(-100);
  store.clockSkew.avgSkew = recent.reduce((s, o) => s + o.skewMs, 0) / recent.length;

  if (suspicious) {
    store.metrics.clockSkewAlerts++;
  }

  // Cap observations
  if (store.clockSkew.observations.length > 1000) {
    store.clockSkew.observations = store.clockSkew.observations.slice(-500);
  }

  return { ok: true, skewMs, suspicious };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EVENT ORDERING VERIFIER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify event ordering in the journal for a given entity.
 *
 * @param {Object} STATE
 * @param {string} entityId - Entity to check ordering for
 * @returns {{ ok: boolean, ordered: boolean, issues: Object[] }}
 */
export function verifyEventOrdering(STATE, entityId) {
  const store = getSchemaGuardStore(STATE);
  const es = getEmergentState(STATE);
  const journal = es._journal;

  if (!journal) return { ok: true, ordered: true, issues: [] };

  // Get events for this entity
  const indices = journal.byEntity?.get(entityId) || [];
  const events = indices.map(i => journal.events?.[i]).filter(Boolean);

  const issues = [];

  // Check monotonic timestamps
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    // Sequence numbers should be monotonically increasing
    if (curr.seq !== undefined && prev.seq !== undefined && curr.seq <= prev.seq) {
      issues.push({
        type: "sequence_regression",
        eventA: { seq: prev.seq, timestamp: prev.timestamp },
        eventB: { seq: curr.seq, timestamp: curr.timestamp },
        message: `Sequence number went backward: ${prev.seq} → ${curr.seq}`,
      });
    }

    // Timestamps should not go backward by more than 1 second (clock tolerance)
    if (prev.timestamp && curr.timestamp) {
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      if (currTime < prevTime - 1000) {
        issues.push({
          type: "timestamp_regression",
          eventA: { seq: prev.seq, timestamp: prev.timestamp },
          eventB: { seq: curr.seq, timestamp: curr.timestamp },
          message: `Timestamp went backward by ${(prevTime - currTime)}ms`,
        });
      }
    }
  }

  // Check for duplicate sequence numbers
  const seqSeen = new Set();
  for (const event of events) {
    if (event.seq !== undefined) {
      if (seqSeen.has(event.seq)) {
        issues.push({
          type: "duplicate_sequence",
          seq: event.seq,
          message: `Duplicate sequence number: ${event.seq}`,
        });
      }
      seqSeen.add(event.seq);
    }
  }

  if (issues.length > 0) {
    store.orderingIssues.push(...issues.map(i => ({
      ...i,
      entityId,
      timestamp: new Date().toISOString(),
    })));
    store.metrics.orderingIssuesDetected += issues.length;

    if (store.orderingIssues.length > 5000) {
      store.orderingIssues = store.orderingIssues.slice(-2500);
    }
  }

  return { ok: true, ordered: issues.length === 0, issues, eventCount: events.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. QUERY & METRICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get schema guard metrics.
 */
export function getSchemaGuardMetrics(STATE) {
  const store = getSchemaGuardStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    knownVersions: Array.from(store.schemaVersions.keys()),
    currentVersion: CURRENT_DTU_SCHEMA_VERSION,
    trackedDtus: store.dtuVersions.size,
    migrationLog: store.migrations.length,
    clockSkew: {
      maxObservedMs: store.clockSkew.maxObservedSkew,
      avgMs: Math.round(store.clockSkew.avgSkew),
      observations: store.clockSkew.observations.length,
    },
    orderingIssues: store.orderingIssues.length,
  };
}
