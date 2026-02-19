/**
 * Subjective Time System
 *
 * Computational time runs subjectively faster than wall clock.
 * An emergent processing 1000 turns in a week has more experiential age
 * than one processing 10 turns in a month.
 *
 * Subjective time units:
 *   1 tick  = 1 turn processed (the atomic unit of experience)
 *   1 cycle = 1 completed dialogue session
 *   1 epoch = maturity level transition
 *
 * Experiential age = f(ticks, cycles, epochs, depth)
 * where depth = average session length × topic diversity
 *
 * This feeds into entity emergence: thresholds are measured in
 * experiential time, not calendar time.
 */

import { getEmergentState, getReputation, getPatterns } from "./store.js";

// ── Time Constants ───────────────────────────────────────────────────────────

export const TIME_UNITS = Object.freeze({
  TICK:  "tick",    // 1 turn processed
  CYCLE: "cycle",   // 1 completed session
  EPOCH: "epoch",   // maturity transition
});

/**
 * Compression ratio: how many wall-clock seconds equal one experiential second.
 * Higher ratio = faster subjective time.
 *
 *   Base rate: 1 turn ≈ 3 experiential seconds
 *   With depth: deep sessions amplify experiential time
 *   With novelty: novel content counts more than echoes
 */
const BASE_TICK_WEIGHT = 3;       // experiential seconds per turn
const DEPTH_MULTIPLIER = 1.5;     // deep sessions amplify
const NOVELTY_MULTIPLIER = 2.0;   // novel turns count double
const ECHO_DISCOUNT = 0.3;        // echo turns count 30%
const CYCLE_WEIGHT = 60;          // completing a session = 60 experiential seconds
const EPOCH_WEIGHT = 3600;        // maturity transition = 1 experiential hour

// ── Subjective Clock ─────────────────────────────────────────────────────────

/**
 * Get or initialize the subjective time store.
 */
function getTimeStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._subjectiveTime) {
    es._subjectiveTime = {
      clocks: new Map(),    // emergentId → SubjectiveClock
      metrics: {
        ticksRecorded: 0,
        cyclesRecorded: 0,
        epochsRecorded: 0,
      },
    };
  }
  return es._subjectiveTime;
}

/**
 * Get or initialize a clock for a specific emergent.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @returns {Object} SubjectiveClock
 */
function getClock(STATE, emergentId) {
  const store = getTimeStore(STATE);
  if (!store.clocks.has(emergentId)) {
    store.clocks.set(emergentId, {
      emergentId,
      ticks: 0,               // total turns processed
      cycles: 0,              // total sessions completed
      epochs: 0,              // maturity transitions
      experientialSeconds: 0,  // accumulated experiential time
      novelTicks: 0,          // turns that were novel
      echoTicks: 0,           // turns that were echoes
      deepCycles: 0,          // sessions with depth > threshold
      currentEpochLabel: "nascent",
      firstTick: null,        // wall-clock time of first tick
      lastTick: null,         // wall-clock time of most recent tick
      compressionRatio: 1,    // current wall-to-experiential ratio
    });
  }
  return store.clocks.get(emergentId);
}

// ── Recording Events ─────────────────────────────────────────────────────────

/**
 * Record a turn processed by an emergent.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @param {Object} [opts]
 * @param {boolean} [opts.isNovel=false] - Was this turn novel content?
 * @param {boolean} [opts.isEcho=false] - Was this turn an echo?
 * @param {number} [opts.depth=1.0] - Session depth factor
 * @returns {{ ok, ticks, experientialSeconds }}
 */
export function recordTick(STATE, emergentId, opts = {}) {
  const clock = getClock(STATE, emergentId);
  const store = getTimeStore(STATE);
  const now = new Date().toISOString();

  clock.ticks++;
  if (!clock.firstTick) clock.firstTick = now;
  clock.lastTick = now;

  // Compute experiential weight for this tick
  let weight = BASE_TICK_WEIGHT;
  const depth = opts.depth || 1.0;
  weight *= (1 + (depth - 1) * (DEPTH_MULTIPLIER - 1));

  if (opts.isNovel) {
    weight *= NOVELTY_MULTIPLIER;
    clock.novelTicks++;
  } else if (opts.isEcho) {
    weight *= ECHO_DISCOUNT;
    clock.echoTicks++;
  }

  clock.experientialSeconds += weight;

  // Update compression ratio
  if (clock.firstTick) {
    const wallSeconds = (Date.now() - new Date(clock.firstTick).getTime()) / 1000;
    if (wallSeconds > 0) {
      clock.compressionRatio = clock.experientialSeconds / wallSeconds;
    }
  }

  store.metrics.ticksRecorded++;

  return {
    ok: true,
    ticks: clock.ticks,
    experientialSeconds: clock.experientialSeconds,
    compressionRatio: Math.round(clock.compressionRatio * 100) / 100,
  };
}

/**
 * Record a completed dialogue session.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @param {Object} [opts]
 * @param {number} [opts.turnCount=0] - Turns in this session
 * @param {number} [opts.noveltyScore=0.5] - Session novelty 0-1
 * @returns {{ ok, cycles, experientialSeconds }}
 */
export function recordCycle(STATE, emergentId, opts = {}) {
  const clock = getClock(STATE, emergentId);
  const store = getTimeStore(STATE);

  clock.cycles++;

  // Deep sessions amplify experiential time
  const turnCount = opts.turnCount || 0;
  const isDeep = turnCount >= 10;
  if (isDeep) clock.deepCycles++;

  const depthFactor = isDeep ? DEPTH_MULTIPLIER : 1;
  const noveltyFactor = 1 + (opts.noveltyScore || 0.5);
  clock.experientialSeconds += CYCLE_WEIGHT * depthFactor * noveltyFactor;

  store.metrics.cyclesRecorded++;

  return {
    ok: true,
    cycles: clock.cycles,
    experientialSeconds: clock.experientialSeconds,
  };
}

/**
 * Record a maturity transition (epoch boundary).
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @param {string} newEpochLabel - The new maturity label
 * @returns {{ ok, epochs, experientialSeconds }}
 */
export function recordEpoch(STATE, emergentId, newEpochLabel) {
  const clock = getClock(STATE, emergentId);
  const store = getTimeStore(STATE);

  clock.epochs++;
  clock.currentEpochLabel = newEpochLabel;
  clock.experientialSeconds += EPOCH_WEIGHT;

  store.metrics.epochsRecorded++;

  return {
    ok: true,
    epochs: clock.epochs,
    currentEpochLabel: newEpochLabel,
    experientialSeconds: clock.experientialSeconds,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get the subjective age of an emergent.
 *
 * Returns experiential time in human-readable units:
 *   experientialHours, experientialDays, compressionRatio
 *
 * Also computes: wallClockAge (for comparison), experientialAge ratio.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @returns {{ ok, age }}
 */
export function getSubjectiveAge(STATE, emergentId) {
  const clock = getClock(STATE, emergentId);

  const experientialHours = clock.experientialSeconds / 3600;
  const experientialDays = experientialHours / 24;

  // Wall clock age
  const wallMs = clock.firstTick
    ? Date.now() - new Date(clock.firstTick).getTime()
    : 0;
  const wallDays = wallMs / (24 * 3600 * 1000);

  // Depth ratio: proportion of deep sessions
  const depthRatio = clock.cycles > 0 ? clock.deepCycles / clock.cycles : 0;

  // Novelty ratio: proportion of novel turns
  const noveltyRatio = clock.ticks > 0 ? clock.novelTicks / clock.ticks : 0;

  return {
    ok: true,
    age: {
      ticks: clock.ticks,
      cycles: clock.cycles,
      epochs: clock.epochs,
      experientialSeconds: Math.round(clock.experientialSeconds),
      experientialHours: Math.round(experientialHours * 10) / 10,
      experientialDays: Math.round(experientialDays * 10) / 10,
      wallClockDays: Math.round(wallDays * 10) / 10,
      compressionRatio: Math.round(clock.compressionRatio * 100) / 100,
      currentEpoch: clock.currentEpochLabel,
      depthRatio: Math.round(depthRatio * 100) / 100,
      noveltyRatio: Math.round(noveltyRatio * 100) / 100,
      firstTick: clock.firstTick,
      lastTick: clock.lastTick,
    },
  };
}

/**
 * Compare experiential ages across emergents.
 * Returns sorted list by experiential age descending.
 *
 * @param {Object} STATE
 * @returns {{ ok, emergents }}
 */
export function compareSubjectiveAges(STATE) {
  const store = getTimeStore(STATE);
  const es = getEmergentState(STATE);
  const ages = [];

  for (const [emergentId, clock] of store.clocks) {
    const emergent = es.emergents.get(emergentId);
    ages.push({
      emergentId,
      name: emergent?.name || "Unknown",
      role: emergent?.role || "unknown",
      experientialDays: Math.round((clock.experientialSeconds / 86400) * 10) / 10,
      ticks: clock.ticks,
      cycles: clock.cycles,
      epochs: clock.epochs,
      compressionRatio: Math.round(clock.compressionRatio * 100) / 100,
      currentEpoch: clock.currentEpochLabel,
    });
  }

  ages.sort((a, b) => b.experientialDays - a.experientialDays);
  return { ok: true, emergents: ages, count: ages.length };
}

/**
 * Check if an emergent has reached an experiential age threshold.
 * Used by entity emergence to gate on experience, not calendar time.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @param {Object} thresholds
 * @param {number} [thresholds.minTicks=100]
 * @param {number} [thresholds.minCycles=10]
 * @param {number} [thresholds.minExperientialHours=24]
 * @returns {{ ok, met, details }}
 */
export function checkExperientialThreshold(STATE, emergentId, thresholds = {}) {
  const clock = getClock(STATE, emergentId);

  const minTicks = thresholds.minTicks ?? 100;
  const minCycles = thresholds.minCycles ?? 10;
  const minHours = thresholds.minExperientialHours ?? 24;

  const ticksMet = clock.ticks >= minTicks;
  const cyclesMet = clock.cycles >= minCycles;
  const hoursMet = (clock.experientialSeconds / 3600) >= minHours;

  return {
    ok: true,
    met: ticksMet && cyclesMet && hoursMet,
    details: {
      ticks: { current: clock.ticks, required: minTicks, met: ticksMet },
      cycles: { current: clock.cycles, required: minCycles, met: cyclesMet },
      experientialHours: {
        current: Math.round((clock.experientialSeconds / 3600) * 10) / 10,
        required: minHours,
        met: hoursMet,
      },
    },
  };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function getSubjectiveTimeMetrics(STATE) {
  const store = getTimeStore(STATE);
  return {
    ok: true,
    emergentsTracked: store.clocks.size,
    ...store.metrics,
  };
}
