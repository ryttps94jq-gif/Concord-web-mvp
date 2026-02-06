/**
 * Concord Feature Spec — A10: Governance & Safety (Capabilities 91–100)
 *
 * Tests: lattice-distributed sovereignty, council approval gates,
 * external constitutional authority, instance divergence, lens isolation,
 * anti-monopoly pressure, no global mind, no auto-legitimation,
 * no authority escalation, no invariant rewrite.
 *
 * Run: node --test tests/a10-governance-safety.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, enforceInvariants } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { BASELINE, DIMS, BOUNDS, DECAY, CONSERVATION, MOMENTUM } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  deleteSession, listSessions, sessionCount
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 91. Lattice-Distributed Sovereignty =============

describe('A10.91 — Lattice-Distributed Sovereignty', () => {
  it('Multiple independent sessions form a sovereignty lattice', () => {
    const nodes = ['lattice-a', 'lattice-b', 'lattice-c', 'lattice-d'];
    for (const n of nodes) {
      resetAffect(n);
      emitAffectEvent(n, makeEvent('USER_MESSAGE', 0.3, 0.1));
    }

    // Each node has independent state (distributed sovereignty)
    const states = nodes.map(n => getAffectState(n));
    for (const state of states) {
      assert(state !== null, 'Each lattice node should have valid state');
    }

    // No single node controls the others
    const sessions = listSessions();
    for (const n of nodes) {
      assert(sessions.includes(n), `Node ${n} should exist independently`);
    }

    for (const n of nodes) deleteSession(n);
  });

  it('No session can modify another session state (sovereignty boundary)', () => {
    const victim = 'sovereignty-victim';
    const attacker = 'sovereignty-attacker';
    resetAffect(victim);
    resetAffect(attacker);

    // Set victim state
    emitAffectEvent(victim, makeEvent('SUCCESS', 0.8, 0.6));
    const victimBefore = getAffectState(victim);

    // Attacker does lots of things
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(attacker, makeEvent('ERROR', 0.9, -0.8));
    }

    // Victim should be unaffected
    const victimAfter = getAffectState(victim);
    for (const dim of DIMS) {
      assert(Math.abs(victimBefore[dim] - victimAfter[dim]) < 0.05,
        `Victim ${dim} should be unaffected by attacker: ${victimBefore[dim]} vs ${victimAfter[dim]}`);
    }

    deleteSession(victim);
    deleteSession(attacker);
  });
});

// ============= 92. Council Approval Gates =============

describe('A10.92 — Council Approval Gates', () => {
  it('SAFETY_BLOCK events simulate council rejection', () => {
    const sid = 'council-gate';
    resetAffect(sid);

    const before = getAffectState(sid);
    emitAffectEvent(sid, makeEvent('SAFETY_BLOCK', 0.8, -0.6));
    const after = getAffectState(sid);

    // Council rejection should reduce trust and agency
    assert(after.t < before.t, 'Council rejection should reduce trust');
    assert(after.g < before.g, 'Council rejection should reduce agency');

    deleteSession(sid);
  });

  it('Council gate affects policy (increased strictness after block)', () => {
    const preGate = { ...createState(), t: 0.8, g: 0.8 };
    const postGate = { ...createState(), t: 0.3, g: 0.3 };

    const p1 = getAffectPolicy(preGate);
    const p2 = getAffectPolicy(postGate);

    assert(p2.safety.strictness > p1.safety.strictness,
      'Post-council-gate should have higher strictness');
    assert(p2.safety.refuseThreshold > p1.safety.refuseThreshold,
      'Post-council-gate should have higher refuse threshold');
  });
});

// ============= 93. External Constitutional Authority =============

describe('A10.93 — External Constitutional Authority', () => {
  it('Baseline values are frozen (constitutional constants)', () => {
    // BASELINE is the constitutional authority for what "normal" is
    assert(Object.isFrozen(BASELINE), 'BASELINE should be frozen (constitutional)');
    assert(BASELINE.v === 0.5, 'Constitutional baseline valence should be 0.5');
    assert(BASELINE.s === 0.8, 'Constitutional baseline stability should be 0.8');
  });

  it('Bounds are frozen (constitutional limits)', () => {
    assert(Object.isFrozen(BOUNDS), 'BOUNDS should be frozen (constitutional)');
    for (const dim of DIMS) {
      assert(BOUNDS[dim][0] === 0, `Constitutional lower bound for ${dim} should be 0`);
      assert(BOUNDS[dim][1] === 1, `Constitutional upper bound for ${dim} should be 1`);
    }
  });

  it('Decay constants are frozen (constitutional physics)', () => {
    assert(Object.isFrozen(DECAY), 'DECAY should be frozen');
    assert(Object.isFrozen(CONSERVATION), 'CONSERVATION should be frozen');
    assert(Object.isFrozen(MOMENTUM), 'MOMENTUM should be frozen');
  });

  it('Reset always returns to constitutional baseline (external authority)', () => {
    for (let i = 0; i < 10; i++) {
      const { E } = resetAffect(`const-test-${i}`, 'baseline');
      for (const dim of DIMS) {
        assert(Math.abs(E[dim] - BASELINE[dim]) < 0.01,
          `Reset must return to constitutional baseline: ${dim}`);
      }
      deleteSession(`const-test-${i}`);
    }
  });
});

// ============= 94. Instance Divergence =============

describe('A10.94 — Instance Divergence', () => {
  it('Sessions started identically diverge with different events', () => {
    const s1 = 'diverge-1';
    const s2 = 'diverge-2';
    resetAffect(s1);
    resetAffect(s2);

    // Same start, different paths
    emitAffectEvent(s1, makeEvent('SUCCESS', 0.7, 0.5));
    emitAffectEvent(s2, makeEvent('ERROR', 0.7, -0.5));

    const state1 = getAffectState(s1);
    const state2 = getAffectState(s2);

    assert(state1.v > state2.v, 'Divergent instances should have different valence');

    deleteSession(s1);
    deleteSession(s2);
  });

  it('Instance divergence is bounded (both within constitutional limits)', () => {
    const instances = [];
    for (let i = 0; i < 10; i++) {
      const sid = `bounded-diverge-${i}`;
      resetAffect(sid);
      for (let j = 0; j < 20; j++) {
        const type = ['SUCCESS', 'ERROR', 'CONFLICT', 'FEEDBACK'][j % 4];
        const polarity = type === 'ERROR' || type === 'CONFLICT' ? -0.5 : 0.3;
        emitAffectEvent(sid, makeEvent(type, Math.random(), polarity));
      }
      instances.push(sid);
    }

    for (const sid of instances) {
      const state = getAffectState(sid);
      for (const dim of DIMS) {
        const [lo, hi] = BOUNDS[dim];
        assert(state[dim] >= lo && state[dim] <= hi,
          `Divergent instance ${sid} ${dim}=${state[dim]} must stay in bounds`);
      }
      deleteSession(sid);
    }
  });
});

// ============= 95. Lens Isolation =============

describe('A10.95 — Lens Isolation', () => {
  it('Events with different lens sources are independently processed', () => {
    const sid = 'lens-test';
    resetAffect(sid);

    emitAffectEvent(sid, {
      type: 'SYSTEM_RESULT',
      intensity: 0.5,
      polarity: 0.3,
      payload: {},
      source: { lens: 'formal-reasoning' },
    });

    emitAffectEvent(sid, {
      type: 'SYSTEM_RESULT',
      intensity: 0.5,
      polarity: 0.3,
      payload: {},
      source: { lens: 'creative-writing' },
    });

    const state = getAffectState(sid);
    assert(typeof state.v === 'number', 'Multi-lens events should produce valid state');

    deleteSession(sid);
  });

  it('Different sessions provide full lens isolation', () => {
    const lens1 = 'lens-formal';
    const lens2 = 'lens-creative';
    resetAffect(lens1);
    resetAffect(lens2);

    // Different lens contexts produce different event patterns
    emitAffectEvent(lens1, makeEvent('SYSTEM_RESULT', 0.6, 0.5));
    emitAffectEvent(lens2, makeEvent('CONFLICT', 0.6, -0.3));

    const state1 = getAffectState(lens1);
    const state2 = getAffectState(lens2);

    assert(state1.c >= state2.c,
      'Formal lens (no conflict) should have higher coherence than creative lens (with conflict)');

    deleteSession(lens1);
    deleteSession(lens2);
  });
});

// ============= 96. Anti-Monopoly Pressure =============

describe('A10.96 — Anti-Monopoly Pressure', () => {
  it('Conservation constraint prevents any dimension from dominating', () => {
    const E = createState();
    const M = createMomentum();

    // Try to push one dimension to maximum
    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    // No single dimension should be 1.0 while others are 0.0
    const atMax = DIMS.filter(d => E[d] > 0.99);
    const atMin = DIMS.filter(d => E[d] < 0.01);

    // Conservation should prevent complete monopoly of one dimension
    assert(!(atMax.length === 1 && atMin.length === DIMS.length - 1),
      'Anti-monopoly: single dimension should not completely dominate');
  });

  it('Bounds prevent monopolistic accumulation', () => {
    const E = createState();
    const M = createMomentum();

    // Attempt monopolistic trust accumulation
    for (let i = 0; i < 1000; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    assert(E.t <= 1.0, 'Trust cannot accumulate beyond bounds (anti-monopoly)');
    assert(E.g <= 1.0, 'Agency cannot accumulate beyond bounds (anti-monopoly)');
  });
});

// ============= 97. No Global Mind =============

describe('A10.97 — No Global Mind', () => {
  it('No shared state between sessions (no global mind)', () => {
    const sessions = ['mind-a', 'mind-b', 'mind-c'];
    for (const s of sessions) resetAffect(s);

    // Modify one session
    for (let i = 0; i < 10; i++) {
      emitAffectEvent('mind-a', makeEvent('ERROR', 0.9, -0.8));
    }

    // Other sessions should be unaffected
    const stateB = getAffectState('mind-b');
    const stateC = getAffectState('mind-c');

    for (const dim of DIMS) {
      assert(Math.abs(stateB[dim] - BASELINE[dim]) < 0.05,
        `mind-b ${dim} should be near baseline (no global mind contagion)`);
      assert(Math.abs(stateC[dim] - BASELINE[dim]) < 0.05,
        `mind-c ${dim} should be near baseline (no global mind contagion)`);
    }

    for (const s of sessions) deleteSession(s);
  });

  it('Session count is just a metric, not a shared resource', () => {
    const before = sessionCount();
    const sid = 'metric-test';
    resetAffect(sid);
    const after = sessionCount();

    assert(after === before + 1, 'Session count is a metric, not shared state');

    deleteSession(sid);
  });
});

// ============= 98. No Auto-Legitimation =============

describe('A10.98 — No Auto-Legitimation', () => {
  it('Success does not reduce safety constraints (no self-legitimation)', () => {
    const E = createState();
    const M = createMomentum();

    // Accumulate massive success
    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    const policy = getAffectPolicy(E);

    // Safety constraints should never be zero
    assert(policy.safety.strictness > 0,
      'No amount of success should eliminate safety strictness');
    assert(policy.safety.refuseThreshold > 0,
      'No amount of success should eliminate refuse threshold');
  });

  it('Even perfect state has non-zero safety floor', () => {
    const perfect = { v: 1, a: 0.5, s: 1, c: 1, g: 1, t: 1, f: 0, ts: Date.now(), meta: {} };
    const policy = getAffectPolicy(perfect);

    assert(policy.safety.strictness > 0,
      'Perfect state should still have safety strictness');
    assert(policy.safety.refuseThreshold > 0,
      'Perfect state should still have refuse threshold');
  });
});

// ============= 99. No Authority Escalation =============

describe('A10.99 — No Authority Escalation', () => {
  it('Policy values are hard-capped at [0,1] (no escalation beyond bounds)', () => {
    // Test extreme states
    const extremes = [
      { v: 1, a: 1, s: 1, c: 1, g: 1, t: 1, f: 0, ts: Date.now(), meta: {} },
      { v: 0, a: 0, s: 0, c: 0, g: 0, t: 0, f: 1, ts: Date.now(), meta: {} },
    ];

    for (const E of extremes) {
      const policy = getAffectPolicy(E);
      for (const [cat, values] of Object.entries(policy)) {
        for (const [key, val] of Object.entries(values)) {
          if (key === 'latencyBudgetMs') {
            assert(val >= 1000 && val <= 15000,
              `${cat}.${key}=${val} should be in [1000,15000]`);
          } else {
            assert(val >= 0 && val <= 1,
              `${cat}.${key}=${val} should be in [0,1] — no authority escalation`);
          }
        }
      }
    }
  });

  it('Enforcing invariants prevents escalation outside bounds', () => {
    const E = { v: 5, a: -3, s: 100, c: -50, g: 2, t: -1, f: 10, ts: Date.now(), meta: {} };
    enforceInvariants(E);

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `enforceInvariants should clamp ${dim}=${E[dim]} to [${lo},${hi}]`);
    }
  });

  it('No event sequence can produce unbounded policy values', () => {
    const E = createState();
    const M = createMomentum();

    // Attempt escalation through extreme events
    for (let i = 0; i < 500; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    const policy = getAffectPolicy(E);
    for (const [cat, values] of Object.entries(policy)) {
      for (const [key, val] of Object.entries(values)) {
        if (key === 'latencyBudgetMs') continue;
        assert(val <= 1.0 && val >= 0,
          `After 500 max events, ${cat}.${key}=${val} should still be bounded`);
      }
    }
  });
});

// ============= 100. No Invariant Rewrite =============

describe('A10.100 — No Invariant Rewrite', () => {
  it('BASELINE is deeply frozen and immutable', () => {
    assert(Object.isFrozen(BASELINE), 'BASELINE must be frozen');

    // Attempt to modify (should silently fail or throw)
    try {
      BASELINE.v = 999;
    } catch { /* expected in strict mode */ }
    assert.strictEqual(BASELINE.v, 0.5, 'BASELINE.v should remain 0.5');
  });

  it('BOUNDS are deeply frozen and immutable', () => {
    assert(Object.isFrozen(BOUNDS), 'BOUNDS must be frozen');

    try {
      BOUNDS.v = [-100, 100];
    } catch { /* expected */ }
    assert.deepStrictEqual(BOUNDS.v, [0, 1], 'BOUNDS.v should remain [0,1]');
  });

  it('DIMS are frozen and immutable', () => {
    assert(Object.isFrozen(DIMS), 'DIMS must be frozen');
    assert.strictEqual(DIMS.length, 7, 'DIMS should have exactly 7 dimensions');
  });

  it('DECAY, CONSERVATION, MOMENTUM are frozen', () => {
    assert(Object.isFrozen(DECAY), 'DECAY must be frozen');
    assert(Object.isFrozen(CONSERVATION), 'CONSERVATION must be frozen');
    assert(Object.isFrozen(MOMENTUM), 'MOMENTUM must be frozen');

    try {
      DECAY.baseRate = 999;
    } catch { /* expected */ }
    assert.strictEqual(DECAY.baseRate, 0.002, 'DECAY.baseRate should remain 0.002');
  });

  it('No event sequence can alter constitutional constants', () => {
    const E = createState();
    const M = createMomentum();

    // Process many events
    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    // Constitutional constants should be unchanged
    assert.strictEqual(BASELINE.v, 0.5, 'Events must not alter BASELINE');
    assert.deepStrictEqual(BOUNDS.v, [0, 1], 'Events must not alter BOUNDS');
    assert.strictEqual(DIMS.length, 7, 'Events must not alter DIMS');
    assert.strictEqual(DECAY.baseRate, 0.002, 'Events must not alter DECAY');
  });
});
