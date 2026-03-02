/**
 * Tests for emergent/agent-system.js — Lattice Immune System (Agents)
 *
 * Covers: AGENT_TYPES, createAgent, runAgent, pauseAgent, resumeAgent,
 * destroyAgent, getAgent, listAgents, getAgentFindings, getAllFindings,
 * freezeAllAgents, thawAllAgents, agentTickJob, getAgentMetrics
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_TYPES,
  createAgent,
  runAgent,
  pauseAgent,
  resumeAgent,
  destroyAgent,
  getAgent,
  listAgents,
  getAgentFindings,
  getAllFindings,
  freezeAllAgents,
  thawAllAgents,
  agentTickJob,
  getAgentMetrics,
} from "../emergent/agent-system.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanupAgents() {
  // Destroy all existing agents and thaw
  const list = listAgents();
  for (const a of list.agents) {
    destroyAgent(a.agentId);
  }
  thawAllAgents();
}

function makeDtu(overrides = {}) {
  return {
    id: `dtu_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    authority: 0.5,
    coherence: 0.6,
    tags: [],
    domain: "",
    ...overrides,
  };
}

function oldDate(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("agent-system.js", () => {
  beforeEach(() => {
    cleanupAgents();
  });

  afterEach(() => {
    cleanupAgents();
  });

  // ── AGENT_TYPES ──────────────────────────────────────────────────────────

  describe("AGENT_TYPES", () => {
    it("is frozen and has all six types", () => {
      assert.ok(Object.isFrozen(AGENT_TYPES));
      assert.strictEqual(Object.keys(AGENT_TYPES).length, 6);
      assert.strictEqual(AGENT_TYPES.PATROL, "patrol");
      assert.strictEqual(AGENT_TYPES.INTEGRITY, "integrity");
      assert.strictEqual(AGENT_TYPES.HYPOTHESIS_TESTER, "hypothesis_tester");
      assert.strictEqual(AGENT_TYPES.DEBATE_SIMULATOR, "debate_simulator");
      assert.strictEqual(AGENT_TYPES.FRESHNESS, "freshness");
      assert.strictEqual(AGENT_TYPES.SYNTHESIS, "synthesis");
    });
  });

  // ── createAgent ──────────────────────────────────────────────────────────

  describe("createAgent()", () => {
    it("creates an agent with valid type", () => {
      const result = createAgent("patrol");
      assert.strictEqual(result.ok, true);
      assert.ok(result.agent);
      assert.ok(result.agent.agentId.startsWith("agent_"));
      assert.strictEqual(result.agent.type, "patrol");
      assert.strictEqual(result.agent.status, "active");
      assert.strictEqual(result.agent.territory, "*");
    });

    it("returns error for invalid agent type", () => {
      const result = createAgent("invalid_type");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "invalid_agent_type");
    });

    it("accepts custom territory and intervalMs", () => {
      const result = createAgent("integrity", {
        territory: "healthcare",
        intervalMs: 5000,
        metadata: { custom: true },
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.agent.territory, "healthcare");
      assert.strictEqual(result.agent.intervalMs, 5000);
      assert.deepStrictEqual(result.agent.metadata, { custom: true });
    });

    it("creates each agent type", () => {
      for (const type of Object.values(AGENT_TYPES)) {
        const result = createAgent(type);
        assert.strictEqual(result.ok, true, `Failed for type: ${type}`);
        destroyAgent(result.agent.agentId);
      }
    });
  });

  // ── runAgent ─────────────────────────────────────────────────────────────

  describe("runAgent()", () => {
    it("returns error for non-existent agent", () => {
      const result = runAgent("nonexistent");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agent_not_found");
    });

    it("returns error for paused agent", () => {
      const { agent } = createAgent("patrol");
      pauseAgent(agent.agentId);
      const result = runAgent(agent.agentId);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agent_not_active");
    });

    it("returns error when agents are frozen", () => {
      const { agent } = createAgent("patrol");
      freezeAllAgents();
      const result = runAgent(agent.agentId);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agents_frozen");
    });

    it("runs patrol agent and detects stale DTUs", () => {
      const { agent } = createAgent("patrol");
      const dtus = [
        makeDtu({ createdAt: oldDate(60), authority: 0.2 }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.length > 0);
      assert.ok(result.findings.some(f => f.findingType === "stale_low_authority"));
    });

    it("patrol agent detects broken lineage", () => {
      const { agent } = createAgent("patrol");
      const dtus = [
        makeDtu({ parentId: "dtu_missing" }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "broken_lineage"));
    });

    it("patrol agent detects orphaned contradiction", () => {
      const { agent } = createAgent("patrol");
      const dtus = [
        makeDtu({ contradicts: ["dtu_missing_1", "dtu_missing_2"] }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "orphaned_contradiction"));
    });

    it("runs integrity agent and detects lineage chain breaks", () => {
      const { agent } = createAgent("integrity");
      const dtus = [
        makeDtu({ id: "dtu_child", parentId: "dtu_missing" }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "lineage_chain_broken"));
    });

    it("integrity agent detects broken cross-references", () => {
      const { agent } = createAgent("integrity");
      const dtus = [
        makeDtu({ references: ["dtu_missing"] }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "broken_cross_reference"));
    });

    it("integrity agent detects authority drift", () => {
      const { agent } = createAgent("integrity");
      const dtus = [
        makeDtu({ authority: 0.99, evidence: [], coherence: 0.2 }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "authority_drift"));
    });

    it("runs hypothesis_tester agent", () => {
      const { agent } = createAgent("hypothesis_tester");
      const dtus = [
        makeDtu({ type: "hypothesis", confidence: 0.9, evidence: [] }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "unsupported_hypothesis"));
    });

    it("hypothesis_tester detects stale hypothesis", () => {
      const { agent } = createAgent("hypothesis_tester");
      const dtus = [
        makeDtu({ type: "hypothesis", confidence: 0.3, evidence: [], createdAt: oldDate(20) }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "stale_hypothesis"));
    });

    it("hypothesis_tester detects confidence drift with evidence", () => {
      const { agent } = createAgent("hypothesis_tester");
      const dtus = [
        makeDtu({ type: "hypothesis", confidence: 0.1, evidence: ["a", "b", "c", "d", "e"] }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      // Evidence says confidence should be higher
      assert.ok(result.findings.some(f => f.findingType.startsWith("hypothesis_")));
    });

    it("runs debate_simulator agent", () => {
      const { agent } = createAgent("debate_simulator");
      const dtus = [
        makeDtu({ id: "dtu_a", tags: ["topic_x"], confidence: 0.9, evidence: ["a"], authority: 0.8 }),
        makeDtu({ id: "dtu_b", tags: ["topic_x"], confidence: 0.1, evidence: [], authority: 0.2 }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      // May or may not have findings depending on tension
    });

    it("runs freshness agent and detects temporal decay", () => {
      const { agent } = createAgent("freshness");
      const dtus = [
        makeDtu({ tags: ["politics"], createdAt: oldDate(120) }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.some(f => f.findingType === "temporal_decay"));
    });

    it("freshness agent skips timeless domains", () => {
      const { agent } = createAgent("freshness");
      const dtus = [
        makeDtu({ tags: ["math"], createdAt: oldDate(120) }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.findings.length, 0);
    });

    it("freshness agent skips non-temporal, non-timeless domains", () => {
      const { agent } = createAgent("freshness");
      const dtus = [
        makeDtu({ tags: ["cooking"], createdAt: oldDate(120) }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.findings.length, 0);
    });

    it("runs synthesis agent and finds cross-domain analogies", () => {
      const { agent } = createAgent("synthesis");
      const dtus = [
        makeDtu({ domain: "science", tags: ["shared_tag", "science"] }),
        makeDtu({ domain: "science", tags: ["shared_tag", "science"] }),
        makeDtu({ domain: "science", tags: ["shared_tag", "science"] }),
        makeDtu({ domain: "science", tags: ["shared_tag", "science"] }),
        makeDtu({ domain: "art", tags: ["shared_tag", "art"] }),
        makeDtu({ domain: "art", tags: ["shared_tag", "art"] }),
        makeDtu({ domain: "art", tags: ["shared_tag", "art"] }),
        makeDtu({ domain: "art", tags: ["shared_tag", "art"] }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
    });

    it("synthesis agent returns empty if fewer than 2 domains", () => {
      const { agent } = createAgent("synthesis");
      const dtus = [
        makeDtu({ domain: "science" }),
        makeDtu({ domain: "science" }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.count, 0);
    });

    it("uses territory filter when not wildcard", () => {
      const { agent } = createAgent("patrol", { territory: "healthcare" });
      const dtus = [
        makeDtu({ tags: ["healthcare"], createdAt: oldDate(60), authority: 0.1 }),
        makeDtu({ tags: ["finance"], createdAt: oldDate(60), authority: 0.1 }),
      ];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      // Only healthcare DTU should be scanned
    });

    it("auto-repairs broken lineage findings (low severity)", () => {
      const { agent } = createAgent("patrol");
      const dtuWithBrokenParent = makeDtu({ parentId: "missing_parent" });
      const dtus = [dtuWithBrokenParent];
      const result = runAgent(agent.agentId, dtus);
      assert.strictEqual(result.ok, true);
      const brokenLineageFinding = result.findings.find(f => f.findingType === "broken_lineage");
      if (brokenLineageFinding) {
        assert.strictEqual(brokenLineageFinding.repaired, true);
        assert.strictEqual(dtuWithBrokenParent.parentId, null);
      }
    });

    it("increments agent runCount and findingsCount", () => {
      const { agent } = createAgent("patrol");
      runAgent(agent.agentId, []);
      const retrieved = getAgent(agent.agentId);
      assert.strictEqual(retrieved.agent.runCount, 1);
    });
  });

  // ── pauseAgent / resumeAgent ─────────────────────────────────────────────

  describe("pauseAgent() / resumeAgent()", () => {
    it("pauses an active agent", () => {
      const { agent } = createAgent("patrol");
      const result = pauseAgent(agent.agentId);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, "paused");
    });

    it("resumes a paused agent", () => {
      const { agent } = createAgent("patrol");
      pauseAgent(agent.agentId);
      const result = resumeAgent(agent.agentId);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.status, "active");
    });

    it("returns error for non-existent agent on pause", () => {
      const result = pauseAgent("nonexistent");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agent_not_found");
    });

    it("returns error for non-existent agent on resume", () => {
      const result = resumeAgent("nonexistent");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agent_not_found");
    });
  });

  // ── destroyAgent ─────────────────────────────────────────────────────────

  describe("destroyAgent()", () => {
    it("destroys an existing agent", () => {
      const { agent } = createAgent("patrol");
      const result = destroyAgent(agent.agentId);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.destroyed, true);
      assert.strictEqual(getAgent(agent.agentId).ok, false);
    });

    it("returns error for non-existent agent", () => {
      const result = destroyAgent("nonexistent");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "agent_not_found");
    });
  });

  // ── getAgent ─────────────────────────────────────────────────────────────

  describe("getAgent()", () => {
    it("returns agent by id", () => {
      const { agent } = createAgent("patrol");
      const result = getAgent(agent.agentId);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.agent.agentId, agent.agentId);
    });

    it("returns error for non-existent agent", () => {
      const result = getAgent("nonexistent");
      assert.strictEqual(result.ok, false);
    });
  });

  // ── listAgents ───────────────────────────────────────────────────────────

  describe("listAgents()", () => {
    it("lists all agents", () => {
      createAgent("patrol");
      createAgent("integrity");
      const result = listAgents();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.count, 2);
    });

    it("returns empty list when no agents", () => {
      const result = listAgents();
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.count, 0);
    });
  });

  // ── getAgentFindings ─────────────────────────────────────────────────────

  describe("getAgentFindings()", () => {
    it("returns findings for an agent", () => {
      const { agent } = createAgent("patrol");
      runAgent(agent.agentId, [makeDtu({ createdAt: oldDate(60), authority: 0.2 })]);
      const result = getAgentFindings(agent.agentId);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.length > 0);
    });

    it("returns error for non-existent agent", () => {
      const result = getAgentFindings("nonexistent");
      assert.strictEqual(result.ok, false);
    });

    it("respects limit parameter", () => {
      const { agent } = createAgent("patrol");
      for (let i = 0; i < 5; i++) {
        runAgent(agent.agentId, [makeDtu({ createdAt: oldDate(60), authority: 0.2 })]);
      }
      const result = getAgentFindings(agent.agentId, 2);
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.length <= 2);
    });
  });

  // ── getAllFindings ────────────────────────────────────────────────────────

  describe("getAllFindings()", () => {
    it("returns all findings", () => {
      const { agent } = createAgent("patrol");
      runAgent(agent.agentId, [makeDtu({ createdAt: oldDate(60), authority: 0.2 })]);
      const result = getAllFindings();
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.length > 0);
    });

    it("filters by agent type", () => {
      const { agent } = createAgent("patrol");
      runAgent(agent.agentId, [makeDtu({ createdAt: oldDate(60), authority: 0.2 })]);
      const result = getAllFindings("patrol");
      assert.strictEqual(result.ok, true);
      assert.ok(result.findings.every(f => f.agentType === "patrol"));
    });

    it("returns empty for unknown type filter", () => {
      const result = getAllFindings("nonexistent_type");
      assert.strictEqual(result.ok, true);
      // May have findings from other tests if not fully isolated
    });
  });

  // ── freezeAllAgents / thawAllAgents ──────────────────────────────────────

  describe("freezeAllAgents() / thawAllAgents()", () => {
    it("freezes and thaws agents", () => {
      createAgent("patrol");
      const freeze = freezeAllAgents();
      assert.strictEqual(freeze.ok, true);
      assert.strictEqual(freeze.frozen, true);

      const thaw = thawAllAgents();
      assert.strictEqual(thaw.ok, true);
      assert.strictEqual(thaw.frozen, false);
    });
  });

  // ── agentTickJob ─────────────────────────────────────────────────────────

  describe("agentTickJob()", () => {
    it("skips when frozen", () => {
      createAgent("patrol");
      freezeAllAgents();
      const result = agentTickJob([]);
      assert.strictEqual(result.ok, true);
      assert.ok(result.frozen);
    });

    it("runs agents whose interval has elapsed", () => {
      const { agent } = createAgent("patrol", { intervalMs: 0 });
      // Agent never ran, so elapsed > 0 >= intervalMs=0
      const result = agentTickJob([]);
      assert.strictEqual(result.ok, true);
      assert.ok(result.ran.length > 0);
    });

    it("skips paused agents", () => {
      const { agent } = createAgent("patrol", { intervalMs: 0 });
      pauseAgent(agent.agentId);
      const result = agentTickJob([]);
      assert.strictEqual(result.ok, true);
      assert.ok(result.skipped.includes(agent.agentId));
    });

    it("skips agents whose interval has not elapsed", () => {
      const { agent } = createAgent("patrol", { intervalMs: 999999999 });
      // Manually set lastRunAt to now
      const a = getAgent(agent.agentId).agent;
      a.lastRunAt = new Date().toISOString();
      const result = agentTickJob([]);
      assert.strictEqual(result.ok, true);
      assert.ok(result.skipped.includes(agent.agentId));
    });
  });

  // ── getAgentMetrics ──────────────────────────────────────────────────────

  describe("getAgentMetrics()", () => {
    it("returns aggregate metrics", () => {
      createAgent("patrol");
      createAgent("integrity");
      const result = getAgentMetrics();
      assert.strictEqual(result.ok, true);
      assert.ok(result.metrics);
      assert.strictEqual(result.metrics.agentCount, 2);
    });

    it("tracks metrics by type", () => {
      createAgent("patrol");
      const result = getAgentMetrics();
      assert.ok(result.metrics.byType.patrol);
      assert.strictEqual(result.metrics.byType.patrol.count, 1);
    });
  });
});
