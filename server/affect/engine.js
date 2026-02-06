/**
 * Concord ATS — Engine
 * Core state management: tick, applyEvent, invariants, hysteresis.
 */

import { BASELINE, BOUNDS, DIMS, DECAY, CONSERVATION, MOMENTUM, DEFAULT_META } from "./defaults.js";
import { clamp } from "./schema.js";

/**
 * Create a fresh affective state at baseline.
 */
export function createState(meta = {}) {
  return {
    v: BASELINE.v,
    a: BASELINE.a,
    s: BASELINE.s,
    c: BASELINE.c,
    g: BASELINE.g,
    t: BASELINE.t,
    f: BASELINE.f,
    ts: Date.now(),
    meta: { ...DEFAULT_META, ...meta },
  };
}

/**
 * Create a fresh momentum vector (all zeros).
 */
export function createMomentum() {
  return { v: 0, a: 0, s: 0, c: 0, g: 0, t: 0, f: 0 };
}

/**
 * Enforce hard bounds on all dimensions (mutates E in place, returns E).
 */
export function enforceInvariants(E) {
  for (const dim of DIMS) {
    const [lo, hi] = BOUNDS[dim];
    E[dim] = clamp(E[dim], lo, hi);
  }
  return E;
}

/**
 * Compute the L2 norm of a delta vector.
 */
function l2Norm(delta) {
  let sum = 0;
  for (const dim of DIMS) sum += (delta[dim] || 0) ** 2;
  return Math.sqrt(sum);
}

/**
 * Scale a delta vector to respect the conservation constraint.
 * Low stability → smaller maxDelta (prevents spirals).
 */
function constrainDelta(delta, stability) {
  const maxDelta = CONSERVATION.unstableMaxDelta +
    (CONSERVATION.baseMaxDelta - CONSERVATION.unstableMaxDelta) * stability;
  const norm = l2Norm(delta);
  if (norm <= maxDelta || norm === 0) return delta;

  const scale = maxDelta / norm;
  const constrained = {};
  for (const dim of DIMS) constrained[dim] = (delta[dim] || 0) * scale;
  return constrained;
}

/**
 * Compute the decay rate based on current state.
 * Higher fatigue → faster decay. Higher stability → slower decay.
 */
function computeDecayRate(E) {
  const fatigueFactor = 1 + (E.f * DECAY.fatigueMultiplier);
  const stabilityFactor = 1 + (E.s * DECAY.stabilityDivisor);
  const rate = (DECAY.baseRate * fatigueFactor) / stabilityFactor;
  return clamp(rate, DECAY.minRate, DECAY.maxRate);
}

/**
 * Apply time-based decay toward baseline.
 * E decays toward BASELINE at a rate that depends on fatigue and stability.
 */
export function applyDecay(E, dtMs) {
  const dtSec = dtMs / 1000;
  const rate = computeDecayRate(E);
  const factor = 1 - Math.exp(-rate * dtSec);

  for (const dim of DIMS) {
    E[dim] = E[dim] + (BASELINE[dim] - E[dim]) * factor;
  }

  return enforceInvariants(E);
}

/**
 * Decay the momentum vector over time.
 */
export function decayMomentum(M, dtMs) {
  const dtSec = dtMs / 1000;
  const factor = Math.exp(-MOMENTUM.decayRate * dtSec);
  for (const dim of DIMS) {
    M[dim] = (M[dim] || 0) * factor;
  }
  return M;
}

/**
 * Compute raw delta from an event (before momentum and constraints).
 *
 * Event fields:
 *   type: string, intensity: 0..1, polarity: -1..+1
 *
 * How dimensions respond:
 *   v: polarity + outcome
 *   a: intensity
 *   s: decreases on repeated high-intensity swings/errors; increases on consistency
 *   c: decreases on conflict; increases on resolution
 *   g: increases with progress; decreases with blocks/timeouts
 *   t: increases with reliable results; decreases with safety blocks
 *   f: increases with activity and repeated failures; decays slowly (via baseline)
 */
function computeRawDelta(event) {
  const { type, intensity, polarity } = event;
  const i = clamp(intensity, 0, 1);
  const p = clamp(polarity, -1, 1);
  const delta = { v: 0, a: 0, s: 0, c: 0, g: 0, t: 0, f: 0 };

  // Valence: driven by polarity. Non-negative invariant means we push toward 0 for negative, not below.
  // Positive events push valence up, negative events push it down toward 0.
  delta.v = p * i * 0.15;

  // Arousal: driven by intensity
  delta.a = i * 0.2;

  switch (type) {
    case "SUCCESS":
    case "GOAL_PROGRESS":
      delta.s += i * 0.05;   // stability increases
      delta.g += i * 0.12;   // agency increases
      delta.t += i * 0.06;   // trust increases
      delta.f -= i * 0.03;   // fatigue slightly decreases
      break;

    case "ERROR":
    case "TIMEOUT":
      delta.s -= i * 0.1;    // stability drops
      delta.g -= i * 0.08;   // agency drops
      delta.t -= i * 0.04;   // trust drops
      delta.f += i * 0.08;   // fatigue increases
      break;

    case "CONFLICT":
      delta.c -= i * 0.15;   // coherence drops significantly
      delta.s -= i * 0.08;   // stability drops
      break;

    case "SAFETY_BLOCK":
      delta.t -= i * 0.1;    // trust drops
      delta.g -= i * 0.1;    // agency drops (blocked)
      delta.s -= i * 0.05;   // stability slightly drops
      delta.v -= i * 0.05;   // valence down
      break;

    case "USER_MESSAGE":
      delta.f += 0.02;       // small fatigue from activity
      delta.a += i * 0.05;   // slight arousal from engagement
      break;

    case "SYSTEM_RESULT":
      // Polarity already affects valence above
      if (p >= 0) {
        delta.c += i * 0.03;
        delta.g += i * 0.04;
      } else {
        delta.c -= i * 0.05;
        delta.f += i * 0.04;
      }
      break;

    case "TOOL_RESULT":
      if (p >= 0) {
        delta.t += i * 0.05;
        delta.g += i * 0.06;
      } else {
        delta.t -= i * 0.06;
        delta.f += i * 0.05;
      }
      break;

    case "FEEDBACK":
      // User feedback directly affects valence and trust
      delta.v += p * i * 0.1;
      delta.t += p * i * 0.08;
      delta.c += Math.abs(p) * i * 0.04; // any feedback improves coherence
      break;

    case "SESSION_START":
      // Fresh start: slight boost
      delta.f -= 0.05;
      delta.g += 0.03;
      break;

    case "SESSION_END":
      delta.a -= 0.1;
      break;

    default:
      // CUSTOM or unknown: use polarity and intensity generically
      break;
  }

  return delta;
}

/**
 * Apply a single event to the affective state, respecting momentum and conservation.
 *
 * @param {object} E - Current affective state (mutated in place)
 * @param {object} M - Momentum vector (mutated in place)
 * @param {object} event - Validated AffectEvent
 * @returns {{ E, M, delta }} Updated state, momentum, and applied delta
 */
export function applyEvent(E, M, event) {
  const now = Date.now();

  // 1. Decay since last update
  const dt = now - (E.ts || now);
  if (dt > 0) {
    applyDecay(E, dt);
    decayMomentum(M, dt);
  }

  // 2. Compute raw delta from event
  const raw = computeRawDelta(event);

  // 3. Apply hysteresis: momentum biases the delta
  const biased = {};
  for (const dim of DIMS) {
    biased[dim] = (raw[dim] || 0) + (M[dim] || 0) * MOMENTUM.weight;
  }

  // 4. Constrain delta (conservation)
  const delta = constrainDelta(biased, E.s);

  // 5. Apply delta to state
  for (const dim of DIMS) {
    E[dim] += delta[dim] || 0;
  }

  // 6. Enforce invariants
  enforceInvariants(E);

  // 7. Update momentum
  for (const dim of DIMS) {
    M[dim] = clamp(
      (M[dim] || 0) * (1 - MOMENTUM.weight) + (delta[dim] || 0),
      -MOMENTUM.maxMagnitude,
      MOMENTUM.maxMagnitude
    );
  }

  // 8. Stamp timestamp
  E.ts = now;

  return { E, M, delta };
}

/**
 * Run a decay-only tick (no event). Used for background decay.
 */
export function tick(E, M) {
  const now = Date.now();
  const dt = now - (E.ts || now);
  if (dt > 0) {
    applyDecay(E, dt);
    decayMomentum(M, dt);
  }
  E.ts = now;
  return { E, M };
}

/**
 * Reset state to baseline or cooldown mode.
 */
export function resetState(mode = "baseline") {
  const E = createState({ mode });
  const M = createMomentum();

  if (mode === "cooldown") {
    // Cooldown: lower arousal, higher stability, reduced fatigue
    E.a = 0.1;
    E.s = 0.9;
    E.f = 0.1;
    E.meta.mode = "cooldown";
  }

  return { E, M };
}
