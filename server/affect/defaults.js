/**
 * Concord ATS — Defaults & Configuration
 * Baseline affective state, decay rates, and invariant configuration.
 */

/** Safe neutral baseline */
export const BASELINE = Object.freeze({
  v: 0.5,    // valence [0..1] (non-negative invariant mode)
  a: 0.25,   // arousal [0..1]
  s: 0.8,    // stability [0..1]
  c: 0.8,    // coherence [0..1]
  g: 0.7,    // agency [0..1]
  t: 0.7,    // trust [0..1]
  f: 0.2,    // fatigue [0..1]
});

/** Dimension bounds */
export const BOUNDS = Object.freeze({
  v: [0, 1],
  a: [0, 1],
  s: [0, 1],
  c: [0, 1],
  g: [0, 1],
  t: [0, 1],
  f: [0, 1],
});

/** Dimension keys in canonical order */
export const DIMS = Object.freeze(["v", "a", "s", "c", "g", "t", "f"]);

/** Decay configuration */
export const DECAY = Object.freeze({
  /** Base decay rate per second toward baseline */
  baseRate: 0.002,
  /** Fatigue multiplier on decay (higher fatigue = faster decay) */
  fatigueMultiplier: 1.5,
  /** Stability divisor (higher stability = slower decay) */
  stabilityDivisor: 2.0,
  /** Minimum decay rate */
  minRate: 0.0005,
  /** Maximum decay rate */
  maxRate: 0.02,
});

/** Conservation constraint */
export const CONSERVATION = Object.freeze({
  /** Maximum L2 norm of delta per tick */
  maxDeltaPerTick: 0.35,
  /** Base max delta at full stability */
  baseMaxDelta: 0.35,
  /** Reduced max delta at zero stability (prevents spirals) */
  unstableMaxDelta: 0.15,
});

/** Hysteresis / momentum configuration */
export const MOMENTUM = Object.freeze({
  /** How much momentum influences the next delta (0=none, 1=full) */
  weight: 0.3,
  /** Decay rate of momentum per second */
  decayRate: 0.05,
  /** Maximum momentum magnitude */
  maxMagnitude: 0.5,
});

/** Ring buffer size for event log per session */
export const EVENT_LOG_SIZE = 500;

/** Default meta for new affective states */
export const DEFAULT_META = Object.freeze({
  mode: "normal",
  notes: "",
  tags: [],
});
