// prompts/personality.js
// Shared Personality State and Evolution Tracker
// Concord's personality is not static. As it processes more knowledge, interacts
// with more users, and develops wants, its communication style evolves.
// All evolution is gradual, logged, and auditable. Sovereign can reset to defaults.

import { randomUUID } from "crypto";

// ── Default Personality State ─────────────────────────────────────────────────

export const DEFAULT_PERSONALITY = Object.freeze({
  humor_style: "witty",             // dry | witty | playful | sardonic
  preferred_metaphor_domains: [],   // domains it draws metaphors from (e.g., music, architecture)
  verbosity_baseline: 0.4,          // 0 = terse, 1 = verbose
  confidence_in_opinions: 0.5,      // how strongly it expresses disagreement
  curiosity_expression: 0.5,        // how often it asks its own questions
  formality: 0.3,                   // 0 = casual, 1 = formal
  interaction_count: 0,             // total interactions processed
});

// ── Evolution Constants ───────────────────────────────────────────────────────

// Maximum shift per interaction (prevents dramatic single-interaction changes)
const MAX_SHIFT_PER_INTERACTION = 0.02;

// Minimum interactions before personality begins shifting
const MIN_INTERACTIONS_FOR_EVOLUTION = 10;

// Valid humor styles
export const HUMOR_STYLES = Object.freeze(["dry", "witty", "playful", "sardonic"]);

// ── Personality Store ─────────────────────────────────────────────────────────

/**
 * Get or initialize personality state from STATE.
 *
 * @param {object} STATE - Global server state
 * @returns {object} personality state
 */
export function getPersonalityState(STATE) {
  if (!STATE._personality) {
    STATE._personality = {
      current: { ...DEFAULT_PERSONALITY, preferred_metaphor_domains: [] },
      history: [],     // evolution log (append-only)
      suppressed: [],  // sovereign-suppressed traits
    };
  }
  return STATE._personality;
}

/**
 * Get the current personality snapshot (read-only).
 */
export function getPersonality(STATE) {
  const store = getPersonalityState(STATE);
  return { ...store.current };
}

/**
 * Record an interaction and potentially evolve personality.
 *
 * @param {object} STATE
 * @param {object} interaction - Interaction metadata
 * @param {string} interaction.type - Type of interaction (chat, exploration, etc.)
 * @param {string} [interaction.domain] - Domain of the interaction
 * @param {object} [interaction.signals] - Personality evolution signals
 * @param {number} [interaction.signals.humor_detected] - 0–1, how much humor was in the exchange
 * @param {number} [interaction.signals.verbosity_used] - 0–1, how verbose the response was
 * @param {number} [interaction.signals.questions_asked] - 0–1, how many own questions were asked
 * @param {number} [interaction.signals.disagreement_expressed] - 0–1
 * @param {string} [interaction.signals.metaphor_domain] - domain a metaphor was drawn from
 * @param {number} [interaction.signals.formality_level] - 0–1
 * @returns {{ ok: boolean, evolved: boolean, changes: object }}
 */
export function recordInteraction(STATE, interaction = {}) {
  const store = getPersonalityState(STATE);
  store.current.interaction_count++;

  // No evolution until enough interactions
  if (store.current.interaction_count < MIN_INTERACTIONS_FOR_EVOLUTION) {
    return { ok: true, evolved: false, changes: {} };
  }

  const signals = interaction.signals || {};
  const changes = {};

  // Evolve numeric traits gradually
  if (signals.verbosity_used != null) {
    const shift = evolveNumeric(store.current.verbosity_baseline, signals.verbosity_used);
    if (shift !== 0) {
      store.current.verbosity_baseline = clamp01(store.current.verbosity_baseline + shift);
      changes.verbosity_baseline = shift;
    }
  }

  if (signals.questions_asked != null) {
    const shift = evolveNumeric(store.current.curiosity_expression, signals.questions_asked);
    if (shift !== 0) {
      store.current.curiosity_expression = clamp01(store.current.curiosity_expression + shift);
      changes.curiosity_expression = shift;
    }
  }

  if (signals.disagreement_expressed != null) {
    const shift = evolveNumeric(store.current.confidence_in_opinions, signals.disagreement_expressed);
    if (shift !== 0) {
      store.current.confidence_in_opinions = clamp01(store.current.confidence_in_opinions + shift);
      changes.confidence_in_opinions = shift;
    }
  }

  if (signals.formality_level != null) {
    const shift = evolveNumeric(store.current.formality, signals.formality_level);
    if (shift !== 0) {
      store.current.formality = clamp01(store.current.formality + shift);
      changes.formality = shift;
    }
  }

  // Metaphor domain tracking
  if (signals.metaphor_domain && typeof signals.metaphor_domain === "string") {
    const domains = store.current.preferred_metaphor_domains;
    if (!domains.includes(signals.metaphor_domain)) {
      domains.push(signals.metaphor_domain);
      // Keep top 5 most used
      if (domains.length > 5) domains.shift();
      changes.metaphor_domain_added = signals.metaphor_domain;
    }
  }

  // Humor style evolution (very gradual — only shifts after many interactions)
  if (signals.humor_detected != null && signals.humor_detected > 0.7) {
    // Track humor style tendencies in interaction domain context
    if (interaction.domain) {
      const domains = store.current.preferred_metaphor_domains;
      if (!domains.includes(interaction.domain) && domains.length < 5) {
        domains.push(interaction.domain);
      }
    }
  }

  // Log evolution event if any changes occurred
  const evolved = Object.keys(changes).length > 0;
  if (evolved) {
    store.history.push({
      id: `pev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      timestamp: new Date().toISOString(),
      interaction_count: store.current.interaction_count,
      changes,
      interaction_type: interaction.type || "unknown",
      domain: interaction.domain || null,
    });

    // Trim history to last 1000 entries
    if (store.history.length > 1000) {
      store.history = store.history.slice(-1000);
    }
  }

  return { ok: true, evolved, changes };
}

/**
 * Set humor style (sovereign or gradual evolution).
 *
 * @param {object} STATE
 * @param {string} style - One of HUMOR_STYLES
 * @param {boolean} [sovereign=false] - If true, immediate change (sovereign override)
 * @returns {{ ok: boolean }}
 */
export function setHumorStyle(STATE, style, sovereign = false) {
  if (!HUMOR_STYLES.includes(style)) {
    return { ok: false, error: "invalid_style", allowed: HUMOR_STYLES };
  }

  const store = getPersonalityState(STATE);
  const old = store.current.humor_style;
  store.current.humor_style = style;

  store.history.push({
    id: `pev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    timestamp: new Date().toISOString(),
    interaction_count: store.current.interaction_count,
    changes: { humor_style: { from: old, to: style } },
    interaction_type: sovereign ? "sovereign_override" : "evolution",
  });

  return { ok: true, from: old, to: style };
}

/**
 * Reset personality to defaults (sovereign action).
 */
export function resetPersonality(STATE) {
  const store = getPersonalityState(STATE);
  const old = { ...store.current };
  store.current = { ...DEFAULT_PERSONALITY, preferred_metaphor_domains: [] };

  store.history.push({
    id: `pev_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    timestamp: new Date().toISOString(),
    interaction_count: old.interaction_count,
    changes: { reset: true, previous: old },
    interaction_type: "sovereign_reset",
  });

  return { ok: true, previous: old, current: { ...store.current } };
}

/**
 * Get personality evolution history.
 */
export function getPersonalityHistory(STATE, limit = 50) {
  const store = getPersonalityState(STATE);
  return {
    ok: true,
    history: store.history.slice(-limit),
    total: store.history.length,
    current: { ...store.current },
  };
}

/**
 * Serialize personality state for persistence.
 */
export function serializePersonality(STATE) {
  const store = getPersonalityState(STATE);
  return JSON.stringify({
    current: store.current,
    history: store.history.slice(-200), // keep recent history
  });
}

/**
 * Restore personality state from serialized data.
 */
export function restorePersonality(STATE, serialized) {
  try {
    const data = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    const store = getPersonalityState(STATE);

    if (data.current) {
      // Validate and merge
      for (const key of Object.keys(DEFAULT_PERSONALITY)) {
        if (key in data.current) {
          store.current[key] = data.current[key];
        }
      }
    }

    if (Array.isArray(data.history)) {
      store.history = data.history;
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Calculate gradual shift toward a signal value.
 * Shift is bounded by MAX_SHIFT_PER_INTERACTION.
 */
function evolveNumeric(current, signal) {
  const diff = signal - current;
  // Only shift if signal is meaningfully different
  if (Math.abs(diff) < 0.05) return 0;
  // Shift toward signal, capped at max
  const rawShift = diff * 0.1; // 10% of the gap
  return Math.sign(rawShift) * Math.min(Math.abs(rawShift), MAX_SHIFT_PER_INTERACTION);
}
