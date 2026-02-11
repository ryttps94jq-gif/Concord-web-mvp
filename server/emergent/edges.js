/**
 * Emergent Agent Governance — Edge Semantics & Provenance
 *
 * Upgrades lattice edges from simple "A linked to B" to rich semantic edges:
 *   - type: supports / contradicts / derives / references / similar / parentOf / causes / enables / requires
 *   - weight: [0-1] strength of relationship
 *   - confidence: [0-1] how sure we are about this edge
 *   - createdBy: { source, id } — user/system/emergent attribution
 *   - evidenceRefs: artifact/DTU IDs that justify this edge
 *   - timestamps: createdAt, lastValidatedAt
 *
 * Emergents can reason on structure, not vibes.
 */

import { getEmergentState } from "./store.js";

// ── Edge Types ──────────────────────────────────────────────────────────────

export const EDGE_TYPES = Object.freeze({
  SUPPORTS:     "supports",
  CONTRADICTS:  "contradicts",
  DERIVES:      "derives",
  REFERENCES:   "references",
  SIMILAR:      "similar",
  PARENT_OF:    "parentOf",
  CAUSES:       "causes",
  ENABLES:      "enables",
  REQUIRES:     "requires",
});

export const ALL_EDGE_TYPES = Object.freeze(Object.values(EDGE_TYPES));

// ── Edge Store ──────────────────────────────────────────────────────────────

/**
 * Get or initialize the edge store.
 */
export function getEdgeStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._edges) {
    es._edges = {
      edges: new Map(),           // edgeId -> Edge
      bySource: new Map(),        // sourceId -> Set<edgeId>
      byTarget: new Map(),        // targetId -> Set<edgeId>
      byType: new Map(),          // edgeType -> Set<edgeId>
      metrics: {
        created: 0,
        updated: 0,
        removed: 0,
        queries: 0,
      },
    };
  }
  return es._edges;
}

// ── Edge CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new semantic edge.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Edge options
 * @returns {{ ok: boolean, edge?: Object, error?: string }}
 */
export function createEdge(STATE, opts = {}) {
  const store = getEdgeStore(STATE);

  if (!opts.sourceId || !opts.targetId) {
    return { ok: false, error: "source_and_target_required" };
  }

  if (opts.sourceId === opts.targetId) {
    return { ok: false, error: "self_edge_not_allowed" };
  }

  const edgeType = opts.edgeType || EDGE_TYPES.REFERENCES;
  if (!ALL_EDGE_TYPES.includes(edgeType)) {
    return { ok: false, error: "invalid_edge_type", provided: edgeType, allowed: ALL_EDGE_TYPES };
  }

  // Check for duplicate edges
  const existingSourceEdges = store.bySource.get(opts.sourceId);
  if (existingSourceEdges) {
    for (const eid of existingSourceEdges) {
      const existing = store.edges.get(eid);
      if (existing && existing.targetId === opts.targetId && existing.edgeType === edgeType) {
        return { ok: false, error: "duplicate_edge", existingEdgeId: eid };
      }
    }
  }

  const edgeId = `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const edge = {
    edgeId,
    sourceId: opts.sourceId,
    targetId: opts.targetId,
    edgeType,
    weight: clamp(opts.weight ?? 0.5, 0, 1),
    confidence: clamp(opts.confidence ?? 0.5, 0, 1),
    createdBy: {
      source: opts.createdBySource || "emergent",
      id: opts.createdById || "unknown",
    },
    evidenceRefs: Array.isArray(opts.evidenceRefs) ? opts.evidenceRefs.slice(0, 50) : [],
    label: opts.label ? String(opts.label).slice(0, 200) : null,
    createdAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    validationCount: 0,
  };

  // Store edge
  store.edges.set(edgeId, edge);

  // Update indices
  if (!store.bySource.has(edge.sourceId)) store.bySource.set(edge.sourceId, new Set());
  store.bySource.get(edge.sourceId).add(edgeId);

  if (!store.byTarget.has(edge.targetId)) store.byTarget.set(edge.targetId, new Set());
  store.byTarget.get(edge.targetId).add(edgeId);

  if (!store.byType.has(edge.edgeType)) store.byType.set(edge.edgeType, new Set());
  store.byType.get(edge.edgeType).add(edgeId);

  store.metrics.created++;

  return { ok: true, edge };
}

/**
 * Get an edge by ID.
 */
export function getEdge(STATE, edgeId) {
  const store = getEdgeStore(STATE);
  store.metrics.queries++;
  const edge = store.edges.get(edgeId);
  return edge ? { ok: true, edge } : { ok: false, error: "not_found" };
}

/**
 * Query edges with filters.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} query - Query parameters
 * @returns {{ ok: boolean, edges: Object[], count: number }}
 */
export function queryEdges(STATE, query = {}) {
  const store = getEdgeStore(STATE);
  store.metrics.queries++;

  let edgeIds;

  // Start with the most restrictive index
  if (query.sourceId && store.bySource.has(query.sourceId)) {
    edgeIds = new Set(store.bySource.get(query.sourceId));
  } else if (query.targetId && store.byTarget.has(query.targetId)) {
    edgeIds = new Set(store.byTarget.get(query.targetId));
  } else if (query.edgeType && store.byType.has(query.edgeType)) {
    edgeIds = new Set(store.byType.get(query.edgeType));
  } else {
    edgeIds = new Set(store.edges.keys());
  }

  let edges = [];
  for (const eid of edgeIds) {
    const e = store.edges.get(eid);
    if (!e) continue;

    // Apply filters
    if (query.sourceId && e.sourceId !== query.sourceId) continue;
    if (query.targetId && e.targetId !== query.targetId) continue;
    if (query.edgeType && e.edgeType !== query.edgeType) continue;
    if (query.minWeight !== undefined && e.weight < query.minWeight) continue;
    if (query.minConfidence !== undefined && e.confidence < query.minConfidence) continue;
    if (query.createdById && e.createdBy.id !== query.createdById) continue;

    edges.push(e);
  }

  // Sort by weight descending
  edges.sort((a, b) => b.weight - a.weight);

  const limit = Math.min(query.limit || 100, 500);
  edges = edges.slice(0, limit);

  return { ok: true, edges, count: edges.length };
}

/**
 * Update edge weight/confidence (e.g., from validation).
 *
 * @param {Object} STATE - Global server state
 * @param {string} edgeId - Edge to update
 * @param {Object} updates - { weight?, confidence?, evidenceRefs? }
 * @returns {{ ok: boolean, edge?: Object }}
 */
export function updateEdge(STATE, edgeId, updates = {}) {
  const store = getEdgeStore(STATE);
  const edge = store.edges.get(edgeId);
  if (!edge) return { ok: false, error: "not_found" };

  if (updates.weight !== undefined) edge.weight = clamp(updates.weight, 0, 1);
  if (updates.confidence !== undefined) edge.confidence = clamp(updates.confidence, 0, 1);
  if (updates.evidenceRefs && Array.isArray(updates.evidenceRefs)) {
    const existing = new Set(edge.evidenceRefs);
    for (const ref of updates.evidenceRefs) existing.add(ref);
    edge.evidenceRefs = Array.from(existing).slice(0, 50);
  }
  if (updates.validate) {
    edge.lastValidatedAt = new Date().toISOString();
    edge.validationCount++;
  }

  store.metrics.updated++;
  return { ok: true, edge };
}

/**
 * Remove an edge.
 */
export function removeEdge(STATE, edgeId) {
  const store = getEdgeStore(STATE);
  const edge = store.edges.get(edgeId);
  if (!edge) return { ok: false, error: "not_found" };

  // Remove from indices
  store.bySource.get(edge.sourceId)?.delete(edgeId);
  store.byTarget.get(edge.targetId)?.delete(edgeId);
  store.byType.get(edge.edgeType)?.delete(edgeId);
  store.edges.delete(edgeId);
  store.metrics.removed++;

  return { ok: true, edgeId };
}

/**
 * Get the full neighborhood of a node (all edges in and out).
 *
 * @param {Object} STATE - Global server state
 * @param {string} nodeId - DTU/node ID
 * @returns {{ ok: boolean, outgoing: Object[], incoming: Object[] }}
 */
export function getNeighborhood(STATE, nodeId) {
  const store = getEdgeStore(STATE);
  store.metrics.queries++;

  const outgoing = [];
  const outEdgeIds = store.bySource.get(nodeId);
  if (outEdgeIds) {
    for (const eid of outEdgeIds) {
      const e = store.edges.get(eid);
      if (e) outgoing.push(e);
    }
  }

  const incoming = [];
  const inEdgeIds = store.byTarget.get(nodeId);
  if (inEdgeIds) {
    for (const eid of inEdgeIds) {
      const e = store.edges.get(eid);
      if (e) incoming.push(e);
    }
  }

  return {
    ok: true,
    nodeId,
    outgoing,
    incoming,
    totalEdges: outgoing.length + incoming.length,
  };
}

/**
 * Find paths between two nodes (BFS, max depth).
 *
 * @param {Object} STATE - Global server state
 * @param {string} fromId - Start node
 * @param {string} toId - End node
 * @param {number} [maxDepth=4] - Maximum path depth
 * @returns {{ ok: boolean, paths: Object[][] }}
 */
export function findPaths(STATE, fromId, toId, maxDepth = 4) {
  const store = getEdgeStore(STATE);
  store.metrics.queries++;

  const paths = [];
  const queue = [[{ nodeId: fromId, edges: [] }]];

  while (queue.length > 0 && paths.length < 10) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current.nodeId === toId && path.length > 1) {
      paths.push(path.map(p => ({ nodeId: p.nodeId, viaEdge: p.edges[p.edges.length - 1] || null })));
      continue;
    }

    if (path.length > maxDepth) continue;

    const outEdgeIds = store.bySource.get(current.nodeId);
    if (!outEdgeIds) continue;

    for (const eid of outEdgeIds) {
      const edge = store.edges.get(eid);
      if (!edge) continue;

      // Avoid cycles
      if (path.some(p => p.nodeId === edge.targetId)) continue;

      queue.push([...path, { nodeId: edge.targetId, edges: [...current.edges, edge] }]);
    }
  }

  return { ok: true, paths, count: paths.length };
}

/**
 * Get edge store metrics.
 */
export function getEdgeMetrics(STATE) {
  const store = getEdgeStore(STATE);
  return {
    ok: true,
    totalEdges: store.edges.size,
    metrics: store.metrics,
    typeDistribution: getTypeDistribution(store),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function getTypeDistribution(store) {
  const dist = {};
  for (const [type, ids] of store.byType) {
    dist[type] = ids.size;
  }
  return dist;
}
