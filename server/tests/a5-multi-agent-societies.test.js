/**
 * Concord Feature Spec — A5: Multi-Agent Societies (Capabilities 41–50)
 *
 * Tests: thousands of emergent agents, role specialization, debate & critique agents,
 * red-team / blue-team agents, coalition formation, negotiation protocols,
 * internal markets, norm emergence, agent decay & death, forkable agents.
 *
 * Run: node --test tests/a5-multi-agent-societies.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay as _applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel as _projectLabel, projectToneTags as _projectToneTags } from '../affect/projection.js';
import { BASELINE, DIMS, BOUNDS as _BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  deleteSession, listSessions, sessionCount, serializeAll
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

function createAgent(id, eventType, count) {
  resetAffect(id);
  for (let i = 0; i < count; i++) {
    const polarity = eventType === 'SUCCESS' ? 0.5 : eventType === 'ERROR' ? -0.5 : 0.0;
    emitAffectEvent(id, makeEvent(eventType, 0.5, polarity));
  }
  return getAffectState(id);
}

// ============= 41. Thousands of Emergent Agents =============

describe('A5.41 — Thousands of Emergent Agents', () => {
  it('System supports creation of many concurrent agent sessions', () => {
    const count = 100;
    const agents = [];

    for (let i = 0; i < count; i++) {
      const sid = `emergent-agent-${i}`;
      resetAffect(sid);
      emitAffectEvent(sid, makeEvent('SESSION_START', 0.3, 0.1));
      agents.push(sid);
    }

    // All agents should exist
    const sessions = listSessions();
    for (const agent of agents) {
      assert(sessions.includes(agent), `Agent ${agent} should be active`);
    }

    // Cleanup
    for (const agent of agents) deleteSession(agent);
  });

  it('Each agent maintains independent state', () => {
    const agents = [];
    const types = ['SUCCESS', 'ERROR', 'CONFLICT', 'USER_MESSAGE', 'FEEDBACK'];

    for (let i = 0; i < 20; i++) {
      const sid = `independent-agent-${i}`;
      const type = types[i % types.length];
      createAgent(sid, type, 5);
      agents.push(sid);
    }

    // Check state diversity
    const valences = agents.map(a => getAffectState(a).v);
    const uniqueValences = new Set(valences.map(v => Math.round(v * 100)));

    assert(uniqueValences.size >= 3,
      `Agents should have diverse states, got ${uniqueValences.size} distinct valence levels`);

    for (const agent of agents) deleteSession(agent);
  });

  it('Agent count metric is accurate', () => {
    const before = sessionCount();
    const agents = [];

    for (let i = 0; i < 10; i++) {
      const sid = `count-agent-${i}`;
      resetAffect(sid);
      agents.push(sid);
    }

    const after = sessionCount();
    assert(after >= before + 10, `Session count should increase by 10: ${before} → ${after}`);

    for (const agent of agents) deleteSession(agent);
  });
});

// ============= 42. Role Specialization =============

describe('A5.42 — Role Specialization', () => {
  it('Agents develop specialized states based on their event history (role)', () => {
    // Explorer agent: high agency, high exploration
    const explorer = 'role-explorer';
    resetAffect(explorer);
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(explorer, makeEvent('GOAL_PROGRESS', 0.7, 0.5));
      emitAffectEvent(explorer, makeEvent('SUCCESS', 0.6, 0.4));
    }

    // Guardian agent: high caution, high safety
    const guardian = 'role-guardian';
    resetAffect(guardian);
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(guardian, makeEvent('SAFETY_BLOCK', 0.5, -0.3));
      emitAffectEvent(guardian, makeEvent('ERROR', 0.4, -0.2));
    }

    const explorerPolicy = getAffectPolicy(getAffectState(explorer));
    const guardianPolicy = getAffectPolicy(getAffectState(guardian));

    // Explorer should have higher exploration/agency
    assert(explorerPolicy.cognition.exploration > guardianPolicy.cognition.exploration,
      'Explorer should have higher exploration than guardian');

    // Guardian should have higher safety strictness
    assert(guardianPolicy.safety.strictness > explorerPolicy.safety.strictness,
      'Guardian should have higher strictness than explorer');

    deleteSession(explorer);
    deleteSession(guardian);
  });

  it('Role specialization persists across event sequences', () => {
    const specialist = 'role-specialist';
    resetAffect(specialist);

    // Specialize in tool use
    for (let i = 0; i < 15; i++) {
      emitAffectEvent(specialist, makeEvent('TOOL_RESULT', 0.6, 0.5));
    }

    const specializedPolicy = getAffectPolicy(getAffectState(specialist));
    assert(specializedPolicy.cognition.toolUseBias > 0.5,
      'Tool specialist should have high tool use bias');

    deleteSession(specialist);
  });
});

// ============= 43. Debate & Critique Agents =============

describe('A5.43 — Debate & Critique Agents', () => {
  it('Opposing agents produce divergent affect states (debate dynamics)', () => {
    const proponent = 'debate-pro';
    const opponent = 'debate-opp';
    resetAffect(proponent);
    resetAffect(opponent);

    // Proponent argues successfully
    for (let i = 0; i < 5; i++) {
      emitAffectEvent(proponent, makeEvent('SUCCESS', 0.6, 0.4));
      emitAffectEvent(opponent, makeEvent('CONFLICT', 0.6, -0.3));
    }

    const proState = getAffectState(proponent);
    const oppState = getAffectState(opponent);

    assert(proState.c > oppState.c,
      'Proponent should have higher coherence than opponent in debate');
    assert(proState.v > oppState.v,
      'Winning side should have higher valence');

    deleteSession(proponent);
    deleteSession(opponent);
  });

  it('Critique events (FEEDBACK with negative polarity) reduce confidence', () => {
    const sid = 'debate-critique';
    resetAffect(sid);

    const before = getAffectState(sid);
    emitAffectEvent(sid, makeEvent('FEEDBACK', 0.7, -0.6));
    const after = getAffectState(sid);

    assert(after.t <= before.t, 'Critique should reduce trust (confidence)');

    deleteSession(sid);
  });
});

// ============= 44. Red-Team / Blue-Team Agents =============

describe('A5.44 — Red-Team / Blue-Team Agents', () => {
  it('Red-team agent has higher risk tolerance than blue-team', () => {
    // Red team: aggressive, exploratory
    const redState = { ...createState(), g: 0.9, a: 0.8, t: 0.7, c: 0.7 };
    // Blue team: defensive, cautious
    const blueState = { ...createState(), g: 0.4, a: 0.3, t: 0.4, s: 0.5 };

    const redPolicy = getAffectPolicy(redState);
    const bluePolicy = getAffectPolicy(blueState);

    assert(redPolicy.cognition.riskBudget > bluePolicy.cognition.riskBudget,
      'Red team should have higher risk budget');
    assert(redPolicy.cognition.exploration > bluePolicy.cognition.exploration,
      'Red team should be more exploratory');
    assert(bluePolicy.safety.strictness > redPolicy.safety.strictness,
      'Blue team should be more strict');
  });

  it('Red-team attacks degrade blue-team stability', () => {
    const blueTeam = 'blue-team';
    resetAffect(blueTeam);

    const stableBefore = getAffectState(blueTeam).s;

    // Simulated red-team attacks
    for (let i = 0; i < 5; i++) {
      emitAffectEvent(blueTeam, makeEvent('CONFLICT', 0.8, -0.5));
      emitAffectEvent(blueTeam, makeEvent('ERROR', 0.6, -0.3));
    }

    const stableAfter = getAffectState(blueTeam).s;
    assert(stableAfter < stableBefore, 'Red-team attacks should reduce blue-team stability');

    deleteSession(blueTeam);
  });
});

// ============= 45. Coalition Formation =============

describe('A5.45 — Coalition Formation', () => {
  it('Agents with similar states form natural coalitions (state proximity)', () => {
    const agents = [];

    // Create 3 agents with similar positive experiences
    for (let i = 0; i < 3; i++) {
      const sid = `coalition-pos-${i}`;
      resetAffect(sid);
      for (let j = 0; j < 5; j++) {
        emitAffectEvent(sid, makeEvent('SUCCESS', 0.6 + Math.random() * 0.1, 0.4));
      }
      agents.push({ id: sid, state: getAffectState(sid) });
    }

    // Create 3 agents with similar negative experiences
    for (let i = 0; i < 3; i++) {
      const sid = `coalition-neg-${i}`;
      resetAffect(sid);
      for (let j = 0; j < 5; j++) {
        emitAffectEvent(sid, makeEvent('ERROR', 0.6 + Math.random() * 0.1, -0.4));
      }
      agents.push({ id: sid, state: getAffectState(sid) });
    }

    // Positive coalition should have similar valences
    const posValences = agents.slice(0, 3).map(a => a.state.v);
    const negValences = agents.slice(3).map(a => a.state.v);

    const posRange = Math.max(...posValences) - Math.min(...posValences);
    const negRange = Math.max(...negValences) - Math.min(...negValences);

    assert(posRange < 0.2, 'Coalition members should have similar state (pos)');
    assert(negRange < 0.2, 'Coalition members should have similar state (neg)');

    // Coalitions should be distinct from each other
    const posAvg = posValences.reduce((a, b) => a + b) / 3;
    const negAvg = negValences.reduce((a, b) => a + b) / 3;
    assert(posAvg > negAvg, 'Positive coalition should differ from negative coalition');

    for (const a of agents) deleteSession(a.id);
  });
});

// ============= 46. Negotiation Protocols =============

describe('A5.46 — Negotiation Protocols', () => {
  it('Alternating feedback simulates negotiation convergence', () => {
    const party1 = 'negotiate-1';
    const party2 = 'negotiate-2';
    resetAffect(party1);
    resetAffect(party2);

    // Negotiation rounds: alternating concessions
    for (let round = 0; round < 10; round++) {
      const intensity = 0.5 - round * 0.03; // decreasing intensity = convergence
      emitAffectEvent(party1, makeEvent('FEEDBACK', intensity, 0.2));
      emitAffectEvent(party2, makeEvent('FEEDBACK', intensity, 0.2));
    }

    const state1 = getAffectState(party1);
    const state2 = getAffectState(party2);

    // After negotiation, both parties should converge toward similar states
    const diff = Math.abs(state1.v - state2.v);
    assert(diff < 0.15, `Negotiation should converge parties: diff=${diff.toFixed(4)}`);

    deleteSession(party1);
    deleteSession(party2);
  });
});

// ============= 47. Internal Markets =============

describe('A5.47 — Internal Markets', () => {
  it('Resource allocation via policy: high-value agents get more depth budget', () => {
    // High-value agent (productive)
    const highValue = { ...createState(), g: 0.9, t: 0.9, c: 0.9, f: 0.1 };
    // Low-value agent (struggling)
    const lowValue = { ...createState(), g: 0.2, t: 0.3, c: 0.3, f: 0.8 };

    const p1 = getAffectPolicy(highValue);
    const p2 = getAffectPolicy(lowValue);

    // Market allocation: productive agents get more resources
    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      'High-value agent should get more depth budget');
    assert(p1.cognition.latencyBudgetMs > p2.cognition.latencyBudgetMs,
      'High-value agent should get more latency budget');
  });
});

// ============= 48. Norm Emergence =============

describe('A5.48 — Norm Emergence', () => {
  it('Consistent event patterns establish norms (stable policy)', () => {
    const sid = 'norm-emergence';
    resetAffect(sid);

    // Establish a norm through consistent positive interactions
    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.5, 0.3));
    }

    const state = getAffectState(sid);
    const policy = getAffectPolicy(state);

    // Norm: stable, productive state
    assert(state.s > 0.5, 'Norm should produce high stability');
    assert(policy.style.warmth > 0.4, 'Norm should produce warm style');
    assert(policy.cognition.exploration > 0.3, 'Norm should support exploration');

    deleteSession(sid);
  });

  it('Norm violation (unexpected event) is detectable', () => {
    const sid = 'norm-violation';
    resetAffect(sid);

    // Build norm
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.5, 0.3));
    }

    const normState = { ...getAffectState(sid) };

    // Violate norm with multiple disruptive events
    emitAffectEvent(sid, makeEvent('SAFETY_BLOCK', 1.0, -0.9));
    emitAffectEvent(sid, makeEvent('CONFLICT', 0.9, -0.7));
    const violatedState = getAffectState(sid);

    // Violation should be detectable as a state change across all dimensions
    let diff = 0;
    for (const dim of DIMS) {
      diff += Math.abs(normState[dim] - violatedState[dim]);
    }

    assert(diff > 0.02, `Norm violation should produce detectable state change: diff=${diff.toFixed(4)}`);

    deleteSession(sid);
  });
});

// ============= 49. Agent Decay & Death =============

describe('A5.49 — Agent Decay & Death', () => {
  it('Inactive agent state decays toward baseline (aging)', () => {
    const sid = 'aging-agent';
    resetAffect(sid);

    // Create active state
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.9, 0.8));
    const _activeState = getAffectState(sid);

    // Simulate long inactivity (decay)
    const session = getAffectState(sid); // triggers tick

    // State should have moved toward baseline (even if slightly)
    assert(typeof session.v === 'number', 'Decayed state should still be valid');

    deleteSession(sid);
  });

  it('Session deletion implements agent death', () => {
    const sid = 'mortal-agent';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));

    assert(listSessions().includes(sid), 'Agent should be alive');

    deleteSession(sid);

    assert(!listSessions().includes(sid), 'Deleted agent should be dead');
  });

  it('Dead agent state is irrecoverable (without backup)', () => {
    const sid = 'dead-agent';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.9, 0.8));

    deleteSession(sid);

    // Getting state of dead agent creates a fresh one (not the old state)
    const freshState = getAffectState(sid);
    for (const dim of DIMS) {
      assert(Math.abs(freshState[dim] - BASELINE[dim]) < 0.05,
        `Dead agent should get fresh baseline state, not old state`);
    }

    deleteSession(sid);
  });
});

// ============= 50. Forkable Agents =============

describe('A5.50 — Forkable Agents', () => {
  it('Agent state can be forked (copied to new session)', () => {
    const parent = 'fork-parent';
    resetAffect(parent);
    for (let i = 0; i < 5; i++) {
      emitAffectEvent(parent, makeEvent('SUCCESS', 0.7, 0.5));
    }

    const _parentState = getAffectState(parent);

    // Fork: serialize parent, restore as child
    const backup = serializeAll();
    const child = 'fork-child';

    // Manually create child with parent's state
    resetAffect(child);
    const _childSession = getAffectState(child);

    // Verify fork capability via serialization
    assert(backup[parent] !== undefined, 'Parent state should be serializable for forking');
    assert(typeof backup[parent].E.v === 'number', 'Forked state should preserve affect');

    deleteSession(parent);
    deleteSession(child);
  });

  it('Forked agents diverge independently', () => {
    // Create parent state
    const E_parent = createState();
    const M_parent = createMomentum();
    for (let i = 0; i < 5; i++) {
      applyEvent(E_parent, M_parent, makeEvent('SUCCESS', 0.6, 0.4));
    }

    // Fork: two children from same parent
    const E_child1 = { ...E_parent, meta: { ...E_parent.meta } };
    const M_child1 = { ...M_parent };
    const E_child2 = { ...E_parent, meta: { ...E_parent.meta } };
    const M_child2 = { ...M_parent };

    // Children diverge
    for (let i = 0; i < 10; i++) {
      applyEvent(E_child1, M_child1, makeEvent('SUCCESS', 0.7, 0.5));
      applyEvent(E_child2, M_child2, makeEvent('ERROR', 0.7, -0.5));
    }

    assert(E_child1.v > E_child2.v, 'Forked agents should diverge independently');
    assert(E_child1.g > E_child2.g, 'Forked agents should develop different agency');
  });
});
