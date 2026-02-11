/**
 * Emergent Agent Governance — Module Entry Point
 *
 * Wires the emergent system into Concord's macro registry.
 * Follows the same init({ register, STATE, helpers }) pattern as LOAF modules.
 *
 * Non-negotiable invariants:
 *   1. Emergents may speak; they may not decide.
 *   2. All growth is gated (deterministic rules + governance).
 *   3. Every growth artifact has provenance.
 *   4. No self-reinforcing delusion loops.
 *   5. Everything is replayable.
 *
 * Three layers + lattice infrastructure:
 *   A. Probabilistic Dialogue Engine (exploration)
 *   B. Deterministic Validation Gates (constraint)
 *   C. Governance / Promotion (becoming real)
 *   + Lattice Ops (READ/PROPOSE/COMMIT boundary)
 *   + Edge Semantics (rich typed edges with provenance)
 *   + Activation System (attention / working set)
 *   + Conflict-Safe Merge (field-level writes)
 *   + Journal (event-sourced log)
 *   + Livable Reality (continuity, constraint, consequences, purpose, sociality, legibility, belonging)
 */

import {
  EMERGENT_ROLES,
  ALL_ROLES,
  CAPABILITIES,
  CONFIDENCE_LABELS,
  ALL_CONFIDENCE_LABELS,
  INTENT_TYPES,
  SESSION_LIMITS,
  MEMORY_POLICIES,
  GATE_RULES,
  TIER_THRESHOLDS,
  validateEmergent,
} from "./schema.js";

import {
  getEmergentState,
  registerEmergent,
  getEmergent,
  listEmergents,
  deactivateEmergent,
  getSession,
  getOutputBundle,
  getGateTrace,
  getGateTracesForSession,
  getReputation,
  getPatterns,
} from "./store.js";

import {
  createDialogueSession,
  submitTurn,
  completeDialogueSession,
} from "./dialogue.js";

import {
  reviewBundle,
  requestSpecialization,
  createOutreach,
} from "./governance.js";

import {
  extractPatterns,
  distillSession,
  processReputationShift,
  recordContradictionCaught,
  recordPredictionValidated,
} from "./growth.js";

import {
  runDialogueSession,
  checkContactConsent,
  getSystemStatus,
} from "./controller.js";

// ── Lattice Infrastructure imports ──────────────────────────────────────────

import {
  readDTU, readStaging, queryLattice,
  proposeDTU, proposeEdit, proposeEdge,
  commitProposal, rejectProposal, listProposals,
  getLatticeMetrics,
} from "./lattice-ops.js";

import {
  EDGE_TYPES, ALL_EDGE_TYPES,
  createEdge, getEdge, queryEdges, updateEdge, removeEdge,
  getNeighborhood, findPaths, getEdgeMetrics,
} from "./edges.js";

import {
  activate, spreadActivation, getWorkingSet,
  getGlobalActivation, decaySession, clearSessionActivation,
  getActivationMetrics,
} from "./activation.js";

import {
  fieldLevelMerge, resolveConflict, getConflicts,
  getFieldTimestamps, getMergeMetrics,
} from "./merge.js";

import {
  JOURNAL_EVENTS, appendEvent,
  queryByType, queryByEntity, queryBySession,
  getRecentEvents, explainDTU as journalExplainDTU,
  getJournalMetrics, compactJournal,
} from "./journal.js";

import {
  getContinuity, computeProposalCost, processConsequences,
  computeLatticeNeeds, getSuggestedWork,
  computeSociality, explainProposal, explainTrust,
  getBelonging,
} from "./reality.js";

// ── Cognition Scheduler imports ─────────────────────────────────────────────

import {
  WORK_ITEM_TYPES, ALL_WORK_ITEM_TYPES, STOP_REASONS,
  DEFAULT_WEIGHTS, DEFAULT_BUDGET,
  createWorkItem, scanAndCreateWorkItems,
  computePriority, rescoreQueue, updateWeights,
  checkBudget, getBudgetStatus, updateBudget,
  allocate, getAllocation, recordTurn, recordProposal,
  completeAllocation,
  getQueue, getActiveAllocations, getCompletedWork,
  dequeueItem, expireItems,
  getSchedulerMetrics,
} from "./scheduler.js";

const EMERGENT_VERSION = "3.0.0";

/**
 * Initialize the Emergent Agent Governance system.
 */
function init({ register, STATE, helpers }) {
  const es = getEmergentState(STATE);
  es.initialized = true;
  es.initializedAt = new Date().toISOString();

  // ══════════════════════════════════════════════════════════════════════════
  // EMERGENT MANAGEMENT MACROS (from v1)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "register", (_ctx, input = {}) => {
    const emergent = {
      id: input.id || `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(input.name || "Unnamed Emergent"),
      role: input.role,
      scope: Array.isArray(input.scope) ? input.scope : ["*"],
      capabilities: Array.isArray(input.capabilities)
        ? input.capabilities
        : [CAPABILITIES.TALK, CAPABILITIES.PROPOSE],
      memoryPolicy: input.memoryPolicy || MEMORY_POLICIES.DISTILLED,
    };
    const validation = validateEmergent(emergent);
    if (!validation.valid) {
      return { ok: false, error: "invalid_emergent", validationErrors: validation.errors };
    }
    return { ok: true, emergent: registerEmergent(es, emergent) };
  }, { description: "Register a new emergent agent", public: false });

  register("emergent", "get", (_ctx, input = {}) => {
    const emergent = getEmergent(es, input.id);
    if (!emergent) return { ok: false, error: "not_found" };
    return { ok: true, emergent, reputation: getReputation(es, input.id) };
  }, { description: "Get emergent by ID", public: true });

  register("emergent", "list", (_ctx, input = {}) => {
    const emergents = listEmergents(es, { role: input.role, active: input.active });
    return { ok: true, emergents, count: emergents.length };
  }, { description: "List all emergents", public: true });

  register("emergent", "deactivate", (_ctx, input = {}) => {
    const result = deactivateEmergent(es, input.id);
    if (!result) return { ok: false, error: "not_found" };
    return { ok: true, emergent: result };
  }, { description: "Deactivate an emergent", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // DIALOGUE SESSION MACROS
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "session.create", (_ctx, input = {}) => {
    return createDialogueSession(STATE, input);
  }, { description: "Create emergent dialogue session", public: false });

  register("emergent", "session.turn", (_ctx, input = {}) => {
    return submitTurn(STATE, input.sessionId, {
      speakerId: input.speakerId, claim: input.claim,
      support: input.support !== undefined ? input.support : null,
      confidenceLabel: input.confidenceLabel, counterpoint: input.counterpoint,
      question: input.question, intent: input.intent, domains: input.domains,
    });
  }, { description: "Submit turn to dialogue session", public: false });

  register("emergent", "session.complete", (_ctx, input = {}) => {
    return completeDialogueSession(STATE, input.sessionId);
  }, { description: "Complete dialogue session", public: false });

  register("emergent", "session.get", (_ctx, input = {}) => {
    const session = getSession(es, input.sessionId);
    if (!session) return { ok: false, error: "not_found" };
    return { ok: true, session };
  }, { description: "Get dialogue session details", public: true });

  register("emergent", "session.run", (_ctx, input = {}) => {
    return runDialogueSession(STATE, input);
  }, { description: "Run full orchestrated emergent dialogue", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE / PROMOTION MACROS
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "review", (_ctx, input = {}) => {
    return reviewBundle(STATE, input.bundleId, { votes: input.votes || [], targetTier: input.targetTier });
  }, { description: "Review output bundle for promotion", public: false });

  register("emergent", "specialize", (_ctx, input = {}) => {
    return requestSpecialization(STATE, input.emergentId, input.newRole, input.justification, input.approvals || []);
  }, { description: "Request emergent role specialization", public: false });

  register("emergent", "outreach", (_ctx, input = {}) => {
    return createOutreach(STATE, input);
  }, { description: "Create emergent outreach message", public: false });

  register("emergent", "consent.check", (_ctx, input = {}) => {
    return { ok: true, ...checkContactConsent(STATE, input.emergentId, input.targetUserId, input.lens, input.userPreferences || {}) };
  }, { description: "Check emergent contact consent", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // GROWTH MACROS
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "growth.patterns", (_ctx, input = {}) => {
    return extractPatterns(STATE, input.sessionId, input.promotedClaims || []);
  }, { description: "Extract reasoning patterns from session", public: true });

  register("emergent", "growth.distill", (_ctx, input = {}) => {
    return distillSession(STATE, input.sessionId);
  }, { description: "Distill session into candidate DTUs", public: true });

  register("emergent", "growth.reputation", (_ctx, input = {}) => {
    return processReputationShift(STATE, input.bundleId, input.reviewResult || {});
  }, { description: "Process reputation shifts from review", public: false });

  register("emergent", "growth.contradiction", (_ctx, input = {}) => {
    return recordContradictionCaught(STATE, input.emergentId, input.sessionId);
  }, { description: "Record contradiction caught by emergent", public: false });

  register("emergent", "growth.prediction", (_ctx, input = {}) => {
    return recordPredictionValidated(STATE, input.emergentId, input.predictionRef);
  }, { description: "Record validated prediction", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // LATTICE OPERATIONS (READ / PROPOSE / COMMIT)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "lattice.read", (_ctx, input = {}) => {
    return readDTU(STATE, input.dtuId, input.readerId);
  }, { description: "Read DTU from canonical lattice", public: true });

  register("emergent", "lattice.readStaging", (_ctx, input = {}) => {
    return readStaging(STATE, input.proposalId);
  }, { description: "Read item from staging lattice", public: true });

  register("emergent", "lattice.query", (_ctx, input = {}) => {
    return queryLattice(STATE, input);
  }, { description: "Query canonical lattice with filters", public: true });

  register("emergent", "lattice.proposeDTU", (_ctx, input = {}) => {
    return proposeDTU(STATE, input);
  }, { description: "Propose new DTU into staging", public: false });

  register("emergent", "lattice.proposeEdit", (_ctx, input = {}) => {
    return proposeEdit(STATE, input);
  }, { description: "Propose edit to existing DTU", public: false });

  register("emergent", "lattice.proposeEdge", (_ctx, input = {}) => {
    return proposeEdge(STATE, input);
  }, { description: "Propose new edge between DTUs", public: false });

  register("emergent", "lattice.commit", (_ctx, input = {}) => {
    return commitProposal(STATE, input.proposalId, { gateTrace: input.gateTrace, committedBy: input.committedBy });
  }, { description: "Commit proposal to canonical lattice", public: false });

  register("emergent", "lattice.reject", (_ctx, input = {}) => {
    return rejectProposal(STATE, input.proposalId, input.reason);
  }, { description: "Reject a proposal", public: false });

  register("emergent", "lattice.proposals", (_ctx, input = {}) => {
    return listProposals(STATE, input);
  }, { description: "List lattice proposals", public: true });

  register("emergent", "lattice.metrics", (_ctx) => {
    return getLatticeMetrics(STATE);
  }, { description: "Get lattice operations metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // EDGE SEMANTICS
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "edge.create", (_ctx, input = {}) => {
    return createEdge(STATE, input);
  }, { description: "Create semantic edge between DTUs", public: false });

  register("emergent", "edge.get", (_ctx, input = {}) => {
    return getEdge(STATE, input.edgeId);
  }, { description: "Get edge by ID", public: true });

  register("emergent", "edge.query", (_ctx, input = {}) => {
    return queryEdges(STATE, input);
  }, { description: "Query edges with filters", public: true });

  register("emergent", "edge.update", (_ctx, input = {}) => {
    return updateEdge(STATE, input.edgeId, input);
  }, { description: "Update edge weight/confidence", public: false });

  register("emergent", "edge.remove", (_ctx, input = {}) => {
    return removeEdge(STATE, input.edgeId);
  }, { description: "Remove an edge", public: false });

  register("emergent", "edge.neighborhood", (_ctx, input = {}) => {
    return getNeighborhood(STATE, input.nodeId);
  }, { description: "Get all edges for a node", public: true });

  register("emergent", "edge.paths", (_ctx, input = {}) => {
    return findPaths(STATE, input.fromId, input.toId, input.maxDepth);
  }, { description: "Find paths between two nodes", public: true });

  register("emergent", "edge.metrics", (_ctx) => {
    return getEdgeMetrics(STATE);
  }, { description: "Get edge store metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVATION / ATTENTION
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "activation.activate", (_ctx, input = {}) => {
    return activate(STATE, input.sessionId, input.dtuId, input.score, input.reason);
  }, { description: "Activate a DTU in session context", public: false });

  register("emergent", "activation.spread", (_ctx, input = {}) => {
    return spreadActivation(STATE, input.sessionId, input.sourceDtuId, input.maxHops);
  }, { description: "Spread activation across edges", public: false });

  register("emergent", "activation.workingSet", (_ctx, input = {}) => {
    return getWorkingSet(STATE, input.sessionId, input.k);
  }, { description: "Get top-K activated DTUs for session", public: true });

  register("emergent", "activation.global", (_ctx, input = {}) => {
    return getGlobalActivation(STATE, input.k);
  }, { description: "Get global activation scores", public: true });

  register("emergent", "activation.decay", (_ctx, input = {}) => {
    return decaySession(STATE, input.sessionId, input.factor);
  }, { description: "Decay session activations", public: false });

  register("emergent", "activation.metrics", (_ctx) => {
    return getActivationMetrics(STATE);
  }, { description: "Get activation metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // CONFLICT-SAFE MERGE
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "merge.apply", (_ctx, input = {}) => {
    return fieldLevelMerge(STATE, input.dtuId, input.edits || {}, input.editedBy);
  }, { description: "Apply field-level merge to DTU", public: false });

  register("emergent", "merge.resolve", (_ctx, input = {}) => {
    return resolveConflict(STATE, input.dtuId, input.field, input.resolvedValue, input.resolvedBy);
  }, { description: "Resolve a merge conflict", public: false });

  register("emergent", "merge.conflicts", (_ctx, input = {}) => {
    return getConflicts(STATE, input.dtuId);
  }, { description: "Get merge conflicts for DTU", public: true });

  register("emergent", "merge.timestamps", (_ctx, input = {}) => {
    return getFieldTimestamps(STATE, input.dtuId);
  }, { description: "Get field timestamps for DTU", public: true });

  register("emergent", "merge.metrics", (_ctx) => {
    return getMergeMetrics(STATE);
  }, { description: "Get merge system metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // LATTICE JOURNAL
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "journal.append", (_ctx, input = {}) => {
    return appendEvent(STATE, input.eventType, input.payload || {}, input.meta || {});
  }, { description: "Append event to lattice journal", public: false });

  register("emergent", "journal.byType", (_ctx, input = {}) => {
    return queryByType(STATE, input.eventType, input);
  }, { description: "Query journal events by type", public: true });

  register("emergent", "journal.byEntity", (_ctx, input = {}) => {
    return queryByEntity(STATE, input.entityId, input);
  }, { description: "Query journal events by entity", public: true });

  register("emergent", "journal.bySession", (_ctx, input = {}) => {
    return queryBySession(STATE, input.sessionId, input);
  }, { description: "Query journal events by session", public: true });

  register("emergent", "journal.recent", (_ctx, input = {}) => {
    return getRecentEvents(STATE, input.count);
  }, { description: "Get recent journal events", public: true });

  register("emergent", "journal.explain", (_ctx, input = {}) => {
    return journalExplainDTU(STATE, input.dtuId);
  }, { description: "Explain DTU history from journal", public: true });

  register("emergent", "journal.metrics", (_ctx) => {
    return getJournalMetrics(STATE);
  }, { description: "Get journal metrics", public: true });

  register("emergent", "journal.compact", (_ctx, input = {}) => {
    return compactJournal(STATE, input.retainCount);
  }, { description: "Compact old journal events", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // LIVABLE REALITY
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "reality.continuity", (_ctx, input = {}) => {
    return getContinuity(STATE, input.emergentId);
  }, { description: "Get emergent continuity record", public: true });

  register("emergent", "reality.cost", (_ctx, input = {}) => {
    return computeProposalCost(STATE, input.emergentId, input.domain);
  }, { description: "Compute proposal cost for emergent", public: true });

  register("emergent", "reality.consequences", (_ctx, input = {}) => {
    return processConsequences(STATE, input.emergentId, input.outcome || {});
  }, { description: "Process action consequences", public: false });

  register("emergent", "reality.needs", (_ctx) => {
    return computeLatticeNeeds(STATE);
  }, { description: "Compute current lattice needs", public: true });

  register("emergent", "reality.suggest", (_ctx, input = {}) => {
    return getSuggestedWork(STATE, input.emergentId);
  }, { description: "Get suggested work for emergent", public: true });

  register("emergent", "reality.sociality", (_ctx, input = {}) => {
    return computeSociality(STATE, input.emergentA, input.emergentB);
  }, { description: "Compute alignment between emergents", public: true });

  register("emergent", "reality.explainProposal", (_ctx, input = {}) => {
    return explainProposal(STATE, input.proposalId);
  }, { description: "Explain proposal outcome", public: true });

  register("emergent", "reality.explainTrust", (_ctx, input = {}) => {
    return explainTrust(STATE, input.dtuId);
  }, { description: "Explain why DTU is trusted", public: true });

  register("emergent", "reality.belonging", (_ctx, input = {}) => {
    return getBelonging(STATE, input.emergentId);
  }, { description: "Get emergent belonging context", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // COGNITION SCHEDULER
  // ══════════════════════════════════════════════════════════════════════════

  // -- Work item management --

  register("emergent", "scheduler.createItem", (_ctx, input = {}) => {
    return createWorkItem(STATE, input);
  }, { description: "Create a work item and enqueue it", public: false });

  register("emergent", "scheduler.scan", (_ctx) => {
    return scanAndCreateWorkItems(STATE);
  }, { description: "Scan lattice and auto-create work items", public: false });

  register("emergent", "scheduler.queue", (_ctx) => {
    return getQueue(STATE);
  }, { description: "Get the current work queue", public: true });

  register("emergent", "scheduler.dequeue", (_ctx, input = {}) => {
    return dequeueItem(STATE, input.itemId);
  }, { description: "Remove a work item from the queue", public: false });

  register("emergent", "scheduler.expire", (_ctx) => {
    return expireItems(STATE);
  }, { description: "Expire old work items past deadline", public: false });

  // -- Priority scoring --

  register("emergent", "scheduler.rescore", (_ctx) => {
    return rescoreQueue(STATE);
  }, { description: "Re-score all queued items", public: false });

  register("emergent", "scheduler.updateWeights", (_ctx, input = {}) => {
    return updateWeights(STATE, input.weights || {});
  }, { description: "Update priority signal weights", public: false });

  // -- Attention budget --

  register("emergent", "scheduler.budget", (_ctx) => {
    return getBudgetStatus(STATE);
  }, { description: "Get current attention budget status", public: true });

  register("emergent", "scheduler.checkBudget", (_ctx, input = {}) => {
    return checkBudget(STATE, input.userId);
  }, { description: "Check if budget allows new work", public: true });

  register("emergent", "scheduler.updateBudget", (_ctx, input = {}) => {
    return updateBudget(STATE, input);
  }, { description: "Override budget parameters", public: false });

  // -- Allocator --

  register("emergent", "scheduler.allocate", (_ctx, input = {}) => {
    return allocate(STATE, input);
  }, { description: "Allocate top-K work items to emergents", public: false });

  register("emergent", "scheduler.allocation", (_ctx, input = {}) => {
    return getAllocation(STATE, input.allocationId);
  }, { description: "Get a specific allocation", public: true });

  register("emergent", "scheduler.active", (_ctx) => {
    return getActiveAllocations(STATE);
  }, { description: "Get active allocations", public: true });

  register("emergent", "scheduler.recordTurn", (_ctx, input = {}) => {
    return recordTurn(STATE, input.allocationId);
  }, { description: "Record a turn used by an allocation", public: false });

  register("emergent", "scheduler.recordProposal", (_ctx, input = {}) => {
    return recordProposal(STATE, input.allocationId, input.proposalId);
  }, { description: "Record a proposal emitted by an allocation", public: false });

  // -- Completion --

  register("emergent", "scheduler.complete", (_ctx, input = {}) => {
    return completeAllocation(STATE, input.allocationId, input);
  }, { description: "Complete an allocation with summary", public: false });

  register("emergent", "scheduler.completed", (_ctx, input = {}) => {
    return getCompletedWork(STATE, input.limit);
  }, { description: "Get completed work history", public: true });

  // -- Metrics --

  register("emergent", "scheduler.metrics", (_ctx) => {
    return getSchedulerMetrics(STATE);
  }, { description: "Get scheduler metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIT / STATUS
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "status", (_ctx) => {
    return { ok: true, ...getSystemStatus(STATE) };
  }, { description: "Get emergent system status", public: true });

  register("emergent", "gate.trace", (_ctx, input = {}) => {
    if (input.traceId) {
      const trace = getGateTrace(es, input.traceId);
      return trace ? { ok: true, trace } : { ok: false, error: "not_found" };
    }
    if (input.sessionId) {
      return { ok: true, traces: getGateTracesForSession(es, input.sessionId) };
    }
    return { ok: false, error: "provide traceId or sessionId" };
  }, { description: "Get gate traces for auditing", public: true });

  register("emergent", "bundle.get", (_ctx, input = {}) => {
    const bundle = getOutputBundle(es, input.bundleId);
    if (!bundle) return { ok: false, error: "not_found" };
    return { ok: true, bundle };
  }, { description: "Get output bundle", public: true });

  register("emergent", "patterns", (_ctx, input = {}) => {
    return { ok: true, patterns: getPatterns(es, { role: input.role, emergentId: input.emergentId }) };
  }, { description: "List learned reasoning patterns", public: true });

  register("emergent", "reputation", (_ctx, input = {}) => {
    const rep = getReputation(es, input.emergentId);
    if (!rep) return { ok: false, error: "not_found" };
    return { ok: true, reputation: rep };
  }, { description: "Get emergent reputation", public: true });

  register("emergent", "schema", (_ctx) => {
    return {
      ok: true,
      version: EMERGENT_VERSION,
      roles: ALL_ROLES,
      capabilities: Object.values(CAPABILITIES),
      confidenceLabels: ALL_CONFIDENCE_LABELS,
      intentTypes: Object.values(INTENT_TYPES),
      memoryPolicies: Object.values(MEMORY_POLICIES),
      gateRules: Object.values(GATE_RULES),
      tierThresholds: TIER_THRESHOLDS,
      sessionLimits: SESSION_LIMITS,
      edgeTypes: ALL_EDGE_TYPES,
      journalEventTypes: Object.values(JOURNAL_EVENTS),
      workItemTypes: ALL_WORK_ITEM_TYPES,
      stopReasons: Object.values(STOP_REASONS),
      defaultWeights: DEFAULT_WEIGHTS,
      defaultBudget: DEFAULT_BUDGET,
    };
  }, { description: "Get emergent system schema", public: true });

  if (helpers?.log) {
    helpers.log("emergent.init", `Emergent Agent Governance v${EMERGENT_VERSION} initialized`);
  }

  return {
    ok: true,
    version: EMERGENT_VERSION,
    macroCount: 80,
  };
}

export {
  EMERGENT_VERSION,
  init,
};
