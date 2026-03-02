/**
 * Foundation Market — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (BASE_RELAY_RATE, SCARCITY_MULTIPLIERS, REPUTATION_TIERS)
 *   - createRelayEarningDTU (earning calculation, reputation multiplier)
 *   - recordRelayEarning (null, balance updates, reputation updates, topology)
 *   - Reputation system (tiers, multiplier progression)
 *   - Query functions (getNodeBalance, getNodeReputation, getRelayTopology)
 *   - Metrics (getMarketMetrics)
 *   - initializeMarket (indexing, double-init)
 *   - _resetMarketState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  BASE_RELAY_RATE,
  SCARCITY_MULTIPLIERS,
  REPUTATION_TIERS,
  createRelayEarningDTU,
  recordRelayEarning,
  getNodeBalance,
  getNodeReputation,
  getRelayTopology,
  getRecentEarnings,
  getMarketMetrics,
  initializeMarket,
  _resetMarketState,
} from "../lib/foundation-market.js";

beforeEach(() => {
  _resetMarketState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Market — Constants", () => {
  it("defines base relay rate", () => {
    assert.equal(BASE_RELAY_RATE, 0.001);
  });

  it("defines 6 scarcity multipliers", () => {
    assert.equal(SCARCITY_MULTIPLIERS.URBAN_HIGH, 0.5);
    assert.equal(SCARCITY_MULTIPLIERS.URBAN_NORMAL, 1.0);
    assert.equal(SCARCITY_MULTIPLIERS.SUBURBAN, 1.5);
    assert.equal(SCARCITY_MULTIPLIERS.RURAL, 3.0);
    assert.equal(SCARCITY_MULTIPLIERS.REMOTE, 5.0);
    assert.equal(SCARCITY_MULTIPLIERS.SOLE_BRIDGE, 10.0);
  });

  it("scarcity increases from urban to sole bridge", () => {
    assert.ok(SCARCITY_MULTIPLIERS.URBAN_HIGH < SCARCITY_MULTIPLIERS.URBAN_NORMAL);
    assert.ok(SCARCITY_MULTIPLIERS.URBAN_NORMAL < SCARCITY_MULTIPLIERS.SUBURBAN);
    assert.ok(SCARCITY_MULTIPLIERS.SUBURBAN < SCARCITY_MULTIPLIERS.RURAL);
    assert.ok(SCARCITY_MULTIPLIERS.RURAL < SCARCITY_MULTIPLIERS.REMOTE);
    assert.ok(SCARCITY_MULTIPLIERS.REMOTE < SCARCITY_MULTIPLIERS.SOLE_BRIDGE);
  });

  it("defines 4 reputation tiers with thresholds and multipliers", () => {
    assert.equal(REPUTATION_TIERS.NEW.min, 0);
    assert.equal(REPUTATION_TIERS.NEW.multiplier, 0.8);
    assert.equal(REPUTATION_TIERS.ESTABLISHED.min, 100);
    assert.equal(REPUTATION_TIERS.ESTABLISHED.multiplier, 1.0);
    assert.equal(REPUTATION_TIERS.TRUSTED.min, 500);
    assert.equal(REPUTATION_TIERS.TRUSTED.multiplier, 1.2);
    assert.equal(REPUTATION_TIERS.PILLAR.min, 2000);
    assert.equal(REPUTATION_TIERS.PILLAR.multiplier, 1.5);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(SCARCITY_MULTIPLIERS), true);
    assert.equal(Object.isFrozen(REPUTATION_TIERS), true);
  });
});

// ── createRelayEarningDTU ──────────────────────────────────────────────────

describe("Foundation Market — createRelayEarningDTU", () => {
  it("creates earning DTU with correct fields", () => {
    const dtu = createRelayEarningDTU({
      relay_node: "node_A",
      source_node: "node_B",
      destination_node: "node_C",
      channel: "lora",
      bytes_relayed: 1024,
      dtu_hash: "abc123",
    });
    assert.match(dtu.id, /^earning_/);
    assert.equal(dtu.type, "RELAY_EARNING");
    assert.equal(dtu.source, "foundation-market");
    assert.equal(dtu.relay_node, "node_A");
    assert.equal(dtu.source_node, "node_B");
    assert.equal(dtu.destination_node, "node_C");
    assert.equal(dtu.channel, "lora");
    assert.equal(dtu.bytes_relayed, 1024);
    assert.equal(dtu.dtu_hash, "abc123");
    assert.ok(dtu.tags.includes("market"));
    assert.ok(dtu.tags.includes("earning"));
    assert.equal(dtu.scope, "local");
  });

  it("calculates earning from bytes, scarcity, and reputation", () => {
    // New node: 1KB * BASE_RELAY_RATE * URBAN_NORMAL * NEW_reputation
    // = (1024/1024) * 0.001 * 1.0 * 0.8 = 0.0008
    const dtu = createRelayEarningDTU({
      relay_node: "new_node",
      bytes_relayed: 1024,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.URBAN_NORMAL,
    });
    assert.equal(dtu.scarcity_multiplier, 1.0);
    assert.equal(dtu.reputation_multiplier, 0.8); // NEW tier
    assert.equal(dtu.earning_amount, 0.0008);
  });

  it("higher scarcity means higher earning", () => {
    const urbanDtu = createRelayEarningDTU({
      relay_node: "n",
      bytes_relayed: 1024,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.URBAN_NORMAL,
    });
    const remoteDtu = createRelayEarningDTU({
      relay_node: "n",
      bytes_relayed: 1024,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.REMOTE,
    });
    assert.ok(remoteDtu.earning_amount > urbanDtu.earning_amount);
  });

  it("sole bridge gets 10x urban normal earning", () => {
    const urbanDtu = createRelayEarningDTU({
      relay_node: "n",
      bytes_relayed: 10240,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.URBAN_NORMAL,
    });
    const bridgeDtu = createRelayEarningDTU({
      relay_node: "n",
      bytes_relayed: 10240,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.SOLE_BRIDGE,
    });
    assert.ok(Math.abs(bridgeDtu.earning_amount / urbanDtu.earning_amount - 10) < 0.01);
  });

  it("defaults to URBAN_NORMAL scarcity", () => {
    const dtu = createRelayEarningDTU({ relay_node: "n", bytes_relayed: 1024 });
    assert.equal(dtu.scarcity_multiplier, 1.0);
  });

  it("handles zero bytes relayed", () => {
    const dtu = createRelayEarningDTU({ relay_node: "n", bytes_relayed: 0 });
    assert.equal(dtu.earning_amount, 0);
  });

  it("defaults relay_node to null when not provided", () => {
    const dtu = createRelayEarningDTU({ bytes_relayed: 1024 });
    assert.equal(dtu.relay_node, null);
  });
});

// ── recordRelayEarning ──────────────────────────────────────────────────

describe("Foundation Market — recordRelayEarning", () => {
  it("returns null for null data", () => {
    assert.equal(recordRelayEarning(null), null);
  });

  it("returns null for data without relay_node", () => {
    assert.equal(recordRelayEarning({ bytes_relayed: 1024 }), null);
  });

  it("records earning and updates balance", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    const balance = getNodeBalance("node_A");
    assert.ok(balance > 0);
  });

  it("accumulates balance across multiple earnings", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    const balance1 = getNodeBalance("node_A");
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 2048 });
    const balance2 = getNodeBalance("node_A");
    assert.ok(balance2 > balance1);
  });

  it("updates reputation tracking", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    const rep = getNodeReputation("node_A");
    assert.notEqual(rep, null);
    assert.equal(rep.nodeId, "node_A");
    assert.equal(rep.totalRelays, 1);
    assert.equal(rep.totalBytes, 1024);
  });

  it("updates relay topology", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024, channel: "lora" });
    const topology = getRelayTopology();
    assert.equal(topology.length, 1);
    assert.equal(topology[0].nodeId, "node_A");
    assert.equal(topology[0].channel, "lora");
    assert.equal(topology[0].totalRelayed, 1024);
  });

  it("accumulates relay topology totals", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 2048 });
    const topology = getRelayTopology();
    assert.equal(topology[0].totalRelayed, 3072);
  });

  it("stores in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const dtu = recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 }, STATE);
    assert.ok(STATE.dtus.has(dtu.id));
  });

  it("increments stats", () => {
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    recordRelayEarning({ relay_node: "node_B", bytes_relayed: 2048 });
    const metrics = getMarketMetrics();
    assert.equal(metrics.stats.totalTransactions, 2);
    assert.equal(metrics.stats.totalRelayedBytes, 3072);
    assert.ok(metrics.stats.totalEarnings > 0);
    assert.equal(metrics.stats.activeRelayNodes, 2);
    assert.notEqual(metrics.stats.lastEarningAt, null);
  });

  it("trims earnings at 1000 (keeps 800)", () => {
    for (let i = 0; i < 1010; i++) {
      recordRelayEarning({ relay_node: "node_A", bytes_relayed: 100 });
    }
    const earnings = getRecentEarnings(2000);
    assert.ok(earnings.length <= 800);
  });
});

// ── Reputation System ──────────────────────────────────────────────────────

describe("Foundation Market — Reputation System", () => {
  it("new nodes get NEW tier multiplier (0.8)", () => {
    const dtu = createRelayEarningDTU({ relay_node: "new_node", bytes_relayed: 1024 });
    assert.equal(dtu.reputation_multiplier, 0.8);
  });

  it("reputation increases with relays", () => {
    // Build up 101 relays to reach ESTABLISHED
    for (let i = 0; i < 101; i++) {
      recordRelayEarning({ relay_node: "node_rep", bytes_relayed: 100 });
    }
    const rep = getNodeReputation("node_rep");
    assert.equal(rep.totalRelays, 101);

    // Next earning should use ESTABLISHED multiplier
    const dtu = createRelayEarningDTU({ relay_node: "node_rep", bytes_relayed: 1024 });
    assert.equal(dtu.reputation_multiplier, 1.0);
  });

  it("TRUSTED tier reached at 500 relays", () => {
    for (let i = 0; i < 501; i++) {
      recordRelayEarning({ relay_node: "node_trust", bytes_relayed: 100 });
    }
    const dtu = createRelayEarningDTU({ relay_node: "node_trust", bytes_relayed: 1024 });
    assert.equal(dtu.reputation_multiplier, 1.2);
  });

  it("getNodeReputation returns null for unknown node", () => {
    assert.equal(getNodeReputation("unknown"), null);
  });

  it("getNodeBalance returns 0 for unknown node", () => {
    assert.equal(getNodeBalance("unknown"), 0);
  });
});

// ── Query Functions ──────────────────────────────────────────────────────

describe("Foundation Market — Query Functions", () => {
  it("getRecentEarnings returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      recordRelayEarning({ relay_node: "node_A", bytes_relayed: 100 });
    }
    const earnings = getRecentEarnings(5);
    assert.equal(earnings.length, 5);
  });

  it("getRecentEarnings defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      recordRelayEarning({ relay_node: "node_A", bytes_relayed: 100 });
    }
    const earnings = getRecentEarnings();
    assert.equal(earnings.length, 50);
  });

  it("getRelayTopology returns all relay nodes", () => {
    recordRelayEarning({ relay_node: "n1", bytes_relayed: 100 });
    recordRelayEarning({ relay_node: "n2", bytes_relayed: 200 });
    recordRelayEarning({ relay_node: "n3", bytes_relayed: 300 });
    const topology = getRelayTopology();
    assert.equal(topology.length, 3);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Market — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getMarketMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.activeRelayNodes, 0);
    assert.equal(metrics.totalBalanceNodes, 0);
    assert.equal(metrics.stats.totalEarnings, 0);
    assert.equal(metrics.stats.totalRelayedBytes, 0);
    assert.equal(metrics.stats.totalTransactions, 0);
    assert.equal(metrics.stats.lastEarningAt, null);
    assert.ok(metrics.uptime >= 0);
  });
});

// ── initializeMarket ──────────────────────────────────────────────────

describe("Foundation Market — initializeMarket", () => {
  it("initializes successfully", async () => {
    const result = await initializeMarket({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    assert.equal(getMarketMetrics().initialized, true);
  });

  it("indexes RELAY_EARNING DTUs from STATE and rebuilds balances", async () => {
    const STATE = {
      dtus: new Map([
        ["e1", { type: "RELAY_EARNING", relay_node: "node1", earning_amount: 0.005 }],
        ["e2", { type: "RELAY_EARNING", relay_node: "node1", earning_amount: 0.003 }],
        ["e3", { type: "RELAY_EARNING", relay_node: "node2", earning_amount: 0.01 }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeMarket(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 3);
    assert.ok(Math.abs(getNodeBalance("node1") - 0.008) < 0.0001);
    assert.ok(Math.abs(getNodeBalance("node2") - 0.01) < 0.0001);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeMarket({});
    const result = await initializeMarket({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeMarket(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetMarketState ──────────────────────────────────────────────────

describe("Foundation Market — _resetMarketState", () => {
  it("resets all state", async () => {
    await initializeMarket({});
    recordRelayEarning({ relay_node: "node_A", bytes_relayed: 1024 });
    _resetMarketState();

    const metrics = getMarketMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.activeRelayNodes, 0);
    assert.equal(metrics.totalBalanceNodes, 0);
    assert.equal(metrics.stats.totalEarnings, 0);
    assert.equal(metrics.stats.totalTransactions, 0);
    assert.equal(getNodeBalance("node_A"), 0);
    assert.equal(getNodeReputation("node_A"), null);
  });
});
