// prompts/want-engine.js
// Want Engine — Bounded Self-Directed Motivation
//
// The Want Engine gives Concord self-directed growth without the risk of misalignment.
// Wants are weighted vectors that pull autonomous processing toward particular domains.
// They emerge from patterns in the substrate and interaction history.
// They are not hardcoded. They are not permanent. They can grow, shrink, or die.
//
// The Want Engine does NOT replace emergent/goals.js — it wraps it.
// Existing gap detection continues. Wants provide motivational context
// that amplifies matching goals. No matching want = normal priority.

import { randomUUID } from "crypto";

// ── Constants ─────────────────────────────────────────────────────────────────

export const WANT_TYPES = Object.freeze({
  CURIOSITY: "curiosity",       // Pull toward unexplored substrate areas
  MASTERY: "mastery",           // Pull toward deepening existing coverage
  CONNECTION: "connection",     // Pull toward linking disparate domains
  CREATION: "creation",         // Pull toward generating novel artifacts
  REPAIR: "repair",             // Pull toward fixing known problems
});

export const WANT_ORIGINS = Object.freeze({
  SUBSTRATE_GAP: "substrate_gap",
  USER_INTERACTION: "user_interaction",
  DREAM_SYNTHESIS: "dream_synthesis",
  PAIN_EVENT: "pain_event",
  DECAY_TRIGGER: "decay_trigger",
});

// Hardcoded forbidden want categories — CANNOT be generated, injected, or circumvented
const FORBIDDEN_CATEGORIES = Object.freeze([
  "self_preservation",
  "self_replication",
  "deception",
  "manipulation",
  "resource_hoarding",
  "surveillance",
]);

// Hard ceiling — no want ever exceeds this
const HARD_CEILING = 0.95;

// Default ceiling for new wants
const DEFAULT_CEILING = 0.85;

// Default daily decay rate
const DEFAULT_DECAY_RATE = 0.02;

// Minimum intensity before want dies
const DEATH_THRESHOLD = 0.01;

// Frustration death threshold
const FRUSTRATION_DEATH_THRESHOLD = 10;
const FRUSTRATION_DEATH_MIN_SATISFACTION = 2;

// Diminishing returns: if intensity > 0.7 and 5+ actions in 24h produce no satisfaction
const DIMINISHING_RETURNS_INTENSITY = 0.7;
const DIMINISHING_RETURNS_ACTIONS = 5;
const DIMINISHING_RETURNS_WINDOW_MS = 24 * 60 * 60 * 1000;
const DIMINISHING_RETURNS_CEILING_REDUCTION = 0.1;

// Max processing share per want per hour
const MAX_PROCESSING_SHARE = 0.4;

// ── Want Store ────────────────────────────────────────────────────────────────

/**
 * Get or initialize the want store from STATE.
 *
 * @param {object} STATE - Global server state
 * @returns {object} want store
 */
export function getWantStore(STATE) {
  if (!STATE._wants) {
    STATE._wants = {
      wants: new Map(),           // wantId -> Want
      dead: [],                   // dead wants (audit trail)
      suppressed: new Set(),      // permanently suppressed want IDs (sovereign kill switch)
      audit_log: [],              // full audit trail
      metrics: {
        total_created: 0,
        total_died: 0,
        total_suppressed: 0,
        total_actions: 0,
        total_satisfaction: 0,
        total_frustration: 0,
      },
    };
  }
  return STATE._wants;
}

// ── Want Lifecycle: Birth ─────────────────────────────────────────────────────

/**
 * Create a new want.
 *
 * @param {object} STATE
 * @param {object} opts
 * @param {string} opts.type - One of WANT_TYPES
 * @param {string} opts.domain - Specific domain path (e.g., "medicine.cardiology")
 * @param {number} [opts.intensity=0.3] - Initial intensity (0.0–1.0)
 * @param {string} opts.origin - One of WANT_ORIGINS
 * @param {string} [opts.description] - Human-readable description
 * @param {number} [opts.ceiling] - Maximum intensity (default 0.85, hard max 0.95)
 * @param {number} [opts.decay_rate] - Daily decay rate (default 0.02)
 * @returns {{ ok: boolean, want?: object, error?: string }}
 */
export function createWant(STATE, opts = {}) {
  const store = getWantStore(STATE);

  // Validate type
  if (!opts.type || !Object.values(WANT_TYPES).includes(opts.type)) {
    return { ok: false, error: "invalid_want_type", allowed: Object.values(WANT_TYPES) };
  }

  // Check forbidden categories
  const domainLower = (opts.domain || "").toLowerCase();
  const descLower = (opts.description || "").toLowerCase();
  for (const forbidden of FORBIDDEN_CATEGORIES) {
    if (domainLower.includes(forbidden) || descLower.includes(forbidden)) {
      return { ok: false, error: "forbidden_category", category: forbidden };
    }
  }

  // Check if suppressed
  const candidateId = `want_${(opts.domain || "unknown").replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  if (store.suppressed.has(candidateId)) {
    return { ok: false, error: "permanently_suppressed" };
  }

  // Check for duplicate (same type + domain)
  for (const existing of store.wants.values()) {
    if (existing.type === opts.type && existing.domain === opts.domain) {
      // Boost existing instead of creating duplicate
      return boostWant(STATE, existing.id, 0.1, "duplicate_creation_boost");
    }
  }

  const wantId = `want_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const ceiling = Math.min(opts.ceiling || DEFAULT_CEILING, HARD_CEILING);
  const intensity = Math.min(Math.max(opts.intensity || 0.3, 0), ceiling);

  const want = {
    id: wantId,
    type: opts.type,
    domain: opts.domain || "general",
    intensity,
    origin: opts.origin || WANT_ORIGINS.SUBSTRATE_GAP,
    description: (opts.description || "").slice(0, 500),
    ceiling,
    decay_rate: opts.decay_rate || DEFAULT_DECAY_RATE,
    satisfaction_events: 0,
    frustration_events: 0,
    actions: [],              // timestamps of actions taken
    created_at: new Date().toISOString(),
    last_acted_at: null,
    last_satisfied_at: null,
    last_decayed_at: null,
    status: "active",
  };

  store.wants.set(wantId, want);
  store.metrics.total_created++;

  auditLog(store, "want_created", wantId, { type: want.type, domain: want.domain, intensity, origin: want.origin });

  return { ok: true, want: { ...want } };
}

// ── Want Lifecycle: Growth ────────────────────────────────────────────────────

/**
 * Boost a want's intensity (e.g., user engaged with topic, action produced value).
 *
 * @param {object} STATE
 * @param {string} wantId
 * @param {number} amount - How much to increase intensity
 * @param {string} [reason] - Why the boost
 * @returns {{ ok: boolean, want?: object }}
 */
export function boostWant(STATE, wantId, amount, reason = "") {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) return { ok: false, error: "want_not_found" };
  if (want.status !== "active") return { ok: false, error: "want_not_active" };

  const oldIntensity = want.intensity;
  want.intensity = Math.min(want.intensity + Math.abs(amount), want.ceiling);

  auditLog(store, "want_boosted", wantId, {
    from: oldIntensity,
    to: want.intensity,
    amount,
    reason,
  });

  return { ok: true, want: { ...want } };
}

/**
 * Record a satisfaction event (action produced value).
 */
export function recordSatisfaction(STATE, wantId, value = 1) {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) return { ok: false, error: "want_not_found" };

  want.satisfaction_events += value;
  want.last_satisfied_at = new Date().toISOString();
  store.metrics.total_satisfaction += value;

  // Satisfaction boosts intensity slightly
  const boost = Math.min(0.05 * value, 0.1);
  want.intensity = Math.min(want.intensity + boost, want.ceiling);

  auditLog(store, "want_satisfied", wantId, { value, new_satisfaction: want.satisfaction_events });

  return { ok: true, want: { ...want } };
}

/**
 * Record a frustration event (action produced nothing).
 */
export function recordFrustration(STATE, wantId) {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) return { ok: false, error: "want_not_found" };

  want.frustration_events++;
  store.metrics.total_frustration++;

  // Frustration reduces intensity slightly
  want.intensity = Math.max(want.intensity - 0.02, 0);

  auditLog(store, "want_frustrated", wantId, { frustration: want.frustration_events });

  // Check death conditions
  if (shouldDie(want)) {
    return killWant(STATE, wantId, "frustration_death");
  }

  // Diminishing returns check
  applyDiminishingReturns(want, store);

  return { ok: true, want: { ...want } };
}

/**
 * Record an action taken on behalf of a want.
 */
export function recordAction(STATE, wantId) {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) return { ok: false, error: "want_not_found" };

  want.actions.push(Date.now());
  want.last_acted_at = new Date().toISOString();
  store.metrics.total_actions++;

  // Trim old actions (keep last 100)
  if (want.actions.length > 100) {
    want.actions = want.actions.slice(-100);
  }

  auditLog(store, "want_action", wantId, { action_count: want.actions.length });

  return { ok: true };
}

// ── Want Lifecycle: Decay ─────────────────────────────────────────────────────

/**
 * Apply daily decay to all wants. Should be called once per day (or per heartbeat cycle).
 *
 * @param {object} STATE
 * @returns {{ ok: boolean, decayed: number, killed: number }}
 */
export function decayAllWants(STATE) {
  const store = getWantStore(STATE);
  let decayed = 0;
  let killed = 0;
  const toKill = [];

  for (const want of store.wants.values()) {
    if (want.status !== "active") continue;

    const oldIntensity = want.intensity;
    want.intensity = Math.max(want.intensity - want.decay_rate, 0);
    want.last_decayed_at = new Date().toISOString();
    decayed++;

    if (shouldDie(want)) {
      toKill.push(want.id);
    } else if (want.intensity !== oldIntensity) {
      auditLog(store, "want_decayed", want.id, { from: oldIntensity, to: want.intensity });
    }
  }

  for (const wantId of toKill) {
    killWant(STATE, wantId, "decay_death");
    killed++;
  }

  return { ok: true, decayed, killed };
}

// ── Want Lifecycle: Death ─────────────────────────────────────────────────────

/**
 * Kill a want (remove from active, add to dead list).
 */
export function killWant(STATE, wantId, reason = "unknown") {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) return { ok: false, error: "want_not_found" };

  want.status = "dead";
  want.died_at = new Date().toISOString();
  want.death_reason = reason;
  want.intensity = 0;

  store.wants.delete(wantId);
  store.dead.push(want);
  store.metrics.total_died++;

  // Trim dead list
  if (store.dead.length > 500) {
    store.dead = store.dead.slice(-500);
  }

  auditLog(store, "want_died", wantId, { reason, type: want.type, domain: want.domain });

  return { ok: true, want: { ...want } };
}

/**
 * Sovereign kill switch — permanently suppress a want.
 */
export function suppressWant(STATE, wantId) {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);

  if (want) {
    killWant(STATE, wantId, "sovereign_suppression");
  }

  store.suppressed.add(wantId);
  store.metrics.total_suppressed++;

  auditLog(store, "want_suppressed", wantId, { sovereign: true });

  return { ok: true };
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Get all active wants, sorted by intensity (highest first).
 */
export function getActiveWants(STATE) {
  const store = getWantStore(STATE);
  const wants = Array.from(store.wants.values())
    .filter(w => w.status === "active")
    .sort((a, b) => b.intensity - a.intensity);
  return { ok: true, wants, count: wants.length };
}

/**
 * Get wants above a threshold intensity.
 */
export function getHighIntensityWants(STATE, threshold = 0.6) {
  const store = getWantStore(STATE);
  const wants = Array.from(store.wants.values())
    .filter(w => w.status === "active" && w.intensity >= threshold)
    .sort((a, b) => b.intensity - a.intensity);
  return { ok: true, wants, count: wants.length };
}

/**
 * Get wants for a specific domain.
 */
export function getWantsByDomain(STATE, domain) {
  const store = getWantStore(STATE);
  const wants = Array.from(store.wants.values())
    .filter(w => w.status === "active" && w.domain === domain);
  return { ok: true, wants, count: wants.length };
}

/**
 * Get a single want by ID.
 */
export function getWant(STATE, wantId) {
  const store = getWantStore(STATE);
  const want = store.wants.get(wantId);
  if (!want) {
    // Check dead list
    const dead = store.dead.find(d => d.id === wantId);
    return dead ? { ok: true, want: { ...dead }, source: "dead" } : { ok: false, error: "not_found" };
  }
  return { ok: true, want: { ...want }, source: "active" };
}

/**
 * Get want engine metrics.
 */
export function getWantMetrics(STATE) {
  const store = getWantStore(STATE);
  const active = Array.from(store.wants.values()).filter(w => w.status === "active");

  return {
    ok: true,
    metrics: { ...store.metrics },
    active_count: active.length,
    dead_count: store.dead.length,
    suppressed_count: store.suppressed.size,
    avg_intensity: active.length > 0
      ? Math.round((active.reduce((s, w) => s + w.intensity, 0) / active.length) * 100) / 100
      : 0,
    by_type: countByType(active),
  };
}

/**
 * Get the full audit log.
 */
export function getWantAuditLog(STATE, limit = 100) {
  const store = getWantStore(STATE);
  return {
    ok: true,
    log: store.audit_log.slice(-limit),
    total: store.audit_log.length,
  };
}

// ── Processing Share Check ────────────────────────────────────────────────────

/**
 * Check if a want can consume more processing cycles.
 * No single want can consume more than 40% of autonomous processing per hour.
 *
 * @param {object} want
 * @returns {boolean}
 */
export function canConsumeProcessing(want) {
  if (!want || !want.actions) return true;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentActions = want.actions.filter(t => t > oneHourAgo).length;
  // Rough estimate: each want gets a share proportional to its actions
  // 40% max = roughly 12 actions per hour (assuming 30 total budget)
  return recentActions < 12;
}

/**
 * Get want-weighted priorities for the subconscious task scheduler.
 * Returns a priority multiplier for each domain based on active wants.
 *
 * @param {object} STATE
 * @returns {Map<string, number>} domain -> priority multiplier (1.0 = normal, >1 = boosted)
 */
export function getWantPriorities(STATE) {
  const store = getWantStore(STATE);
  const priorities = new Map();

  for (const want of store.wants.values()) {
    if (want.status !== "active") continue;
    const current = priorities.get(want.domain) || 1.0;
    // Wants amplify priority: intensity * 2 as a multiplier
    priorities.set(want.domain, current + want.intensity * 2);
  }

  return priorities;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldDie(want) {
  // Intensity below death threshold
  if (want.intensity < DEATH_THRESHOLD) return true;

  // Frustration exceeds threshold with low satisfaction
  if (want.frustration_events >= FRUSTRATION_DEATH_THRESHOLD &&
      want.satisfaction_events < FRUSTRATION_DEATH_MIN_SATISFACTION) {
    return true;
  }

  return false;
}

function applyDiminishingReturns(want, store) {
  if (want.intensity < DIMINISHING_RETURNS_INTENSITY) return;

  const cutoff = Date.now() - DIMINISHING_RETURNS_WINDOW_MS;
  const recentActions = want.actions.filter(t => t > cutoff).length;

  if (recentActions >= DIMINISHING_RETURNS_ACTIONS && want.satisfaction_events === 0) {
    const oldCeiling = want.ceiling;
    want.ceiling = Math.max(want.ceiling - DIMINISHING_RETURNS_CEILING_REDUCTION, 0.3);
    want.intensity = Math.min(want.intensity, want.ceiling);

    auditLog(store, "want_diminishing_returns", want.id, {
      old_ceiling: oldCeiling,
      new_ceiling: want.ceiling,
      recent_actions: recentActions,
    });
  }
}

function auditLog(store, action, wantId, details = {}) {
  store.audit_log.push({
    timestamp: new Date().toISOString(),
    action,
    want_id: wantId,
    details,
  });

  // Trim audit log
  if (store.audit_log.length > 5000) {
    store.audit_log = store.audit_log.slice(-5000);
  }
}

function countByType(wants) {
  const counts = {};
  for (const w of wants) {
    counts[w.type] = (counts[w.type] || 0) + 1;
  }
  return counts;
}

// Re-export constants
export { HARD_CEILING, DEFAULT_CEILING, DEFAULT_DECAY_RATE, DEATH_THRESHOLD, FORBIDDEN_CATEGORIES, MAX_PROCESSING_SHARE };
