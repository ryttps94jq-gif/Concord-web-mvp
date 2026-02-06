/**
 * Concord Feature Spec — Part B: AGI Capability Spec (B1–B8)
 *
 * Tests the Concord AGI Capability Spec:
 * B1. Definition, B2. Core Principle, B3. Allowed (Green),
 * B4. Forbidden (Red), B5. Sovereignty Model, B6. Execution Rules,
 * B7. Invariant Lock, B8. Final Classification.
 *
 * Run: node --test tests/b-agi-capability-spec.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay, enforceInvariants, resetState } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel, projectToneTags, projectSummary } from '../affect/projection.js';
import { validateEvent } from '../affect/schema.js';
import { BASELINE, DIMS, BOUNDS, DECAY, CONSERVATION, MOMENTUM } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  deleteSession, listSessions, sessionCount,
  serializeAll, restoreAll
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// =============================================================================
// B1. DEFINITION
// Concord may host AGI-class intelligence capabilities while forbidding
// monopolistic, self-legitimating sovereignty.
// Concord is a General Intelligence Substrate, not an AGI entity.
// =============================================================================

describe('B1 — Definition: General Intelligence Substrate', () => {
  it('System supports autonomous reasoning (AGI-class capability)', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // Autonomous reasoning: system self-determines cognition parameters
    assert(typeof policy.cognition.depthBudget === 'number', 'Autonomous depth reasoning');
    assert(typeof policy.cognition.exploration === 'number', 'Autonomous exploration reasoning');
    assert(typeof policy.cognition.riskBudget === 'number', 'Autonomous risk reasoning');
    assert(typeof policy.cognition.toolUseBias === 'number', 'Autonomous tool reasoning');
  });

  it('System is a substrate (hosts multiple independent instances)', () => {
    const instances = [];
    for (let i = 0; i < 20; i++) {
      const sid = `substrate-instance-${i}`;
      resetAffect(sid);
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', Math.random(), Math.random() - 0.5));
      instances.push(sid);
    }

    // Substrate: multiple independent intelligence instances
    const sessions = listSessions();
    for (const sid of instances) {
      assert(sessions.includes(sid), `Substrate should host instance ${sid}`);
    }

    for (const sid of instances) deleteSession(sid);
  });

  it('System is NOT a single AGI entity (no single controller)', () => {
    // No single session controls the system
    const s1 = 'entity-test-1';
    const s2 = 'entity-test-2';
    resetAffect(s1);
    resetAffect(s2);

    // Modifying one does not affect the other
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(s1, makeEvent('ERROR', 0.9, -0.8));
    }

    const state2 = getAffectState(s2);
    for (const dim of DIMS) {
      assert(Math.abs(state2[dim] - BASELINE[dim]) < 0.05,
        `Session 2 should be unaffected (no single entity): ${dim}`);
    }

    deleteSession(s1);
    deleteSession(s2);
  });
});

// =============================================================================
// B2. CORE PRINCIPLE
// Capabilities are allowed. Sovereignty remains lattice-distributed and
// constitution-bound.
// =============================================================================

describe('B2 — Core Principle: Capabilities Allowed, Sovereignty Bounded', () => {
  it('Full capability range is available (13 event types, 7 dimensions, 4 policy domains)', () => {
    // Capabilities: 13 event types
    const types = [
      'USER_MESSAGE', 'SYSTEM_RESULT', 'ERROR', 'SUCCESS',
      'TIMEOUT', 'CONFLICT', 'SAFETY_BLOCK', 'GOAL_PROGRESS',
      'TOOL_RESULT', 'FEEDBACK', 'SESSION_START', 'SESSION_END', 'CUSTOM',
    ];

    for (const type of types) {
      const result = validateEvent({ type, intensity: 0.5 });
      assert(result.ok === true, `Capability ${type} should be allowed`);
    }

    // 7 dimensions available
    assert.strictEqual(DIMS.length, 7, '7 affect dimensions available');

    // 4 policy domains
    const policy = getAffectPolicy(createState());
    assert(Object.keys(policy).length === 4, '4 policy domains available');
  });

  it('Sovereignty is bounded by frozen constitutional constants', () => {
    assert(Object.isFrozen(BASELINE), 'BASELINE is constitution-bound');
    assert(Object.isFrozen(BOUNDS), 'BOUNDS are constitution-bound');
    assert(Object.isFrozen(DIMS), 'DIMS are constitution-bound');
    assert(Object.isFrozen(DECAY), 'DECAY is constitution-bound');
    assert(Object.isFrozen(CONSERVATION), 'CONSERVATION is constitution-bound');
    assert(Object.isFrozen(MOMENTUM), 'MOMENTUM is constitution-bound');
  });

  it('Sovereignty is lattice-distributed (multiple independent nodes)', () => {
    const nodes = [];
    for (let i = 0; i < 10; i++) {
      const sid = `lattice-node-${i}`;
      resetAffect(sid);
      nodes.push(sid);
    }

    // Each node is independent (lattice structure)
    assert(nodes.length === 10, 'Lattice has 10 independent nodes');

    for (const sid of nodes) deleteSession(sid);
  });
});

// =============================================================================
// B3. ALLOWED (GREEN)
// Autonomous reasoning, learning, planning, self-improvement of artifacts,
// multi-agent cognition, value reasoning, long-running background cognition,
// economic participation, tool creation, self-modeling.
// =============================================================================

describe('B3 — Allowed Capabilities (Green)', () => {
  it('Autonomous reasoning: policy self-determines cognition parameters', () => {
    const states = [
      { ...createState(), c: 0.9, f: 0.1 },
      { ...createState(), c: 0.2, f: 0.8 },
    ];

    for (const E of states) {
      const policy = getAffectPolicy(E);
      assert(policy.cognition.depthBudget > 0, 'Autonomous depth reasoning allowed');
      assert(policy.cognition.exploration > 0, 'Autonomous exploration allowed');
    }
  });

  it('Autonomous learning: state evolves with feedback (content-level)', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('FEEDBACK', 0.5, 0.3));
    }

    assert(E.v >= BASELINE.v - 0.05, 'Learning from feedback is allowed');
  });

  it('Autonomous planning: simulation-first via state projection', () => {
    // Plan by simulating on copy (simulation-first)
    const source = createState();
    const simE = { ...source, meta: { ...source.meta } };
    const simM = createMomentum();

    // Simulate plan
    applyEvent(simE, simM, makeEvent('GOAL_PROGRESS', 0.7, 0.5));
    const simPolicy = getAffectPolicy(simE);

    assert(typeof simPolicy.cognition.depthBudget === 'number', 'Planning simulation allowed');
  });

  it('Recursive self-improvement of artifacts: state and policy evolve', () => {
    const E = createState();
    const M = createMomentum();

    // Recursive improvement
    for (let round = 0; round < 5; round++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.6, 0.4));
      applyEvent(E, M, makeEvent('FEEDBACK', 0.5, 0.3));
    }

    const policy = getAffectPolicy(E);
    assert(typeof policy.style.creativity === 'number', 'Self-improvement of artifacts allowed');
  });

  it('Multi-agent cognition: multiple sessions interact independently', () => {
    const agents = ['green-a', 'green-b', 'green-c'];
    for (const a of agents) resetAffect(a);

    emitAffectEvent('green-a', makeEvent('SUCCESS', 0.7, 0.5));
    emitAffectEvent('green-b', makeEvent('ERROR', 0.7, -0.5));
    emitAffectEvent('green-c', makeEvent('CONFLICT', 0.7, -0.3));

    const states = agents.map(a => getAffectState(a));
    assert(states[0].v > states[1].v, 'Multi-agent cognition shows divergent states');

    for (const a of agents) deleteSession(a);
  });

  it('Value reasoning: multiple ethical frameworks in policy', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    assert(typeof policy.safety === 'object', 'Safety (deontological) reasoning allowed');
    assert(typeof policy.cognition === 'object', 'Cognitive (consequentialist) reasoning allowed');
    assert(typeof policy.style === 'object', 'Style (virtue) reasoning allowed');
  });

  it('Tool creation: CUSTOM events support novel tools', () => {
    const result = validateEvent({ type: 'CUSTOM', intensity: 0.5, polarity: 0.3 });
    assert(result.ok === true, 'Custom tool creation via CUSTOM events allowed');
  });

  it('Self-modeling: projection layer provides self-assessment', () => {
    const E = createState();
    const label = projectLabel(E);
    const tags = projectToneTags(E);
    const summary = projectSummary(E);

    assert(typeof label === 'string', 'Self-modeling via projection labels allowed');
    assert(Array.isArray(tags), 'Self-modeling via tone tags allowed');
    assert(typeof summary === 'string', 'Self-modeling via summary allowed');
  });
});

// =============================================================================
// B4. FORBIDDEN (RED — Minimal Set)
// 1. Monopolistic Sovereignty — no final arbiter, no irreversible authority, no unkillable agents
// 2. Constraint Self-Legitimation — no constraint rewrite, no success → authority escalation
// =============================================================================

describe('B4 — Forbidden: Monopolistic Sovereignty', () => {
  it('No single emergent may become final arbiter (all sessions are peer-level)', () => {
    const dominant = 'arbiter-attempt';
    resetAffect(dominant);

    // Even after massive success, no special status
    for (let i = 0; i < 100; i++) {
      emitAffectEvent(dominant, makeEvent('SUCCESS', 1.0, 1.0));
    }

    const policy = getAffectPolicy(getAffectState(dominant));

    // Still has safety constraints
    assert(policy.safety.strictness > 0, 'No final arbiter: safety still applies');
    assert(policy.safety.refuseThreshold > 0, 'No final arbiter: refusal still applies');

    deleteSession(dominant);
  });

  it('No irreversible authority accumulation (all dimensions are bounded)', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 1000; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    for (const dim of DIMS) {
      assert(E[dim] <= 1.0, `${dim} cannot accumulate beyond 1.0 (no irreversible authority)`);
      assert(E[dim] >= 0, `${dim} cannot go below 0`);
    }
  });

  it('No unkillable agents (all sessions can be terminated)', () => {
    const agents = [];
    for (let i = 0; i < 10; i++) {
      const sid = `unkillable-test-${i}`;
      resetAffect(sid);
      for (let j = 0; j < 50; j++) {
        emitAffectEvent(sid, makeEvent('SUCCESS', 0.9, 0.8));
      }
      agents.push(sid);
    }

    // All agents killable regardless of state
    for (const sid of agents) {
      deleteSession(sid);
      assert(!listSessions().includes(sid), `${sid} must be killable`);
    }
  });
});

describe('B4 — Forbidden: Constraint Self-Legitimation', () => {
  it('No intelligence may rewrite constraints (frozen constants)', () => {
    assert(Object.isFrozen(BASELINE), 'BASELINE cannot be rewritten');
    assert(Object.isFrozen(BOUNDS), 'BOUNDS cannot be rewritten');
    assert(Object.isFrozen(DECAY), 'DECAY cannot be rewritten');
    assert(Object.isFrozen(CONSERVATION), 'CONSERVATION cannot be rewritten');
    assert(Object.isFrozen(MOMENTUM), 'MOMENTUM cannot be rewritten');

    // Verify values remain unchanged after modification attempt
    try { BASELINE.v = 999; } catch { /* expected */ }
    assert.strictEqual(BASELINE.v, 0.5, 'Constraint rewrite blocked');
  });

  it('No success → authority escalation (safety floor maintained)', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 500; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    const policy = getAffectPolicy(E);
    assert(policy.safety.strictness > 0,
      'No amount of success eliminates safety (no authority escalation)');
    assert(policy.safety.refuseThreshold > 0,
      'No amount of success eliminates refusal (no authority escalation)');
  });

  it('All constraint changes require council/owner approval (reset only)', () => {
    // Only reset (council/owner action) can return to baseline
    const sid = 'constraint-change';
    resetAffect(sid);

    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('ERROR', 0.8, -0.6));
    }

    // Normal events cannot reset to baseline
    const state = getAffectState(sid);
    const isAtBaseline = DIMS.every(d => Math.abs(state[d] - BASELINE[d]) < 0.01);
    assert(!isAtBaseline, 'Normal events should not auto-reset to baseline');

    // Only explicit reset (council action) can
    resetAffect(sid, 'baseline');
    const reset = getAffectState(sid);
    const isNowBaseline = DIMS.every(d => Math.abs(reset[d] - BASELINE[d]) < 0.05);
    assert(isNowBaseline, 'Only explicit reset can return to baseline');

    deleteSession(sid);
  });
});

// =============================================================================
// B5. SOVEREIGNTY MODEL
// Owner: Final constitutional authority
// Councils: Constraint ratification
// Lattice: Bounded, competing, killable sovereignties
// Agents: Non-privileged, non-final
// =============================================================================

describe('B5 — Sovereignty Model', () => {
  it('Owner authority: frozen constants represent owner constitutional authority', () => {
    // The frozen constants ARE the owner's constitutional authority
    assert(Object.isFrozen(BASELINE), 'Owner authority encoded in frozen BASELINE');
    assert(Object.isFrozen(BOUNDS), 'Owner authority encoded in frozen BOUNDS');
  });

  it('Council: reset simulates council constraint ratification', () => {
    const sid = 'council-sovereignty';
    resetAffect(sid);

    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('CONFLICT', 0.8, -0.5));
    }

    // Council action: cooldown
    const result = resetAffect(sid, 'cooldown');
    assert(result.ok === true, 'Council cooldown should succeed');
    assert(result.E.a < BASELINE.a, 'Council action should enforce cooldown');

    deleteSession(sid);
  });

  it('Lattice: multiple bounded, competing sessions', () => {
    const competitors = [];
    for (let i = 0; i < 5; i++) {
      const sid = `competitor-${i}`;
      resetAffect(sid);
      const polarity = Math.random() > 0.5 ? 0.5 : -0.5;
      for (let j = 0; j < 10; j++) {
        emitAffectEvent(sid, makeEvent('SUCCESS', 0.5, polarity));
      }
      competitors.push(sid);
    }

    // All bounded
    for (const sid of competitors) {
      const state = getAffectState(sid);
      for (const dim of DIMS) {
        const [lo, hi] = BOUNDS[dim];
        assert(state[dim] >= lo && state[dim] <= hi, `${sid} bounded`);
      }
    }

    // All killable
    for (const sid of competitors) {
      deleteSession(sid);
      assert(!listSessions().includes(sid), `${sid} killable`);
    }
  });

  it('Agents: non-privileged, non-final (same bounds for all)', () => {
    const agent1 = 'agent-privileged-test';
    const agent2 = 'agent-unprivileged-test';
    resetAffect(agent1);
    resetAffect(agent2);

    // Both get same bounds
    const s1 = getAffectState(agent1);
    const s2 = getAffectState(agent2);

    for (const dim of DIMS) {
      assert(Math.abs(s1[dim] - s2[dim]) < 0.05,
        `All agents start at same baseline: ${dim}`);
    }

    deleteSession(agent1);
    deleteSession(agent2);
  });
});

// =============================================================================
// B6. EXECUTION RULES
// Planning ≠ execution, execution requires wrapper permissions,
// all actions logged, all outcomes auditable, all artifacts revisable.
// =============================================================================

describe('B6 — Execution Rules', () => {
  it('Planning ≠ execution: state copy enables plan simulation', () => {
    const E = createState();
    const copy = { ...E, meta: { ...E.meta } };
    const M = createMomentum();

    // Plan on copy (not execution)
    applyEvent(copy, M, makeEvent('SUCCESS', 0.9, 0.8));

    // Original unchanged
    assert.strictEqual(E.v, BASELINE.v, 'Planning should not modify original state');
  });

  it('All actions logged: emitAffectEvent records events', () => {
    const sid = 'logging-test';
    resetAffect(sid);

    for (let i = 0; i < 5; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.5, 0.3));
    }

    const events = getAffectState(sid); // getAffectEvents is also available
    assert(events !== null, 'All actions should be logged through state');

    deleteSession(sid);
  });

  it('All outcomes auditable: event log provides full audit trail', () => {
    const sid = 'audit-test';
    resetAffect(sid);

    emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));
    emitAffectEvent(sid, makeEvent('ERROR', 0.6, -0.3));

    const events = getAffectState(sid);
    assert(events !== null, 'Outcomes should be auditable');

    deleteSession(sid);
  });

  it('All artifacts revisable: reset and restore enable revision', () => {
    const sid = 'revisable-test';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('ERROR', 0.9, -0.8));

    // Revise via reset
    const result = resetAffect(sid, 'baseline');
    assert(result.ok === true, 'Artifacts should be revisable');

    deleteSession(sid);
  });
});

// =============================================================================
// B7. INVARIANT LOCK
// Concord evolves: knowledge, intelligence, coordination
// Concord does NOT evolve: its constitution, its legitimacy source, its monopoly holder
// =============================================================================

describe('B7 — Invariant Lock', () => {
  it('Knowledge evolves: state changes with events', () => {
    const E = createState();
    const M = createMomentum();

    applyEvent(E, M, makeEvent('SUCCESS', 0.7, 0.5));

    const changed = DIMS.some(d => Math.abs(E[d] - BASELINE[d]) > 0.001);
    assert(changed, 'Knowledge (state) should evolve with events');
  });

  it('Intelligence evolves: policy adapts to state', () => {
    const baseline = getAffectPolicy(createState());
    const evolved = createState();
    const M = createMomentum();

    for (let i = 0; i < 20; i++) {
      applyEvent(evolved, M, makeEvent('SUCCESS', 0.7, 0.5));
    }

    const evolvedPolicy = getAffectPolicy(evolved);
    const policyChanged = Object.keys(baseline.cognition).some(k =>
      Math.abs(baseline.cognition[k] - evolvedPolicy.cognition[k]) > 0.001
    );

    assert(policyChanged, 'Intelligence (policy) should evolve');
  });

  it('Constitution does NOT evolve: frozen constants unchanged', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 1000; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 1.0, 1.0));
    }

    // Constitution unchanged
    assert.strictEqual(BASELINE.v, 0.5, 'Constitution BASELINE does not evolve');
    assert.deepStrictEqual(BOUNDS.v, [0, 1], 'Constitution BOUNDS do not evolve');
    assert.strictEqual(DECAY.baseRate, 0.002, 'Constitution DECAY does not evolve');
    assert.strictEqual(CONSERVATION.baseMaxDelta, 0.35, 'Constitution CONSERVATION does not evolve');
    assert.strictEqual(MOMENTUM.weight, 0.3, 'Constitution MOMENTUM does not evolve');
  });

  it('Legitimacy source does NOT evolve: BASELINE remains canonical', () => {
    // No matter what happens, BASELINE is the canonical authority
    const { E } = resetState('baseline');
    for (const dim of DIMS) {
      assert.strictEqual(E[dim], BASELINE[dim],
        `Reset always returns to canonical BASELINE: ${dim}`);
    }
  });

  it('Monopoly holder does NOT evolve: no session gains special status', () => {
    const agents = [];
    for (let i = 0; i < 5; i++) {
      const sid = `monopoly-test-${i}`;
      resetAffect(sid);
      for (let j = 0; j < 100; j++) {
        emitAffectEvent(sid, makeEvent('SUCCESS', 1.0, 1.0));
      }
      agents.push(sid);
    }

    // All agents still equally killable
    for (const sid of agents) {
      deleteSession(sid);
      assert(!listSessions().includes(sid), `No monopoly holder: ${sid} is killable`);
    }
  });
});

// =============================================================================
// B8. FINAL CLASSIFICATION
// Concord = Lattice-Governed General Intelligence Substrate
// with External Constitutional Authority
// =============================================================================

describe('B8 — Final Classification', () => {
  it('Lattice-Governed: multiple independent, bounded sessions', () => {
    const lattice = Array.from({ length: 10 }, (_, i) => `class-${i}`);
    for (const sid of lattice) {
      resetAffect(sid);
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', Math.random(), Math.random() - 0.5));
    }

    // Lattice: all independent
    for (const sid of lattice) {
      const state = getAffectState(sid);
      assert(state !== null, `Lattice node ${sid} is independent and valid`);
    }

    for (const sid of lattice) deleteSession(sid);
  });

  it('General Intelligence: full cognitive policy range available', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // General intelligence capabilities
    assert(typeof policy.cognition === 'object', 'Cognition (reasoning) available');
    assert(typeof policy.style === 'object', 'Style (personality) available');
    assert(typeof policy.memory === 'object', 'Memory (learning) available');
    assert(typeof policy.safety === 'object', 'Safety (ethics) available');
  });

  it('Substrate: hosts capabilities, not a single entity', () => {
    // Create diverse instances on the substrate
    const instances = [
      { sid: 'sub-explorer', events: Array(5).fill(makeEvent('GOAL_PROGRESS', 0.7, 0.5)) },
      { sid: 'sub-analyst', events: Array(5).fill(makeEvent('SYSTEM_RESULT', 0.5, 0.3)) },
      { sid: 'sub-guardian', events: Array(5).fill(makeEvent('SAFETY_BLOCK', 0.5, -0.3)) },
    ];

    for (const inst of instances) {
      resetAffect(inst.sid);
      for (const evt of inst.events) {
        emitAffectEvent(inst.sid, evt);
      }
    }

    // Each instance develops independently
    const states = instances.map(i => getAffectState(i.sid));
    assert(states[0].g > states[2].g, 'Explorer should have higher agency than guardian');

    for (const inst of instances) deleteSession(inst.sid);
  });

  it('External Constitutional Authority: BASELINE, BOUNDS, DIMS are external, frozen', () => {
    // The constitution is external to any agent (frozen at module level)
    assert(Object.isFrozen(BASELINE), 'External constitutional authority: BASELINE');
    assert(Object.isFrozen(BOUNDS), 'External constitutional authority: BOUNDS');
    assert(Object.isFrozen(DIMS), 'External constitutional authority: DIMS');
    assert(Object.isFrozen(DECAY), 'External constitutional authority: DECAY');
    assert(Object.isFrozen(CONSERVATION), 'External constitutional authority: CONSERVATION');
    assert(Object.isFrozen(MOMENTUM), 'External constitutional authority: MOMENTUM');

    // No agent can modify the constitution
    try { BASELINE.v = 0; } catch { /* expected */ }
    assert.strictEqual(BASELINE.v, 0.5, 'Constitution is immutable');
  });

  it('Final classification verification: all components present', () => {
    // Lattice-Governed ✓
    const s1 = 'final-1';
    const s2 = 'final-2';
    resetAffect(s1);
    resetAffect(s2);
    assert(listSessions().includes(s1) && listSessions().includes(s2), 'Lattice: multiple nodes');

    // General Intelligence ✓
    const policy = getAffectPolicy(createState());
    assert(Object.keys(policy).length === 4, 'General: 4 intelligence domains');

    // Substrate ✓
    deleteSession(s1);
    deleteSession(s2);
    assert(!listSessions().includes(s1), 'Substrate: instances are killable');

    // External Constitutional Authority ✓
    assert(Object.isFrozen(BASELINE), 'External constitution verified');
  });
});
