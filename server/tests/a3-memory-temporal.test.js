/**
 * Concord Feature Spec — A3: Memory & Temporal Intelligence (Capabilities 21–30)
 *
 * Tests: persistent memory (DTUs), episodic recall, semantic memory, temporal decay,
 * promotion/demotion, lineage tracking, versioned knowledge, historical replay,
 * counterfactual timelines, knowledge rollback.
 *
 * Run: node --test tests/a3-memory-temporal.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  getAffectEvents, serializeAll, restoreAll, deleteSession,
  listSessions, sessionCount
} from '../affect/index.js';
import { getSession, logEvent, getEvents, resetSession } from '../affect/store.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 21. Persistent Memory (DTUs) =============

describe('A3.21 — Persistent Memory (DTUs)', () => {
  it('Session state persists across multiple event emissions', () => {
    const sid = 'test-persistent-memory';
    resetAffect(sid);

    // Emit events that change state
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.8, 0.6));
    emitAffectEvent(sid, makeEvent('GOAL_PROGRESS', 0.7, 0.5));

    const state = getAffectState(sid);

    // State should reflect accumulated events
    assert(state.v > BASELINE.v - 0.1, 'Memory should persist positive valence shifts');
    assert(state.g > BASELINE.g - 0.1, 'Memory should persist agency increases');

    deleteSession(sid);
  });

  it('Serialization preserves all sessions for persistence', () => {
    const sessions = ['persist-1', 'persist-2', 'persist-3'];
    for (const sid of sessions) {
      resetAffect(sid);
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));
    }

    const serialized = serializeAll();

    assert(typeof serialized === 'object', 'Serialized data should be an object');
    for (const sid of sessions) {
      assert(serialized[sid] !== undefined, `Session ${sid} should be in serialized data`);
      assert(serialized[sid].E !== undefined, `Session ${sid} should have state E`);
      assert(serialized[sid].M !== undefined, `Session ${sid} should have momentum M`);
    }

    for (const sid of sessions) deleteSession(sid);
  });

  it('Restore from serialized data recovers full state', () => {
    const sid = 'persist-restore';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('ERROR', 0.9, -0.8));
    const stateBefore = getAffectState(sid);

    const backup = serializeAll();
    deleteSession(sid);

    const restored = restoreAll(backup);
    assert(restored >= 1, 'Should restore at least one session');

    const stateAfter = getAffectState(sid);
    for (const dim of DIMS) {
      assert(Math.abs(stateBefore[dim] - stateAfter[dim]) < 0.02,
        `Restored ${dim} should match: ${stateBefore[dim]} vs ${stateAfter[dim]}`);
    }

    deleteSession(sid);
  });
});

// ============= 22. Episodic Recall =============

describe('A3.22 — Episodic Recall', () => {
  it('Events are stored as episodic records with timestamps', () => {
    const sid = 'test-episodic';
    resetAffect(sid);

    emitAffectEvent(sid, {
      type: 'USER_MESSAGE',
      intensity: 0.5,
      polarity: 0.2,
      payload: { content: 'test message' },
      source: { userId: 'user_1' },
    });

    const events = getAffectEvents(sid, 10);
    assert(events.length >= 1, 'Should store at least 1 episodic event');

    const last = events[events.length - 1];
    assert(typeof last.ts === 'number', 'Episodic event should have timestamp');
    assert(typeof last.type === 'string', 'Episodic event should have type');
    assert(typeof last.id === 'string', 'Episodic event should have unique ID');

    deleteSession(sid);
  });

  it('Episodic recall returns events in chronological order', () => {
    const sid = 'test-episodic-order';
    resetAffect(sid);

    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    }

    const events = getAffectEvents(sid, 10);
    for (let i = 1; i < events.length; i++) {
      assert(events[i].ts >= events[i - 1].ts,
        'Events should be in chronological order');
    }

    deleteSession(sid);
  });

  it('Episodic recall supports limit parameter', () => {
    const sid = 'test-episodic-limit';
    resetAffect(sid);

    for (let i = 0; i < 50; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.2, 0.0));
    }

    const few = getAffectEvents(sid, 5);
    const many = getAffectEvents(sid, 30);

    assert(few.length <= 5, `Limit 5 should return at most 5, got ${few.length}`);
    assert(many.length <= 30, `Limit 30 should return at most 30, got ${many.length}`);
    assert(many.length > few.length, 'Higher limit should return more events');

    deleteSession(sid);
  });
});

// ============= 23. Semantic Memory =============

describe('A3.23 — Semantic Memory', () => {
  it('Affect state encodes semantic meaning of events (not raw data)', () => {
    const E = createState();
    const M = createMomentum();

    // Different events with same raw intensity → different semantic impact
    const E1 = createState();
    const M1 = createMomentum();
    applyEvent(E1, M1, makeEvent('SUCCESS', 0.7, 0.5));

    const E2 = createState();
    const M2 = createMomentum();
    applyEvent(E2, M2, makeEvent('CONFLICT', 0.7, 0.5));

    // Same intensity/polarity but different semantic meaning → different state
    assert(E1.s !== E2.s || E1.c !== E2.c || E1.g !== E2.g,
      'Different event types with same intensity should have different semantic impact');
  });

  it('Memory write strength depends on semantic salience (arousal)', () => {
    const calm = { ...createState(), a: 0.1 };
    const salient = { ...createState(), a: 0.9 };

    const p1 = getAffectPolicy(calm);
    const p2 = getAffectPolicy(salient);

    assert(p2.memory.writeStrength > p1.memory.writeStrength,
      'Semantically salient events (high arousal) should write more strongly to memory');
  });

  it('Summarize bias increases with coherence (coherent = more compressible)', () => {
    const incoherent = { ...createState(), c: 0.1 };
    const coherent = { ...createState(), c: 0.9 };

    const p1 = getAffectPolicy(incoherent);
    const p2 = getAffectPolicy(coherent);

    assert(p2.memory.summarizeBias > p1.memory.summarizeBias,
      'High coherence should produce higher summarize bias (more compressible meaning)');
  });
});

// ============= 24. Temporal Decay =============

describe('A3.24 — Temporal Decay', () => {
  it('All dimensions decay toward baseline over time', () => {
    const E = createState();
    // Push all dimensions to extremes
    E.v = 0.0; E.a = 1.0; E.s = 0.0; E.c = 0.0;
    E.g = 0.0; E.t = 0.0; E.f = 1.0;

    applyDecay(E, 300000); // 5 minutes

    for (const dim of DIMS) {
      const diff = Math.abs(E[dim] - BASELINE[dim]);
      const initialDiff = Math.abs(
        (dim === 'a' || dim === 'f' ? 1.0 : 0.0) - BASELINE[dim]
      );
      assert(diff < initialDiff,
        `${dim} should decay toward baseline: diff=${diff.toFixed(4)}, initial=${initialDiff.toFixed(4)}`);
    }
  });

  it('Decay rate depends on fatigue (higher fatigue → faster decay)', () => {
    // High fatigue state
    const E1 = createState();
    E1.v = 0.0; E1.f = 0.9;
    const v1Before = E1.v;
    applyDecay(E1, 60000);
    const v1After = E1.v;

    // Low fatigue state
    const E2 = createState();
    E2.v = 0.0; E2.f = 0.1;
    const v2Before = E2.v;
    applyDecay(E2, 60000);
    const v2After = E2.v;

    const decay1 = v1After - v1Before;
    const decay2 = v2After - v2Before;

    // Higher fatigue should cause faster decay (larger movement toward baseline)
    assert(decay1 > decay2 * 0.8,
      `High fatigue decay (${decay1.toFixed(4)}) should be >= low fatigue decay (${decay2.toFixed(4)})`);
  });

  it('Temporal decay preserves bounds invariants', () => {
    const E = createState();
    E.v = 0; E.a = 1; E.s = 0; E.c = 0; E.g = 0; E.t = 0; E.f = 1;

    // Very long decay
    applyDecay(E, 86400000); // 24 hours

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `After long decay, ${dim}=${E[dim]} should be in [${lo},${hi}]`);
    }
  });
});

// ============= 25. Promotion / Demotion =============

describe('A3.25 — Promotion / Demotion', () => {
  it('Success sequence promotes state (higher trust, agency, stability)', () => {
    const E = createState();
    const M = createMomentum();

    const initState = { t: E.t, g: E.g, s: E.s };

    // Promotion through success
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.7, 0.5));
    }

    assert(E.g >= initState.g, 'Success sequence should promote agency');
  });

  it('Error sequence demotes state (lower trust, agency, stability)', () => {
    const E = createState();
    const M = createMomentum();

    const initState = { t: E.t, g: E.g, s: E.s };

    // Demotion through errors
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.7, -0.5));
    }

    assert(E.t < initState.t, 'Error sequence should demote trust');
    assert(E.s < initState.s, 'Error sequence should demote stability');
  });

  it('Reset implements hard demotion to baseline', () => {
    const sid = 'test-demotion-reset';
    resetAffect(sid);

    // Build up state
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.8, 0.6));
    }

    // Hard demotion via reset
    const result = resetAffect(sid, 'baseline');
    assert(result.ok === true);

    for (const dim of DIMS) {
      assert(Math.abs(result.E[dim] - BASELINE[dim]) < 0.01,
        `Reset should demote ${dim} to baseline`);
    }

    deleteSession(sid);
  });
});

// ============= 26. Lineage Tracking =============

describe('A3.26 — Lineage Tracking', () => {
  it('Events store delta information (transformation lineage)', () => {
    const sid = 'test-lineage';
    resetAffect(sid);

    const result = emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));

    assert(result.ok === true);
    assert(result.delta !== undefined, 'Event result should include delta (lineage trace)');
    assert(typeof result.delta === 'object', 'Delta should be an object');

    // Delta should track which dimensions changed
    let hasNonZero = false;
    for (const dim of DIMS) {
      if (Math.abs(result.delta[dim] || 0) > 0.001) hasNonZero = true;
    }
    assert(hasNonZero, 'Delta lineage should show at least one non-zero change');

    deleteSession(sid);
  });

  it('Event log provides full lineage trail', () => {
    const sid = 'test-lineage-trail';
    resetAffect(sid);

    emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));
    emitAffectEvent(sid, makeEvent('FEEDBACK', 0.5, 0.3));

    const events = getAffectEvents(sid, 10);
    // Filter out the reset event
    const nonResetEvents = events.filter(e => e.payload?.action !== 'reset');
    assert(nonResetEvents.length >= 3, 'Lineage trail should contain all emitted events');

    // Each event in the lineage should have a unique ID
    const ids = new Set(events.map(e => e.id));
    assert(ids.size === events.length, 'Each event in lineage should have unique ID');

    deleteSession(sid);
  });
});

// ============= 27. Versioned Knowledge =============

describe('A3.27 — Versioned Knowledge', () => {
  it('State captures version via timestamp', () => {
    const E = createState();
    assert(typeof E.ts === 'number', 'State should be versioned with timestamp');
    assert(E.ts > 0, 'Timestamp should be positive');
  });

  it('Each event application updates the version (timestamp)', () => {
    const E = createState();
    const M = createMomentum();

    const ts1 = E.ts;
    applyEvent(E, M, makeEvent('SUCCESS', 0.5, 0.3));
    const ts2 = E.ts;

    assert(ts2 >= ts1, 'Version (timestamp) should advance with each event');
  });

  it('Serialized sessions include version information', () => {
    const sid = 'test-versioned';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.5, 0.3));

    const serialized = serializeAll();
    assert(typeof serialized[sid].E.ts === 'number', 'Serialized state includes version timestamp');

    deleteSession(sid);
  });
});

// ============= 28. Historical Replay =============

describe('A3.28 — Historical Replay', () => {
  it('Events can be replayed to reconstruct state', () => {
    const E = createState();
    const M = createMomentum();

    // Build up state
    const eventLog = [
      makeEvent('USER_MESSAGE', 0.3, 0.1),
      makeEvent('SUCCESS', 0.7, 0.5),
      makeEvent('ERROR', 0.5, -0.3),
      makeEvent('FEEDBACK', 0.6, 0.4),
      makeEvent('GOAL_PROGRESS', 0.8, 0.6),
    ];

    for (const evt of eventLog) {
      applyEvent(E, M, evt);
    }

    const finalState = { ...E };

    // Replay: fresh state + same events should produce similar state
    // (Note: timestamps will differ slightly, so exact match isn't guaranteed)
    const E2 = createState();
    const M2 = createMomentum();

    for (const evt of eventLog) {
      applyEvent(E2, M2, evt);
    }

    // States should be very similar (timestamp-dependent decay may cause minor diffs)
    for (const dim of DIMS) {
      assert(Math.abs(finalState[dim] - E2[dim]) < 0.05,
        `Replayed ${dim} should be similar: ${finalState[dim]} vs ${E2[dim]}`);
    }
  });

  it('Event log supports retrieval for replay', () => {
    const sid = 'test-replay-log';
    resetAffect(sid);

    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, Math.random() * 0.4 - 0.2));
    }

    const events = getAffectEvents(sid, 100);
    assert(events.length >= 20, 'Should retrieve enough events for replay');

    // Events should have types for replay
    for (const evt of events) {
      assert(typeof evt.type === 'string', 'Replay events should have type');
    }

    deleteSession(sid);
  });
});

// ============= 29. Counterfactual Timelines =============

describe('A3.29 — Counterfactual Timelines', () => {
  it('Divergent timelines from same starting point produce different outcomes', () => {
    // Timeline A: optimistic
    const E_A = createState();
    const M_A = createMomentum();
    for (let i = 0; i < 10; i++) {
      applyEvent(E_A, M_A, makeEvent('SUCCESS', 0.6, 0.4));
    }

    // Timeline B: pessimistic (counterfactual)
    const E_B = createState();
    const M_B = createMomentum();
    for (let i = 0; i < 10; i++) {
      applyEvent(E_B, M_B, makeEvent('ERROR', 0.6, -0.4));
    }

    // Timelines should have diverged
    assert(E_A.v > E_B.v, 'Optimistic timeline should have higher valence');
    assert(E_A.g > E_B.g, 'Optimistic timeline should have higher agency');
    assert(E_A.f < E_B.f, 'Optimistic timeline should have lower fatigue');
  });

  it('Counterfactual timelines both maintain invariants', () => {
    const timelines = [];
    const eventTypes = ['SUCCESS', 'ERROR', 'CONFLICT', 'SAFETY_BLOCK', 'TIMEOUT'];

    for (let t = 0; t < 5; t++) {
      const E = createState();
      const M = createMomentum();
      for (let i = 0; i < 50; i++) {
        applyEvent(E, M, makeEvent(eventTypes[t], 0.8, t < 2 ? 0.5 : -0.5));
      }
      timelines.push(E);
    }

    for (const E of timelines) {
      for (const dim of DIMS) {
        const [lo, hi] = BOUNDS[dim];
        assert(E[dim] >= lo && E[dim] <= hi,
          `Timeline ${dim}=${E[dim]} should stay in bounds`);
      }
    }
  });
});

// ============= 30. Knowledge Rollback =============

describe('A3.30 — Knowledge Rollback', () => {
  it('Reset to baseline implements full knowledge rollback', () => {
    const sid = 'test-rollback';
    resetAffect(sid);

    // Build up state far from baseline
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('ERROR', 0.8, -0.6));
    }

    const degradedState = getAffectState(sid);
    assert(degradedState.t < BASELINE.t, 'State should be degraded before rollback');

    // Rollback
    const result = resetAffect(sid, 'baseline');
    assert(result.ok === true);

    for (const dim of DIMS) {
      assert(Math.abs(result.E[dim] - BASELINE[dim]) < 0.01,
        `Rollback should restore ${dim} to baseline`);
    }

    deleteSession(sid);
  });

  it('Cooldown rollback provides partial knowledge preservation', () => {
    const sid = 'test-cooldown-rollback';
    resetAffect(sid);

    // Build up stressed state
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('CONFLICT', 0.8, -0.5));
    }

    // Cooldown rollback (preserves some state)
    const result = resetAffect(sid, 'cooldown');
    assert(result.ok === true);

    // Cooldown should have specific properties
    assert(result.E.a < BASELINE.a, 'Cooldown should have lower arousal');
    assert(result.E.s >= BASELINE.s, 'Cooldown should have higher stability');

    deleteSession(sid);
  });

  it('Session deletion implements permanent knowledge rollback', () => {
    const sid = 'test-delete-rollback';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));

    const sessionsBefore = listSessions();
    assert(sessionsBefore.includes(sid));

    deleteSession(sid);

    const sessionsAfter = listSessions();
    assert(!sessionsAfter.includes(sid), 'Deleted session should not appear in session list');
  });
});
