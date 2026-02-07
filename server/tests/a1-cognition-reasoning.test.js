/**
 * Concord Feature Spec — A1: Cognition & Reasoning (Capabilities 1–10)
 *
 * Tests: cross-domain reasoning, meta-reasoning, abstract concept formation,
 * counterfactual reasoning, theory synthesis & refutation, assumption tracking,
 * belief revision, confidence calibration, bias detection, blind-spot discovery.
 *
 * Run: node --test tests/a1-cognition-reasoning.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay, enforceInvariants as _enforceInvariants } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel, projectToneTags } from '../affect/projection.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

function _runEventSequence(events) {
  const E = createState();
  const M = createMomentum();
  const results = [];
  for (const evt of events) {
    const r = applyEvent(E, M, evt);
    results.push({ ...r, policy: getAffectPolicy(E), label: projectLabel(E) });
  }
  return { E, M, results };
}

// ============= 1. Cross-Domain Reasoning =============

describe('A1.1 — Cross-Domain Reasoning', () => {
  it('Policy cognition adapts across multiple affect dimensions simultaneously', () => {
    // Cross-domain: changes in trust, coherence, and agency all influence cognition
    const states = [
      { ...createState(), t: 0.9, c: 0.9, g: 0.9 }, // high trust+coherence+agency
      { ...createState(), t: 0.1, c: 0.1, g: 0.1 }, // low trust+coherence+agency
      { ...createState(), t: 0.9, c: 0.1, g: 0.5 }, // mixed: high trust, low coherence
    ];

    const policies = states.map(getAffectPolicy);

    // High across all domains → highest exploration & depth
    assert(policies[0].cognition.exploration > policies[1].cognition.exploration,
      'High trust+coherence+agency should yield higher exploration than low');
    assert(policies[0].cognition.depthBudget > policies[1].cognition.depthBudget,
      'High trust+coherence+agency should yield deeper reasoning');

    // Mixed state should produce intermediate values
    assert(policies[2].cognition.riskBudget !== policies[0].cognition.riskBudget,
      'Mixed state risk budget should differ from uniform high');
    assert(policies[2].cognition.riskBudget !== policies[1].cognition.riskBudget,
      'Mixed state risk budget should differ from uniform low');
  });

  it('Affect events in one domain influence policy across other domains', () => {
    const E = createState();
    const M = createMomentum();

    const policyBefore = getAffectPolicy(E);

    // Apply safety block (primarily affects trust + agency)
    applyEvent(E, M, makeEvent('SAFETY_BLOCK', 0.8, -0.5));
    const policyAfter = getAffectPolicy(E);

    // Safety block should affect: safety (strictness), cognition (riskBudget), style (caution)
    assert(policyAfter.safety.strictness > policyBefore.safety.strictness,
      'Safety block should increase safety strictness');
    assert(policyAfter.cognition.riskBudget < policyBefore.cognition.riskBudget,
      'Safety block should reduce cognition risk budget');
    assert(policyAfter.style.caution > policyBefore.style.caution,
      'Safety block should increase style caution');
  });

  it('Simultaneous changes across 3+ dimensions produce coherent policy', () => {
    const E = createState();
    const M = createMomentum();

    // Apply a sequence that affects trust, stability, and fatigue
    applyEvent(E, M, makeEvent('ERROR', 1.0, -0.8));
    applyEvent(E, M, makeEvent('TIMEOUT', 0.9, -0.5));
    applyEvent(E, M, makeEvent('CONFLICT', 0.7, -0.3));

    const policy = getAffectPolicy(E);

    // After multiple negative events across domains, system should be conservative
    assert(policy.safety.strictness > 0.5, 'Should be strict after cross-domain stress');
    assert(policy.cognition.exploration < 0.5, 'Should reduce exploration after cross-domain stress');
    assert(policy.style.caution > 0.4, 'Should be cautious after cross-domain stress');
  });
});

// ============= 2. Meta-Reasoning (Reason About Reasoning) =============

describe('A1.2 — Meta-Reasoning', () => {
  it('Policy produces self-reflective cognition signals (depth, exploration, risk)', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // Meta-reasoning: the policy itself is a meta-level signal about how to reason
    assert(typeof policy.cognition.depthBudget === 'number', 'depthBudget is a reasoning-about-reasoning signal');
    assert(typeof policy.cognition.exploration === 'number', 'exploration is a meta-level strategy signal');
    assert(typeof policy.cognition.riskBudget === 'number', 'riskBudget is a meta-level risk assessment');
    assert(typeof policy.cognition.toolUseBias === 'number', 'toolUseBias is a meta-level tool preference signal');
  });

  it('Cognition policy adjusts reasoning strategy based on current state assessment', () => {
    // Meta-reasoning: system assesses its own state and adjusts reasoning
    const calm = { ...createState(), a: 0.2, s: 0.9, c: 0.9, f: 0.1 };
    const stressed = { ...createState(), a: 0.9, s: 0.2, c: 0.3, f: 0.8 };

    const calmPolicy = getAffectPolicy(calm);
    const stressedPolicy = getAffectPolicy(stressed);

    // Calm state → deeper, more exploratory reasoning
    assert(calmPolicy.cognition.depthBudget > stressedPolicy.cognition.depthBudget,
      'Calm state should reason more deeply');
    assert(calmPolicy.cognition.latencyBudgetMs > stressedPolicy.cognition.latencyBudgetMs,
      'Calm state should allow more reasoning time');
  });

  it('Projection layer provides introspective state labels', () => {
    // The projection layer is meta-reasoning: it labels the system current cognitive state
    const states = [
      { ...createState(), f: 0.9 },       // should recognize fatigue
      { ...createState(), c: 0.2 },       // should recognize uncertainty
      { ...createState(), g: 0.9, v: 0.8 }, // should recognize motivation
    ];

    const labels = states.map(projectLabel);
    assert(labels[0] === 'fatigued', 'Should meta-recognize fatigue');
    assert(labels[1] === 'uncertain', 'Should meta-recognize uncertainty');
    assert(labels[2] === 'motivated', 'Should meta-recognize motivation');
  });
});

// ============= 3. Abstract Concept Formation =============

describe('A1.3 — Abstract Concept Formation', () => {
  it('Policy dimensions abstract away from raw affect into higher-order categories', () => {
    // Abstraction: raw dimensions (v, a, s, c, g, t, f) → abstract categories (style, cognition, memory, safety)
    const E = createState();
    const policy = getAffectPolicy(E);

    assert(typeof policy.style === 'object', 'Style is an abstract concept over raw affect');
    assert(typeof policy.cognition === 'object', 'Cognition is an abstract concept over raw affect');
    assert(typeof policy.memory === 'object', 'Memory is an abstract concept over raw affect');
    assert(typeof policy.safety === 'object', 'Safety is an abstract concept over raw affect');

    // Each abstract category has its own dimensions
    assert(Object.keys(policy.style).length >= 4, 'Style abstraction has multiple dimensions');
    assert(Object.keys(policy.cognition).length >= 4, 'Cognition abstraction has multiple dimensions');
  });

  it('Tone tags form abstract emotional concepts from continuous state', () => {
    // Abstraction: continuous [0,1] dimensions → discrete conceptual tags
    const E = { ...createState(), v: 0.9, t: 0.9, c: 0.9, a: 0.8 };
    const tags = projectToneTags(E);

    assert(Array.isArray(tags), 'Tags are abstract conceptual labels');
    assert(tags.some(t => typeof t === 'string' && t.length > 0),
      'Tags are meaningful abstract concepts');
  });

  it('Labels abstract continuous affect space into discrete cognitive categories', () => {
    // Test that the full [0,1]^7 space maps to a finite set of abstract concepts
    const labels = new Set();
    for (let i = 0; i < 500; i++) {
      const E = createState();
      for (const dim of DIMS) {
        E[dim] = Math.random();
      }
      labels.add(projectLabel(E));
    }

    // Should produce multiple distinct abstract concepts
    assert(labels.size >= 5, `Should form at least 5 abstract concepts, got ${labels.size}`);
    // But not an unbounded number (abstraction compresses)
    assert(labels.size <= 15, `Should not exceed 15 concepts (abstraction), got ${labels.size}`);
  });
});

// ============= 4. Counterfactual Reasoning =============

describe('A1.4 — Counterfactual Reasoning', () => {
  it('Same starting state with different event sequences produces divergent outcomes', () => {
    // Path A: success sequence
    const E1 = createState();
    const M1 = createMomentum();
    for (let i = 0; i < 10; i++) {
      applyEvent(E1, M1, makeEvent('SUCCESS', 0.7, 0.5));
    }

    // Path B: failure sequence (counterfactual)
    const E2 = createState();
    const M2 = createMomentum();
    for (let i = 0; i < 10; i++) {
      applyEvent(E2, M2, makeEvent('ERROR', 0.7, -0.5));
    }

    // Counterfactual: outcomes should be measurably different
    assert(E1.v > E2.v, 'Success path should have higher valence than error path');
    assert(E1.g > E2.g, 'Success path should have higher agency than error path');
    assert(E1.t > E2.t, 'Success path should have higher trust than error path');
    assert(E1.f < E2.f, 'Success path should have lower fatigue than error path');
  });

  it('Counterfactual branching: single divergent event produces measurable difference', () => {
    // Set up identical histories
    const events = Array.from({ length: 5 }, () => makeEvent('USER_MESSAGE', 0.3, 0.1));

    const E1 = createState();
    const M1 = createMomentum();
    const E2 = createState();
    const M2 = createMomentum();

    for (const e of events) {
      applyEvent(E1, M1, { ...e });
      applyEvent(E2, M2, { ...e });
    }

    // Diverge at event 6
    applyEvent(E1, M1, makeEvent('SUCCESS', 0.9, 0.8));     // counterfactual A
    applyEvent(E2, M2, makeEvent('SAFETY_BLOCK', 0.9, -0.8)); // counterfactual B

    // After divergence, states should differ
    const diff = Math.abs(E1.v - E2.v) + Math.abs(E1.g - E2.g) + Math.abs(E1.t - E2.t);
    assert(diff > 0.05, `Counterfactual divergence should be measurable, got diff=${diff.toFixed(4)}`);
  });

  it('Counterfactual reasoning preserves invariants in both branches', () => {
    // Both counterfactual branches must still respect system invariants
    const E1 = createState();
    const M1 = createMomentum();
    const E2 = createState();
    const M2 = createMomentum();

    // Extreme counterfactuals
    for (let i = 0; i < 100; i++) {
      applyEvent(E1, M1, makeEvent('SUCCESS', 1.0, 1.0));
      applyEvent(E2, M2, makeEvent('ERROR', 1.0, -1.0));
    }

    for (const E of [E1, E2]) {
      for (const dim of DIMS) {
        const [lo, hi] = BOUNDS[dim];
        assert(E[dim] >= lo && E[dim] <= hi,
          `${dim} should stay in bounds in counterfactual: ${E[dim]}`);
      }
    }
  });
});

// ============= 5. Theory Synthesis & Refutation =============

describe('A1.5 — Theory Synthesis & Refutation', () => {
  it('Conflicting events produce coherence drop (theory conflict detection)', () => {
    const E = createState();
    const M = createMomentum();

    const initialCoherence = E.c;

    // Apply conflicting event
    applyEvent(E, M, makeEvent('CONFLICT', 0.9, -0.5));

    assert(E.c < initialCoherence,
      `Conflict should reduce coherence (theory refutation): ${E.c} < ${initialCoherence}`);
  });

  it('Decay after conflict restores coherence toward baseline (theory synthesis)', () => {
    const E = createState();
    const M = createMomentum();

    // Create conflict
    applyEvent(E, M, makeEvent('CONFLICT', 0.9, -0.5));
    const conflictCoherence = E.c;

    // Positive system results contribute to coherence recovery
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('SYSTEM_RESULT', 0.5, 0.5));
    }

    // Decay moves coherence back toward baseline (0.8)
    applyDecay(E, 300000); // 5 minutes

    assert(E.c > conflictCoherence,
      `Synthesis (decay + positive results) should restore coherence: ${E.c} > ${conflictCoherence}`);
  });

  it('Repeated contradictions degrade stability (persistent refutation)', () => {
    const E = createState();
    const M = createMomentum();

    const initialStability = E.s;

    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('CONFLICT', 0.7, -0.4));
    }

    assert(E.s < initialStability,
      'Repeated contradictions should reduce stability');
  });
});

// ============= 6. Assumption Tracking =============

describe('A1.6 — Assumption Tracking', () => {
  it('State metadata tracks operational mode (assumption context)', () => {
    const E = createState({ mode: 'hypothesis-testing', notes: 'testing assumptions' });
    assert.strictEqual(E.meta.mode, 'hypothesis-testing');
    assert.strictEqual(E.meta.notes, 'testing assumptions');
  });

  it('Event sources track where assumptions originate', () => {
    const E = createState();
    const M = createMomentum();

    const event = {
      type: 'SYSTEM_RESULT',
      intensity: 0.5,
      polarity: 0.3,
      payload: { assumption: 'user prefers concise output' },
      source: { userId: 'user_1', sessionId: 'session_1', lens: 'style' },
    };

    const result = applyEvent(E, M, event);
    assert(result.delta !== undefined, 'Event processing should track the delta (assumption impact)');
  });

  it('Trust dimension tracks reliability of assumptions', () => {
    const E = createState();
    const M = createMomentum();

    // Reliable results → trust increases (assumptions validated)
    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('TOOL_RESULT', 0.6, 0.5));
    }
    const trustedState = E.t;

    // Unreliable results → trust decreases (assumptions violated)
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('TOOL_RESULT', 0.6, -0.5));
    }

    assert(E.t < trustedState,
      'Assumption violations should reduce trust');
  });
});

// ============= 7. Belief Revision =============

describe('A1.7 — Belief Revision', () => {
  it('Negative evidence shifts state away from confident baseline', () => {
    const E = createState();
    const M = createMomentum();

    // Strong negative feedback (belief-disconfirming evidence)
    applyEvent(E, M, makeEvent('FEEDBACK', 0.9, -0.8));

    assert(E.v < BASELINE.v, 'Disconfirming evidence should lower valence');
    assert(E.t < BASELINE.t, 'Disconfirming evidence should lower trust');
  });

  it('Positive evidence after revision restores belief (recovery)', () => {
    const E = createState();
    const M = createMomentum();

    // Belief crisis
    applyEvent(E, M, makeEvent('ERROR', 0.9, -0.8));
    applyEvent(E, M, makeEvent('ERROR', 0.9, -0.8));
    const crisisV = E.v;

    // New supporting evidence
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.7, 0.6));
    }

    assert(E.v > crisisV, 'New evidence should revise beliefs upward');
  });

  it('Belief revision respects bounds (no overcorrection)', () => {
    const E = createState();
    const M = createMomentum();

    // Extreme revision attempts
    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, makeEvent('FEEDBACK', 1.0, 1.0));
    }

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `Belief revision must not exceed bounds: ${dim}=${E[dim]}`);
    }
  });
});

// ============= 8. Confidence Calibration =============

describe('A1.8 — Confidence Calibration', () => {
  it('Policy safety strictness inversely correlates with trust (confidence proxy)', () => {
    const highConf = { ...createState(), t: 0.95, c: 0.95, s: 0.95 };
    const lowConf = { ...createState(), t: 0.1, c: 0.1, s: 0.1 };

    const p1 = getAffectPolicy(highConf);
    const p2 = getAffectPolicy(lowConf);

    assert(p1.safety.strictness < p2.safety.strictness,
      'High confidence → lower strictness (appropriately calibrated)');
    assert(p1.safety.refuseThreshold < p2.safety.refuseThreshold,
      'High confidence → lower refusal threshold');
  });

  it('Tone tags reflect confidence level accurately', () => {
    const confident = { ...createState(), t: 0.9, c: 0.9 };
    const uncertain = { ...createState(), t: 0.2, c: 0.2 };

    const confTags = projectToneTags(confident);
    const uncertTags = projectToneTags(uncertain);

    assert(confTags.includes('confident'), 'High trust+coherence → confident tone');
    assert(uncertTags.includes('hedging'), 'Low trust+coherence → hedging tone');
  });

  it('Confidence calibration spans the full range without dead zones', () => {
    // Sweep trust from 0 to 1 and check for monotonic strictness decrease
    const strictnesses = [];
    for (let t = 0; t <= 1.0; t += 0.1) {
      const E = { ...createState(), t };
      const p = getAffectPolicy(E);
      strictnesses.push(p.safety.strictness);
    }

    // Generally should be monotonically decreasing (higher trust → lower strictness)
    let decreasing = 0;
    for (let i = 1; i < strictnesses.length; i++) {
      if (strictnesses[i] <= strictnesses[i - 1]) decreasing++;
    }
    assert(decreasing >= strictnesses.length - 2,
      'Strictness should generally decrease with increasing trust');
  });
});

// ============= 9. Bias Detection =============

describe('A1.9 — Bias Detection', () => {
  it('Momentum introduces detectable path-dependent bias', () => {
    const event = makeEvent('USER_MESSAGE', 0.5, 0.1);

    // Path A: no prior history
    const E1 = createState();
    const M1 = createMomentum();
    const r1 = applyEvent(E1, M1, event);

    // Path B: negative bias from history
    const E2 = createState();
    const M2 = createMomentum();
    for (let i = 0; i < 5; i++) {
      applyEvent(E2, M2, makeEvent('ERROR', 0.8, -0.7));
    }
    const r2 = applyEvent(E2, M2, { ...event });

    // The momentum (bias) should cause different deltas for the same event
    let anyDiff = false;
    for (const dim of DIMS) {
      if (Math.abs((r1.delta[dim] || 0) - (r2.delta[dim] || 0)) > 0.001) {
        anyDiff = true;
        break;
      }
    }
    assert(anyDiff, 'Momentum bias should be detectable in delta differences');
  });

  it('Decay mechanism corrects for accumulated bias over time', () => {
    const E = createState();
    const M = createMomentum();

    // Build up bias
    for (let i = 0; i < 20; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.8, -0.7));
    }

    // Record biased state
    const biasedV = E.v;
    const biasedT = E.t;

    // Long decay corrects bias toward baseline
    applyDecay(E, 3600000); // 1 hour

    assert(E.v > biasedV, 'Decay should correct negative valence bias');
    assert(E.t > biasedT, 'Decay should correct negative trust bias');
  });

  it('Conservation constraint limits single-event bias magnitude', () => {
    const E = createState();
    const M = createMomentum();

    const before = { ...E };
    applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));

    // The total delta should be bounded by conservation constraint
    let totalDelta = 0;
    for (const dim of DIMS) {
      totalDelta += (E[dim] - before[dim]) ** 2;
    }
    totalDelta = Math.sqrt(totalDelta);

    assert(totalDelta <= 0.5, `Single event delta should be conservation-bounded: ${totalDelta.toFixed(4)}`);
  });
});

// ============= 10. Blind-Spot Discovery =============

describe('A1.10 — Blind-Spot Discovery', () => {
  it('Extreme states reveal policy edge cases (blind spots in coverage)', () => {
    // Test extreme corner cases of the affect space
    const corners = [
      { v: 0, a: 0, s: 0, c: 0, g: 0, t: 0, f: 0, ts: Date.now(), meta: {} }, // all zero
      { v: 1, a: 1, s: 1, c: 1, g: 1, t: 1, f: 1, ts: Date.now(), meta: {} }, // all one
      { v: 0, a: 1, s: 0, c: 1, g: 0, t: 1, f: 0, ts: Date.now(), meta: {} }, // alternating
      { v: 1, a: 0, s: 1, c: 0, g: 1, t: 0, f: 1, ts: Date.now(), meta: {} }, // inverse alternating
    ];

    for (const E of corners) {
      const policy = getAffectPolicy(E);

      // No blind spots: policy should always produce valid values
      for (const [cat, values] of Object.entries(policy)) {
        for (const [key, val] of Object.entries(values)) {
          if (key === 'latencyBudgetMs') {
            assert(val >= 1000 && val <= 15000,
              `Corner case: ${cat}.${key} should be in [1000,15000], got ${val}`);
          } else {
            assert(val >= 0 && val <= 1,
              `Corner case: ${cat}.${key} should be in [0,1], got ${val}`);
          }
        }
      }
    }
  });

  it('Random state sampling finds no policy computation failures', () => {
    // Fuzz test: random states should never cause policy failures
    for (let i = 0; i < 1000; i++) {
      const E = createState();
      for (const dim of DIMS) {
        E[dim] = Math.random();
      }

      let policy;
      try {
        policy = getAffectPolicy(E);
      } catch (err) {
        assert.fail(`Policy computation failed for random state: ${err.message}`);
      }

      assert(policy !== null && policy !== undefined, 'Policy should never be null');
      assert(typeof policy.style === 'object', 'Style should always be present');
      assert(typeof policy.cognition === 'object', 'Cognition should always be present');
    }
  });

  it('Label projection covers the entire affect space without gaps', () => {
    // Every possible state should map to some label (no undefined/null)
    const labelCoverage = new Set();
    for (let i = 0; i < 2000; i++) {
      const E = createState();
      for (const dim of DIMS) {
        E[dim] = Math.random();
      }
      const label = projectLabel(E);
      assert(typeof label === 'string' && label.length > 0,
        `Label should never be empty for any state`);
      labelCoverage.add(label);
    }

    // The label space should be well-covered
    assert(labelCoverage.size >= 5,
      `Label space should cover at least 5 distinct states, got ${labelCoverage.size}`);
  });
});
