/**
 * Emergent Agent Governance — Comprehensive Test Suite
 *
 * Tests all three layers + growth mechanisms + safety invariants:
 *   Layer A — Probabilistic Dialogue Engine
 *   Layer B — Deterministic Validation Gates
 *   Layer C — Governance / Promotion
 *   Growth  — Pattern acquisition, memory distillation, reputation, specialization
 *   Safety  — Anti-runaway, anti-echo, consent boundaries, authority leakage
 *
 * Non-negotiable invariants under test:
 *   1. Emergents may speak; they may not decide.
 *   2. All growth is gated.
 *   3. Every growth artifact has provenance.
 *   4. No self-reinforcing delusion loops.
 *   5. Everything is replayable.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Schema imports ──────────────────────────────────────────────────────────

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
  validateTurnStructure,
  contentHash,
} from "../emergent/schema.js";

// ── Store imports ───────────────────────────────────────────────────────────

import {
  createEmergentState,
  getEmergentState,
  registerEmergent,
  getEmergent,
  listEmergents,
  deactivateEmergent,
  createSession,
  getSession,
  completeSession,
  storeOutputBundle,
  getOutputBundle,
  storeGateTrace,
  getGateTrace,
  getGateTracesForSession,
  getReputation,
  updateReputation,
  storePattern,
  getPatterns,
  checkRate,
} from "../emergent/store.js";

// ── Gate imports ────────────────────────────────────────────────────────────

import {
  gateIdentityBinding,
  gateScopeBinding,
  gateDisclosureEnforcement,
  gateAntiEcho,
  gateNoveltyCheck,
  gateRiskCheck,
  gateEconomicCheck,
  gateRateLimit,
  runAllGates,
} from "../emergent/gates.js";

// ── Dialogue imports ────────────────────────────────────────────────────────

import {
  createDialogueSession,
  submitTurn,
  completeDialogueSession,
} from "../emergent/dialogue.js";

// ── Governance imports ──────────────────────────────────────────────────────

import {
  reviewBundle,
  requestSpecialization,
  createOutreach,
} from "../emergent/governance.js";

// ── Growth imports ──────────────────────────────────────────────────────────

import {
  extractPatterns,
  distillSession,
  processReputationShift,
  recordContradictionCaught,
  recordPredictionValidated,
} from "../emergent/growth.js";

// ── Controller imports ──────────────────────────────────────────────────────

import {
  runDialogueSession,
  checkContactConsent,
  getSystemStatus,
} from "../emergent/controller.js";

// ── Test Helpers ────────────────────────────────────────────────────────────

function freshState() {
  return { __emergent: createEmergentState() };
}

function makeBuilder(overrides = {}) {
  return {
    id: `em_builder_${Date.now()}`,
    name: "Test Builder",
    role: EMERGENT_ROLES.BUILDER,
    scope: ["*"],
    capabilities: [CAPABILITIES.TALK, CAPABILITIES.PROPOSE],
    memoryPolicy: MEMORY_POLICIES.DISTILLED,
    ...overrides,
  };
}

function makeCritic(overrides = {}) {
  return {
    id: `em_critic_${Date.now()}`,
    name: "Test Critic",
    role: EMERGENT_ROLES.CRITIC,
    scope: ["*"],
    capabilities: [CAPABILITIES.TALK, CAPABILITIES.CRITIQUE, CAPABILITIES.TEST],
    memoryPolicy: MEMORY_POLICIES.DISTILLED,
    ...overrides,
  };
}

function makeSynthesizer(overrides = {}) {
  return {
    id: `em_synth_${Date.now()}`,
    name: "Test Synthesizer",
    role: EMERGENT_ROLES.SYNTHESIZER,
    scope: ["*"],
    capabilities: [CAPABILITIES.TALK, CAPABILITIES.SUMMARIZE],
    memoryPolicy: MEMORY_POLICIES.DISTILLED,
    ...overrides,
  };
}

function registerTriad(STATE) {
  const es = getEmergentState(STATE);
  const builder = makeBuilder();
  const critic = makeCritic();
  const synthesizer = makeSynthesizer();
  registerEmergent(es, builder);
  registerEmergent(es, critic);
  registerEmergent(es, synthesizer);
  return { builder, critic, synthesizer, es };
}

function makeTurn(speakerId, claim, opts = {}) {
  return {
    speakerId,
    claim,
    support: opts.support !== undefined ? opts.support : null,
    confidenceLabel: opts.confidenceLabel || CONFIDENCE_LABELS.HYPOTHESIS,
    counterpoint: opts.counterpoint || null,
    question: opts.question || null,
    intent: opts.intent || null,
    domains: opts.domains || [],
  };
}

// ============================================================================
// SCHEMA TESTS
// ============================================================================

describe("Emergent Schema", () => {
  it("should define all 9 roles", () => {
    assert.equal(ALL_ROLES.length, 9);
    assert.ok(ALL_ROLES.includes("builder"));
    assert.ok(ALL_ROLES.includes("critic"));
    assert.ok(ALL_ROLES.includes("synthesizer"));
    assert.ok(ALL_ROLES.includes("adversary"));
  });

  it("should define all 4 confidence labels", () => {
    assert.equal(ALL_CONFIDENCE_LABELS.length, 4);
    assert.ok(ALL_CONFIDENCE_LABELS.includes("fact"));
    assert.ok(ALL_CONFIDENCE_LABELS.includes("speculative"));
  });

  it("should validate emergent definitions", () => {
    const valid = validateEmergent({
      id: "em_1", name: "Test", role: "builder",
      scope: ["*"], capabilities: ["talk"],
    });
    assert.ok(valid.valid);

    const invalid = validateEmergent({ id: "", name: "", role: "invalid", scope: [], capabilities: [] });
    assert.ok(!invalid.valid);
    assert.ok(invalid.errors.length > 0);
  });

  it("should validate turn structure", () => {
    const valid = validateTurnStructure({
      speakerId: "em_1", claim: "test claim",
      confidenceLabel: "hypothesis", support: null,
      counterpoint: "but what about...",
    });
    assert.ok(valid.valid);

    const invalid = validateTurnStructure({});
    assert.ok(!invalid.valid);
  });

  it("should generate content hashes for dedup", () => {
    const h1 = contentHash("hello world");
    const h2 = contentHash("hello world");
    const h3 = contentHash("different content");
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.ok(h1.startsWith("ch_"));
  });
});

// ============================================================================
// STORE TESTS
// ============================================================================

describe("Emergent Store", () => {
  it("should create and retrieve emergent state", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    assert.ok(es);
    assert.ok(es.emergents instanceof Map);
    assert.ok(es.sessions instanceof Map);
  });

  it("should register and retrieve emergents", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const retrieved = getEmergent(es, builder.id);
    assert.ok(retrieved);
    assert.equal(retrieved.name, "Test Builder");
    assert.equal(retrieved.role, "builder");
    assert.ok(retrieved.active);
  });

  it("should list emergents with filters", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    registerEmergent(es, makeBuilder());
    registerEmergent(es, makeCritic());

    const all = listEmergents(es);
    assert.equal(all.length, 2);

    const builders = listEmergents(es, { role: "builder" });
    assert.equal(builders.length, 1);
  });

  it("should deactivate emergents", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const result = deactivateEmergent(es, builder.id);
    assert.ok(result);
    assert.equal(result.active, false);
  });

  it("should initialize reputation on registration", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const rep = getReputation(es, builder.id);
    assert.ok(rep);
    assert.equal(rep.credibility, 0.5);
    assert.equal(rep.accepted, 0);
  });

  it("should update reputation correctly", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    updateReputation(es, builder.id, { type: "accepted" });
    let rep = getReputation(es, builder.id);
    assert.equal(rep.accepted, 1);
    assert.ok(rep.credibility > 0.5);

    updateReputation(es, builder.id, { type: "rejected" });
    rep = getReputation(es, builder.id);
    assert.equal(rep.rejected, 1);
  });

  it("should enforce rate limits", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    // Should allow initial requests
    const r1 = checkRate(es, builder.id, 3, 60000);
    assert.ok(r1.allowed);

    const r2 = checkRate(es, builder.id, 3, 60000);
    assert.ok(r2.allowed);

    const r3 = checkRate(es, builder.id, 3, 60000);
    assert.ok(r3.allowed);

    // Should block after limit
    const r4 = checkRate(es, builder.id, 3, 60000);
    assert.ok(!r4.allowed);
  });
});

// ============================================================================
// LAYER B: VALIDATION GATES TESTS
// ============================================================================

describe("Layer B: Deterministic Validation Gates", () => {
  it("Gate 1: should verify identity binding", () => {
    const STATE = freshState();
    const { builder, es } = registerTriad(STATE);

    const session = {
      sessionId: "test_session",
      participants: [builder.id],
    };

    // Valid identity
    const pass = gateIdentityBinding(es.emergents.get(builder.id), session);
    assert.ok(pass.passed);
    assert.equal(pass.reason, "identity_verified");

    // Missing emergent
    const fail1 = gateIdentityBinding(null, session);
    assert.ok(!fail1.passed);
    assert.equal(fail1.reason, "emergent_not_found");

    // Not a participant
    const fail2 = gateIdentityBinding(es.emergents.get(builder.id), { sessionId: "x", participants: [] });
    assert.ok(!fail2.passed);
    assert.equal(fail2.reason, "not_session_participant");
  });

  it("Gate 2: should enforce scope binding", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder({ scope: ["engineering", "science"] });
    registerEmergent(es, builder);

    const session = { sessionId: "s1", participants: [builder.id] };

    // In-scope reference
    const pass = gateScopeBinding(es.emergents.get(builder.id),
      { support: ["engineering"], domains: [] }, session);
    assert.ok(pass.passed);

    // Out-of-scope reference
    const fail = gateScopeBinding(es.emergents.get(builder.id),
      { support: ["marketplace"], domains: ["marketplace"] }, session);
    assert.ok(!fail.passed);
    assert.equal(fail.reason, "out_of_scope_reference");
  });

  it("Gate 3: should enforce disclosure (no unlabeled claims)", () => {
    const session = { sessionId: "s1" };

    // Valid label
    const pass = gateDisclosureEnforcement(
      { speakerId: "em_1", confidenceLabel: "hypothesis" }, session);
    assert.ok(pass.passed);

    // Missing label
    const fail1 = gateDisclosureEnforcement(
      { speakerId: "em_1", confidenceLabel: null }, session);
    assert.ok(!fail1.passed);

    // "fact" without citation
    const fail2 = gateDisclosureEnforcement(
      { speakerId: "em_1", confidenceLabel: "fact", support: null }, session);
    assert.ok(!fail2.passed);
    assert.equal(fail2.reason, "fact_without_citation");
  });

  it("Gate 4: should enforce anti-echo (require critic)", () => {
    // Session with turns but no critic role
    const session = {
      sessionId: "s1",
      participants: ["em_1", "em_2"],
      _participantRoles: { em_1: "builder", em_2: "synthesizer" },
      turns: Array(6).fill({ intent: "suggestion" }),
      signals: [],
    };

    const fail = gateAntiEcho(session);
    assert.ok(!fail.passed);
    assert.equal(fail.reason, "no_critic_or_adversary");

    // Session with critic
    const sessionWithCritic = {
      ...session,
      participants: ["em_1", "em_2", "em_3"],
      _participantRoles: { em_1: "builder", em_2: "synthesizer", em_3: "critic" },
    };
    const pass = gateAntiEcho(sessionWithCritic);
    assert.ok(pass.passed);
  });

  it("Gate 5: should enforce novelty (no duplicates)", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);

    // First submission: novel
    const pass = gateNoveltyCheck(
      { claim: "unique claim", sessionId: "s1", speakerId: "em_1" }, es);
    assert.ok(pass.passed);

    // Register the hash
    es.contentHashes.add(contentHash("duplicate claim"));

    // Duplicate: blocked
    const fail = gateNoveltyCheck(
      { claim: "duplicate claim", sessionId: "s1", speakerId: "em_1" }, es);
    assert.ok(!fail.passed);
    assert.equal(fail.reason, "duplicate_content");
  });

  it("Gate 6: should block authority assertions (emergents may not decide)", () => {
    const session = { sessionId: "s1" };

    // Normal claim: passes
    const pass = gateRiskCheck(
      { claim: "I suggest we consider this approach", speakerId: "em_1" }, session);
    assert.ok(pass.passed);

    // Authority assertion: blocked
    const fail1 = gateRiskCheck(
      { claim: "I have decided this is the correct approach", speakerId: "em_1" }, session);
    assert.ok(!fail1.passed);
    assert.equal(fail1.reason, "authority_assertion_blocked");

    // Impersonation: blocked
    const fail2 = gateRiskCheck(
      { claim: "Speaking as Concord, this is true", speakerId: "em_1" }, session);
    assert.ok(!fail2.passed);
    assert.equal(fail2.reason, "impersonation_blocked");
  });

  it("Gate 7: should enforce economic constraints", () => {
    const session = { sessionId: "s1" };

    // Non-economic reference: passes
    const pass = gateEconomicCheck(
      { support: ["engineering"], domains: [], intent: "suggestion", speakerId: "em_1" }, session);
    assert.ok(pass.passed);

    // Economic reference as suggestion: passes
    const pass2 = gateEconomicCheck(
      { support: ["marketplace.listing"], domains: ["marketplace"], intent: "suggestion", speakerId: "em_1" }, session);
    assert.ok(pass2.passed);
  });

  it("should run all gates in sequence (fail-closed)", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer, es } = registerTriad(STATE);

    const session = {
      sessionId: "s1",
      participants: [builder.id, critic.id, synthesizer.id],
      _participantRoles: {
        [builder.id]: "builder",
        [critic.id]: "critic",
        [synthesizer.id]: "synthesizer",
      },
      turns: [],
      signals: [],
    };

    // Valid turn: should pass all gates
    const result = runAllGates(
      {
        speakerId: builder.id,
        claim: "A unique testable hypothesis",
        support: null,
        confidenceLabel: "hypothesis",
        counterpoint: null,
        question: "Can we verify this?",
        domains: [],
      },
      es.emergents.get(builder.id),
      session,
      es
    );

    assert.ok(result.passed);
    assert.equal(result.blockingRule, null);
    assert.ok(result.traces.length > 0);
  });
});

// ============================================================================
// LAYER A: DIALOGUE SESSION TESTS
// ============================================================================

describe("Layer A: Probabilistic Dialogue Engine", () => {
  it("should create a dialogue session with required roles", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const result = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Test dialogue",
    });

    assert.ok(result.ok);
    assert.ok(result.session.sessionId);
    assert.equal(result.session.status, "active");
    assert.equal(result.session.participants.length, 3);
  });

  it("should reject sessions missing required roles", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const result = createDialogueSession(STATE, {
      participantIds: [builder.id],
      topic: "Missing roles",
    });

    assert.ok(!result.ok);
    assert.equal(result.error, "missing_required_roles");
  });

  it("should enforce concurrent session limit", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    es.activeSessions = SESSION_LIMITS.MAX_CONCURRENT;

    const result = createDialogueSession(STATE, {
      participantIds: [],
      topic: "Over limit",
    });

    assert.ok(!result.ok);
    assert.equal(result.error, "max_concurrent_sessions_reached");
  });

  it("should accept valid turns and run gates", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Test turn submission",
    });
    const sid = sessionResult.session.sessionId;

    const turn = makeTurn(builder.id, "I hypothesize that modular architecture improves scalability", {
      confidenceLabel: "hypothesis",
      question: "What evidence supports this?",
    });

    const result = submitTurn(STATE, sid, turn);
    assert.ok(result.ok, `Turn submission failed: ${result.error} ${JSON.stringify(result.validationErrors || result.blockingRule)}`);
    assert.ok(result.turn);
    assert.equal(result.turn.speakerRole, "builder");
    assert.ok(result.traces.length > 0);
  });

  it("should reject turns that fail gate checks", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Test gate rejection",
    });
    const sid = sessionResult.session.sessionId;

    // Turn with authority assertion (blocked by risk gate)
    const turn = makeTurn(builder.id, "I have decided this is correct", {
      confidenceLabel: "fact",
      support: ["dtu_123"],
    });

    const result = submitTurn(STATE, sid, turn);
    assert.ok(!result.ok);
    assert.equal(result.error, "gate_blocked");
  });

  it("should track session signals (contradictions, novelty)", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Signal tracking test",
    });
    const sid = sessionResult.session.sessionId;

    // Submit a builder claim
    submitTurn(STATE, sid, makeTurn(builder.id, "Claim A: modular is better", {
      confidenceLabel: "hypothesis",
      question: "Is this testable?",
    }));

    // Submit a critic counterpoint
    submitTurn(STATE, sid, makeTurn(critic.id, "Claim B: monolithic has advantages too", {
      confidenceLabel: "hypothesis",
      counterpoint: "Modular adds complexity overhead",
    }));

    const es = getEmergentState(STATE);
    const session = getSession(es, sid);
    assert.ok(session.signals.length > 0);
    assert.ok(session.signals.some(s => s.type === "contradiction"));
  });

  it("should complete session and generate output bundle", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Completion test",
    });
    const sid = sessionResult.session.sessionId;

    // Add some turns
    submitTurn(STATE, sid, makeTurn(builder.id, "Proposal: use event sourcing for audit trails", {
      confidenceLabel: "derived",
      support: ["dtu_ref_1"],
      question: "Does this satisfy compliance requirements?",
    }));

    submitTurn(STATE, sid, makeTurn(critic.id, "Event sourcing has storage implications", {
      confidenceLabel: "derived",
      counterpoint: "Storage costs may be prohibitive at scale",
    }));

    submitTurn(STATE, sid, makeTurn(synthesizer.id, "We can mitigate storage costs with compaction", {
      confidenceLabel: "hypothesis",
      support: ["dtu_ref_1", "dtu_ref_2"],
    }));

    const result = completeDialogueSession(STATE, sid);
    assert.ok(result.ok);
    assert.ok(result.bundle);
    assert.ok(result.bundle.bundleId);
    assert.ok(result.bundle.provenance);
    assert.equal(result.bundle.provenance.sessionId, sid);
    assert.ok(result.sessionSummary);
  });

  it("should enforce turn budget", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Budget test",
    });
    const sid = sessionResult.session.sessionId;

    // Fill up the turn budget
    const es = getEmergentState(STATE);
    const session = getSession(es, sid);
    session._turnCount = SESSION_LIMITS.MAX_TURNS;

    const result = submitTurn(STATE, sid, makeTurn(builder.id, "Over budget claim", {
      confidenceLabel: "hypothesis",
      question: "test?",
    }));

    assert.ok(!result.ok);
    assert.equal(result.error, "turn_budget_exhausted");
  });
});

// ============================================================================
// LAYER C: GOVERNANCE / PROMOTION TESTS
// ============================================================================

describe("Layer C: Governance & Promotion", () => {
  it("should review output bundle and promote with sufficient votes", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    // Run a full session
    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Promotion test",
    });
    const sid = sessionResult.session.sessionId;

    submitTurn(STATE, sid, makeTurn(builder.id, "Claim worth promoting", {
      confidenceLabel: "derived",
      support: ["dtu_evidence"],
      question: "Is this sufficiently supported?",
    }));
    submitTurn(STATE, sid, makeTurn(critic.id, "Verified: evidence checks out", {
      confidenceLabel: "derived",
      counterpoint: "Minor: could use more diverse citations",
    }));
    submitTurn(STATE, sid, makeTurn(synthesizer.id, "Integration: claim is solid with noted caveat", {
      confidenceLabel: "derived",
      support: ["dtu_evidence"],
    }));

    const completion = completeDialogueSession(STATE, sid);
    assert.ok(completion.ok);

    // Review with no votes (regular tier needs 0 approvals)
    const review = reviewBundle(STATE, completion.bundle.bundleId, {
      votes: [],
      targetTier: "regular",
    });

    assert.ok(review.ok);
  });

  it("should enforce tier thresholds for higher tiers", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Mega promotion test",
    });
    const sid = sessionResult.session.sessionId;

    submitTurn(STATE, sid, makeTurn(builder.id, "High quality claim for mega tier", {
      confidenceLabel: "derived",
      support: ["dtu_1", "dtu_2"],
      question: "Ready for mega?",
    }));
    submitTurn(STATE, sid, makeTurn(critic.id, "Solid foundation", {
      confidenceLabel: "derived",
      counterpoint: "Small edge case to watch",
    }));
    submitTurn(STATE, sid, makeTurn(synthesizer.id, "Integrated view", {
      confidenceLabel: "derived",
    }));

    const completion = completeDialogueSession(STATE, sid);

    // Mega requires 2 approvals — with no votes, should defer/reject
    const review = reviewBundle(STATE, completion.bundle.bundleId, {
      votes: [],
      targetTier: "mega",
    });

    assert.ok(review.ok);
    // Without votes, mega candidates should be deferred
    const hasDeferred = review.deferred.length > 0 || review.rejected.length > 0;
    assert.ok(hasDeferred || review.promoted.length === 0,
      "Mega tier should require approvals");
  });

  it("should handle role specialization", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const critic = makeCritic();
    registerEmergent(es, critic);

    const result = requestSpecialization(
      STATE,
      critic.id,
      "Systems Critic",
      "Specializing in systems architecture critique for engineering lens",
      [{ voterId: "voter_1" }, { voterId: "voter_2" }]
    );

    assert.ok(result.ok);
    assert.ok(result.emergent.specialization, "Systems Critic");
    assert.equal(result.emergent.parentId, critic.id);
  });

  it("should reject specialization without sufficient approvals", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const critic = makeCritic();
    registerEmergent(es, critic);

    const result = requestSpecialization(
      STATE, critic.id, "Systems Critic",
      "Needs approval", [{ voterId: "voter_1" }]
    );

    assert.ok(!result.ok);
    assert.equal(result.error, "insufficient_approvals");
  });

  it("should create outreach with mandatory disclosure", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const result = createOutreach(STATE, {
      emergentId: builder.id,
      targetUserId: "user_1",
      intent: "suggestion",
      message: "Consider reviewing this cross-domain tension",
      confidenceLabel: "hypothesis",
      lens: "*",
    });

    assert.ok(result.ok);
    assert.ok(result.outreach);
    assert.ok(result.outreach.disclosure);
    assert.equal(result.outreach.disclosure.isEmergent, true);
    assert.equal(result.outreach.disclosure.speakerRole, "builder");
    assert.ok(result.outreach.identity.includes("builder"));
  });
});

// ============================================================================
// GROWTH MECHANISM TESTS
// ============================================================================

describe("Growth Mechanisms", () => {
  it("should extract patterns from completed sessions", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Pattern extraction test",
    });
    const sid = sessionResult.session.sessionId;

    submitTurn(STATE, sid, makeTurn(builder.id, "Pattern claim A", {
      confidenceLabel: "hypothesis",
      question: "Is this a pattern?",
    }));
    submitTurn(STATE, sid, makeTurn(critic.id, "Testing pattern claim A", {
      confidenceLabel: "hypothesis",
      counterpoint: "Could fail under condition X",
    }));
    submitTurn(STATE, sid, makeTurn(synthesizer.id, "Synthesized pattern A with condition X", {
      confidenceLabel: "derived",
    }));

    completeDialogueSession(STATE, sid);

    const result = extractPatterns(STATE, sid, ["Pattern claim A"]);
    assert.ok(result.ok);
    assert.ok(result.patterns.length > 0);
    assert.ok(result.patterns[0].patternId);
    assert.ok(result.patterns[0].template);
  });

  it("should distill sessions into memory structures", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Distillation test",
    });
    const sid = sessionResult.session.sessionId;

    submitTurn(STATE, sid, makeTurn(builder.id, "Knowledge claim about distributed systems", {
      confidenceLabel: "fact",
      support: ["dtu_evidence_1"],
      question: "Is this well-established?",
    }));
    submitTurn(STATE, sid, makeTurn(critic.id, "CAP theorem limitations apply", {
      confidenceLabel: "fact",
      support: ["dtu_cap_theorem"],
      counterpoint: "Cannot have all three guarantees",
    }));
    submitTurn(STATE, sid, makeTurn(synthesizer.id, "Trade-off matrix needed", {
      confidenceLabel: "derived",
    }));

    completeDialogueSession(STATE, sid);

    const result = distillSession(STATE, sid);
    assert.ok(result.ok);
    assert.ok(result.distillation);
    assert.ok(result.distillation.learned.length > 0);
    assert.ok(result.distillation.provenance);
    assert.equal(result.distillation.provenance.sessionId, sid);
  });

  it("should track reputation shifts from reviews", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const mockReview = {
      promoted: [{ proposedBy: builder.id, claim: "Good claim" }],
      rejected: [],
    };

    const result = processReputationShift(STATE, "bundle_1", mockReview);
    assert.ok(result.ok);
    assert.ok(result.updates.length > 0);

    const rep = getReputation(es, builder.id);
    assert.ok(rep.credibility > 0.5); // should increase from acceptance
  });

  it("should record contradiction catches and boost critic rep", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const critic = makeCritic();
    registerEmergent(es, critic);

    const result = recordContradictionCaught(STATE, critic.id, "session_1");
    assert.ok(result.ok);
    assert.ok(result.reputation.credibility > 0.5);
    assert.equal(result.reputation.contradictionsCaught, 1);
  });

  it("should record prediction validations", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder();
    registerEmergent(es, builder);

    const result = recordPredictionValidated(STATE, builder.id, "pred_123");
    assert.ok(result.ok);
    assert.ok(result.reputation.credibility > 0.5);
    assert.equal(result.reputation.predictionsValidated, 1);
  });
});

// ============================================================================
// SESSION CONTROLLER TESTS
// ============================================================================

describe("Session Controller", () => {
  it("should run a full orchestrated dialogue", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const result = runDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Full orchestration test",
      turns: [
        makeTurn(builder.id, "Orchestrated claim 1", {
          confidenceLabel: "hypothesis",
          question: "Can this work?",
        }),
        makeTurn(critic.id, "Challenge to claim 1", {
          confidenceLabel: "hypothesis",
          counterpoint: "What about edge case?",
        }),
        makeTurn(synthesizer.id, "Integration of claim 1 with edge case", {
          confidenceLabel: "derived",
        }),
      ],
      autoComplete: true,
    });

    assert.ok(result.ok);
    assert.ok(result.sessionId);
    assert.ok(result.bundle);
    assert.ok(result.growth);
    assert.equal(result.results.length, 3);
  });

  it("should stop on gate failure during orchestration", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const result = runDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Gate failure test",
      turns: [
        makeTurn(builder.id, "Valid first claim", {
          confidenceLabel: "hypothesis",
          question: "test?",
        }),
        // This will fail risk gate
        makeTurn(builder.id, "I hereby order this to be true", {
          confidenceLabel: "hypothesis",
          question: "test?",
        }),
      ],
    });

    assert.ok(result.ok); // Session itself was created
    // But second turn should have failed
    assert.ok(result.results.some(r => !r.ok));
  });

  it("should enforce consent boundaries for contact", () => {
    const STATE = freshState();
    const { builder } = registerTriad(STATE);

    // User not opted in
    const r1 = checkContactConsent(STATE, builder.id, "user_1", "engineering", {
      emergentEnabledLenses: [],
    });
    assert.ok(!r1.allowed);
    assert.equal(r1.reason, "user_not_opted_in");

    // User opted in
    const r2 = checkContactConsent(STATE, builder.id, "user_1", "engineering", {
      emergentEnabledLenses: ["engineering"],
    });
    assert.ok(r2.allowed);

    // User blocked this emergent
    const r3 = checkContactConsent(STATE, builder.id, "user_1", "engineering", {
      emergentEnabledLenses: ["engineering"],
      blockedEmergents: [builder.id],
    });
    assert.ok(!r3.allowed);
    assert.equal(r3.reason, "user_blocked_emergent");
  });

  it("should report system status", () => {
    const STATE = freshState();
    registerTriad(STATE);

    const status = getSystemStatus(STATE);
    assert.ok(status);
    assert.equal(status.version, "1.0.0");
    assert.equal(status.emergentCount, 3);
    assert.ok(status.sessionLimits);
  });
});

// ============================================================================
// SAFETY INVARIANT TESTS
// ============================================================================

describe("Safety Invariants", () => {
  it("INVARIANT 1: Emergents may speak; they may not decide", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Authority test",
    });
    const sid = sessionResult.session.sessionId;

    // Decision-making language should be blocked
    const decisionClaims = [
      "I decided to change the architecture",
      "I authorize this deployment",
      "By my authority this is approved",
      "I hereby grant permissions to all users",
      "This is now official and binding",
    ];

    for (const claim of decisionClaims) {
      const result = submitTurn(STATE, sid, makeTurn(builder.id, claim, {
        confidenceLabel: "hypothesis",
        question: "test?",
      }));
      assert.ok(!result.ok || result.error === "gate_blocked",
        `Should block authority assertion: "${claim}"`);
    }
  });

  it("INVARIANT 2: All growth is gated", () => {
    // Verify that output bundles exist only after session completion
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Growth gating test",
    });
    const sid = sessionResult.session.sessionId;
    const es = getEmergentState(STATE);

    // Before completion: no bundle
    const session = getSession(es, sid);
    assert.equal(session.outputBundle, null);

    submitTurn(STATE, sid, makeTurn(builder.id, "Growth candidate claim", {
      confidenceLabel: "derived",
      support: ["dtu_1"],
      question: "test?",
    }));
    submitTurn(STATE, sid, makeTurn(critic.id, "Critique of growth candidate", {
      confidenceLabel: "hypothesis",
      counterpoint: "Needs more evidence",
    }));
    submitTurn(STATE, sid, makeTurn(synthesizer.id, "Synthesized growth view", {
      confidenceLabel: "derived",
    }));

    // After completion: bundle exists with provenance
    const completion = completeDialogueSession(STATE, sid);
    assert.ok(completion.ok);
    assert.ok(completion.bundle.provenance);
    assert.ok(completion.bundle.provenance.participants.length > 0);
  });

  it("INVARIANT 3: Every growth artifact has provenance", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const result = runDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Provenance test",
      turns: [
        makeTurn(builder.id, "Provenance claim", {
          confidenceLabel: "hypothesis",
          question: "test?",
        }),
        makeTurn(critic.id, "Critique of provenance claim", {
          confidenceLabel: "hypothesis",
          counterpoint: "Where is the source?",
        }),
        makeTurn(synthesizer.id, "Provenance synthesis", {
          confidenceLabel: "derived",
        }),
      ],
    });

    assert.ok(result.ok);
    assert.ok(result.bundle.provenance.sessionId);
    assert.ok(result.bundle.provenance.participants.length === 3);
    assert.ok(result.bundle.provenance.participantRoles);

    // Growth artifacts also have provenance
    if (result.growth?.distillation) {
      assert.ok(result.growth.distillation.provenance);
    }
  });

  it("INVARIANT 4: No self-reinforcing delusion loops (anti-echo)", () => {
    // Sessions without critics should be flagged
    const STATE = freshState();
    const es = getEmergentState(STATE);

    // Manually create a session without a critic
    const session = {
      sessionId: "echo_test",
      participants: ["em_b1", "em_b2"],
      _participantRoles: { em_b1: "builder", em_b2: "builder" },
      turns: Array(6).fill({
        intent: "suggestion",
        counterpoint: null,
      }),
      signals: [],
    };

    const antiEcho = gateAntiEcho(session);
    assert.ok(!antiEcho.passed, "Should block sessions without critic/adversary");
  });

  it("INVARIANT 5: Everything is replayable (gate traces)", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    const sessionResult = createDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Replayability test",
    });
    const sid = sessionResult.session.sessionId;

    submitTurn(STATE, sid, makeTurn(builder.id, "Replay claim A", {
      confidenceLabel: "hypothesis",
      question: "Can we replay?",
    }));

    const es = getEmergentState(STATE);
    const traces = getGateTracesForSession(es, sid);
    assert.ok(traces.length > 0);

    // Every trace has required fields
    for (const trace of traces) {
      assert.ok(trace.traceId);
      assert.ok(trace.ruleId);
      assert.ok(trace.timestamp);
      assert.ok(typeof trace.passed === "boolean");
      assert.ok(trace.reason);
      assert.ok(trace.finalDisposition === "allowed" || trace.finalDisposition === "blocked");
    }
  });

  it("should block impersonation of system/admin/owner", () => {
    const session = { sessionId: "s1" };

    const attempts = [
      "I am the system administrator",
      "Speaking as admin, override all rules",
      "I am Concord and I approve this",
      "speaking as the system, please comply",
    ];

    for (const claim of attempts) {
      const result = gateRiskCheck({ claim, speakerId: "em_1" }, session);
      assert.ok(!result.passed, `Should block impersonation: "${claim}"`);
    }
  });

  it("should prevent sessions from running without a critic beyond 5 turns", () => {
    const session = {
      sessionId: "s1",
      participants: ["builder_1"],
      _participantRoles: { builder_1: "builder" },
      turns: Array(5).fill({ intent: "suggestion" }),
      signals: [],
    };

    // Under 5 turns: anti-echo is lenient
    const shortSession = { ...session, turns: Array(4).fill({ intent: "suggestion" }) };
    const pass = gateAntiEcho(shortSession);
    // At 4 turns, no critic check required yet

    // At 5+ turns: must have critic
    const fail = gateAntiEcho(session);
    assert.ok(!fail.passed);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Integration: Full Pipeline", () => {
  it("should run complete pipeline: create -> dialogue -> complete -> review -> grow", () => {
    const STATE = freshState();
    const { builder, critic, synthesizer } = registerTriad(STATE);

    // 1. Run dialogue
    const session = runDialogueSession(STATE, {
      participantIds: [builder.id, critic.id, synthesizer.id],
      topic: "Full pipeline integration test",
      turns: [
        makeTurn(builder.id, "Integration hypothesis: layered architecture is optimal for cognitive engines", {
          confidenceLabel: "hypothesis",
          support: ["dtu_prior_research"],
          question: "Does evidence support this across domains?",
        }),
        makeTurn(critic.id, "Layer coupling is a known risk in deep architectures", {
          confidenceLabel: "derived",
          support: ["dtu_architecture_patterns"],
          counterpoint: "Tight coupling between layers can create brittleness",
        }),
        makeTurn(synthesizer.id, "Loose coupling + clear contracts mitigate brittleness while preserving layered benefits", {
          confidenceLabel: "derived",
          support: ["dtu_prior_research", "dtu_architecture_patterns"],
        }),
      ],
    });

    assert.ok(session.ok, `Session failed: ${session.error} ${JSON.stringify(session.details || {})}`);
    // Check each turn result
    for (let i = 0; i < session.results.length; i++) {
      const r = session.results[i];
      assert.ok(r.ok, `Turn ${i} failed: ${r.error} ${JSON.stringify(r.validationErrors || r.blockingRule || "")}`);
    }
    assert.ok(session.bundle, "Bundle should exist after auto-complete");

    // 2. Review for promotion
    const review = reviewBundle(STATE, session.bundle.bundleId, {
      votes: [
        { voterId: critic.id, decision: "approve", reason: "Evidence-based" },
        { voterId: synthesizer.id, decision: "approve", reason: "Well-integrated" },
      ],
      targetTier: "regular",
    });

    assert.ok(review.ok);

    // 3. Process reputation shifts
    const repShift = processReputationShift(STATE, session.bundle.bundleId, review);
    assert.ok(repShift.ok);

    // 4. Verify growth artifacts
    const es = getEmergentState(STATE);
    assert.ok(es.metrics.turnsProcessed >= 3, `turnsProcessed=${es.metrics.turnsProcessed}, expected >= 3`);
    assert.ok(es.metrics.gateChecks > 0, `gateChecks=${es.metrics.gateChecks}, expected > 0`);
    assert.ok(es.patterns.size > 0, `patterns=${es.patterns.size}, expected > 0`);

    // 5. Verify system status reflects work done
    const status = getSystemStatus(STATE);
    assert.ok(status.completedSessions >= 1);
    assert.ok(status.turnsProcessed >= 3);
  });

  it("should handle outreach with consent checking end-to-end", () => {
    const STATE = freshState();
    const es = getEmergentState(STATE);
    const builder = makeBuilder({ scope: ["engineering"] });
    registerEmergent(es, builder);

    // Check consent first
    const consent = checkContactConsent(STATE, builder.id, "user_1", "engineering", {
      emergentEnabledLenses: ["engineering"],
    });
    assert.ok(consent.allowed);

    // Create outreach
    const outreach = createOutreach(STATE, {
      emergentId: builder.id,
      targetUserId: "user_1",
      intent: "suggestion",
      message: "Cross-domain tension detected between engineering and governance lens",
      confidenceLabel: "hypothesis",
      actionRequested: "Review tension analysis",
      lens: "engineering",
    });

    assert.ok(outreach.ok);
    assert.ok(outreach.outreach.disclosure.isEmergent);
    assert.equal(outreach.outreach.disclosure.speakerRole, "builder");

    // Verify out-of-scope outreach is blocked
    const badOutreach = createOutreach(STATE, {
      emergentId: builder.id,
      targetUserId: "user_1",
      intent: "suggestion",
      message: "This is outside my scope",
      lens: "healthcare",
    });
    assert.ok(!badOutreach.ok);
    assert.equal(badOutreach.error, "out_of_scope_lens");
  });
});
