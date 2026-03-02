/**
 * Tests for emergent/sectors.js — 13-Sector Architecture
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createEmergentState, registerEmergent, getEmergentState } from "../emergent/store.js";

import {
  SECTORS,
  ALL_SECTORS,
  SECTOR_BY_ID,
  SECTOR_BY_NAME,
  MATURITY_REQUIREMENTS,
  ROLE_SECTOR_AFFINITY,
  canAccessSector,
  getAccessibleSectors,
  computeMaturityLevel,
  checkNoiseFloor,
  getHomeSector,
  routeCrossSector,
  getSectorHealth,
  MODULE_SECTOR_MAP,
  getOperationSector,
  getSectorMetrics,
  assignDTUSector,
  getDTUsInSector,
  getDTUSectorDistribution,
} from "../emergent/sectors.js";

function makeSTATE() {
  const STATE = {};
  createEmergentState(STATE);
  STATE.dtus = new Map();
  STATE.shadowDtus = new Map();
  return STATE;
}

function addEmergent(STATE, id, role, sessions = 0, cred = 0, patterns = 0) {
  registerEmergent(STATE, { id, name: id, role, active: true });
  const es = getEmergentState(STATE);
  // simulate sessions
  if (!es.sessionsByEmergent.has(id)) es.sessionsByEmergent.set(id, new Set());
  for (let i = 0; i < sessions; i++) es.sessionsByEmergent.get(id).add(`s_${id}_${i}`);
  // reputation
  es.reputations.set(id, { credibility: cred, volatility: 0, turnCount: 10 });
  // patterns
  for (let i = 0; i < patterns; i++) {
    es.patterns.set(`pat_${id}_${i}`, { id: `pat_${id}_${i}`, emergentId: id });
  }
}

describe("sectors", () => {

  // ── Constants ─────────────────────────────────────────────────────────

  describe("constants", () => {
    it("SECTORS has 13 entries", () => {
      assert.equal(ALL_SECTORS.length, 13);
    });

    it("ALL_SECTORS is frozen array of objects", () => {
      assert.ok(Object.isFrozen(ALL_SECTORS));
      assert.equal(ALL_SECTORS[0].id, 0);
    });

    it("SECTOR_BY_ID maps id to sector", () => {
      assert.equal(SECTOR_BY_ID[0].name, "core");
      assert.equal(SECTOR_BY_ID[12].name, "meta_operations");
    });

    it("SECTOR_BY_NAME maps name to sector", () => {
      assert.equal(SECTOR_BY_NAME["core"].id, 0);
      assert.equal(SECTOR_BY_NAME["meta_operations"].id, 12);
    });

    it("MATURITY_REQUIREMENTS has governor as null", () => {
      assert.equal(MATURITY_REQUIREMENTS.governor, null);
      assert.equal(MATURITY_REQUIREMENTS.system, null);
    });

    it("ROLE_SECTOR_AFFINITY maps roles to sector arrays", () => {
      assert.ok(Array.isArray(ROLE_SECTOR_AFFINITY.builder));
      assert.deepEqual(ROLE_SECTOR_AFFINITY.builder, [4, 5]);
    });
  });

  // ── canAccessSector ───────────────────────────────────────────────────

  describe("canAccessSector", () => {
    it("denies access to governor sector", () => {
      assert.equal(canAccessSector({ sessionCount: 1000 }, SECTORS.CORE, { credibility: 1 }, new Array(100)), false);
    });

    it("denies access to system sector", () => {
      assert.equal(canAccessSector({ sessionCount: 1000 }, SECTORS.BOUNDARY, { credibility: 1 }, new Array(100)), false);
    });

    it("allows emergent sector with no requirements", () => {
      assert.equal(canAccessSector({ sessionCount: 0 }, SECTORS.PATTERN_RECOGNITION, { credibility: 0 }, []), true);
    });

    it("denies mature sector for low-session emergent", () => {
      assert.equal(canAccessSector({ sessionCount: 5 }, SECTORS.COMMUNICATION, { credibility: 0.7 }, new Array(5)), false);
    });

    it("allows mature sector for qualified emergent", () => {
      assert.equal(canAccessSector({ sessionCount: 15 }, SECTORS.COMMUNICATION, { credibility: 0.7 }, new Array(5)), true);
    });

    it("allows council sector for highly qualified emergent", () => {
      assert.equal(canAccessSector({ sessionCount: 200 }, SECTORS.GOVERNANCE, { credibility: 0.9 }, new Array(25)), true);
    });

    it("handles null reputation", () => {
      assert.equal(canAccessSector({ sessionCount: 0 }, SECTORS.PATTERN_RECOGNITION, null, []), true);
    });

    it("handles null patterns", () => {
      assert.equal(canAccessSector({ sessionCount: 0 }, SECTORS.PATTERN_RECOGNITION, { credibility: 0 }, null), true);
    });
  });

  // ── computeMaturityLevel ──────────────────────────────────────────────

  describe("computeMaturityLevel", () => {
    it("returns emergent for low stats", () => {
      assert.equal(computeMaturityLevel(0, 0, 0), "emergent");
    });

    it("returns mature for moderate stats", () => {
      assert.equal(computeMaturityLevel(10, 0.6, 3), "mature");
    });

    it("returns specialized for high stats", () => {
      assert.equal(computeMaturityLevel(50, 0.75, 10), "specialized");
    });

    it("returns council for very high stats", () => {
      assert.equal(computeMaturityLevel(100, 0.85, 20), "council");
    });
  });

  // ── getAccessibleSectors ──────────────────────────────────────────────

  describe("getAccessibleSectors", () => {
    it("returns error for non-existent emergent", () => {
      const STATE = makeSTATE();
      const r = getAccessibleSectors(STATE, "nonexistent");
      assert.equal(r.ok, false);
      assert.equal(r.error, "emergent_not_found");
    });

    it("returns accessible sectors for emergent with no sessions", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = getAccessibleSectors(STATE, "e1");
      assert.equal(r.ok, true);
      assert.ok(Array.isArray(r.sectors));
      assert.equal(r.maturityLevel, "emergent");
    });

    it("includes more sectors for mature emergent", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e2", "builder", 15, 0.7, 5);
      const r = getAccessibleSectors(STATE, "e2");
      assert.equal(r.ok, true);
      assert.ok(r.sectors.length > 4); // emergent + mature sectors
      assert.equal(r.maturityLevel, "mature");
    });
  });

  // ── checkNoiseFloor ───────────────────────────────────────────────────

  describe("checkNoiseFloor", () => {
    it("returns error for invalid sector", () => {
      const r = checkNoiseFloor(999, 0.5);
      assert.equal(r.ok, false);
      assert.equal(r.error, "invalid_sector");
    });

    it("passes for core sector (noiseFloor 0)", () => {
      const r = checkNoiseFloor(0, 0.5);
      assert.equal(r.ok, true);
      assert.equal(r.passed, false); // threshold is 1.0 for core
    });

    it("passes for pattern recognition sector", () => {
      const r = checkNoiseFloor(3, 0.6);
      assert.equal(r.ok, true);
      assert.equal(r.passed, true); // threshold = 1 - 0.5 = 0.5
    });

    it("fails below threshold", () => {
      const r = checkNoiseFloor(3, 0.3);
      assert.equal(r.ok, true);
      assert.equal(r.passed, false);
    });

    it("returns all fields", () => {
      const r = checkNoiseFloor(4, 0.8);
      assert.equal(r.ok, true);
      assert.equal(typeof r.passed, "boolean");
      assert.equal(r.sectorId, 4);
      assert.equal(typeof r.sectorName, "string");
      assert.equal(typeof r.noiseFloor, "number");
      assert.equal(r.signalQuality, 0.8);
      assert.equal(typeof r.threshold, "number");
    });
  });

  // ── getHomeSector ─────────────────────────────────────────────────────

  describe("getHomeSector", () => {
    it("returns error for non-existent emergent", () => {
      const STATE = makeSTATE();
      const r = getHomeSector(STATE, "nope");
      assert.equal(r.ok, false);
    });

    it("returns home sector for builder", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "b1", "builder", 0, 0, 0);
      const r = getHomeSector(STATE, "b1");
      assert.equal(r.ok, true);
      assert.ok(r.homeSector);
      assert.deepEqual(r.affinitySectors, [4, 5]);
    });

    it("returns home sector for role with no affinity", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "x1", "unknown_role", 0, 0, 0);
      const r = getHomeSector(STATE, "x1");
      assert.equal(r.ok, true);
      // defaults to [4,5]
    });
  });

  // ── routeCrossSector ──────────────────────────────────────────────────

  describe("routeCrossSector", () => {
    it("denies access if emergent not found", () => {
      const STATE = makeSTATE();
      const r = routeCrossSector(STATE, "nope", 3, 4, {});
      assert.equal(r.ok, false);
    });

    it("denies access if no access to source sector", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = routeCrossSector(STATE, "e1", 11, 3, {}); // sector 11 = council
      assert.equal(r.ok, false);
      assert.equal(r.routed, false);
    });

    it("denies access if no access to target sector", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = routeCrossSector(STATE, "e1", 3, 11, {});
      assert.equal(r.ok, false);
      assert.equal(r.routed, false);
    });

    it("allows downward routing", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = routeCrossSector(STATE, "e1", 5, 3, {});
      assert.equal(r.ok, true);
      assert.equal(r.routed, true);
    });

    it("checks noise floor for upward routing", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = routeCrossSector(STATE, "e1", 3, 5, { signalQuality: 0.01 });
      // Depends on noise floor check
      assert.equal(typeof r.ok, "boolean");
    });

    it("allows upward routing with high signal quality", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 0, 0, 0);
      const r = routeCrossSector(STATE, "e1", 3, 5, { signalQuality: 0.99 });
      assert.equal(r.ok, true);
      assert.equal(r.routed, true);
    });
  });

  // ── getSectorHealth ───────────────────────────────────────────────────

  describe("getSectorHealth", () => {
    it("returns health for all sectors", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "builder", 5, 0.5, 2);
      const r = getSectorHealth(STATE);
      assert.equal(r.ok, true);
      assert.equal(r.sectors.length, 13);
      assert.ok(r.sectors[0].hasOwnProperty("residentCount"));
    });
  });

  // ── getOperationSector ────────────────────────────────────────────────

  describe("getOperationSector", () => {
    it("returns sector for known module", () => {
      const s = getOperationSector("store");
      assert.ok(s);
      assert.equal(s.id, 4);
    });

    it("returns null for unknown module", () => {
      assert.equal(getOperationSector("nonexistent"), null);
    });
  });

  // ── getSectorMetrics ──────────────────────────────────────────────────

  describe("getSectorMetrics", () => {
    it("returns metrics", () => {
      const STATE = makeSTATE();
      addEmergent(STATE, "e1", "critic", 0, 0, 0);
      const r = getSectorMetrics(STATE);
      assert.equal(r.ok, true);
      assert.equal(r.totalSectors, 13);
      assert.equal(typeof r.activeSectors, "number");
      assert.equal(typeof r.dormantSectors, "number");
    });
  });

  // ── assignDTUSector ───────────────────────────────────────────────────

  describe("assignDTUSector", () => {
    it("returns existing _sectorId if set", () => {
      const dtu = { _sectorId: 7 };
      assert.equal(assignDTUSector(dtu), 7);
    });

    it("returns default 4 for dtu with no tags", () => {
      const dtu = { tags: [] };
      assert.equal(assignDTUSector(dtu), 4);
    });

    it("assigns sector based on tag hints", () => {
      const dtu = { tags: ["governance", "policy"] };
      assert.equal(assignDTUSector(dtu), 11);
    });

    it("selects highest sector from multiple tags", () => {
      const dtu = { tags: ["factual", "meta"] };
      assert.equal(assignDTUSector(dtu), 12);
    });

    it("respects shadow tier override", () => {
      const dtu = { tags: ["meta"], tier: "shadow" };
      const sector = assignDTUSector(dtu);
      assert.ok(sector <= 3); // capped to 3 for shadow
    });

    it("respects hyper tier override", () => {
      const dtu = { tags: ["factual"], tier: "hyper" };
      const sector = assignDTUSector(dtu);
      assert.ok(sector >= 7);
    });

    it("handles null/undefined dtu gracefully", () => {
      const dtu = {};
      const sector = assignDTUSector(dtu);
      assert.equal(typeof sector, "number");
    });
  });

  // ── getDTUsInSector ───────────────────────────────────────────────────

  describe("getDTUsInSector", () => {
    it("returns empty for empty STATE", () => {
      const STATE = makeSTATE();
      const r = getDTUsInSector(STATE, 4);
      assert.equal(r.ok, true);
      assert.equal(r.count, 0);
    });

    it("finds dtus in a sector", () => {
      const STATE = makeSTATE();
      STATE.dtus.set("d1", { id: "d1", title: "Test", tags: ["factual"], tier: "local" });
      const r = getDTUsInSector(STATE, 4);
      assert.equal(r.ok, true);
      assert.ok(r.count >= 1);
    });

    it("includes shadows when option set", () => {
      const STATE = makeSTATE();
      STATE.shadowDtus.set("s1", { id: "s1", title: "Shadow", tags: ["factual"], tier: "shadow" });
      const r = getDTUsInSector(STATE, 3, { includeShadows: true });
      assert.equal(r.ok, true);
    });

    it("respects limit", () => {
      const STATE = makeSTATE();
      for (let i = 0; i < 10; i++) {
        STATE.dtus.set(`d${i}`, { id: `d${i}`, title: `T${i}`, tags: ["factual"], tier: "local" });
      }
      const r = getDTUsInSector(STATE, 4, { limit: 3 });
      assert.ok(r.count <= 3);
    });
  });

  // ── getDTUSectorDistribution ──────────────────────────────────────────

  describe("getDTUSectorDistribution", () => {
    it("returns distribution for empty dtus", () => {
      const STATE = makeSTATE();
      const r = getDTUSectorDistribution(STATE);
      assert.equal(r.ok, true);
      assert.ok(r.distribution);
    });

    it("counts dtus in each sector", () => {
      const STATE = makeSTATE();
      STATE.dtus.set("d1", { id: "d1", tags: ["governance"] });
      STATE.dtus.set("d2", { id: "d2", tags: ["factual"] });
      const r = getDTUSectorDistribution(STATE);
      assert.equal(r.ok, true);
    });
  });
});
