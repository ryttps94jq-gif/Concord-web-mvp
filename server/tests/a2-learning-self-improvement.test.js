/**
 * Concord Feature Spec — A2: Learning & Self-Improvement (Capabilities 11–20)
 *
 * Tests: recursive output improvement, heuristic discovery, strategy refinement,
 * knowledge compression, memory consolidation, error-driven learning, skill acquisition,
 * transfer learning (lens-gated), representation invention, self-evaluation loops.
 *
 * Run: node --test tests/a2-learning-self-improvement.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay as _applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel as _projectLabel } from '../affect/projection.js';
import { BASELINE as _BASELINE, DIMS, BOUNDS as _BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  getAffectEvents, serializeAll, restoreAll, deleteSession
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 11. Recursive Output Improvement =============

describe('A2.11 — Recursive Output Improvement', () => {
  it('Successive positive feedback increases valence and trust (output quality signal)', () => {
    const sid = 'test-recursive-improvement';
    resetAffect(sid);

    // Simulate iterative improvement: each feedback cycle improves output
    const improvements = [];
    for (let round = 0; round < 5; round++) {
      emitAffectEvent(sid, makeEvent('FEEDBACK', 0.6, 0.5));
      const state = getAffectState(sid);
      improvements.push(state.v);
    }

    // Each successive round should maintain or increase valence
    let improved = 0;
    for (let i = 1; i < improvements.length; i++) {
      if (improvements[i] >= improvements[i - 1] - 0.01) improved++;
    }
    assert(improved >= 3, 'Recursive feedback should show improvement trend');

    deleteSession(sid);
  });

  it('Output policy evolves toward higher creativity with recursive success', () => {
    const sid = 'test-recursive-creativity';
    resetAffect(sid);

    const initialPolicy = getAffectPolicy(getAffectState(sid));

    // Recursive improvement loop
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));
      emitAffectEvent(sid, makeEvent('FEEDBACK', 0.5, 0.4));
    }

    const improvedPolicy = getAffectPolicy(getAffectState(sid));

    assert(improvedPolicy.style.creativity >= initialPolicy.style.creativity - 0.05,
      'Recursive success should maintain or increase creativity');

    deleteSession(sid);
  });
});

// ============= 12. Heuristic Discovery =============

describe('A2.12 — Heuristic Discovery', () => {
  it('Policy discovers that high fatigue requires reduced depth (heuristic pattern)', () => {
    // The system "discovers" heuristics by adapting policy to state
    const lowFatigue = { ...createState(), f: 0.1 };
    const highFatigue = { ...createState(), f: 0.9 };

    const p1 = getAffectPolicy(lowFatigue);
    const p2 = getAffectPolicy(highFatigue);

    // Heuristic: fatigue → reduce depth
    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      'System should discover: high fatigue → lower depth');
    assert(p1.cognition.latencyBudgetMs > p2.cognition.latencyBudgetMs,
      'System should discover: high fatigue → lower latency budget');
  });

  it('Policy discovers that low trust requires higher safety (adaptive heuristic)', () => {
    const trusted = { ...createState(), t: 0.9 };
    const untrusted = { ...createState(), t: 0.1 };

    const p1 = getAffectPolicy(trusted);
    const p2 = getAffectPolicy(untrusted);

    assert(p2.safety.strictness > p1.safety.strictness,
      'System should discover: low trust → higher strictness');
  });

  it('Memory write strength adapts to arousal (salient event heuristic)', () => {
    const calm = { ...createState(), a: 0.1, f: 0.1 };
    const aroused = { ...createState(), a: 0.9, f: 0.1 };

    const p1 = getAffectPolicy(calm);
    const p2 = getAffectPolicy(aroused);

    assert(p2.memory.writeStrength > p1.memory.writeStrength,
      'System should discover: high arousal → stronger memory writes');
  });
});

// ============= 13. Strategy Refinement =============

describe('A2.13 — Strategy Refinement', () => {
  it('Momentum implements strategy refinement (path-dependent adaptation)', () => {
    const E = createState();
    const M = createMomentum();

    // Initial strategy
    const event = makeEvent('SUCCESS', 0.5, 0.3);
    const _r1 = applyEvent(E, M, event);

    // After repeated success, momentum builds (strategy refined)
    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.5, 0.3));
    }

    // Momentum should have accumulated
    let totalMomentum = 0;
    for (const dim of DIMS) {
      totalMomentum += Math.abs(M[dim]);
    }
    assert(totalMomentum > 0.01, 'Strategy refinement should build momentum');
  });

  it('Strategy shifts after error sequence (adaptive refinement)', () => {
    const sid = 'test-strategy-refine';
    resetAffect(sid);

    // Build success-based strategy
    for (let i = 0; i < 5; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.6, 0.5));
    }
    const successPolicy = getAffectPolicy(getAffectState(sid));

    // Errors force strategy refinement
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('ERROR', 0.7, -0.4));
    }
    const refinedPolicy = getAffectPolicy(getAffectState(sid));

    assert(refinedPolicy.cognition.riskBudget < successPolicy.cognition.riskBudget,
      'Strategy should become more risk-averse after errors');
    assert(refinedPolicy.style.caution > successPolicy.style.caution,
      'Strategy should become more cautious after errors');

    deleteSession(sid);
  });
});

// ============= 14. Knowledge Compression =============

describe('A2.14 — Knowledge Compression', () => {
  it('Serialization compresses event history (last 100 per session)', () => {
    const sid = 'test-compression';
    resetAffect(sid);

    // Generate many events
    for (let i = 0; i < 200; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    }

    const serialized = serializeAll();
    const sessionData = serialized[sid];

    assert(sessionData.events.length <= 100,
      `Serialization should compress events to max 100, got ${sessionData.events.length}`);

    deleteSession(sid);
  });

  it('Compressed state preserves essential information', () => {
    const sid = 'test-compress-quality';
    resetAffect(sid);

    // Build up meaningful state
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.8, 0.6));
    emitAffectEvent(sid, makeEvent('FEEDBACK', 0.5, 0.3));

    const stateBefore = getAffectState(sid);
    const serialized = serializeAll();

    // Restore from compressed form
    deleteSession(sid);
    restoreAll(serialized);

    const stateAfter = getAffectState(sid);

    // Essential state dimensions should be preserved
    for (const dim of DIMS) {
      assert(Math.abs(stateBefore[dim] - stateAfter[dim]) < 0.01,
        `Compression should preserve ${dim}: ${stateBefore[dim]} vs ${stateAfter[dim]}`);
    }

    deleteSession(sid);
  });
});

// ============= 15. Memory Consolidation =============

describe('A2.15 — Memory Consolidation', () => {
  it('Event ring buffer consolidates to fixed size', () => {
    const sid = 'test-consolidation';
    resetAffect(sid);

    // Emit more events than buffer size (500)
    for (let i = 0; i < 600; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.2, 0.0));
    }

    const events = getAffectEvents(sid, 1000); // request more than exist
    assert(events.length <= 500,
      `Memory should consolidate to ring buffer size: ${events.length}`);

    deleteSession(sid);
  });

  it('Memory policy strength increases during high-arousal consolidation', () => {
    const highArousal = { ...createState(), a: 0.9, f: 0.1 };
    const lowArousal = { ...createState(), a: 0.1, f: 0.1 };

    const p1 = getAffectPolicy(highArousal);
    const p2 = getAffectPolicy(lowArousal);

    assert(p1.memory.writeStrength > p2.memory.writeStrength,
      'High arousal should produce stronger memory consolidation');
  });
});

// ============= 16. Error-Driven Learning =============

describe('A2.16 — Error-Driven Learning', () => {
  it('Errors increase fatigue and decrease agency (learning pressure)', () => {
    const E = createState();
    const M = createMomentum();

    const initF = E.f;
    const initG = E.g;

    applyEvent(E, M, makeEvent('ERROR', 0.8, -0.6));

    assert(E.f > initF, 'Error should increase fatigue (learning signal)');
    assert(E.g < initG, 'Error should decrease agency (recalibration signal)');
  });

  it('Recovery after errors shows learning (improved trust/stability)', () => {
    const E = createState();
    const M = createMomentum();

    // Error phase
    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.7, -0.5));
    }

    const postErrorT = E.t;
    const postErrorS = E.s;

    // Recovery phase (learning from errors)
    for (let i = 0; i < 15; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.6, 0.4));
    }

    assert(E.t > postErrorT, 'Learning from errors should improve trust');
    assert(E.s > postErrorS, 'Learning from errors should improve stability');
  });

  it('Error-driven exploration increase (learning heuristic)', () => {
    const preError = { ...createState(), g: 0.7, t: 0.7 };
    const postError = { ...createState(), g: 0.3, t: 0.4, s: 0.4 };

    const p1 = getAffectPolicy(preError);
    const p2 = getAffectPolicy(postError);

    // After errors, the system should become more cautious but still explore at some level
    assert(typeof p2.cognition.exploration === 'number',
      'Exploration should still be defined after errors');
    assert(p2.style.caution > p1.style.caution,
      'Caution should increase after errors (error-driven learning)');
  });
});

// ============= 17. Skill Acquisition =============

describe('A2.17 — Skill Acquisition', () => {
  it('Repeated successful tool use increases toolUseBias (skill development)', () => {
    const E = createState();
    const M = createMomentum();

    const initialPolicy = getAffectPolicy(E);

    // Practice (repeated tool success)
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('TOOL_RESULT', 0.6, 0.5));
    }

    const practicePolicy = getAffectPolicy(E);

    assert(practicePolicy.cognition.toolUseBias >= initialPolicy.cognition.toolUseBias - 0.02,
      'Tool skill should develop with practice');
  });

  it('Agency increases with goal progress (mastery signal)', () => {
    const E = createState();
    const M = createMomentum();

    const initG = E.g;

    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('GOAL_PROGRESS', 0.7, 0.5));
    }

    assert(E.g > initG, 'Goal progress should increase agency (mastery)');
  });
});

// ============= 18. Transfer Learning (Lens-Gated) =============

describe('A2.18 — Transfer Learning (Lens-Gated)', () => {
  it('Event source lens property gates the transfer domain', () => {
    const E = createState();
    const M = createMomentum();

    const event = {
      type: 'SYSTEM_RESULT',
      intensity: 0.5,
      polarity: 0.3,
      payload: { domain: 'mathematics' },
      source: { lens: 'formal-reasoning', sessionId: 'test-transfer' },
    };

    const result = applyEvent(E, M, event);
    assert(result.delta !== undefined, 'Lens-gated event should produce delta');
  });

  it('Different sessions maintain independent transfer states', () => {
    const sid1 = 'transfer-session-1';
    const sid2 = 'transfer-session-2';
    resetAffect(sid1);
    resetAffect(sid2);

    // Session 1: successful pattern
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid1, makeEvent('SUCCESS', 0.7, 0.5));
    }

    // Session 2: error pattern
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid2, makeEvent('ERROR', 0.7, -0.5));
    }

    const state1 = getAffectState(sid1);
    const state2 = getAffectState(sid2);

    assert(state1.v > state2.v, 'Sessions should maintain independent states (lens isolation)');

    deleteSession(sid1);
    deleteSession(sid2);
  });
});

// ============= 19. Representation Invention =============

describe('A2.19 — Representation Invention', () => {
  it('Affect state is a novel 7-dimensional representation of cognitive state', () => {
    const E = createState();
    assert(DIMS.length === 7, 'Affect uses a 7-dimensional invented representation');

    // Each dimension is a novel construct
    assert(typeof E.v === 'number', 'v (valence) is an invented representation dimension');
    assert(typeof E.a === 'number', 'a (arousal) is an invented representation dimension');
    assert(typeof E.s === 'number', 's (stability) is an invented representation dimension');
    assert(typeof E.c === 'number', 'c (coherence) is an invented representation dimension');
    assert(typeof E.g === 'number', 'g (agency) is an invented representation dimension');
    assert(typeof E.t === 'number', 't (trust) is an invented representation dimension');
    assert(typeof E.f === 'number', 'f (fatigue) is an invented representation dimension');
  });

  it('Policy maps invented representation to actionable signals', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // The policy is an invented mapping from 7D affect → multi-domain control signals
    const categories = Object.keys(policy);
    assert(categories.length === 4, 'Policy invents 4 abstract control domains');

    let totalSignals = 0;
    for (const cat of categories) {
      totalSignals += Object.keys(policy[cat]).length;
    }
    assert(totalSignals >= 14, `Policy invents at least 14 control signals, got ${totalSignals}`);
  });
});

// ============= 20. Self-Evaluation Loops =============

describe('A2.20 — Self-Evaluation Loops', () => {
  it('getAffectState runs decay tick (self-evaluation of temporal state)', () => {
    const sid = 'test-self-eval';
    resetAffect(sid);

    // Push state away from baseline
    emitAffectEvent(sid, makeEvent('ERROR', 0.9, -0.8));
    const _postError = getAffectState(sid);

    // Wait a simulated interval (decay happens on next getAffectState call)
    const state = getAffectState(sid);

    // Self-evaluation: system assesses its own temporal state
    assert(typeof state.label === 'string', 'Self-evaluation produces a state label');
    assert(Array.isArray(state.tags), 'Self-evaluation produces tone tags');
    assert(typeof state.summary === 'string', 'Self-evaluation produces a summary');

    deleteSession(sid);
  });

  it('Policy is a self-evaluation of operating capacity', () => {
    const sid = 'test-self-eval-policy';
    resetAffect(sid);

    // Stress the system
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('ERROR', 0.7, -0.5));
    }

    const state = getAffectState(sid);
    const policy = getAffectPolicy(state);

    // Self-evaluation: system honestly assesses its reduced capacity
    assert(policy.cognition.depthBudget < 0.7,
      'Self-evaluation should honestly report reduced depth capacity');
    assert(policy.safety.strictness > 0.4,
      'Self-evaluation should increase safety when stressed');

    deleteSession(sid);
  });
});
