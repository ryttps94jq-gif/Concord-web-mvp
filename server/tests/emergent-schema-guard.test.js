/**
 * Emergent Schema Guard — Comprehensive Test Suite
 *
 * Covers all exports from emergent/schema-guard.js:
 *   - CURRENT_DTU_SCHEMA_VERSION
 *   - getSchemaGuardStore()
 *   - validateDtuSchema()
 *   - migrateDtu()
 *   - scanForMigrations()
 *   - validateMergeResult()
 *   - recordTimestamp()
 *   - verifyEventOrdering()
 *   - getSchemaGuardMetrics()
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_DTU_SCHEMA_VERSION,
  getSchemaGuardStore,
  validateDtuSchema,
  migrateDtu,
  scanForMigrations,
  validateMergeResult,
  recordTimestamp,
  verifyEventOrdering,
  getSchemaGuardMetrics,
} from "../emergent/schema-guard.js";

function makeState() {
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CURRENT_DTU_SCHEMA_VERSION
// ═══════════════════════════════════════════════════════════════════════════════

describe("CURRENT_DTU_SCHEMA_VERSION", () => {
  it("is numeric and equals 2", () => {
    assert.equal(typeof CURRENT_DTU_SCHEMA_VERSION, "number");
    assert.equal(CURRENT_DTU_SCHEMA_VERSION, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. getSchemaGuardStore
// ═══════════════════════════════════════════════════════════════════════════════

describe("getSchemaGuardStore", () => {
  it("initializes store on first access", () => {
    const STATE = makeState();
    const store = getSchemaGuardStore(STATE);
    assert.ok(store);
    assert.ok(store.schemaVersions instanceof Map);
    assert.ok(store.migrations instanceof Array);
    assert.ok(store.conflictValidations instanceof Array);
    assert.ok(store.dtuVersions instanceof Map);
    assert.ok(store.orderingIssues instanceof Array);
    assert.ok(typeof store.metrics === "object");
  });

  it("returns same store on subsequent calls", () => {
    const STATE = makeState();
    const s1 = getSchemaGuardStore(STATE);
    const s2 = getSchemaGuardStore(STATE);
    assert.equal(s1, s2);
  });

  it("seeds schema versions 1 and 2", () => {
    const STATE = makeState();
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.schemaVersions.has(1));
    assert.ok(store.schemaVersions.has(2));
    assert.equal(store.schemaVersions.get(1).version, 1);
    assert.equal(store.schemaVersions.get(2).version, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. validateDtuSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateDtuSchema", () => {
  it("returns error for null dtu", () => {
    const STATE = makeState();
    const r = validateDtuSchema(STATE, null);
    assert.equal(r.ok, false);
    assert.equal(r.valid, false);
    assert.equal(r.error, "invalid_dtu");
  });

  it("returns error for non-object dtu", () => {
    const STATE = makeState();
    const r = validateDtuSchema(STATE, "string");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_dtu");
  });

  it("validates v1 dtu with all required fields", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular" };
    const r = validateDtuSchema(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.valid, true);
    assert.equal(r.version, 1);
    assert.equal(r.needsMigration, true);
  });

  it("validates v2 dtu successfully", () => {
    const STATE = makeState();
    const dtu = {
      id: "d1", title: "T", content: "C", tier: "regular",
      schemaVersion: 2, tags: ["a"], resonance: 0.5,
    };
    const r = validateDtuSchema(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.valid, true);
    assert.equal(r.version, 2);
    assert.equal(r.needsMigration, false);
    assert.equal(r.currentVersion, CURRENT_DTU_SCHEMA_VERSION);
  });

  it("reports missing required fields", () => {
    const STATE = makeState();
    const dtu = { id: "d1", schemaVersion: 2 };
    const r = validateDtuSchema(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.includes("title")));
    assert.ok(r.issues.some(i => i.includes("content")));
    assert.ok(r.issues.some(i => i.includes("tier")));
  });

  it("reports type mismatches", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular", resonance: "not_a_number" };
    const r = validateDtuSchema(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.includes("type mismatch")));
  });

  it("handles array type check correctly (tags)", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular", tags: "not_array" };
    const r = validateDtuSchema(STATE, dtu);
    assert.ok(r.issues.some(i => i.includes("tags")));
  });

  it("handles unknown schema version", () => {
    const STATE = makeState();
    const dtu = { id: "d1", schemaVersion: 99 };
    const r = validateDtuSchema(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.includes("unknown schema version")));
  });

  it("increments totalValidations metric", () => {
    const STATE = makeState();
    validateDtuSchema(STATE, { id: "d1", title: "T", content: "C", tier: "regular" });
    validateDtuSchema(STATE, { id: "d2", title: "T", content: "C", tier: "regular" });
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.metrics.totalValidations >= 2);
  });

  it("tracks DTU version in dtuVersions map", () => {
    const STATE = makeState();
    validateDtuSchema(STATE, { id: "dX", title: "T", content: "C", tier: "regular" });
    const store = getSchemaGuardStore(STATE);
    assert.equal(store.dtuVersions.get("dX"), 1);
  });

  it("skips null/undefined fields during type checking", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular", resonance: null };
    const r = validateDtuSchema(STATE, dtu);
    // resonance is null => skip type check but should not produce type mismatch
    assert.ok(!r.issues.some(i => i.includes("type mismatch") && i.includes("resonance")));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. migrateDtu
// ═══════════════════════════════════════════════════════════════════════════════

describe("migrateDtu", () => {
  it("returns error for null dtu", () => {
    const STATE = makeState();
    const r = migrateDtu(STATE, null);
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_dtu");
  });

  it("returns error for non-object dtu", () => {
    const STATE = makeState();
    const r = migrateDtu(STATE, 42);
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_dtu");
  });

  it("no-op for current version dtu", () => {
    const STATE = makeState();
    const dtu = { id: "d1", schemaVersion: 2 };
    const r = migrateDtu(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.migrated, false);
    assert.equal(r.fromVersion, 2);
    assert.equal(r.toVersion, 2);
    assert.equal(r.changes.length, 0);
  });

  it("no-op for version higher than current", () => {
    const STATE = makeState();
    const dtu = { id: "d1", schemaVersion: 99 };
    const r = migrateDtu(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.migrated, false);
  });

  it("migrates v1 to v2 adding all new fields", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "Some content here", tier: "regular" };
    const r = migrateDtu(STATE, dtu);
    assert.equal(r.ok, true);
    assert.equal(r.migrated, true);
    assert.equal(r.fromVersion, 1);
    assert.equal(r.toVersion, 2);
    assert.equal(dtu.schemaVersion, 2);
    assert.ok(dtu.updatedAt);
    assert.ok(dtu.createdAt);
    assert.ok(dtu.summary);
    assert.ok(dtu.provenance);
    assert.equal(dtu.epistemicStatus, "unverified");
    assert.ok(r.changes.length > 0);
  });

  it("uses existing timestamp for createdAt/updatedAt during migration", () => {
    const STATE = makeState();
    const ts = "2024-06-01T00:00:00.000Z";
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular", timestamp: ts };
    migrateDtu(STATE, dtu);
    assert.equal(dtu.createdAt, ts);
    assert.equal(dtu.updatedAt, ts);
  });

  it("does not overwrite existing fields during migration", () => {
    const STATE = makeState();
    const dtu = {
      id: "d1", title: "T", content: "C", tier: "regular",
      updatedAt: "existing", createdAt: "existing",
      summary: "existing", provenance: {}, epistemicStatus: "verified",
    };
    migrateDtu(STATE, dtu);
    assert.equal(dtu.updatedAt, "existing");
    assert.equal(dtu.createdAt, "existing");
    assert.equal(dtu.summary, "existing");
  });

  it("truncates summary to 200 chars from content", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "x".repeat(500), tier: "regular" };
    migrateDtu(STATE, dtu);
    assert.equal(dtu.summary.length, 200);
  });

  it("increments totalMigrations metric", () => {
    const STATE = makeState();
    migrateDtu(STATE, { id: "d1", content: "C", tier: "regular", title: "T" });
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.metrics.totalMigrations >= 1);
  });

  it("logs migration to migrations array", () => {
    const STATE = makeState();
    migrateDtu(STATE, { id: "d1", content: "C", tier: "regular", title: "T" });
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.migrations.length >= 1);
    const last = store.migrations[store.migrations.length - 1];
    assert.equal(last.dtuId, "d1");
    assert.equal(last.fromVersion, 1);
    assert.equal(last.toVersion, 2);
  });

  it("caps migration log at 10000 entries", () => {
    const STATE = makeState();
    const store = getSchemaGuardStore(STATE);
    // Fill to just above 10000
    store.migrations = new Array(10001).fill({ dtuId: "x", fromVersion: 1, toVersion: 2, changes: [] });
    migrateDtu(STATE, { id: "dNew", content: "C", tier: "regular", title: "T" });
    // After cap: should be sliced to last 5000
    assert.ok(store.migrations.length <= 5001);
  });

  it("updates dtuVersions map after migration", () => {
    const STATE = makeState();
    migrateDtu(STATE, { id: "dv", content: "C", tier: "regular", title: "T" });
    const store = getSchemaGuardStore(STATE);
    assert.equal(store.dtuVersions.get("dv"), 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. scanForMigrations
// ═══════════════════════════════════════════════════════════════════════════════

describe("scanForMigrations", () => {
  it("returns zero when STATE.dtus is missing", () => {
    const STATE = makeState();
    const r = scanForMigrations(STATE);
    assert.equal(r.ok, true);
    assert.equal(r.needsMigration, 0);
  });

  it("counts DTUs needing migration", () => {
    const STATE = makeState();
    STATE.dtus = new Map([
      ["d1", { id: "d1", schemaVersion: 1 }],
      ["d2", { id: "d2", schemaVersion: 2 }],
      ["d3", { id: "d3" }], // defaults to v1
    ]);
    const r = scanForMigrations(STATE);
    assert.equal(r.ok, true);
    assert.equal(r.needsMigration, 2);
    assert.equal(r.totalDtus, 3);
    assert.equal(r.byVersion[1], 2);
    assert.equal(r.byVersion[2], 1);
    assert.equal(r.currentVersion, CURRENT_DTU_SCHEMA_VERSION);
  });

  it("returns zero when all DTUs are current", () => {
    const STATE = makeState();
    STATE.dtus = new Map([
      ["d1", { id: "d1", schemaVersion: 2 }],
    ]);
    const r = scanForMigrations(STATE);
    assert.equal(r.needsMigration, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. validateMergeResult
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateMergeResult", () => {
  it("returns error when before or after is missing", () => {
    const STATE = makeState();
    assert.equal(validateMergeResult(STATE, null, {}).ok, false);
    assert.equal(validateMergeResult(STATE, {}, null).ok, false);
    assert.equal(validateMergeResult(STATE, null, null).ok, false);
  });

  it("passes for identical DTUs", () => {
    const STATE = makeState();
    const dtu = { id: "d1", title: "T", content: "C", tier: "regular", resonance: 0.5 };
    const r = validateMergeResult(STATE, dtu, { ...dtu });
    assert.equal(r.ok, true);
    assert.equal(r.valid, true);
    assert.equal(r.issues.length, 0);
  });

  it("detects lost required fields", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular" };
    const after = { id: "d1", title: null, content: "C", tier: "regular" };
    const r = validateMergeResult(STATE, before, after);
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.field === "title" && i.type === "field_lost"));
  });

  it("detects type changes", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular", resonance: 0.5 };
    const after = { id: "d1", title: "T", content: "C", tier: "regular", resonance: "high" };
    const r = validateMergeResult(STATE, before, after);
    assert.ok(r.issues.some(i => i.type === "type_changed" && i.field === "resonance"));
  });

  it("detects range violations for resonance, coherence, stability", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular" };
    const after = { id: "d1", title: "T", content: "C", tier: "regular", resonance: 1.5, coherence: -0.1, stability: "bad" };
    const r = validateMergeResult(STATE, before, after);
    assert.ok(r.issues.some(i => i.field === "resonance" && i.type === "range_violation"));
    assert.ok(r.issues.some(i => i.field === "coherence" && i.type === "range_violation"));
    assert.ok(r.issues.some(i => i.field === "stability" && i.type === "range_violation"));
  });

  it("detects timestamp regression", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular", updatedAt: "2024-06-02T00:00:00Z" };
    const after = { id: "d1", title: "T", content: "C", tier: "regular", updatedAt: "2024-06-01T00:00:00Z" };
    const r = validateMergeResult(STATE, before, after);
    assert.ok(r.issues.some(i => i.type === "timestamp_regression"));
  });

  it("allows same timestamp (no regression)", () => {
    const STATE = makeState();
    const ts = "2024-06-01T00:00:00Z";
    const before = { id: "d1", title: "T", content: "C", tier: "regular", updatedAt: ts };
    const after = { id: "d1", title: "T", content: "C", tier: "regular", updatedAt: ts };
    const r = validateMergeResult(STATE, before, after);
    assert.ok(!r.issues.some(i => i.type === "timestamp_regression"));
  });

  it("logs validation to conflictValidations", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular" };
    const after = { id: "d1", title: "T", content: "C", tier: "regular" };
    validateMergeResult(STATE, before, after);
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.conflictValidations.length >= 1);
  });

  it("increments conflictsDetected for issues", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular" };
    const after = { id: "d1", title: null, content: "C", tier: "regular" };
    validateMergeResult(STATE, before, after);
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.metrics.conflictsDetected > 0);
  });

  it("caps conflictValidations log at 5000", () => {
    const STATE = makeState();
    const store = getSchemaGuardStore(STATE);
    store.conflictValidations = new Array(5001).fill({ valid: true });
    validateMergeResult(STATE, { id: "d1", title: "T", content: "C", tier: "r" }, { id: "d1", title: "T", content: "C", tier: "r" });
    assert.ok(store.conflictValidations.length <= 2502);
  });

  it("handles array type detection (before is array, after is not)", () => {
    const STATE = makeState();
    const before = { id: "d1", title: "T", content: "C", tier: "regular", tags: ["a"] };
    const after = { id: "d1", title: "T", content: "C", tier: "regular", tags: "a" };
    const r = validateMergeResult(STATE, before, after);
    assert.ok(r.issues.some(i => i.type === "type_changed" && i.field === "tags"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. recordTimestamp
// ═══════════════════════════════════════════════════════════════════════════════

describe("recordTimestamp", () => {
  it("returns error for invalid timestamp", () => {
    const STATE = makeState();
    const r = recordTimestamp(STATE, "source1", "not-a-date");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_timestamp");
  });

  it("records a valid timestamp with low skew", () => {
    const STATE = makeState();
    const r = recordTimestamp(STATE, "source1", new Date().toISOString());
    assert.equal(r.ok, true);
    assert.equal(typeof r.skewMs, "number");
    assert.equal(r.suspicious, false);
  });

  it("detects suspicious skew (>5s)", () => {
    const STATE = makeState();
    const oldDate = new Date(Date.now() - 60000).toISOString();
    const r = recordTimestamp(STATE, "source1", oldDate);
    assert.equal(r.ok, true);
    assert.equal(r.suspicious, true);
  });

  it("updates maxObservedSkew", () => {
    const STATE = makeState();
    const oldDate = new Date(Date.now() - 10000).toISOString();
    recordTimestamp(STATE, "source1", oldDate);
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.clockSkew.maxObservedSkew >= 9000);
  });

  it("computes avgSkew from recent observations", () => {
    const STATE = makeState();
    recordTimestamp(STATE, "source1", new Date().toISOString());
    recordTimestamp(STATE, "source2", new Date().toISOString());
    const store = getSchemaGuardStore(STATE);
    assert.equal(typeof store.clockSkew.avgSkew, "number");
  });

  it("increments clockSkewAlerts for suspicious timestamps", () => {
    const STATE = makeState();
    recordTimestamp(STATE, "s1", new Date(Date.now() - 60000).toISOString());
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.metrics.clockSkewAlerts >= 1);
  });

  it("caps observations at 1000", () => {
    const STATE = makeState();
    const store = getSchemaGuardStore(STATE);
    store.clockSkew.observations = new Array(1001).fill({ skewMs: 0 });
    recordTimestamp(STATE, "s1", new Date().toISOString());
    assert.ok(store.clockSkew.observations.length <= 501);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. verifyEventOrdering
// ═══════════════════════════════════════════════════════════════════════════════

describe("verifyEventOrdering", () => {
  it("returns ordered:true when no journal exists", () => {
    const STATE = makeState();
    const r = verifyEventOrdering(STATE, "entity1");
    assert.equal(r.ok, true);
    assert.equal(r.ordered, true);
    assert.equal(r.issues.length, 0);
  });

  it("returns ordered:true for empty entity events", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [],
        byEntity: new Map(),
      },
    };
    // Initialize schema guard store
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "entity1");
    assert.equal(r.ok, true);
    assert.equal(r.ordered, true);
  });

  it("detects sequence regression", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 10, timestamp: "2024-01-01T00:00:00Z" },
          { seq: 5, timestamp: "2024-01-01T00:00:01Z" },
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.equal(r.ordered, false);
    assert.ok(r.issues.some(i => i.type === "sequence_regression"));
  });

  it("detects timestamp regression beyond tolerance", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 1, timestamp: "2024-01-01T00:00:10.000Z" },
          { seq: 2, timestamp: "2024-01-01T00:00:05.000Z" }, // 5s backward
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.ok(r.issues.some(i => i.type === "timestamp_regression"));
  });

  it("allows timestamp regression within 1s tolerance", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 1, timestamp: "2024-01-01T00:00:01.500Z" },
          { seq: 2, timestamp: "2024-01-01T00:00:01.000Z" }, // 500ms backward (within 1s tolerance)
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.ok(!r.issues.some(i => i.type === "timestamp_regression"));
  });

  it("detects duplicate sequence numbers", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 1, timestamp: "2024-01-01T00:00:00Z" },
          { seq: 2, timestamp: "2024-01-01T00:00:01Z" },
          { seq: 2, timestamp: "2024-01-01T00:00:02Z" },
        ],
        byEntity: new Map([["e1", [0, 1, 2]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.ok(r.issues.some(i => i.type === "duplicate_sequence"));
  });

  it("logs ordering issues and increments metrics", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 10, timestamp: "2024-01-01T00:00:00Z" },
          { seq: 5, timestamp: "2024-01-01T00:00:01Z" },
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    verifyEventOrdering(STATE, "e1");
    const store = getSchemaGuardStore(STATE);
    assert.ok(store.orderingIssues.length > 0);
    assert.ok(store.metrics.orderingIssuesDetected > 0);
  });

  it("caps orderingIssues at 5000", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 10, timestamp: "2024-01-01T00:00:00Z" },
          { seq: 5, timestamp: "2024-01-01T00:00:01Z" },
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    const store = getSchemaGuardStore(STATE);
    store.orderingIssues = new Array(5000).fill({});
    verifyEventOrdering(STATE, "e1");
    assert.ok(store.orderingIssues.length <= 2502);
  });

  it("filters out invalid indices", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 1, timestamp: "2024-01-01T00:00:00Z" },
        ],
        byEntity: new Map([["e1", [0, 99]]]), // index 99 does not exist
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.equal(r.ok, true);
    assert.equal(r.eventCount, 1);
  });

  it("returns eventCount in result", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { seq: 1, timestamp: "2024-01-01T00:00:00Z" },
          { seq: 2, timestamp: "2024-01-01T00:00:01Z" },
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.equal(r.eventCount, 2);
  });

  it("handles events without seq (undefined)", () => {
    const STATE = makeState();
    STATE.__emergent = {
      _journal: {
        events: [
          { timestamp: "2024-01-01T00:00:00Z" },
          { timestamp: "2024-01-01T00:00:01Z" },
        ],
        byEntity: new Map([["e1", [0, 1]]]),
      },
    };
    getSchemaGuardStore(STATE);
    const r = verifyEventOrdering(STATE, "e1");
    assert.equal(r.ok, true);
    // No seq regression or duplicate issues since seq is undefined
    assert.ok(!r.issues.some(i => i.type === "sequence_regression"));
    assert.ok(!r.issues.some(i => i.type === "duplicate_sequence"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. getSchemaGuardMetrics
// ═══════════════════════════════════════════════════════════════════════════════

describe("getSchemaGuardMetrics", () => {
  it("returns metrics with expected fields", () => {
    const STATE = makeState();
    const r = getSchemaGuardMetrics(STATE);
    assert.equal(r.ok, true);
    assert.ok(r.metrics);
    assert.ok(Array.isArray(r.knownVersions));
    assert.ok(r.knownVersions.includes(1));
    assert.ok(r.knownVersions.includes(2));
    assert.equal(r.currentVersion, CURRENT_DTU_SCHEMA_VERSION);
    assert.equal(typeof r.trackedDtus, "number");
    assert.equal(typeof r.migrationLog, "number");
    assert.ok(r.clockSkew);
    assert.equal(typeof r.clockSkew.maxObservedMs, "number");
    assert.equal(typeof r.clockSkew.avgMs, "number");
    assert.equal(typeof r.clockSkew.observations, "number");
    assert.equal(typeof r.orderingIssues, "number");
  });

  it("reflects accumulated metrics", () => {
    const STATE = makeState();
    validateDtuSchema(STATE, { id: "d1", title: "T", content: "C", tier: "regular" });
    migrateDtu(STATE, { id: "d2", title: "T", content: "C", tier: "regular" });
    const r = getSchemaGuardMetrics(STATE);
    assert.ok(r.metrics.totalValidations >= 1);
    assert.ok(r.metrics.totalMigrations >= 1);
  });
});
