// learning/learning-verification.test.js
// Comprehensive test suite for Learning Verification & Substrate Integrity.
// Tests: DTU classification, retrieval hit rate, utilization tracking,
// novelty verification, helpfulness scoring, generation quotas,
// probation gates, domain coverage, substrate pruning, learning dashboard.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Classification ──────────────────────────────────────────────────────────
import {
  CLASSIFICATIONS, PUBLIC_CLASSIFICATIONS, INTERNAL_CLASSIFICATIONS,
  classifyDTU, isRepairDTU, isPublicDTU, applyClassification,
  migrateClassifications, computeSubstrateStats,
} from "./classification.js";

// ── Metrics ─────────────────────────────────────────────────────────────────
import {
  getLearningStore,
  recordQueryMethod, getRetrievalHitRate, getRetrievalTrend,
  recordCitation, recordNegativeSignal, getUtilizationStats,
  recordGeneration, getNoveltyStats, checkNovelty,
  recordResponseQuality, getHelpfulnessScores,
  checkGenerationQuota, recordGenerationUsed, getRecommendedEvolutionRatio,
  checkProbation, runProbationAudit,
  getDomainCoverage,
  runSubstratePruning,
  getLearningDashboard, runDedupAudit,
  DEFAULT_QUOTAS, DEDUP_SIMILARITY_THRESHOLD, PROBATION_DAYS,
  PRUNE_ZERO_CITATION_DAYS, REPAIR_ARCHIVE_DAYS,
  jaccardSimilarity, tokenize, extractText,
} from "./metrics.js";

// ── Helpers ─────────────────────────────────────────────────────────────────
function freshState() {
  return { dtus: new Map(), shadowDtus: new Map(), settings: {} };
}

function makeDTU(overrides = {}) {
  const id = overrides.id || `dtu_test_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    title: overrides.title || `Test DTU ${id}`,
    tier: overrides.tier || "regular",
    source: overrides.source || "learned",
    tags: overrides.tags || ["test"],
    classification: overrides.classification || undefined,
    authority: overrides.authority || { model: "seed", score: 0 },
    human: overrides.human || { summary: `Summary for ${id}` },
    machine: overrides.machine || { notes: `Notes for ${id}` },
    meta: overrides.meta || {},
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    cretiHuman: overrides.cretiHuman || "",
    ...overrides,
  };
}

function addDTUs(state, count, overrides = {}) {
  for (let i = 0; i < count; i++) {
    const dtu = makeDTU({ ...overrides, id: `${overrides.id || "dtu"}_${i}` });
    state.dtus.set(dtu.id, dtu);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CLASSIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

describe("DTU Classification System", () => {
  describe("CLASSIFICATIONS enum", () => {
    it("has exactly 8 classifications", () => {
      assert.equal(Object.keys(CLASSIFICATIONS).length, 8);
    });

    it("includes all required types", () => {
      assert.equal(CLASSIFICATIONS.KNOWLEDGE, "knowledge");
      assert.equal(CLASSIFICATIONS.SEED, "seed");
      assert.equal(CLASSIFICATIONS.MEGA, "mega");
      assert.equal(CLASSIFICATIONS.HYPER, "hyper");
      assert.equal(CLASSIFICATIONS.SHADOW, "shadow");
      assert.equal(CLASSIFICATIONS.REPAIR, "repair");
      assert.equal(CLASSIFICATIONS.SCAFFOLD, "scaffold");
      assert.equal(CLASSIFICATIONS.DEPRECATED, "deprecated");
    });

    it("public classifications has 4 items", () => {
      assert.equal(PUBLIC_CLASSIFICATIONS.length, 4);
      assert.ok(PUBLIC_CLASSIFICATIONS.includes("knowledge"));
      assert.ok(PUBLIC_CLASSIFICATIONS.includes("seed"));
      assert.ok(PUBLIC_CLASSIFICATIONS.includes("mega"));
      assert.ok(PUBLIC_CLASSIFICATIONS.includes("hyper"));
    });

    it("internal classifications has 4 items", () => {
      assert.equal(INTERNAL_CLASSIFICATIONS.length, 4);
      assert.ok(INTERNAL_CLASSIFICATIONS.includes("shadow"));
      assert.ok(INTERNAL_CLASSIFICATIONS.includes("repair"));
      assert.ok(INTERNAL_CLASSIFICATIONS.includes("scaffold"));
      assert.ok(INTERNAL_CLASSIFICATIONS.includes("deprecated"));
    });
  });

  describe("classifyDTU", () => {
    it("respects existing classification", () => {
      assert.equal(classifyDTU({ classification: "deprecated" }), "deprecated");
    });

    it("classifies shadow DTUs by tier", () => {
      assert.equal(classifyDTU({ tier: "shadow" }), "shadow");
    });

    it("classifies shadow DTUs by tag", () => {
      assert.equal(classifyDTU({ tags: ["shadow"] }), "shadow");
    });

    it("classifies repair DTUs by source", () => {
      assert.equal(classifyDTU({ source: "repair_cortex" }), "repair");
    });

    it("classifies repair DTUs by tag", () => {
      assert.equal(classifyDTU({ tags: ["repair_cortex", "guardian"] }), "repair");
    });

    it("classifies hyper tier", () => {
      assert.equal(classifyDTU({ tier: "hyper" }), "hyper");
    });

    it("classifies mega tier", () => {
      assert.equal(classifyDTU({ tier: "mega" }), "mega");
    });

    it("classifies seed source", () => {
      assert.equal(classifyDTU({ source: "seed" }), "seed");
    });

    it("classifies bootstrap source as seed", () => {
      assert.equal(classifyDTU({ source: "bootstrap" }), "seed");
    });

    it("classifies seed authority model as seed", () => {
      assert.equal(classifyDTU({ authority: { model: "seed" } }), "seed");
    });

    it("defaults to knowledge", () => {
      assert.equal(classifyDTU({ tier: "regular", source: "learned" }), "knowledge");
    });

    it("handles null input", () => {
      assert.equal(classifyDTU(null), "knowledge");
    });
  });

  describe("isRepairDTU", () => {
    it("detects repair_cortex source", () => {
      assert.ok(isRepairDTU({ source: "repair_cortex" }));
    });

    it("detects repair tag", () => {
      assert.ok(isRepairDTU({ tags: ["repair"] }));
    });

    it("detects repair in meta", () => {
      assert.ok(isRepairDTU({ meta: { createdBy: "repair_cortex" } }));
    });

    it("detects repair brain source in meta", () => {
      assert.ok(isRepairDTU({ meta: { brainSource: "repair" } }));
    });

    it("rejects non-repair DTUs", () => {
      assert.ok(!isRepairDTU({ source: "learned", tags: ["general"] }));
    });

    it("handles null input", () => {
      assert.ok(!isRepairDTU(null));
    });
  });

  describe("isPublicDTU", () => {
    it("knowledge is public", () => {
      assert.ok(isPublicDTU({ classification: "knowledge" }));
    });

    it("seed is public", () => {
      assert.ok(isPublicDTU({ classification: "seed" }));
    });

    it("mega is public", () => {
      assert.ok(isPublicDTU({ classification: "mega" }));
    });

    it("hyper is public", () => {
      assert.ok(isPublicDTU({ classification: "hyper" }));
    });

    it("shadow is NOT public", () => {
      assert.ok(!isPublicDTU({ classification: "shadow" }));
    });

    it("repair is NOT public", () => {
      assert.ok(!isPublicDTU({ classification: "repair" }));
    });

    it("scaffold is NOT public", () => {
      assert.ok(!isPublicDTU({ classification: "scaffold" }));
    });

    it("deprecated is NOT public", () => {
      assert.ok(!isPublicDTU({ classification: "deprecated" }));
    });
  });

  describe("applyClassification", () => {
    it("adds classification field to DTU", () => {
      const dtu = { tier: "mega", source: "learned" };
      applyClassification(dtu);
      assert.equal(dtu.classification, "mega");
    });

    it("handles null DTU", () => {
      assert.equal(applyClassification(null), null);
    });
  });

  describe("migrateClassifications", () => {
    it("migrates DTUs without classification", () => {
      const dtus = new Map();
      dtus.set("a", { id: "a", tier: "regular", source: "learned" });
      dtus.set("b", { id: "b", tier: "mega", source: "learned" });
      dtus.set("c", { id: "c", source: "repair_cortex", tags: ["repair_cortex"] });

      const result = migrateClassifications(dtus);
      assert.equal(result.migrated, 3);
      assert.equal(dtus.get("a").classification, "knowledge");
      assert.equal(dtus.get("b").classification, "mega");
      assert.equal(dtus.get("c").classification, "repair");
    });

    it("skips already classified DTUs", () => {
      const dtus = new Map();
      dtus.set("a", { id: "a", classification: "seed" });
      const result = migrateClassifications(dtus);
      assert.equal(result.migrated, 0);
    });
  });

  describe("computeSubstrateStats", () => {
    it("counts public vs internal DTUs", () => {
      const dtus = new Map();
      dtus.set("k1", { classification: "knowledge" });
      dtus.set("k2", { classification: "knowledge" });
      dtus.set("s1", { classification: "seed" });
      dtus.set("m1", { classification: "mega" });
      dtus.set("h1", { classification: "hyper" });
      dtus.set("r1", { classification: "repair" });
      dtus.set("sc1", { classification: "scaffold" });
      dtus.set("d1", { classification: "deprecated" });

      const stats = computeSubstrateStats(dtus);
      assert.equal(stats.substrate.knowledge.total, 5); // 2 knowledge + 1 seed + 1 mega + 1 hyper
      assert.equal(stats.substrate.knowledge.regular, 2);
      assert.equal(stats.substrate.knowledge.seed, 1);
      assert.equal(stats.substrate.knowledge.mega, 1);
      assert.equal(stats.substrate.knowledge.hyper, 1);
      assert.equal(stats.substrate.internal.repair, 1);
      assert.equal(stats.substrate.internal.scaffold, 1);
      assert.equal(stats.substrate.internal.deprecated, 1);
      assert.equal(stats.substrate.grand_total, 8);
    });

    it("counts separate shadow DTU store", () => {
      const dtus = new Map();
      dtus.set("k1", { classification: "knowledge" });

      const shadowDtus = new Map();
      shadowDtus.set("s1", { id: "s1" });
      shadowDtus.set("s2", { id: "s2" });

      const stats = computeSubstrateStats(dtus, shadowDtus);
      assert.equal(stats.substrate.internal.shadow, 2);
      assert.equal(stats.substrate.knowledge.total, 1);
      assert.equal(stats.substrate.grand_total, 3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RETRIEVAL HIT RATE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Retrieval Hit Rate", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("records query methods", () => {
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "retrieval_sufficient");
    recordQueryMethod(STATE, "llm_required");

    const rate = getRetrievalHitRate(STATE, 1);
    assert.equal(rate.total_queries, 3);
    // Hit rate = (cache + retrieval) / total = 2/3
    assert.ok(rate.hit_rate > 0.6);
    assert.ok(rate.hit_rate < 0.7);
  });

  it("returns 0 hit rate with no data", () => {
    const rate = getRetrievalHitRate(STATE, 24);
    assert.equal(rate.hit_rate, 0);
    assert.equal(rate.total_queries, 0);
  });

  it("computes method breakdown", () => {
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "llm_required");
    recordQueryMethod(STATE, "llm_required");
    recordQueryMethod(STATE, "llm_required");

    const rate = getRetrievalHitRate(STATE, 24);
    assert.equal(rate.by_method.semantic_cache, 0.4);
    assert.equal(rate.by_method.llm_required, 0.6);
  });

  it("computes retrieval trend", () => {
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "retrieval_sufficient");

    const trend = getRetrievalTrend(STATE);
    assert.ok(typeof trend.last_24h === "number");
    assert.ok(typeof trend.last_7d === "number");
    assert.ok(typeof trend.last_30d === "number");
    assert.ok(["stable", "increasing", "decreasing"].includes(trend.trend));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DTU UTILIZATION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe("DTU Utilization Tracking", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    addDTUs(STATE, 5, { classification: "knowledge", tags: ["general"] });
  });

  it("records citations", () => {
    recordCitation(STATE, "dtu_0");
    recordCitation(STATE, "dtu_0");
    recordCitation(STATE, "dtu_1");

    const store = getLearningStore(STATE);
    assert.equal(store.citations.get("dtu_0").count, 2);
    assert.equal(store.citations.get("dtu_1").count, 1);
  });

  it("tracks positive and negative signals", () => {
    recordCitation(STATE, "dtu_0", true);
    recordCitation(STATE, "dtu_0", false);

    const store = getLearningStore(STATE);
    const entry = store.citations.get("dtu_0");
    assert.equal(entry.positive_signals, 1);
    assert.equal(entry.negative_signals, 1);
  });

  it("records negative signal on existing citation", () => {
    recordCitation(STATE, "dtu_0");
    recordNegativeSignal(STATE, "dtu_0");

    const store = getLearningStore(STATE);
    assert.equal(store.citations.get("dtu_0").negative_signals, 1);
  });

  it("computes utilization stats", () => {
    recordCitation(STATE, "dtu_0");
    recordCitation(STATE, "dtu_1");

    const stats = getUtilizationStats(STATE, 30);
    assert.equal(stats.dtus_cited_in_responses, 2);
    assert.equal(stats.dtus_never_cited, 3);
    assert.equal(stats.utilization_rate, 0.4); // 2/5
    assert.ok(stats.distribution);
    assert.ok(stats.dead_weight);
  });

  it("returns 0 utilization with no DTUs", () => {
    const emptyState = freshState();
    const stats = getUtilizationStats(emptyState, 30);
    assert.equal(stats.utilization_rate, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. NOVELTY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Novelty Verification", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  describe("recordGeneration / getNoveltyStats", () => {
    it("records novel generations", () => {
      recordGeneration(STATE, "novel");
      recordGeneration(STATE, "novel");
      recordGeneration(STATE, "redundant");

      const stats = getNoveltyStats(STATE);
      assert.equal(stats.last_24h.dtus_generated, 3);
      assert.equal(stats.last_24h.genuinely_novel, 2);
      assert.equal(stats.last_24h.redundant, 1);
      assert.ok(stats.last_24h.novelty_rate > 0.66);
    });

    it("returns rate 1.0 with no data", () => {
      const stats = getNoveltyStats(STATE);
      assert.equal(stats.last_24h.novelty_rate, 1); // No data = assume novel
    });

    it("tracks trivial generations", () => {
      recordGeneration(STATE, "trivial");
      const stats = getNoveltyStats(STATE);
      assert.equal(stats.last_24h.trivial, 1);
    });
  });

  describe("checkNovelty (Jaccard similarity)", () => {
    it("detects novel DTU", () => {
      const existing = new Map();
      existing.set("e1", makeDTU({ title: "Quantum computing fundamentals", human: { summary: "Covers qubits and quantum gates" }, classification: "knowledge" }));

      const candidate = makeDTU({ title: "Machine learning optimization", human: { summary: "Gradient descent and backpropagation techniques" } });

      const result = checkNovelty(candidate, existing);
      assert.ok(result.novel);
    });

    it("detects duplicate DTU", () => {
      const existing = new Map();
      existing.set("e1", makeDTU({
        title: "Introduction to machine learning algorithms",
        human: { summary: "Covers supervised and unsupervised learning algorithms" },
        classification: "knowledge",
      }));

      const candidate = makeDTU({
        title: "Introduction to machine learning algorithms",
        human: { summary: "Covers supervised and unsupervised learning algorithms" },
      });

      const result = checkNovelty(candidate, existing);
      assert.ok(!result.novel);
      assert.equal(result.reason, "duplicate");
    });

    it("detects trivial content", () => {
      const candidate = makeDTU({ title: "ab", human: { summary: "" }, cretiHuman: "", machine: {} });
      const result = checkNovelty(candidate, new Map());
      assert.ok(!result.novel);
      assert.equal(result.reason, "trivial_content");
    });

    it("skips comparing to self", () => {
      const existing = new Map();
      const dtu = makeDTU({ id: "same_id", title: "Testing self comparison", classification: "knowledge" });
      existing.set("same_id", dtu);

      const result = checkNovelty(dtu, existing);
      assert.ok(result.novel);
    });
  });

  describe("jaccardSimilarity", () => {
    it("returns 1 for identical sets", () => {
      const a = new Set(["hello", "world"]);
      const b = new Set(["hello", "world"]);
      assert.equal(jaccardSimilarity(a, b), 1);
    });

    it("returns 0 for disjoint sets", () => {
      const a = new Set(["hello"]);
      const b = new Set(["world"]);
      assert.equal(jaccardSimilarity(a, b), 0);
    });

    it("returns correct value for overlapping sets", () => {
      const a = new Set(["hello", "world", "test"]);
      const b = new Set(["hello", "world", "other"]);
      // intersection = 2, union = 4
      assert.equal(jaccardSimilarity(a, b), 0.5);
    });

    it("handles empty sets", () => {
      assert.equal(jaccardSimilarity(new Set(), new Set()), 1);
    });
  });

  describe("tokenize", () => {
    it("tokenizes text into word set", () => {
      const tokens = tokenize("hello world test");
      assert.ok(tokens.has("hello"));
      assert.ok(tokens.has("world"));
      assert.ok(tokens.has("test"));
    });

    it("removes short tokens", () => {
      const tokens = tokenize("a ab abc abcd");
      assert.ok(!tokens.has("a"));
      assert.ok(!tokens.has("ab"));
      assert.ok(tokens.has("abc"));
      assert.ok(tokens.has("abcd"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RESPONSE QUALITY / HELPFULNESS SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Helpfulness Scoring", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    addDTUs(STATE, 3, { classification: "knowledge" });
  });

  it("records positive response quality", () => {
    recordResponseQuality(STATE, {
      dtus_used: ["dtu_0"],
      user_continued: true,
    });

    const store = getLearningStore(STATE);
    const h = store.helpfulness.get("dtu_0");
    assert.equal(h.times_used, 1);
    assert.equal(h.positive_signals, 1);
    assert.equal(h.score, 1);
  });

  it("records negative response quality", () => {
    recordResponseQuality(STATE, {
      dtus_used: ["dtu_0"],
      user_contradicted: true,
    });

    const store = getLearningStore(STATE);
    const h = store.helpfulness.get("dtu_0");
    assert.equal(h.negative_signals, 1);
    assert.equal(h.score, 0);
  });

  it("computes score with mixed signals", () => {
    recordResponseQuality(STATE, { dtus_used: ["dtu_0"], user_continued: true });
    recordResponseQuality(STATE, { dtus_used: ["dtu_0"], user_continued: true });
    recordResponseQuality(STATE, { dtus_used: ["dtu_0"], user_contradicted: true });

    const store = getLearningStore(STATE);
    const h = store.helpfulness.get("dtu_0");
    assert.equal(h.times_used, 3);
    assert.equal(h.positive_signals, 2);
    assert.equal(h.negative_signals, 1);
    assert.ok(h.score > 0.6); // 2/3 ≈ 0.67
  });

  it("also records citations", () => {
    recordResponseQuality(STATE, { dtus_used: ["dtu_0", "dtu_1"], user_continued: true });

    const store = getLearningStore(STATE);
    assert.ok(store.citations.has("dtu_0"));
    assert.ok(store.citations.has("dtu_1"));
  });

  it("gets helpfulness scores sorted", () => {
    recordResponseQuality(STATE, { dtus_used: ["dtu_0"], user_continued: true });
    recordResponseQuality(STATE, { dtus_used: ["dtu_1"], user_contradicted: true });

    const scores = getHelpfulnessScores(STATE);
    assert.ok(scores.top.length >= 2);
    assert.ok(scores.top[0].score >= scores.top[1].score);
    assert.ok(typeof scores.total_tracked === "number");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. GENERATION QUOTAS & NOVELTY THROTTLE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Generation Quotas", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("allows generation under limit", () => {
    const result = checkGenerationQuota(STATE);
    assert.ok(result.allowed);
    assert.ok(result.hourly);
    assert.ok(result.daily);
  });

  it("records generation and increments counters", () => {
    recordGenerationUsed(STATE);
    recordGenerationUsed(STATE);

    const result = checkGenerationQuota(STATE);
    assert.equal(result.hourly.used, 2);
    assert.equal(result.daily.used, 2);
  });

  it("blocks when hourly limit reached", () => {
    // Manually set counters to max
    const store = getLearningStore(STATE);
    const now = new Date();
    store.generation.current_hour = now.toISOString().slice(0, 13);
    store.generation.current_hour_count = 20;
    store.generation.current_day = now.toISOString().slice(0, 10);
    store.generation.current_day_count = 20;

    const result = checkGenerationQuota(STATE);
    assert.ok(!result.allowed);
    assert.equal(result.reason, "hourly_limit_reached");
  });

  it("reduces limits when novelty rate is low", () => {
    // Record mostly redundant generations
    for (let i = 0; i < 10; i++) recordGeneration(STATE, "redundant");
    recordGeneration(STATE, "novel"); // 1/11 ≈ 0.09 novelty rate

    const result = checkGenerationQuota(STATE);
    // With ~0.09 novelty rate (below threshold_low=0.30), limit should be 25%
    assert.ok(result.hourly.limit <= DEFAULT_QUOTAS.max_autogen_per_hour * 0.3);
  });

  it("gets recommended evolution ratio", () => {
    const ratio = getRecommendedEvolutionRatio(STATE);
    assert.ok(ratio >= 0.2);
    assert.ok(ratio <= 0.6);
  });

  it("increases evolution ratio when novelty is low", () => {
    // Record mostly redundant
    for (let i = 0; i < 10; i++) recordGeneration(STATE, "redundant");
    recordGeneration(STATE, "novel");

    const ratio = getRecommendedEvolutionRatio(STATE);
    assert.ok(ratio > DEFAULT_QUOTAS.evolution_ratio); // Should recommend more evolution
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PROMOTION GATES (Probation System)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Promotion Gates", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("seeds are always promoted", () => {
    const dtu = makeDTU({ classification: "seed" });
    const result = checkProbation(STATE, dtu);
    assert.equal(result.status, "promoted");
    assert.equal(result.reason, "seed_dtu");
  });

  it("new DTU is in probation", () => {
    const dtu = makeDTU({ classification: "knowledge", createdAt: new Date().toISOString() });
    const result = checkProbation(STATE, dtu);
    assert.equal(result.status, "probation");
  });

  it("old uncited DTU is demoted", () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    const result = checkProbation(STATE, dtu);
    assert.equal(result.status, "demoted");
    assert.equal(result.reason, "never_cited_after_probation");
  });

  it("old cited DTU is promoted", () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);
    recordCitation(STATE, dtu.id);

    const result = checkProbation(STATE, dtu);
    assert.equal(result.status, "promoted");
    assert.equal(result.reason, "cited_during_probation");
  });

  it("demotes DTU with negative helpfulness", () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);
    recordCitation(STATE, dtu.id);

    // Record more negatives than positives
    const store = getLearningStore(STATE);
    store.helpfulness.set(dtu.id, { times_used: 5, positive_signals: 1, negative_signals: 3, score: 0.25 });

    const result = checkProbation(STATE, dtu);
    assert.equal(result.status, "demoted");
    assert.equal(result.reason, "negative_helpfulness");
  });

  it("runProbationAudit counts all categories", () => {
    // Add a mix of DTUs
    const newDTU = makeDTU({ classification: "knowledge", createdAt: new Date().toISOString() });
    const oldCited = makeDTU({ classification: "knowledge", createdAt: new Date(Date.now() - 10 * 86400000).toISOString() });
    const oldUncited = makeDTU({ classification: "knowledge", createdAt: new Date(Date.now() - 10 * 86400000).toISOString() });

    STATE.dtus.set(newDTU.id, newDTU);
    STATE.dtus.set(oldCited.id, oldCited);
    STATE.dtus.set(oldUncited.id, oldUncited);

    // Cite only one of the old DTUs
    recordCitation(STATE, oldCited.id);

    const result = runProbationAudit(STATE);
    assert.equal(result.still_in_probation, 1);
    assert.equal(result.promoted, 1);
    assert.equal(result.demoted, 1);
    assert.equal(result.candidates.length, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. DOMAIN COVERAGE MAP
// ═══════════════════════════════════════════════════════════════════════════════

describe("Domain Coverage Map", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    // Add DTUs across domains
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`math_${i}`, makeDTU({ id: `math_${i}`, tags: ["math"], classification: "knowledge" }));
    }
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`science_${i}`, makeDTU({ id: `science_${i}`, tags: ["science"], classification: "knowledge" }));
    }
    // Add non-public DTU — should be excluded
    STATE.dtus.set("repair_1", makeDTU({ id: "repair_1", tags: ["repair"], classification: "repair" }));
  });

  it("counts DTUs per domain", () => {
    const coverage = getDomainCoverage(STATE);
    assert.equal(coverage.domains.math.dtus, 10);
    assert.equal(coverage.domains.science.dtus, 5);
    assert.ok(!coverage.domains.repair); // Repair is internal, excluded
  });

  it("computes utilization per domain", () => {
    recordCitation(STATE, "math_0");
    recordCitation(STATE, "math_1");

    const coverage = getDomainCoverage(STATE);
    assert.equal(coverage.domains.math.utilized, 2);
    assert.equal(coverage.domains.math.utilization, 0.2); // 2/10
  });

  it("computes concentration index", () => {
    const coverage = getDomainCoverage(STATE);
    assert.ok(typeof coverage.concentration_index === "number");
    assert.ok(coverage.concentration_index > 0);
    assert.ok(coverage.concentration_index <= 1);
  });

  it("identifies starving and saturated domains", () => {
    const coverage = getDomainCoverage(STATE);
    // Both domains have < 50 DTUs but utilization defaults to 0 (not > 0.4)
    // So they shouldn't be identified as starving unless cited heavily
    assert.ok(Array.isArray(coverage.starving_domains));
    assert.ok(Array.isArray(coverage.saturated_domains));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SUBSTRATE PRUNING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Substrate Pruning", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("reclassifies uncited old DTUs as scaffold", () => {
    const oldDate = new Date(Date.now() - 65 * 86400000).toISOString(); // 65 days ago
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    const result = runSubstratePruning(STATE);
    assert.equal(result.scaffold_reclassified, 1);
    assert.equal(dtu.classification, "scaffold");
    assert.equal(dtu._previousClassification, "knowledge");
    assert.ok(dtu._prunedAt);
  });

  it("does NOT reclassify cited DTUs", () => {
    const oldDate = new Date(Date.now() - 65 * 86400000).toISOString();
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);
    recordCitation(STATE, dtu.id);

    const result = runSubstratePruning(STATE);
    assert.equal(result.scaffold_reclassified, 0);
    assert.equal(dtu.classification, "knowledge");
  });

  it("does NOT reclassify seed DTUs", () => {
    const oldDate = new Date(Date.now() - 65 * 86400000).toISOString();
    const dtu = makeDTU({ classification: "seed", source: "seed", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    const result = runSubstratePruning(STATE);
    assert.equal(result.scaffold_reclassified, 0);
    assert.equal(dtu.classification, "seed");
  });

  it("deprecates DTUs with strongly negative helpfulness", () => {
    const oldDate = new Date(Date.now() - 65 * 86400000).toISOString();
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    // Record negative helpfulness
    const store = getLearningStore(STATE);
    store.helpfulness.set(dtu.id, { times_used: 10, positive_signals: 1, negative_signals: 5, score: 0.17 });
    // Also need a citation so it doesn't get scaffold'd before deprecation check
    recordCitation(STATE, dtu.id);

    const result = runSubstratePruning(STATE);
    assert.equal(result.deprecated_reclassified, 1);
    assert.equal(dtu.classification, "deprecated");
  });

  it("archives old repair DTUs", () => {
    const oldDate = new Date(Date.now() - 95 * 86400000).toISOString(); // 95 days ago
    const dtu = makeDTU({ classification: "repair", source: "repair_cortex", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    const result = runSubstratePruning(STATE);
    assert.equal(result.repair_archived, 1);
    assert.equal(dtu.classification, "deprecated");
    assert.equal(dtu._previousClassification, "repair");
  });

  it("keeps repair history", () => {
    runSubstratePruning(STATE);
    runSubstratePruning(STATE);

    const store = getLearningStore(STATE);
    assert.equal(store.pruning.history.length, 2);
    assert.ok(store.pruning.last_run);
  });

  it("never deletes — only reclassifies", () => {
    const oldDate = new Date(Date.now() - 65 * 86400000).toISOString();
    const dtu = makeDTU({ classification: "knowledge", createdAt: oldDate });
    STATE.dtus.set(dtu.id, dtu);

    runSubstratePruning(STATE);
    assert.ok(STATE.dtus.has(dtu.id)); // DTU still exists
    assert.equal(dtu.classification, "scaffold"); // Just reclassified
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DEDUP AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Dedup Audit", () => {
  let STATE;
  beforeEach(() => { STATE = freshState(); });

  it("runs dedup audit on recent DTUs", () => {
    const now = new Date().toISOString();
    STATE.dtus.set("a", makeDTU({
      id: "a", title: "Quantum computing fundamentals", classification: "knowledge",
      human: { summary: "Quantum bits, gates, and entanglement principles" }, createdAt: now,
    }));
    STATE.dtus.set("b", makeDTU({
      id: "b", title: "Machine learning basics", classification: "knowledge",
      human: { summary: "Neural networks, gradient descent, and backpropagation" }, createdAt: now,
    }));

    const result = runDedupAudit(STATE, 24);
    assert.equal(result.checked, 2);
    assert.ok(typeof result.novelty_rate === "number");
    assert.ok(result.run_at);
  });

  it("detects redundant DTUs", () => {
    const now = new Date().toISOString();
    STATE.dtus.set("a", makeDTU({
      id: "a", title: "Introduction to machine learning algorithms",
      human: { summary: "Covers supervised and unsupervised learning algorithms" },
      classification: "knowledge", createdAt: now,
    }));
    STATE.dtus.set("b", makeDTU({
      id: "b", title: "Introduction to machine learning algorithms",
      human: { summary: "Covers supervised and unsupervised learning algorithms" },
      classification: "knowledge", createdAt: now,
    }));

    const result = runDedupAudit(STATE, 24);
    assert.ok(result.redundant > 0);
  });

  it("keeps audit history", () => {
    runDedupAudit(STATE, 24);
    runDedupAudit(STATE, 24);

    const store = getLearningStore(STATE);
    assert.equal(store.dedup.history.length, 2);
    assert.ok(store.dedup.last_run);
    assert.ok(store.dedup.last_result);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. LEARNING DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

describe("Learning Dashboard", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshState();
    addDTUs(STATE, 10, { classification: "knowledge" });
  });

  it("returns all five numbers", () => {
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "llm_required");
    recordGeneration(STATE, "novel");
    recordCitation(STATE, "dtu_0");

    const dashboard = getLearningDashboard(STATE);
    assert.ok(dashboard.retrieval_hit_rate);
    assert.ok(typeof dashboard.retrieval_hit_rate.last_24h === "number");
    assert.ok(typeof dashboard.novelty_rate === "number");
    assert.ok(typeof dashboard.utilization_rate === "number");
    assert.ok(dashboard.novelty_details);
    assert.ok(dashboard.utilization_details);
  });

  it("retrieval hit rate reflects query methods", () => {
    // 3 cache hits, 1 LLM = 75% hit rate
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "semantic_cache");
    recordQueryMethod(STATE, "llm_required");

    const dashboard = getLearningDashboard(STATE);
    assert.equal(dashboard.retrieval_hit_rate.last_24h, 0.75);
  });

  it("novelty rate reflects generation verdicts", () => {
    recordGeneration(STATE, "novel");
    recordGeneration(STATE, "novel");
    recordGeneration(STATE, "redundant");
    recordGeneration(STATE, "redundant");

    const dashboard = getLearningDashboard(STATE);
    assert.equal(dashboard.novelty_rate, 0.5);
  });

  it("utilization rate reflects citations", () => {
    recordCitation(STATE, "dtu_0");
    recordCitation(STATE, "dtu_1");
    recordCitation(STATE, "dtu_2");
    recordCitation(STATE, "dtu_3");
    recordCitation(STATE, "dtu_4");

    const dashboard = getLearningDashboard(STATE);
    assert.equal(dashboard.utilization_rate, 0.5); // 5/10
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. LEARNING STORE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Learning Store", () => {
  it("initializes with proper structure", () => {
    const STATE = freshState();
    const store = getLearningStore(STATE);

    assert.ok(store.retrieval);
    assert.ok(store.retrieval.buckets);
    assert.ok(store.citations instanceof Map);
    assert.ok(store.novelty);
    assert.ok(store.helpfulness instanceof Map);
    assert.ok(store.generation);
    assert.ok(store.dedup);
    assert.ok(store.pruning);
  });

  it("reuses existing store", () => {
    const STATE = freshState();
    const store1 = getLearningStore(STATE);
    const store2 = getLearningStore(STATE);
    assert.equal(store1, store2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. CONSTANTS VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Constants", () => {
  it("DEFAULT_QUOTAS has correct structure", () => {
    assert.equal(DEFAULT_QUOTAS.max_autogen_per_hour, 20);
    assert.equal(DEFAULT_QUOTAS.max_autogen_per_day, 200);
    assert.ok(DEFAULT_QUOTAS.novelty_throttle);
    assert.equal(DEFAULT_QUOTAS.novelty_throttle.threshold_low, 0.30);
    assert.equal(DEFAULT_QUOTAS.novelty_throttle.threshold_mid, 0.40);
    assert.equal(DEFAULT_QUOTAS.novelty_throttle.threshold_high, 0.70);
    assert.equal(DEFAULT_QUOTAS.evolution_ratio, 0.3);
    assert.equal(DEFAULT_QUOTAS.min_evolution_ratio, 0.2);
  });

  it("dedup threshold is 0.85", () => {
    assert.equal(DEDUP_SIMILARITY_THRESHOLD, 0.85);
  });

  it("probation period is 7 days", () => {
    assert.equal(PROBATION_DAYS, 7);
  });

  it("prune zero citation days is 60", () => {
    assert.equal(PRUNE_ZERO_CITATION_DAYS, 60);
  });

  it("repair archive days is 90", () => {
    assert.equal(REPAIR_ARCHIVE_DAYS, 90);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. CRITICAL CONSTRAINTS (Spec Requirements)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Critical Constraints", () => {
  it("never delete DTUs — pruning only reclassifies", () => {
    const STATE = freshState();
    const oldDate = new Date(Date.now() - 365 * 86400000).toISOString();
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`old_${i}`, makeDTU({ id: `old_${i}`, classification: "knowledge", createdAt: oldDate }));
    }

    const initialSize = STATE.dtus.size;
    runSubstratePruning(STATE);
    assert.equal(STATE.dtus.size, initialSize); // No DTUs deleted
  });

  it("public count is sacred — only knowledge+seed+mega+hyper", () => {
    const dtus = new Map();
    dtus.set("k", { classification: "knowledge" });
    dtus.set("s", { classification: "seed" });
    dtus.set("m", { classification: "mega" });
    dtus.set("h", { classification: "hyper" });
    dtus.set("sh", { classification: "shadow" });
    dtus.set("r", { classification: "repair" });
    dtus.set("sc", { classification: "scaffold" });
    dtus.set("d", { classification: "deprecated" });

    const stats = computeSubstrateStats(dtus);
    // Public count = 4 (knowledge + seed + mega + hyper)
    assert.equal(stats.substrate.knowledge.total, 4);
    // Internal = 4 (shadow + repair + scaffold + deprecated)
    const internal = stats.substrate.internal;
    assert.equal(internal.shadow + internal.repair + internal.scaffold + internal.deprecated, 4);
  });

  it("repair DTUs never count as knowledge", () => {
    assert.ok(!isPublicDTU({ classification: "repair" }));
    assert.equal(classifyDTU({ source: "repair_cortex" }), "repair");
    assert.equal(classifyDTU({ tags: ["repair_cortex"] }), "repair");
  });

  it("shadow DTUs never count as knowledge", () => {
    assert.ok(!isPublicDTU({ classification: "shadow" }));
    assert.equal(classifyDTU({ tier: "shadow" }), "shadow");
  });

  it("novelty < 0.30 triggers throttle", () => {
    const STATE = freshState();
    // Record mostly redundant to get novelty < 0.30
    for (let i = 0; i < 9; i++) recordGeneration(STATE, "redundant");
    recordGeneration(STATE, "novel"); // 1/10 = 0.1

    const quota = checkGenerationQuota(STATE);
    // With 0.1 novelty rate (below threshold_low=0.30), hourly limit should be 25% of 20 = 5
    assert.equal(quota.hourly.limit, 5);
  });

  it("substrate earns its count — scaffold is not public", () => {
    assert.ok(!isPublicDTU({ classification: "scaffold" }));
    assert.ok(!PUBLIC_CLASSIFICATIONS.includes("scaffold"));
  });

  it("probation defaults to 7 days", () => {
    const STATE = freshState();
    const newDTU = makeDTU({ classification: "knowledge" });
    const result = checkProbation(STATE, newDTU);
    assert.equal(result.status, "probation");
    assert.ok(result.reason.includes("7d"));
  });
});
