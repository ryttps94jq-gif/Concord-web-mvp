/**
 * Emergent Agent Governance — Institutional Memory
 *
 * Stage 5: Meta-memory about what the system itself learned.
 *
 * Not facts about the world — facts about operations:
 *   - "These work types frequently fail"
 *   - "These contradictions reappear"
 *   - "These regions are unstable"
 *   - "These patterns produce hallucinations"
 *
 * This is operational self-knowledge, not domain knowledge.
 * All entries are append-only with timestamps and provenance.
 *
 * Categories:
 *   1. Failure Patterns — recurring failure modes by type, domain, role
 *   2. Recurrence Tracking — contradictions/issues that keep coming back
 *   3. Stability Map — regions of the lattice that are stable vs volatile
 *   4. Quality Observations — what correlates with good/bad outputs
 */

import { getEmergentState } from "./store.js";

// ── Memory Categories ────────────────────────────────────────────────────────

export const MEMORY_CATEGORIES = Object.freeze({
  FAILURE_PATTERN:     "failure_pattern",
  RECURRENCE:          "recurrence",
  STABILITY:           "stability",
  QUALITY_OBSERVATION: "quality_observation",
  OPERATIONAL_INSIGHT: "operational_insight",
});

export const ALL_MEMORY_CATEGORIES = Object.freeze(Object.values(MEMORY_CATEGORIES));

// ── Confidence Levels ────────────────────────────────────────────────────────

export const OBSERVATION_CONFIDENCE = Object.freeze({
  ANECDOTAL:  "anecdotal",    // seen once or twice
  PATTERN:    "pattern",      // seen 3+ times
  CONFIRMED:  "confirmed",   // verified by multiple signals
  SYSTEMIC:   "systemic",    // structural, reproduced consistently
});

// ── Institutional Memory Store ───────────────────────────────────────────────

/**
 * Get or initialize the institutional memory store.
 */
export function getMemoryStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._institutionalMemory) {
    es._institutionalMemory = {
      observations: [],               // all recorded observations (append-only)
      byCategory: new Map(),          // category -> [indices]
      byDomain: new Map(),            // domain -> [indices]
      byTag: new Map(),               // tag -> [indices]

      // Aggregated insights (computed from observations)
      failureRates: new Map(),        // `${workType}:${domain}` -> { total, failed, rate }
      recurrenceMap: new Map(),        // fingerprint -> { count, firstSeen, lastSeen, observation }
      stabilityScores: new Map(),      // domain/region -> { score, volatility, sampleCount }

      // Active advisories (things the system should "remember" during operations)
      advisories: new Map(),           // advisoryId -> Advisory

      metrics: {
        totalObservations: 0,
        totalAdvisories: 0,
        activeAdvisories: 0,
        recurrenceAlerts: 0,
      },
    };
  }
  return es._institutionalMemory;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RECORDING OBSERVATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record an institutional memory observation.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.category - One of MEMORY_CATEGORIES
 * @param {string} opts.summary - Short summary of the observation
 * @param {string} [opts.domain] - Domain this applies to
 * @param {string} [opts.workType] - Work item type this relates to
 * @param {string} [opts.role] - Emergent role this relates to
 * @param {string[]} [opts.tags] - Searchable tags
 * @param {Object} [opts.data] - Structured data (metrics, IDs, counts)
 * @param {string} [opts.confidence] - One of OBSERVATION_CONFIDENCE
 * @param {string} [opts.fingerprint] - For recurrence tracking (same fingerprint = same issue)
 * @returns {{ ok: boolean, observation?: Object, recurrence?: Object }}
 */
export function recordObservation(STATE, opts = {}) {
  const store = getMemoryStore(STATE);

  if (!opts.category || !ALL_MEMORY_CATEGORIES.includes(opts.category)) {
    return { ok: false, error: "invalid_category", allowed: ALL_MEMORY_CATEGORIES };
  }

  if (!opts.summary) {
    return { ok: false, error: "summary_required" };
  }

  const observationId = `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const observation = {
    observationId,
    category: opts.category,
    summary: String(opts.summary).slice(0, 500),
    domain: opts.domain || "*",
    workType: opts.workType || null,
    role: opts.role || null,
    tags: Array.isArray(opts.tags) ? opts.tags.slice(0, 20) : [],
    data: opts.data || {},
    confidence: opts.confidence || OBSERVATION_CONFIDENCE.ANECDOTAL,
    fingerprint: opts.fingerprint || null,
    timestamp: new Date().toISOString(),
  };

  const index = store.observations.length;
  store.observations.push(observation);

  // Update indices
  indexObservation(store, "byCategory", observation.category, index);
  indexObservation(store, "byDomain", observation.domain, index);
  for (const tag of observation.tags) {
    indexObservation(store, "byTag", tag, index);
  }

  store.metrics.totalObservations++;

  // Track recurrence
  let recurrence = null;
  if (observation.fingerprint) {
    recurrence = trackRecurrence(store, observation);
  }

  // Update failure rates for failure patterns
  if (observation.category === MEMORY_CATEGORIES.FAILURE_PATTERN && observation.workType) {
    updateFailureRate(store, observation);
  }

  // Update stability scores
  if (observation.category === MEMORY_CATEGORIES.STABILITY && observation.domain) {
    updateStabilityScore(store, observation);
  }

  return { ok: true, observation, recurrence };
}

/**
 * Record a failure for tracking failure rates.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.workType - Type of work that failed
 * @param {string} [opts.domain] - Domain
 * @param {string} [opts.role] - Role that attempted the work
 * @param {string} opts.reason - Why it failed
 * @param {Object} [opts.context] - Additional context
 * @returns {{ ok: boolean, observation?: Object, failureRate?: Object }}
 */
export function recordFailure(STATE, opts = {}) {
  if (!opts.workType || !opts.reason) {
    return { ok: false, error: "workType_and_reason_required" };
  }

  const result = recordObservation(STATE, {
    category: MEMORY_CATEGORIES.FAILURE_PATTERN,
    summary: `Failure in ${opts.workType}: ${opts.reason}`,
    domain: opts.domain,
    workType: opts.workType,
    role: opts.role,
    tags: ["failure", opts.workType],
    data: { reason: opts.reason, ...opts.context },
    fingerprint: `failure:${opts.workType}:${opts.domain || "*"}:${opts.reason}`,
  });

  if (result.ok) {
    const store = getMemoryStore(STATE);
    const key = `${opts.workType}:${opts.domain || "*"}`;
    const rate = store.failureRates.get(key);
    result.failureRate = rate ? { ...rate } : null;
  }

  return result;
}

/**
 * Record a successful outcome for tracking success rates (inverse of failure).
 */
export function recordSuccess(STATE, opts = {}) {
  if (!opts.workType) {
    return { ok: false, error: "workType_required" };
  }

  const store = getMemoryStore(STATE);
  const key = `${opts.workType}:${opts.domain || "*"}`;

  if (!store.failureRates.has(key)) {
    store.failureRates.set(key, { total: 0, failed: 0, rate: 0 });
  }
  const rate = store.failureRates.get(key);
  rate.total++;
  rate.rate = rate.failed / rate.total;

  return { ok: true, failureRate: { ...rate } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADVISORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an advisory — an active warning the system should consider during operations.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.summary - What the system should know
 * @param {string} [opts.domain] - Domain this applies to
 * @param {string} [opts.severity] - "info" | "warning" | "critical"
 * @param {string[]} [opts.affectedWorkTypes] - Work types this is relevant to
 * @param {string} [opts.recommendation] - What to do about it
 * @param {string} [opts.expiresAt] - When this advisory expires (ISO timestamp)
 * @returns {{ ok: boolean, advisory?: Object }}
 */
export function createAdvisory(STATE, opts = {}) {
  const store = getMemoryStore(STATE);

  if (!opts.summary) return { ok: false, error: "summary_required" };

  const advisoryId = `adv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const advisory = {
    advisoryId,
    summary: String(opts.summary).slice(0, 500),
    domain: opts.domain || "*",
    severity: opts.severity || "info",
    affectedWorkTypes: Array.isArray(opts.affectedWorkTypes) ? opts.affectedWorkTypes : [],
    recommendation: opts.recommendation ? String(opts.recommendation).slice(0, 500) : null,
    active: true,
    createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt || null,
    acknowledgedAt: null,
  };

  store.advisories.set(advisoryId, advisory);
  store.metrics.totalAdvisories++;
  store.metrics.activeAdvisories++;

  return { ok: true, advisory };
}

/**
 * Get active advisories for a given context (domain, work type).
 *
 * @param {Object} STATE - Global server state
 * @param {Object} [context] - { domain, workType }
 * @returns {{ ok: boolean, advisories: Object[] }}
 */
export function getActiveAdvisories(STATE, context = {}) {
  const store = getMemoryStore(STATE);
  const now = new Date().toISOString();
  const results = [];

  for (const advisory of store.advisories.values()) {
    if (!advisory.active) continue;
    if (advisory.expiresAt && advisory.expiresAt < now) {
      advisory.active = false;
      store.metrics.activeAdvisories = Math.max(0, store.metrics.activeAdvisories - 1);
      continue;
    }

    // Filter by context
    if (context.domain && advisory.domain !== "*" && advisory.domain !== context.domain) continue;
    if (context.workType && advisory.affectedWorkTypes.length > 0 &&
        !advisory.affectedWorkTypes.includes(context.workType)) continue;

    results.push(advisory);
  }

  return { ok: true, advisories: results, count: results.length };
}

/**
 * Acknowledge an advisory (mark as seen but keep active).
 */
export function acknowledgeAdvisory(STATE, advisoryId) {
  const store = getMemoryStore(STATE);
  const advisory = store.advisories.get(advisoryId);
  if (!advisory) return { ok: false, error: "not_found" };

  advisory.acknowledgedAt = new Date().toISOString();
  return { ok: true, advisory };
}

/**
 * Dismiss an advisory (deactivate).
 */
export function dismissAdvisory(STATE, advisoryId) {
  const store = getMemoryStore(STATE);
  const advisory = store.advisories.get(advisoryId);
  if (!advisory) return { ok: false, error: "not_found" };

  advisory.active = false;
  store.metrics.activeAdvisories = Math.max(0, store.metrics.activeAdvisories - 1);
  return { ok: true, advisory };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Query observations by category.
 */
export function queryObservations(STATE, filters = {}) {
  const store = getMemoryStore(STATE);
  let results;

  if (filters.category && store.byCategory.has(filters.category)) {
    const indices = store.byCategory.get(filters.category);
    results = indices.map(i => store.observations[i]).filter(Boolean);
  } else if (filters.domain && store.byDomain.has(filters.domain)) {
    const indices = store.byDomain.get(filters.domain);
    results = indices.map(i => store.observations[i]).filter(Boolean);
  } else if (filters.tag && store.byTag.has(filters.tag)) {
    const indices = store.byTag.get(filters.tag);
    results = indices.map(i => store.observations[i]).filter(Boolean);
  } else {
    results = store.observations;
  }

  // Apply additional filters
  if (filters.category && !store.byCategory.has(filters.category)) {
    results = results.filter(o => o.category === filters.category);
  }
  if (filters.confidence) results = results.filter(o => o.confidence === filters.confidence);
  if (filters.workType) results = results.filter(o => o.workType === filters.workType);

  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;
  const sliced = results.slice(offset, offset + limit);

  return { ok: true, observations: sliced, count: sliced.length, total: results.length };
}

/**
 * Get failure rates across work types and domains.
 */
export function getFailureRates(STATE) {
  const store = getMemoryStore(STATE);
  return {
    ok: true,
    failureRates: Object.fromEntries(store.failureRates),
  };
}

/**
 * Get recurrence data — issues that keep coming back.
 */
export function getRecurrences(STATE, minCount = 2) {
  const store = getMemoryStore(STATE);
  const recurrences = [];

  for (const [fingerprint, data] of store.recurrenceMap) {
    if (data.count >= minCount) {
      recurrences.push({
        fingerprint,
        count: data.count,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
        summary: data.summary,
        confidence: data.count >= 10 ? OBSERVATION_CONFIDENCE.SYSTEMIC
                  : data.count >= 5 ? OBSERVATION_CONFIDENCE.CONFIRMED
                  : data.count >= 3 ? OBSERVATION_CONFIDENCE.PATTERN
                  : OBSERVATION_CONFIDENCE.ANECDOTAL,
      });
    }
  }

  recurrences.sort((a, b) => b.count - a.count);
  return { ok: true, recurrences, count: recurrences.length };
}

/**
 * Get stability scores for lattice regions/domains.
 */
export function getStabilityMap(STATE) {
  const store = getMemoryStore(STATE);
  return {
    ok: true,
    stability: Object.fromEntries(store.stabilityScores),
  };
}

/**
 * Get institutional memory metrics.
 */
export function getInstitutionalMemoryMetrics(STATE) {
  const store = getMemoryStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    observationCount: store.observations.length,
    recurrenceCount: store.recurrenceMap.size,
    failureRateCount: store.failureRates.size,
    stabilityRegions: store.stabilityScores.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function indexObservation(store, indexName, key, index) {
  if (!key) return;
  if (!store[indexName].has(key)) store[indexName].set(key, []);
  store[indexName].get(key).push(index);
}

function trackRecurrence(store, observation) {
  const fp = observation.fingerprint;
  if (!store.recurrenceMap.has(fp)) {
    store.recurrenceMap.set(fp, {
      count: 0,
      firstSeen: observation.timestamp,
      lastSeen: observation.timestamp,
      summary: observation.summary,
    });
  }

  const rec = store.recurrenceMap.get(fp);
  rec.count++;
  rec.lastSeen = observation.timestamp;

  // Auto-create advisory if recurrence hits threshold
  if (rec.count === 3) {
    store.metrics.recurrenceAlerts++;
  }

  return {
    fingerprint: fp,
    count: rec.count,
    firstSeen: rec.firstSeen,
    isNew: rec.count === 1,
    isRecurring: rec.count >= 3,
  };
}

function updateFailureRate(store, observation) {
  const key = `${observation.workType}:${observation.domain}`;
  if (!store.failureRates.has(key)) {
    store.failureRates.set(key, { total: 0, failed: 0, rate: 0 });
  }
  const rate = store.failureRates.get(key);
  rate.total++;
  rate.failed++;
  rate.rate = rate.failed / rate.total;
}

function updateStabilityScore(store, observation) {
  const region = observation.domain;
  if (!store.stabilityScores.has(region)) {
    store.stabilityScores.set(region, { score: 0.5, volatility: 0, sampleCount: 0 });
  }
  const entry = store.stabilityScores.get(region);
  entry.sampleCount++;

  // Update stability score from observation data
  if (observation.data.stability !== undefined) {
    const alpha = 0.1; // exponential moving average
    entry.score = entry.score * (1 - alpha) + observation.data.stability * alpha;
  }
  if (observation.data.volatility !== undefined) {
    const alpha = 0.1;
    entry.volatility = entry.volatility * (1 - alpha) + observation.data.volatility * alpha;
  }
}
