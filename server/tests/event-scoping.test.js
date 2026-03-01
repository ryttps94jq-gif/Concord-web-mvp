/**
 * Tests for Event Scoping, Pull Architecture, and Event-to-DTU Bridge
 *
 * Coverage:
 *   1. EVENT_SCOPE_MAP — event types map to correct lenses
 *   2. Scope flags — localPush=false, localPull=true, global=false
 *   3. User subscription model — create, update, subscribe, unsubscribe
 *   4. News filters — CRETI threshold, confidence, rate limits
 *   5. Event classifier — DTU-worthy vs non-worthy events
 *   6. DTU formatter — legal DTU structure, epistemological stance
 *   7. Deduplication gate — recursion, hashes, rate limits
 *   8. Cross-reference engine — multi-source confidence upgrades
 *   9. CRETI auto-scoring — timeliness-weighted scoring
 *  10. External event sources — registration, classification
 *  11. News lens hub — personalized filtered queries
 *  12. News compression — daily/weekly/monthly aggregation
 *  13. News decompression — drill into compressed DTUs
 *  14. Subscriber notification — pull-based, filtered
 *  15. Rate limiting — per-user and per-type
 *  16. Bridge orchestration — full end-to-end flow
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_SCOPE_MAP,
  SCOPE_FLAGS,
  createDefaultSubscription,
  validateSubscription,
  updateSubscription,
  ensureSubscriptionState,
  getUserSubscription,
  setUserSubscription,
  subscribeLenses,
  unsubscribeLenses,
  updateNewsFilters,
  resolveEventScope,
  isEventTypeScoped,
  getKnownEventTypes,
  getEventReceivingLenses,
  checkRateLimit,
  incrementRateLimit,
  getEventScopingMetrics,
} from "../emergent/event-scoping.js";

import {
  DTU_WORTHY_EVENTS,
  classify,
  eventToDTU,
  deduplicationGate,
  computeEventCRETI,
  crossReference,
  bridgeEventToDTU,
  registerExternalSource,
  unregisterExternalSource,
  getExternalSources,
  classifyExternal,
  notifySubscribers,
  getBridgeMetrics,
  resetBridgeMetrics,
} from "../emergent/event-to-dtu-bridge.js";

import {
  queryNewsLens,
  getNewsLensSummary,
  getNewsTrending,
  compressNewsEvents,
  decompressNewsDTU,
} from "../emergent/news-lens-hub.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function freshState() {
  return {
    dtus: new Map(),
  };
}

function makeEvent(type, data = {}, overrides = {}) {
  return {
    type,
    data,
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeEventDTU(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `evtdtu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: overrides.title || "Test event DTU",
    tier: overrides.tier || "regular",
    domain: overrides.domain || "science",
    source: "event_bridge",
    scope: overrides.scope || {
      lenses: ["news", "science"],
      global: false,
      newsVisible: true,
      localPush: false,
      localPull: true,
    },
    meta: {
      eventOrigin: true,
      sourceEventType: overrides.eventType || "news:science",
      confidence: overrides.confidence || 0.8,
      epistemologicalStance: overrides.stance || "observed",
      cretiScore: overrides.creti || 60,
      ...(overrides.meta || {}),
    },
    cretiScore: overrides.creti || 60,
    human: { summary: overrides.summary || "Test event summary" },
    core: { definitions: [], invariants: [], claims: ["Test claim"], examples: [], nextActions: [] },
    tags: ["auto_event", "news:science", "science"],
    createdAt: overrides.createdAt || now,
    updatedAt: now,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. EVENT_SCOPE_MAP
// ══════════════════════════════════════════════════════════════════════════════

describe("EVENT_SCOPE_MAP", () => {
  it("maps news:politics to news, governance, law", () => {
    assert.deepStrictEqual(EVENT_SCOPE_MAP["news:politics"], ["news", "governance", "law"]);
  });

  it("maps news:science to news, science, research", () => {
    assert.deepStrictEqual(EVENT_SCOPE_MAP["news:science"], ["news", "science", "research"]);
  });

  it("maps council:vote to governance only", () => {
    assert.deepStrictEqual(EVENT_SCOPE_MAP["council:vote"], ["governance"]);
  });

  it("maps repair:cycle_complete to system only", () => {
    assert.deepStrictEqual(EVENT_SCOPE_MAP["repair:cycle_complete"], ["system"]);
  });

  it("maps dream:captured to cognition only", () => {
    assert.deepStrictEqual(EVENT_SCOPE_MAP["dream:captured"], ["cognition"]);
  });

  it("does not map unknown event types", () => {
    assert.strictEqual(EVENT_SCOPE_MAP["chat:token"], undefined);
    assert.strictEqual(EVENT_SCOPE_MAP["unknown:event"], undefined);
  });

  it("never maps any event to music lens (scoped not global)", () => {
    for (const [type, lenses] of Object.entries(EVENT_SCOPE_MAP)) {
      assert.ok(!lenses.includes("music"), `${type} should not target music lens`);
    }
  });

  it("is frozen (immutable)", () => {
    assert.throws(() => { EVENT_SCOPE_MAP["new:type"] = ["test"]; }, TypeError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. SCOPE FLAGS
// ══════════════════════════════════════════════════════════════════════════════

describe("SCOPE_FLAGS", () => {
  it("localPush is always false (never force into substrate)", () => {
    assert.strictEqual(SCOPE_FLAGS.localPush, false);
  });

  it("localPull is always true (available when requested)", () => {
    assert.strictEqual(SCOPE_FLAGS.localPull, true);
  });

  it("global is always false (scoped, not global)", () => {
    assert.strictEqual(SCOPE_FLAGS.global, false);
  });

  it("newsVisible is always true (hub visibility)", () => {
    assert.strictEqual(SCOPE_FLAGS.newsVisible, true);
  });

  it("is frozen (immutable)", () => {
    assert.throws(() => { SCOPE_FLAGS.localPush = true; }, TypeError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. USER SUBSCRIPTION MODEL
// ══════════════════════════════════════════════════════════════════════════════

describe("User Subscription Model", () => {
  it("creates default subscription with empty lenses", () => {
    const sub = createDefaultSubscription("user1");
    assert.strictEqual(sub.userId, "user1");
    assert.deepStrictEqual(sub.subscribedLenses, []);
    assert.strictEqual(sub.localSubstrate.scopeToSubscribed, true);
    assert.strictEqual(sub.localSubstrate.allowEventDTUs, true);
  });

  it("validates valid subscription", () => {
    const sub = createDefaultSubscription("user1");
    const result = validateSubscription(sub);
    assert.strictEqual(result.ok, true);
  });

  it("rejects subscription without userId", () => {
    const sub = createDefaultSubscription("user1");
    sub.userId = null;
    const result = validateSubscription(sub);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("missing_user_id"));
  });

  it("rejects invalid minCRETI", () => {
    const sub = createDefaultSubscription("user1");
    sub.newsFilters.minCRETI = 150;
    const result = validateSubscription(sub);
    assert.strictEqual(result.ok, false);
  });

  it("updates subscription by merging", () => {
    const original = createDefaultSubscription("user1");
    const updated = updateSubscription(original, {
      subscribedLenses: ["science", "news"],
      newsFilters: { minCRETI: 70 },
    });
    assert.deepStrictEqual(updated.subscribedLenses, ["science", "news"]);
    assert.strictEqual(updated.newsFilters.minCRETI, 70);
    assert.strictEqual(updated.newsFilters.maxPerHour, 50); // preserved
  });

  it("subscribes to lenses", () => {
    const STATE = freshState();
    subscribeLenses(STATE, "user1", ["science", "news"]);
    const sub = getUserSubscription(STATE, "user1");
    assert.deepStrictEqual(sub.subscribedLenses, ["science", "news"]);
  });

  it("does not duplicate lens subscriptions", () => {
    const STATE = freshState();
    subscribeLenses(STATE, "user1", ["science", "news"]);
    subscribeLenses(STATE, "user1", ["science", "healthcare"]);
    const sub = getUserSubscription(STATE, "user1");
    assert.deepStrictEqual(sub.subscribedLenses, ["science", "news", "healthcare"]);
  });

  it("unsubscribes from lenses", () => {
    const STATE = freshState();
    subscribeLenses(STATE, "user1", ["science", "news", "healthcare"]);
    unsubscribeLenses(STATE, "user1", ["news"]);
    const sub = getUserSubscription(STATE, "user1");
    assert.deepStrictEqual(sub.subscribedLenses, ["science", "healthcare"]);
  });

  it("updates news filters", () => {
    const STATE = freshState();
    updateNewsFilters(STATE, "user1", { minCRETI: 80, minConfidence: 0.9 });
    const sub = getUserSubscription(STATE, "user1");
    assert.strictEqual(sub.newsFilters.minCRETI, 80);
    assert.strictEqual(sub.newsFilters.minConfidence, 0.9);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. SCOPE RESOLUTION
// ══════════════════════════════════════════════════════════════════════════════

describe("Scope Resolution", () => {
  it("resolves event scope to correct lenses", () => {
    const lenses = resolveEventScope("news:science");
    assert.deepStrictEqual(lenses, ["news", "science", "research"]);
  });

  it("returns empty array for unknown events (no DTU created)", () => {
    const lenses = resolveEventScope("chat:typing");
    assert.deepStrictEqual(lenses, []);
  });

  it("correctly identifies scoped event types", () => {
    assert.strictEqual(isEventTypeScoped("news:politics"), true);
    assert.strictEqual(isEventTypeScoped("unknown:event"), false);
  });

  it("lists all known event types", () => {
    const types = getKnownEventTypes();
    assert.ok(types.includes("news:politics"));
    assert.ok(types.includes("council:vote"));
    assert.ok(types.includes("dream:captured"));
  });

  it("lists all event-receiving lenses", () => {
    const lenses = getEventReceivingLenses();
    assert.ok(lenses.includes("news"));
    assert.ok(lenses.includes("science"));
    assert.ok(lenses.includes("governance"));
    assert.ok(!lenses.includes("music")); // music never receives events
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. EVENT CLASSIFIER (Layer 1)
// ══════════════════════════════════════════════════════════════════════════════

describe("Event Classifier", () => {
  it("classifies DTU-worthy events", () => {
    const result = classify(makeEvent("council:vote", { decision: "approved" }));
    assert.ok(result);
    assert.strictEqual(result.domain, "governance");
    assert.strictEqual(result.confidence, 0.9);
  });

  it("rejects non-DTU-worthy events", () => {
    const result = classify(makeEvent("chat:typing", {}));
    assert.strictEqual(result, null);
  });

  it("rejects events with noBridge flag", () => {
    const result = classify(makeEvent("council:vote", {}, { noBridge: true }));
    assert.strictEqual(result, null);
  });

  it("rejects null/invalid events", () => {
    assert.strictEqual(classify(null), null);
    assert.strictEqual(classify({}), null);
    assert.strictEqual(classify({ type: "" }), null);
  });

  it("identifies external events", () => {
    const result = classify(makeEvent("news:science", {}, { source: "reuters_feed" }));
    assert.ok(result);
    assert.strictEqual(result.isExternal, true);
  });

  it("identifies internal events", () => {
    const result = classify(makeEvent("council:vote", {}));
    assert.ok(result);
    assert.strictEqual(result.isExternal, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. DTU FORMATTER (Layer 2)
// ══════════════════════════════════════════════════════════════════════════════

describe("DTU Formatter", () => {
  it("formats event into legal DTU structure", () => {
    const event = makeEvent("council:vote", { decision: "approved", topic: "budget" });
    const classification = classify(event);
    const dtu = eventToDTU(event, classification);

    assert.ok(dtu.id.startsWith("evtdtu_"));
    assert.ok(dtu.title.includes("council:vote"));
    assert.strictEqual(dtu.tier, "regular");
    assert.strictEqual(dtu.source, "event_bridge");
    assert.strictEqual(dtu.domain, "governance");
    assert.ok(dtu.tags.includes("auto_event"));
    assert.ok(dtu.tags.includes("council:vote"));
  });

  it("sets epistemologicalStance to 'observed' for internal events", () => {
    const event = makeEvent("council:vote", {});
    const classification = classify(event);
    const dtu = eventToDTU(event, classification);

    assert.strictEqual(dtu.meta.epistemologicalStance, "observed");
    assert.ok(dtu.tags.includes("stance:observed"));
  });

  it("sets epistemologicalStance to 'reported' for external events", () => {
    const event = makeEvent("news:science", {}, { source: "arxiv" });
    const classification = { domain: "science", confidence: 0.8, isExternal: true, eventType: "news:science" };
    const dtu = eventToDTU(event, classification);

    assert.strictEqual(dtu.meta.epistemologicalStance, "reported");
    assert.ok(dtu.tags.includes("stance:reported"));
    assert.ok(dtu.tags.includes("external"));
  });

  it("enforces scope flags on every DTU", () => {
    const event = makeEvent("news:politics", {});
    const classification = classify(event);
    const dtu = eventToDTU(event, classification);

    assert.strictEqual(dtu.scope.global, false);
    assert.strictEqual(dtu.scope.localPush, false);
    assert.strictEqual(dtu.scope.localPull, true);
    assert.strictEqual(dtu.scope.newsVisible, true);
    assert.deepStrictEqual(dtu.scope.lenses, ["news", "governance", "law"]);
  });

  it("includes integrity proof (rawEventHash)", () => {
    const event = makeEvent("market:trade", { symbol: "AAPL", price: 150 });
    const classification = classify(event);
    const dtu = eventToDTU(event, classification);

    assert.ok(dtu.meta.rawEventHash);
    assert.strictEqual(typeof dtu.meta.rawEventHash, "string");
    assert.strictEqual(dtu.meta.rawEventHash.length, 16);
  });

  it("extracts claims from event data", () => {
    const event = makeEvent("council:vote", { outcome: "passed", status: "final" });
    const classification = classify(event);
    const dtu = eventToDTU(event, classification);

    assert.ok(dtu.core.claims.length > 0);
    assert.ok(dtu.core.claims.some(c => c.includes("council:vote")));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. DEDUPLICATION GATE (Layer 3)
// ══════════════════════════════════════════════════════════════════════════════

describe("Deduplication Gate", () => {
  beforeEach(() => {
    resetBridgeMetrics();
  });

  it("allows new events through", () => {
    const dtu = eventToDTU(
      makeEvent("council:vote", { unique: Math.random() }),
      { domain: "governance", confidence: 0.9, isExternal: false, eventType: "council:vote" }
    );
    const result = deduplicationGate(dtu, () => null);
    assert.strictEqual(result.ok, true);
  });

  it("blocks duplicate hashes", () => {
    const event = makeEvent("council:vote", { sameData: "test123" });
    const classification = classify(event);

    const dtu1 = eventToDTU(event, classification);
    const result1 = deduplicationGate(dtu1, () => null);
    assert.strictEqual(result1.ok, true);

    // Same hash should be blocked
    const dtu2 = eventToDTU(event, classification);
    const result2 = deduplicationGate(dtu2, () => null);
    assert.strictEqual(result2.ok, false);
    assert.strictEqual(result2.reason, "duplicate_hash_blocked");
  });

  it("blocks recursion loops (event-sourced DTU about event-sourced DTU)", () => {
    const dtu = {
      meta: {
        eventOrigin: true,
        sourceEventType: "dtu:created",
        sourceEventId: "evtdtu_123",
        rawEventHash: "abcdef1234567890",
      },
    };
    const lookupDTU = (id) => {
      if (id === "evtdtu_123") return { meta: { eventOrigin: true } };
      return null;
    };
    const result = deduplicationGate(dtu, lookupDTU);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, "recursion_loop_blocked");
  });

  it("blocks bridge confirmation events", () => {
    const dtu = {
      meta: {
        eventOrigin: true,
        sourceEventType: "dtu:event_bridged",
        rawEventHash: "uniqueHash123456",
      },
    };
    const result = deduplicationGate(dtu, () => null);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, "bridge_confirmation_blocked");
  });

  it("allows dtu:created events about human-created DTUs", () => {
    const dtu = {
      meta: {
        eventOrigin: true,
        sourceEventType: "dtu:created",
        sourceEventId: "dtu_human_abc",
        rawEventHash: `unique_${Math.random()}`,
      },
    };
    const lookupDTU = (id) => {
      if (id === "dtu_human_abc") return { meta: {} }; // no eventOrigin
      return null;
    };
    const result = deduplicationGate(dtu, lookupDTU);
    assert.strictEqual(result.ok, true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. CROSS-REFERENCE ENGINE (Layer 7)
// ══════════════════════════════════════════════════════════════════════════════

describe("Cross-Reference Engine", () => {
  beforeEach(() => {
    resetBridgeMetrics();
  });

  it("returns crossRefCount of 1 for first occurrence", () => {
    const dtu = makeEventDTU({ domain: "science", stance: "reported" });
    dtu.title = `unique_title_${Math.random()}`;
    const result = crossReference(dtu, () => null, () => {});
    assert.strictEqual(result.crossRefCount, 1);
    assert.strictEqual(result.upgraded, false);
  });

  it("upgrades confidence when 2 sources confirm", () => {
    const baseDtu1 = makeEventDTU({ domain: "science", confidence: 0.7, stance: "reported" });
    baseDtu1.title = "shared_title_crossref_test";
    baseDtu1.meta.externalSource = "source_A";
    baseDtu1.meta.sourceEventType = "news:science";

    crossReference(baseDtu1, () => null, () => {});

    const baseDtu2 = makeEventDTU({ domain: "science", confidence: 0.7, stance: "reported" });
    baseDtu2.title = "shared_title_crossref_test";
    baseDtu2.meta.externalSource = "source_B";
    baseDtu2.meta.sourceEventType = "news:science";

    const result = crossReference(baseDtu2, () => null, () => {});
    assert.strictEqual(result.crossRefCount, 2);
    assert.strictEqual(result.upgraded, true);
    assert.ok(result.confidence >= 0.85);
  });

  it("upgrades to corroborated with 3+ sources", () => {
    const makeRef = (source) => {
      const dtu = makeEventDTU({ domain: "test_corroboration", confidence: 0.6, stance: "reported" });
      dtu.title = "corroboration_test_event";
      dtu.meta.externalSource = source;
      dtu.meta.sourceEventType = "news:tech";
      dtu.domain = "test_corroboration";
      return dtu;
    };

    crossReference(makeRef("src_1"), () => null, () => {});
    crossReference(makeRef("src_2"), () => null, () => {});
    const result = crossReference(makeRef("src_3"), () => null, () => {});

    assert.strictEqual(result.crossRefCount, 3);
    assert.strictEqual(result.stance, "corroborated");
    assert.ok(result.confidence >= 0.95);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. CRETI AUTO-SCORING (Layer 6)
// ══════════════════════════════════════════════════════════════════════════════

describe("CRETI Auto-Scoring", () => {
  it("scores event DTUs with high timeliness", () => {
    const dtu = makeEventDTU({ confidence: 0.9 });
    const creti = computeEventCRETI(dtu);
    assert.ok(creti.breakdown.timeliness >= 18);
  });

  it("scores internal events higher on credibility than external", () => {
    const internal = makeEventDTU({ confidence: 0.9 });
    internal.meta.isExternal = false;
    const internalCreti = computeEventCRETI(internal);

    const external = makeEventDTU({ confidence: 0.9 });
    external.meta.isExternal = true;
    const externalCreti = computeEventCRETI(external);

    assert.ok(internalCreti.breakdown.credibility > externalCreti.breakdown.credibility);
  });

  it("total score is between 0 and 100", () => {
    const dtu = makeEventDTU({});
    const creti = computeEventCRETI(dtu);
    assert.ok(creti.total >= 0);
    assert.ok(creti.total <= 100);
  });

  it("includes all five CRETI dimensions", () => {
    const dtu = makeEventDTU({});
    const creti = computeEventCRETI(dtu);
    assert.ok("credibility" in creti.breakdown);
    assert.ok("relevance" in creti.breakdown);
    assert.ok("evidence" in creti.breakdown);
    assert.ok("timeliness" in creti.breakdown);
    assert.ok("impact" in creti.breakdown);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. EXTERNAL EVENT SOURCES (Layer 5)
// ══════════════════════════════════════════════════════════════════════════════

describe("External Event Sources", () => {
  beforeEach(() => {
    resetBridgeMetrics();
  });

  it("registers external source", () => {
    const result = registerExternalSource("reuters", {
      name: "Reuters News Feed",
      classifier: {
        "breaking_news": { domain: "current_events", confidence: 0.7 },
        "economic_data": { domain: "economics", confidence: 0.9 },
      },
      rateLimit: 100,
      requireVerification: true,
    });
    assert.strictEqual(result.ok, true);
  });

  it("lists registered sources", () => {
    registerExternalSource("test_src_list", {
      name: "Test Source",
      classifier: { "test_event": { domain: "test", confidence: 0.5 } },
      rateLimit: 10,
    });
    const sources = getExternalSources();
    assert.ok(sources.length > 0);
    const testSrc = sources.find(s => s.id === "test_src_list");
    assert.ok(testSrc);
    assert.strictEqual(testSrc.name, "Test Source");
  });

  it("classifies external events using source classifier", () => {
    registerExternalSource("test_classify", {
      name: "Test Classifier",
      classifier: { "test_event": { domain: "test", confidence: 0.75 } },
      rateLimit: 100,
    });

    const result = classifyExternal("test_classify", { type: "test_event", data: {} });
    assert.ok(result);
    assert.strictEqual(result.domain, "test");
    assert.strictEqual(result.isExternal, true);
  });

  it("rejects unknown event types from external source", () => {
    registerExternalSource("test_reject", {
      name: "Test Reject",
      classifier: { "known_event": { domain: "test", confidence: 0.5 } },
      rateLimit: 100,
    });

    const result = classifyExternal("test_reject", { type: "unknown_event", data: {} });
    assert.strictEqual(result, null);
  });

  it("unregisters external source", () => {
    registerExternalSource("to_remove", {
      name: "Remove Me",
      classifier: { "test": { domain: "test", confidence: 0.5 } },
      rateLimit: 10,
    });
    const result = unregisterExternalSource("to_remove");
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, true);
  });

  it("rejects registration without classifier", () => {
    const result = registerExternalSource("bad", { name: "Bad" });
    assert.strictEqual(result.ok, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. NEWS LENS HUB — Personalized Queries
// ══════════════════════════════════════════════════════════════════════════════

describe("News Lens Hub", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
    resetBridgeMetrics();

    // Set up user with subscriptions
    subscribeLenses(STATE, "user1", ["science", "news", "healthcare"]);
    updateNewsFilters(STATE, "user1", { minCRETI: 50, minConfidence: 0.5 });

    // Add event DTUs
    STATE.dtus.set("evt1", makeEventDTU({
      id: "evt1", domain: "science", creti: 70, confidence: 0.8,
      eventType: "news:science", createdAt: new Date().toISOString(),
    }));
    STATE.dtus.set("evt2", makeEventDTU({
      id: "evt2", domain: "economics", creti: 80, confidence: 0.9,
      eventType: "news:economics", createdAt: new Date().toISOString(),
      scope: { lenses: ["news", "economics"], global: false, newsVisible: true, localPush: false, localPull: true },
    }));
    STATE.dtus.set("evt3", makeEventDTU({
      id: "evt3", domain: "science", creti: 30, confidence: 0.3,
      eventType: "news:science", createdAt: new Date().toISOString(),
    }));
  });

  it("returns events matching user subscriptions", () => {
    const result = queryNewsLens(STATE, "user1");
    assert.strictEqual(result.ok, true);
    // Should include evt1 (science, CRETI 70 >= 50) but not evt3 (CRETI 30 < 50)
    const ids = result.events.map(e => e.id);
    assert.ok(ids.includes("evt1"));
    assert.ok(!ids.includes("evt3")); // below CRETI threshold
  });

  it("filters by CRETI threshold", () => {
    const result = queryNewsLens(STATE, "user1", { minCRETI: 75 });
    const ids = result.events.map(e => e.id);
    assert.ok(!ids.includes("evt1")); // CRETI 70 < 75
  });

  it("filters by domain", () => {
    const result = queryNewsLens(STATE, "user1", { domain: "economics" });
    // Only economics events
    for (const event of result.events) {
      assert.ok(event.domain.includes("economics") || "economics".includes(event.domain));
    }
  });

  it("sorts by newest by default", () => {
    const result = queryNewsLens(STATE, "user1");
    for (let i = 1; i < result.events.length; i++) {
      assert.ok(result.events[i - 1].createdAt >= result.events[i].createdAt);
    }
  });

  it("sorts by CRETI when requested", () => {
    // Reset minCRETI to 0 so all pass
    updateNewsFilters(STATE, "user1", { minCRETI: 0, minConfidence: 0 });
    const result = queryNewsLens(STATE, "user1", { sortBy: "creti" });
    for (let i = 1; i < result.events.length; i++) {
      assert.ok(result.events[i - 1].creti >= result.events[i].creti);
    }
  });

  it("provides news lens summary", () => {
    updateNewsFilters(STATE, "user1", { minCRETI: 0, minConfidence: 0 });
    const summary = getNewsLensSummary(STATE, "user1");
    assert.strictEqual(summary.ok, true);
    assert.ok(summary.total > 0);
    assert.ok(summary.domainCounts.science > 0);
  });

  it("provides trending topics", () => {
    const trending = getNewsTrending(STATE);
    assert.strictEqual(trending.ok, true);
    assert.ok(Array.isArray(trending.topTypes));
    assert.ok(Array.isArray(trending.topDomains));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 12. NEWS COMPRESSION
// ══════════════════════════════════════════════════════════════════════════════

describe("News Compression", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
    resetBridgeMetrics();
  });

  it("compresses old events into daily Mega DTUs", () => {
    // Create 5 old science events from 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    for (let i = 0; i < 5; i++) {
      const id = `old_evt_${i}`;
      STATE.dtus.set(id, makeEventDTU({
        id,
        domain: "science",
        creti: 60 + i,
        createdAt: twoDaysAgo.toISOString(),
      }));
    }

    const result = compressNewsEvents(STATE, { dailyAgeHours: 24, minClusterSize: 3 });
    assert.strictEqual(result.ok, true);
    assert.ok(result.dailyMegas > 0);

    // Verify Mega was created
    const megas = [...STATE.dtus.values()].filter(d => d.tier === "mega" && d.meta?.compressionType === "daily");
    assert.ok(megas.length > 0);
    assert.ok(megas[0].title.includes("Daily"));
    assert.ok(megas[0].title.includes("science"));
    assert.strictEqual(megas[0].scope.localPush, false);
    assert.strictEqual(megas[0].scope.localPull, true);
  });

  it("marks children as compressed without deleting them", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    for (let i = 0; i < 3; i++) {
      const id = `compress_child_${i}`;
      STATE.dtus.set(id, makeEventDTU({
        id,
        domain: "governance",
        creti: 50,
        createdAt: twoDaysAgo.toISOString(),
      }));
    }

    compressNewsEvents(STATE, { dailyAgeHours: 24, minClusterSize: 3 });

    // Children still exist
    assert.ok(STATE.dtus.has("compress_child_0"));
    // But are marked as compressed
    assert.strictEqual(STATE.dtus.get("compress_child_0").meta.compressed, true);
  });

  it("does not compress recent events", () => {
    for (let i = 0; i < 5; i++) {
      const id = `recent_evt_${i}`;
      STATE.dtus.set(id, makeEventDTU({
        id,
        domain: "science",
        creti: 60,
        createdAt: new Date().toISOString(),
      }));
    }

    const result = compressNewsEvents(STATE, { dailyAgeHours: 24, minClusterSize: 3 });
    assert.strictEqual(result.dailyMegas, 0);
  });

  it("does not compress clusters smaller than minClusterSize", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    for (let i = 0; i < 2; i++) {
      STATE.dtus.set(`small_${i}`, makeEventDTU({
        id: `small_${i}`,
        domain: "economics",
        creti: 50,
        createdAt: twoDaysAgo.toISOString(),
      }));
    }

    const result = compressNewsEvents(STATE, { dailyAgeHours: 24, minClusterSize: 3 });
    assert.strictEqual(result.dailyMegas, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 13. NEWS DECOMPRESSION
// ══════════════════════════════════════════════════════════════════════════════

describe("News Decompression", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();

    // Create a daily Mega with children
    for (let i = 0; i < 4; i++) {
      STATE.dtus.set(`child_${i}`, makeEventDTU({
        id: `child_${i}`,
        domain: "science",
        meta: { compressed: true, compressedInto: "mega_daily_test" },
      }));
    }

    STATE.dtus.set("mega_daily_test", {
      id: "mega_daily_test",
      title: "Daily science events — 2026-02-28",
      tier: "mega",
      domain: "science",
      meta: {
        eventOrigin: true,
        compressed: true,
        compressionType: "daily",
        childCount: 4,
        childIds: ["child_0", "child_1", "child_2", "child_3"],
      },
      human: { summary: "4 science events" },
      createdAt: new Date().toISOString(),
    });
  });

  it("decompresses Mega DTU to show children", () => {
    const result = decompressNewsDTU(STATE, "mega_daily_test");
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.children.length, 4);
    assert.strictEqual(result.parent.childCount, 4);
  });

  it("each child indicates if it can be further decompressed", () => {
    const result = decompressNewsDTU(STATE, "mega_daily_test");
    for (const child of result.children) {
      assert.strictEqual(typeof child.canDecompress, "boolean");
    }
  });

  it("returns error for non-compressed DTU", () => {
    STATE.dtus.set("regular_dtu", makeEventDTU({ id: "regular_dtu" }));
    const result = decompressNewsDTU(STATE, "regular_dtu");
    assert.strictEqual(result.ok, false);
  });

  it("returns error for non-existent DTU", () => {
    const result = decompressNewsDTU(STATE, "nonexistent");
    assert.strictEqual(result.ok, false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 14. SUBSCRIBER NOTIFICATION (Pull Architecture)
// ══════════════════════════════════════════════════════════════════════════════

describe("Subscriber Notification", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
    resetBridgeMetrics();
  });

  it("notifies users subscribed to relevant lenses", () => {
    subscribeLenses(STATE, "user1", ["science", "news"]);
    updateNewsFilters(STATE, "user1", { minCRETI: 0, minConfidence: 0 });

    const dtu = makeEventDTU({
      scope: { lenses: ["news", "science"], global: false, newsVisible: true, localPush: false, localPull: true },
    });

    const notifications = [];
    const broadcastEvent = (type, data) => notifications.push({ type, data });

    const result = notifySubscribers(STATE, dtu, broadcastEvent);
    assert.ok(result.notified > 0);
    assert.ok(notifications.some(n => n.type === "event:dtu_available"));
    assert.ok(notifications[0].data.noBridge === true); // pull notification, not push
  });

  it("does not notify users not subscribed to relevant lenses", () => {
    subscribeLenses(STATE, "user_music", ["music", "arts"]);

    const dtu = makeEventDTU({
      scope: { lenses: ["news", "science"], global: false, newsVisible: true, localPush: false, localPull: true },
    });

    const notifications = [];
    const broadcastEvent = (type, data) => notifications.push({ type, data });

    const result = notifySubscribers(STATE, dtu, broadcastEvent);
    // Music user should NOT be notified about science events
    const musicNotifications = notifications.filter(n => n.data.userId === "user_music");
    assert.strictEqual(musicNotifications.length, 0);
  });

  it("filters by CRETI threshold", () => {
    subscribeLenses(STATE, "quality_user", ["science", "news"]);
    updateNewsFilters(STATE, "quality_user", { minCRETI: 80 });

    const dtu = makeEventDTU({ creti: 50 }); // below threshold

    const notifications = [];
    const broadcastEvent = (type, data) => notifications.push({ type, data });

    notifySubscribers(STATE, dtu, broadcastEvent);
    const userNotifications = notifications.filter(n => n.data.userId === "quality_user");
    assert.strictEqual(userNotifications.length, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 15. RATE LIMITING
// ══════════════════════════════════════════════════════════════════════════════

describe("Rate Limiting", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("allows within rate limit", () => {
    updateNewsFilters(STATE, "user1", { maxPerHour: 10 });
    const result = checkRateLimit(STATE, "user1");
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 10);
  });

  it("blocks when rate limit exceeded", () => {
    updateNewsFilters(STATE, "user_limited", { maxPerHour: 2 });
    checkRateLimit(STATE, "user_limited"); // init window
    incrementRateLimit(STATE, "user_limited");
    incrementRateLimit(STATE, "user_limited");

    const result = checkRateLimit(STATE, "user_limited");
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.remaining, 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 16. BRIDGE ORCHESTRATION (Full End-to-End)
// ══════════════════════════════════════════════════════════════════════════════

describe("Bridge Orchestration", () => {
  beforeEach(() => {
    resetBridgeMetrics();
  });

  it("full flow: event → classify → format → dedup → CRETI → commit (standalone)", async () => {
    const event = makeEvent("council:vote", {
      decision: "approved",
      topic: "infrastructure budget",
    });

    const result = await bridgeEventToDTU(event);
    assert.strictEqual(result.ok, true);
    assert.ok(result.dtuId);
    assert.ok(result.creti > 0);
    assert.ok(result.lenses.length > 0);
    assert.ok(result.lenses.includes("governance"));
  });

  it("rejects non-DTU-worthy events", async () => {
    const event = makeEvent("chat:typing", {});
    const result = await bridgeEventToDTU(event);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, "not_dtu_worthy");
  });

  it("rejects events with noBridge flag", async () => {
    const event = makeEvent("council:vote", {}, { noBridge: true });
    const result = await bridgeEventToDTU(event);
    assert.strictEqual(result.ok, false);
  });

  it("returns correct lenses for scoped events", async () => {
    const event = makeEvent("news:politics", { headline: "Supreme Court ruling" });
    const result = await bridgeEventToDTU(event);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.lenses, ["news", "governance", "law"]);
  });

  it("tracks bridge metrics", async () => {
    await bridgeEventToDTU(makeEvent("council:vote", { unique: Math.random() }));
    await bridgeEventToDTU(makeEvent("chat:typing", {}));

    const metrics = getBridgeMetrics();
    assert.strictEqual(metrics.ok, true);
    assert.ok(metrics.metrics.eventsReceived >= 2);
    assert.ok(metrics.metrics.eventsClassified >= 1);
    assert.ok(metrics.metrics.eventsDroppedClassifier >= 1);
  });

  it("processes external events through source-specific classifier", async () => {
    registerExternalSource("test_bridge_src", {
      name: "Test Bridge Source",
      classifier: {
        "breaking_news": { domain: "current_events", confidence: 0.7 },
      },
      rateLimit: 100,
    });

    const event = makeEvent("breaking_news", { headline: "Test" }, { source: "test_bridge_src" });
    const result = await bridgeEventToDTU(event);
    assert.strictEqual(result.ok, true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// METRICS
// ══════════════════════════════════════════════════════════════════════════════

describe("Event Scoping Metrics", () => {
  it("tracks subscription and event metrics", () => {
    const STATE = freshState();
    subscribeLenses(STATE, "user1", ["science"]);
    subscribeLenses(STATE, "user2", ["news"]);

    const metrics = getEventScopingMetrics(STATE);
    assert.strictEqual(metrics.ok, true);
    assert.strictEqual(metrics.subscriptionCount, 2);
    assert.ok(metrics.knownEventTypes > 0);
    assert.ok(metrics.receivingLenses > 0);
  });
});
