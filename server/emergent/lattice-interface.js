/**
 * WebSocket Lattice Interface
 *
 * Upgrades the notification pipe into a proper lattice boundary.
 *
 * When a WebSocket connects, it:
 *   1. Gets classified (user, emergent, admin, federation peer)
 *   2. Receives a LATTICE_ENTRY hello with current lattice state
 *   3. Gets sector detection based on authentication level
 *   4. Subscribes to sector-filtered events
 *
 * Events emitted:
 *   lattice:hello        — Initial state snapshot on connect
 *   lattice:dtu:created  — New DTU entered the lattice
 *   lattice:dtu:promoted — DTU promoted from shadow to canonical
 *   lattice:entity:emerged — Emergent crossed entity threshold
 *   lattice:need:created — New lattice need identified
 *   lattice:cascade      — Consequence cascade triggered
 *   lattice:trust:shift  — Trust network changed significantly
 *   lattice:sector:change — DTU or emergent sector assignment changed
 *
 * This module provides functions that the existing WebSocket handlers call.
 * It does NOT replace the WS setup — it enriches it.
 */

import { getEmergentState } from "./store.js";
import { SECTORS, ALL_SECTORS, SECTOR_BY_ID } from "./sectors.js";

// ── Connection Classification ────────────────────────────────────────────────

export const CONNECTION_TYPES = Object.freeze({
  USER:       "user",
  EMERGENT:   "emergent",
  ADMIN:      "admin",
  FEDERATION: "federation",
  ANONYMOUS:  "anonymous",
});

/**
 * Classify a WebSocket connection based on auth context.
 *
 * @param {Object} authContext - From WebSocket auth middleware
 * @param {string} [authContext.role] - User role
 * @param {string} [authContext.userId]
 * @param {string} [authContext.emergentId] - If this is an emergent connection
 * @param {string} [authContext.peerId] - If this is a federation peer
 * @returns {{ type, sectorAccess, label }}
 */
export function classifyConnection(authContext = {}) {
  if (authContext.peerId) {
    return {
      type: CONNECTION_TYPES.FEDERATION,
      sectorAccess: [1, 2, 3, 6], // boundary, signal, pattern, communication
      label: `peer:${authContext.peerId}`,
    };
  }

  if (authContext.emergentId) {
    return {
      type: CONNECTION_TYPES.EMERGENT,
      sectorAccess: [3, 4, 5, 6, 7], // pattern through deep consciousness
      label: `emergent:${authContext.emergentId}`,
    };
  }

  if (authContext.role === "admin" || authContext.role === "owner" || authContext.role === "founder") {
    return {
      type: CONNECTION_TYPES.ADMIN,
      sectorAccess: ALL_SECTORS.map(s => s.id), // all sectors
      label: `admin:${authContext.userId || "unknown"}`,
    };
  }

  if (authContext.userId) {
    return {
      type: CONNECTION_TYPES.USER,
      sectorAccess: [1, 3, 4, 5, 6], // boundary, pattern, memory, cognitive, communication
      label: `user:${authContext.userId}`,
    };
  }

  return {
    type: CONNECTION_TYPES.ANONYMOUS,
    sectorAccess: [1], // boundary only
    label: "anonymous",
  };
}

// ── Lattice Hello Message ────────────────────────────────────────────────────

/**
 * Build the LATTICE_ENTRY hello message for a new connection.
 *
 * @param {Object} STATE
 * @param {Object} classification - From classifyConnection
 * @returns {Object} Hello payload
 */
export function buildLatticeHello(STATE, classification) {
  const es = getEmergentState(STATE);

  const hello = {
    event: "lattice:hello",
    version: "1.0.0",
    connectionType: classification.type,
    sectorAccess: classification.sectorAccess,
    sectors: classification.sectorAccess.map(id => {
      const sector = SECTOR_BY_ID[id];
      return sector ? { id: sector.id, name: sector.name } : null;
    }).filter(Boolean),
    latticeState: {
      dtuCount: STATE.dtus?.size || 0,
      shadowCount: STATE.shadowDtus?.size || 0,
      emergentCount: es.emergents?.size || 0,
      activeSessionCount: es.activeSessions || 0,
      entityCount: es._entityEmergence
        ? Object.values(es._entityEmergence).filter(e => e.emerged).length
        : 0,
    },
    timestamp: new Date().toISOString(),
  };

  return hello;
}

// ── Event Filtering ──────────────────────────────────────────────────────────

/**
 * Check if a lattice event should be delivered to a connection.
 * Events are sector-filtered: connections only see events in their sectors.
 *
 * @param {Object} event
 * @param {number} [event.sectorId] - The sector this event belongs to
 * @param {Object} classification - Connection classification
 * @returns {boolean}
 */
export function shouldDeliverEvent(event, classification) {
  // Events without sector are broadcast to all
  if (event.sectorId === undefined || event.sectorId === null) return true;

  // Admin sees everything
  if (classification.type === CONNECTION_TYPES.ADMIN) return true;

  // Check sector access
  return classification.sectorAccess.includes(event.sectorId);
}

// ── Lattice Event Builders ───────────────────────────────────────────────────

/**
 * Build a lattice event for DTU creation.
 */
export function buildDtuCreatedEvent(dtu, sectorId) {
  return {
    event: "lattice:dtu:created",
    sectorId: sectorId ?? 4,
    data: {
      id: dtu.id,
      title: dtu.title,
      tier: dtu.tier,
      tags: dtu.tags,
      sectorId: sectorId ?? 4,
      isShadow: dtu.tier === "shadow",
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for entity emergence.
 */
export function buildEntityEmergedEvent(emergentId, archetype, scores) {
  return {
    event: "lattice:entity:emerged",
    sectorId: 7, // deep consciousness
    data: {
      emergentId,
      archetype,
      overallScore: scores
        ? Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
        : 0,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for need creation.
 */
export function buildNeedCreatedEvent(need) {
  return {
    event: "lattice:need:created",
    sectorId: 5, // cognitive processing
    data: {
      needId: need.needId,
      type: need.type,
      priority: need.priority,
      description: need.description,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for cascade trigger.
 */
export function buildCascadeEvent(cascade) {
  return {
    event: "lattice:cascade",
    sectorId: 7, // deep consciousness
    data: {
      type: cascade.type,
      sourceDtuId: cascade.sourceDtuId,
      nodesAffected: cascade.nodesAffected,
      maxDepth: cascade.maxDepth,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for trust shift.
 */
export function buildTrustShiftEvent(fromId, toId, newTrust, delta) {
  return {
    event: "lattice:trust:shift",
    sectorId: 6, // communication
    data: { fromId, toId, newTrust, delta },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for meta-derivation.
 */
export function buildMetaDerivedEvent(dtuId, sourceDomains, predictedDomain) {
  return {
    event: "lattice:meta:derived",
    sectorId: 7, // deep consciousness
    data: {
      dtuId,
      sourceDomains,
      predictedDomain,
      type: "meta_invariant",
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a lattice event for meta-derivation convergence.
 */
export function buildMetaConvergenceEvent(convergenceId, dreamDtuId, metaDtuId, similarity) {
  return {
    event: "lattice:meta:convergence",
    sectorId: 7, // deep consciousness
    data: {
      convergenceId,
      dreamDtuId,
      metaDtuId,
      similarity,
      type: "independent_convergence",
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/**
 * Get lattice interface metrics.
 */
export function getLatticeInterfaceMetrics(connections) {
  const byType = {};
  for (const type of Object.values(CONNECTION_TYPES)) {
    byType[type] = 0;
  }

  if (connections) {
    for (const conn of connections.values()) {
      const type = conn.classification?.type || "anonymous";
      byType[type] = (byType[type] || 0) + 1;
    }
  }

  return {
    ok: true,
    totalConnections: connections?.size || 0,
    byType,
  };
}
