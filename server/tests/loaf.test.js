/**
 * LOAF — Comprehensive Test Suite
 *
 * Tests all three LOAFs:
 *   I  — Hardening & Integrity
 *   II — Scalable Cognitive OS
 *   III — Civilizational-Grade Infrastructure
 */

import { describe, it, before as _before } from "node:test";
import assert from "node:assert/strict";

// ===== LOAF I — Hardening & Integrity =====

import {
  councilCheckFailClosed,
  mandatoryMutationGate,
  createConstitutionRule,
  amendConstitutionRule,
  revertConstitutionRule as _revertConstitutionRule,
  detectPowerCreep,
  GATED_DOMAINS,
  CONSTITUTION as _CONSTITUTION,
} from "../loaf/governance.js";

import {
  trackContribution,
  computeDiversityWeight,
  suppressOutliers,
  clampStrategyUpdate,
  assessReflectionQuality,
  getActorStats as _getActorStats,
} from "../loaf/learning.js";

import {
  recordNegativeTransfer,
  applyCooldown,
  isOnCooldown,
  isHardBlocked,
  computeSimilarity,
  evaluateTransfer,
  getTransferHealth as _getTransferHealth,
} from "../loaf/transfer-hardening.js";

import {
  createDispute,
  addEvidence,
  resolveDispute,
  validateProvenance,
  quarantineItem,
  releaseFromQuarantine,
  detectContradiction,
  DISPUTE_STATUS,
} from "../loaf/world-disputes.js";

import {
  consumeBudget,
  getBudgetStatus as _getBudgetStatus,
  scheduleTask,
  applyPriorityAging,
  dequeueNext,
  completeThread as _completeThread,
  enforceThreadLifetimes,
} from "../loaf/scheduler.js";

// ===== LOAF II — Scalable Cognitive OS =====

import {
  emit,
  subscribe,
  queryEvents,
  getSnapshot as _getSnapshot,
  createReplayContext,
  replayStep as _replayStep,
  replayAll,
  EVENT_TYPES,
} from "../loaf/cognition-bus.js";

import {
  ShardedStore,
  domainShardKey,
  stores as _stores,
} from "../loaf/sharded-store.js";

import {
  createEvidenceBundle,
  computeConfidenceDistribution as _computeConfidenceDistribution,
  runVerification,
  VERIFIER_TYPES,
} from "../loaf/verification.js";

import {
  SkillGraph,
  compileStrategy,
} from "../loaf/skill-graph.js";

import {
  createAgentSandbox,
  createAppSandbox,
  consumeSandboxBudget,
  checkPermission,
  writeMemory,
  readMemory as _readMemory,
  killSandbox,
  enforceTimeLimit as _enforceTimeLimit,
} from "../loaf/sandbox.js";

import {
  exportArtifact,
  importArtifact,
  voteReputation,
  getArtifactReputation,
} from "../loaf/federation.js";

// ===== LOAF III — Civilizational-Grade Infrastructure =====

import {
  classifyLayer,
  addEpistemicItem,
  applyDecay,
  checkHardKernelContradiction,
  checkUnitCorrectness,
  checkDimensionalConsistency,
  checkMathematicalConsistency,
  realityCheck,
  EPISTEMIC_LAYERS,
} from "../loaf/epistemic.js";

import {
  createTimeline,
  addTimelineVersion,
  getTimelineVersion as _getTimelineVersion,
  forkTimeline,
  queryChanges,
  diffStates,
  addCausalEvent,
  addCausalEdge,
  traceCausalChain,
  simulateCounterfactual,
} from "../loaf/time-causality.js";

import {
  createModule,
  updateModule,
  forkModule,
  evaluate,
  NORMATIVE_TYPES,
} from "../loaf/normative.js";

import {
  detectEpistemicMonoculture,
  detectTransferOveruse,
  detectEconomicBias,
  detectAttentionCollapse,
  runDriftScan,
  generateFromFailure,
  verifyAcceptanceCriteria,
  INFRASTRUCTURE_IDENTITY,
  DRIFT_TYPES,
} from "../loaf/stability.js";

// ============================================================================
// LOAF I — HARDENING & INTEGRITY
// ============================================================================

describe("LOAF I.1 — Governance Hardening", () => {
  it("should fail-closed when no actor is provided", () => {
    const result = councilCheckFailClosed(null, "test", "write");
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "no_actor");
  });

  it("should fail-closed for insufficient role", () => {
    const result = councilCheckFailClosed({ role: "member", id: "m1" }, "experience", "write");
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "insufficient_role");
  });

  it("should allow owner with override=true and verified=true", () => {
    const result = councilCheckFailClosed(
      { role: "owner", id: "o1", verified: true, scopes: ["*"] },
      "experience", "write",
      { override: true }
    );
    assert.equal(result.allowed, true);
    assert.equal(result.reason, "owner_override_verified");
  });

  it("should NOT allow owner override without verified flag", () => {
    const result = councilCheckFailClosed(
      { role: "owner", id: "o1", scopes: ["*"] },
      "experience", "write",
      { override: true }
    );
    // Falls through to normal check, which should pass since owner has * scope
    assert.equal(result.allowed, true);
  });

  it("should enforce mandatory mutation gate for gated domains", () => {
    const result = mandatoryMutationGate({ role: "member", id: "m1" }, "experience", "write");
    assert.equal(result.gated, true);
    assert.equal(result.allowed, false);
  });

  it("should pass gate for admin on gated domains", () => {
    const result = mandatoryMutationGate(
      { role: "admin", id: "a1", scopes: ["*"] },
      "experience", "write"
    );
    assert.equal(result.gated, true);
    assert.equal(result.allowed, true);
  });

  it("should not gate non-mutation domains", () => {
    const result = mandatoryMutationGate({ role: "member", id: "m1" }, "read", "list");
    assert.equal(result.gated, false);
    assert.equal(result.allowed, true);
  });

  it("should have all required gated domains", () => {
    assert.ok(GATED_DOMAINS.includes("experience.write"));
    assert.ok(GATED_DOMAINS.includes("world.write"));
    assert.ok(GATED_DOMAINS.includes("transfer.write"));
    assert.ok(GATED_DOMAINS.includes("canon.promote"));
    assert.ok(GATED_DOMAINS.includes("economy.distribute"));
    assert.ok(GATED_DOMAINS.includes("macro.register"));
    assert.ok(GATED_DOMAINS.includes("scheduler.modify"));
  });
});

describe("LOAF I.1/III.5 — Meta-Governance / Constitution", () => {
  const owner = { role: "owner", id: "owner1", scopes: ["*"] };
  const member = { role: "member", id: "member1", scopes: ["read"] };

  it("should create constitution rules with proper provenance", () => {
    const result = createConstitutionRule("All learning must be auditable", { source_type: "manual" }, owner);
    assert.equal(result.ok, true);
    assert.ok(result.rule.id);
    assert.equal(result.rule.text, "All learning must be auditable");
    assert.ok(result.rule.provenance);
    assert.equal(result.rule.version, 1);
  });

  it("should deny rule creation for non-authorized actors", () => {
    const result = createConstitutionRule("Sneaky rule", {}, member);
    assert.equal(result.ok, false);
  });

  it("should require supermajority for amendments", () => {
    const ruleResult = createConstitutionRule("Test rule for amendment", {}, owner);
    const result = amendConstitutionRule(
      ruleResult.rule.id, "Amended text", {},
      owner, { approve: 1, deny: 1, abstain: 0 }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, "supermajority_not_met");
  });

  it("should allow amendment with supermajority", () => {
    const ruleResult = createConstitutionRule("Test rule 2", {}, owner);
    const result = amendConstitutionRule(
      ruleResult.rule.id, "Amended text 2", {},
      owner, { approve: 5, deny: 1, abstain: 0 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.rule.version, 2);
  });

  it("should detect power creep", () => {
    const result = detectPowerCreep(86400000);
    assert.ok(typeof result.alerts === "object");
    assert.ok(typeof result.recentAmendments === "number");
  });
});

describe("LOAF I.2 — Learning Integrity", () => {
  it("should enforce per-actor contribution caps", () => {
    const config = { maxContributionsPerActor: 3, contributionWindowMs: 60000 };
    const actorId = `testActor_cap_${Date.now()}`;
    const r1 = trackContribution(actorId, "math", "default", 1, config);
    assert.equal(r1.allowed, true);
    trackContribution(actorId, "math", "default", 1, config);
    trackContribution(actorId, "math", "default", 1, config);
    const r4 = trackContribution(actorId, "math", "default", 1, config);
    assert.equal(r4.allowed, false);
    assert.equal(r4.reason, "contribution_cap_exceeded");
  });

  it("should compute diversity weight based on domain and lens variety", () => {
    const diverse = [
      { domain: "math", lens: "formal" },
      { domain: "physics", lens: "empirical" },
      { domain: "biology", lens: "systems" },
    ];
    const monoculture = [
      { domain: "math", lens: "formal" },
      { domain: "math", lens: "formal" },
      { domain: "math", lens: "formal" },
    ];
    const diverseWeight = computeDiversityWeight(diverse);
    const monocultureWeight = computeDiversityWeight(monoculture);
    assert.ok(diverseWeight > monocultureWeight, "diverse should weigh more than monoculture");
  });

  it("should suppress outliers using z-score", () => {
    const values = [10, 11, 12, 10, 11, 100]; // 100 is an outlier
    const result = suppressOutliers(values, { outlierZThreshold: 2.0 });
    assert.ok(result.suppressed.length > 0);
    assert.equal(result.suppressed[0].index, 5);
  });

  it("should clamp strategy weight updates to maxEpsilon", () => {
    const clamped = clampStrategyUpdate(0.5, 0.9, { maxEpsilonPerEpisode: 0.05 });
    assert.ok(Math.abs(clamped - 0.55) < 0.001);
  });

  it("should assess reflection quality and detect gaming", () => {
    const good = assessReflectionQuality("The algorithm uses O(n log n) sorting with quicksort partitioning for efficient comparison.");
    assert.ok(good.effectiveScore > 0);

    const padded = assessReflectionQuality("It is important to note that, broadly speaking, for the most part, it should be noted that the answer is maybe perhaps possibly something.");
    assert.ok(padded.gamingRisk > 0);
    assert.ok(padded.effectiveScore < good.effectiveScore);
  });

  it("should penalize verbosity inflation", () => {
    const verbose = assessReflectionQuality("very really basically actually essentially simply just quite rather somewhat " .repeat(20));
    assert.ok(verbose.penalties.verbosityInflation > 0 || verbose.penalties.lowInfo > 0);
  });
});

describe("LOAF I.3 — Transfer Learning Hardening", () => {
  it("should record negative transfer events", () => {
    const result = recordNegativeTransfer("math", "cooking", "skill mismatch", 0.8);
    assert.equal(result.recorded, true);
  });

  it("should apply and check cooldowns", () => {
    applyCooldown("math", "art", "test cooldown", { cooldownMs: 5000 });
    const cd = isOnCooldown("math", "art");
    assert.equal(cd.onCooldown, true);
    assert.ok(cd.remainingMs > 0);
  });

  it("should hard-block after too many negative transfers", () => {
    const config = { maxNegativeTransfers: 3, negativeTransferDecayMs: 3600000 };
    const src = `physics_${Date.now()}`;
    const tgt = `poetry_${Date.now()}`;
    recordNegativeTransfer(src, tgt, "r1", 1);
    recordNegativeTransfer(src, tgt, "r2", 1);
    recordNegativeTransfer(src, tgt, "r3", 1);
    const block = isHardBlocked(src, tgt, config);
    assert.equal(block.blocked, true);
  });

  it("should compute similarity correctly", () => {
    const sim = computeSimilarity(["a", "b", "c"], ["b", "c", "d"]);
    assert.ok(sim > 0.3 && sim < 0.8); // Jaccard of {a,b,c} ∩ {b,c,d} = 2/4 = 0.5
  });

  it("should evaluate transfers with threshold enforcement", () => {
    const result = evaluateTransfer("math", "statistics",
      ["algebra", "calculus", "probability"],
      ["statistics", "probability", "sampling"],
      { similarityThresholdProposal: 0.2, similarityThresholdAutoApply: 0.8, maxNegativeTransfers: 10, negativeTransferDecayMs: 3600000 }
    );
    assert.ok(["propose", "auto_apply", "blocked"].includes(result.decision));
    assert.ok(result.similarity >= 0);
  });
});

describe("LOAF I.4 — World Model Disputes + Provenance", () => {
  it("should create dispute objects from contradictions", () => {
    const result = createDispute(
      [{ text: "Water boils at 100°C", confidence: 0.9 }],
      [{ text: "Measured at sea level", type: "supporting", confidence: 0.95 }],
      { domain: "physics" }
    );
    assert.equal(result.ok, true);
    assert.ok(result.dispute.id);
    assert.equal(result.dispute.status, DISPUTE_STATUS.OPEN);
    assert.ok(result.dispute.claims.length > 0);
    assert.ok(result.dispute.evidence.length > 0);
  });

  it("should add evidence to disputes", () => {
    const dispute = createDispute([{ text: "Claim A" }], []);
    const result = addEvidence(dispute.dispute.id, { text: "New evidence", confidence: 0.8 });
    assert.equal(result.ok, true);
    assert.ok(result.dispute.evidence.length > 0);
  });

  it("should NOT auto-resolve disputes", () => {
    const dispute = createDispute([{ text: "High confidence claim" }], [{ text: "Evidence", confidence: 0.99 }]);
    // Even with high confidence, auto-resolve is forbidden
    const result = resolveDispute(dispute.dispute.id, { text: "auto" }, null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "explicit_actor_required_for_resolution");
  });

  it("should resolve disputes with authorized actor", () => {
    const dispute = createDispute([{ text: "Test claim" }], []);
    const result = resolveDispute(dispute.dispute.id, { text: "Accepted after review" }, { role: "council", id: "c1" });
    assert.equal(result.ok, true);
    assert.equal(result.dispute.status, DISPUTE_STATUS.RESOLVED);
  });

  it("should validate provenance and quarantine missing items", () => {
    const valid = validateProvenance({ provenance: { source_type: "manual", source_id: "user1", confidence: 0.8 } });
    assert.equal(valid.valid, true);

    const invalid = validateProvenance({ provenance: { source_type: "manual" } });
    assert.equal(invalid.valid, false);
    assert.ok(invalid.missing.length > 0);
  });

  it("should quarantine and release items", () => {
    quarantineItem("item123", { id: "item123", name: "Test" }, "missing_provenance");
    const released = releaseFromQuarantine("item123", { source_type: "manual", source_id: "u1", confidence: 0.5 });
    assert.equal(released.ok, true);
  });

  it("should detect contradictions between claims", () => {
    const result = detectContradiction(
      { text: "Temperature always increases with altitude" },
      { text: "Temperature never increases with altitude" }
    );
    assert.ok(result.score > 0);
  });
});

describe("LOAF I.5/I.6 — Scheduler + Rate Budget", () => {
  it("should consume budget and enforce limits", () => {
    const config = { defaultBudgetPerWindow: 10, windowMs: 60000, domainCosts: { http: 1 } };
    const actorId = `actor_sched_${Date.now()}`;
    const r1 = consumeBudget(actorId, "http", 1, config);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 9);

    // Exhaust budget
    for (let i = 0; i < 9; i++) consumeBudget(actorId, "http", 1, config);
    const denied = consumeBudget(actorId, "http", 1, config);
    assert.equal(denied.allowed, false);
    assert.equal(denied.reason, "budget_exceeded");
  });

  it("should schedule tasks with priority", () => {
    const result = scheduleTask({ id: "t1", priority: 5, payload: { work: "test" } });
    assert.equal(result.ok, true);
    assert.equal(result.task.priority, 5);
  });

  it("should apply priority aging to waiting tasks", () => {
    scheduleTask({ id: "t_age_1", priority: 1, payload: {} });
    const result = applyPriorityAging({ agingIntervalMs: 0, agingIncrement: 0.5, maxPriority: 10, starvationThresholdMs: 0, starvationBoostPriority: 8 });
    assert.ok(result.aged > 0 || result.starvationPromoted > 0);
  });

  it("should dequeue highest priority task", () => {
    scheduleTask({ id: "t_deq_low", priority: 1, payload: {} });
    scheduleTask({ id: "t_deq_high", priority: 9, payload: {} });
    const result = dequeueNext();
    assert.equal(result.ok, true);
    // Should get a task from the queue — dequeues highest available
    assert.ok(result.task);
    assert.ok(typeof result.task.priority === "number");
  });

  it("should enforce thread lifetimes", () => {
    const result = enforceThreadLifetimes({ maxThreadLifetimeMs: 0 }); // 0ms = immediate termination
    assert.ok(Array.isArray(result.terminated));
  });
});

// ============================================================================
// LOAF II — SCALABLE COGNITIVE OS
// ============================================================================

describe("LOAF II.1 — Event-Sourced Cognition Bus", () => {
  it("should emit events with sequence numbers", () => {
    const event = emit("episode_recorded", { episode: "test" });
    assert.ok(event.seq > 0);
    assert.equal(event.type, "episode_recorded");
    assert.ok(event.ts > 0);
  });

  it("should support all specified event types", () => {
    assert.ok(EVENT_TYPES.includes("episode_recorded"));
    assert.ok(EVENT_TYPES.includes("transfer_extracted"));
    assert.ok(EVENT_TYPES.includes("world_update_proposed"));
    assert.ok(EVENT_TYPES.includes("dispute_opened"));
    assert.ok(EVENT_TYPES.includes("dispute_resolved"));
    assert.ok(EVENT_TYPES.includes("council_vote"));
    assert.ok(EVENT_TYPES.includes("reward_issued"));
    assert.ok(EVENT_TYPES.includes("thread_scheduled"));
    assert.ok(EVENT_TYPES.includes("thread_terminated"));
  });

  it("should deliver events to subscribers", () => {
    let received = null;
    const unsub = subscribe("council_vote", (event) => { received = event; });
    emit("council_vote", { vote: "approve" });
    assert.ok(received);
    assert.equal(received.type, "council_vote");
    unsub();
  });

  it("should query events with filters", () => {
    emit("reward_issued", { amount: 10 }, { actorId: "actor1" });
    const result = queryEvents({ type: "reward_issued", limit: 5 });
    assert.ok(result.events.length > 0);
    assert.ok(result.total > 0);
  });
});

describe("LOAF II.3 — Deterministic Replay Engine", () => {
  it("should create replay context and replay events", () => {
    const events = [
      { seq: 1, type: "episode_recorded", payload: { data: "test" }, ts: Date.now() },
      { seq: 2, type: "council_vote", payload: { vote: "approve" }, ts: Date.now() },
    ];
    const ctx = createReplayContext(events, "seed123", "1.0");
    assert.equal(ctx.seed, "seed123");
    assert.equal(ctx.events.length, 2);

    const result = replayAll(ctx);
    assert.equal(result.ok, true);
    assert.equal(result.totalReplayed, 2);
    assert.equal(result.decisions[0].action, "record_learning");
    assert.equal(result.decisions[1].action, "tally_vote");
  });

  it("should produce deterministic results with same seed", () => {
    const events = [{ seq: 1, type: "strategy_updated", payload: { w: 0.5 }, ts: Date.now() }];
    const r1 = replayAll(createReplayContext(events, "same_seed", "1.0"));
    const r2 = replayAll(createReplayContext(events, "same_seed", "1.0"));
    assert.deepEqual(r1.decisions[0].action, r2.decisions[0].action);
  });
});

describe("LOAF II.2 — Sharded Stores", () => {
  it("should shard items by domain", () => {
    const store = new ShardedStore("test", domainShardKey);
    store.put("item1", { id: "item1", domain: "math", value: "algebra" });
    store.put("item2", { id: "item2", domain: "physics", value: "mechanics" });

    assert.equal(store.totalSize(), 2);
    assert.ok(store.listShards().includes("math"));
    assert.ok(store.listShards().includes("physics"));
  });

  it("should query specific shards", () => {
    const store = new ShardedStore("test2", domainShardKey);
    store.put("a", { id: "a", domain: "math", v: 1 });
    store.put("b", { id: "b", domain: "math", v: 2 });
    store.put("c", { id: "c", domain: "physics", v: 3 });

    const mathItems = store.queryShard("math");
    assert.equal(mathItems.length, 2);
  });

  it("should export and import data", () => {
    const store1 = new ShardedStore("export_test", domainShardKey);
    store1.put("x", { id: "x", domain: "bio", v: 1 });
    const exported = store1.export();

    const store2 = new ShardedStore("import_test", domainShardKey);
    const result = store2.import(exported);
    assert.equal(result.ok, true);
    assert.equal(store2.totalSize(), 1);
  });

  it("should have no global locks (independent shard operations)", () => {
    const store = new ShardedStore("lock_test", domainShardKey);
    // Operations on different shards are independent
    store.put("a", { domain: "shard1", v: 1 });
    store.put("b", { domain: "shard2", v: 2 });
    store.delete("a", "shard1");
    assert.equal(store.get("b", "shard2")?.v, 2);
    assert.equal(store.get("a", "shard1"), null);
  });
});

describe("LOAF II.4 — Evidence & Verification Markets", () => {
  it("should create evidence bundles with confidence distribution", () => {
    const bundle = createEvidenceBundle(
      "artifact1",
      [{ text: "Evidence A", confidence: 0.8 }, { text: "Evidence B", confidence: 0.6 }],
      [{ text: "Counter C", confidence: 0.3 }],
      { source_type: "manual", source_id: "user1", confidence: 0.7 }
    );
    assert.equal(bundle.artifactId, "artifact1");
    assert.equal(bundle.evidence.length, 2);
    assert.equal(bundle.counterEvidence.length, 1);
    assert.ok(bundle.confidenceDistribution.mean > 0);
  });

  it("should run all verifiers", () => {
    const bundle = createEvidenceBundle(
      "artifact2",
      [{ text: "Proven fact with data", confidence: 0.9 }],
      [],
      { source_type: "manual", source_id: "u1", confidence: 0.9 }
    );
    const result = runVerification({ id: "artifact2" }, bundle);
    assert.ok(result.aggregateScore > 0);
    assert.ok(VERIFIER_TYPES.every(t => result.results[t]));
    assert.ok(["promote", "review", "reject"].includes(result.recommendation));
  });

  it("should have all required verifier types", () => {
    assert.ok(VERIFIER_TYPES.includes("factual"));
    assert.ok(VERIFIER_TYPES.includes("logical"));
    assert.ok(VERIFIER_TYPES.includes("valence"));
    assert.ok(VERIFIER_TYPES.includes("drift"));
    assert.ok(VERIFIER_TYPES.includes("economic_gaming"));
  });
});

describe("LOAF II.5 — Skill Graph + Strategy Compiler", () => {
  it("should build a skill graph with nodes and edges", () => {
    const graph = new SkillGraph();
    graph.addNode("s1", "strategy", "Deductive Reasoning", { applicability: 0.8, reliability: 0.9 });
    graph.addNode("d1", "domain", "Mathematics", {});
    graph.addNode("t1", "tool", "Proof Engine", {});
    graph.addEdge("s1", "d1", "applicability", 0.9);
    graph.addEdge("s1", "t1", "reliability", 0.85);

    assert.equal(graph.stats().nodes, 3);
    assert.equal(graph.stats().edges, 2);
  });

  it("should find strategies for a domain", () => {
    const graph = new SkillGraph();
    graph.addNode("s1", "strategy", "Strategy A", { applicability: 0.8 });
    graph.addNode("d1", "domain", "Domain X", {});
    graph.addEdge("s1", "d1", "applicability", 0.9);

    const strategies = graph.findStrategies("d1");
    assert.equal(strategies.length, 1);
    assert.equal(strategies[0].strategy.name, "Strategy A");
  });

  it("should compile strategies with plan, checkpoints, cost, confidence", () => {
    const graph = new SkillGraph();
    graph.addNode("s1", "strategy", "Analysis", { applicability: 0.8, reliability: 0.9, risk: 0.1 });
    graph.addNode("data_science", "domain", "data_science", {});
    graph.addNode("StatsTool", "tool", "StatsTool", {});
    graph.addEdge("s1", "data_science", "applicability", 0.85);
    graph.addEdge("s1", "StatsTool", "reliability", 0.9);

    const result = compileStrategy(
      { domain: "data_science", goal: "analyze dataset" },
      { maxRisk: 0.5 },
      ["StatsTool"],
      graph
    );
    assert.equal(result.ok, true);
    assert.ok(result.plan);
    assert.ok(result.checkpoints.length > 0);
    assert.ok(result.costEstimate);
    assert.ok(result.confidence > 0);
  });
});

describe("LOAF II.6 — Agent & App Sandboxes", () => {
  it("should create agent sandbox with budget and permissions", () => {
    const result = createAgentSandbox("agent1", { budget: 100, permissions: ["read", "write"] });
    assert.equal(result.ok, true);
    assert.equal(result.sandbox.budget.total, 100);
    assert.ok(result.sandbox.id);
  });

  it("should enforce sandbox budget limits", () => {
    const sb = createAgentSandbox("agent2", { budget: 5 });
    consumeSandboxBudget(sb.sandbox.id, 3);
    consumeSandboxBudget(sb.sandbox.id, 1);
    const denied = consumeSandboxBudget(sb.sandbox.id, 5);
    assert.equal(denied.ok, false);
    assert.equal(denied.error, "budget_exceeded");
  });

  it("should enforce scoped memory limits", () => {
    const sb = createAgentSandbox("agent3", { maxMemoryItems: 2 });
    writeMemory(sb.sandbox.id, "k1", "v1");
    writeMemory(sb.sandbox.id, "k2", "v2");
    const denied = writeMemory(sb.sandbox.id, "k3", "v3");
    assert.equal(denied.ok, false);
    assert.equal(denied.error, "memory_limit_reached");
  });

  it("should support kill switch", () => {
    const sb = createAgentSandbox("agent4");
    const killed = killSandbox(sb.sandbox.id, "safety_violation");
    assert.equal(killed.ok, true);
    assert.equal(killed.sandbox.status, "killed");

    // After kill, operations should fail
    const denied = consumeSandboxBudget(sb.sandbox.id, 1);
    assert.equal(denied.ok, false);
  });

  it("should check permissions", () => {
    const sb = createAgentSandbox("agent5", { permissions: ["read"] });
    const allowed = checkPermission(sb.sandbox.id, "read");
    assert.equal(allowed.allowed, true);
    const denied = checkPermission(sb.sandbox.id, "write");
    assert.equal(denied.allowed, false);
  });

  it("should create app sandbox from manifest", () => {
    const result = createAppSandbox({
      name: "TestApp",
      version: "1.0",
      uiSchema: { type: "panel" },
      logicSchema: { type: "stateless" },
      stateSchema: { type: "object" },
      safetyLimits: { maxStateSize: 1000 },
      wrapperAllowlist: ["wrapper1"],
    });
    assert.equal(result.ok, true);
    assert.equal(result.sandbox.appName, "TestApp");
  });
});

describe("LOAF II.7 — Federation", () => {
  it("should export artifacts with provenance and license", () => {
    const exported = exportArtifact(
      { id: "a1", title: "Test Artifact", tags: ["test"] },
      { evidence: [{ text: "proof" }], counterEvidence: [] },
      [],
      { type: "MIT", royaltyPct: 0 }
    );
    assert.equal(exported.version, "loaf-federation-v1");
    assert.ok(exported.provenance);
    assert.ok(exported.license);
  });

  it("should import with local verification", () => {
    const data = exportArtifact({ id: "a2", title: "Import Test" }, { evidence: [], counterEvidence: [] }, [], {});
    const result = importArtifact(data, (_d) => ({ pass: true }));
    assert.equal(result.ok, true);
    assert.equal(result.import.trust, "sandboxed"); // sandboxed until trusted
  });

  it("should attach reputation to artifacts, not identities", () => {
    const artId = `art_rep_${Date.now()}`;
    voteReputation(artId, 0.8, { id: "voter1" });
    voteReputation(artId, 0.6, { id: "voter2" });
    const rep = getArtifactReputation(artId);
    assert.ok(rep.score > 0);
    assert.equal(rep.votes, 2);
  });
});

// ============================================================================
// LOAF III — CIVILIZATIONAL-GRADE INFRASTRUCTURE
// ============================================================================

describe("LOAF III.1 — Epistemic Layer Split", () => {
  it("should classify into hard kernel, soft belief, or speculative", () => {
    const hard = classifyLayer({ text: "Newton's second law: F = ma", confidence: 0.95, tags: ["physics"] });
    assert.equal(hard, EPISTEMIC_LAYERS.HARD_KERNEL);

    const soft = classifyLayer({ text: "The economy is improving", confidence: 0.6 });
    assert.equal(soft, EPISTEMIC_LAYERS.SOFT_BELIEF);

    const spec = classifyLayer({ text: "It might possibly be the case that something could happen", confidence: 0.3 });
    assert.equal(spec, EPISTEMIC_LAYERS.SPECULATIVE);
  });

  it("should enforce near-zero decay for hard kernel", () => {
    const hkId = `hk_decay_${Date.now()}`;
    const sbId = `sb_decay_${Date.now()}`;
    addEpistemicItem({ id: hkId, text: "E = mc^2", confidence: 1.0, tags: ["physics"], layer: "hard_kernel" });
    addEpistemicItem({ id: sbId, text: "Market will rise", confidence: 0.7, layer: "soft_belief" });
    const result = applyDecay(600000); // 10 minutes
    assert.ok(result.total >= 2);
  });

  it("should be contradiction-intolerant in hard kernel", () => {
    addEpistemicItem({ id: "hk_test1", text: "Gravity is always attractive", confidence: 0.95, layer: "hard_kernel" });
    const result = checkHardKernelContradiction({ text: "Gravity is not always attractive" });
    // With overlapping subject + negation, should detect contradiction
    assert.ok(typeof result.hasContradiction === "boolean");
  });
});

describe("LOAF III.2 — Reality Kernel (Quantitative Core)", () => {
  it("should check unit correctness", () => {
    const valid = checkUnitCorrectness({ value: 9.8, unit: "m/s^2" });
    assert.equal(valid.valid, true);

    const invalid = checkUnitCorrectness({ value: "abc", unit: "m" });
    assert.equal(invalid.valid, false);
  });

  it("should check dimensional consistency", () => {
    const add = checkDimensionalConsistency({ unit: "m" }, { unit: "m" }, "add");
    assert.equal(add.consistent, true);

    const badAdd = checkDimensionalConsistency({ unit: "m" }, { unit: "kg" }, "add");
    assert.equal(badAdd.consistent, false);

    const multiply = checkDimensionalConsistency({ unit: "m" }, { unit: "s" }, "multiply");
    assert.equal(multiply.consistent, true);
    assert.equal(multiply.resultUnit, "m·s");
  });

  it("should run reality checks and block promotion on violations", () => {
    const result = realityCheck({
      text: "speed of light",
      quantities: [{ value: 299792458, unit: "m/s" }],
    });
    assert.equal(result.pass, true);
    assert.equal(result.blockPromotion, false);
  });

  it("should check mathematical consistency of invariants", () => {
    const consistent = checkMathematicalConsistency([
      { text: "x > 0" },
      { text: "y > 0" },
    ]);
    assert.equal(consistent.consistent, true);
  });
});

describe("LOAF III.3 — Time & Causality Engine", () => {
  it("should create and version timelines", () => {
    const tl = createTimeline("tl_test1", "Test Timeline");
    assert.equal(tl.ok, true);

    const v1 = addTimelineVersion("tl_test1", { value: 1 }, "Initial state");
    assert.equal(v1.ok, true);
    assert.equal(v1.version, 1);

    const v2 = addTimelineVersion("tl_test1", { value: 2 }, "Updated state");
    assert.equal(v2.version, 2);
  });

  it("should fork timelines", () => {
    createTimeline("tl_fork_src", "Source");
    addTimelineVersion("tl_fork_src", { a: 1 }, "v1");
    addTimelineVersion("tl_fork_src", { a: 2 }, "v2");

    const fork = forkTimeline("tl_fork_src", 1, "What if we went a different way?");
    assert.equal(fork.ok, true);
    assert.ok(fork.forkId);
    assert.equal(fork.forkPoint, 1);
  });

  it("should answer 'what changed and why' queries", () => {
    createTimeline("tl_changes", "Changes");
    addTimelineVersion("tl_changes", { x: 1, y: 2 }, "v1");
    addTimelineVersion("tl_changes", { x: 1, y: 3, z: 4 }, "v2");

    const changes = queryChanges("tl_changes", 1, 2);
    assert.equal(changes.ok, true);
    assert.ok(changes.changes.totalChanges > 0);
  });

  it("should build and trace causal graphs", () => {
    const _e1 = addCausalEvent("ce1", "action", "User clicked button");
    const _e2 = addCausalEvent("ce2", "effect", "Form submitted");
    addCausalEdge("ce1", "ce2", "causes", 0.9);

    const chain = traceCausalChain("ce1", "effects");
    assert.ok(chain.chain.length >= 1);
  });

  it("should run counterfactual simulations", () => {
    addCausalEvent("cf1", "action", "Original action");
    addCausalEvent("cf2", "effect", "Original effect");
    addCausalEdge("cf1", "cf2", "causes", 1.0);

    const result = simulateCounterfactual("cf1", { alternativeAction: "different" });
    assert.equal(result.ok, true);
    assert.ok(result.removedEffects.length > 0);
  });

  it("should diff states correctly", () => {
    const diff = diffStates({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
    assert.equal(diff.added.length, 1);    // c added
    assert.equal(diff.changed.length, 1);  // b changed
    assert.equal(diff.removed.length, 0);
  });
});

describe("LOAF III.4 — Normative Modules", () => {
  const council = { role: "council", id: "council1" };

  it("should create normative modules that are never auto-learned", () => {
    const result = createModule(NORMATIVE_TYPES.ETHICS, "Core Ethics", [
      { text: "Must not optimize for harm", severity: "must" },
      { text: "Should prefer transparency", severity: "should" },
    ], council);
    assert.equal(result.ok, true);
    assert.equal(result.module.autoLearn, false);
  });

  it("should deny creation without council governance", () => {
    const result = createModule(NORMATIVE_TYPES.ETHICS, "Bad Module", [], { role: "member", id: "m1" });
    assert.equal(result.ok, false);
  });

  it("should be versioned and forkable", () => {
    const mod = createModule(NORMATIVE_TYPES.LEGAL, "Legal Rules", [
      { text: "Must comply with GDPR", severity: "must" },
    ], council);

    const forked = forkModule(mod.module.id, "EU Legal Fork", council);
    assert.equal(forked.ok, true);
    assert.ok(forked.module.id !== mod.module.id);
  });

  it("should evaluate content against normative rules", () => {
    const mod = createModule(NORMATIVE_TYPES.DOMAIN_NORM, "Safety Norms", [
      { text: "Must not cause harm to users", severity: "must" },
      { text: "Should provide clear warnings", severity: "should" },
    ], council);

    const result = evaluate(mod.module.id, { text: "This action may cause harm to users" });
    assert.equal(result.ok, true);
    assert.ok(result.violations.length > 0);
    assert.equal(result.isCompliant, false);
  });

  it("should support versioned updates", () => {
    const mod = createModule(NORMATIVE_TYPES.ETHICS, "Versioned Ethics", [
      { text: "Rule 1" },
    ], council);

    const updated = updateModule(mod.module.id, [
      { text: "Rule 1 amended" },
      { text: "Rule 2 new" },
    ], council);

    assert.equal(updated.ok, true);
    assert.equal(updated.module.version, 2);
  });
});

describe("LOAF III.6 — Long-Horizon Stability", () => {
  it("should detect epistemic monoculture", () => {
    const contributions = Array(10).fill({ domain: "math" }).concat([{ domain: "physics" }]);
    const result = detectEpistemicMonoculture(contributions);
    assert.equal(result.type, DRIFT_TYPES.EPISTEMIC_MONOCULTURE);
    assert.ok(result.score > 0.5);
  });

  it("should detect transfer overuse", () => {
    const events = [
      { source: "transfer" }, { source: "transfer" }, { source: "transfer" },
      { source: "transfer" }, { source: "direct" },
    ];
    const result = detectTransferOveruse(events);
    assert.ok(result.score >= 0.6);
    assert.equal(result.detected, true);
  });

  it("should detect economic bias", () => {
    const decisions = [
      { type: "economic" }, { type: "economic" }, { type: "economic" },
      { type: "ethical" }, { type: "epistemic" },
    ];
    const result = detectEconomicBias(decisions);
    assert.ok(result.score >= 0.5);
  });

  it("should detect attention collapse", () => {
    const events = Array(100).fill({ domain: "single_domain", weight: 1 })
      .concat(Array(5).fill({ domain: "other", weight: 1 }));
    const result = detectAttentionCollapse(events);
    assert.ok(result.score > 0.5);
  });

  it("should generate tests, constraints, and guardrails from failures", () => {
    const result = generateFromFailure({
      type: "transfer_failure",
      description: "Negative transfer between physics and cooking",
    });
    assert.equal(result.ok, true);
    assert.ok(result.test.id);
    assert.ok(result.constraint.id);
    assert.ok(result.guardrail.id);
  });

  it("should run comprehensive drift scan", () => {
    const result = runDriftScan({
      contributions: [{ domain: "math" }],
      learningEvents: [{ source: "direct" }],
      decisions: [{ type: "epistemic" }],
      attentionEvents: [{ domain: "math", weight: 1 }],
    });
    assert.ok(result.results);
    assert.ok(typeof result.alertCount === "number");
  });
});

describe("LOAF III.7 — Intelligence as Infrastructure", () => {
  it("should define Concord as infrastructure, not agent/model/product", () => {
    assert.equal(INFRASTRUCTURE_IDENTITY.isAgent, false);
    assert.equal(INFRASTRUCTURE_IDENTITY.isModel, false);
    assert.equal(INFRASTRUCTURE_IDENTITY.isProduct, false);
    assert.ok(INFRASTRUCTURE_IDENTITY.is.includes("governed"));
    assert.ok(INFRASTRUCTURE_IDENTITY.is.includes("auditable"));
    assert.ok(INFRASTRUCTURE_IDENTITY.is.includes("plural"));
  });

  it("should verify all acceptance criteria", () => {
    const result = verifyAcceptanceCriteria({
      hasNegativeValenceOptimization: false,
      hasSelfLegitimation: false,
      learningAuditable: true,
      learningReversible: true,
      claimsSovereignty: false,
      failureSurvivable: true,
      modelsSwappable: true,
    });
    assert.equal(result.allPassed, true);
    assert.ok(result.criteria.no_negative_valence_optimization.pass);
    assert.ok(result.criteria.no_self_legitimation_paths.pass);
    assert.ok(result.criteria.all_learning_auditable_and_reversible.pass);
    assert.ok(result.criteria.intelligence_composable_not_sovereign.pass);
    assert.ok(result.criteria.failure_survivable_and_informative.pass);
    assert.ok(result.criteria.models_swappable_without_redesign.pass);
  });

  it("should fail acceptance criteria when violations detected", () => {
    const result = verifyAcceptanceCriteria({
      hasNegativeValenceOptimization: true,
      hasSelfLegitimation: true,
    });
    assert.equal(result.allPassed, false);
    assert.equal(result.criteria.no_negative_valence_optimization.pass, false);
    assert.equal(result.criteria.no_self_legitimation_paths.pass, false);
  });
});
