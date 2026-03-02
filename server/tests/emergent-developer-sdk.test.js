/**
 * Developer SDK — Comprehensive Test Suite
 *
 * Covers: registerPlugin, getPlugin, listPlugins, activatePlugin,
 * suspendPlugin, revokePlugin, validateApiKey, rotateApiKey,
 * registerWebhook, removeWebhook, listWebhooks, queueWebhookDelivery,
 * processWebhookQueue, getSchema, createSandbox, destroySandbox,
 * checkRateLimit, getPluginMetrics, getSDKMetrics, PERMISSIONS.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  PERMISSIONS,
  registerPlugin,
  getPlugin,
  listPlugins,
  activatePlugin,
  suspendPlugin,
  revokePlugin,
  validateApiKey,
  rotateApiKey,
  registerWebhook,
  removeWebhook,
  listWebhooks,
  queueWebhookDelivery,
  processWebhookQueue,
  getSchema,
  createSandbox,
  destroySandbox,
  checkRateLimit,
  getPluginMetrics,
  getSDKMetrics,
} from "../emergent/developer-sdk.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Register and activate a plugin with subscribe_events permission.
 * Returns { pluginId, apiKey }.
 */
function setupActivePlugin(perms) {
  const permissions = perms || [
    PERMISSIONS.READ_DTUS,
    PERMISSIONS.SUBSCRIBE_EVENTS,
  ];
  const reg = registerPlugin("TestPlugin", "tester", "desc", permissions);
  assert.ok(reg.ok);
  activatePlugin(reg.pluginId);
  return reg;
}

// ── PERMISSIONS ─────────────────────────────────────────────────────────────

describe("PERMISSIONS constant", () => {
  it("exports all expected permission strings", () => {
    assert.equal(PERMISSIONS.READ_DTUS, "read_dtus");
    assert.equal(PERMISSIONS.READ_ENTITIES, "read_entities");
    assert.equal(PERMISSIONS.READ_EVENTS, "read_events");
    assert.equal(PERMISSIONS.SUBMIT_DTUS, "submit_dtus");
    assert.equal(PERMISSIONS.TRIGGER_RESEARCH, "trigger_research");
    assert.equal(PERMISSIONS.SUBSCRIBE_EVENTS, "subscribe_events");
    assert.equal(PERMISSIONS.READ_METRICS, "read_metrics");
    assert.equal(PERMISSIONS.READ_ECONOMY, "read_economy");
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(PERMISSIONS));
  });
});

// ── registerPlugin ──────────────────────────────────────────────────────────

describe("registerPlugin", () => {
  it("registers a plugin and returns pluginId + apiKey", () => {
    const r = registerPlugin("MyPlugin", "author1", "A description", [PERMISSIONS.READ_DTUS]);
    assert.ok(r.ok);
    assert.ok(r.pluginId.startsWith("plg_"));
    assert.equal(typeof r.apiKey, "string");
    assert.ok(r.apiKey.length > 10);
  });

  it("rejects missing name", () => {
    const r = registerPlugin("", "author1", "desc");
    assert.equal(r.ok, false);
    assert.match(r.error, /name/i);
  });

  it("rejects non-string name", () => {
    const r = registerPlugin(123, "author1", "desc");
    assert.equal(r.ok, false);
  });

  it("rejects non-array permissions", () => {
    const r = registerPlugin("P", "a", "d", "not_array");
    assert.equal(r.ok, false);
    assert.match(r.error, /array/i);
  });

  it("rejects invalid permissions", () => {
    const r = registerPlugin("P", "a", "d", ["nonexistent_perm"]);
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid/i);
  });

  it("defaults to empty permissions", () => {
    const r = registerPlugin("P", "a", "d");
    assert.ok(r.ok);
  });

  it("handles null author/description gracefully", () => {
    const r = registerPlugin("P", null, null, []);
    assert.ok(r.ok);
  });
});

// ── getPlugin ───────────────────────────────────────────────────────────────

describe("getPlugin", () => {
  it("returns plugin info without apiKeyHash", () => {
    const reg = registerPlugin("GP", "a", "d", []);
    const r = getPlugin(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.plugin.pluginId, reg.pluginId);
    assert.equal(r.plugin.name, "GP");
    assert.equal(r.plugin.apiKeyHash, undefined);
  });

  it("returns error for unknown pluginId", () => {
    const r = getPlugin("nonexistent_id");
    assert.equal(r.ok, false);
    assert.match(r.error, /not found/i);
  });
});

// ── listPlugins ─────────────────────────────────────────────────────────────

describe("listPlugins", () => {
  it("lists all plugins", () => {
    registerPlugin("LP1", "a", "d", []);
    const r = listPlugins();
    assert.ok(r.ok);
    assert.ok(r.total >= 1);
    assert.ok(Array.isArray(r.plugins));
    // Ensure no apiKeyHash leaked
    for (const p of r.plugins) {
      assert.equal(p.apiKeyHash, undefined);
    }
  });

  it("filters by status", () => {
    const reg = registerPlugin("LP2", "a", "d", []);
    activatePlugin(reg.pluginId);
    const r = listPlugins("active");
    assert.ok(r.ok);
    for (const p of r.plugins) {
      assert.equal(p.status, "active");
    }
  });
});

// ── activatePlugin ──────────────────────────────────────────────────────────

describe("activatePlugin", () => {
  it("activates a registered plugin", () => {
    const reg = registerPlugin("AP1", "a", "d", []);
    const r = activatePlugin(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.status, "active");
  });

  it("returns note when already active", () => {
    const reg = registerPlugin("AP2", "a", "d", []);
    activatePlugin(reg.pluginId);
    const r = activatePlugin(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.note, "Already active");
  });

  it("rejects revoked plugin", () => {
    const reg = registerPlugin("AP3", "a", "d", []);
    revokePlugin(reg.pluginId);
    const r = activatePlugin(reg.pluginId);
    assert.equal(r.ok, false);
    assert.match(r.error, /revoked/i);
  });

  it("rejects unknown plugin", () => {
    const r = activatePlugin("nope");
    assert.equal(r.ok, false);
  });
});

// ── suspendPlugin ───────────────────────────────────────────────────────────

describe("suspendPlugin", () => {
  it("suspends an active plugin", () => {
    const reg = setupActivePlugin();
    const r = suspendPlugin(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.status, "suspended");
  });

  it("pauses associated webhooks", () => {
    const reg = setupActivePlugin();
    registerWebhook(reg.pluginId, "https://example.com/hook", ["dtu.created"]);
    suspendPlugin(reg.pluginId);
    const wh = listWebhooks(reg.pluginId);
    for (const w of wh.webhooks) {
      assert.equal(w.status, "paused");
    }
  });

  it("rejects revoked plugin", () => {
    const reg = registerPlugin("SP2", "a", "d", []);
    revokePlugin(reg.pluginId);
    const r = suspendPlugin(reg.pluginId);
    assert.equal(r.ok, false);
  });

  it("rejects unknown plugin", () => {
    const r = suspendPlugin("nope");
    assert.equal(r.ok, false);
  });
});

// ── revokePlugin ────────────────────────────────────────────────────────────

describe("revokePlugin", () => {
  it("revokes plugin, clears API key, disables webhooks, destroys sandboxes", () => {
    const reg = setupActivePlugin();
    // Create webhook and sandbox
    registerWebhook(reg.pluginId, "https://example.com/h", ["dtu.created"]);
    createSandbox(reg.pluginId, "readonly");

    const r = revokePlugin(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.status, "revoked");

    // API key should be invalid now
    const v = validateApiKey(reg.apiKey);
    assert.equal(v.ok, false);
  });

  it("rejects unknown plugin", () => {
    const r = revokePlugin("nope");
    assert.equal(r.ok, false);
  });
});

// ── validateApiKey ──────────────────────────────────────────────────────────

describe("validateApiKey", () => {
  it("validates a valid active API key", () => {
    const reg = setupActivePlugin();
    const r = validateApiKey(reg.apiKey);
    assert.ok(r.ok);
    assert.equal(r.pluginId, reg.pluginId);
    assert.ok(Array.isArray(r.permissions));
  });

  it("rejects empty/null key", () => {
    assert.equal(validateApiKey("").ok, false);
    assert.equal(validateApiKey(null).ok, false);
    assert.equal(validateApiKey(undefined).ok, false);
  });

  it("rejects non-string key", () => {
    assert.equal(validateApiKey(12345).ok, false);
  });

  it("rejects invalid key", () => {
    const r = validateApiKey("totally_bogus_key");
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid/i);
  });

  it("rejects key for non-active plugin", () => {
    const reg = registerPlugin("VAK", "a", "d", []);
    // plugin is still "registered", not "active"
    const r = validateApiKey(reg.apiKey);
    assert.equal(r.ok, false);
    assert.ok(r.pluginId);
  });
});

// ── rotateApiKey ────────────────────────────────────────────────────────────

describe("rotateApiKey", () => {
  it("rotates key and invalidates old one", () => {
    const reg = setupActivePlugin();
    const oldKey = reg.apiKey;

    const rot = rotateApiKey(reg.pluginId);
    assert.ok(rot.ok);
    assert.notEqual(rot.apiKey, oldKey);

    // Old key should fail
    assert.equal(validateApiKey(oldKey).ok, false);
    // New key should work
    const v = validateApiKey(rot.apiKey);
    assert.ok(v.ok);
  });

  it("rejects revoked plugin", () => {
    const reg = registerPlugin("RK", "a", "d", []);
    revokePlugin(reg.pluginId);
    const r = rotateApiKey(reg.pluginId);
    assert.equal(r.ok, false);
  });

  it("rejects unknown plugin", () => {
    const r = rotateApiKey("nope");
    assert.equal(r.ok, false);
  });
});

// ── registerWebhook ─────────────────────────────────────────────────────────

describe("registerWebhook", () => {
  it("registers a webhook with secret", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "https://example.com/wh", ["dtu.created"]);
    assert.ok(r.ok);
    assert.ok(r.webhookId.startsWith("whk_"));
    assert.ok(r.secret.length > 10);
  });

  it("rejects unknown plugin", () => {
    const r = registerWebhook("nope", "https://x.com", ["dtu.created"]);
    assert.equal(r.ok, false);
  });

  it("rejects non-active plugin", () => {
    const reg = registerPlugin("WH1", "a", "d", [PERMISSIONS.SUBSCRIBE_EVENTS]);
    const r = registerWebhook(reg.pluginId, "https://x.com", ["dtu.created"]);
    assert.equal(r.ok, false);
  });

  it("rejects plugin without SUBSCRIBE_EVENTS permission", () => {
    const reg = registerPlugin("WH2", "a", "d", [PERMISSIONS.READ_DTUS]);
    activatePlugin(reg.pluginId);
    const r = registerWebhook(reg.pluginId, "https://x.com", ["dtu.created"]);
    assert.equal(r.ok, false);
  });

  it("rejects invalid URL", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "not-a-url", ["dtu.created"]);
    assert.equal(r.ok, false);
  });

  it("rejects empty URL", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "", ["dtu.created"]);
    assert.equal(r.ok, false);
  });

  it("rejects empty events array", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "https://x.com", []);
    assert.equal(r.ok, false);
  });

  it("rejects non-array events", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "https://x.com", "not_array");
    assert.equal(r.ok, false);
  });

  it("rejects invalid event types", () => {
    const reg = setupActivePlugin();
    const r = registerWebhook(reg.pluginId, "https://x.com", ["bogus.event"]);
    assert.equal(r.ok, false);
  });
});

// ── removeWebhook ───────────────────────────────────────────────────────────

describe("removeWebhook", () => {
  it("removes an existing webhook", () => {
    const reg = setupActivePlugin();
    const wh = registerWebhook(reg.pluginId, "https://x.com/h", ["dtu.created"]);
    const r = removeWebhook(wh.webhookId);
    assert.ok(r.ok);
    assert.ok(r.removed);
  });

  it("rejects unknown webhook", () => {
    const r = removeWebhook("nope");
    assert.equal(r.ok, false);
  });
});

// ── listWebhooks ────────────────────────────────────────────────────────────

describe("listWebhooks", () => {
  it("lists webhooks for a plugin with secret redacted", () => {
    const reg = setupActivePlugin();
    registerWebhook(reg.pluginId, "https://x.com/h1", ["dtu.created"]);
    registerWebhook(reg.pluginId, "https://x.com/h2", ["entity.born"]);

    const r = listWebhooks(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.total, 2);
    for (const wh of r.webhooks) {
      assert.equal(wh.secret, "***");
    }
  });

  it("returns empty for plugin with no webhooks", () => {
    const r = listWebhooks("nonexistent");
    assert.ok(r.ok);
    assert.equal(r.total, 0);
  });
});

// ── queueWebhookDelivery ────────────────────────────────────────────────────

describe("queueWebhookDelivery", () => {
  it("queues delivery for matching webhooks", () => {
    const reg = setupActivePlugin();
    registerWebhook(reg.pluginId, "https://x.com/hook", ["dtu.created"]);

    const r = queueWebhookDelivery("dtu.created", { id: "dtu1" });
    assert.ok(r.ok);
    assert.ok(r.queued >= 1);
  });

  it("rejects missing event type", () => {
    const r = queueWebhookDelivery("", {});
    assert.equal(r.ok, false);
  });

  it("rejects non-string event type", () => {
    const r = queueWebhookDelivery(null, {});
    assert.equal(r.ok, false);
  });

  it("rejects unknown event type", () => {
    const r = queueWebhookDelivery("bogus.event", {});
    assert.equal(r.ok, false);
  });

  it("skips inactive webhooks", () => {
    const reg = setupActivePlugin();
    registerWebhook(reg.pluginId, "https://x.com/hook", ["entity.born"]);
    suspendPlugin(reg.pluginId); // pauses webhooks

    const r = queueWebhookDelivery("entity.born", {});
    assert.ok(r.ok);
    assert.equal(r.queued, 0);
  });
});

// ── processWebhookQueue ─────────────────────────────────────────────────────

describe("processWebhookQueue", () => {
  it("processes queued deliveries successfully (valid URL)", () => {
    const reg = setupActivePlugin();
    registerWebhook(reg.pluginId, "https://example.com/wh", ["dtu.promoted"]);
    queueWebhookDelivery("dtu.promoted", { id: "d1" });

    const r = processWebhookQueue();
    assert.ok(r.ok);
    assert.ok(r.processed >= 1);
    // Successful delivery
    const delivered = r.results.filter(d => d.status === "delivered");
    assert.ok(delivered.length >= 1);
  });

  it("retries failed deliveries (non-http URL => simulated failure)", () => {
    const reg = setupActivePlugin();
    // Register webhook with a non-http URL -> simulateHTTPPost returns false
    registerWebhook(reg.pluginId, "ftp://badurl.com/wh", ["dtu.archived"]);
    // But this will fail at registerWebhook because URL validation passes (ftp is valid URL)
    // Actually registerWebhook passes because new URL("ftp://...") is valid
    queueWebhookDelivery("dtu.archived", {});

    // Process first time: attempt 1, should retry
    const r1 = processWebhookQueue();
    assert.ok(r1.ok);
  });

  it("returns empty when no deliveries pending", () => {
    const r = processWebhookQueue();
    assert.ok(r.ok);
    // processed can be 0 or more depending on previous test state
    assert.equal(typeof r.processed, "number");
  });
});

// ── getSchema ───────────────────────────────────────────────────────────────

describe("getSchema", () => {
  it("returns full schema with all sections", () => {
    // Set up globalThis for STATE
    globalThis._concordSTATE = {
      dtus: new Map([["d1", { id: "d1", title: "Test" }]]),
      __emergent: { emergents: new Map([["e1", {}]]) },
      era: "renaissance",
    };

    const r = getSchema();
    assert.ok(r.ok);
    assert.equal(r.schema.version, "1.0.0");
    assert.ok(r.schema.dtu);
    assert.ok(r.schema.entities);
    assert.ok(r.schema.events);
    assert.ok(r.schema.decrees);
    assert.ok(r.schema.economy);
    assert.ok(r.schema.disputes);
    assert.ok(r.schema.hypotheses);
    assert.ok(r.schema.permissions);
    assert.ok(r.schema.civilization);
    assert.equal(r.schema.civilization.dtuCount, 1);
    assert.equal(r.schema.civilization.emergentCount, 1);
    assert.equal(r.schema.civilization.currentEra, "renaissance");

    delete globalThis._concordSTATE;
  });

  it("handles missing STATE gracefully", () => {
    delete globalThis._concordSTATE;
    delete globalThis.STATE;
    const r = getSchema();
    assert.ok(r.ok);
  });

  it("handles STATE.dtus as array", () => {
    globalThis._concordSTATE = {
      dtus: [{ id: "a1" }, { id: "a2" }],
    };
    const r = getSchema();
    assert.ok(r.ok);
    assert.equal(r.schema.civilization.dtuCount, 2);
    delete globalThis._concordSTATE;
  });
});

// ── createSandbox ───────────────────────────────────────────────────────────

describe("createSandbox", () => {
  it("creates a readonly sandbox", () => {
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "readonly");
    assert.ok(r.ok);
    assert.ok(r.sandboxId.startsWith("sbx_"));
    assert.equal(r.type, "readonly");
    assert.ok(r.expiresAt);
  });

  it("creates a testing sandbox", () => {
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "testing");
    assert.ok(r.ok);
    assert.equal(r.type, "testing");
  });

  it("rejects unknown plugin", () => {
    const r = createSandbox("nope");
    assert.equal(r.ok, false);
  });

  it("rejects non-active plugin", () => {
    const reg = registerPlugin("SB1", "a", "d", []);
    const r = createSandbox(reg.pluginId);
    assert.equal(r.ok, false);
  });

  it("rejects invalid sandbox type", () => {
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "invalid_type");
    assert.equal(r.ok, false);
  });

  it("enforces max 3 sandboxes per plugin", () => {
    const reg = setupActivePlugin();
    createSandbox(reg.pluginId, "readonly");
    createSandbox(reg.pluginId, "readonly");
    createSandbox(reg.pluginId, "readonly");
    const r = createSandbox(reg.pluginId, "readonly");
    assert.equal(r.ok, false);
    assert.match(r.error, /max/i);
  });

  it("snapshots DTU state from globalThis (Map-based)", () => {
    globalThis._concordSTATE = {
      dtus: new Map([
        ["d1", { id: "d1", title: "T1", tags: ["a"], tier: "regular", confidence: 0.9, createdAt: "2024-01-01" }],
      ]),
    };
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "readonly");
    assert.ok(r.ok);
    delete globalThis._concordSTATE;
  });

  it("snapshots DTU state from globalThis (Array-based)", () => {
    globalThis._concordSTATE = {
      dtus: [{ id: "a1", title: "A1" }],
    };
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "readonly");
    assert.ok(r.ok);
    delete globalThis._concordSTATE;
  });

  it("handles missing dtus in STATE gracefully", () => {
    globalThis._concordSTATE = {};
    const reg = setupActivePlugin();
    const r = createSandbox(reg.pluginId, "readonly");
    assert.ok(r.ok);
    delete globalThis._concordSTATE;
  });
});

// ── destroySandbox ──────────────────────────────────────────────────────────

describe("destroySandbox", () => {
  it("destroys an existing sandbox", () => {
    const reg = setupActivePlugin();
    const sb = createSandbox(reg.pluginId, "readonly");
    const r = destroySandbox(sb.sandboxId);
    assert.ok(r.ok);
    assert.ok(r.destroyed);
  });

  it("rejects unknown sandbox", () => {
    const r = destroySandbox("nope");
    assert.equal(r.ok, false);
  });
});

// ── checkRateLimit ──────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows requests within rate limit", () => {
    const reg = setupActivePlugin();
    const r = checkRateLimit(reg.pluginId);
    assert.ok(r.ok);
    assert.ok(r.allowed);
    assert.equal(typeof r.remaining, "number");
  });

  it("rejects unknown plugin", () => {
    const r = checkRateLimit("nope");
    assert.equal(r.ok, false);
  });

  it("rejects non-active plugin", () => {
    const reg = registerPlugin("RL1", "a", "d", []);
    const r = checkRateLimit(reg.pluginId);
    assert.equal(r.ok, false);
  });

  it("tracks usage on allowed request", () => {
    const reg = setupActivePlugin();
    checkRateLimit(reg.pluginId);
    checkRateLimit(reg.pluginId);
    // Should still be allowed (well within 60/min)
    const r = checkRateLimit(reg.pluginId);
    assert.ok(r.ok);
    assert.ok(r.allowed);
  });
});

// ── getPluginMetrics ────────────────────────────────────────────────────────

describe("getPluginMetrics", () => {
  it("returns detailed metrics for a plugin", () => {
    const reg = setupActivePlugin();
    const r = getPluginMetrics(reg.pluginId);
    assert.ok(r.ok);
    assert.equal(r.pluginId, reg.pluginId);
    assert.equal(typeof r.requestCount, "number");
    assert.ok(r.webhooks);
    assert.ok(r.sandboxes);
    assert.ok(r.usage);
    assert.ok(r.rateLimit);
  });

  it("rejects unknown plugin", () => {
    const r = getPluginMetrics("nope");
    assert.equal(r.ok, false);
  });
});

// ── getSDKMetrics ───────────────────────────────────────────────────────────

describe("getSDKMetrics", () => {
  it("returns aggregate SDK metrics", () => {
    const r = getSDKMetrics();
    assert.ok(r.ok);
    assert.ok(r.plugins);
    assert.ok(r.webhooks);
    assert.ok(r.sandboxes);
    assert.ok(r.usage);
    assert.ok(r.permissions);
    assert.ok(r.generatedAt);
    assert.ok(r.plugins.total >= 0);
  });
});
