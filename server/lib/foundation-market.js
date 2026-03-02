/**
 * Foundation Market — Physical Layer Marketplace
 *
 * Signal relay is a service. Nodes that carry DTUs for others earn
 * micro-payments in Concord Coin. Scarcity multiplier incentivizes
 * deployment in underserved areas. Infrastructure builds itself.
 *
 * Rules:
 *   1. Relay earns. Every DTU transit generates a micro-payment.
 *   2. Scarcity scales. Fewer alternatives = higher multiplier.
 *   3. Reputation matters. Reliable relays earn more.
 *   4. All earnings are DTUs. Full audit trail.
 */

import crypto from "crypto";

function uid(prefix = "market") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const BASE_RELAY_RATE = 0.001; // Concord Coin per KB relayed

export const SCARCITY_MULTIPLIERS = Object.freeze({
  URBAN_HIGH:     0.5,  // Dense urban, many alternatives
  URBAN_NORMAL:   1.0,  // Standard urban
  SUBURBAN:       1.5,  // Moderate alternatives
  RURAL:          3.0,  // Few alternatives
  REMOTE:         5.0,  // Very few alternatives
  SOLE_BRIDGE:   10.0,  // Only connection between communities
});

export const REPUTATION_TIERS = Object.freeze({
  NEW:        { min: 0,    multiplier: 0.8 },
  ESTABLISHED: { min: 100,  multiplier: 1.0 },
  TRUSTED:    { min: 500,  multiplier: 1.2 },
  PILLAR:     { min: 2000, multiplier: 1.5 },
});

// ── Module State ────────────────────────────────────────────────────────────

const _marketState = {
  initialized: false,
  earnings: [],                  // Recent relay earnings
  nodeBalances: new Map(),       // nodeId → balance
  nodeReputation: new Map(),     // nodeId → reputation data
  relayTopology: new Map(),      // nodeId → relay info
  stats: {
    totalEarnings: 0,
    totalRelayedBytes: 0,
    totalTransactions: 0,
    activeRelayNodes: 0,
    lastEarningAt: null,
    uptime: Date.now(),
  },
};

// ── Relay Earning DTU ───────────────────────────────────────────────────────

export function createRelayEarningDTU(opts) {
  const now = nowISO();
  const bytesRelayed = opts.bytes_relayed || 0;
  const scarcity = opts.scarcity_multiplier || SCARCITY_MULTIPLIERS.URBAN_NORMAL;
  const reputationMult = getReputationMultiplier(opts.relay_node);
  const earning = (bytesRelayed / 1024) * BASE_RELAY_RATE * scarcity * reputationMult;

  return {
    id: uid("earning"),
    type: "RELAY_EARNING",
    created: now,
    source: "foundation-market",
    relay_node: opts.relay_node || null,
    source_node: opts.source_node || null,
    destination_node: opts.destination_node || null,
    channel: opts.channel || "unknown",
    dtu_hash: opts.dtu_hash || null,
    bytes_relayed: bytesRelayed,
    scarcity_multiplier: scarcity,
    reputation_multiplier: reputationMult,
    earning_amount: Math.round(earning * 1e8) / 1e8,
    tags: ["foundation", "market", "earning"],
    scope: "local",
    crpiScore: 0.1,
  };
}

// ── Earning Recording ───────────────────────────────────────────────────────

export function recordRelayEarning(relayData, STATE) {
  if (!relayData || !relayData.relay_node) return null;

  const dtu = createRelayEarningDTU(relayData);

  // Update balance
  const currentBalance = _marketState.nodeBalances.get(dtu.relay_node) || 0;
  _marketState.nodeBalances.set(dtu.relay_node, currentBalance + dtu.earning_amount);

  // Update reputation
  updateReputation(dtu.relay_node, dtu.bytes_relayed);

  // Update relay topology
  _marketState.relayTopology.set(dtu.relay_node, {
    nodeId: dtu.relay_node,
    channel: dtu.channel,
    lastRelayAt: nowISO(),
    totalRelayed: (_marketState.relayTopology.get(dtu.relay_node)?.totalRelayed || 0) + dtu.bytes_relayed,
  });

  // Store earning
  _marketState.earnings.push(dtu);
  if (_marketState.earnings.length > 1000) {
    _marketState.earnings = _marketState.earnings.slice(-800);
  }

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _marketState.stats.totalEarnings += dtu.earning_amount;
  _marketState.stats.totalRelayedBytes += dtu.bytes_relayed;
  _marketState.stats.totalTransactions++;
  _marketState.stats.activeRelayNodes = _marketState.relayTopology.size;
  _marketState.stats.lastEarningAt = nowISO();

  return dtu;
}

// ── Reputation ──────────────────────────────────────────────────────────────

function updateReputation(nodeId, bytesRelayed) {
  const rep = _marketState.nodeReputation.get(nodeId) || {
    nodeId,
    totalRelays: 0,
    totalBytes: 0,
    uptime: 0,
    reliability: 1.0,
    firstRelay: nowISO(),
    lastRelay: nowISO(),
  };

  rep.totalRelays++;
  rep.totalBytes += bytesRelayed;
  rep.lastRelay = nowISO();

  _marketState.nodeReputation.set(nodeId, rep);
}

function getReputationMultiplier(nodeId) {
  if (!nodeId) return REPUTATION_TIERS.NEW.multiplier;
  const rep = _marketState.nodeReputation.get(nodeId);
  if (!rep) return REPUTATION_TIERS.NEW.multiplier;

  if (rep.totalRelays >= REPUTATION_TIERS.PILLAR.min) return REPUTATION_TIERS.PILLAR.multiplier;
  if (rep.totalRelays >= REPUTATION_TIERS.TRUSTED.min) return REPUTATION_TIERS.TRUSTED.multiplier;
  if (rep.totalRelays >= REPUTATION_TIERS.ESTABLISHED.min) return REPUTATION_TIERS.ESTABLISHED.multiplier;
  return REPUTATION_TIERS.NEW.multiplier;
}

// ── Query Functions ─────────────────────────────────────────────────────────

export function getNodeBalance(nodeId) {
  return _marketState.nodeBalances.get(nodeId) || 0;
}

export function getNodeReputation(nodeId) {
  return _marketState.nodeReputation.get(nodeId) || null;
}

export function getRelayTopology() {
  return [..._marketState.relayTopology.values()];
}

export function getRecentEarnings(limit = 50) {
  return _marketState.earnings.slice(-limit);
}

export function getMarketMetrics() {
  return {
    initialized: _marketState.initialized,
    activeRelayNodes: _marketState.relayTopology.size,
    totalBalanceNodes: _marketState.nodeBalances.size,
    stats: { ..._marketState.stats },
    uptime: Date.now() - _marketState.stats.uptime,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeMarket(STATE) {
  if (_marketState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "RELAY_EARNING" && dtu.relay_node) {
        const bal = _marketState.nodeBalances.get(dtu.relay_node) || 0;
        _marketState.nodeBalances.set(dtu.relay_node, bal + (dtu.earning_amount || 0));
        indexed++;
      }
    }
  }

  _marketState.initialized = true;
  _marketState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetMarketState() {
  _marketState.initialized = false;
  _marketState.earnings = [];
  _marketState.nodeBalances.clear();
  _marketState.nodeReputation.clear();
  _marketState.relayTopology.clear();
  _marketState.stats = {
    totalEarnings: 0, totalRelayedBytes: 0, totalTransactions: 0,
    activeRelayNodes: 0, lastEarningAt: null, uptime: Date.now(),
  };
}
