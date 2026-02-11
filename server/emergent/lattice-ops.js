/**
 * Emergent Agent Governance — Lattice Execution Boundary
 *
 * Enforces 3 distinct operation classes on the lattice:
 *   READ    — emergents can query DTUs/artifacts/edges
 *   PROPOSE — emergents output proposed changes into a staging buffer
 *   COMMIT  — only council/governance macros can merge proposals into canonical lattice
 *
 * Also implements the Staging Lattice (Shadow Lattice v2):
 *   canonical lattice = "truth-ish" (production state)
 *   staging lattice   = "playground" (emergent workspace)
 *   merge requires:    gate trace + governance decision
 *
 * Emergents can "work" in the lattice without ever corrupting it.
 */

import { getEmergentState } from "./store.js";

// ── Operation Classes ───────────────────────────────────────────────────────

export const OP_CLASS = Object.freeze({
  READ:    "read",
  PROPOSE: "propose",
  COMMIT:  "commit",
});

// ── Staging Lattice State ───────────────────────────────────────────────────

/**
 * Get or initialize the lattice operations state.
 */
export function getLatticeOps(STATE) {
  const es = getEmergentState(STATE);
  if (!es._latticeOps) {
    es._latticeOps = {
      // Staging lattice — parallel workspace for emergents
      staging: {
        dtus: new Map(),       // proposalId -> staged DTU
        edges: new Map(),      // proposalId -> staged edge
        artifacts: new Map(),  // proposalId -> staged artifact
      },

      // Proposal queue — ordered list of pending proposals
      proposals: new Map(),    // proposalId -> Proposal

      // Commit log — accepted proposals that merged into canonical
      commitLog: [],           // chronological commit records

      // Metrics
      metrics: {
        reads: 0,
        proposals: 0,
        commits: 0,
        rejections: 0,
        mergeConflicts: 0,
      },
    };
  }
  return es._latticeOps;
}

// ── READ Operations ─────────────────────────────────────────────────────────

/**
 * Read a DTU from the canonical lattice.
 * Emergents can always read. No mutation.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU ID to read
 * @param {string} readerId - Who is reading (for audit)
 * @returns {{ ok: boolean, dtu?: Object, source: string }}
 */
export function readDTU(STATE, dtuId, readerId) {
  const ops = getLatticeOps(STATE);
  ops.metrics.reads++;

  // Check canonical lattice first
  const canonical = STATE.dtus?.get(dtuId);
  if (canonical) {
    return { ok: true, dtu: freezeSnapshot(canonical), source: "canonical", readerId };
  }

  // Check shadow DTUs
  const shadow = STATE.shadowDtus?.get(dtuId);
  if (shadow) {
    return { ok: true, dtu: freezeSnapshot(shadow), source: "shadow", readerId };
  }

  return { ok: false, error: "not_found", dtuId };
}

/**
 * Read from the staging lattice (emergent workspace).
 *
 * @param {Object} STATE - Global server state
 * @param {string} proposalId - Proposal/staged item ID
 * @returns {{ ok: boolean, item?: Object }}
 */
export function readStaging(STATE, proposalId) {
  const ops = getLatticeOps(STATE);
  ops.metrics.reads++;

  const staged = ops.staging.dtus.get(proposalId)
    || ops.staging.edges.get(proposalId)
    || ops.staging.artifacts.get(proposalId);

  if (!staged) return { ok: false, error: "not_found_in_staging" };
  return { ok: true, item: staged };
}

/**
 * Query the canonical lattice with filters.
 * Returns read-only snapshots.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} query - Query parameters
 * @returns {{ ok: boolean, results: Object[], count: number }}
 */
export function queryLattice(STATE, query = {}) {
  const ops = getLatticeOps(STATE);
  ops.metrics.reads++;

  const allDtus = STATE.dtus ? Array.from(STATE.dtus.values()) : [];
  let results = allDtus;

  if (query.tags && Array.isArray(query.tags)) {
    results = results.filter(d => query.tags.some(t => (d.tags || []).includes(t)));
  }
  if (query.tier) {
    results = results.filter(d => d.tier === query.tier);
  }
  if (query.minResonance !== undefined) {
    results = results.filter(d => (d.resonance || 0) >= query.minResonance);
  }
  if (query.minCoherence !== undefined) {
    results = results.filter(d => (d.coherence || 0) >= query.minCoherence);
  }

  const limit = Math.min(query.limit || 50, 200);
  results = results.slice(0, limit).map(freezeSnapshot);

  return { ok: true, results, count: results.length };
}

// ── PROPOSE Operations ──────────────────────────────────────────────────────

/**
 * Propose a new DTU into the staging lattice.
 * Does NOT touch canonical lattice.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Proposal options
 * @returns {{ ok: boolean, proposal?: Object }}
 */
export function proposeDTU(STATE, opts = {}) {
  const ops = getLatticeOps(STATE);
  ops.metrics.proposals++;

  const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const proposal = {
    proposalId,
    type: "dtu_create",
    status: "pending",
    proposedBy: opts.proposedBy || "unknown",
    sessionId: opts.sessionId || null,
    data: {
      title: String(opts.title || "Untitled").slice(0, 500),
      content: String(opts.content || "").slice(0, 10000),
      summary: String(opts.summary || "").slice(0, 500),
      tier: opts.tier || "regular",
      tags: Array.isArray(opts.tags) ? opts.tags.slice(0, 20) : [],
      parents: Array.isArray(opts.parents) ? opts.parents : [],
      resonance: opts.resonance || 0,
      coherence: opts.coherence || 0,
      stability: opts.stability || 0,
      meta: opts.meta || {},
    },
    confidenceLabel: opts.confidenceLabel || "hypothesis",
    predictedConfidence: opts.predictedConfidence || 0.5,
    expectedImpact: opts.expectedImpact || "low",
    noveltyScore: opts.noveltyScore || 0,
    provenance: {
      source: "emergent",
      emergentId: opts.proposedBy,
      sessionId: opts.sessionId,
      timestamp: new Date().toISOString(),
    },
    gateTrace: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  ops.proposals.set(proposalId, proposal);
  ops.staging.dtus.set(proposalId, { ...proposal.data, proposalId });

  return { ok: true, proposal };
}

/**
 * Propose an edit to an existing DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Edit proposal options
 * @returns {{ ok: boolean, proposal?: Object }}
 */
export function proposeEdit(STATE, opts = {}) {
  const ops = getLatticeOps(STATE);
  ops.metrics.proposals++;

  const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Verify target exists
  const target = STATE.dtus?.get(opts.targetDtuId);
  if (!target) {
    return { ok: false, error: "target_dtu_not_found", targetDtuId: opts.targetDtuId };
  }

  const proposal = {
    proposalId,
    type: "dtu_edit",
    status: "pending",
    proposedBy: opts.proposedBy || "unknown",
    sessionId: opts.sessionId || null,
    targetDtuId: opts.targetDtuId,
    edits: sanitizeEdits(opts.edits || {}),
    reason: String(opts.reason || "").slice(0, 2000),
    confidenceLabel: opts.confidenceLabel || "hypothesis",
    provenance: {
      source: "emergent",
      emergentId: opts.proposedBy,
      sessionId: opts.sessionId,
      timestamp: new Date().toISOString(),
    },
    gateTrace: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  ops.proposals.set(proposalId, proposal);
  return { ok: true, proposal };
}

/**
 * Propose a new edge between DTUs.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Edge proposal options
 * @returns {{ ok: boolean, proposal?: Object }}
 */
export function proposeEdge(STATE, opts = {}) {
  const ops = getLatticeOps(STATE);
  ops.metrics.proposals++;

  const proposalId = `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const proposal = {
    proposalId,
    type: "edge_create",
    status: "pending",
    proposedBy: opts.proposedBy || "unknown",
    sessionId: opts.sessionId || null,
    data: {
      sourceId: opts.sourceId,
      targetId: opts.targetId,
      edgeType: opts.edgeType || "references",
      weight: Math.max(0, Math.min(1, opts.weight || 0.5)),
      confidence: Math.max(0, Math.min(1, opts.confidence || 0.5)),
      evidenceRefs: Array.isArray(opts.evidenceRefs) ? opts.evidenceRefs : [],
    },
    provenance: {
      source: "emergent",
      emergentId: opts.proposedBy,
      sessionId: opts.sessionId,
      timestamp: new Date().toISOString(),
    },
    gateTrace: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  ops.proposals.set(proposalId, proposal);
  ops.staging.edges.set(proposalId, proposal.data);

  return { ok: true, proposal };
}

// ── COMMIT Operations ───────────────────────────────────────────────────────

/**
 * Commit a proposal from staging into the canonical lattice.
 * ONLY governance/council macros should call this.
 *
 * @param {Object} STATE - Global server state
 * @param {string} proposalId - Proposal to commit
 * @param {Object} opts - Commit options
 * @param {Object} opts.gateTrace - Required gate trace proving governance approval
 * @param {string} opts.committedBy - Who authorized the commit
 * @returns {{ ok: boolean, commit?: Object, error?: string }}
 */
export function commitProposal(STATE, proposalId, opts = {}) {
  const ops = getLatticeOps(STATE);
  const proposal = ops.proposals.get(proposalId);

  if (!proposal) {
    return { ok: false, error: "proposal_not_found" };
  }

  if (proposal.status !== "pending") {
    return { ok: false, error: "proposal_not_pending", status: proposal.status };
  }

  // Gate trace is mandatory
  if (!opts.gateTrace) {
    return { ok: false, error: "gate_trace_required" };
  }

  // Apply to canonical lattice based on type
  let commitResult;
  switch (proposal.type) {
    case "dtu_create":
      commitResult = applyDtuCreate(STATE, proposal);
      break;
    case "dtu_edit":
      commitResult = applyDtuEdit(STATE, proposal);
      break;
    case "edge_create":
      commitResult = applyEdgeCreate(STATE, proposal);
      break;
    default:
      return { ok: false, error: "unknown_proposal_type", type: proposal.type };
  }

  if (!commitResult.ok) {
    ops.metrics.mergeConflicts++;
    proposal.status = "conflict";
    return { ok: false, error: "merge_conflict", details: commitResult.error };
  }

  // Mark proposal as committed
  proposal.status = "committed";
  proposal.gateTrace = opts.gateTrace;
  proposal.reviewedAt = new Date().toISOString();
  proposal.committedBy = opts.committedBy || "governance";

  // Remove from staging
  ops.staging.dtus.delete(proposalId);
  ops.staging.edges.delete(proposalId);
  ops.staging.artifacts.delete(proposalId);

  // Add to commit log
  const commit = {
    proposalId,
    type: proposal.type,
    proposedBy: proposal.proposedBy,
    committedBy: proposal.committedBy,
    gateTrace: opts.gateTrace,
    timestamp: new Date().toISOString(),
  };
  ops.commitLog.push(commit);
  ops.metrics.commits++;

  return { ok: true, commit };
}

/**
 * Reject a proposal.
 *
 * @param {Object} STATE - Global server state
 * @param {string} proposalId - Proposal to reject
 * @param {string} reason - Rejection reason
 * @returns {{ ok: boolean }}
 */
export function rejectProposal(STATE, proposalId, reason) {
  const ops = getLatticeOps(STATE);
  const proposal = ops.proposals.get(proposalId);

  if (!proposal) return { ok: false, error: "proposal_not_found" };
  if (proposal.status !== "pending") return { ok: false, error: "proposal_not_pending" };

  proposal.status = "rejected";
  proposal.rejectionReason = String(reason || "").slice(0, 2000);
  proposal.reviewedAt = new Date().toISOString();
  ops.metrics.rejections++;

  // Remove from staging
  ops.staging.dtus.delete(proposalId);
  ops.staging.edges.delete(proposalId);
  ops.staging.artifacts.delete(proposalId);

  return { ok: true, proposalId, status: "rejected" };
}

/**
 * List pending proposals.
 */
export function listProposals(STATE, { status, type, proposedBy } = {}) {
  const ops = getLatticeOps(STATE);
  let results = Array.from(ops.proposals.values());

  if (status) results = results.filter(p => p.status === status);
  if (type) results = results.filter(p => p.type === type);
  if (proposedBy) results = results.filter(p => p.proposedBy === proposedBy);

  return { ok: true, proposals: results, count: results.length };
}

/**
 * Get lattice ops metrics.
 */
export function getLatticeMetrics(STATE) {
  const ops = getLatticeOps(STATE);
  return {
    ok: true,
    metrics: ops.metrics,
    pendingProposals: Array.from(ops.proposals.values()).filter(p => p.status === "pending").length,
    stagingDtus: ops.staging.dtus.size,
    stagingEdges: ops.staging.edges.size,
    commitLogSize: ops.commitLog.length,
  };
}

// ── Apply Helpers ───────────────────────────────────────────────────────────

function applyDtuCreate(STATE, proposal) {
  if (!STATE.dtus) STATE.dtus = new Map();

  const dtuId = `dtu_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  const dtu = {
    id: dtuId,
    ...proposal.data,
    source: "emergent",
    isGlobal: false,
    timestamp: new Date().toISOString(),
    children: [],
    relatedIds: [],
    meta: {
      ...proposal.data.meta,
      _emergentProvenance: proposal.provenance,
      _proposalId: proposal.proposalId,
    },
  };

  STATE.dtus.set(dtuId, dtu);
  return { ok: true, dtuId };
}

function applyDtuEdit(STATE, proposal) {
  const dtu = STATE.dtus?.get(proposal.targetDtuId);
  if (!dtu) return { ok: false, error: "target_gone" };

  const edits = proposal.edits;
  // Apply only allowed fields
  const EDITABLE = ["title", "content", "summary", "tags", "resonance", "coherence", "stability"];
  for (const field of EDITABLE) {
    if (edits[field] !== undefined) {
      dtu[field] = edits[field];
    }
  }
  dtu.updatedAt = new Date().toISOString();
  dtu.meta = dtu.meta || {};
  dtu.meta._lastEditProposal = proposal.proposalId;
  dtu.meta._lastEditBy = proposal.proposedBy;

  return { ok: true, dtuId: proposal.targetDtuId };
}

function applyEdgeCreate(STATE, proposal) {
  // Store edge in lattice edges or DTU relatedIds
  const dtu = STATE.dtus?.get(proposal.data.sourceId);
  if (dtu) {
    if (!dtu.relatedIds) dtu.relatedIds = [];
    if (!dtu.relatedIds.includes(proposal.data.targetId)) {
      dtu.relatedIds.push(proposal.data.targetId);
    }
  }
  return { ok: true };
}

// ── Utility ─────────────────────────────────────────────────────────────────

function freezeSnapshot(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sanitizeEdits(edits) {
  const clean = {};
  const ALLOWED = ["title", "content", "summary", "tags", "resonance", "coherence", "stability", "meta"];
  for (const key of ALLOWED) {
    if (edits[key] !== undefined) clean[key] = edits[key];
  }
  return clean;
}
