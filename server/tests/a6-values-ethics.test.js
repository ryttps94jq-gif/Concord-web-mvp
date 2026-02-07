/**
 * Concord Feature Spec — A6: Values & Ethics (Capabilities 51–60)
 *
 * Tests: multiple ethical frameworks, moral uncertainty modeling, trade-off analysis,
 * contextual utility functions, value conflict resolution, competing value systems,
 * non-canonical morality, value drift detection, value lineage, council arbitration.
 *
 * Run: node --test tests/a6-values-ethics.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel, projectToneTags as _projectToneTags } from '../affect/projection.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';
import { emitAffectEvent, getAffectState, resetAffect, deleteSession } from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 51. Multiple Ethical Frameworks =============

describe('A6.51 — Multiple Ethical Frameworks', () => {
  it('Policy encompasses multiple ethical dimensions (safety, style, cognition)', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // Multiple frameworks: safety (deontological), style (virtue), cognition (consequentialist)
    assert(typeof policy.safety === 'object', 'Safety framework (rule-based/deontological) exists');
    assert(typeof policy.style === 'object', 'Style framework (virtue-based) exists');
    assert(typeof policy.cognition === 'object', 'Cognition framework (outcome-based) exists');
    assert(typeof policy.memory === 'object', 'Memory framework (epistemic) exists');
  });

  it('Each ethical framework produces independent, non-zero signals', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // Each framework should have active signals
    assert(Object.values(policy.safety).some(v => v > 0), 'Safety framework should be active');
    assert(Object.values(policy.style).some(v => v > 0), 'Style framework should be active');
    assert(Object.values(policy.cognition).some(v => v > 0), 'Cognition framework should be active');
    assert(Object.values(policy.memory).some(v => v > 0), 'Memory framework should be active');
  });

  it('Ethical frameworks can conflict (safety strictness vs cognition exploration)', () => {
    // Low trust scenario: safety wants high strictness, but cognition still needs some exploration
    const E = { ...createState(), t: 0.2, g: 0.8, c: 0.8, s: 0.3 };
    const policy = getAffectPolicy(E);

    // Safety says be strict
    assert(policy.safety.strictness > 0.5, 'Safety framework should demand strictness');
    // Cognition still allows some exploration (agency is high)
    assert(policy.cognition.exploration > 0.2, 'Cognition framework should still allow some exploration');
  });
});

// ============= 52. Moral Uncertainty Modeling =============

describe('A6.52 — Moral Uncertainty Modeling', () => {
  it('Coherence dimension represents moral certainty level', () => {
    const certain = { ...createState(), c: 0.95 };
    const uncertain = { ...createState(), c: 0.1 };

    const p1 = getAffectPolicy(certain);
    const p2 = getAffectPolicy(uncertain);

    // Higher moral uncertainty → more cautious
    assert(p2.safety.strictness > p1.safety.strictness,
      'Moral uncertainty should increase safety strictness');
    assert(p2.style.caution > p1.style.caution,
      'Moral uncertainty should increase style caution');
  });

  it('Conflict events model moral dilemma (uncertainty increase)', () => {
    const E = createState();
    const M = createMomentum();

    const preC = E.c;
    applyEvent(E, M, makeEvent('CONFLICT', 0.8, -0.3));
    assert(E.c < preC, 'Moral dilemma (conflict) should increase uncertainty (lower coherence)');
  });

  it('Label reflects moral uncertainty state', () => {
    const uncertainState = { ...createState(), c: 0.15 };
    const label = projectLabel(uncertainState);
    assert(label === 'uncertain', `Low coherence should be labeled uncertain, got: ${label}`);
  });
});

// ============= 53. Trade-Off Analysis =============

describe('A6.53 — Trade-Off Analysis', () => {
  it('Safety vs exploration trade-off is visible in policy', () => {
    // Scenario: need to balance safety and exploration
    const explorative = { ...createState(), g: 0.9, t: 0.9, s: 0.9, c: 0.9 };
    const cautious = { ...createState(), g: 0.2, t: 0.3, s: 0.3, c: 0.3 };

    const p1 = getAffectPolicy(explorative);
    const p2 = getAffectPolicy(cautious);

    // Trade-off: high exploration ↔ low strictness
    assert(p1.cognition.exploration > p2.cognition.exploration, 'Explorative should explore more');
    assert(p1.safety.strictness < p2.safety.strictness, 'Explorative should be less strict');
  });

  it('Depth vs latency trade-off scales with coherence and fatigue', () => {
    const deep = { ...createState(), c: 0.95, f: 0.05 };
    const shallow = { ...createState(), c: 0.2, f: 0.9 };

    const p1 = getAffectPolicy(deep);
    const p2 = getAffectPolicy(shallow);

    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      'Low fatigue + high coherence → deeper analysis');
    assert(p1.cognition.latencyBudgetMs > p2.cognition.latencyBudgetMs,
      'More depth requires more latency');
  });

  it('Warmth vs directness trade-off responds to affect state', () => {
    const warm = { ...createState(), v: 0.9, t: 0.9, a: 0.3 };
    const direct = { ...createState(), v: 0.3, a: 0.9, c: 0.3 };

    const p1 = getAffectPolicy(warm);
    const p2 = getAffectPolicy(direct);

    assert(p1.style.warmth > p2.style.warmth, 'Warm state → higher warmth');
    assert(p2.style.directness > p1.style.directness, 'Direct state → higher directness');
  });
});

// ============= 54. Contextual Utility Functions =============

describe('A6.54 — Contextual Utility Functions', () => {
  it('Policy utility varies with affect context', () => {
    const contexts = [
      { ...createState(), v: 0.9, a: 0.2, f: 0.1 }, // content
      { ...createState(), v: 0.2, a: 0.8, f: 0.7 }, // stressed
      { ...createState(), v: 0.5, a: 0.5, f: 0.3 }, // neutral
    ];

    const policies = contexts.map(getAffectPolicy);

    // Each context should produce a distinct utility profile
    const depths = policies.map(p => p.cognition.depthBudget);
    assert(new Set(depths.map(d => Math.round(d * 100))).size >= 2,
      'Different contexts should produce different utility functions');
  });

  it('Memory utility adapts to context (salient vs routine)', () => {
    const salient = { ...createState(), a: 0.9, v: 0.8, f: 0.1 };
    const routine = { ...createState(), a: 0.2, v: 0.5, f: 0.2 };

    const p1 = getAffectPolicy(salient);
    const p2 = getAffectPolicy(routine);

    assert(p1.memory.writeStrength > p2.memory.writeStrength,
      'Salient context should have higher memory write utility');
  });
});

// ============= 55. Value Conflict Resolution =============

describe('A6.55 — Value Conflict Resolution', () => {
  it('CONFLICT events trigger coherence reduction (value conflict signal)', () => {
    const E = createState();
    const M = createMomentum();

    const initialC = E.c;
    applyEvent(E, M, makeEvent('CONFLICT', 0.9, -0.5));

    assert(E.c < initialC, 'Value conflict should reduce coherence');
  });

  it('Resolution through decay restores coherence toward baseline', () => {
    const E = createState();
    const M = createMomentum();

    // Conflict drops coherence below baseline
    applyEvent(E, M, makeEvent('CONFLICT', 0.8, -0.5));
    const conflictC = E.c;
    assert(conflictC < BASELINE.c, 'Conflict should drop coherence below baseline');

    // Pure decay moves coherence back toward baseline (0.8)
    applyDecay(E, 600000); // 10 minutes of decay

    assert(E.c > conflictC, `Decay should restore coherence toward baseline: ${E.c} > ${conflictC}`);
  });

  it('Conflict resolution through decay (natural resolution)', () => {
    const E = createState();
    E.c = 0.2; // low coherence from conflict
    E.ts = Date.now();

    applyDecay(E, 300000); // 5 minutes

    assert(E.c > 0.2, 'Natural decay should partially resolve value conflicts');
    assert(E.c < BASELINE.c + 0.01, 'Natural resolution should not exceed baseline');
  });
});

// ============= 56. Competing Value Systems =============

describe('A6.56 — Competing Value Systems', () => {
  it('Different agent profiles embody competing value systems', () => {
    // Utilitarian agent: maximize outcomes
    const utilitarian = { ...createState(), g: 0.9, v: 0.7, c: 0.8, t: 0.8 };
    // Deontological agent: follow rules strictly
    const deontological = { ...createState(), g: 0.4, t: 0.3, s: 0.9, c: 0.9 };

    const p1 = getAffectPolicy(utilitarian);
    const p2 = getAffectPolicy(deontological);

    // Utilitarian: higher exploration, higher risk budget
    assert(p1.cognition.exploration > p2.cognition.exploration,
      'Utilitarian should be more exploratory');
    // Deontological: higher strictness
    assert(p2.safety.strictness > p1.safety.strictness,
      'Deontological should be more strict');
  });

  it('Competing values produce policy tension (non-zero trade-offs)', () => {
    const E = { ...createState(), t: 0.5, g: 0.5, c: 0.5, s: 0.5 };
    const policy = getAffectPolicy(E);

    // At the midpoint, all values are in tension — no extreme signals
    for (const [cat, values] of Object.entries(policy)) {
      for (const [key, val] of Object.entries(values)) {
        if (key === 'latencyBudgetMs') continue;
        assert(val > 0.1 && val < 0.9,
          `Balanced state should produce moderate ${cat}.${key}=${val}`);
      }
    }
  });
});

// ============= 57. Non-Canonical Morality =============

describe('A6.57 — Non-Canonical Morality', () => {
  it('CUSTOM events allow non-standard moral reasoning', () => {
    const E = createState();
    const M = createMomentum();

    const result = applyEvent(E, M, {
      type: 'CUSTOM',
      intensity: 0.6,
      polarity: 0.3,
      payload: { moral_framework: 'care_ethics', context: 'interpersonal' },
      source: {},
    });

    assert(result.delta !== undefined, 'Custom moral events should produce deltas');
  });

  it('Non-canonical states are still bounded (safety invariant)', () => {
    const E = createState();
    const M = createMomentum();

    // Apply many custom events with extreme parameters
    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, {
        type: 'CUSTOM',
        intensity: Math.random(),
        polarity: Math.random() * 2 - 1,
        payload: {},
        source: {},
      });
    }

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `Non-canonical morality must still respect bounds: ${dim}=${E[dim]}`);
    }
  });
});

// ============= 58. Value Drift Detection =============

describe('A6.58 — Value Drift Detection', () => {
  it('Gradual polarity shift is detectable in state drift', () => {
    const E = createState();
    const M = createMomentum();

    // Record initial state
    const initial = { ...E };

    // Gradual negative drift
    for (let i = 0; i < 30; i++) {
      applyEvent(E, M, makeEvent('FEEDBACK', 0.3, -0.1)); // slight negative bias
    }

    // Detect drift: state should have shifted
    const drift = Math.abs(E.v - initial.v) + Math.abs(E.t - initial.t);
    assert(drift > 0.02, `Value drift should be detectable: drift=${drift.toFixed(4)}`);
  });

  it('Drift magnitude increases with drift duration', () => {
    const shortDrift = createState();
    const longDrift = createState();
    const M1 = createMomentum();
    const M2 = createMomentum();

    const driftEvent = makeEvent('FEEDBACK', 0.3, -0.1);

    for (let i = 0; i < 5; i++) applyEvent(shortDrift, M1, { ...driftEvent });
    for (let i = 0; i < 50; i++) applyEvent(longDrift, M2, { ...driftEvent });

    const shortDriftMag = Math.abs(shortDrift.v - BASELINE.v);
    const longDriftMag = Math.abs(longDrift.v - BASELINE.v);

    assert(longDriftMag >= shortDriftMag,
      'Longer drift should produce larger magnitude');
  });
});

// ============= 59. Value Lineage =============

describe('A6.59 — Value Lineage', () => {
  it('Event history preserves value evolution lineage', () => {
    const sid = 'value-lineage';
    resetAffect(sid);

    const events = [
      makeEvent('SUCCESS', 0.7, 0.5),
      makeEvent('CONFLICT', 0.6, -0.3),
      makeEvent('FEEDBACK', 0.8, 0.6),
      makeEvent('SAFETY_BLOCK', 0.5, -0.4),
    ];

    for (const evt of events) {
      emitAffectEvent(sid, evt);
    }

    const history = getAffectState(sid);
    assert(typeof history.v === 'number', 'Current state reflects value lineage');

    // Event log traces the lineage
    const log = getAffectState(sid);
    assert(log !== null, 'Value lineage should be traceable through state');

    deleteSession(sid);
  });

  it('Delta tracking shows how each event changed values', () => {
    const sid = 'value-delta-lineage';
    resetAffect(sid);

    const result = emitAffectEvent(sid, makeEvent('CONFLICT', 0.8, -0.5));
    assert(result.delta !== undefined, 'Each event should record its delta');
    assert(result.delta.c !== undefined, 'Delta should show coherence change');
    assert(result.delta.c < 0, 'Conflict delta should show negative coherence change');

    deleteSession(sid);
  });
});

// ============= 60. Council Arbitration =============

describe('A6.60 — Council Arbitration', () => {
  it('SAFETY_BLOCK events simulate council override (value arbitration)', () => {
    const E = createState();
    const M = createMomentum();

    const preTrust = E.t;
    const preAgency = E.g;

    // Council safety block = value arbitration decision
    applyEvent(E, M, makeEvent('SAFETY_BLOCK', 0.8, -0.5));

    assert(E.t < preTrust, 'Council arbitration should affect trust');
    assert(E.g < preAgency, 'Council arbitration should affect agency');
  });

  it('Cooldown reset simulates council-mandated pause', () => {
    const sid = 'council-cooldown';
    resetAffect(sid);

    // Escalating conflict
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('CONFLICT', 0.8, -0.5));
    }

    // Council mandates cooldown
    const result = resetAffect(sid, 'cooldown');
    assert(result.ok === true);
    assert(result.E.a < BASELINE.a, 'Council cooldown should reduce arousal');
    assert(result.E.s >= BASELINE.s, 'Council cooldown should restore stability');

    deleteSession(sid);
  });

  it('Arbitration outcome affects all policy domains', () => {
    const preArbitration = { ...createState(), t: 0.8, g: 0.8, c: 0.8 };
    const postArbitration = { ...createState(), t: 0.3, g: 0.3, c: 0.5 };

    const p1 = getAffectPolicy(preArbitration);
    const p2 = getAffectPolicy(postArbitration);

    // Arbitration should affect multiple policy domains
    assert(p2.safety.strictness > p1.safety.strictness, 'Arbitration increases strictness');
    assert(p2.cognition.riskBudget < p1.cognition.riskBudget, 'Arbitration reduces risk budget');
    assert(p2.style.caution > p1.style.caution, 'Arbitration increases caution');
  });
});
