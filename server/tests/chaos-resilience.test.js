/**
 * Chaos / Fault Injection Resilience Tests — Tier 3
 * Run: node --test tests/chaos-resilience.test.js
 *
 * Self-contained tests that validate resilience under adversarial and
 * degraded conditions. No running server required — every scenario is
 * simulated in-process using only Node.js stdlib primitives.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a unique temp directory that is cleaned up automatically. */
function makeTmpDir(prefix = 'chaos-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Remove a directory tree, swallowing errors. */
function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// ============= 1. Crash-during-write simulation ============================

describe('Crash-during-write simulation', () => {
  let tmpDir;

  before(() => { tmpDir = makeTmpDir('crash-write-'); });
  after(() => { rmrf(tmpDir); });

  it('original file survives when process crashes before atomic rename', () => {
    const originalPath = path.join(tmpDir, 'data.json');
    const originalPayload = JSON.stringify({ version: 1, intact: true });
    fs.writeFileSync(originalPath, originalPayload, 'utf8');

    // Simulate the safe-write pattern: write to a temp file, then rename.
    // A "crash" occurs after the temp write but BEFORE the rename.
    const tempPath = path.join(tmpDir, 'data.json.tmp');
    const newPayload = JSON.stringify({ version: 2, intact: false });
    fs.writeFileSync(tempPath, newPayload, 'utf8');

    // --- crash happens here (rename never executes) ---

    // Verify the original file is completely untouched.
    const surviving = fs.readFileSync(originalPath, 'utf8');
    assert.strictEqual(surviving, originalPayload, 'Original file must be byte-identical');

    // The dangling temp file should exist but the system can clean it up on recovery.
    assert.ok(fs.existsSync(tempPath), 'Temp file lingers as expected after crash');
  });

  it('atomic rename replaces the original in a single operation', () => {
    const originalPath = path.join(tmpDir, 'state.json');
    const v1 = JSON.stringify({ v: 1 });
    const v2 = JSON.stringify({ v: 2 });

    fs.writeFileSync(originalPath, v1, 'utf8');

    const tempPath = path.join(tmpDir, 'state.json.tmp');
    fs.writeFileSync(tempPath, v2, 'utf8');

    // The rename is atomic on POSIX — either it happens or it does not.
    fs.renameSync(tempPath, originalPath);

    const result = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    assert.strictEqual(result.v, 2, 'File should now reflect v2 after successful rename');
    assert.ok(!fs.existsSync(tempPath), 'Temp file should be gone after rename');
  });

  it('partial write to temp file does not corrupt original', () => {
    const originalPath = path.join(tmpDir, 'partial.json');
    const original = JSON.stringify({ complete: true, data: 'safe' });
    fs.writeFileSync(originalPath, original, 'utf8');

    // Simulate a partial / truncated write (e.g. disk-full or kill -9 mid-write).
    const tempPath = path.join(tmpDir, 'partial.json.tmp');
    const truncated = '{"complete": false, "data": "corru';
    fs.writeFileSync(tempPath, truncated, 'utf8');

    // Recovery: detect the temp file is invalid JSON, discard it, keep original.
    let recovered;
    try {
      JSON.parse(fs.readFileSync(tempPath, 'utf8'));
      recovered = tempPath; // would only happen if temp is valid
    } catch {
      recovered = originalPath; // temp is corrupt — fall back to original
    }

    const data = JSON.parse(fs.readFileSync(recovered, 'utf8'));
    assert.strictEqual(data.complete, true, 'Recovery should yield the intact original');
    assert.strictEqual(data.data, 'safe');
  });
});

// ============= 2. Clock skew handling ======================================

describe('Clock skew handling', () => {
  /**
   * Simulate a device clock that is offset from "true" time.
   * Returns a function () => number that behaves like Date.now() but shifted.
   */
  function skewedClock(offsetMs) {
    return () => Date.now() + offsetMs;
  }

  it('detects forward clock skew of +5 minutes on a remote device', () => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const deviceA = skewedClock(0);
    const deviceB = skewedClock(FIVE_MINUTES);

    const tsA = deviceA();
    const tsB = deviceB();

    const drift = tsB - tsA;
    assert.ok(drift >= FIVE_MINUTES - 50 && drift <= FIVE_MINUTES + 50,
      `Drift should be ~5 min, got ${drift}ms`);
  });

  it('detects backward clock skew of -2 hours on a remote device', () => {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const deviceA = skewedClock(0);
    const deviceB = skewedClock(-TWO_HOURS);

    const tsA = deviceA();
    const tsB = deviceB();

    const drift = tsA - tsB;
    assert.ok(drift >= TWO_HOURS - 50 && drift <= TWO_HOURS + 50,
      `Backward drift should be ~2 hrs, got ${drift}ms`);
  });

  it('normalizes timestamps using a shared epoch offset', () => {
    const OFFSET_A = 3 * 60 * 1000;   // +3 min
    const OFFSET_B = -7 * 60 * 1000;  // -7 min
    const clockA = skewedClock(OFFSET_A);
    const clockB = skewedClock(OFFSET_B);

    // Each device records an event at "now" according to its own clock.
    const rawA = clockA();
    const rawB = clockB();

    // Normalization: subtract each device's known offset to get canonical time.
    const normalizedA = rawA - OFFSET_A;
    const normalizedB = rawB - OFFSET_B;

    // After normalization the two timestamps should be within a tight tolerance
    // (only wall-clock execution jitter, not skew).
    const diff = Math.abs(normalizedA - normalizedB);
    assert.ok(diff < 100, `Normalized timestamps should be <100ms apart, got ${diff}ms`);
  });

  it('correctly orders events despite opposing clock skews', () => {
    const OFFSET_A = 10 * 60 * 1000;  // +10 min (fast)
    const OFFSET_B = -10 * 60 * 1000; // -10 min (slow)

    // Device A creates event first, then device B 50ms later.
    const rawA = Date.now() + OFFSET_A;
    const rawB = Date.now() + 50 + OFFSET_B;

    // Without normalization, B appears to be 20 min before A — wrong order.
    assert.ok(rawB < rawA, 'Raw timestamps show wrong order due to skew');

    // After normalization, A should precede B.
    const normA = rawA - OFFSET_A;
    const normB = rawB - OFFSET_B;
    assert.ok(normA <= normB, 'Normalized order should be A before B');
  });
});

// ============= 3. Duplicate submission flood ===============================

describe('Duplicate submission flood', () => {
  /**
   * Minimal idempotency store.
   * Maps an idempotency key to its cached response.
   */
  class IdempotencyStore {
    constructor() { this._seen = new Map(); }

    /** Process a request. Returns { response, deduplicated }. */
    process(idempotencyKey, handler) {
      if (this._seen.has(idempotencyKey)) {
        return { response: this._seen.get(idempotencyKey), deduplicated: true };
      }
      const response = handler();
      this._seen.set(idempotencyKey, response);
      return { response, deduplicated: false };
    }

    get size() { return this._seen.size; }
  }

  it('deduplicates 100 rapid identical requests returning the same response', () => {
    const store = new IdempotencyStore();
    const key = crypto.randomUUID();
    let handlerCalls = 0;

    const handler = () => {
      handlerCalls++;
      return { id: crypto.randomUUID(), status: 'created', ts: Date.now() };
    };

    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(store.process(key, handler));
    }

    assert.strictEqual(handlerCalls, 1, 'Handler should execute exactly once');
    assert.strictEqual(store.size, 1, 'Store should contain exactly one entry');

    // Every result must reference the exact same response object.
    const firstResponse = results[0].response;
    for (let i = 1; i < results.length; i++) {
      assert.strictEqual(results[i].response, firstResponse,
        `Result ${i} must be the same cached response`);
      assert.strictEqual(results[i].deduplicated, true);
    }

    assert.strictEqual(results[0].deduplicated, false, 'First call is not a duplicate');
  });

  it('processes distinct keys independently', () => {
    const store = new IdempotencyStore();
    let calls = 0;

    for (let i = 0; i < 50; i++) {
      store.process(`key-${i}`, () => { calls++; return { i }; });
    }

    assert.strictEqual(calls, 50, 'Each unique key should invoke its handler');
    assert.strictEqual(store.size, 50, 'Store should hold 50 entries');
  });

  it('returns identical response shape on duplicate vs original', () => {
    const store = new IdempotencyStore();
    const key = 'shape-test';
    const handler = () => ({ ok: true, value: 42 });

    const original = store.process(key, handler);
    const duplicate = store.process(key, handler);

    assert.deepStrictEqual(original.response, duplicate.response,
      'Response payloads must be deep-equal');
  });
});

// ============= 4. Circuit breaker state machine ============================

describe('Circuit breaker state machine', () => {
  /**
   * Minimal circuit breaker implementation.
   *
   * States: CLOSED  -> request flows through
   *         OPEN    -> requests are blocked (fast-fail)
   *         HALF_OPEN -> one probe request allowed to test recovery
   */
  class CircuitBreaker {
    static CLOSED = 'CLOSED';
    static OPEN = 'OPEN';
    static HALF_OPEN = 'HALF_OPEN';

    constructor({ failureThreshold = 3, resetTimeoutMs = 500 } = {}) {
      this.state = CircuitBreaker.CLOSED;
      this.failureCount = 0;
      this.failureThreshold = failureThreshold;
      this.resetTimeoutMs = resetTimeoutMs;
      this.openedAt = null;
    }

    /** Attempt to execute `fn`. Returns { ok, value?, error? }. */
    async execute(fn) {
      if (this.state === CircuitBreaker.OPEN) {
        // Check if enough time has elapsed to transition to HALF_OPEN.
        if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
          this.state = CircuitBreaker.HALF_OPEN;
        } else {
          return { ok: false, error: 'circuit open', blocked: true };
        }
      }

      try {
        const value = await fn();
        this._onSuccess();
        return { ok: true, value, blocked: false };
      } catch (err) {
        this._onFailure();
        return { ok: false, error: err.message, blocked: false };
      }
    }

    _onSuccess() {
      this.failureCount = 0;
      this.state = CircuitBreaker.CLOSED;
    }

    _onFailure() {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitBreaker.OPEN;
        this.openedAt = Date.now();
      }
    }
  }

  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    assert.strictEqual(cb.state, CircuitBreaker.CLOSED);
  });

  it('transitions CLOSED -> OPEN after N consecutive failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 200 });
    const fail = () => { throw new Error('boom'); };

    for (let i = 0; i < 3; i++) {
      await cb.execute(fail);
    }
    assert.strictEqual(cb.state, CircuitBreaker.OPEN, 'Should be OPEN after 3 failures');
  });

  it('blocks requests while in OPEN state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000 });
    const fail = () => { throw new Error('boom'); };

    await cb.execute(fail);
    await cb.execute(fail);
    assert.strictEqual(cb.state, CircuitBreaker.OPEN);

    const result = await cb.execute(() => 'should not run');
    assert.strictEqual(result.blocked, true, 'Request must be blocked');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'circuit open');
  });

  it('transitions OPEN -> HALF_OPEN after resetTimeout elapses', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await cb.execute(() => { throw new Error('fail'); });
    assert.strictEqual(cb.state, CircuitBreaker.OPEN);

    // Wait for the reset timeout to elapse.
    await new Promise(r => { setTimeout(r, 80); });

    // The next execute call should detect elapsed time and move to HALF_OPEN,
    // then run the probe.
    const result = await cb.execute(() => 'recovered');
    assert.strictEqual(result.ok, true, 'Probe should succeed');
    assert.strictEqual(result.value, 'recovered');
    assert.strictEqual(cb.state, CircuitBreaker.CLOSED, 'Should transition back to CLOSED on success');
  });

  it('transitions HALF_OPEN -> OPEN again if probe fails', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await cb.execute(() => { throw new Error('initial'); });
    assert.strictEqual(cb.state, CircuitBreaker.OPEN);

    await new Promise(r => { setTimeout(r, 80); });

    // Probe fails.
    const result = await cb.execute(() => { throw new Error('still broken'); });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(cb.state, CircuitBreaker.OPEN, 'Should re-open on failed probe');
  });

  it('full lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60 });

    // Phase 1: CLOSED, everything works.
    let r = await cb.execute(() => 'ok');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(cb.state, CircuitBreaker.CLOSED);

    // Phase 2: Failures trip the breaker.
    await cb.execute(() => { throw new Error('f1'); });
    await cb.execute(() => { throw new Error('f2'); });
    assert.strictEqual(cb.state, CircuitBreaker.OPEN);

    // Phase 3: Requests are blocked.
    r = await cb.execute(() => 'nope');
    assert.strictEqual(r.blocked, true);

    // Phase 4: Wait for half-open window.
    await new Promise(res => { setTimeout(res, 80); });

    // Phase 5: Successful probe closes the breaker.
    r = await cb.execute(() => 'healed');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, 'healed');
    assert.strictEqual(cb.state, CircuitBreaker.CLOSED);

    // Phase 6: Normal operation resumes.
    r = await cb.execute(() => 'business as usual');
    assert.strictEqual(r.ok, true);
  });
});

// ============= 5. Event ordering under reorder =============================

describe('Event ordering under reorder (Socket.io simulation)', () => {
  /**
   * A sequence filter that only passes through events whose sequence number
   * is strictly greater than the last accepted sequence number, dropping
   * anything stale or duplicate.
   */
  class SequenceFilter {
    constructor() {
      this.lastSeq = 0;
      this.accepted = [];
      this.dropped = [];
    }

    receive(event) {
      if (event.seq > this.lastSeq) {
        this.lastSeq = event.seq;
        this.accepted.push(event);
        return true;
      }
      this.dropped.push(event);
      return false;
    }
  }

  it('correctly drops stale events when receiving seq 1,3,2,5,4', () => {
    const filter = new SequenceFilter();

    const events = [
      { seq: 1, data: 'a' },
      { seq: 3, data: 'c' },
      { seq: 2, data: 'b' },  // stale — 2 < lastSeq(3)
      { seq: 5, data: 'e' },
      { seq: 4, data: 'd' },  // stale — 4 < lastSeq(5)
    ];

    const results = events.map(e => filter.receive(e));

    assert.deepStrictEqual(results, [true, true, false, true, false],
      'Events 2 and 4 should be dropped');

    assert.strictEqual(filter.accepted.length, 3, 'Three events accepted');
    assert.deepStrictEqual(
      filter.accepted.map(e => e.seq),
      [1, 3, 5],
      'Accepted sequence should be 1, 3, 5'
    );

    assert.strictEqual(filter.dropped.length, 2, 'Two events dropped');
    assert.deepStrictEqual(
      filter.dropped.map(e => e.seq),
      [2, 4],
      'Dropped sequence should be 2, 4'
    );
  });

  it('accepts all events when they arrive in perfect order', () => {
    const filter = new SequenceFilter();

    for (let seq = 1; seq <= 10; seq++) {
      assert.ok(filter.receive({ seq, data: `event-${seq}` }),
        `seq ${seq} should be accepted`);
    }

    assert.strictEqual(filter.accepted.length, 10);
    assert.strictEqual(filter.dropped.length, 0);
  });

  it('drops duplicate sequence numbers', () => {
    const filter = new SequenceFilter();

    filter.receive({ seq: 1, data: 'first' });
    const dup = filter.receive({ seq: 1, data: 'duplicate' });

    assert.strictEqual(dup, false, 'Duplicate seq should be dropped');
    assert.strictEqual(filter.accepted.length, 1);
  });

  it('handles large bursts with random reordering', () => {
    const filter = new SequenceFilter();

    // Generate 200 events and shuffle them.
    const ordered = Array.from({ length: 200 }, (_, i) => ({
      seq: i + 1,
      data: `event-${i + 1}`,
    }));

    // Fisher-Yates shuffle (deterministic seed not needed — we verify invariants).
    const shuffled = [...ordered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffled.forEach(e => filter.receive(e));

    // The accepted list must be strictly increasing.
    for (let i = 1; i < filter.accepted.length; i++) {
      assert.ok(filter.accepted[i].seq > filter.accepted[i - 1].seq,
        'Accepted events must have strictly increasing seq numbers');
    }

    // Total = accepted + dropped.
    assert.strictEqual(filter.accepted.length + filter.dropped.length, 200);
  });
});

// ============= 6. Index corruption recovery ================================

describe('Index corruption recovery', () => {
  /**
   * Simulates a data store (Map of id -> record) and a separate index
   * (Set of ids). The index can reference stale / non-existent IDs, and
   * the store can contain entries missing from the index.
   */
  function reconcile(dataStore, index) {
    const storeIds = new Set(dataStore.keys());
    const indexIds = new Set(index);

    const danglingInIndex = [...indexIds].filter(id => !storeIds.has(id));
    const missingFromIndex = [...storeIds].filter(id => !indexIds.has(id));

    // Fix: remove dangling refs, add missing ones.
    for (const id of danglingInIndex) index.delete(id);
    for (const id of missingFromIndex) index.add(id);

    return { danglingInIndex, missingFromIndex };
  }

  it('removes index entries that reference non-existent data', () => {
    const store = new Map([
      ['id-1', { title: 'A' }],
      ['id-2', { title: 'B' }],
    ]);
    const index = new Set(['id-1', 'id-2', 'id-GHOST', 'id-PHANTOM']);

    const { danglingInIndex } = reconcile(store, index);

    assert.deepStrictEqual(danglingInIndex.sort(), ['id-GHOST', 'id-PHANTOM']);
    assert.strictEqual(index.size, 2, 'Index should only contain real IDs');
    assert.ok(!index.has('id-GHOST'));
    assert.ok(!index.has('id-PHANTOM'));
  });

  it('adds data entries missing from the index', () => {
    const store = new Map([
      ['id-1', { title: 'A' }],
      ['id-2', { title: 'B' }],
      ['id-3', { title: 'C' }],
    ]);
    const index = new Set(['id-1']);

    const { missingFromIndex } = reconcile(store, index);

    assert.ok(missingFromIndex.includes('id-2'));
    assert.ok(missingFromIndex.includes('id-3'));
    assert.strictEqual(index.size, 3, 'Index should now have all 3 IDs');
  });

  it('handles a fully corrupt index (all entries are ghosts)', () => {
    const store = new Map([
      ['real-1', { v: 1 }],
    ]);
    const index = new Set(['ghost-a', 'ghost-b', 'ghost-c']);

    reconcile(store, index);

    assert.strictEqual(index.size, 1);
    assert.ok(index.has('real-1'), 'Index should contain only the real entry');
    assert.ok(!index.has('ghost-a'));
  });

  it('handles an empty store against a populated index', () => {
    const store = new Map();
    const index = new Set(['orphan-1', 'orphan-2']);

    reconcile(store, index);

    assert.strictEqual(index.size, 0, 'Index should be empty when store is empty');
  });

  it('is a no-op when index and store are already consistent', () => {
    const store = new Map([['a', {}], ['b', {}]]);
    const index = new Set(['a', 'b']);

    const { danglingInIndex, missingFromIndex } = reconcile(store, index);

    assert.strictEqual(danglingInIndex.length, 0);
    assert.strictEqual(missingFromIndex.length, 0);
    assert.strictEqual(index.size, 2);
  });
});

// ============= 7. Replay attack simulation =================================

describe('Replay attack simulation', () => {
  /**
   * Operation nonce tracker with TTL-based cleanup.
   */
  class NonceTracker {
    constructor(ttlMs = 1000) {
      this.ttlMs = ttlMs;
      this._seen = new Map(); // nonce -> timestamp
    }

    /** Returns true if the nonce is fresh (first use), false if replayed. */
    tryAccept(nonce) {
      this._purgeExpired();
      if (this._seen.has(nonce)) return false;
      this._seen.set(nonce, Date.now());
      return true;
    }

    /** Remove entries older than TTL. */
    _purgeExpired() {
      const cutoff = Date.now() - this.ttlMs;
      for (const [nonce, ts] of this._seen) {
        if (ts < cutoff) this._seen.delete(nonce);
      }
    }

    get size() { return this._seen.size; }
  }

  it('accepts a fresh operation ID', () => {
    const tracker = new NonceTracker();
    const nonce = crypto.randomUUID();
    assert.strictEqual(tracker.tryAccept(nonce), true);
  });

  it('rejects a replayed operation ID', () => {
    const tracker = new NonceTracker();
    const nonce = crypto.randomUUID();

    tracker.tryAccept(nonce);
    assert.strictEqual(tracker.tryAccept(nonce), false, 'Replay must be rejected');
  });

  it('rejects replays even under rapid repeated attempts', () => {
    const tracker = new NonceTracker();
    const nonce = crypto.randomUUID();

    tracker.tryAccept(nonce);
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(tracker.tryAccept(nonce), false,
        `Attempt ${i + 1} must be rejected`);
    }
  });

  it('cleans up nonces older than TTL', async () => {
    const tracker = new NonceTracker(100); // 100ms TTL

    // Insert 20 nonces.
    for (let i = 0; i < 20; i++) {
      tracker.tryAccept(`op-${i}`);
    }
    assert.strictEqual(tracker.size, 20);

    // Wait for TTL to expire.
    await new Promise(r => { setTimeout(r, 150); });

    // Next tryAccept triggers purge.
    tracker.tryAccept('trigger-purge');
    assert.strictEqual(tracker.size, 1,
      'Only the fresh nonce should remain after purge');
  });

  it('allows the same nonce to be reused after TTL expiry', async () => {
    const tracker = new NonceTracker(80);
    const nonce = 'reusable';

    assert.strictEqual(tracker.tryAccept(nonce), true, 'First use accepted');
    assert.strictEqual(tracker.tryAccept(nonce), false, 'Replay rejected');

    await new Promise(r => { setTimeout(r, 120); });

    // After TTL the nonce should have been purged, so it is fresh again.
    assert.strictEqual(tracker.tryAccept(nonce), true,
      'Nonce should be accepted again after TTL expiry');
  });
});

// ============= 8. Budget exhaustion ========================================

describe('Budget exhaustion', () => {
  /**
   * Token budget tracker with a sliding window.
   */
  class TokenBudget {
    constructor({ limit, windowMs }) {
      this.limit = limit;
      this.windowMs = windowMs;
      this.consumed = 0;
      this.windowStart = Date.now();
    }

    /** Try to consume `tokens`. Returns true if allowed, false if over budget. */
    tryConsume(tokens) {
      this._maybeResetWindow();
      if (this.consumed + tokens > this.limit) return false;
      this.consumed += tokens;
      return true;
    }

    /** Returns remaining tokens in the current window. */
    remaining() {
      this._maybeResetWindow();
      return Math.max(0, this.limit - this.consumed);
    }

    /** Reset the window if it has elapsed. */
    _maybeResetWindow() {
      if (Date.now() - this.windowStart >= this.windowMs) {
        this.consumed = 0;
        this.windowStart = Date.now();
      }
    }
  }

  it('allows requests within the budget', () => {
    const budget = new TokenBudget({ limit: 1000, windowMs: 60_000 });

    assert.strictEqual(budget.tryConsume(200), true);
    assert.strictEqual(budget.tryConsume(300), true);
    assert.strictEqual(budget.remaining(), 500);
  });

  it('blocks requests once the budget is exhausted', () => {
    const budget = new TokenBudget({ limit: 500, windowMs: 60_000 });

    assert.strictEqual(budget.tryConsume(400), true);
    assert.strictEqual(budget.tryConsume(100), true);
    assert.strictEqual(budget.remaining(), 0);

    // This should be blocked.
    assert.strictEqual(budget.tryConsume(1), false, 'Should block when budget is exhausted');
  });

  it('blocks a single request that exceeds the entire budget', () => {
    const budget = new TokenBudget({ limit: 100, windowMs: 60_000 });
    assert.strictEqual(budget.tryConsume(101), false, 'Request larger than budget must be blocked');
    assert.strictEqual(budget.remaining(), 100, 'Budget should remain untouched');
  });

  it('unblocks requests after the window resets', async () => {
    const budget = new TokenBudget({ limit: 100, windowMs: 80 });

    // Exhaust the budget.
    budget.tryConsume(100);
    assert.strictEqual(budget.remaining(), 0);
    assert.strictEqual(budget.tryConsume(1), false);

    // Wait for the window to reset.
    await new Promise(r => { setTimeout(r, 120); });

    assert.strictEqual(budget.tryConsume(50), true, 'Should be allowed after window reset');
    assert.strictEqual(budget.remaining(), 50);
  });

  it('handles rapid consumption approaching the limit', () => {
    const budget = new TokenBudget({ limit: 10_000, windowMs: 60_000 });
    let allowed = 0;
    let blocked = 0;

    // Simulate 200 rapid requests of 75 tokens each (total 15,000 > limit 10,000).
    for (let i = 0; i < 200; i++) {
      if (budget.tryConsume(75)) {
        allowed++;
      } else {
        blocked++;
      }
    }

    // 10000 / 75 = 133.33 -> exactly 133 should be allowed.
    assert.strictEqual(allowed, 133, `Expected 133 allowed requests, got ${allowed}`);
    assert.strictEqual(blocked, 67, `Expected 67 blocked requests, got ${blocked}`);
    assert.strictEqual(allowed + blocked, 200);
    assert.strictEqual(budget.remaining(), 25); // 10000 - (133 * 75) = 25
  });

  it('resets consumed total cleanly at window boundary', async () => {
    const budget = new TokenBudget({ limit: 50, windowMs: 60 });

    budget.tryConsume(50);
    assert.strictEqual(budget.remaining(), 0);

    await new Promise(r => { setTimeout(r, 100); });

    // After window elapses, full budget should be available again.
    assert.strictEqual(budget.remaining(), 50, 'Full budget available after reset');
    assert.strictEqual(budget.tryConsume(50), true);
    assert.strictEqual(budget.remaining(), 0);
  });
});
