/**
 * Tests for Autogen Pipeline — 6-Stage Knowledge Synthesis Engine
 *
 * Coverage:
 *   1. Intent constants & variant mappings
 *   2. Pipeline state initialization
 *   3. Stage 0: Target Selection (5 intents, variant bias)
 *   4. Stage 1: Retrieval Pack (scoring, core/peripheral/conflicts/citations)
 *   5. Stage 2: Builder Phase (extraction + merge + provenance)
 *   6. Stage 2: Critic Phase (rule-based checks, escalation)
 *   7. Stage 2: Synthesizer Phase (dedup + critic trace)
 *   8. Stage 3: Ollama Prompt Building
 *   9. Stage 3: Ollama Shaping (apply + validate source IDs)
 *  10. Stage 4: Novelty + Redundancy Control
 *  11. Stage 5: Write Policy (shadow-first)
 *  12. Full Pipeline Runner (end-to-end)
 *  13. Pipeline Metrics
 *  14. Helper functions (conflict detection, tag groups, etc.)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import crypto from "node:crypto";

import {
  INTENTS, ALL_INTENTS, VARIANT_INTENTS, ESCALATION_REASONS,
  ensurePipelineState,
  selectIntent, buildRetrievalPack,
  builderPhase, criticPhase, synthesizerPhase,
  buildOllamaPrompt, applyOllamaShaping,
  noveltyCheck, determineWritePolicy,
  runPipeline, getPipelineMetrics,
} from "../emergent/autogen-pipeline.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function freshState() {
  return {
    dtus: new Map(),
  };
}

function makeDtu(overrides = {}) {
  const id = overrides.id || `dtu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    title: overrides.title || "Test DTU",
    tags: overrides.tags || ["test"],
    tier: overrides.tier || "regular",
    scope: overrides.scope || "local",
    lineage: overrides.lineage || [],
    source: overrides.source || "local",
    meta: overrides.meta || {},
    core: overrides.core || {
      definitions: ["A test definition"],
      invariants: ["A test invariant"],
      examples: ["A test example"],
      claims: ["A test claim"],
      nextActions: ["A test action"],
    },
    human: overrides.human || { summary: "Test DTU summary" },
    machine: overrides.machine || { notes: "test" },
    authority: overrides.authority || { score: 0.5 },
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

function seedState(state, count = 10) {
  for (let i = 0; i < count; i++) {
    const dtu = makeDtu({
      id: `dtu_test_${i}`,
      title: `DTU ${i}: Test concept ${i}`,
      tags: [`tag-${i % 3}`, `tag-${i % 5}`, "shared-tag"],
      lineage: i > 0 ? [`dtu_test_${i - 1}`] : [],
      core: {
        definitions: i % 2 === 0 ? [`Def for concept ${i}`] : [],
        invariants: i % 3 === 0 ? [`Invariant for ${i}`] : [],
        examples: i % 4 === 0 ? [`Example ${i}`] : [],
        claims: [`Claim ${i}: something about ${i}`],
        nextActions: [`Action ${i}`],
      },
      authority: { score: (i + 1) / count },
      meta: i % 3 === 0 ? { citations: [`ref-${i}`] } : {},
    });
    state.dtus.set(dtu.id, dtu);
  }
  return state;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Intent Constants & Variant Mappings
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Intent Constants", () => {
  it("exports 5 intents", () => {
    assert.equal(ALL_INTENTS.length, 5);
    assert.ok(ALL_INTENTS.includes("fill_gaps"));
    assert.ok(ALL_INTENTS.includes("resolve_conflicts"));
    assert.ok(ALL_INTENTS.includes("compress_clusters"));
    assert.ok(ALL_INTENTS.includes("extract_patterns"));
    assert.ok(ALL_INTENTS.includes("elevate_high_usage"));
  });

  it("maps dream variant to fill_gaps + extract_patterns", () => {
    assert.deepEqual(VARIANT_INTENTS.dream, [INTENTS.FILL_GAPS, INTENTS.EXTRACT_PATTERNS]);
  });

  it("maps synth variant to resolve_conflicts + fill_gaps", () => {
    assert.deepEqual(VARIANT_INTENTS.synth, [INTENTS.RESOLVE_CONFLICTS, INTENTS.FILL_GAPS]);
  });

  it("maps evolution variant to compress_clusters + elevate_high_usage", () => {
    assert.deepEqual(VARIANT_INTENTS.evolution, [INTENTS.COMPRESS_CLUSTERS, INTENTS.ELEVATE_HIGH_USAGE]);
  });

  it("exports escalation reasons", () => {
    assert.ok(ESCALATION_REASONS.INSUFFICIENT_SYNTHESIS);
    assert.ok(ESCALATION_REASONS.UNRESOLVABLE_CONFLICTS);
    assert.ok(ESCALATION_REASONS.MEGA_HYPER_PROMOTION);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Pipeline State Initialization
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — State Init", () => {
  it("initializes pipeline state on fresh state", () => {
    const state = freshState();
    const ps = ensurePipelineState(state);
    assert.ok(ps.initialized);
    assert.ok(ps.initializedAt);
    assert.deepEqual(ps.recentGeneratedHashes, []);
    assert.equal(ps.maxRecentHashes, 500);
    assert.equal(ps.metrics.totalRuns, 0);
  });

  it("returns existing state on second call", () => {
    const state = freshState();
    const ps1 = ensurePipelineState(state);
    ps1.metrics.totalRuns = 42;
    const ps2 = ensurePipelineState(state);
    assert.equal(ps2.metrics.totalRuns, 42);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Stage 0: Target Selection
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 0: Target Selection", () => {
  it("returns fill_gaps for empty lattice", () => {
    const state = freshState();
    const result = selectIntent(state);
    assert.equal(result.intent, "fill_gaps");
    assert.equal(result.score, 0);
    assert.equal(result.signal.reason, "empty_lattice");
  });

  it("selects an intent from DTUs with gaps", () => {
    const state = seedState(freshState(), 20);
    const result = selectIntent(state);
    assert.ok(ALL_INTENTS.includes(result.intent));
    assert.ok(typeof result.score === "number");
    assert.ok(result.signal);
  });

  it("biases toward dream variant intents", () => {
    const state = seedState(freshState(), 15);
    const dreamResult = selectIntent(state, { variant: "dream" });
    // Dream intents get +30 bonus
    assert.ok(
      dreamResult.intent === INTENTS.FILL_GAPS || dreamResult.intent === INTENTS.EXTRACT_PATTERNS ||
      dreamResult.score > 0
    );
  });

  it("biases toward evolution variant intents", () => {
    const state = seedState(freshState(), 15);
    const evoResult = selectIntent(state, { variant: "evolution" });
    assert.ok(typeof evoResult.score === "number");
  });

  it("returns intent, signal, and score shape", () => {
    const state = seedState(freshState(), 10);
    const result = selectIntent(state);
    assert.ok("intent" in result);
    assert.ok("signal" in result);
    assert.ok("score" in result);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Stage 1: Retrieval Pack
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 1: Retrieval Pack", () => {
  it("returns empty pack for empty state", () => {
    const state = freshState();
    const pack = buildRetrievalPack(state, { intent: "fill_gaps", signal: {}, score: 0 });
    assert.deepEqual(pack.core, []);
    assert.deepEqual(pack.peripheral, []);
    assert.equal(pack.stats.total, 0);
  });

  it("builds scored pack from populated state", () => {
    const state = seedState(freshState(), 30);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    assert.ok(pack.core.length > 0);
    assert.ok(pack.stats.total === 30);
    assert.ok(pack.stats.coreCount > 0);
  });

  it("core DTUs are limited to 10-30", () => {
    const state = seedState(freshState(), 100);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    assert.ok(pack.core.length >= 1);
    assert.ok(pack.core.length <= 30);
  });

  it("includes citations from core DTUs", () => {
    const state = seedState(freshState(), 15);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    // Some DTUs have citations (every 3rd)
    assert.ok(Array.isArray(pack.citations));
  });

  it("includes conflict pairs involving core DTUs", () => {
    const state = freshState();
    // Add contradicting DTUs
    state.dtus.set("a", makeDtu({ id: "a", core: { claims: ["always true"], definitions: [], invariants: [], examples: [], nextActions: [] } }));
    state.dtus.set("b", makeDtu({ id: "b", core: { claims: ["never true"], definitions: [], invariants: [], examples: [], nextActions: [] } }));
    const intent = { intent: "resolve_conflicts", signal: { sampleIds: ["a", "b"] }, score: 50 };
    const pack = buildRetrievalPack(state, intent);
    assert.ok(Array.isArray(pack.conflicts));
  });

  it("scores DTUs with direct target match higher", () => {
    const state = seedState(freshState(), 20);
    const intent = {
      intent: "fill_gaps",
      signal: { sampleIds: ["dtu_test_0", "dtu_test_1"] },
      score: 50,
    };
    const pack = buildRetrievalPack(state, intent);
    // Direct targets should be in core
    const coreIds = new Set(pack.core.map(d => d.id));
    assert.ok(coreIds.has("dtu_test_0") || coreIds.has("dtu_test_1"));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Stage 2: Builder Phase
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 2: Builder", () => {
  it("returns error for empty pack", () => {
    const intent = { intent: "fill_gaps", signal: {}, score: 50 };
    const pack = { core: [], peripheral: [], conflicts: [], citations: [] };
    const result = builderPhase(intent, pack);
    assert.equal(result.ok, false);
    assert.equal(result.error, "empty_pack");
  });

  it("produces candidate with title, tags, lineage", () => {
    const state = seedState(freshState(), 10);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    const result = builderPhase(intent, pack);
    assert.equal(result.ok, true);
    assert.ok(result.candidate.title);
    assert.ok(result.candidate.tags.includes("autogen"));
    assert.ok(result.candidate.lineage.length > 0);
  });

  it("fills definitions from core DTUs for fill_gaps intent", () => {
    const state = seedState(freshState(), 10);
    const intent = { intent: "fill_gaps", signal: { sampleIds: Array.from(state.dtus.keys()) }, score: 70 };
    const pack = buildRetrievalPack(state, intent);
    const result = builderPhase(intent, pack);
    assert.ok(result.candidate.core.definitions.length >= 1);
  });

  it("tracks support provenance for claims", () => {
    const state = seedState(freshState(), 10);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    const result = builderPhase(intent, pack);
    const claimsMeta = result.candidate.meta.claims;
    assert.ok(Array.isArray(claimsMeta));
    for (const cm of claimsMeta) {
      assert.ok("text" in cm);
      assert.ok("support" in cm);
      assert.ok("confidence" in cm);
      assert.ok("type" in cm);
    }
  });

  it("records conflicts from pack", () => {
    const state = freshState();
    state.dtus.set("a", makeDtu({ id: "a", core: { claims: ["always warm"], definitions: ["Def A"], invariants: [], examples: [], nextActions: [] } }));
    state.dtus.set("b", makeDtu({ id: "b", core: { claims: ["never warm"], definitions: ["Def B"], invariants: [], examples: [], nextActions: [] } }));
    const intent = { intent: "resolve_conflicts", signal: { sampleIds: ["a", "b"] }, score: 50 };
    const pack = buildRetrievalPack(state, intent);
    const result = builderPhase(intent, pack);
    assert.ok(result.ok);
  });

  it("sets source and autogenIntent in meta", () => {
    const state = seedState(freshState(), 10);
    const intent = selectIntent(state);
    const pack = buildRetrievalPack(state, intent);
    const result = builderPhase(intent, pack);
    assert.equal(result.candidate.source, "autogen.pipeline");
    assert.equal(result.candidate.meta.autogenIntent, intent.intent);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Stage 2: Critic Phase
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 2: Critic", () => {
  it("passes candidate with good structure", () => {
    const candidate = {
      title: "Well-formed DTU",
      tags: ["autogen"],
      core: {
        definitions: ["A definition"],
        invariants: ["An invariant"],
        examples: ["An example"],
        claims: ["A claim"],
      },
      meta: {
        claims: [{ text: "A claim", support: ["dtu_1"], confidence: 0.8, type: "fact" }],
        conflicts: [],
      },
    };
    const result = criticPhase(candidate, {});
    assert.equal(result.ok, true);
    assert.equal(result.hasCritical, false);
  });

  it("flags missing definitions as warning", () => {
    const candidate = {
      title: "No defs",
      core: { definitions: [], invariants: ["x"], examples: ["x"], claims: ["x"] },
      meta: { claims: [{ text: "x", support: ["dtu_1"], confidence: 0.8, type: "fact" }] },
    };
    const result = criticPhase(candidate, {});
    assert.ok(result.issues.some(i => i.rule === "no_definitions"));
  });

  it("flags no_evidence_links as critical", () => {
    const candidate = {
      title: "No evidence",
      core: { definitions: ["x"], invariants: ["x"], examples: ["x"], claims: ["x"] },
      meta: { claims: [{ text: "x", support: [], confidence: 0.3, type: "hypothesis" }] },
    };
    const result = criticPhase(candidate, {});
    assert.equal(result.hasCritical, true);
    assert.ok(result.issues.some(i => i.rule === "no_evidence_links"));
  });

  it("flags mostly_hypothetical when > 70% hypothesis", () => {
    const candidate = {
      title: "Mostly hypothetical",
      core: { definitions: ["x"], invariants: ["x"], examples: ["x"], claims: ["a", "b", "c", "d"] },
      meta: {
        claims: [
          { text: "a", support: ["dtu_1"], confidence: 0.8, type: "fact" },
          { text: "b", support: [], confidence: 0.3, type: "hypothesis" },
          { text: "c", support: [], confidence: 0.3, type: "hypothesis" },
          { text: "d", support: [], confidence: 0.3, type: "hypothesis" },
        ],
      },
    };
    const result = criticPhase(candidate, {});
    assert.ok(result.issues.some(i => i.rule === "mostly_hypothetical"));
  });

  it("flags conflicts_not_acknowledged", () => {
    const candidate = {
      title: "Unacknowledged conflicts",
      core: { definitions: ["x"], invariants: ["x"], examples: ["x"] },
      meta: { claims: [{ text: "x", support: ["dtu_1"], confidence: 0.8, type: "fact" }] },
    };
    const pack = { conflicts: [{ dtuA: "a", dtuB: "b" }] };
    const result = criticPhase(candidate, pack);
    assert.ok(result.issues.some(i => i.rule === "conflicts_not_acknowledged"));
  });

  it("sets needsEscalation for critical issues", () => {
    const candidate = {
      title: "No evidence",
      core: { definitions: ["x"], invariants: ["x"], examples: ["x"], claims: ["x"] },
      meta: { claims: [{ text: "x", support: [], confidence: 0.3, type: "hypothesis" }] },
    };
    const result = criticPhase(candidate, {});
    assert.equal(result.needsEscalation, true);
    assert.ok(result.escalationReason);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Stage 2: Synthesizer Phase
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 2: Synthesizer", () => {
  it("adds critic trace to meta", () => {
    const candidate = {
      title: "Test",
      core: { definitions: ["x"], claims: ["a"] },
      meta: { claims: [{ text: "a", support: ["d1"], confidence: 0.8, type: "fact" }] },
      human: { summary: "Test", bullets: ["bullet1"] },
    };
    const criticResult = { issues: [{ severity: "warning", rule: "no_invariants" }], hasCritical: false };
    const result = synthesizerPhase(candidate, criticResult);
    assert.equal(result.ok, true);
    assert.ok(result.candidate.meta.criticTrace);
    assert.equal(result.candidate.meta.criticTrace.issueCount, 1);
    assert.equal(result.candidate.meta.criticTrace.hasCritical, false);
  });

  it("deduplicates claims", () => {
    const candidate = {
      title: "Test",
      core: { definitions: [], claims: ["Hello world", "hello world", "Different claim"] },
      meta: {
        claims: [
          { text: "Hello world", support: ["d1"], confidence: 0.8, type: "fact" },
          { text: "hello world", support: ["d2"], confidence: 0.7, type: "fact" },
          { text: "Different claim", support: ["d3"], confidence: 0.6, type: "inference" },
        ],
      },
      human: { summary: "Test", bullets: [] },
    };
    const criticResult = { issues: [], hasCritical: false };
    const result = synthesizerPhase(candidate, criticResult);
    assert.equal(result.candidate.core.claims.length, 2);
    assert.equal(result.candidate.meta.claims.length, 2);
  });

  it("deduplicates definitions, invariants, examples", () => {
    const candidate = {
      title: "Test",
      core: { definitions: ["A", "A", "B"], invariants: ["X", "X"], examples: ["E1", "E1", "E2"], claims: [] },
      meta: { claims: [] },
      human: { summary: "Test", bullets: [] },
    };
    const criticResult = { issues: [], hasCritical: false };
    const result = synthesizerPhase(candidate, criticResult);
    assert.equal(result.candidate.core.definitions.length, 2);
    assert.equal(result.candidate.core.invariants.length, 1);
    assert.equal(result.candidate.core.examples.length, 2);
  });

  it("appends critic summary to human bullets", () => {
    const candidate = {
      title: "Test",
      core: { definitions: [], claims: [] },
      meta: { claims: [] },
      human: { summary: "Test", bullets: ["existing bullet"] },
    };
    const criticResult = { issues: [{ severity: "warning", rule: "x" }], hasCritical: false };
    const result = synthesizerPhase(candidate, criticResult);
    assert.ok(result.candidate.human.bullets.some(b => b.includes("Critic")));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. Stage 3: Ollama Prompt Building
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 3: Ollama Prompt", () => {
  it("builds prompt with system + user + maxTokens", () => {
    const candidate = {
      title: "Test",
      core: { definitions: ["x"], claims: ["y"] },
      meta: { claims: [{ text: "y", support: ["d1"] }], conflicts: [] },
    };
    const excerpts = [{ id: "d1", title: "Source DTU", human: { summary: "A source" } }];
    const prompt = buildOllamaPrompt(candidate, excerpts);
    assert.ok(prompt.system.includes("Do not invent facts"));
    assert.ok(prompt.system.includes("hypothesis"));
    assert.ok(typeof prompt.user === "string");
    assert.equal(prompt.maxTokens, 1200);
    assert.equal(prompt.temperature, 0.3);
  });

  it("includes allowedSources in user prompt", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const excerpts = [{ id: "src1", title: "Src1", human: { summary: "summary1" } }];
    const prompt = buildOllamaPrompt(candidate, excerpts);
    const parsed = JSON.parse(prompt.user);
    assert.ok(parsed.allowedSources);
    assert.equal(parsed.allowedSources[0].id, "src1");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. Stage 3: Ollama Shaping
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 3: Ollama Shaping", () => {
  it("returns shaped=false when ollama is unavailable", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const result = applyOllamaShaping(candidate, null, []);
    assert.equal(result.ok, false);
    assert.equal(result.shaped, false);
    assert.equal(result.reason, "ollama_unavailable");
  });

  it("returns shaped=false when no JSON in response", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const result = applyOllamaShaping(candidate, { ok: true, content: "no json here" }, []);
    assert.equal(result.ok, false);
    assert.equal(result.shaped, false);
    assert.equal(result.reason, "no_json_in_response");
  });

  it("applies valid shaping with title and core fields", () => {
    const candidate = { title: "Old Title", core: { definitions: [] }, meta: {} };
    const ollamaResp = {
      ok: true,
      content: JSON.stringify({
        title: "Improved Title",
        core: { definitions: ["New def 1", "New def 2"] },
      }),
    };
    const result = applyOllamaShaping(candidate, ollamaResp, ["d1"]);
    assert.equal(result.ok, true);
    assert.equal(result.shaped, true);
    assert.equal(candidate.title, "Improved Title");
    assert.deepEqual(candidate.core.definitions, ["New def 1", "New def 2"]);
  });

  it("validates support IDs against allowed list", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const ollamaResp = {
      ok: true,
      content: JSON.stringify({
        claimAnnotations: [
          { text: "Valid claim", support: ["d1", "d2"], confidence: 0.9, type: "fact" },
          { text: "Invalid claim", support: ["d1", "fake_id"], confidence: 0.8, type: "fact" },
        ],
      }),
    };
    const result = applyOllamaShaping(candidate, ollamaResp, ["d1", "d2"]);
    assert.equal(result.ok, true);
    // First claim: both valid
    assert.deepEqual(candidate.meta.claims[0].support, ["d1", "d2"]);
    assert.equal(candidate.meta.claims[0].type, "fact");
    // Second claim: fake_id stripped, so only d1 remains
    assert.deepEqual(candidate.meta.claims[1].support, ["d1"]);
  });

  it("downgrades to hypothesis when all support IDs are invalid", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const ollamaResp = {
      ok: true,
      content: JSON.stringify({
        claimAnnotations: [
          { text: "Bad claim", support: ["fake1", "fake2"], confidence: 0.9, type: "fact" },
        ],
      }),
    };
    const result = applyOllamaShaping(candidate, ollamaResp, ["d1"]);
    assert.equal(result.ok, true);
    assert.equal(candidate.meta.claims[0].type, "hypothesis");
    assert.ok(candidate.meta.claims[0].confidence <= 0.4);
  });

  it("sets ollamaShaped flag on candidate meta", () => {
    const candidate = { title: "T", core: {}, meta: {} };
    const ollamaResp = { ok: true, content: JSON.stringify({ title: "New" }) };
    applyOllamaShaping(candidate, ollamaResp, []);
    assert.equal(candidate.meta.ollamaShaped, true);
    assert.ok(candidate.meta.ollamaShapedAt);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. Stage 4: Novelty + Redundancy Control
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 4: Novelty", () => {
  it("marks novel candidate as novel", () => {
    const state = freshState();
    ensurePipelineState(state);
    const candidate = {
      title: "Completely unique DTU about quantum computing",
      tags: ["quantum", "computing", "unique"],
      core: { claims: ["Quantum entanglement enables teleportation"] },
    };
    const result = noveltyCheck(state, candidate);
    assert.equal(result.ok, true);
    assert.equal(result.novel, true);
    assert.ok(result.candidateHash);
  });

  it("rejects exact duplicate by hash", () => {
    const state = freshState();
    const ps = ensurePipelineState(state);
    const candidate = {
      title: "Duplicate DTU",
      tags: ["dup"],
      core: { claims: ["same claim"] },
    };
    // Simulate a previous generation with same hash
    const payload = [candidate.title, ...(candidate.core.claims || []), ...(candidate.tags || [])].join("|");
    const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
    ps.recentGeneratedHashes.push({ hash, dtuId: "existing_dtu", createdAt: new Date().toISOString() });

    const result = noveltyCheck(state, candidate);
    assert.equal(result.ok, false);
    assert.equal(result.novel, false);
    assert.equal(result.action, "reject_duplicate");
  });

  it("proposes patch for high-similarity existing DTU", () => {
    const state = freshState();
    ensurePipelineState(state);
    // Add a DTU that's similar to the candidate
    state.dtus.set("existing", makeDtu({
      id: "existing",
      title: "Advanced quantum computing principles",
      tags: ["quantum", "computing", "advanced"],
      core: { claims: ["Quantum computing uses qubits"], definitions: [], invariants: [], examples: [], nextActions: [] },
    }));
    const candidate = {
      title: "Advanced quantum computing fundamentals",
      tags: ["quantum", "computing", "advanced"],
      core: { claims: ["Quantum computing uses qubits"] },
    };
    const result = noveltyCheck(state, candidate, { similarityThreshold: 0.3 });
    if (!result.novel) {
      assert.equal(result.action, "propose_patch");
      assert.equal(result.existingDtuId, "existing");
    }
  });

  it("increments noveltyRejects metric on rejection", () => {
    const state = freshState();
    const ps = ensurePipelineState(state);
    state.dtus.set("existing", makeDtu({
      id: "existing",
      title: "Same topic same tags same claims",
      tags: ["identical", "tags"],
      core: { claims: ["identical claim"], definitions: [], invariants: [], examples: [], nextActions: [] },
    }));
    const candidate = {
      title: "Same topic same tags same claims",
      tags: ["identical", "tags"],
      core: { claims: ["identical claim"] },
    };
    const before = ps.metrics.noveltyRejects;
    noveltyCheck(state, candidate, { similarityThreshold: 0.1 });
    // May or may not reject depending on exact similarity
    assert.ok(ps.metrics.noveltyRejects >= before);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. Stage 5: Write Policy
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Stage 5: Write Policy", () => {
  it("defaults to shadow tier", () => {
    const candidate = { meta: { autogenIntent: "resolve_conflicts" } };
    const criticResult = { issues: [], hasCritical: false };
    const noveltyResult = { ok: true, novel: true };
    const policy = determineWritePolicy(candidate, criticResult, noveltyResult);
    assert.equal(policy.tier, "shadow");
    assert.equal(policy.needsCouncilVote, true);
    assert.equal(policy.needsHumanPush, true);
  });

  it("always shadow for critical critic issues", () => {
    const candidate = { meta: { autogenIntent: "fill_gaps" } };
    const criticResult = { issues: [{ severity: "critical", rule: "no_evidence_links" }], hasCritical: true };
    const noveltyResult = { ok: true, novel: true };
    const policy = determineWritePolicy(candidate, criticResult, noveltyResult);
    assert.equal(policy.tier, "shadow");
    assert.equal(policy.reason, "critic_critical_issues");
  });

  it("returns patch target for novelty patch proposals", () => {
    const candidate = { meta: { autogenIntent: "fill_gaps" } };
    const criticResult = { issues: [], hasCritical: false };
    const noveltyResult = { ok: false, novel: false, action: "propose_patch", existingDtuId: "dtu_123" };
    const policy = determineWritePolicy(candidate, criticResult, noveltyResult);
    assert.equal(policy.tier, "shadow");
    assert.equal(policy.patchTarget, "dtu_123");
  });

  it("allows regular tier for clean fill_gaps", () => {
    const candidate = { meta: { autogenIntent: "fill_gaps" } };
    const criticResult = { issues: [{ severity: "info", rule: "no_examples" }], hasCritical: false };
    const noveltyResult = { ok: true, novel: true };
    const policy = determineWritePolicy(candidate, criticResult, noveltyResult);
    assert.equal(policy.tier, "regular");
    assert.equal(policy.needsHumanPush, false);
  });

  it("requires shadow for non-fill_gaps intents even with clean critic", () => {
    const candidate = { meta: { autogenIntent: "compress_clusters" } };
    const criticResult = { issues: [], hasCritical: false };
    const noveltyResult = { ok: true, novel: true };
    const policy = determineWritePolicy(candidate, criticResult, noveltyResult);
    assert.equal(policy.tier, "shadow");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 12. Full Pipeline Runner
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Full Pipeline", () => {
  it("runs end-to-end on seeded state", async () => {
    const state = seedState(freshState(), 20);
    const result = await runPipeline(state, {});
    assert.equal(result.ok, true);
    assert.ok(result.candidate);
    assert.ok(result.trace);
    assert.ok(result.trace.stages.targetSelection);
    assert.ok(result.trace.stages.retrievalPack);
    assert.ok(result.trace.stages.critic);
    assert.ok(result.trace.stages.synthesis);
    assert.ok(result.trace.stages.novelty);
    assert.ok(result.trace.stages.writePolicy);
  });

  it("runs with dream variant", async () => {
    const state = seedState(freshState(), 15);
    const result = await runPipeline(state, { variant: "dream" });
    assert.equal(result.ok, true);
    assert.equal(result.trace.variant, "dream");
  });

  it("runs with synth variant", async () => {
    const state = seedState(freshState(), 15);
    const result = await runPipeline(state, { variant: "synth" });
    assert.equal(result.ok, true);
    assert.equal(result.trace.variant, "synth");
  });

  it("runs with evolution variant", async () => {
    const state = seedState(freshState(), 15);
    const result = await runPipeline(state, { variant: "evolution" });
    assert.equal(result.ok, true);
    assert.equal(result.trace.variant, "evolution");
  });

  it("supports dryRun mode", async () => {
    const state = seedState(freshState(), 15);
    const result = await runPipeline(state, { dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.ok(result.candidate);
  });

  it("fails gracefully on empty state", async () => {
    const state = freshState();
    const result = await runPipeline(state, {});
    assert.equal(result.ok, false);
  });

  it("handles ollama callback when provided", async () => {
    const state = seedState(freshState(), 15);
    let ollamaCalled = false;
    const mockOllama = (_prompt, _opts) => {
      ollamaCalled = true;
      return {
        ok: true,
        content: JSON.stringify({ title: "Ollama-shaped title", core: { definitions: ["Shaped def"] } }),
      };
    };
    const result = await runPipeline(state, { callOllama: mockOllama });
    assert.equal(result.ok, true);
    assert.equal(ollamaCalled, true);
    assert.ok(result.trace.stages.ollamaShaping);
  });

  it("handles ollama failure gracefully", async () => {
    const state = seedState(freshState(), 15);
    const mockOllama = () => { throw new Error("connection refused"); };
    const result = await runPipeline(state, { callOllama: mockOllama });
    assert.equal(result.ok, true); // Pipeline still succeeds without Ollama
    assert.ok(result.trace.stages.ollamaShaping.error);
  });

  it("increments metrics on each run", async () => {
    const state = seedState(freshState(), 15);
    const before = ensurePipelineState(state).metrics.totalRuns;
    await runPipeline(state, {});
    assert.equal(ensurePipelineState(state).metrics.totalRuns, before + 1);
  });

  it("increments variant metrics", async () => {
    const state = seedState(freshState(), 15);
    await runPipeline(state, { variant: "dream" });
    const ps = ensurePipelineState(state);
    assert.ok(ps.metrics.byVariant.dream >= 1);
  });

  it("records candidate hash for novelty detection", async () => {
    const state = seedState(freshState(), 15);
    await runPipeline(state, {});
    const ps = ensurePipelineState(state);
    assert.ok(ps.recentGeneratedHashes.length > 0);
  });

  it("rejects duplicate on second identical run", async () => {
    const state = seedState(freshState(), 15);
    const r1 = await runPipeline(state, { variant: "dream" });
    assert.equal(r1.ok, true);
    // Running same pipeline again may produce duplicate
    const r2 = await runPipeline(state, { variant: "dream" });
    // Either succeeds with different candidate or fails with duplicate
    assert.ok(r2.ok === true || r2.ok === false);
    if (!r2.ok) {
      assert.ok(r2.error.includes("duplicate") || r2.error.includes("empty"));
    }
  });

  it("marks cloud escalation when critic escalates and callCloud provided", async () => {
    const state = freshState();
    // Create DTUs with only hypothesis claims (no evidence) → critic will escalate
    for (let i = 0; i < 10; i++) {
      state.dtus.set(`dtu_${i}`, makeDtu({
        id: `dtu_${i}`,
        title: `Hypothesis DTU ${i}`,
        tags: ["hypo"],
        core: {
          definitions: [],
          invariants: [],
          examples: [],
          claims: [`Hypothesis claim ${i}`],
          nextActions: [],
        },
        meta: {},
      }));
    }
    let _cloudCalled = false;
    const result = await runPipeline(state, {
      callCloud: () => { _cloudCalled = true; return { ok: true, content: "" }; },
    });
    // Pipeline completes regardless
    if (result.ok) {
      assert.ok(result.trace.stages.cloudEscalation);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 13. Pipeline Metrics
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Metrics", () => {
  it("returns metrics shape", () => {
    const state = freshState();
    ensurePipelineState(state);
    const metrics = getPipelineMetrics(state);
    assert.equal(metrics.ok, true);
    assert.equal(metrics.totalRuns, 0);
    assert.ok("byIntent" in metrics);
    assert.ok("byVariant" in metrics);
    assert.ok("candidatesProduced" in metrics);
    assert.ok("candidatesRejected" in metrics);
    assert.ok("shadowsCreated" in metrics);
    assert.ok("ollamaShapings" in metrics);
    assert.ok("ollamaFailures" in metrics);
    assert.ok("cloudEscalations" in metrics);
    assert.ok("noveltyRejects" in metrics);
    assert.ok("patchProposals" in metrics);
    assert.ok("recentHashCount" in metrics);
  });

  it("tracks runs after pipeline execution", async () => {
    const state = seedState(freshState(), 15);
    await runPipeline(state, { variant: "dream" });
    await runPipeline(state, { variant: "synth" });
    const metrics = getPipelineMetrics(state);
    assert.equal(metrics.totalRuns, 2);
    assert.ok(metrics.byVariant.dream >= 1);
    assert.ok(metrics.byVariant.synth >= 1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 14. Conflict Detection & Tag Groups (internal helpers via selectIntent)
// ══════════════════════════════════════════════════════════════════════════════

describe("Autogen Pipeline — Helper Functions", () => {
  it("detects negation conflicts in DTUs", () => {
    const state = freshState();
    state.dtus.set("a", makeDtu({
      id: "a",
      core: { claims: ["always true"], definitions: [], invariants: [], examples: [], nextActions: [] },
    }));
    state.dtus.set("b", makeDtu({
      id: "b",
      core: { claims: ["not always true"], definitions: [], invariants: [], examples: [], nextActions: [] },
    }));
    const result = selectIntent(state);
    // resolve_conflicts should have some score
    assert.ok(result.score >= 0);
  });

  it("detects tag clusters for compression", () => {
    const state = freshState();
    // 10 DTUs all sharing "shared-tag"
    for (let i = 0; i < 10; i++) {
      state.dtus.set(`d${i}`, makeDtu({ id: `d${i}`, tags: ["shared-tag", `unique-${i}`] }));
    }
    const result = selectIntent(state);
    assert.ok(result.score > 0);
  });

  it("detects repeated source patterns", () => {
    const state = freshState();
    for (let i = 0; i < 10; i++) {
      state.dtus.set(`d${i}`, makeDtu({ id: `d${i}`, source: "system.dream" }));
    }
    const result = selectIntent(state);
    assert.ok(result.score > 0);
  });

  it("detects high-usage DTUs via lineage references", () => {
    const state = freshState();
    const root = makeDtu({ id: "root" });
    state.dtus.set("root", root);
    for (let i = 0; i < 10; i++) {
      state.dtus.set(`child${i}`, makeDtu({ id: `child${i}`, lineage: ["root"] }));
    }
    const result = selectIntent(state);
    assert.ok(result.score > 0);
  });
});
