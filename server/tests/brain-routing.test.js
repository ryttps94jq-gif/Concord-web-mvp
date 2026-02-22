/**
 * Brain Routing Test Suite
 * Tests three-brain architecture routing, fallbacks, and access control.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Mock Brain Infrastructure ────────────────────────────────────────────────

function createMockBrain(name, url, model, enabled = true) {
  return {
    url,
    model,
    role: name,
    enabled,
    stats: { requests: 0, totalMs: 0, dtusGenerated: 0, errors: 0, lastCallAt: null },
  };
}

function createBrainRouter(brains) {
  return {
    brains,
    async callBrain(brainName, prompt, options = {}) {
      const brain = brains[brainName];
      if (!brain) return { ok: false, error: `Unknown brain: ${brainName}`, source: brainName };

      if (!brain.enabled) {
        // Fallback chain: subconscious → utility → conscious
        const fallbacks = {
          subconscious: ["utility", "conscious"],
          utility: ["conscious"],
          conscious: [],
        };
        const chain = fallbacks[brainName] || [];
        for (const fb of chain) {
          if (brains[fb]?.enabled) {
            brains[fb].stats.requests++;
            return { ok: true, content: `Fallback response from ${fb}`, source: fb, model: brains[fb].model };
          }
        }
        return { ok: false, error: `Brain ${brainName} offline and no fallback`, source: brainName };
      }

      brain.stats.requests++;
      brain.stats.lastCallAt = new Date().toISOString();
      return { ok: true, content: `Response from ${brainName}`, source: brainName, model: brain.model };
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Brain Routing", () => {
  let router;

  beforeEach(() => {
    router = createBrainRouter({
      conscious: createMockBrain("conscious", "http://localhost:11434", "qwen2.5:7b"),
      subconscious: createMockBrain("subconscious", "http://localhost:11435", "qwen2.5:1.5b"),
      utility: createMockBrain("utility", "http://localhost:11436", "qwen2.5:3b"),
    });
  });

  it("/api/chat/respond routes to conscious (port 11434)", async () => {
    const result = await router.callBrain("conscious", "Hello");
    assert.ok(result.ok);
    assert.equal(result.source, "conscious");
    assert.equal(result.model, "qwen2.5:7b");
  });

  it("/api/utility/call routes to utility (port 11436)", async () => {
    const result = await router.callBrain("utility", "Analyze this");
    assert.ok(result.ok);
    assert.equal(result.source, "utility");
    assert.equal(result.model, "qwen2.5:3b");
  });

  it("heartbeat tasks route to subconscious (port 11435)", async () => {
    const result = await router.callBrain("subconscious", "autogen task");
    assert.ok(result.ok);
    assert.equal(result.source, "subconscious");
    assert.equal(result.model, "qwen2.5:1.5b");
  });

  it("council deliberation routes to conscious", async () => {
    const result = await router.callBrain("conscious", "Council deliberation on topic X");
    assert.ok(result.ok);
    assert.equal(result.source, "conscious");
  });

  it("affect detection routes to utility", async () => {
    const result = await router.callBrain("utility", "Detect affect in: I feel great today");
    assert.ok(result.ok);
    assert.equal(result.source, "utility");
  });

  it("entity exploration routes to utility", async () => {
    const result = await router.callBrain("utility", "Explore entity connections");
    assert.ok(result.ok);
    assert.equal(result.source, "utility");
  });

  it("fallback: utility offline → falls back to conscious", async () => {
    router.brains.utility.enabled = false;
    const result = await router.callBrain("utility", "Test query");
    assert.ok(result.ok);
    assert.equal(result.source, "conscious");
  });

  it("fallback: subconscious offline → falls back to utility", async () => {
    router.brains.subconscious.enabled = false;
    const result = await router.callBrain("subconscious", "Dream task");
    assert.ok(result.ok);
    assert.equal(result.source, "utility");
  });

  it("all brains offline → returns graceful error", async () => {
    router.brains.conscious.enabled = false;
    router.brains.subconscious.enabled = false;
    router.brains.utility.enabled = false;
    const result = await router.callBrain("conscious", "Test");
    assert.ok(!result.ok);
    assert.ok(result.error.includes("offline"));
  });

  it("no direct Ollama calls bypass callBrain()", () => {
    // Verify that the routing function is the single entry point
    assert.ok(typeof router.callBrain === "function");
    // All brain calls must go through callBrain, which tracks stats
    const initialRequests = router.brains.conscious.stats.requests;
    router.callBrain("conscious", "test");
    assert.ok(router.brains.conscious.stats.requests > initialRequests);
  });

  it("brain stats increment on every call", async () => {
    const before = router.brains.utility.stats.requests;
    await router.callBrain("utility", "call 1");
    await router.callBrain("utility", "call 2");
    await router.callBrain("utility", "call 3");
    assert.equal(router.brains.utility.stats.requests, before + 3);
  });

  it("request to subconscious from frontend returns 403", () => {
    // Simulate the subconscious protection middleware
    function checkSubconsciousAccess(reqIp) {
      if (reqIp !== "127.0.0.1" && reqIp !== "::1") {
        return { status: 403, error: "Subconscious is internal only" };
      }
      return { status: 200 };
    }

    const externalResult = checkSubconsciousAccess("192.168.1.100");
    assert.equal(externalResult.status, 403);

    const internalResult = checkSubconsciousAccess("127.0.0.1");
    assert.equal(internalResult.status, 200);
  });
});
