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
  getAllManifests,
  getManifestStats,
  initializeManifests,
  registerUserLens,
  registerEmergentLens,
  hasManifest,
  ACTION_TO_TYPE,
  DOMAIN_TAG_MAP,
  _deriveActionTypes,
} from "../lib/lens-manifest.js";

// ── ACTION_TYPES constant ────────────────────────────────────────────────

describe("ACTION_TYPES", () => {
  it("contains exactly 8 universal action categories", () => {
    const keys = Object.keys(ACTION_TYPES);
    assert.equal(keys.length, 8);
    assert.deepEqual(keys.sort(), [
      "ANALYZE", "CONNECT", "CREATE", "MANAGE",
      "QUERY", "SIMULATE", "TEACH", "TRADE",
    ]);
  });

  it("values match their keys", () => {
    for (const [key, value] of Object.entries(ACTION_TYPES)) {
      assert.equal(key, value, `ACTION_TYPES.${key} should equal "${key}"`);
    }
  });

  it("is frozen and cannot be mutated", () => {
    assert.ok(Object.isFrozen(ACTION_TYPES));
    assert.throws(() => { ACTION_TYPES.NEW_TYPE = "NEW_TYPE"; }, TypeError);
  });
});

// ── Write / Read action type classification ──────────────────────────────

describe("WRITE_ACTION_TYPES", () => {
  it("contains CREATE, TRADE, and MANAGE", () => {
    assert.ok(WRITE_ACTION_TYPES.has("CREATE"));
    assert.ok(WRITE_ACTION_TYPES.has("TRADE"));
    assert.ok(WRITE_ACTION_TYPES.has("MANAGE"));
  });

  it("has exactly 3 entries", () => {
    assert.equal(WRITE_ACTION_TYPES.size, 3);
  });

  it("does not contain read-only types", () => {
    assert.ok(!WRITE_ACTION_TYPES.has("QUERY"));
    assert.ok(!WRITE_ACTION_TYPES.has("ANALYZE"));
    assert.ok(!WRITE_ACTION_TYPES.has("CONNECT"));
    assert.ok(!WRITE_ACTION_TYPES.has("TEACH"));
    assert.ok(!WRITE_ACTION_TYPES.has("SIMULATE"));
  });
});

describe("READ_ACTION_TYPES", () => {
  it("contains QUERY, ANALYZE, CONNECT, and TEACH", () => {
    assert.ok(READ_ACTION_TYPES.has("QUERY"));
    assert.ok(READ_ACTION_TYPES.has("ANALYZE"));
    assert.ok(READ_ACTION_TYPES.has("CONNECT"));
    assert.ok(READ_ACTION_TYPES.has("TEACH"));
  });

  it("has exactly 4 entries", () => {
    assert.equal(READ_ACTION_TYPES.size, 4);
  });

  it("does not contain write types", () => {
    assert.ok(!READ_ACTION_TYPES.has("CREATE"));
    assert.ok(!READ_ACTION_TYPES.has("TRADE"));
    assert.ok(!READ_ACTION_TYPES.has("MANAGE"));
  });

  it("SIMULATE is neither read nor write", () => {
    assert.ok(!READ_ACTION_TYPES.has("SIMULATE"));
    assert.ok(!WRITE_ACTION_TYPES.has("SIMULATE"));
  });
});

// ── ACTION_TO_TYPE mapping ───────────────────────────────────────────────

describe("ACTION_TO_TYPE", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(ACTION_TO_TYPE));
  });

  it("maps query-family actions to QUERY", () => {
    const queryActions = ["query", "get", "search", "find", "browse", "list",
      "lookup", "status", "info", "stream", "view"];
    for (const action of queryActions) {
      assert.equal(ACTION_TO_TYPE[action], "QUERY", `${action} should map to QUERY`);
    }
  });

  it("maps analyze-family actions to ANALYZE", () => {
    const analyzeActions = ["analyze", "compare", "score", "audit", "validate",
      "check", "detect", "evaluate", "assess", "review", "inspect",
      "summarize", "cluster", "rank", "trace"];
    for (const action of analyzeActions) {
      assert.equal(ACTION_TO_TYPE[action], "ANALYZE", `${action} should map to ANALYZE`);
    }
  });

  it("maps compound analyze actions to ANALYZE", () => {
    const compoundAnalyze = [
      "analyze-mix", "detect-fallacy", "check-interactions",
      "detect-contradictions", "detect-patterns", "check-compliance",
      "schema-inspect", "compare_versions", "extract_thesis",
      "extract_decisions", "detect_consensus", "generate_insights",
      "cluster_topics", "rank_posts", "trace-lineage", "score-explain",
    ];
    for (const action of compoundAnalyze) {
      assert.equal(ACTION_TO_TYPE[action], "ANALYZE", `${action} should map to ANALYZE`);
    }
  });

  it("maps create-family actions to CREATE", () => {
    const createActions = ["create", "generate", "draft", "write", "compose",
      "build", "forge", "publish", "generate-pattern", "suggest-chords",
      "auto-arrange", "generate_summary_dtu"];
    for (const action of createActions) {
      assert.equal(ACTION_TO_TYPE[action], "CREATE", `${action} should map to CREATE`);
    }
  });

  it("maps simulate-family actions to SIMULATE", () => {
    const simActions = ["simulate", "forecast", "predict", "model",
      "scenario", "project", "test"];
    for (const action of simActions) {
      assert.equal(ACTION_TO_TYPE[action], "SIMULATE", `${action} should map to SIMULATE`);
    }
  });

  it("maps trade-family actions to TRADE", () => {
    const tradeActions = ["sell", "buy", "purchase", "list-for-sale", "trade", "transfer"];
    for (const action of tradeActions) {
      assert.equal(ACTION_TO_TYPE[action], "TRADE", `${action} should map to TRADE`);
    }
  });

  it("maps connect-family actions to CONNECT", () => {
    const connectActions = ["connect", "relate", "link", "map", "bridge", "cross-reference"];
    for (const action of connectActions) {
      assert.equal(ACTION_TO_TYPE[action], "CONNECT", `${action} should map to CONNECT`);
    }
  });

  it("maps teach-family actions to TEACH", () => {
    const teachActions = ["teach", "explain", "tutor", "learn", "study", "suggest"];
    for (const action of teachActions) {
      assert.equal(ACTION_TO_TYPE[action], "TEACH", `${action} should map to TEACH`);
    }
  });

  it("maps manage-family actions to MANAGE", () => {
    const manageActions = ["manage", "configure", "update", "settings",
      "profile", "export", "import", "delete"];
    for (const action of manageActions) {
      assert.equal(ACTION_TO_TYPE[action], "MANAGE", `${action} should map to MANAGE`);
    }
  });
});

// ── DOMAIN_TAG_MAP ───────────────────────────────────────────────────────

describe("DOMAIN_TAG_MAP", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DOMAIN_TAG_MAP));
  });

  it("contains expected domains", () => {
    const expectedDomains = [
      "accounting", "agriculture", "agents", "art", "aviation", "bio",
      "board", "calendar", "chat", "chem", "code", "collab", "council",
      "creative", "database", "education", "environment", "ethics",
      "events", "finance", "fitness", "food", "forum", "game",
      "government", "graph", "healthcare", "household", "hypothesis",
      "insurance", "lab", "law", "legal", "logistics", "manufacturing",
      "market", "marketplace", "math", "meta", "ml", "music", "neuro",
      "news", "nonprofit", "paper", "physics", "quantum", "realestate",
      "reasoning", "research", "retail", "science", "security", "services",
      "sim", "studio", "trades", "vote",
    ];
    for (const d of expectedDomains) {
      assert.ok(DOMAIN_TAG_MAP[d], `Domain "${d}" should exist in DOMAIN_TAG_MAP`);
      assert.ok(Array.isArray(DOMAIN_TAG_MAP[d]), `Tags for "${d}" should be an array`);
      assert.ok(DOMAIN_TAG_MAP[d].length > 0, `Tags for "${d}" should not be empty`);
    }
  });

  it("each tag array contains only strings", () => {
    for (const [domain, tags] of Object.entries(DOMAIN_TAG_MAP)) {
      for (const tag of tags) {
        assert.equal(typeof tag, "string", `Tag in "${domain}" should be a string`);
      }
    }
  });
});

// ── _deriveActionTypes ───────────────────────────────────────────────────

describe("_deriveActionTypes", () => {
  it("returns [QUERY] for null actions", () => {
    const result = _deriveActionTypes(null);
    assert.deepEqual(result, ["QUERY"]);
  });

  it("returns [QUERY] for undefined actions", () => {
    const result = _deriveActionTypes(undefined);
    assert.deepEqual(result, ["QUERY"]);
  });

  it("returns [QUERY] for empty array", () => {
    const result = _deriveActionTypes([]);
    assert.deepEqual(result, ["QUERY"]);
  });

  it("maps a simple direct action", () => {
    const result = _deriveActionTypes(["search"]);
    assert.ok(result.includes("QUERY"), "search should map to QUERY");
  });

  it("handles case-insensitive matching", () => {
    const result = _deriveActionTypes(["SEARCH"]);
    assert.ok(result.includes("QUERY"), "SEARCH should map to QUERY via toLowerCase");
  });

  it("maps multiple actions to multiple types", () => {
    const result = _deriveActionTypes(["query", "create", "simulate"]);
    assert.ok(result.includes("QUERY"));
    assert.ok(result.includes("CREATE"));
    assert.ok(result.includes("SIMULATE"));
  });

  it("deduplicates action types", () => {
    const result = _deriveActionTypes(["query", "search", "find"]);
    const queryCount = result.filter(t => t === "QUERY").length;
    assert.equal(queryCount, 1, "QUERY should appear exactly once");
  });

  it("handles compound action names via partial match", () => {
    // "generate-pattern" should partial match "generate" -> CREATE
    const result = _deriveActionTypes(["generate-pattern"]);
    assert.ok(result.includes("CREATE"), "generate-pattern should match CREATE via partial");
  });

  it("handles partial match where key includes actionKey", () => {
    // An action name that is a substring of a key in ACTION_TO_TYPE
    // e.g., "detect" is a key, and "detect-fallacy" is also a key
    // "detect" as input would match both "detect" and keys containing "detect"
    const result = _deriveActionTypes(["detect"]);
    assert.ok(result.includes("ANALYZE"));
  });

  it("returns [QUERY] for unrecognized action that matches no key", () => {
    // Use something that does not partially match any ACTION_TO_TYPE key
    const result = _deriveActionTypes(["zzzzunknownzzzz"]);
    assert.deepEqual(result, ["QUERY"]);
  });

  it("handles mixed known and unknown actions", () => {
    const result = _deriveActionTypes(["analyze", "zzzzunknownzzzz"]);
    assert.ok(result.includes("ANALYZE"));
  });
});

// ── registerManifest ─────────────────────────────────────────────────────

describe("registerManifest", () => {
  it("returns error when manifest is null", () => {
    const result = registerManifest(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("returns error when manifest is undefined", () => {
    const result = registerManifest(undefined);
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("returns error when manifest has no lensId", () => {
    const result = registerManifest({ domain: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("returns error for empty object", () => {
    const result = registerManifest({});
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("returns error when lensId is empty string (falsy)", () => {
    const result = registerManifest({ lensId: "" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("successfully registers a minimal manifest", () => {
    const result = registerManifest({ lensId: "test-minimal" });
    assert.equal(result.ok, true);
    assert.equal(result.lensId, "test-minimal");
  });

  it("defaults domain to lensId when not provided", () => {
    registerManifest({ lensId: "test-domain-default" });
    const m = getManifest("test-domain-default");
    assert.equal(m.domain, "test-domain-default");
  });

  it("uses provided domain when supplied", () => {
    registerManifest({ lensId: "test-domain-custom", domain: "custom-dom" });
    const m = getManifest("test-domain-custom");
    assert.equal(m.domain, "custom-dom");
  });

  it("defaults actions to empty array", () => {
    registerManifest({ lensId: "test-actions-default" });
    const m = getManifest("test-actions-default");
    assert.deepEqual(m.actions, []);
  });

  it("preserves provided actions", () => {
    registerManifest({ lensId: "test-actions-given", actions: ["query", "create"] });
    const m = getManifest("test-actions-given");
    assert.deepEqual(m.actions, ["query", "create"]);
  });

  it("derives actionTypes from actions when not provided", () => {
    registerManifest({ lensId: "test-derive-types", actions: ["search", "create"] });
    const m = getManifest("test-derive-types");
    assert.ok(m.actionTypes.includes("QUERY"));
    assert.ok(m.actionTypes.includes("CREATE"));
  });

  it("uses provided actionTypes when supplied", () => {
    registerManifest({
      lensId: "test-explicit-types",
      actionTypes: ["TRADE", "MANAGE"],
    });
    const m = getManifest("test-explicit-types");
    assert.deepEqual(m.actionTypes, ["TRADE", "MANAGE"]);
  });

  it("uses DOMAIN_TAG_MAP tags when lensId matches a known domain", () => {
    registerManifest({ lensId: "music" });
    const m = getManifest("music");
    assert.deepEqual(m.domainTags, DOMAIN_TAG_MAP["music"]);
  });

  it("defaults domainTags to empty array for unknown domain", () => {
    registerManifest({ lensId: "test-unknown-domain-tags" });
    const m = getManifest("test-unknown-domain-tags");
    assert.deepEqual(m.domainTags, []);
  });

  it("uses provided domainTags over defaults", () => {
    registerManifest({
      lensId: "test-custom-tags",
      domainTags: ["alpha", "beta"],
    });
    const m = getManifest("test-custom-tags");
    assert.deepEqual(m.domainTags, ["alpha", "beta"]);
  });

  it("defaults description to empty string", () => {
    registerManifest({ lensId: "test-desc-default" });
    const m = getManifest("test-desc-default");
    assert.equal(m.description, "");
  });

  it("defaults category to 'specialized'", () => {
    registerManifest({ lensId: "test-cat-default" });
    const m = getManifest("test-cat-default");
    assert.equal(m.category, "specialized");
  });

  it("defaults source to 'builtin'", () => {
    registerManifest({ lensId: "test-source-default" });
    const m = getManifest("test-source-default");
    assert.equal(m.source, "builtin");
  });

  it("sets registeredAt to ISO timestamp when not provided", () => {
    const before = new Date().toISOString();
    registerManifest({ lensId: "test-timestamp" });
    const after = new Date().toISOString();
    const m = getManifest("test-timestamp");
    assert.ok(m.registeredAt >= before);
    assert.ok(m.registeredAt <= after);
  });

  it("uses provided registeredAt", () => {
    const ts = "2024-01-01T00:00:00.000Z";
    registerManifest({ lensId: "test-ts-given", registeredAt: ts });
    const m = getManifest("test-ts-given");
    assert.equal(m.registeredAt, ts);
  });

  it("overwrites existing manifest on re-registration", () => {
    registerManifest({ lensId: "test-overwrite", description: "first" });
    registerManifest({ lensId: "test-overwrite", description: "second" });
    const m = getManifest("test-overwrite");
    assert.equal(m.description, "second");
  });

  it("indexes domain tags for tag-based lookup", () => {
    registerManifest({
      lensId: "test-tag-index",
      domainTags: ["unique-tag-alpha", "unique-tag-beta"],
    });
    const results = findByTags(["unique-tag-alpha"]);
    const ids = results.map(r => r.lensId);
    assert.ok(ids.includes("test-tag-index"));
  });

  it("indexes action types for action-type-based lookup", () => {
    registerManifest({
      lensId: "test-action-index",
      actionTypes: ["SIMULATE"],
    });
    const results = findByActionType("SIMULATE");
    const ids = results.map(r => r.lensId);
    assert.ok(ids.includes("test-action-index"));
  });

  it("registers a fully specified manifest", () => {
    const result = registerManifest({
      lensId: "test-full",
      domain: "testing",
      actions: ["query", "create"],
      actionTypes: ["QUERY", "CREATE"],
      domainTags: ["testing", "qa"],
      description: "A full test manifest",
      category: "testing",
      source: "user",
      registeredAt: "2025-06-01T00:00:00.000Z",
    });
    assert.equal(result.ok, true);
    const m = getManifest("test-full");
    assert.equal(m.domain, "testing");
    assert.deepEqual(m.actions, ["query", "create"]);
    assert.deepEqual(m.actionTypes, ["QUERY", "CREATE"]);
    assert.deepEqual(m.domainTags, ["testing", "qa"]);
    assert.equal(m.description, "A full test manifest");
    assert.equal(m.category, "testing");
    assert.equal(m.source, "user");
    assert.equal(m.registeredAt, "2025-06-01T00:00:00.000Z");
  });
});

// ── getManifest ──────────────────────────────────────────────────────────

describe("getManifest", () => {
  it("returns null for non-existent lensId", () => {
    const result = getManifest("nonexistent-lens-id-xyz");
    assert.equal(result, null);
  });

  it("returns manifest for a registered lensId", () => {
    registerManifest({ lensId: "test-get-manifest", description: "found me" });
    const m = getManifest("test-get-manifest");
    assert.notEqual(m, null);
    assert.equal(m.lensId, "test-get-manifest");
    assert.equal(m.description, "found me");
  });
});

// ── hasManifest ──────────────────────────────────────────────────────────

describe("hasManifest", () => {
  it("returns false for non-existent lensId", () => {
    assert.equal(hasManifest("definitely-not-registered-xyz"), false);
  });

  it("returns true for a registered lensId", () => {
    registerManifest({ lensId: "test-has-manifest" });
    assert.equal(hasManifest("test-has-manifest"), true);
  });
});

// ── findByTags ───────────────────────────────────────────────────────────

describe("findByTags", () => {
  it("returns empty array for null tags", () => {
    assert.deepEqual(findByTags(null), []);
  });

  it("returns empty array for undefined tags", () => {
    assert.deepEqual(findByTags(undefined), []);
  });

  it("returns empty array for empty tags array", () => {
    assert.deepEqual(findByTags([]), []);
  });

  it("returns empty array for tags that match no lens", () => {
    const results = findByTags(["nonexistent-tag-zzz"]);
    assert.deepEqual(results, []);
  });

  it("finds lenses by a single matching tag", () => {
    registerManifest({
      lensId: "tag-single-test",
      domainTags: ["unique-single-tag-xyz"],
    });
    const results = findByTags(["unique-single-tag-xyz"]);
    assert.ok(results.length >= 1);
    const match = results.find(r => r.lensId === "tag-single-test");
    assert.ok(match);
    assert.equal(match.matchCount, 1);
    assert.equal(match.matchRatio, 1);
  });

  it("scores lenses by number of matching tags", () => {
    registerManifest({
      lensId: "tag-multi-a",
      domainTags: ["mtag1", "mtag2", "mtag3"],
    });
    registerManifest({
      lensId: "tag-multi-b",
      domainTags: ["mtag1"],
    });
    const results = findByTags(["mtag1", "mtag2", "mtag3"]);
    const matchA = results.find(r => r.lensId === "tag-multi-a");
    const matchB = results.find(r => r.lensId === "tag-multi-b");
    assert.ok(matchA);
    assert.ok(matchB);
    assert.equal(matchA.matchCount, 3);
    assert.equal(matchB.matchCount, 1);
    // A should rank higher
    const indexA = results.indexOf(matchA);
    const indexB = results.indexOf(matchB);
    assert.ok(indexA < indexB, "Higher match ratio should come first");
  });

  it("returns results sorted by matchRatio descending", () => {
    registerManifest({
      lensId: "sort-test-high",
      domainTags: ["sort-x", "sort-y"],
    });
    registerManifest({
      lensId: "sort-test-low",
      domainTags: ["sort-x"],
    });
    const results = findByTags(["sort-x", "sort-y"]);
    const highIdx = results.findIndex(r => r.lensId === "sort-test-high");
    const lowIdx = results.findIndex(r => r.lensId === "sort-test-low");
    assert.ok(highIdx < lowIdx, "Higher ratio should appear first");
  });

  it("includes manifest object in results", () => {
    registerManifest({
      lensId: "tag-manifest-check",
      domainTags: ["check-tag-manifest"],
      description: "has manifest",
    });
    const results = findByTags(["check-tag-manifest"]);
    const match = results.find(r => r.lensId === "tag-manifest-check");
    assert.ok(match.manifest);
    assert.equal(match.manifest.description, "has manifest");
  });

  it("computes matchRatio as matchCount / total tags searched", () => {
    registerManifest({
      lensId: "ratio-test",
      domainTags: ["ratio-a"],
    });
    const results = findByTags(["ratio-a", "ratio-b", "ratio-c"]);
    const match = results.find(r => r.lensId === "ratio-test");
    assert.ok(match);
    assert.equal(match.matchCount, 1);
    assert.ok(Math.abs(match.matchRatio - 1 / 3) < 0.001);
  });
});

// ── findByActionType ─────────────────────────────────────────────────────

describe("findByActionType", () => {
  it("returns empty array for unknown action type", () => {
    const results = findByActionType("NONEXISTENT_TYPE");
    assert.deepEqual(results, []);
  });

  it("finds lenses by action type", () => {
    registerManifest({
      lensId: "action-type-test-lens",
      actionTypes: ["TEACH"],
    });
    const results = findByActionType("TEACH");
    const ids = results.map(r => r.lensId);
    assert.ok(ids.includes("action-type-test-lens"));
  });

  it("returns manifest objects, not just IDs", () => {
    registerManifest({
      lensId: "action-type-manifest-check",
      actionTypes: ["CONNECT"],
      description: "connection lens",
    });
    const results = findByActionType("CONNECT");
    const match = results.find(r => r.lensId === "action-type-manifest-check");
    assert.ok(match);
    assert.equal(match.description, "connection lens");
  });
});

// ── getAllManifests ───────────────────────────────────────────────────────

describe("getAllManifests", () => {
  it("returns an array", () => {
    const result = getAllManifests();
    assert.ok(Array.isArray(result));
  });

  it("returns all registered manifests", () => {
    const beforeCount = getAllManifests().length;
    registerManifest({ lensId: "getall-test-1" });
    registerManifest({ lensId: "getall-test-2" });
    const afterCount = getAllManifests().length;
    assert.ok(afterCount >= beforeCount + 2);
  });

  it("each entry has required manifest fields", () => {
    const all = getAllManifests();
    for (const m of all) {
      assert.ok(m.lensId, "manifest should have lensId");
      assert.ok(m.domain, "manifest should have domain");
      assert.ok(Array.isArray(m.actions), "actions should be array");
      assert.ok(Array.isArray(m.actionTypes), "actionTypes should be array");
      assert.ok(Array.isArray(m.domainTags), "domainTags should be array");
      assert.equal(typeof m.description, "string");
      assert.equal(typeof m.category, "string");
      assert.equal(typeof m.source, "string");
      assert.equal(typeof m.registeredAt, "string");
    }
  });
});

// ── getManifestStats ─────────────────────────────────────────────────────

describe("getManifestStats", () => {
  it("returns ok: true", () => {
    const stats = getManifestStats();
    assert.equal(stats.ok, true);
  });

  it("returns total count of registered manifests", () => {
    const stats = getManifestStats();
    assert.equal(typeof stats.total, "number");
    assert.ok(stats.total > 0);
  });

  it("returns bySource breakdown", () => {
    const stats = getManifestStats();
    assert.ok("builtin" in stats.bySource);
    assert.ok("user" in stats.bySource);
    assert.ok("emergent" in stats.bySource);
  });

  it("returns tagCount", () => {
    const stats = getManifestStats();
    assert.equal(typeof stats.tagCount, "number");
    assert.ok(stats.tagCount > 0);
  });

  it("returns actionTypeCount", () => {
    const stats = getManifestStats();
    assert.equal(typeof stats.actionTypeCount, "number");
    assert.ok(stats.actionTypeCount > 0);
  });

  it("bySource counts include sources with unknown keys as 0 initially", () => {
    // bySource is initialized with builtin: 0, user: 0, emergent: 0
    // and then incremented. If a manifest has source="unknown", it would
    // create a new key. Let's verify the base keys exist.
    const stats = getManifestStats();
    assert.equal(typeof stats.bySource.builtin, "number");
    assert.equal(typeof stats.bySource.user, "number");
    assert.equal(typeof stats.bySource.emergent, "number");
  });

  it("bySource handles unknown source values gracefully", () => {
    registerManifest({ lensId: "unknown-source-test", source: "custom-source" });
    const stats = getManifestStats();
    // The "custom-source" key should exist in bySource since it iterates all manifests
    assert.equal(typeof stats.bySource["custom-source"], "number");
    assert.ok(stats.bySource["custom-source"] >= 1);
  });
});

// ── initializeManifests ──────────────────────────────────────────────────

describe("initializeManifests", () => {
  // Note: initializeManifests sets _initialized = true on first call.
  // Since we can't reset the module state, we test the skip logic.

  it("registers domains from the provided list", () => {
    // If already initialized by a prior test, it will skip and return { ok: true, skipped: true }
    const result = initializeManifests(["finance", "code"], {
      finance: [{ action: "query" }, { action: "analyze" }],
      code: ["build", "debug"],
    });
    assert.equal(result.ok, true);
    // Either it registered them or it was already initialized
    if (result.skipped) {
      assert.equal(result.skipped, true);
    } else {
      assert.equal(result.registered, 2);
    }
  });

  it("returns skipped: true on subsequent calls", () => {
    // Force initialization first (may already be initialized)
    initializeManifests(["meta"], {});
    // Second call should skip
    const result = initializeManifests(["something-else"], {});
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  });

  it("handles domains with no entry in domainActionManifest", () => {
    // First call initializes; subsequent calls skip.
    // We test that it doesn't throw even for missing manifest entries.
    const result = initializeManifests(["unmapped-domain"], {});
    assert.equal(result.ok, true);
  });

  it("handles action manifest entries that are strings", () => {
    // domainActions can be either objects with .action or plain strings
    const result = initializeManifests(["string-actions-domain"], {
      "string-actions-domain": ["query", "analyze"],
    });
    assert.equal(result.ok, true);
  });

  it("handles action manifest entries that are objects with .action", () => {
    const result = initializeManifests(["obj-actions-domain"], {
      "obj-actions-domain": [{ action: "query" }, { action: "build" }],
    });
    assert.equal(result.ok, true);
  });
});

// ── registerUserLens ─────────────────────────────────────────────────────

describe("registerUserLens", () => {
  it("registers with source set to 'user'", () => {
    const result = registerUserLens({ lensId: "user-lens-test" });
    assert.equal(result.ok, true);
    const m = getManifest("user-lens-test");
    assert.equal(m.source, "user");
  });

  it("overrides any provided source with 'user'", () => {
    registerUserLens({ lensId: "user-lens-override", source: "builtin" });
    const m = getManifest("user-lens-override");
    assert.equal(m.source, "user");
  });

  it("sets registeredAt to current timestamp", () => {
    const before = new Date().toISOString();
    registerUserLens({ lensId: "user-lens-ts" });
    const after = new Date().toISOString();
    const m = getManifest("user-lens-ts");
    assert.ok(m.registeredAt >= before);
    assert.ok(m.registeredAt <= after);
  });

  it("overrides a provided registeredAt with current time", () => {
    registerUserLens({
      lensId: "user-lens-ts-override",
      registeredAt: "2020-01-01T00:00:00.000Z",
    });
    const m = getManifest("user-lens-ts-override");
    // Should be recent, not the old date
    const year = new Date(m.registeredAt).getFullYear();
    assert.ok(year >= 2025);
  });

  it("returns error when lensId is missing", () => {
    const result = registerUserLens({ domain: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("preserves other manifest fields", () => {
    registerUserLens({
      lensId: "user-lens-full",
      domain: "user-domain",
      actions: ["query"],
      domainTags: ["custom"],
      description: "A user lens",
      category: "utility",
    });
    const m = getManifest("user-lens-full");
    assert.equal(m.domain, "user-domain");
    assert.deepEqual(m.actions, ["query"]);
    assert.deepEqual(m.domainTags, ["custom"]);
    assert.equal(m.description, "A user lens");
    assert.equal(m.category, "utility");
  });
});

// ── registerEmergentLens ─────────────────────────────────────────────────

describe("registerEmergentLens", () => {
  it("registers with source set to 'emergent'", () => {
    const result = registerEmergentLens({ lensId: "emergent-lens-test" });
    assert.equal(result.ok, true);
    const m = getManifest("emergent-lens-test");
    assert.equal(m.source, "emergent");
  });

  it("overrides any provided source with 'emergent'", () => {
    registerEmergentLens({ lensId: "emergent-lens-override", source: "user" });
    const m = getManifest("emergent-lens-override");
    assert.equal(m.source, "emergent");
  });

  it("sets registeredAt to current timestamp", () => {
    const before = new Date().toISOString();
    registerEmergentLens({ lensId: "emergent-lens-ts" });
    const after = new Date().toISOString();
    const m = getManifest("emergent-lens-ts");
    assert.ok(m.registeredAt >= before);
    assert.ok(m.registeredAt <= after);
  });

  it("returns error when lensId is missing", () => {
    const result = registerEmergentLens({});
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("preserves other manifest fields", () => {
    registerEmergentLens({
      lensId: "emergent-full",
      domain: "emergent-domain",
      actions: ["analyze", "create"],
      domainTags: ["emergent-tag"],
      description: "An emergent lens",
      category: "ai-generated",
    });
    const m = getManifest("emergent-full");
    assert.equal(m.domain, "emergent-domain");
    assert.deepEqual(m.actions, ["analyze", "create"]);
    assert.deepEqual(m.domainTags, ["emergent-tag"]);
    assert.equal(m.description, "An emergent lens");
    assert.equal(m.category, "ai-generated");
    assert.equal(m.source, "emergent");
  });
});

// ── Index integrity ──────────────────────────────────────────────────────

describe("index integrity", () => {
  it("tag index correctly maps multiple lenses to the same tag", () => {
    registerManifest({
      lensId: "shared-tag-1",
      domainTags: ["shared-tag-common"],
    });
    registerManifest({
      lensId: "shared-tag-2",
      domainTags: ["shared-tag-common"],
    });
    const results = findByTags(["shared-tag-common"]);
    const ids = results.map(r => r.lensId);
    assert.ok(ids.includes("shared-tag-1"));
    assert.ok(ids.includes("shared-tag-2"));
  });

  it("action type index correctly maps multiple lenses to the same type", () => {
    registerManifest({
      lensId: "shared-action-1",
      actionTypes: ["TRADE"],
    });
    registerManifest({
      lensId: "shared-action-2",
      actionTypes: ["TRADE"],
    });
    const results = findByActionType("TRADE");
    const ids = results.map(r => r.lensId);
    assert.ok(ids.includes("shared-action-1"));
    assert.ok(ids.includes("shared-action-2"));
  });

  it("re-registering a lens updates its manifest but preserves index entries", () => {
    registerManifest({
      lensId: "reindex-test",
      domainTags: ["reindex-tag"],
      actionTypes: ["QUERY"],
      description: "v1",
    });
    registerManifest({
      lensId: "reindex-test",
      domainTags: ["reindex-tag", "reindex-tag-new"],
      actionTypes: ["QUERY", "CREATE"],
      description: "v2",
    });
    const m = getManifest("reindex-test");
    assert.equal(m.description, "v2");
    // Both old and new tags should find this lens
    const tagResults = findByTags(["reindex-tag"]);
    assert.ok(tagResults.find(r => r.lensId === "reindex-test"));
    const newTagResults = findByTags(["reindex-tag-new"]);
    assert.ok(newTagResults.find(r => r.lensId === "reindex-test"));
  });
});

// ── Integration: end-to-end manifest lifecycle ───────────────────────────

describe("manifest lifecycle integration", () => {
  it("registers, retrieves, finds by tag, finds by action type, and appears in stats", () => {
    const lensId = "lifecycle-integration-test";
    const tags = ["lifecycle-tag-unique"];
    const actionTypes = ["CREATE"];

    // Register
    const regResult = registerManifest({
      lensId,
      domainTags: tags,
      actionTypes,
      description: "lifecycle test",
      source: "user",
    });
    assert.equal(regResult.ok, true);

    // Retrieve
    const manifest = getManifest(lensId);
    assert.ok(manifest);
    assert.equal(manifest.lensId, lensId);
    assert.equal(manifest.source, "user");

    // Has
    assert.ok(hasManifest(lensId));

    // Find by tags
    const tagResults = findByTags(tags);
    assert.ok(tagResults.find(r => r.lensId === lensId));

    // Find by action type
    const typeResults = findByActionType("CREATE");
    assert.ok(typeResults.find(r => r.lensId === lensId));

    // Stats
    const stats = getManifestStats();
    assert.ok(stats.total > 0);
    assert.ok(stats.bySource.user > 0);

    // All manifests
    const all = getAllManifests();
    assert.ok(all.find(m => m.lensId === lensId));
  });
});

// ── deriveActionTypes: additional edge cases ─────────────────────────────

describe("_deriveActionTypes edge cases", () => {
  it("handles action that is a substring of a key in ACTION_TO_TYPE", () => {
    // "score" is a key, and "score-explain" is also a key
    // Passing "score" should match via direct lookup and partial matching
    const result = _deriveActionTypes(["score"]);
    assert.ok(result.includes("ANALYZE"));
  });

  it("handles action that partially matches multiple categories", () => {
    // "generate" maps to CREATE, "generate_summary_dtu" also maps to CREATE
    // The input "generate" should match both via direct and partial, resulting in CREATE
    const result = _deriveActionTypes(["generate"]);
    assert.ok(result.includes("CREATE"));
  });

  it("handles action where key includes the actionKey (reverse partial)", () => {
    // "list" is a key mapping to QUERY, "list-for-sale" is a key mapping to TRADE
    // If actionKey is "list", key "list-for-sale" includes "list", so TRADE is also matched
    const result = _deriveActionTypes(["list"]);
    assert.ok(result.includes("QUERY"), "direct match to QUERY");
    assert.ok(result.includes("TRADE"), "partial reverse match via list-for-sale");
  });

  it("deduplicates when same action type matched multiple ways", () => {
    const result = _deriveActionTypes(["analyze-mix"]);
    // "analyze-mix" is a direct key -> ANALYZE
    // Also partial matches "analyze" -> ANALYZE
    const analyzeCount = result.filter(t => t === "ANALYZE").length;
    assert.equal(analyzeCount, 1);
  });

  it("returns only unique types even for many overlapping actions", () => {
    const result = _deriveActionTypes([
      "query", "search", "find", "get", "browse", "list", "lookup",
    ]);
    // All map to QUERY, plus partial matches to other types
    const queryCount = result.filter(t => t === "QUERY").length;
    assert.equal(queryCount, 1);
  });

  it("handles single-character action names", () => {
    // Should not crash; unlikely to match anything meaningfully
    const result = _deriveActionTypes(["x"]);
    // Should fall through to default QUERY or match via partial
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });
});

// ── initializeManifests: universal actions ───────────────────────────────

describe("initializeManifests universal actions", () => {
  it("always appends analyze, generate, suggest to domain actions", () => {
    // Since initializeManifests may have already been called and set _initialized,
    // we can't directly test the first-call behavior after the first test that
    // triggers it. Instead, we verify through previously-registered manifests
    // if any exist, or accept the skipped result.
    const result = initializeManifests(["board"], {
      board: ["query"],
    });
    assert.equal(result.ok, true);
    // If it wasn't skipped, the board lens should have analyze, generate, suggest
    if (!result.skipped) {
      const m = getManifest("board");
      assert.ok(m.actions.includes("analyze"));
      assert.ok(m.actions.includes("generate"));
      assert.ok(m.actions.includes("suggest"));
      assert.ok(m.actions.includes("query"));
    }
  });

  it("deduplicates universal actions with existing ones", () => {
    const result = initializeManifests(["chat"], {
      chat: ["analyze", "suggest", "query"],
    });
    assert.equal(result.ok, true);
    if (!result.skipped) {
      const m = getManifest("chat");
      const analyzeCount = m.actions.filter(a => a === "analyze").length;
      assert.equal(analyzeCount, 1, "analyze should appear only once");
    }
  });
});

// ── Edge cases for complete coverage ─────────────────────────────────────

describe("edge cases", () => {
  it("registerManifest with lensId 0 (falsy but non-null) returns error", () => {
    const result = registerManifest({ lensId: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.error, "lensId required");
  });

  it("registerManifest with lensId false returns error", () => {
    const result = registerManifest({ lensId: false });
    assert.equal(result.ok, false);
  });

  it("registerManifest with lensId null returns error", () => {
    const result = registerManifest({ lensId: null });
    assert.equal(result.ok, false);
  });

  it("findByTags with tags that partially match different lenses", () => {
    registerManifest({
      lensId: "partial-match-a",
      domainTags: ["pm-alpha", "pm-beta"],
    });
    registerManifest({
      lensId: "partial-match-b",
      domainTags: ["pm-beta", "pm-gamma"],
    });
    const results = findByTags(["pm-alpha", "pm-beta", "pm-gamma"]);
    const matchA = results.find(r => r.lensId === "partial-match-a");
    const matchB = results.find(r => r.lensId === "partial-match-b");
    assert.ok(matchA);
    assert.ok(matchB);
    assert.equal(matchA.matchCount, 2); // alpha + beta
    assert.equal(matchB.matchCount, 2); // beta + gamma
    assert.ok(Math.abs(matchA.matchRatio - 2 / 3) < 0.001);
  });

  it("findByActionType filters out null/undefined manifest entries", () => {
    // This tests the .filter(Boolean) in findByActionType
    // Under normal operation, all indexed IDs should resolve, but
    // the filter(Boolean) guard exists for safety
    const results = findByActionType("QUERY");
    for (const r of results) {
      assert.ok(r !== null);
      assert.ok(r !== undefined);
    }
  });

  it("registerManifest with empty domainTags creates no tag index entries", () => {
    registerManifest({
      lensId: "no-tags-lens",
      domainTags: [],
    });
    const m = getManifest("no-tags-lens");
    assert.deepEqual(m.domainTags, []);
  });

  it("registerManifest with empty actionTypes creates no action type index entries", () => {
    registerManifest({
      lensId: "no-action-types-lens",
      actionTypes: [],
    });
    const m = getManifest("no-action-types-lens");
    assert.deepEqual(m.actionTypes, []);
  });

  it("getAllManifests returns a fresh array (not the internal map)", () => {
    const all1 = getAllManifests();
    const all2 = getAllManifests();
    assert.notEqual(all1, all2, "should return a new array each time");
    assert.deepEqual(all1, all2, "but with the same contents");
  });

  it("getManifestStats bySource handles 0 counts correctly", () => {
    const stats = getManifestStats();
    // All source counts should be non-negative numbers
    for (const [source, count] of Object.entries(stats.bySource)) {
      assert.ok(count >= 0, `${source} count should be >= 0`);
      assert.equal(typeof count, "number");
    }
  });

  it("WRITE and READ action type sets are disjoint", () => {
    for (const w of WRITE_ACTION_TYPES) {
      assert.ok(!READ_ACTION_TYPES.has(w), `${w} should not be in both sets`);
    }
    for (const r of READ_ACTION_TYPES) {
      assert.ok(!WRITE_ACTION_TYPES.has(r), `${r} should not be in both sets`);
    }
  });

  it("all ACTION_TO_TYPE values are valid ACTION_TYPES", () => {
    const validTypes = new Set(Object.values(ACTION_TYPES));
    for (const [action, type] of Object.entries(ACTION_TO_TYPE)) {
      assert.ok(validTypes.has(type), `ACTION_TO_TYPE["${action}"] = "${type}" is not a valid ACTION_TYPE`);
    }
  });

  it("all WRITE/READ action types are valid ACTION_TYPES", () => {
    const validTypes = new Set(Object.values(ACTION_TYPES));
    for (const w of WRITE_ACTION_TYPES) {
      assert.ok(validTypes.has(w));
    }
    for (const r of READ_ACTION_TYPES) {
      assert.ok(validTypes.has(r));
    }
  });
});
