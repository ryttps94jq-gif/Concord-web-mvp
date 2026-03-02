/**
 * Districts — Comprehensive Test Suite
 *
 * Covers: DISTRICTS, ALL_DISTRICTS, moveEmergent, suggestDistrict,
 * selectDialogueParticipants, getDistrictCensus.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  DISTRICTS,
  ALL_DISTRICTS,
  moveEmergent,
  suggestDistrict,
  selectDialogueParticipants,
  getDistrictCensus,
} from "../emergent/districts.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEmergentState(emergents = []) {
  const map = new Map();
  for (const em of emergents) {
    map.set(em.id, em);
  }
  return { emergents: map };
}

function makeEmergent(overrides = {}) {
  return {
    id: overrides.id || `em_${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name || "TestEmergent",
    role: overrides.role || "builder",
    active: overrides.active !== undefined ? overrides.active : true,
    district: overrides.district || undefined,
    districtHistory: overrides.districtHistory || undefined,
    districtAffinity: overrides.districtAffinity || undefined,
    instanceScope: overrides.instanceScope || "local",
    noveltyRatio: overrides.noveltyRatio,
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

describe("DISTRICTS constant", () => {
  it("defines all 7 districts", () => {
    assert.equal(Object.keys(DISTRICTS).length, 7);
    assert.ok(DISTRICTS.commons);
    assert.ok(DISTRICTS.observatory);
    assert.ok(DISTRICTS.forge);
    assert.ok(DISTRICTS.archive);
    assert.ok(DISTRICTS.garden);
    assert.ok(DISTRICTS.gate);
    assert.ok(DISTRICTS.nursery);
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(DISTRICTS));
  });

  it("each district has name, purpose, workingSetBias", () => {
    for (const [key, d] of Object.entries(DISTRICTS)) {
      assert.ok(d.name, `${key} missing name`);
      assert.ok(d.purpose, `${key} missing purpose`);
      assert.ok(d.workingSetBias, `${key} missing workingSetBias`);
      assert.equal(typeof d.dialoguePriority, "number");
    }
  });
});

describe("ALL_DISTRICTS constant", () => {
  it("contains all 7 district keys", () => {
    assert.equal(ALL_DISTRICTS.length, 7);
    assert.ok(ALL_DISTRICTS.includes("commons"));
    assert.ok(ALL_DISTRICTS.includes("nursery"));
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(ALL_DISTRICTS));
  });
});

// ── moveEmergent ────────────────────────────────────────────────────────────

describe("moveEmergent", () => {
  it("moves an emergent to a valid district", () => {
    const em = makeEmergent({ district: "commons" });
    const state = makeEmergentState([em]);

    const r = moveEmergent(state, em.id, "forge", "testing plugins");
    assert.ok(r.ok);
    assert.equal(r.previous, "commons");
    assert.equal(r.current, "forge");
    assert.ok(r.moved);
    assert.equal(em.district, "forge");
  });

  it("defaults previous to commons when no district set", () => {
    const em = makeEmergent({});
    delete em.district;
    const state = makeEmergentState([em]);

    const r = moveEmergent(state, em.id, "archive");
    assert.ok(r.ok);
    assert.equal(r.previous, "commons");
  });

  it("returns moved=false for same district", () => {
    const em = makeEmergent({ district: "gate" });
    const state = makeEmergentState([em]);

    const r = moveEmergent(state, em.id, "gate");
    assert.ok(r.ok);
    assert.equal(r.moved, false);
  });

  it("records district history", () => {
    const em = makeEmergent({ district: "commons" });
    const state = makeEmergentState([em]);

    moveEmergent(state, em.id, "forge", "first move");
    moveEmergent(state, em.id, "archive", "second move");

    assert.equal(em.districtHistory.length, 2);
    assert.equal(em.districtHistory[0].from, "commons");
    assert.equal(em.districtHistory[0].to, "forge");
    assert.equal(em.districtHistory[1].from, "forge");
    assert.equal(em.districtHistory[1].to, "archive");
  });

  it("caps history at 100", () => {
    const em = makeEmergent({ district: "commons" });
    const state = makeEmergentState([em]);

    for (let i = 0; i < 110; i++) {
      const target = i % 2 === 0 ? "forge" : "commons";
      moveEmergent(state, em.id, target, `move ${i}`);
    }
    assert.ok(em.districtHistory.length <= 100);
  });

  it("updates district affinity", () => {
    const em = makeEmergent({ district: "commons" });
    const state = makeEmergentState([em]);

    moveEmergent(state, em.id, "forge");
    moveEmergent(state, em.id, "commons");
    moveEmergent(state, em.id, "forge");

    assert.equal(em.districtAffinity.forge, 2);
    assert.equal(em.districtAffinity.commons, 1);
  });

  it("returns error for unknown emergent", () => {
    const state = makeEmergentState([]);
    const r = moveEmergent(state, "nope", "forge");
    assert.equal(r.ok, false);
    assert.equal(r.error, "not_found");
  });

  it("returns error for invalid district", () => {
    const em = makeEmergent({});
    const state = makeEmergentState([em]);
    const r = moveEmergent(state, em.id, "nonexistent");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_district");
  });

  it("handles reason=null/undefined", () => {
    const em = makeEmergent({ district: "commons" });
    const state = makeEmergentState([em]);
    moveEmergent(state, em.id, "forge");
    assert.equal(em.districtHistory[0].reason, null);
  });
});

// ── suggestDistrict ─────────────────────────────────────────────────────────

describe("suggestDistrict", () => {
  it("returns suggested district and scores", () => {
    const em = makeEmergent({ role: "builder" });
    const r = suggestDistrict(em, {});
    assert.ok(r.suggested);
    assert.ok(r.scores);
    assert.equal(typeof r.reason, "string");
    assert.ok(ALL_DISTRICTS.includes(r.suggested));
  });

  it("boosts gate when pendingGovernanceCount > 5", () => {
    const em = makeEmergent({ role: "validator" });
    const r = suggestDistrict(em, { pendingGovernanceCount: 10 });
    assert.ok(r.scores.gate >= 3);
  });

  it("boosts forge when capabilityGapCount > 0", () => {
    const em = makeEmergent({ role: "builder" });
    const r = suggestDistrict(em, { capabilityGapCount: 5 });
    assert.ok(r.scores.forge >= 2);
  });

  it("boosts garden when unpromotedShadowCount > 50", () => {
    const em = makeEmergent({});
    const r = suggestDistrict(em, { unpromotedShadowCount: 100 });
    assert.ok(r.scores.garden >= 2);
  });

  it("boosts archive when emergent noveltyRatio < 0.3", () => {
    const em = makeEmergent({ noveltyRatio: 0.1 });
    const r = suggestDistrict(em, {});
    assert.ok(r.scores.archive >= 3);
  });

  it("boosts nursery when nearThresholdCount > 0", () => {
    const em = makeEmergent({});
    const r = suggestDistrict(em, { nearThresholdCount: 3 });
    assert.ok(r.scores.nursery >= 2);
  });

  it("boosts observatory when lastIngestAge > 86400000", () => {
    const em = makeEmergent({});
    const r = suggestDistrict(em, { lastIngestAge: 100_000_000 });
    assert.ok(r.scores.observatory >= 2);
  });

  it("boosts commons when lattice state is empty", () => {
    const em = makeEmergent({});
    const r = suggestDistrict(em, {});
    assert.ok(r.scores.commons >= 1);
  });

  it("considers district affinity", () => {
    const em = makeEmergent({ districtAffinity: { forge: 20 } });
    const r = suggestDistrict(em, {});
    // affinity capped at 1 via Math.min(20*0.1, 1)
    assert.ok(r.scores.forge >= 1);
  });

  it("gives role affinity bonus", () => {
    const em = makeEmergent({ role: "guardian" });
    const r = suggestDistrict(em, {});
    assert.ok(r.scores.gate >= 2);
  });

  it("handles undefined districtAffinity", () => {
    const em = makeEmergent({});
    delete em.districtAffinity;
    const r = suggestDistrict(em, {});
    assert.ok(r.suggested);
  });
});

// ── selectDialogueParticipants ──────────────────────────────────────────────

describe("selectDialogueParticipants", () => {
  const emergents = [
    makeEmergent({ id: "e1", district: "gate" }),
    makeEmergent({ id: "e2", district: "commons" }),
    makeEmergent({ id: "e3", district: "forge" }),
    makeEmergent({ id: "e4", district: "archive" }),
    makeEmergent({ id: "e5", district: "garden" }),
    makeEmergent({ id: "e6" }), // no district -> defaults to commons
  ];

  it("prioritizes gate for governance sessions", () => {
    const r = selectDialogueParticipants(emergents, "governance");
    assert.equal(r[0].id, "e1"); // gate first
  });

  it("prioritizes gate for global_governance sessions", () => {
    const r = selectDialogueParticipants(emergents, "global_governance");
    assert.equal(r[0].id, "e1");
  });

  it("prioritizes commons+forge for synthesis sessions", () => {
    const r = selectDialogueParticipants(emergents, "synthesis");
    // commons first (e2, e6), then forge (e3)
    const firstIds = r.slice(0, 3).map(e => e.id);
    assert.ok(firstIds.includes("e2"));
    assert.ok(firstIds.includes("e3"));
  });

  it("prioritizes commons+forge for global_synthesis sessions", () => {
    const r = selectDialogueParticipants(emergents, "global_synthesis");
    const ids = r.map(e => e.id);
    assert.ok(ids.indexOf("e2") < ids.indexOf("e1")); // commons before gate
  });

  it("prioritizes archive+garden for meta_derivation sessions", () => {
    const r = selectDialogueParticipants(emergents, "meta_derivation");
    const firstIds = r.slice(0, 2).map(e => e.id);
    assert.ok(firstIds.includes("e4")); // archive
    assert.ok(firstIds.includes("e5")); // garden
  });

  it("returns original order for unknown session types", () => {
    const r = selectDialogueParticipants(emergents, "unknown_type");
    assert.equal(r.length, emergents.length);
    assert.equal(r[0].id, emergents[0].id);
  });
});

// ── getDistrictCensus ───────────────────────────────────────────────────────

describe("getDistrictCensus", () => {
  it("groups active emergents by district", () => {
    const state = makeEmergentState([
      makeEmergent({ id: "e1", district: "gate", active: true, role: "critic" }),
      makeEmergent({ id: "e2", district: "forge", active: true, role: "builder" }),
      makeEmergent({ id: "e3", active: true, role: "synthesizer" }), // no district -> commons
      makeEmergent({ id: "e4", district: "gate", active: false }), // inactive - excluded
    ]);

    const census = getDistrictCensus(state);

    assert.equal(census.gate.length, 1);
    assert.equal(census.gate[0].id, "e1");
    assert.equal(census.forge.length, 1);
    assert.equal(census.commons.length, 1);
    assert.equal(census.commons[0].id, "e3");
    assert.equal(census.archive.length, 0);
  });

  it("returns all district keys even when empty", () => {
    const state = makeEmergentState([]);
    const census = getDistrictCensus(state);
    for (const key of ALL_DISTRICTS) {
      assert.ok(Array.isArray(census[key]));
    }
  });

  it("includes instanceScope in census entries", () => {
    const state = makeEmergentState([
      makeEmergent({ id: "e1", district: "commons", active: true, instanceScope: "global" }),
    ]);
    const census = getDistrictCensus(state);
    assert.equal(census.commons[0].instanceScope, "global");
  });

  it("defaults instanceScope to 'local'", () => {
    const em = makeEmergent({ id: "e1", district: "commons", active: true });
    delete em.instanceScope;
    const state = makeEmergentState([em]);
    const census = getDistrictCensus(state);
    assert.equal(census.commons[0].instanceScope, "local");
  });
});
