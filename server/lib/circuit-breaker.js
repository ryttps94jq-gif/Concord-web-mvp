/**
 * Circuit Breaker — Graceful Degradation
 *
 * Wraps external dependencies (Ollama, embeddings, disk I/O) with
 * circuit-breaker logic: closed → open → half-open.
 *
 * When a dependency starts failing, the breaker opens and all calls
 * immediately return the fallback instead of piling up timeouts.
 * After a cool-off period, one probe request tests recovery.
 *
 * States:
 *   CLOSED    — normal operation, failures counted
 *   OPEN      — dependency assumed down, fallback immediately
 *   HALF_OPEN — one probe allowed through; success → CLOSED, fail → OPEN
 */

export const BREAKER_STATE = Object.freeze({
  CLOSED:    "closed",
  OPEN:      "open",
  HALF_OPEN: "half_open",
});

/**
 * Create a circuit breaker.
 *
 * @param {string} name - Human-readable name (e.g., "ollama", "embeddings")
 * @param {Object} opts
 * @param {number} [opts.failureThreshold=5] - Failures before opening
 * @param {number} [opts.cooldownMs=30000] - Ms to wait before half-open probe
 * @param {number} [opts.successThreshold=2] - Successes in half-open before closing
 * @param {Function} [opts.onStateChange] - Callback(name, oldState, newState)
 * @returns {CircuitBreaker}
 */
export function createCircuitBreaker(name, opts = {}) {
  const failureThreshold = opts.failureThreshold || 5;
  const cooldownMs = opts.cooldownMs || 30_000;
  const successThreshold = opts.successThreshold || 2;
  const onStateChange = opts.onStateChange || (() => {});

  let state = BREAKER_STATE.CLOSED;
  let failures = 0;
  let successes = 0;        // consecutive successes in half-open
  let lastFailureAt = 0;
  let openedAt = 0;
  let totalCalls = 0;
  let totalFailures = 0;
  let totalFallbacks = 0;

  function transition(newState) {
    const old = state;
    state = newState;
    if (old !== newState) onStateChange(name, old, newState);
  }

  /**
   * Execute a function through the breaker.
   *
   * @param {Function} fn - The async function to call
   * @param {Function} [fallback] - Fallback function when circuit is open
   * @returns {Promise<*>}
   */
  async function call(fn, fallback) {
    totalCalls++;

    if (state === BREAKER_STATE.OPEN) {
      // Check if cooldown has passed
      if (Date.now() - openedAt >= cooldownMs) {
        transition(BREAKER_STATE.HALF_OPEN);
        successes = 0;
      } else {
        totalFallbacks++;
        if (fallback) return fallback();
        throw new Error(`circuit_open:${name}`);
      }
    }

    try {
      const result = await fn();
      onSuccess();
      return result;
    } catch (err) {
      onFailure();
      if (state === BREAKER_STATE.OPEN && fallback) {
        totalFallbacks++;
        return fallback();
      }
      throw err;
    }
  }

  function onSuccess() {
    if (state === BREAKER_STATE.HALF_OPEN) {
      successes++;
      if (successes >= successThreshold) {
        failures = 0;
        transition(BREAKER_STATE.CLOSED);
      }
    } else {
      failures = 0;
    }
  }

  function onFailure() {
    totalFailures++;
    lastFailureAt = Date.now();
    failures++;

    if (state === BREAKER_STATE.HALF_OPEN) {
      // Probe failed — reopen
      openedAt = Date.now();
      transition(BREAKER_STATE.OPEN);
    } else if (failures >= failureThreshold) {
      openedAt = Date.now();
      transition(BREAKER_STATE.OPEN);
    }
  }

  /**
   * Manually reset the breaker to closed.
   */
  function reset() {
    failures = 0;
    successes = 0;
    transition(BREAKER_STATE.CLOSED);
  }

  /**
   * Get breaker status.
   */
  function getStatus() {
    return {
      name,
      state,
      failures,
      failureThreshold,
      cooldownMs,
      lastFailureAt: lastFailureAt ? new Date(lastFailureAt).toISOString() : null,
      openedAt: openedAt ? new Date(openedAt).toISOString() : null,
      totalCalls,
      totalFailures,
      totalFallbacks,
    };
  }

  return { call, reset, getStatus, get state() { return state; } };
}

// ── Pre-built Breaker Registry ───────────────────────────────────────────────

/**
 * Create a registry of circuit breakers for all external dependencies.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.onStateChange] - Global state change callback
 * @returns {Object} Registry with named breakers
 */
export function createBreakerRegistry(opts = {}) {
  const log = opts.onStateChange || ((name, from, to) => {
    console.warn(`[circuit-breaker] ${name}: ${from} → ${to}`);
  });

  const breakers = {
    ollama: createCircuitBreaker("ollama", {
      failureThreshold: 5,     // GPU: more reliable, higher tolerance
      cooldownMs: 15_000,      // GPU: recover faster
      onStateChange: log,
    }),

    openai: createCircuitBreaker("openai", {
      failureThreshold: 5,
      cooldownMs: 60_000,
      onStateChange: log,
    }),

    embeddings: createCircuitBreaker("embeddings", {
      failureThreshold: 8,     // GPU: embeddings are fast and reliable
      cooldownMs: 30_000,      // GPU: recover faster
      onStateChange: log,
    }),

    persistence: createCircuitBreaker("persistence", {
      failureThreshold: 3,
      cooldownMs: 10_000,
      successThreshold: 1,
      onStateChange: log,
    }),
  };

  function getAllStatus() {
    const result = {};
    for (const [name, breaker] of Object.entries(breakers)) {
      result[name] = breaker.getStatus();
    }
    return result;
  }

  function resetAll() {
    for (const breaker of Object.values(breakers)) {
      breaker.reset();
    }
  }

  return { ...breakers, getAllStatus, resetAll };
}
