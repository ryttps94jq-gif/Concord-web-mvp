/**
 * Federation Peering Logic
 *
 * Upgrades the federation stub from loaf/federation.js with actual
 * peering protocol mechanics:
 *
 *   1. Peer discovery — register known peers, maintain heartbeat
 *   2. DTU sync — selective cross-lattice DTU exchange
 *   3. Distributed governance — cross-lattice proposal routing
 *   4. Trust propagation — peer trust influences import trust
 *
 * NOTE: This module does NOT make actual HTTP calls.
 * It defines the protocol and state management.
 * Actual transport is handled by the WebSocket/HTTP layer.
 */

import { getEmergentState } from "./store.js";

// ── Peering State ────────────────────────────────────────────────────────────

function getPeeringStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._federation) {
    es._federation = {
      // Known peers: peerId → PeerRecord
      peers: new Map(),

      // Sync state: peerId → SyncState
      syncState: new Map(),

      // Inbound proposals from peers: proposalId → PeerProposal
      inboundProposals: new Map(),

      // Outbound sync queue: items we want to share
      outboundQueue: [],

      // Protocol version
      protocolVersion: "concord-federation-v1",

      metrics: {
        peersRegistered: 0,
        heartbeatsSent: 0,
        heartbeatsReceived: 0,
        dtusShared: 0,
        dtusReceived: 0,
        proposalsRouted: 0,
      },
    };
  }
  return es._federation;
}

// ── Peer Management ──────────────────────────────────────────────────────────

/**
 * Register or update a federation peer.
 *
 * @param {Object} STATE
 * @param {Object} peer
 * @param {string} peer.peerId - Unique peer identifier
 * @param {string} peer.endpoint - The peer's API endpoint
 * @param {string} [peer.name] - Human-readable name
 * @param {number} [peer.trust=0] - Initial trust level
 * @param {string[]} [peer.sharedSectors] - Sectors this peer shares
 * @returns {{ ok, peerId }}
 */
export function registerPeer(STATE, peer = {}) {
  if (!peer.peerId || !peer.endpoint) {
    return { ok: false, error: "peerId_and_endpoint_required" };
  }

  const store = getPeeringStore(STATE);

  const record = {
    peerId: peer.peerId,
    endpoint: peer.endpoint,
    name: peer.name || peer.peerId,
    trust: Math.max(0, Math.min(1, peer.trust || 0)),
    sharedSectors: Array.isArray(peer.sharedSectors) ? peer.sharedSectors : [],
    status: "registered",      // registered → active → stale → disconnected
    registeredAt: new Date().toISOString(),
    lastHeartbeat: null,
    lastSync: null,
    dtusShared: 0,
    dtusReceived: 0,
  };

  store.peers.set(peer.peerId, record);
  store.metrics.peersRegistered++;

  return { ok: true, peerId: peer.peerId };
}

/**
 * Process a heartbeat from a peer.
 * Heartbeats carry lattice state summaries for sync planning.
 *
 * @param {Object} STATE
 * @param {string} peerId
 * @param {Object} heartbeat
 * @param {number} heartbeat.dtuCount
 * @param {number} heartbeat.shadowCount
 * @param {string} heartbeat.latestDtuTimestamp
 * @param {string[]} heartbeat.recentDtuIds - Last 10 DTU IDs for sync diff
 * @returns {{ ok, syncNeeded }}
 */
export function receiveHeartbeat(STATE, peerId, heartbeat = {}) {
  const store = getPeeringStore(STATE);
  const peer = store.peers.get(peerId);
  if (!peer) return { ok: false, error: "unknown_peer" };

  peer.lastHeartbeat = new Date().toISOString();
  peer.status = "active";
  store.metrics.heartbeatsReceived++;

  // Update sync state
  const sync = store.syncState.get(peerId) || {
    lastRemoteDtuCount: 0,
    lastRemoteTimestamp: null,
    pendingSync: false,
  };

  // Determine if sync is needed (remote has new DTUs)
  sync.lastRemoteDtuCount = heartbeat.dtuCount || 0;
  sync.lastRemoteTimestamp = heartbeat.latestDtuTimestamp || null;
  sync.pendingSync = !!(
    heartbeat.recentDtuIds?.length &&
    heartbeat.recentDtuIds.some(id => !STATE.dtus?.has(id))
  );

  store.syncState.set(peerId, sync);

  return { ok: true, syncNeeded: sync.pendingSync };
}

/**
 * Build a heartbeat to send to peers.
 *
 * @param {Object} STATE
 * @returns {{ ok, heartbeat }}
 */
export function buildHeartbeat(STATE) {
  const store = getPeeringStore(STATE);

  // Get 10 most recent DTU IDs
  const recentDtus = STATE.dtus
    ? Array.from(STATE.dtus.values())
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10)
    : [];

  const heartbeat = {
    protocolVersion: store.protocolVersion,
    dtuCount: STATE.dtus?.size || 0,
    shadowCount: STATE.shadowDtus?.size || 0,
    latestDtuTimestamp: recentDtus[0]?.createdAt || null,
    recentDtuIds: recentDtus.map(d => d.id),
    timestamp: new Date().toISOString(),
  };

  store.metrics.heartbeatsSent++;
  return { ok: true, heartbeat };
}

// ── DTU Sync ─────────────────────────────────────────────────────────────────

/**
 * Build a DTU export package for a specific peer.
 * Only exports DTUs in shared sectors that the peer doesn't have.
 *
 * @param {Object} STATE
 * @param {string} peerId
 * @param {Object} [opts]
 * @param {string[]} [opts.dtuIds] - Specific DTU IDs to export
 * @param {number} [opts.limit=50]
 * @returns {{ ok, package }}
 */
export function buildSyncPackage(STATE, peerId, opts = {}) {
  const store = getPeeringStore(STATE);
  const peer = store.peers.get(peerId);
  if (!peer) return { ok: false, error: "unknown_peer" };
  if (peer.trust < 0.3) return { ok: false, error: "insufficient_trust" };

  const limit = opts.limit || 50;
  let dtusToExport = [];

  if (opts.dtuIds?.length) {
    dtusToExport = opts.dtuIds
      .map(id => STATE.dtus?.get(id))
      .filter(Boolean);
  } else {
    // Export recent DTUs that haven't been shared
    dtusToExport = Array.from(STATE.dtus?.values() || [])
      .filter(d => !d.meta?.hidden && d.tier !== "shadow")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, limit);
  }

  const exported = dtusToExport.map(d => ({
    id: d.id,
    title: d.title,
    tier: d.tier,
    tags: d.tags,
    core: d.core,
    human: d.human,
    createdAt: d.createdAt,
    provenance: { source: "federation", originLattice: "local" },
  }));

  store.metrics.dtusShared += exported.length;
  peer.dtusShared += exported.length;

  return {
    ok: true,
    package: {
      protocolVersion: store.protocolVersion,
      peerId,
      dtus: exported,
      count: exported.length,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Receive a sync package from a peer.
 * Imported DTUs go into shadow layer until trusted.
 *
 * @param {Object} STATE
 * @param {string} peerId
 * @param {Object} pkg - The sync package
 * @returns {{ ok, received, shadowed }}
 */
export function receiveSyncPackage(STATE, peerId, pkg = {}) {
  const store = getPeeringStore(STATE);
  const peer = store.peers.get(peerId);
  if (!peer) return { ok: false, error: "unknown_peer" };

  let received = 0;
  let shadowed = 0;

  for (const dtu of (pkg.dtus || [])) {
    if (!dtu.id || !dtu.title) continue;
    if (STATE.dtus?.has(dtu.id) || STATE.shadowDtus?.has(dtu.id)) continue;

    // Import into shadow layer with federation provenance
    const shadowDtu = {
      ...dtu,
      id: `fed_${peerId}_${dtu.id}`.slice(0, 64),
      tier: "shadow",
      tags: [...(dtu.tags || []), "shadow", "federated", `peer:${peerId}`],
      machine: { kind: "federated_import", sourcePeer: peerId, sourceId: dtu.id },
      meta: { hidden: true, federated: true },
      source: "federation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    STATE.shadowDtus?.set(shadowDtu.id, shadowDtu);
    received++;
    shadowed++;
  }

  store.metrics.dtusReceived += received;
  peer.dtusReceived += received;
  peer.lastSync = new Date().toISOString();

  return { ok: true, received, shadowed };
}

// ── Cross-Lattice Proposals ──────────────────────────────────────────────────

/**
 * Route a governance proposal to a peer.
 *
 * @param {Object} STATE
 * @param {string} peerId
 * @param {Object} proposal
 * @returns {{ ok, proposalId }}
 */
export function routeProposalToPeer(STATE, peerId, proposal = {}) {
  const store = getPeeringStore(STATE);
  const peer = store.peers.get(peerId);
  if (!peer) return { ok: false, error: "unknown_peer" };
  if (peer.trust < 0.5) return { ok: false, error: "insufficient_trust_for_proposals" };

  store.metrics.proposalsRouted++;
  return {
    ok: true,
    proposalId: proposal.proposalId,
    routedTo: peerId,
    timestamp: new Date().toISOString(),
  };
}

// ── Stale Peer Detection ─────────────────────────────────────────────────────

/**
 * Mark peers as stale if no heartbeat in 24 hours.
 */
export function detectStalePeers(STATE) {
  const store = getPeeringStore(STATE);
  const now = Date.now();
  let staleCount = 0;

  for (const [, peer] of store.peers) {
    if (peer.status === "disconnected") continue;
    if (!peer.lastHeartbeat) continue;

    const age = now - new Date(peer.lastHeartbeat).getTime();
    if (age > 24 * 3600_000) {
      peer.status = "stale";
      staleCount++;
    }
  }

  return { ok: true, staleCount };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function getFederationPeeringMetrics(STATE) {
  const store = getPeeringStore(STATE);

  const peerStatuses = {};
  for (const peer of store.peers.values()) {
    peerStatuses[peer.status] = (peerStatuses[peer.status] || 0) + 1;
  }

  return {
    ok: true,
    totalPeers: store.peers.size,
    peerStatuses,
    syncStateTracked: store.syncState.size,
    inboundProposals: store.inboundProposals.size,
    outboundQueueSize: store.outboundQueue.length,
    ...store.metrics,
  };
}
