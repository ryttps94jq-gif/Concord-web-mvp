/**
 * Concord ATS — Affective Translation Spine Tests
 * Run: node --test tests/affect.test.js
 *
 * Tests: bounds, invariants, decay, hysteresis, policy monotonicity.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay, enforceInvariants, resetState } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel, projectToneTags } from '../affect/projection.js';
import { validateEvent } from '../affect/schema.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';

// ============= Bounds Tests =============

describe('Bounds & Invariants', () => {
  it('Values never exceed ranges after 10k random events', () => {
    const E = createState();
    const M = createMomentum();
    const types = ["USER_MESSAGE", "SYSTEM_RESULT", "ERROR", "SUCCESS", "TIMEOUT", "CONFLICT", "SAFETY_BLOCK", "GOAL_PROGRESS", "TOOL_RESULT", "FEEDBACK"];

    for (let i = 0; i < 10000; i++) {
      const event = {
        type: types[Math.floor(Math.random() * types.length)],
        intensity: Math.random(),
        polarity: Math.random() * 2 - 1,
        payload: {},
        source: {},
      };
      applyEvent(E, M, event);
    }

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo, `${dim} should be >= ${lo}, got ${E[dim]}`);
      assert(E[dim] <= hi, `${dim} should be <= ${hi}, got ${E[dim]}`);
    }
  });

  it('Non-negative valence invariant: v never goes below 0', () => {
    const E = createState();
    const M = createMomentum();

    // Hammer with negative events
    for (let i = 0; i < 1000; i++) {
      applyEvent(E, M, {
        type: "ERROR",
        intensity: 1.0,
        polarity: -1.0,
        payload: {},
        source: {},
      });
      assert(E.v >= 0, `Valence should never be negative, got ${E.v} at iteration ${i}`);
    }
  });

  it('enforceInvariants clamps out-of-range values', () => {
    const E = { v: -5, a: 2, s: -0.1, c: 1.5, g: 0.5, t: 0.5, f: 0.5, ts: Date.now() };
    enforceInvariants(E);

    assert.strictEqual(E.v, 0);
    assert.strictEqual(E.a, 1);
    assert.strictEqual(E.s, 0);
    assert.strictEqual(E.c, 1);
  });
});

// ============= Decay Tests =============

describe('Decay Dynamics', () => {
  it('State returns toward baseline over time', () => {
    const E = createState();
    E.v = 0.1;   // low valence
    E.a = 0.9;   // high arousal
    E.f = 0.8;   // high fatigue
    E.ts = Date.now() - 60000; // 60 seconds ago

    const _M = createMomentum();

    // Simulate 60s of decay
    applyDecay(E, 60000);

    // Should move toward baseline
    assert(E.v > 0.1, `Valence should increase toward baseline (${BASELINE.v}), got ${E.v}`);
    assert(E.a < 0.9, `Arousal should decrease toward baseline (${BASELINE.a}), got ${E.a}`);
    assert(E.f < 0.8, `Fatigue should decrease toward baseline (${BASELINE.f}), got ${E.f}`);
  });

  it('Long decay converges close to baseline', () => {
    const E = createState();
    E.v = 0.0;
    E.a = 1.0;
    E.s = 0.0;
    E.ts = Date.now();

    // Simulate 1 hour of decay
    applyDecay(E, 3600000);

    for (const dim of DIMS) {
      const diff = Math.abs(E[dim] - BASELINE[dim]);
      assert(diff < 0.15, `${dim} should be close to baseline after 1 hour, diff=${diff.toFixed(4)}`);
    }
  });
});

// ============= Hysteresis Tests =============

describe('Hysteresis / Path Dependence', () => {
  it('Same event yields different delta depending on momentum', () => {
    const event = {
      type: "SUCCESS",
      intensity: 0.7,
      polarity: 0.5,
      payload: {},
      source: {},
    };

    // Path A: fresh state
    const E1 = createState();
    const M1 = createMomentum();
    const r1 = applyEvent(E1, M1, event);

    // Path B: state with built-up negative momentum
    const E2 = createState();
    const M2 = createMomentum();
    // Build negative momentum with errors first
    for (let i = 0; i < 5; i++) {
      applyEvent(E2, M2, {
        type: "ERROR",
        intensity: 0.8,
        polarity: -0.7,
        payload: {},
        source: {},
      });
    }
    // Now apply the same success event
    const r2 = applyEvent(E2, M2, event);

    // The deltas should differ due to momentum
    let anyDifferent = false;
    for (const dim of DIMS) {
      if (Math.abs((r1.delta[dim] || 0) - (r2.delta[dim] || 0)) > 0.001) {
        anyDifferent = true;
        break;
      }
    }
    assert(anyDifferent, 'Same event should produce different deltas with different momentum');
  });
});

// ============= Policy Monotonicity Tests =============

describe('Policy Mapping', () => {
  it('Higher fatigue → lower depth budget', () => {
    const lowFatigue = { ...createState(), f: 0.1 };
    const highFatigue = { ...createState(), f: 0.9 };

    const p1 = getAffectPolicy(lowFatigue);
    const p2 = getAffectPolicy(highFatigue);

    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      `Low fatigue depth (${p1.cognition.depthBudget}) should exceed high fatigue (${p2.cognition.depthBudget})`);
  });

  it('Higher fatigue → higher caution', () => {
    const lowFatigue = { ...createState(), f: 0.1 };
    const highFatigue = { ...createState(), f: 0.9 };

    const p1 = getAffectPolicy(lowFatigue);
    const p2 = getAffectPolicy(highFatigue);

    assert(p2.style.caution >= p1.style.caution,
      `High fatigue caution (${p2.style.caution}) should >= low fatigue (${p1.style.caution})`);
  });

  it('Lower trust → higher safety strictness', () => {
    const highTrust = { ...createState(), t: 0.9 };
    const lowTrust = { ...createState(), t: 0.1 };

    const p1 = getAffectPolicy(highTrust);
    const p2 = getAffectPolicy(lowTrust);

    assert(p2.safety.strictness > p1.safety.strictness,
      `Low trust strictness (${p2.safety.strictness}) should exceed high trust (${p1.safety.strictness})`);
  });

  it('Higher agency → more exploration', () => {
    const lowAgency = { ...createState(), g: 0.1 };
    const highAgency = { ...createState(), g: 0.9 };

    const p1 = getAffectPolicy(lowAgency);
    const p2 = getAffectPolicy(highAgency);

    assert(p2.cognition.exploration > p1.cognition.exploration,
      `High agency exploration (${p2.cognition.exploration}) should exceed low agency (${p1.cognition.exploration})`);
  });

  it('Policy values are all within [0, 1] (except latencyBudgetMs)', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    for (const [cat, values] of Object.entries(policy)) {
      for (const [key, val] of Object.entries(values)) {
        if (key === "latencyBudgetMs") {
          assert(val >= 1000 && val <= 15000, `${cat}.${key} should be in [1000, 15000], got ${val}`);
        } else {
          assert(val >= 0 && val <= 1, `${cat}.${key} should be in [0, 1], got ${val}`);
        }
      }
    }
  });
});

// ============= Projection Tests =============

describe('Projection Layer', () => {
  it('Returns valid labels for various states', () => {
    const states = [
      { ...createState(), f: 0.9 },                          // fatigued
      { ...createState(), c: 0.2 },                          // uncertain
      { ...createState(), g: 0.9, v: 0.8 },                  // motivated
      { ...createState(), a: 0.8, v: 0.8 },                  // energized
      { ...createState(), a: 0.15, s: 0.9 },                 // calm
    ];

    for (const E of states) {
      const label = projectLabel(E);
      assert(typeof label === 'string' && label.length > 0, `Should return non-empty label, got "${label}"`);
    }
  });

  it('Returns tone tags as string array', () => {
    const E = createState();
    const tags = projectToneTags(E);

    assert(Array.isArray(tags), 'Tags should be an array');
    for (const tag of tags) {
      assert(typeof tag === 'string', `Each tag should be a string, got ${typeof tag}`);
    }
  });
});

// ============= Validation Tests =============

describe('Schema Validation', () => {
  it('Accepts valid events', () => {
    const result = validateEvent({
      type: "SUCCESS",
      intensity: 0.5,
      polarity: 0.3,
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.event.type, "SUCCESS");
  });

  it('Rejects invalid event types', () => {
    const result = validateEvent({
      type: "INVALID_TYPE",
      intensity: 0.5,
    });
    assert.strictEqual(result.ok, false);
  });

  it('Clamps intensity to [0, 1]', () => {
    const result = validateEvent({
      type: "SUCCESS",
      intensity: 5.0,
    });
    if (result.ok) {
      assert(result.event.intensity <= 1, 'Intensity should be clamped to 1');
    }
  });
});

// ============= Reset Tests =============

describe('Reset Functionality', () => {
  it('Baseline reset returns to default values', () => {
    const { E } = resetState("baseline");

    for (const dim of DIMS) {
      assert.strictEqual(E[dim], BASELINE[dim], `${dim} should match baseline after reset`);
    }
  });

  it('Cooldown reset has lower arousal and higher stability', () => {
    const { E } = resetState("cooldown");

    assert(E.a < BASELINE.a, 'Cooldown arousal should be below baseline');
    assert(E.s >= BASELINE.s, 'Cooldown stability should be at or above baseline');
    assert.strictEqual(E.meta.mode, "cooldown");
  });
});
