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
  ALL_ROLES,
  CAPABILITIES,
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
  ALL_EDGE_TYPES,
  createEdge, getEdge, queryEdges, updateEdge, removeEdge,
  getNeighborhood, findPaths, getEdgeMetrics,
} from "./edges.js";

import {
  activate, spreadActivation, getWorkingSet,
  getGlobalActivation, decaySession,
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
  recordWorkCompletion, getWorkCompletions,
  cascadeContradictionConsequences,
  computeTransitiveTrust,
} from "./reality.js";

// ── Sector System (13-layer depth architecture) ──────────────────────────────

import {
  SECTORS, ALL_SECTORS, SECTOR_BY_ID, SECTOR_BY_NAME,
  MATURITY_REQUIREMENTS, ROLE_SECTOR_AFFINITY, MODULE_SECTOR_MAP,
  canAccessSector, getAccessibleSectors, computeMaturityLevel,
  checkNoiseFloor, getHomeSector, routeCrossSector,
  getSectorHealth, getOperationSector, getSectorMetrics,
} from "./sectors.js";

// ── State Persistence ────────────────────────────────────────────────────────

import {
  persistEmergentState, loadEmergentState,
  startAutoPersist, stopAutoPersist,
  getPersistenceMetrics,
} from "./persistence.js";

// ── Entity Emergence Detection ───────────────────────────────────────────────

import {
  ENTITY_THRESHOLDS,
  detectEntityEmergence, scanForEmergence,
  getEmergedEntities, getEntityEmergenceMetrics,
} from "./entity-emergence.js";

// ── Bootstrap Ingestion ──────────────────────────────────────────────────────

import {
  runBootstrapIngestion, loadSeedPacks, getIngestionMetrics,
} from "./bootstrap-ingestion.js";

// ── Cognition Scheduler imports ─────────────────────────────────────────────

import {
  ALL_WORK_ITEM_TYPES, STOP_REASONS,
  DEFAULT_WEIGHTS, DEFAULT_BUDGET,
  createWorkItem, scanAndCreateWorkItems,
  rescoreQueue, updateWeights,
  checkBudget, getBudgetStatus, updateBudget,
  allocate, getAllocation, recordTurn, recordProposal,
  completeAllocation,
  getQueue, getActiveAllocations, getCompletedWork,
  dequeueItem, expireItems,
  getSchedulerMetrics,
} from "./scheduler.js";

// ── Outcome Signals + Scheduler Learning (Stage 1-2) ────────────────────────

import {
  ALL_OUTCOME_SIGNALS,
  recordOutcome, getOutcomesForWorkItem, getOutcomesForAllocation,
  getOutcomesForEmergent, getOutcomeStats,
  runWeightLearning, getAssignmentRecommendations, getWeightHistory,
} from "./outcomes.js";

// ── Skill Formation (Stage 3) ───────────────────────────────────────────────

import {
  ALL_SKILL_TYPES, SKILL_MATURITY,
  createReasoningTemplate, createMacroPlaybook, createTestBundle,
  recordSkillApplication, getSkill, querySkills, findMatchingSkills,
  distillPatternsToSkills, deprecateSkill, getSkillMetrics,
} from "./skills.js";

// ── Long-Horizon Projects (Stage 4) ─────────────────────────────────────────

import {
  PROJECT_STATUS, NODE_STATUS,
  createProject, addNode, startProject,
  getReadyNodes, scheduleReadyNodes, completeNode, failNode,
  pauseProject, resumeProject, cancelProject,
  getProject, listProjects, getProjectMetrics,
} from "./projects.js";

// ── Institutional Memory (Stage 5) ──────────────────────────────────────────

import {
  ALL_MEMORY_CATEGORIES,
  recordObservation, recordFailure, recordSuccess,
  createAdvisory, getActiveAdvisories, acknowledgeAdvisory, dismissAdvisory,
  queryObservations, getFailureRates, getRecurrences, getStabilityMap,
  getInstitutionalMemoryMetrics,
} from "./institutional-memory.js";

// ── Evidence Objects + Truth Maintenance (Stage 6) ──────────────────────────

import {
  ALL_EPISTEMIC_STATUSES, ALL_EVIDENCE_TYPES,
  attachEvidence, getEvidenceForDtu, supersedeEvidence,
  recomputeEpistemicStatus, deprecateDtu, retractDtu,
  getMaintenanceHistory, getDtusByStatus, getConfidenceMap, getEvidenceMetrics,
} from "./evidence.js";

// ── Verification Pipelines (Stage 6) ────────────────────────────────────────

import {
  ALL_CHECK_TYPES, CHECK_RESULTS,
  createPipeline, getPipeline, listPipelines,
  runPipeline, verifyDtu, getVerificationHistory, getVerificationMetrics,
} from "./verification-pipeline.js";

// ── Goal Formation (Stage 8) ────────────────────────────────────────────────

import {
  ALL_GOAL_TYPES,
  scanForGoals, scheduleGoal, completeGoal, dismissGoal,
  getActiveGoals, updateThresholds, getGoalMetrics,
} from "./goals.js";

// ── Constitution / Norms & Invariants (Stage 9) ─────────────────────────────

import {
  ALL_RULE_TIERS, RULE_CATEGORIES, VIOLATION_SEVERITY,
  getConstitutionStore,
  addRule, amendRule, deactivateRule,
  checkRules, getRules, getRule,
  getAmendmentHistory, getViolationHistory, getConstitutionMetrics,
} from "./constitution.js";

// ── Threat Surface Hardening (Risk Category 1) ──────────────────────────────

import {
  ALL_COST_TIERS,
  registerRouteCost, registerRouteCosts,
  checkRateLimit, checkCostBudget,
  auditEndpoints, analyzeUserActivity,
  blockUser, unblockUser, updateThreatConfig, getThreatMetrics,
} from "./threat-surface.js";

// ── Injection Defense (Risk Category 2) ─────────────────────────────────────

import {
  ALL_INJECTION_TYPES, THREAT_LEVELS,
  scanContent, scanDtu, checkCrossLensLeak,
  addCustomPattern, getInjectionMetrics, getInjectionIncidents,
} from "./injection-defense.js";

// ── Drift Monitor (Risk Category 3) ─────────────────────────────────────────

import {
  ALL_DRIFT_TYPES, DRIFT_SEVERITY,
  runDriftScan, getDriftAlerts, updateDriftThresholds,
  getDriftMetrics, getSnapshots,
} from "./drift-monitor.js";

// ── Schema Guard (Risk Category 4) ──────────────────────────────────────────

import {
  CURRENT_DTU_SCHEMA_VERSION,
  validateDtuSchema, migrateDtu, scanForMigrations,
  validateMergeResult, recordTimestamp, verifyEventOrdering,
  getSchemaGuardMetrics,
} from "./schema-guard.js";

// ── Deep Health (Risk Category 5) ───────────────────────────────────────────

import {
  HEALTH_STATUS,
  runDeepHealthCheck, getHealthHistory, getDegradationHistory,
  updateHealthThresholds, getDeepHealthMetrics,
} from "./deep-health.js";

// ── Content Shield (Risk Category 6) ────────────────────────────────────────

import {
  ALL_PII_TYPES, ALL_ADVICE_DOMAINS, CONTENT_RISK,
  detectPii, detectCopyrightSignals, checkAdviceFraming, scanContentFull,
  setDisclaimer, getAllDisclaimers,
  updateContentShieldConfig, getContentShieldMetrics,
} from "./content-shield.js";

// ── Action Slots (UX Architecture) ──────────────────────────────────────────

import {
  ALL_SLOT_POSITIONS, ALL_RESULT_STATES,
  registerSlotConfig, getSlotConfig, getAllSlotConfigs, getSlotLabel,
  recordInvocation, makeResult, unregisterSlotConfig,
  getInvocations, getResultDistribution, auditSlotCoverage,
  getFailureRates as getSlotFailureRates, getActionSlotMetrics,
} from "./action-slots.js";

// ── Autogen Pipeline (6-Stage Knowledge Synthesis) ───────────────────────────

import {
  ALL_INTENTS, VARIANT_INTENTS, ESCALATION_REASONS,
  ensurePipelineState,
  selectIntent, buildRetrievalPack,
  builderPhase, criticPhase, synthesizerPhase,
  noveltyCheck, determineWritePolicy,
  formatCandidateAsGRC,
  runPipeline as runAutogenPipeline,
  getPipelineMetrics,
} from "./autogen-pipeline.js";

// ── Empirical Gates (Math / Units / Physical Constants) ──────────────────────

import {
  evalMathExpression, parseUnitExpr, convertUnits,
  checkUnits, invarianceCheck,
  PHYS_CONSTANTS,
  extractNumericClaims, extractMathExpressions, extractConstantReferences,
  runEmpiricalGates, getEmpiricalGateInfo,
} from "./empirical-gates.js";

// ── Scope Separation (Global / Marketplace / Local) ─────────────────────────

import {
  SCOPES, ALL_SCOPES, ALL_DTU_CLASSES,
  HEARTBEAT_CONFIG,
  checkInfluence, isValidScope, isUpwardPromotion,
  ensureScopeState, assignScope, getDtuScope,
  validateGlobalDtu, validateMarketplaceListing,
  promoteDtu,
  gateCreateDtu, gateHeartbeatOp, gateMarketplaceAnalytics,
  recordMarketplaceAnalytics, runGlobalTick,
  listDtusByScope, getPromotionHistory, getOverrideLog,
  getMarketplaceAnalytics, getScopeMetrics,
} from "./scope-separation.js";

// ── Capability Bridge (Cross-System Integration) ─────────────────────────────

import {
  autoHypothesisFromConflicts,
  getPipelineStrategyHints, recordPipelineOutcomeToMetaLearning,
  dedupGate, scanRecentDuplicates,
  runBeaconCheck,
  lensCheckScope, lensValidateEmpirically,
  runHeartbeatBridgeTick, ensureBaselineStrategies,
  getCapabilityBridgeInfo,
} from "./capability-bridge.js";

const EMERGENT_VERSION = "5.5.0";

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

  register("emergent", "reality.recordWork", (_ctx, input = {}) => {
    return recordWorkCompletion(STATE, input.emergentId, input.needType, input.result, input.details || {});
  }, { description: "Record work completion for purpose tracking", public: false });

  register("emergent", "reality.workHistory", (_ctx, input = {}) => {
    return getWorkCompletions(STATE, input.emergentId);
  }, { description: "Get work completion history for emergent", public: true });

  register("emergent", "reality.cascadeContradiction", (_ctx, input = {}) => {
    return cascadeContradictionConsequences(STATE, input.contradictedDtuId, input.contradictorId, input.details || {});
  }, { description: "Cascade contradiction consequences to original promoters", public: false });

  register("emergent", "reality.transitiveTrust", (_ctx, input = {}) => {
    return computeTransitiveTrust(STATE, input.emergentId);
  }, { description: "Compute transitive trust network for emergent", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTOR SYSTEM (13-layer depth architecture)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "sector.list", (_ctx) => {
    return { ok: true, sectors: ALL_SECTORS, count: ALL_SECTORS.length };
  }, { description: "List all 13 sectors", public: true });

  register("emergent", "sector.get", (_ctx, input = {}) => {
    const sector = SECTOR_BY_ID[input.sectorId] || SECTOR_BY_NAME[input.name];
    if (!sector) return { ok: false, error: "sector_not_found" };
    return { ok: true, sector };
  }, { description: "Get sector by ID or name", public: true });

  register("emergent", "sector.access", (_ctx, input = {}) => {
    return getAccessibleSectors(STATE, input.emergentId);
  }, { description: "Get sectors accessible by an emergent", public: true });

  register("emergent", "sector.home", (_ctx, input = {}) => {
    return getHomeSector(STATE, input.emergentId);
  }, { description: "Get home sector for an emergent", public: true });

  register("emergent", "sector.noiseFloor", (_ctx, input = {}) => {
    return checkNoiseFloor(input.sectorId, input.signalQuality);
  }, { description: "Check signal quality against sector noise floor", public: true });

  register("emergent", "sector.route", (_ctx, input = {}) => {
    return routeCrossSector(STATE, input.emergentId, input.fromSectorId, input.toSectorId, input.payload || {});
  }, { description: "Route cross-sector communication", public: false });

  register("emergent", "sector.health", (_ctx) => {
    return getSectorHealth(STATE);
  }, { description: "Get health metrics for all sectors", public: true });

  register("emergent", "sector.moduleMap", (_ctx, input = {}) => {
    if (input.moduleKey) {
      const sector = getOperationSector(input.moduleKey);
      return { ok: true, moduleKey: input.moduleKey, sector };
    }
    return { ok: true, map: MODULE_SECTOR_MAP };
  }, { description: "Get sector assignment for a module", public: true });

  register("emergent", "sector.metrics", (_ctx) => {
    return getSectorMetrics(STATE);
  }, { description: "Get sector system metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // ENTITY EMERGENCE DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "entity.detect", (_ctx, input = {}) => {
    return detectEntityEmergence(STATE, input.emergentId);
  }, { description: "Detect entity emergence for an emergent", public: true });

  register("emergent", "entity.scan", (_ctx) => {
    return scanForEmergence(STATE);
  }, { description: "Scan all emergents for entity emergence", public: true });

  register("emergent", "entity.list", (_ctx) => {
    return getEmergedEntities(STATE);
  }, { description: "List all emerged entities", public: true });

  register("emergent", "entity.metrics", (_ctx) => {
    return getEntityEmergenceMetrics(STATE);
  }, { description: "Get entity emergence metrics", public: true });

  register("emergent", "entity.thresholds", (_ctx) => {
    return { ok: true, thresholds: ENTITY_THRESHOLDS };
  }, { description: "Get entity emergence thresholds", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // STATE PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "persist.save", (_ctx, input = {}) => {
    return persistEmergentState(STATE, input);
  }, { description: "Persist emergent state to disk", public: false });

  register("emergent", "persist.load", (_ctx, input = {}) => {
    return loadEmergentState(STATE, input);
  }, { description: "Load persisted emergent state from disk", public: false });

  register("emergent", "persist.startAuto", (_ctx, input = {}) => {
    return startAutoPersist(STATE, input);
  }, { description: "Start periodic auto-persistence", public: false });

  register("emergent", "persist.stopAuto", (_ctx) => {
    return stopAutoPersist(STATE);
  }, { description: "Stop auto-persistence and do final persist", public: false });

  register("emergent", "persist.metrics", (_ctx) => {
    return getPersistenceMetrics();
  }, { description: "Get persistence layer metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // BOOTSTRAP INGESTION
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "ingest.run", (_ctx, input = {}) => {
    const seeds = input.seeds || [];
    return runBootstrapIngestion(STATE, seeds, {
      dryRun: input.dryRun || false,
      log: helpers?.log || (() => {}),
    });
  }, { description: "Run bootstrap ingestion pipeline on seed DTUs", public: false });

  register("emergent", "ingest.loadSeeds", (_ctx, input = {}) => {
    const dataDir = input.dataDir || "data";
    return loadSeedPacks(dataDir);
  }, { description: "Load seed DTU packs from disk", public: true });

  register("emergent", "ingest.metrics", (_ctx) => {
    return getIngestionMetrics(STATE);
  }, { description: "Get bootstrap ingestion metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // GRC FORMATTING FOR PIPELINE
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "pipeline.formatGRC", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return formatCandidateAsGRC(input.candidate, input.pack || { core: [], peripheral: [] }, {
      STATE,
      inLatticeReality: helpers?.inLatticeReality || null,
    });
  }, { description: "Format pipeline candidate as GRC v1 output", public: true });

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
  // OUTCOME SIGNALS + SCHEDULER LEARNING (Stage 1-2)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "outcome.record", (_ctx, input = {}) => {
    return recordOutcome(STATE, input);
  }, { description: "Record an outcome signal for a work item", public: false });

  register("emergent", "outcome.forWorkItem", (_ctx, input = {}) => {
    return getOutcomesForWorkItem(STATE, input.workItemId);
  }, { description: "Get outcomes for a work item", public: true });

  register("emergent", "outcome.forAllocation", (_ctx, input = {}) => {
    return getOutcomesForAllocation(STATE, input.allocationId);
  }, { description: "Get outcomes for an allocation", public: true });

  register("emergent", "outcome.forEmergent", (_ctx, input = {}) => {
    return getOutcomesForEmergent(STATE, input.emergentId);
  }, { description: "Get outcomes for an emergent", public: true });

  register("emergent", "outcome.stats", (_ctx) => {
    return getOutcomeStats(STATE);
  }, { description: "Get outcome statistics", public: true });

  register("emergent", "outcome.learn", (_ctx, input = {}) => {
    return runWeightLearning(STATE, input);
  }, { description: "Run scheduler weight learning cycle", public: false });

  register("emergent", "outcome.recommendations", (_ctx, input = {}) => {
    return getAssignmentRecommendations(STATE, input.minSamples);
  }, { description: "Get role assignment recommendations", public: true });

  register("emergent", "outcome.weightHistory", (_ctx) => {
    return getWeightHistory(STATE);
  }, { description: "Get weight learning history", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // SKILL FORMATION (Stage 3)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "skill.createTemplate", (_ctx, input = {}) => {
    return createReasoningTemplate(STATE, input);
  }, { description: "Create a reasoning template skill", public: false });

  register("emergent", "skill.createPlaybook", (_ctx, input = {}) => {
    return createMacroPlaybook(STATE, input);
  }, { description: "Create a macro playbook skill", public: false });

  register("emergent", "skill.createTestBundle", (_ctx, input = {}) => {
    return createTestBundle(STATE, input);
  }, { description: "Create a test bundle skill", public: false });

  register("emergent", "skill.recordApplication", (_ctx, input = {}) => {
    return recordSkillApplication(STATE, input.skillId, input.succeeded, input.context || {});
  }, { description: "Record skill application outcome", public: false });

  register("emergent", "skill.get", (_ctx, input = {}) => {
    return getSkill(STATE, input.skillId);
  }, { description: "Get a specific skill", public: true });

  register("emergent", "skill.query", (_ctx, input = {}) => {
    return querySkills(STATE, input);
  }, { description: "Query skills with filters", public: true });

  register("emergent", "skill.findMatching", (_ctx, input = {}) => {
    return findMatchingSkills(STATE, input);
  }, { description: "Find skills matching a work context", public: true });

  register("emergent", "skill.distill", (_ctx, input = {}) => {
    return distillPatternsToSkills(STATE, input);
  }, { description: "Distill patterns into reusable skills", public: false });

  register("emergent", "skill.deprecate", (_ctx, input = {}) => {
    return deprecateSkill(STATE, input.skillId, input.reason);
  }, { description: "Deprecate a skill", public: false });

  register("emergent", "skill.metrics", (_ctx) => {
    return getSkillMetrics(STATE);
  }, { description: "Get skill formation metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // LONG-HORIZON PROJECTS (Stage 4)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "project.create", (_ctx, input = {}) => {
    return createProject(STATE, input);
  }, { description: "Create a new project", public: false });

  register("emergent", "project.addNode", (_ctx, input = {}) => {
    return addNode(STATE, input.projectId, input);
  }, { description: "Add a node to project DAG", public: false });

  register("emergent", "project.start", (_ctx, input = {}) => {
    return startProject(STATE, input.projectId);
  }, { description: "Start a draft project", public: false });

  register("emergent", "project.readyNodes", (_ctx, input = {}) => {
    return getReadyNodes(STATE, input.projectId);
  }, { description: "Get schedulable nodes", public: true });

  register("emergent", "project.schedule", (_ctx, input = {}) => {
    return scheduleReadyNodes(STATE, input.projectId, input.maxItems);
  }, { description: "Schedule ready nodes as work items", public: false });

  register("emergent", "project.completeNode", (_ctx, input = {}) => {
    return completeNode(STATE, input.projectId, input.nodeId, input.result);
  }, { description: "Complete a project node", public: false });

  register("emergent", "project.failNode", (_ctx, input = {}) => {
    return failNode(STATE, input.projectId, input.nodeId, input.reason);
  }, { description: "Mark a project node as failed", public: false });

  register("emergent", "project.pause", (_ctx, input = {}) => {
    return pauseProject(STATE, input.projectId);
  }, { description: "Pause a project", public: false });

  register("emergent", "project.resume", (_ctx, input = {}) => {
    return resumeProject(STATE, input.projectId);
  }, { description: "Resume a paused project", public: false });

  register("emergent", "project.cancel", (_ctx, input = {}) => {
    return cancelProject(STATE, input.projectId, input.reason);
  }, { description: "Cancel a project", public: false });

  register("emergent", "project.get", (_ctx, input = {}) => {
    return getProject(STATE, input.projectId);
  }, { description: "Get a project", public: true });

  register("emergent", "project.list", (_ctx, input = {}) => {
    return listProjects(STATE, input);
  }, { description: "List projects", public: true });

  register("emergent", "project.metrics", (_ctx) => {
    return getProjectMetrics(STATE);
  }, { description: "Get project metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // INSTITUTIONAL MEMORY (Stage 5)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "memory.record", (_ctx, input = {}) => {
    return recordObservation(STATE, input);
  }, { description: "Record an institutional memory observation", public: false });

  register("emergent", "memory.recordFailure", (_ctx, input = {}) => {
    return recordFailure(STATE, input);
  }, { description: "Record a failure for tracking", public: false });

  register("emergent", "memory.recordSuccess", (_ctx, input = {}) => {
    return recordSuccess(STATE, input);
  }, { description: "Record a success for tracking", public: false });

  register("emergent", "memory.advisory.create", (_ctx, input = {}) => {
    return createAdvisory(STATE, input);
  }, { description: "Create an operational advisory", public: false });

  register("emergent", "memory.advisory.active", (_ctx, input = {}) => {
    return getActiveAdvisories(STATE, input);
  }, { description: "Get active advisories", public: true });

  register("emergent", "memory.advisory.acknowledge", (_ctx, input = {}) => {
    return acknowledgeAdvisory(STATE, input.advisoryId);
  }, { description: "Acknowledge an advisory", public: false });

  register("emergent", "memory.advisory.dismiss", (_ctx, input = {}) => {
    return dismissAdvisory(STATE, input.advisoryId);
  }, { description: "Dismiss an advisory", public: false });

  register("emergent", "memory.query", (_ctx, input = {}) => {
    return queryObservations(STATE, input);
  }, { description: "Query institutional memory observations", public: true });

  register("emergent", "memory.failureRates", (_ctx) => {
    return getFailureRates(STATE);
  }, { description: "Get failure rates", public: true });

  register("emergent", "memory.recurrences", (_ctx, input = {}) => {
    return getRecurrences(STATE, input.minCount);
  }, { description: "Get recurring issues", public: true });

  register("emergent", "memory.stability", (_ctx) => {
    return getStabilityMap(STATE);
  }, { description: "Get lattice stability map", public: true });

  register("emergent", "memory.metrics", (_ctx) => {
    return getInstitutionalMemoryMetrics(STATE);
  }, { description: "Get institutional memory metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // EVIDENCE + TRUTH MAINTENANCE (Stage 6)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "evidence.attach", (_ctx, input = {}) => {
    return attachEvidence(STATE, input);
  }, { description: "Attach evidence to a DTU", public: false });

  register("emergent", "evidence.forDtu", (_ctx, input = {}) => {
    return getEvidenceForDtu(STATE, input.dtuId);
  }, { description: "Get evidence for a DTU", public: true });

  register("emergent", "evidence.supersede", (_ctx, input = {}) => {
    return supersedeEvidence(STATE, input.oldEvidenceId, input.newEvidenceId);
  }, { description: "Supersede old evidence with new", public: false });

  register("emergent", "evidence.recompute", (_ctx, input = {}) => {
    const changed = recomputeEpistemicStatus(STATE, input.dtuId);
    return { ok: true, changed };
  }, { description: "Recompute epistemic status for a DTU", public: false });

  register("emergent", "evidence.deprecate", (_ctx, input = {}) => {
    return deprecateDtu(STATE, input.dtuId, input.reason, input.supersededBy);
  }, { description: "Deprecate a DTU's epistemic status", public: false });

  register("emergent", "evidence.retract", (_ctx, input = {}) => {
    return retractDtu(STATE, input.dtuId, input.reason, input.evidenceId);
  }, { description: "Retract a DTU (evidence proved it wrong)", public: false });

  register("emergent", "evidence.history", (_ctx, input = {}) => {
    return getMaintenanceHistory(STATE, input.dtuId);
  }, { description: "Get truth maintenance history for DTU", public: true });

  register("emergent", "evidence.byStatus", (_ctx, input = {}) => {
    return getDtusByStatus(STATE, input.status);
  }, { description: "Get DTUs by epistemic status", public: true });

  register("emergent", "evidence.confidence", (_ctx, input = {}) => {
    return getConfidenceMap(STATE, input);
  }, { description: "Get confidence scores across lattice", public: true });

  register("emergent", "evidence.metrics", (_ctx) => {
    return getEvidenceMetrics(STATE);
  }, { description: "Get evidence system metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // VERIFICATION PIPELINES (Stage 6)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "verify.createPipeline", (_ctx, input = {}) => {
    return createPipeline(STATE, input);
  }, { description: "Create a verification pipeline", public: false });

  register("emergent", "verify.getPipeline", (_ctx, input = {}) => {
    return getPipeline(STATE, input.pipelineId);
  }, { description: "Get a verification pipeline", public: true });

  register("emergent", "verify.listPipelines", (_ctx, input = {}) => {
    return listPipelines(STATE, input);
  }, { description: "List verification pipelines", public: true });

  register("emergent", "verify.run", (_ctx, input = {}) => {
    return runPipeline(STATE, input.pipelineId, input.dtuId, input);
  }, { description: "Run a verification pipeline against a DTU", public: false });

  register("emergent", "verify.dtu", (_ctx, input = {}) => {
    return verifyDtu(STATE, input.dtuId, input);
  }, { description: "Run all applicable pipelines against a DTU", public: false });

  register("emergent", "verify.history", (_ctx, input = {}) => {
    return getVerificationHistory(STATE, input.dtuId);
  }, { description: "Get verification history for a DTU", public: true });

  register("emergent", "verify.metrics", (_ctx) => {
    return getVerificationMetrics(STATE);
  }, { description: "Get verification pipeline metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // GOAL FORMATION (Stage 8)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "goal.scan", (_ctx) => {
    return scanForGoals(STATE);
  }, { description: "Scan for system-generated goals", public: false });

  register("emergent", "goal.schedule", (_ctx, input = {}) => {
    return scheduleGoal(STATE, input.goalId);
  }, { description: "Schedule a goal as a work item", public: false });

  register("emergent", "goal.complete", (_ctx, input = {}) => {
    return completeGoal(STATE, input.goalId, input.outcome);
  }, { description: "Mark a goal as completed", public: false });

  register("emergent", "goal.dismiss", (_ctx, input = {}) => {
    return dismissGoal(STATE, input.goalId, input.reason);
  }, { description: "Dismiss a goal", public: false });

  register("emergent", "goal.active", (_ctx, input = {}) => {
    return getActiveGoals(STATE, input);
  }, { description: "Get active goals", public: true });

  register("emergent", "goal.thresholds", (_ctx, input = {}) => {
    return updateThresholds(STATE, input);
  }, { description: "Update goal detection thresholds", public: false });

  register("emergent", "goal.metrics", (_ctx) => {
    return getGoalMetrics(STATE);
  }, { description: "Get goal formation metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTITUTION / NORMS & INVARIANTS (Stage 9)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "constitution.addRule", (_ctx, input = {}) => {
    return addRule(STATE, input);
  }, { description: "Add a constitutional or policy rule", public: false });

  register("emergent", "constitution.amend", (_ctx, input = {}) => {
    return amendRule(STATE, input.ruleId, input);
  }, { description: "Amend a constitutional rule", public: false });

  register("emergent", "constitution.deactivate", (_ctx, input = {}) => {
    return deactivateRule(STATE, input.ruleId);
  }, { description: "Deactivate a policy rule", public: false });

  register("emergent", "constitution.check", (_ctx, input = {}) => {
    return checkRules(STATE, input);
  }, { description: "Check action against constitutional rules", public: true });

  register("emergent", "constitution.rules", (_ctx, input = {}) => {
    return getRules(STATE, input);
  }, { description: "List constitutional rules", public: true });

  register("emergent", "constitution.rule", (_ctx, input = {}) => {
    return getRule(STATE, input.ruleId);
  }, { description: "Get a specific rule", public: true });

  register("emergent", "constitution.amendments", (_ctx, input = {}) => {
    return getAmendmentHistory(STATE, input.ruleId);
  }, { description: "Get amendment history", public: true });

  register("emergent", "constitution.violations", (_ctx, input = {}) => {
    return getViolationHistory(STATE, input);
  }, { description: "Get violation history", public: true });

  register("emergent", "constitution.metrics", (_ctx) => {
    return getConstitutionMetrics(STATE);
  }, { description: "Get constitution metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // THREAT SURFACE HARDENING (Risk Category 1)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "threat.registerCost", (_ctx, input = {}) => {
    return registerRouteCost(STATE, input.macroName, input.tier, input);
  }, { description: "Register route cost tier", public: false });

  register("emergent", "threat.registerCosts", (_ctx, input = {}) => {
    return registerRouteCosts(STATE, input.costMap || {});
  }, { description: "Bulk register route cost tiers", public: false });

  register("emergent", "threat.checkRate", (_ctx, input = {}) => {
    return checkRateLimit(STATE, input.userId, input.macroName);
  }, { description: "Check tiered rate limit", public: true });

  register("emergent", "threat.checkCost", (_ctx, input = {}) => {
    return checkCostBudget(STATE, input.userId, input.macroName);
  }, { description: "Check cost budget", public: true });

  register("emergent", "threat.audit", (_ctx) => {
    return auditEndpoints(STATE);
  }, { description: "Audit endpoint protection", public: true });

  register("emergent", "threat.analyze", (_ctx, input = {}) => {
    return analyzeUserActivity(STATE, input.userId);
  }, { description: "Analyze user for suspicious patterns", public: false });

  register("emergent", "threat.block", (_ctx, input = {}) => {
    return blockUser(STATE, input.userId, input.reason);
  }, { description: "Temporarily block a user", public: false });

  register("emergent", "threat.unblock", (_ctx, input = {}) => {
    return unblockUser(STATE, input.userId);
  }, { description: "Unblock a user", public: false });

  register("emergent", "threat.config", (_ctx, input = {}) => {
    return updateThreatConfig(STATE, input);
  }, { description: "Update threat surface configuration", public: false });

  register("emergent", "threat.metrics", (_ctx) => {
    return getThreatMetrics(STATE);
  }, { description: "Get threat surface metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // INJECTION DEFENSE (Risk Category 2)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "injection.scan", (_ctx, input = {}) => {
    return scanContent(STATE, input.content, input);
  }, { description: "Scan content for injection attempts", public: false });

  register("emergent", "injection.scanDtu", (_ctx, input = {}) => {
    return scanDtu(STATE, input.dtu || input, input);
  }, { description: "Scan DTU fields for injection", public: false });

  register("emergent", "injection.crossLens", (_ctx, input = {}) => {
    return checkCrossLensLeak(STATE, input.content, input.currentLens, input.allLenses || []);
  }, { description: "Check cross-lens contamination", public: false });

  register("emergent", "injection.addPattern", (_ctx, input = {}) => {
    return addCustomPattern(STATE, input.pattern, input);
  }, { description: "Add custom injection pattern", public: false });

  register("emergent", "injection.incidents", (_ctx, input = {}) => {
    return getInjectionIncidents(STATE, input);
  }, { description: "Get injection incidents", public: true });

  register("emergent", "injection.metrics", (_ctx) => {
    return getInjectionMetrics(STATE);
  }, { description: "Get injection defense metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // DRIFT MONITOR (Risk Category 3)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "drift.scan", (_ctx) => {
    return runDriftScan(STATE);
  }, { description: "Run comprehensive drift scan", public: false });

  register("emergent", "drift.alerts", (_ctx, input = {}) => {
    return getDriftAlerts(STATE, input);
  }, { description: "Get drift alerts", public: true });

  register("emergent", "drift.thresholds", (_ctx, input = {}) => {
    return updateDriftThresholds(STATE, input);
  }, { description: "Update drift thresholds", public: false });

  register("emergent", "drift.snapshots", (_ctx, input = {}) => {
    return getSnapshots(STATE, input.count);
  }, { description: "Get system snapshots", public: true });

  register("emergent", "drift.metrics", (_ctx) => {
    return getDriftMetrics(STATE);
  }, { description: "Get drift monitor metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEMA GUARD (Risk Category 4)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "schema.validate", (_ctx, input = {}) => {
    return validateDtuSchema(STATE, input.dtu || input);
  }, { description: "Validate DTU against schema", public: true });

  register("emergent", "schema.migrate", (_ctx, input = {}) => {
    return migrateDtu(STATE, input.dtu || input);
  }, { description: "Migrate DTU to latest schema", public: false });

  register("emergent", "schema.scanMigrations", (_ctx) => {
    return scanForMigrations(STATE);
  }, { description: "Scan for DTUs needing migration", public: true });

  register("emergent", "schema.validateMerge", (_ctx, input = {}) => {
    return validateMergeResult(STATE, input.before, input.after);
  }, { description: "Validate merge result integrity", public: false });

  register("emergent", "schema.recordTimestamp", (_ctx, input = {}) => {
    return recordTimestamp(STATE, input.source, input.timestamp);
  }, { description: "Record timestamp for skew detection", public: false });

  register("emergent", "schema.verifyOrdering", (_ctx, input = {}) => {
    return verifyEventOrdering(STATE, input.entityId);
  }, { description: "Verify event ordering for entity", public: true });

  register("emergent", "schema.metrics", (_ctx) => {
    return getSchemaGuardMetrics(STATE);
  }, { description: "Get schema guard metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // DEEP HEALTH (Risk Category 5)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "health.deep", (_ctx) => {
    return runDeepHealthCheck(STATE);
  }, { description: "Run deep health check", public: true });

  register("emergent", "health.history", (_ctx, input = {}) => {
    return getHealthHistory(STATE, input.count);
  }, { description: "Get health check history", public: true });

  register("emergent", "health.degradations", (_ctx) => {
    return getDegradationHistory(STATE);
  }, { description: "Get degradation history", public: true });

  register("emergent", "health.thresholds", (_ctx, input = {}) => {
    return updateHealthThresholds(STATE, input);
  }, { description: "Update health thresholds", public: false });

  register("emergent", "health.metrics", (_ctx) => {
    return getDeepHealthMetrics(STATE);
  }, { description: "Get deep health metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // CONTENT SHIELD (Risk Category 6)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "content.scan", (_ctx, input = {}) => {
    return scanContentFull(STATE, input.content, input);
  }, { description: "Full content scan (PII + copyright + advice)", public: false });

  register("emergent", "content.pii", (_ctx, input = {}) => {
    return detectPii(STATE, input.content, input);
  }, { description: "Detect PII in content", public: false });

  register("emergent", "content.copyright", (_ctx, input = {}) => {
    return detectCopyrightSignals(STATE, input.content, input);
  }, { description: "Detect copyright signals", public: false });

  register("emergent", "content.advice", (_ctx, input = {}) => {
    return checkAdviceFraming(STATE, input.content, input);
  }, { description: "Check advice framing", public: false });

  register("emergent", "content.setDisclaimer", (_ctx, input = {}) => {
    return setDisclaimer(STATE, input.domain, input.text);
  }, { description: "Set disclaimer for advice domain", public: false });

  register("emergent", "content.disclaimers", (_ctx) => {
    return getAllDisclaimers(STATE);
  }, { description: "Get all disclaimers", public: true });

  register("emergent", "content.config", (_ctx, input = {}) => {
    return updateContentShieldConfig(STATE, input);
  }, { description: "Update content shield config", public: false });

  register("emergent", "content.metrics", (_ctx) => {
    return getContentShieldMetrics(STATE);
  }, { description: "Get content shield metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION SLOTS (UX Architecture)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "slots.register", (_ctx, input = {}) => {
    return registerSlotConfig(STATE, input.domain, input);
  }, { description: "Register lens action slot configuration", public: false });

  register("emergent", "slots.get", (_ctx, input = {}) => {
    return getSlotConfig(STATE, input.domain);
  }, { description: "Get slot config for a lens", public: true });

  register("emergent", "slots.all", (_ctx) => {
    return getAllSlotConfigs(STATE);
  }, { description: "Get all lens slot configurations", public: true });

  register("emergent", "slots.label", (_ctx, input = {}) => {
    return getSlotLabel(STATE, input.domain, input.position);
  }, { description: "Get slot label for a lens position", public: true });

  register("emergent", "slots.invoke", (_ctx, input = {}) => {
    return recordInvocation(STATE, input.domain, input.position, input);
  }, { description: "Record a slot handler invocation", public: false });

  register("emergent", "slots.result", (_ctx, input = {}) => {
    return makeResult(input.state, input.data || {});
  }, { description: "Create a standardized handler result", public: true });

  register("emergent", "slots.unregister", (_ctx, input = {}) => {
    return unregisterSlotConfig(STATE, input.domain);
  }, { description: "Unregister a lens slot configuration", public: false });

  register("emergent", "slots.invocations", (_ctx, input = {}) => {
    return getInvocations(STATE, input);
  }, { description: "Get recent slot invocations", public: true });

  register("emergent", "slots.distribution", (_ctx, input = {}) => {
    return getResultDistribution(STATE, input.domain);
  }, { description: "Get result distribution for a lens", public: true });

  register("emergent", "slots.coverage", (_ctx) => {
    return auditSlotCoverage(STATE);
  }, { description: "Audit slot coverage across lenses", public: true });

  register("emergent", "slots.failureRates", (_ctx, input = {}) => {
    return getSlotFailureRates(STATE, input);
  }, { description: "Get failure rates per lens", public: true });

  register("emergent", "slots.metrics", (_ctx) => {
    return getActionSlotMetrics(STATE);
  }, { description: "Get action slot system metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // SCOPE SEPARATION (Global / Marketplace / Local)
  // ══════════════════════════════════════════════════════════════════════════

  // Initialize scope state
  ensureScopeState(STATE);

  register("emergent", "scope.checkInfluence", (_ctx, input = {}) => {
    return { ok: true, ...checkInfluence(input.sourceScope, input.targetScope) };
  }, { description: "Check if influence is allowed between scopes", public: true });

  register("emergent", "scope.validate", (_ctx, input = {}) => {
    return { ok: true, valid: isValidScope(input.scope), scope: input.scope };
  }, { description: "Validate a scope value", public: true });

  register("emergent", "scope.assign", (_ctx, input = {}) => {
    const dtu = STATE.dtus.get(input.dtuId);
    if (!dtu) return { ok: false, error: "dtu_not_found" };
    const scope = input.scope || SCOPES.LOCAL;
    if (isUpwardPromotion(getDtuScope(dtu), scope)) {
      return { ok: false, error: "use_scope.promote_for_upward_movement" };
    }
    assignScope(dtu, scope);
    dtu.updatedAt = new Date().toISOString();
    return { ok: true, dtuId: input.dtuId, scope: dtu.scope };
  }, { description: "Assign scope to a DTU (downward or same only)", public: false });

  register("emergent", "scope.get", (_ctx, input = {}) => {
    const dtu = STATE.dtus.get(input.dtuId);
    if (!dtu) return { ok: false, error: "dtu_not_found" };
    return { ok: true, dtuId: input.dtuId, scope: getDtuScope(dtu) };
  }, { description: "Get the scope of a DTU", public: true });

  register("emergent", "scope.promote", (_ctx, input = {}) => {
    return promoteDtu(STATE, input.dtuId, input.targetScope, {
      actorId: input.actorId || _ctx?.actor?.id,
      override: input.override,
      verified: input.verified,
      reason: input.reason,
    });
  }, { description: "Promote a DTU to a higher scope (requires author intent + council)", public: false });

  register("emergent", "scope.validateGlobal", (_ctx, input = {}) => {
    const dtu = input.dtu || STATE.dtus.get(input.dtuId);
    if (!dtu) return { ok: false, error: "dtu_not_found" };
    return validateGlobalDtu(dtu);
  }, { description: "Validate a DTU against Global scope requirements", public: true });

  register("emergent", "scope.validateMarketplace", (_ctx, input = {}) => {
    const dtu = input.dtu || STATE.dtus.get(input.dtuId);
    if (!dtu) return { ok: false, error: "dtu_not_found" };
    return validateMarketplaceListing(dtu, input.listing || {});
  }, { description: "Validate a DTU for marketplace listing", public: true });

  register("emergent", "scope.gateCreate", (_ctx, input = {}) => {
    return gateCreateDtu(input.scope || SCOPES.LOCAL, input);
  }, { description: "Check if DTU creation is allowed in scope", public: true });

  register("emergent", "scope.gateHeartbeat", (_ctx, input = {}) => {
    return gateHeartbeatOp(input.scope, input.operation);
  }, { description: "Check if heartbeat operation is allowed in scope", public: true });

  register("emergent", "scope.gateMarketplace", (_ctx, input = {}) => {
    return gateMarketplaceAnalytics(input.operation);
  }, { description: "Check if marketplace operation is allowed", public: true });

  register("emergent", "scope.recordAnalytics", (_ctx, input = {}) => {
    return recordMarketplaceAnalytics(STATE, input.eventType, input.payload || {});
  }, { description: "Record marketplace analytics event", public: false });

  register("emergent", "scope.globalTick", (_ctx) => {
    return runGlobalTick(STATE);
  }, { description: "Run the Global scope tick (slow, deliberate synthesis)", public: false });

  register("emergent", "scope.listByScope", (_ctx, input = {}) => {
    return listDtusByScope(STATE, input.scope, input);
  }, { description: "List DTUs filtered by scope", public: true });

  register("emergent", "scope.promotionHistory", (_ctx, input = {}) => {
    return getPromotionHistory(STATE, input.dtuId);
  }, { description: "Get promotion history for a DTU", public: true });

  register("emergent", "scope.overrideLog", (_ctx, input = {}) => {
    return getOverrideLog(STATE, input);
  }, { description: "Get founder override audit log", public: true });

  register("emergent", "scope.marketplaceAnalytics", (_ctx, input = {}) => {
    return getMarketplaceAnalytics(STATE, input);
  }, { description: "Get marketplace analytics data", public: true });

  register("emergent", "scope.metrics", (_ctx) => {
    return getScopeMetrics(STATE);
  }, { description: "Get scope separation metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOGEN PIPELINE (6-Stage Knowledge Synthesis)
  // ══════════════════════════════════════════════════════════════════════════

  // Initialize pipeline state
  ensurePipelineState(STATE);

  register("emergent", "pipeline.selectIntent", (_ctx, input = {}) => {
    return { ok: true, ...selectIntent(STATE, input) };
  }, { description: "Select autogen intent based on lattice signals", public: true });

  register("emergent", "pipeline.retrievalPack", (_ctx, input = {}) => {
    const intent = input.intent || selectIntent(STATE, input);
    return { ok: true, ...buildRetrievalPack(STATE, intent) };
  }, { description: "Build scored retrieval pack for synthesis", public: true });

  register("emergent", "pipeline.builder", (_ctx, input = {}) => {
    const intent = input.intent || selectIntent(STATE, input);
    const pack = input.pack || buildRetrievalPack(STATE, intent);
    return builderPhase(intent, pack);
  }, { description: "Run builder phase (structured extraction + merge)", public: false });

  register("emergent", "pipeline.critic", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return { ok: true, ...criticPhase(input.candidate, input.pack || {}) };
  }, { description: "Run critic phase (rule-based checks)", public: true });

  register("emergent", "pipeline.synthesizer", (_ctx, input = {}) => {
    if (!input.candidate || !input.criticResult) return { ok: false, error: "candidate_and_criticResult_required" };
    return synthesizerPhase(input.candidate, input.criticResult);
  }, { description: "Run synthesizer phase (canonicalize + deduplicate)", public: false });

  register("emergent", "pipeline.noveltyCheck", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return noveltyCheck(STATE, input.candidate, input);
  }, { description: "Check candidate novelty against existing DTUs", public: true });

  register("emergent", "pipeline.writePolicy", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return { ok: true, ...determineWritePolicy(input.candidate, input.criticResult, input.noveltyResult) };
  }, { description: "Determine write policy for candidate (shadow-first)", public: true });

  register("emergent", "pipeline.run", (_ctx, input = {}) => {
    return runAutogenPipeline(STATE, input);
  }, { description: "Run full 6-stage autogen pipeline", public: false });

  register("emergent", "pipeline.metrics", (_ctx) => {
    return getPipelineMetrics(STATE);
  }, { description: "Get autogen pipeline metrics", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // EMPIRICAL GATES (Math / Units / Physical Constants)
  // ══════════════════════════════════════════════════════════════════════════

  register("emergent", "empirical.math", (_ctx, input = {}) => {
    if (!input.expr) return { ok: false, error: "expr_required" };
    try {
      const value = evalMathExpression(input.expr);
      return { ok: true, expr: input.expr, value, engine: "deterministic" };
    } catch (e) {
      return { ok: false, error: e.message, expr: input.expr };
    }
  }, { description: "Evaluate a math expression deterministically", public: true });

  register("emergent", "empirical.parseUnits", (_ctx, input = {}) => {
    if (!input.expr) return { ok: false, error: "expr_required" };
    return parseUnitExpr(input.expr);
  }, { description: "Parse a unit expression into SI dimension vector", public: true });

  register("emergent", "empirical.convertUnits", (_ctx, input = {}) => {
    if (!input.fromUnits || !input.toUnits) return { ok: false, error: "fromUnits_and_toUnits_required" };
    return convertUnits(input.value ?? 1, input.fromUnits, input.toUnits);
  }, { description: "Convert between unit expressions", public: true });

  register("emergent", "empirical.checkUnits", (_ctx, input = {}) => {
    return checkUnits(input);
  }, { description: "Check dimensional consistency of units", public: true });

  register("emergent", "empirical.invarianceCheck", (_ctx, input = {}) => {
    return invarianceCheck(input);
  }, { description: "Check unit-consistency across invariants", public: true });

  register("emergent", "empirical.constants", (_ctx, input = {}) => {
    const keys = Array.isArray(input.keys) ? input.keys : null;
    const out = {};
    for (const k of Object.keys(PHYS_CONSTANTS)) {
      if (!keys || keys.includes(k)) out[k] = PHYS_CONSTANTS[k];
    }
    return { ok: true, constants: out };
  }, { description: "Get physical constants (deterministic, SI)", public: true });

  register("emergent", "empirical.scanCandidate", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return runEmpiricalGates(input.candidate);
  }, { description: "Run all empirical gates on a pipeline candidate", public: true });

  register("emergent", "empirical.scanText", (_ctx, input = {}) => {
    if (!input.text) return { ok: false, error: "text_required" };
    const texts = Array.isArray(input.text) ? input.text : [input.text];
    return {
      ok: true,
      numericClaims: texts.flatMap(t => extractNumericClaims(t)),
      mathExpressions: texts.flatMap(t => extractMathExpressions(t)),
      constantReferences: texts.flatMap(t => extractConstantReferences(t)),
    };
  }, { description: "Scan text for empirical content (numbers, units, constants)", public: true });

  register("emergent", "empirical.info", (_ctx) => {
    return getEmpiricalGateInfo();
  }, { description: "Get empirical gate capabilities and supported units", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // CAPABILITY BRIDGE (Cross-System Integration)
  // ══════════════════════════════════════════════════════════════════════════

  // Bootstrap meta-learning strategies for pipeline domains
  ensureBaselineStrategies(STATE);

  register("emergent", "bridge.hypothesisFromConflicts", (_ctx, input = {}) => {
    return autoHypothesisFromConflicts(STATE, input.conflictPairs || [], input);
  }, { description: "Auto-propose hypotheses from autogen conflict pairs", public: false });

  register("emergent", "bridge.strategyHints", (_ctx, input = {}) => {
    return getPipelineStrategyHints(STATE, input.domain || "autogen");
  }, { description: "Get meta-learning strategy hints for pipeline", public: true });

  register("emergent", "bridge.recordOutcome", (_ctx, input = {}) => {
    return recordPipelineOutcomeToMetaLearning(STATE, input.strategyId, input.success, input.performance ?? 0.5);
  }, { description: "Record pipeline outcome to meta-learning", public: false });

  register("emergent", "bridge.dedupGate", (_ctx, input = {}) => {
    if (!input.candidate) return { ok: false, error: "candidate_required" };
    return dedupGate(STATE, input.candidate, input);
  }, { description: "Check candidate against existing DTUs for duplicates", public: true });

  register("emergent", "bridge.dedupScan", (_ctx, input = {}) => {
    return scanRecentDuplicates(STATE, input);
  }, { description: "Scan recent DTUs for near-duplicates", public: true });

  register("emergent", "bridge.beacon", (_ctx) => {
    return runBeaconCheck(STATE);
  }, { description: "Run beacon/continuity check", public: true });

  register("emergent", "bridge.lensScope", (_ctx, input = {}) => {
    return lensCheckScope(input.artifact, input.operation || "create", { ...input, STATE });
  }, { description: "Check lens artifact scope compliance", public: true });

  register("emergent", "bridge.lensValidate", (_ctx, input = {}) => {
    if (!input.artifact) return { ok: false, error: "artifact_required" };
    return lensValidateEmpirically(input.artifact);
  }, { description: "Run empirical gates on lens artifact claims", public: true });

  register("emergent", "bridge.heartbeatTick", (_ctx, input = {}) => {
    return runHeartbeatBridgeTick(STATE, input);
  }, { description: "Run all bridge checks in one heartbeat cycle", public: false });

  register("emergent", "bridge.info", (_ctx) => {
    return getCapabilityBridgeInfo();
  }, { description: "Get capability bridge information", public: true });

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
      // Stage 1-9 additions
      outcomeSignals: ALL_OUTCOME_SIGNALS,
      skillTypes: ALL_SKILL_TYPES,
      skillMaturity: Object.values(SKILL_MATURITY),
      projectStatuses: Object.values(PROJECT_STATUS),
      nodeStatuses: Object.values(NODE_STATUS),
      memoryCategories: ALL_MEMORY_CATEGORIES,
      epistemicStatuses: ALL_EPISTEMIC_STATUSES,
      evidenceTypes: ALL_EVIDENCE_TYPES,
      checkTypes: ALL_CHECK_TYPES,
      checkResults: Object.values(CHECK_RESULTS),
      goalTypes: ALL_GOAL_TYPES,
      ruleTiers: ALL_RULE_TIERS,
      ruleCategories: Object.values(RULE_CATEGORIES),
      violationSeverities: Object.values(VIOLATION_SEVERITY),
      // Hardening additions (risk categories 1-6)
      costTiers: ALL_COST_TIERS,
      injectionTypes: ALL_INJECTION_TYPES,
      threatLevels: Object.values(THREAT_LEVELS),
      driftTypes: ALL_DRIFT_TYPES,
      driftSeverities: Object.values(DRIFT_SEVERITY),
      dtuSchemaVersion: CURRENT_DTU_SCHEMA_VERSION,
      healthStatuses: Object.values(HEALTH_STATUS),
      piiTypes: ALL_PII_TYPES,
      adviceDomains: ALL_ADVICE_DOMAINS,
      contentRiskLevels: Object.values(CONTENT_RISK),
      // Action Slots additions
      slotPositions: ALL_SLOT_POSITIONS,
      resultStates: ALL_RESULT_STATES,
      // Autogen Pipeline additions
      autogenIntents: ALL_INTENTS,
      autogenVariants: VARIANT_INTENTS,
      escalationReasons: Object.values(ESCALATION_REASONS),
      // Empirical Gates additions
      physicalConstants: Object.keys(PHYS_CONSTANTS),
      empiricalGates: ["math", "unit", "constants"],
      // Scope Separation additions
      scopes: ALL_SCOPES,
      dtuClasses: ALL_DTU_CLASSES,
      heartbeatConfig: HEARTBEAT_CONFIG,
      // Capability Bridge additions
      bridgeModules: ["hypothesis_auto_propose", "metalearning_strategy", "dedup_gate", "dedup_scan", "beacon_check", "lens_scope", "lens_empirical", "heartbeat_bridge"],
      // Sector System additions
      sectors: ALL_SECTORS,
      maturityRequirements: MATURITY_REQUIREMENTS,
      roleSectorAffinity: ROLE_SECTOR_AFFINITY,
      // Entity Emergence additions
      entityThresholds: ENTITY_THRESHOLDS,
    };
  }, { description: "Get emergent system schema", public: true });

  // Initialize constitution (seeds immutable rules)
  getConstitutionStore(STATE);

  // ── Load persisted state (if available) ────────────────────────────────────
  const loadResult = loadEmergentState(STATE);
  if (loadResult.ok) {
    if (helpers?.log) {
      helpers.log("emergent.init", `[Persistence] Restored state: ${JSON.stringify(loadResult.restored)} from ${loadResult.source}`);
    }
  }

  // Start auto-persistence (every 5 minutes)
  startAutoPersist(STATE);

  if (helpers?.log) {
    helpers.log("emergent.init", `Emergent Agent Governance v${EMERGENT_VERSION} initialized (stages 1-9 + hardening + action slots + scope separation + autogen pipeline + empirical gates + capability bridge + sectors + entity emergence + persistence)`);
  }

  return {
    ok: true,
    version: EMERGENT_VERSION,
    macroCount: 300,
    newModules: ["sectors", "entity-emergence", "persistence", "grc-pipeline-integration"],
    persistenceLoaded: loadResult.ok,
  };
}

export {
  EMERGENT_VERSION,
  init,
};
