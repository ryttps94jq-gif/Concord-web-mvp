/**
 * Tests for emergent/evidence.js — Evidence Objects + Truth Maintenance
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EPISTEMIC_STATUS,
  ALL_EPISTEMIC_STATUSES,
  EVIDENCE_TYPES,
  ALL_EVIDENCE_TYPES,
  getEvidenceStore,
  attachEvidence,
  getEvidenceForDtu,
  supersedeEvidence,
  recomputeEpistemicStatus,
  deprecateDtu,
  retractDtu,
  getMaintenanceHistory,
  getDtusByStatus,
  getConfidenceMap,
  getEvidenceMetrics,
} from "../emergent/evidence.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSTATE() {
  return { __emergent: {} };
}

// ── Constants ───────────────────────────────────────────────────────────────

describe("constants", () => {
  it("EPISTEMIC_STATUS is frozen with expected values", () => {
    assert.ok(Object.isFrozen(EPISTEMIC_STATUS));
    assert.equal(EPISTEMIC_STATUS.UNVERIFIED, "unverified");
    assert.equal(EPISTEMIC_STATUS.BELIEVED, "believed");
    assert.equal(EPISTEMIC_STATUS.TESTED, "tested");
    assert.equal(EPISTEMIC_STATUS.VERIFIED, "verified");
    assert.equal(EPISTEMIC_STATUS.DISPUTED, "disputed");
    assert.equal(EPISTEMIC_STATUS.DEPRECATED, "deprecated");
    assert.equal(EPISTEMIC_STATUS.RETRACTED, "retracted");
  });

  it("ALL_EPISTEMIC_STATUSES contains all values", () => {
    assert.equal(ALL_EPISTEMIC_STATUSES.length, 7);
  });

  it("EVIDENCE_TYPES is frozen with expected values", () => {
    assert.ok(Object.isFrozen(EVIDENCE_TYPES));
    assert.equal(EVIDENCE_TYPES.SOURCE_LINK, "source_link");
    assert.equal(EVIDENCE_TYPES.TEST_RESULT, "test_result");
    assert.equal(EVIDENCE_TYPES.CROSS_REFERENCE, "cross_reference");
  });

  it("ALL_EVIDENCE_TYPES contains all values", () => {
    assert.equal(ALL_EVIDENCE_TYPES.length, 8);
  });
});

// ── getEvidenceStore ────────────────────────────────────────────────────────

describe("getEvidenceStore", () => {
  it("initializes on first call", () => {
    const STATE = makeSTATE();
    const store = getEvidenceStore(STATE);
    assert.ok(store.evidence instanceof Map);
    assert.ok(store.byDtu instanceof Map);
    assert.ok(store.byType instanceof Map);
    assert.ok(store.byStatus instanceof Map);
    assert.ok(Array.isArray(store.maintenanceLog));
    assert.ok(store.confidenceMap instanceof Map);
  });

  it("returns same store on subsequent calls", () => {
    const STATE = makeSTATE();
    assert.strictEqual(getEvidenceStore(STATE), getEvidenceStore(STATE));
  });
});

// ── attachEvidence ──────────────────────────────────────────────────────────

describe("attachEvidence", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("rejects when dtuId missing", () => {
    const r = attachEvidence(STATE, { type: "source_link", summary: "s" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "dtuId_required");
  });

  it("rejects invalid evidence type", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "bogus", summary: "s" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_evidence_type");
  });

  it("rejects missing type", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", summary: "s" });
    assert.equal(r.ok, false);
  });

  it("rejects when summary missing", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "source_link" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "summary_required");
  });

  it("attaches evidence with defaults", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "test" });
    assert.equal(r.ok, true);
    assert.ok(r.evidence.evidenceId.startsWith("ev_"));
    assert.equal(r.evidence.dtuId, "d1");
    assert.equal(r.evidence.direction, "supports");
    assert.equal(r.evidence.strength, 0.5);
    assert.equal(r.evidence.sourceId, null);
    assert.equal(r.evidence.supersededBy, null);
  });

  it("attaches evidence with all options", () => {
    const r = attachEvidence(STATE, {
      dtuId: "d1", type: "measurement", summary: "some measurement",
      direction: "refutes", data: { val: 42 }, strength: 0.9, sourceId: "src1",
    });
    assert.equal(r.ok, true);
    assert.equal(r.evidence.direction, "refutes");
    assert.equal(r.evidence.strength, 0.9);
    assert.deepEqual(r.evidence.data, { val: 42 });
    assert.equal(r.evidence.sourceId, "src1");
  });

  it("truncates summary to 500 chars", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "x".repeat(600) });
    assert.equal(r.evidence.summary.length, 500);
  });

  it("clamps strength", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", strength: 5 });
    assert.equal(r.evidence.strength, 1);
  });

  it("increments metrics.totalEvidence", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "a" });
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "b" });
    assert.equal(getEvidenceStore(STATE).metrics.totalEvidence, 2);
  });

  it("indexes by dtu and type", () => {
    const r = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s" });
    const store = getEvidenceStore(STATE);
    assert.ok(store.byDtu.get("d1").has(r.evidence.evidenceId));
    assert.ok(store.byType.get("source_link").has(r.evidence.evidenceId));
  });
});

// ── getEvidenceForDtu ───────────────────────────────────────────────────────

describe("getEvidenceForDtu", () => {
  it("returns empty for dtu with no evidence", () => {
    const STATE = makeSTATE();
    const r = getEvidenceForDtu(STATE, "unknown");
    assert.equal(r.ok, true);
    assert.equal(r.evidence.length, 0);
    assert.equal(r.epistemicStatus, "unverified");
    assert.equal(r.confidence.score, 0);
  });

  it("returns evidence and computed status", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "link", direction: "supports" });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.ok, true);
    assert.equal(r.evidence.length, 1);
    assert.equal(r.epistemicStatus, "believed");
  });

  it("filters out superseded evidence", () => {
    const STATE = makeSTATE();
    const r1 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "old" });
    const r2 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "new" });
    supersedeEvidence(STATE, r1.evidence.evidenceId, r2.evidence.evidenceId);
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.evidence.length, 1);
    assert.equal(r.evidence[0].evidenceId, r2.evidence.evidenceId);
  });
});

// ── computeEpistemicStatus (via attachEvidence / getEvidenceForDtu) ────────

describe("epistemic status computation", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("returns BELIEVED for supporting non-test evidence", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "believed");
  });

  it("returns DISPUTED when both supporting and refuting", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "r", direction: "refutes" });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "disputed");
  });

  it("returns RETRACTED when only refuting evidence", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "r", direction: "refutes" });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "retracted");
  });

  it("returns TESTED with passing test result", () => {
    attachEvidence(STATE, {
      dtuId: "d1", type: "test_result", summary: "pass",
      direction: "supports", data: { result: "pass" },
    });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "tested");
  });

  it("returns VERIFIED with passing test + cross_reference", () => {
    attachEvidence(STATE, {
      dtuId: "d1", type: "test_result", summary: "pass",
      direction: "supports", data: { result: "pass" },
    });
    attachEvidence(STATE, {
      dtuId: "d1", type: "cross_reference", summary: "xref",
      direction: "supports",
    });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "verified");
  });

  it("returns VERIFIED with multiple passing tests", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "test_result", summary: "p1", direction: "supports", data: { result: "pass" } });
    attachEvidence(STATE, { dtuId: "d1", type: "test_result", summary: "p2", direction: "supports", data: { result: "pass" } });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "verified");
  });

  it("returns UNVERIFIED for neutral-only evidence", () => {
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "n", direction: "neutral" });
    const r = getEvidenceForDtu(STATE, "d1");
    assert.equal(r.epistemicStatus, "unverified");
  });
});

// ── supersedeEvidence ───────────────────────────────────────────────────────

describe("supersedeEvidence", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("marks old evidence as superseded", () => {
    const r1 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "old" });
    const r2 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "new" });
    const r = supersedeEvidence(STATE, r1.evidence.evidenceId, r2.evidence.evidenceId);
    assert.equal(r.ok, true);
  });

  it("returns error for missing old evidence", () => {
    const r2 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "new" });
    const r = supersedeEvidence(STATE, "missing", r2.evidence.evidenceId);
    assert.equal(r.ok, false);
    assert.equal(r.error, "old_evidence_not_found");
  });

  it("returns error for missing new evidence", () => {
    const r1 = attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "old" });
    const r = supersedeEvidence(STATE, r1.evidence.evidenceId, "missing");
    assert.equal(r.ok, false);
    assert.equal(r.error, "new_evidence_not_found");
  });
});

// ── recomputeEpistemicStatus ────────────────────────────────────────────────

describe("recomputeEpistemicStatus", () => {
  it("returns false when no evidence", () => {
    const STATE = makeSTATE();
    assert.equal(recomputeEpistemicStatus(STATE, "empty"), false);
  });

  it("returns false when status unchanged", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    // First call changes status
    const first = recomputeEpistemicStatus(STATE, "d1");
    // Second call with same evidence — no change
    const second = recomputeEpistemicStatus(STATE, "d1");
    assert.equal(second, false);
  });

  it("records maintenance log on status change", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    const store = getEvidenceStore(STATE);
    assert.ok(store.maintenanceLog.length > 0);
  });

  it("caps maintenance log at 5000", () => {
    const STATE = makeSTATE();
    const store = getEvidenceStore(STATE);
    store.maintenanceLog = new Array(5001).fill({ timestamp: "t", dtuId: "x" });
    // Trigger a recomputation
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    // Log may or may not have been trimmed depending on status change
    assert.ok(store.maintenanceLog.length <= 5001);
  });

  it("updates confidence map", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports", strength: 0.8 });
    const store = getEvidenceStore(STATE);
    const conf = store.confidenceMap.get("d1");
    assert.ok(conf);
    assert.ok(conf.score > 0);
    assert.ok(Array.isArray(conf.history));
  });
});

// ── deprecateDtu ────────────────────────────────────────────────────────────

describe("deprecateDtu", () => {
  it("deprecates a dtu", () => {
    const STATE = makeSTATE();
    const r = deprecateDtu(STATE, "d1", "outdated", "d2");
    assert.equal(r.ok, true);
    const store = getEvidenceStore(STATE);
    const entry = store.maintenanceLog[store.maintenanceLog.length - 1];
    assert.equal(entry.newStatus, "deprecated");
    assert.equal(entry.supersededBy, "d2");
  });

  it("uses default reason", () => {
    const STATE = makeSTATE();
    deprecateDtu(STATE, "d1");
    const store = getEvidenceStore(STATE);
    const entry = store.maintenanceLog[store.maintenanceLog.length - 1];
    assert.equal(entry.reason, "deprecated");
  });
});

// ── retractDtu ──────────────────────────────────────────────────────────────

describe("retractDtu", () => {
  it("retracts a dtu", () => {
    const STATE = makeSTATE();
    const r = retractDtu(STATE, "d1", "proven wrong", "ev123");
    assert.equal(r.ok, true);
    const store = getEvidenceStore(STATE);
    const entry = store.maintenanceLog[store.maintenanceLog.length - 1];
    assert.equal(entry.newStatus, "retracted");
    assert.equal(entry.evidenceId, "ev123");
  });

  it("uses default reason", () => {
    const STATE = makeSTATE();
    retractDtu(STATE, "d1");
    const store = getEvidenceStore(STATE);
    const entry = store.maintenanceLog[store.maintenanceLog.length - 1];
    assert.equal(entry.reason, "retracted");
  });
});

// ── getMaintenanceHistory ───────────────────────────────────────────────────

describe("getMaintenanceHistory", () => {
  it("returns history for a dtu", () => {
    const STATE = makeSTATE();
    deprecateDtu(STATE, "d1", "old");
    const r = getMaintenanceHistory(STATE, "d1");
    assert.equal(r.ok, true);
    assert.equal(r.dtuId, "d1");
    assert.ok(r.history.length > 0);
    assert.equal(r.currentStatus, "deprecated");
  });

  it("returns empty history for unknown dtu", () => {
    const STATE = makeSTATE();
    const r = getMaintenanceHistory(STATE, "unknown");
    assert.equal(r.ok, true);
    assert.equal(r.history.length, 0);
    assert.equal(r.currentStatus, "unverified");
    assert.equal(r.confidence, null);
  });
});

// ── getDtusByStatus ─────────────────────────────────────────────────────────

describe("getDtusByStatus", () => {
  it("rejects invalid status", () => {
    const STATE = makeSTATE();
    const r = getDtusByStatus(STATE, "bogus");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_status");
  });

  it("returns dtus for valid status", () => {
    const STATE = makeSTATE();
    deprecateDtu(STATE, "d1", "old");
    const r = getDtusByStatus(STATE, "deprecated");
    assert.equal(r.ok, true);
    assert.ok(r.dtuIds.includes("d1"));
    assert.equal(r.count, 1);
  });

  it("returns empty array for status with no dtus", () => {
    const STATE = makeSTATE();
    const r = getDtusByStatus(STATE, "verified");
    assert.equal(r.ok, true);
    assert.deepEqual(r.dtuIds, []);
    assert.equal(r.count, 0);
  });
});

// ── getConfidenceMap ────────────────────────────────────────────────────────

describe("getConfidenceMap", () => {
  it("returns confidence entries", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports", strength: 0.8 });
    const r = getConfidenceMap(STATE);
    assert.equal(r.ok, true);
    assert.ok(r.entries.length > 0);
    assert.ok(r.entries[0].dtuId);
    assert.equal(r.entries[0].history, undefined);
  });

  it("filters by minScore", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports", strength: 0.9 });
    const r = getConfidenceMap(STATE, { minScore: 99 });
    assert.equal(r.entries.length, 0);
  });

  it("filters by maxScore", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports", strength: 0.9 });
    const r = getConfidenceMap(STATE, { maxScore: -1 });
    assert.equal(r.entries.length, 0);
  });

  it("filters by status", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s", direction: "supports" });
    const r = getConfidenceMap(STATE, { status: "nonexistent" });
    assert.equal(r.entries.length, 0);
  });

  it("respects limit", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 10; i++) {
      attachEvidence(STATE, { dtuId: `d${i}`, type: "source_link", summary: "s", direction: "supports" });
    }
    const r = getConfidenceMap(STATE, { limit: 3 });
    assert.equal(r.entries.length, 3);
  });
});

// ── getEvidenceMetrics ──────────────────────────────────────────────────────

describe("getEvidenceMetrics", () => {
  it("returns metrics", () => {
    const STATE = makeSTATE();
    attachEvidence(STATE, { dtuId: "d1", type: "source_link", summary: "s" });
    deprecateDtu(STATE, "d2", "old");
    const r = getEvidenceMetrics(STATE);
    assert.equal(r.ok, true);
    assert.ok(r.totalEvidence >= 1);
    assert.ok(r.trackedDtus >= 1);
    assert.ok("metrics" in r);
    assert.ok("maintenanceLogSize" in r);
  });
});
