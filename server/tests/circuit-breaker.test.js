/**
 * Circuit Breaker Tests
 *
 * Tests the circuit breaker pattern: closed → open → half-open → closed.
 * Verifies graceful degradation for external dependencies.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BREAKER_STATE,
  createCircuitBreaker,
  createBreakerRegistry,
} from "../lib/circuit-breaker.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function succeedFn(val = "ok") {
  return async () => val;
}

function failFn(msg = "boom") {
  return async () => { throw new Error(msg); };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Breaker State Constants
// ═══════════════════════════════════════════════════════════════════════════════

describe("Breaker State Constants", () => {
  it("defines three states", () => {
    assert.equal(BREAKER_STATE.CLOSED, "closed");
    assert.equal(BREAKER_STATE.OPEN, "open");
    assert.equal(BREAKER_STATE.HALF_OPEN, "half_open");
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(BREAKER_STATE));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. createCircuitBreaker — Normal Operation (CLOSED)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — Closed State", () => {
  it("starts in closed state", () => {
    const cb = createCircuitBreaker("test");
    assert.equal(cb.state, "closed");
  });

  it("passes through successful calls", async () => {
    const cb = createCircuitBreaker("test");
    const result = await cb.call(succeedFn("hello"));
    assert.equal(result, "hello");
  });

  it("propagates errors without opening (below threshold)", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 5 });
    for (let i = 0; i < 4; i++) {
      await assert.rejects(() => cb.call(failFn()), { message: "boom" });
    }
    assert.equal(cb.state, "closed");
  });

  it("opens after reaching failure threshold", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => cb.call(failFn()));
    }
    assert.equal(cb.state, "open");
  });

  it("resets failure count on success", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 3 });
    await assert.rejects(() => cb.call(failFn()));
    await assert.rejects(() => cb.call(failFn()));
    await cb.call(succeedFn());
    // Failure count reset — need 3 more to open
    await assert.rejects(() => cb.call(failFn()));
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "closed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. createCircuitBreaker — Open State
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — Open State", () => {
  it("rejects calls immediately when open (no fallback)", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1, cooldownMs: 60_000 });
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "open");
    await assert.rejects(() => cb.call(succeedFn()), { message: /circuit_open/ });
  });

  it("uses fallback when open", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1, cooldownMs: 60_000 });
    await assert.rejects(() => cb.call(failFn()));
    const result = await cb.call(succeedFn(), () => "fallback_value");
    assert.equal(result, "fallback_value");
  });

  it("transitions to half-open after cooldown", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1, cooldownMs: 1 });
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "open");
    await new Promise(r => setTimeout(r, 10));
    // Next call should transition to half-open and attempt the call
    await cb.call(succeedFn());
    // After a success in half-open, may transition to closed (depends on successThreshold)
    assert.ok(cb.state === "half_open" || cb.state === "closed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. createCircuitBreaker — Half-Open State
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — Half-Open State", () => {
  it("closes after enough successes in half-open", async () => {
    const cb = createCircuitBreaker("test", {
      failureThreshold: 1,
      cooldownMs: 1,
      successThreshold: 2,
    });
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "open");
    await new Promise(r => setTimeout(r, 10));
    // First success transitions to half-open
    await cb.call(succeedFn());
    assert.equal(cb.state, "half_open");
    // Second success closes the circuit
    await cb.call(succeedFn());
    assert.equal(cb.state, "closed");
  });

  it("reopens on failure in half-open", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1, cooldownMs: 1 });
    await assert.rejects(() => cb.call(failFn()));
    await new Promise(r => setTimeout(r, 10));
    // Probe fails — should reopen
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "open");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. State Change Callback
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — State Change Callback", () => {
  it("fires onStateChange when transitioning", async () => {
    const transitions = [];
    const cb = createCircuitBreaker("test", {
      failureThreshold: 1,
      onStateChange: (name, from, to) => transitions.push({ name, from, to }),
    });
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].name, "test");
    assert.equal(transitions[0].from, "closed");
    assert.equal(transitions[0].to, "open");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Reset
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — Reset", () => {
  it("manually resets to closed", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1 });
    await assert.rejects(() => cb.call(failFn()));
    assert.equal(cb.state, "open");
    cb.reset();
    assert.equal(cb.state, "closed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Status Reporting
// ═══════════════════════════════════════════════════════════════════════════════

describe("Circuit Breaker — Status", () => {
  it("reports status accurately", async () => {
    const cb = createCircuitBreaker("myService", { failureThreshold: 3 });
    await cb.call(succeedFn());
    await assert.rejects(() => cb.call(failFn()));
    const status = cb.getStatus();
    assert.equal(status.name, "myService");
    assert.equal(status.state, "closed");
    assert.equal(status.totalCalls, 2);
    assert.equal(status.totalFailures, 1);
    assert.equal(status.totalFallbacks, 0);
    assert.ok(status.lastFailureAt);
  });

  it("tracks fallback count", async () => {
    const cb = createCircuitBreaker("test", { failureThreshold: 1, cooldownMs: 60_000 });
    await assert.rejects(() => cb.call(failFn()));
    await cb.call(succeedFn(), () => "fb");
    const status = cb.getStatus();
    assert.equal(status.totalFallbacks, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Breaker Registry
// ═══════════════════════════════════════════════════════════════════════════════

describe("Breaker Registry", () => {
  it("creates pre-configured breakers", () => {
    const reg = createBreakerRegistry();
    assert.ok(reg.ollama);
    assert.ok(reg.openai);
    assert.ok(reg.embeddings);
    assert.ok(reg.persistence);
  });

  it("getAllStatus returns status for all breakers", () => {
    const reg = createBreakerRegistry();
    const all = reg.getAllStatus();
    assert.ok(all.ollama);
    assert.ok(all.openai);
    assert.ok(all.embeddings);
    assert.ok(all.persistence);
    assert.equal(all.ollama.state, "closed");
  });

  it("resetAll resets all breakers", async () => {
    const reg = createBreakerRegistry();
    // Open the ollama breaker
    for (let i = 0; i < 5; i++) {
      try { await reg.ollama.call(failFn()); } catch {}
    }
    assert.equal(reg.ollama.state, "open");
    reg.resetAll();
    assert.equal(reg.ollama.state, "closed");
  });
});
