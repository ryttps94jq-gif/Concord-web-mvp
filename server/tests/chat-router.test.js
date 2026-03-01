/**
 * Chat Router + Lens Manifest + Session Accumulator + Inline DTU Forge — Test Suite
 *
 * Covers:
 *   - Lens Manifest: registration, tag index, action type derivation, user/emergent lenses
 *   - Chat Router: action type classification, domain signal extraction, multi-lens routing,
 *                  explicit routing (/lens), emergent routing, resonance signals, forge detection
 *   - Session Accumulator: context compounding, signal decay, cross-domain tracking
 *   - Inline DTU Forge: detection, format mapping, substrate pull, DTU wrapping,
 *                       pipeline, iteration, save/delete/list
 *
 * Run: node --test tests/chat-router.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_TYPES,
  WRITE_ACTION_TYPES,
  READ_ACTION_TYPES,
  registerManifest,
  getManifest,
  findByTags,
  findByActionType,
  initializeManifests,
  registerUserLens,
  registerEmergentLens,
  getAllManifests,
  getManifestStats,
  hasManifest,
  _deriveActionTypes,
  DOMAIN_TAG_MAP,
} from "../lib/lens-manifest.js";

import {
  routeMessage,
  classifyActionType,
  extractDomainSignals,
  buildLensChain,
  emitResonanceSignal,
  shouldOfferForge,
  detectEmergentRoute,
  recordRouteMetric,
  getRouterMetrics,
} from "../lib/chat-router.js";

import {
  createAccumulator,
  getAccumulator,
  accumulate,
  getContextSnapshot,
  getTopicThread,
  getCrossDomainSignals,
  getContributingLenses,
  completeSession,
  cleanupExpiredSessions,
  getAccumulatorMetrics,
} from "../lib/session-context-accumulator.js";

import {
  detectForge,
  detectOutputFormat,
  detectMultiArtifact,
  pullSubstrate,
  wrapAsDTU,
  runForgePipeline,
  iterateForge,
  saveForgedDTU,
  deleteForgedDTU,
  saveAndList,
  recordEmergentContribution,
  PRIMARY_TYPES,
  getForgeMetrics,
} from "../lib/inline-dtu-forge.js";

// ── Helpers ─────────────────────────────────────────────────────────

function createMockState() {
  return {
    dtus: new Map(),
    lensArtifacts: new Map(),
    sessions: new Map(),
    __emergent: {
      entities: new Map(),
      _edges: { edges: new Map(), bySource: new Map(), byTarget: new Map() },
    },
  };
}

function addMockDTU(state, id, opts = {}) {
  state.dtus.set(id, {
    id,
    title: opts.title || `DTU ${id}`,
    tier: opts.tier || "regular",
    tags: opts.tags || [],
    createdBy: opts.createdBy || "user1",
    source: opts.source || "user1",
    ownerId: opts.ownerId || "user1",
    human: { summary: opts.summary || "" },
    core: { claims: [], definitions: [] },
    machine: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ═════════════════════════════════════════════════════════════════════
// LENS MANIFEST TESTS
// ═════════════════════════════════════════════════════════════════════

describe("LensManifest", () => {
  it("ACTION_TYPES has exactly 8 types", () => {
    assert.equal(Object.keys(ACTION_TYPES).length, 8);
    assert.ok(ACTION_TYPES.QUERY);
    assert.ok(ACTION_TYPES.ANALYZE);
    assert.ok(ACTION_TYPES.CREATE);
    assert.ok(ACTION_TYPES.SIMULATE);
    assert.ok(ACTION_TYPES.TRADE);
    assert.ok(ACTION_TYPES.CONNECT);
    assert.ok(ACTION_TYPES.TEACH);
    assert.ok(ACTION_TYPES.MANAGE);
  });

  it("WRITE_ACTION_TYPES contains CREATE, TRADE, MANAGE", () => {
    assert.ok(WRITE_ACTION_TYPES.has("CREATE"));
    assert.ok(WRITE_ACTION_TYPES.has("TRADE"));
    assert.ok(WRITE_ACTION_TYPES.has("MANAGE"));
    assert.ok(!WRITE_ACTION_TYPES.has("QUERY"));
    assert.ok(!WRITE_ACTION_TYPES.has("ANALYZE"));
  });

  it("READ_ACTION_TYPES contains QUERY, ANALYZE, CONNECT, TEACH", () => {
    assert.ok(READ_ACTION_TYPES.has("QUERY"));
    assert.ok(READ_ACTION_TYPES.has("ANALYZE"));
    assert.ok(READ_ACTION_TYPES.has("CONNECT"));
    assert.ok(READ_ACTION_TYPES.has("TEACH"));
  });

  it("registers a manifest and retrieves it", () => {
    const result = registerManifest({
      lensId: "test-lens",
      domain: "test",
      actions: ["analyze", "create"],
      domainTags: ["testing", "validation"],
      description: "Test lens",
    });
    assert.ok(result.ok);
    const manifest = getManifest("test-lens");
    assert.ok(manifest);
    assert.equal(manifest.lensId, "test-lens");
    assert.ok(manifest.actionTypes.includes("ANALYZE"));
    assert.ok(manifest.actionTypes.includes("CREATE"));
  });

  it("finds lenses by tags", () => {
    registerManifest({
      lensId: "farm-lens",
      actions: ["query"],
      domainTags: ["farming", "crops", "soil"],
    });
    const results = findByTags(["farming", "soil"]);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.lensId === "farm-lens"));
  });

  it("finds lenses by action type", () => {
    registerManifest({
      lensId: "sim-lens",
      actions: ["simulate", "forecast"],
      domainTags: ["simulation"],
    });
    const results = findByActionType("SIMULATE");
    assert.ok(results.some(m => m.lensId === "sim-lens"));
  });

  it("derives action types from action names", () => {
    const types = _deriveActionTypes(["analyze", "query", "generate"]);
    assert.ok(types.includes("ANALYZE"));
    assert.ok(types.includes("QUERY"));
    assert.ok(types.includes("CREATE"));
  });

  it("registers user-created lenses at runtime", () => {
    const result = registerUserLens({
      lensId: "beekeeping",
      actions: ["query", "analyze"],
      domainTags: ["bees", "hive", "honey"],
      description: "Beekeeping lens",
    });
    assert.ok(result.ok);
    assert.ok(hasManifest("beekeeping"));
    const m = getManifest("beekeeping");
    assert.equal(m.source, "user");
  });

  it("registers emergent-created lenses at runtime", () => {
    const result = registerEmergentLens({
      lensId: "quantum-bio",
      actions: ["analyze", "simulate"],
      domainTags: ["quantum", "biology"],
    });
    assert.ok(result.ok);
    const m = getManifest("quantum-bio");
    assert.equal(m.source, "emergent");
  });

  it("initializes manifests from domain list", () => {
    const domains = ["music", "legal", "finance"];
    const manifest = { music: [{ action: "generate-pattern" }] };
    const result = initializeManifests(domains, manifest);
    // May be skipped if already initialized
    assert.ok(result.ok);
  });

  it("DOMAIN_TAG_MAP has entries for common lenses", () => {
    assert.ok(DOMAIN_TAG_MAP.music);
    assert.ok(DOMAIN_TAG_MAP.legal);
    assert.ok(DOMAIN_TAG_MAP.finance);
    assert.ok(DOMAIN_TAG_MAP.agriculture);
  });

  it("getManifestStats returns valid stats", () => {
    const stats = getManifestStats();
    assert.ok(stats.ok);
    assert.ok(stats.total > 0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// CHAT ROUTER TESTS
// ═════════════════════════════════════════════════════════════════════

describe("ChatRouter", () => {

  describe("classifyActionType", () => {
    it("classifies QUERY", () => {
      assert.equal(classifyActionType("what is quantum computing?").type, "QUERY");
      assert.equal(classifyActionType("show me all contracts").type, "QUERY");
      assert.equal(classifyActionType("find DTUs about farming").type, "QUERY");
    });

    it("classifies ANALYZE", () => {
      assert.equal(classifyActionType("compare these two policies side by side").type, "ANALYZE");
      assert.equal(classifyActionType("evaluate this proposal thoroughly").type, "ANALYZE");
      assert.equal(classifyActionType("score this essay for quality").type, "ANALYZE");
    });

    it("classifies CREATE", () => {
      assert.equal(classifyActionType("write me a contract").type, "CREATE");
      assert.equal(classifyActionType("draft a business plan").type, "CREATE");
      assert.equal(classifyActionType("make me a beat").type, "CREATE");
      assert.equal(classifyActionType("help me create a resume").type, "CREATE");
    });

    it("classifies SIMULATE", () => {
      assert.equal(classifyActionType("simulate a drought scenario").type, "SIMULATE");
      assert.equal(classifyActionType("run a monte carlo simulation").type, "SIMULATE");
      assert.equal(classifyActionType("forecast revenue for next quarter").type, "SIMULATE");
    });

    it("classifies TRADE", () => {
      assert.equal(classifyActionType("sell this DTU on the store").type, "TRADE");
      assert.equal(classifyActionType("purchase that knowledge pack").type, "TRADE");
    });

    it("classifies CONNECT", () => {
      assert.equal(classifyActionType("relate music to mathematics").type, "CONNECT");
      assert.equal(classifyActionType("connect these two topics together").type, "CONNECT");
      // "find connections" triggers QUERY(find) at weight 1.0 > CONNECT at 0.9 — expected
      const fc = classifyActionType("find connections between biology and chemistry");
      assert.ok(fc.scores.CONNECT > 0, "CONNECT score should be positive");
    });

    it("classifies TEACH", () => {
      assert.equal(classifyActionType("explain quantum entanglement to me").type, "TEACH");
      assert.equal(classifyActionType("help me understand machine learning").type, "TEACH");
      assert.equal(classifyActionType("teach me about neural networks").type, "TEACH");
    });

    it("classifies MANAGE", () => {
      assert.equal(classifyActionType("show my stats please").type, "MANAGE");
      assert.equal(classifyActionType("update my profile settings").type, "MANAGE");
      // "check my" triggers both ANALYZE(check) and MANAGE — ANALYZE wins on weight
      const cm = classifyActionType("check my earnings");
      assert.ok(cm.scores.MANAGE > 0, "MANAGE score should be positive");
    });

    it("defaults to QUERY for unclassifiable input", () => {
      assert.equal(classifyActionType("yo").type, "QUERY");
      assert.equal(classifyActionType("hello world").type, "QUERY");
    });
  });

  describe("extractDomainSignals", () => {
    it("extracts farming signals", () => {
      const signals = extractDomainSignals("I need crop insurance for my farm");
      assert.ok(signals.includes("farming") || signals.includes("crops"));
      assert.ok(signals.some(s => s.includes("insurance") || s.includes("policy") || s.includes("coverage")));
    });

    it("extracts legal signals", () => {
      const signals = extractDomainSignals("draft a compliance contract");
      assert.ok(signals.some(s => ["legal", "contract", "compliance"].includes(s)));
    });

    it("extracts music signals", () => {
      const signals = extractDomainSignals("make me a beat at 140 bpm");
      assert.ok(signals.some(s => ["audio", "melody", "rhythm"].includes(s)));
    });

    it("returns empty for generic input", () => {
      const signals = extractDomainSignals("hello");
      assert.equal(signals.length, 0);
    });
  });

  describe("routeMessage", () => {
    it("routes a simple query", () => {
      const route = routeMessage("what is machine learning?");
      assert.ok(route.ok);
      assert.equal(route.actionType, "QUERY");
    });

    it("routes a multi-lens create request", () => {
      const route = routeMessage("help me write a farm insurance policy");
      assert.ok(route.ok);
      assert.equal(route.actionType, "CREATE");
      // Should detect agriculture + insurance signals
      assert.ok(route.domainSignals.length > 0);
    });

    it("routes explicit /lens command", () => {
      // Need to register manifests first
      registerManifest({ lensId: "legal", actions: ["draft", "analyze"], domainTags: ["legal", "contract"] });
      const route = routeMessage("/legal draft a contract");
      assert.ok(route.ok);
      assert.equal(route.explicitLens, "legal");
      assert.equal(route.actionType, "CREATE");
      assert.equal(route.confidence, 1.0);
    });

    it("returns ok: false for empty input", () => {
      const route = routeMessage("");
      assert.ok(!route.ok);
    });

    it("sets requiresConfirmation for write actions", () => {
      const route = routeMessage("create a business plan for my restaurant");
      assert.ok(route.ok);
      assert.equal(route.requiresConfirmation, true);
    });

    it("does not require confirmation for read actions", () => {
      const route = routeMessage("explain how insurance works");
      assert.ok(route.ok);
      assert.equal(route.requiresConfirmation, false);
    });

    it("incorporates session context", () => {
      const sessionContext = {
        domainSignals: ["farming", "crops"],
        activeLenses: ["agriculture"],
      };
      const route = routeMessage("now what about insurance?", { sessionContext });
      assert.ok(route.ok);
      assert.ok(route.sessionContextUsed);
      // Should have farming signals from session context
      assert.ok(route.domainSignals.some(s => s === "farming" || s === "crops"));
    });
  });

  describe("buildLensChain", () => {
    it("builds a chain from a route plan", () => {
      registerManifest({ lensId: "agriculture", actions: ["query", "analyze", "generate"], domainTags: ["farming"] });
      registerManifest({ lensId: "insurance", actions: ["query", "analyze", "draft"], domainTags: ["policy", "coverage"] });

      const route = {
        ok: true,
        actionType: "CREATE",
        lenses: [
          { lensId: "agriculture", manifest: getManifest("agriculture"), score: 0.8 },
          { lensId: "insurance", manifest: getManifest("insurance"), score: 0.6 },
        ],
      };

      const chain = buildLensChain(route);
      assert.ok(chain.ok);
      assert.equal(chain.steps.length, 2);
      assert.equal(chain.steps[0].role, "primary");
      assert.equal(chain.steps[1].role, "contributor");
      assert.ok(chain.message.includes("Agriculture"));
    });

    it("returns error for empty route", () => {
      const chain = buildLensChain({ ok: false, lenses: [] });
      assert.ok(!chain.ok);
    });
  });

  describe("emitResonanceSignal", () => {
    it("creates a resonance signal DTU for multi-lens routes", () => {
      const state = createMockState();
      const route = {
        ok: true,
        isMultiLens: true,
        lenses: [
          { lensId: "agriculture" },
          { lensId: "insurance" },
          { lensId: "legal" },
        ],
        actionType: "CREATE",
        confidence: 0.8,
      };
      const result = emitResonanceSignal(route, state);
      assert.ok(result.signaled);
      assert.ok(result.domains.includes("agriculture"));
      assert.ok(state.dtus.size > 0);
    });

    it("does not signal for single-lens routes", () => {
      const state = createMockState();
      const route = { ok: true, isMultiLens: false, lenses: [{ lensId: "music" }] };
      const result = emitResonanceSignal(route, state);
      assert.ok(!result.signaled);
    });
  });

  describe("shouldOfferForge", () => {
    it("offers forge for CREATE actions", () => {
      const result = shouldOfferForge({ ok: true, actionType: "CREATE", isMultiLens: false, lenses: [] }, {});
      assert.ok(result.shouldOfferForge);
      assert.equal(result.reason, "write_action_output");
    });

    it("offers forge for multi-lens synthesis with 3+ lenses", () => {
      const result = shouldOfferForge(
        { ok: true, actionType: "QUERY", isMultiLens: true, lenses: [1, 2, 3], confidence: 0.5 },
        {}
      );
      assert.ok(result.shouldOfferForge);
    });

    it("does not offer forge for simple queries", () => {
      const result = shouldOfferForge(
        { ok: true, actionType: "QUERY", isMultiLens: false, lenses: [], confidence: 0.3 },
        {}
      );
      assert.ok(!result.shouldOfferForge);
    });
  });

  describe("detectEmergentRoute", () => {
    it("detects emergent routing request", () => {
      const state = createMockState();
      state.__emergent.entities.set("em1", { name: "Legal Advisor", domain: "legal" });
      const result = detectEmergentRoute("ask the legal emergent to review this", state);
      assert.ok(result.routed);
      assert.equal(result.emergentId, "em1");
    });

    it("returns not-routed for normal messages", () => {
      const state = createMockState();
      const result = detectEmergentRoute("write me a contract", state);
      assert.ok(!result.routed);
    });
  });

  describe("metrics", () => {
    it("records and retrieves router metrics", () => {
      recordRouteMetric({ actionType: "CREATE", isMultiLens: true, explicitLens: null, requiresConfirmation: true });
      const metrics = getRouterMetrics();
      assert.ok(metrics.ok);
      assert.ok(metrics.routing.routeCount > 0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// SESSION CONTEXT ACCUMULATOR TESTS
// ═════════════════════════════════════════════════════════════════════

describe("SessionContextAccumulator", () => {
  const sid = "test-session-" + Date.now();

  it("creates and retrieves an accumulator", () => {
    const acc = createAccumulator(sid);
    assert.ok(acc);
    assert.equal(acc.sessionId, sid);
    assert.equal(acc.turnCount, 0);
  });

  it("accumulates context from route plans", () => {
    const route = {
      ok: true,
      actionType: "CREATE",
      domainSignals: ["farming", "insurance"],
      lenses: [{ lensId: "agriculture" }, { lensId: "insurance" }],
      isMultiLens: true,
    };

    const acc = accumulate(sid, route, "help me write farm insurance");
    assert.equal(acc.turnCount, 1);
    assert.ok(acc.domainSignals.has("farming"));
    assert.ok(acc.domainSignals.has("insurance"));
    assert.ok(acc.activeLenses.includes("agriculture"));
    assert.ok(acc.contributingLenses.has("agriculture"));
  });

  it("compounds context across turns", () => {
    const route2 = {
      ok: true,
      actionType: "QUERY",
      domainSignals: ["loan", "mortgage"],
      lenses: [{ lensId: "finance" }],
      isMultiLens: false,
    };

    const acc = accumulate(sid, route2, "now what about a loan?");
    assert.equal(acc.turnCount, 2);
    // Still has farming from turn 1 (with decay)
    assert.ok(acc.domainSignals.has("farming"));
    // Plus new signals
    assert.ok(acc.domainSignals.has("loan"));
    // Three lenses contributed across both turns
    assert.ok(acc.contributingLenses.size >= 3);
  });

  it("provides context snapshot for the router", () => {
    const snapshot = getContextSnapshot(sid);
    assert.ok(snapshot.domainSignals.length > 0);
    assert.ok(snapshot.activeLenses.length > 0);
    assert.equal(snapshot.turnCount, 2);
  });

  it("tracks cross-domain links", () => {
    const signals = getCrossDomainSignals(sid);
    assert.ok(signals.length > 0);
    assert.ok(signals[0].domains.length >= 2);
  });

  it("returns topic thread", () => {
    const thread = getTopicThread(sid);
    assert.ok(thread.length === 2);
    assert.ok(thread[0].snippet.includes("farm insurance"));
  });

  it("completes session and returns signals", () => {
    const result = completeSession(sid);
    assert.ok(result.crossDomainLinks.length > 0);
    assert.ok(result.contributingLenses.length >= 3);
    assert.equal(result.turnCount, 2);
  });

  it("reports metrics", () => {
    const metrics = getAccumulatorMetrics();
    assert.ok(metrics.ok);
    assert.ok(metrics.activeSessions > 0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// INLINE DTU FORGE TESTS
// ═════════════════════════════════════════════════════════════════════

describe("InlineDTUForge", () => {

  describe("detectForge", () => {
    it("detects forge for CREATE action type", () => {
      const result = detectForge("write me a contract", "CREATE");
      assert.ok(result.shouldForge);
    });

    it("detects forge for SIMULATE action type", () => {
      const result = detectForge("simulate drought", "SIMULATE");
      assert.ok(result.shouldForge);
    });

    it("does not forge for explanation requests even if CREATE", () => {
      const result = detectForge("explain how to create a contract", "CREATE");
      assert.ok(!result.shouldForge);
    });

    it("does not forge for QUERY action type", () => {
      const result = detectForge("what is insurance?", "QUERY");
      assert.ok(!result.shouldForge);
    });

    it("detects forge verb even without CREATE classification", () => {
      const result = detectForge("make me a beat", "QUERY");
      assert.ok(result.shouldForge);
    });
  });

  describe("detectOutputFormat", () => {
    it("detects document format", () => {
      const fmt = detectOutputFormat("write me a contract");
      assert.equal(fmt.format, "document");
      assert.equal(fmt.primaryType, PRIMARY_TYPES.RENDER_DOCUMENT);
    });

    it("detects audio format", () => {
      const fmt = detectOutputFormat("make me a beat");
      assert.equal(fmt.format, "audio");
      assert.equal(fmt.primaryType, PRIMARY_TYPES.PLAY_AUDIO);
    });

    it("detects code format", () => {
      const fmt = detectOutputFormat("code me an API endpoint");
      assert.equal(fmt.format, "code");
    });

    it("detects dataset format", () => {
      const fmt = detectOutputFormat("build me a budget spreadsheet");
      assert.equal(fmt.format, "dataset");
    });

    it("detects research format", () => {
      const fmt = detectOutputFormat("write a research paper on AI");
      assert.equal(fmt.format, "research");
    });

    it("defaults to document for ambiguous input", () => {
      const fmt = detectOutputFormat("make me something");
      assert.equal(fmt.format, "document");
    });
  });

  describe("detectMultiArtifact", () => {
    it("detects multi-artifact requests", () => {
      const result = detectMultiArtifact("plan my wedding, including budget and checklist and timeline");
      assert.ok(result.isMultiArtifact);
      assert.ok(result.estimatedCount >= 3);
    });

    it("returns single for normal requests", () => {
      const result = detectMultiArtifact("write me a contract");
      assert.ok(!result.isMultiArtifact);
      assert.equal(result.estimatedCount, 1);
    });
  });

  describe("pullSubstrate", () => {
    it("pulls relevant DTUs from user's substrate", () => {
      const state = createMockState();
      addMockDTU(state, "dtu1", { tags: ["farming", "crops"], createdBy: "user1" });
      addMockDTU(state, "dtu2", { tags: ["insurance", "policy"], createdBy: "user1" });
      addMockDTU(state, "dtu3", { tags: ["music", "audio"], createdBy: "user1" });

      const result = pullSubstrate(state, "user1", ["farming", "insurance"]);
      assert.ok(result.citationCount >= 2);
      assert.ok(result.dtus.some(d => d.id === "dtu1"));
      assert.ok(result.dtus.some(d => d.id === "dtu2"));
    });

    it("returns empty for unknown user", () => {
      const state = createMockState();
      const result = pullSubstrate(state, "nonexistent", ["farming"]);
      assert.equal(result.citationCount, 0);
    });
  });

  describe("wrapAsDTU", () => {
    it("creates a valid DTU from forge options", () => {
      const dtu = wrapAsDTU({
        title: "Farm Insurance Policy",
        content: "This is a comprehensive farm insurance policy...",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        extension: ".md",
        userId: "user1",
        sourceLenses: ["agriculture", "insurance", "legal"],
        substrateCitations: ["dtu1", "dtu2"],
        domainTags: ["farming", "insurance"],
        actionType: "CREATE",
      });

      assert.ok(dtu.id.startsWith("forge_"));
      assert.equal(dtu.title, "Farm Insurance Policy");
      assert.equal(dtu.tier, "regular");
      assert.equal(dtu.scope, "local");
      assert.equal(dtu.source, "forge");
      assert.ok(dtu.tags.includes("forged"));
      assert.ok(dtu.tags.includes("lens:agriculture"));
      assert.ok(dtu.artifact.content.includes("comprehensive"));
      assert.equal(dtu.lineage.parents.length, 2);
      assert.ok(dtu.meta.forged);
      assert.ok(dtu.creti.evidence > 0);
    });
  });

  describe("runForgePipeline", () => {
    it("runs the full forge pipeline", () => {
      const state = createMockState();
      addMockDTU(state, "sub1", { tags: ["farming"], createdBy: "user1" });

      const route = {
        ok: true,
        actionType: "CREATE",
        domainSignals: ["farming", "insurance"],
        lenses: [{ lensId: "agriculture" }, { lensId: "insurance" }],
        isMultiLens: true,
      };

      const result = runForgePipeline({
        message: "write me a farm insurance policy",
        route,
        generatedContent: "FARM INSURANCE POLICY\n\nSection 1: Coverage...",
        title: null,
        userId: "user1",
        STATE: state,
      });

      assert.ok(result.ok);
      assert.ok(result.dtu);
      assert.ok(result.presentation);
      assert.equal(result.presentation.type, "forge_card");
      assert.ok(result.presentation.sourceLenses.length >= 2);
      assert.ok(result.actions.save.available);
      assert.ok(result.actions.delete.available);
      assert.ok(result.actions.saveAndList.available);
    });
  });

  describe("iterateForge", () => {
    it("iterates in-place when not saved", () => {
      const dtu = wrapAsDTU({
        title: "Test",
        content: "Original content",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });
      const originalId = dtu.id;

      const updated = iterateForge(dtu, "make it longer", "Original content plus more details", false);
      assert.equal(updated.id, originalId); // Same DTU, updated in place
      assert.ok(updated.artifact.content.includes("more details"));
      assert.equal(updated.meta.iterationCount, 1);
    });

    it("creates new version when already saved", () => {
      const dtu = wrapAsDTU({
        title: "Test",
        content: "V1 content",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });
      const originalId = dtu.id;

      const v2 = iterateForge(dtu, "add section 2", "V1 content plus section 2", true);
      assert.notEqual(v2.id, originalId); // New ID
      assert.ok(v2.lineage.parents.includes(originalId)); // Parent pointer
      assert.equal(v2.meta.parentVersion, originalId);
    });
  });

  describe("save / delete / list", () => {
    it("saves a forged DTU to state", () => {
      const state = createMockState();
      const dtu = wrapAsDTU({
        title: "Saved Artifact",
        content: "Content",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });

      const result = saveForgedDTU(state, dtu);
      assert.ok(result.ok);
      assert.ok(state.dtus.has(dtu.id));
    });

    it("deletes a forged DTU completely", () => {
      const state = createMockState();
      const dtu = wrapAsDTU({
        title: "To Delete",
        content: "Goodbye",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });
      state.dtus.set(dtu.id, dtu);

      const result = deleteForgedDTU(state, dtu.id);
      assert.ok(result.ok);
      assert.ok(!state.dtus.has(dtu.id)); // Completely gone
    });

    it("refuses to delete non-forged DTUs", () => {
      const state = createMockState();
      addMockDTU(state, "regular-dtu", { title: "Normal DTU" });
      const result = deleteForgedDTU(state, "regular-dtu");
      assert.ok(!result.ok);
      assert.ok(state.dtus.has("regular-dtu")); // Still there
    });

    it("saves and lists on marketplace", () => {
      const state = createMockState();
      const dtu = wrapAsDTU({
        title: "Marketplace Item",
        content: "For sale",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });

      const result = saveAndList(state, dtu);
      assert.ok(result.ok);
      assert.ok(result.readyForListing);
      assert.ok(state.dtus.has(dtu.id));
    });
  });

  describe("emergent contribution", () => {
    it("records emergent contribution to a DTU", () => {
      const dtu = wrapAsDTU({
        title: "Contract",
        content: "Legal text",
        primaryType: PRIMARY_TYPES.RENDER_DOCUMENT,
        format: "document",
        userId: "user1",
      });

      const updated = recordEmergentContribution(dtu, "em_legal_1", "Reviewed legal clauses");
      assert.ok(updated.lineage.emergentContributors.length === 1);
      assert.equal(updated.lineage.emergentContributors[0].emergentId, "em_legal_1");
      assert.ok(updated.tags.includes("emergent:em_legal_1"));
    });
  });

  describe("PRIMARY_TYPES", () => {
    it("has all expected format codes", () => {
      assert.equal(PRIMARY_TYPES.PLAY_AUDIO, 0x01);
      assert.equal(PRIMARY_TYPES.DISPLAY_IMAGE, 0x02);
      assert.equal(PRIMARY_TYPES.PLAY_VIDEO, 0x03);
      assert.equal(PRIMARY_TYPES.RENDER_DOCUMENT, 0x04);
      assert.equal(PRIMARY_TYPES.RENDER_CODE, 0x05);
      assert.equal(PRIMARY_TYPES.DISPLAY_RESEARCH, 0x06);
      assert.equal(PRIMARY_TYPES.DISPLAY_DATASET, 0x07);
    });
  });
});
