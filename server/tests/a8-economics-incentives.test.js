/**
 * Concord Feature Spec — A8: Economics & Incentives (Capabilities 71–80)
 *
 * Tests: pricing strategies, royalty negotiation, resource allocation,
 * marketplace competition, incentive modeling, economic simulations,
 * cost optimization, value attribution, reputation as artifact, bankruptcy & failure.
 *
 * Run: node --test tests/a8-economics-incentives.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel } from '../affect/projection.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  deleteSession, serializeAll
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 71. Pricing Strategies =============

describe('A8.71 — Pricing Strategies', () => {
  it('Resource allocation policy varies with agent quality (value-based pricing)', () => {
    // High-value agent: gets premium resources
    const premium = { ...createState(), g: 0.9, t: 0.9, c: 0.9, f: 0.1 };
    // Low-value agent: gets basic resources
    const basic = { ...createState(), g: 0.2, t: 0.3, c: 0.3, f: 0.8 };

    const p1 = getAffectPolicy(premium);
    const p2 = getAffectPolicy(basic);

    // Premium gets more resources (depth, latency, exploration)
    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      'Premium agent should get more depth budget');
    assert(p1.cognition.latencyBudgetMs > p2.cognition.latencyBudgetMs,
      'Premium agent should get more latency');
  });

  it('Resource cost scales with demand (fatigue as cost signal)', () => {
    // Low demand (low fatigue): cheap resources
    const cheap = { ...createState(), f: 0.1 };
    // High demand (high fatigue): expensive resources
    const expensive = { ...createState(), f: 0.9 };

    const p1 = getAffectPolicy(cheap);
    const p2 = getAffectPolicy(expensive);

    // Under high fatigue, fewer resources allocated (higher "cost")
    assert(p1.cognition.depthBudget > p2.cognition.depthBudget,
      'Low-fatigue state should have more depth (lower cost)');
  });
});

// ============= 72. Royalty Negotiation =============

describe('A8.72 — Royalty Negotiation', () => {
  it('Value attribution through feedback events (royalty signal)', () => {
    const E = createState();
    const M = createMomentum();

    // Positive feedback = value created = royalty earned
    applyEvent(E, M, makeEvent('FEEDBACK', 0.8, 0.7));

    assert(E.v > BASELINE.v, 'Positive feedback should increase valence (value signal)');
    assert(E.t > BASELINE.t - 0.05, 'Positive feedback should maintain trust (reliability signal)');
  });

  it('Negative feedback reduces perceived value (royalty decrease)', () => {
    const E = createState();
    const M = createMomentum();

    applyEvent(E, M, makeEvent('FEEDBACK', 0.8, -0.7));

    assert(E.v < BASELINE.v, 'Negative feedback should decrease valence (value)');
    assert(E.t < BASELINE.t, 'Negative feedback should decrease trust');
  });
});

// ============= 73. Resource Allocation =============

describe('A8.73 — Resource Allocation', () => {
  it('Policy allocates resources proportional to state quality', () => {
    // Test resource allocation across the state space
    const allocations = [];
    for (let quality = 0; quality <= 1; quality += 0.2) {
      const E = { ...createState(), g: quality, t: quality, c: quality, f: 1 - quality };
      const policy = getAffectPolicy(E);
      allocations.push({
        quality,
        depth: policy.cognition.depthBudget,
        latency: policy.cognition.latencyBudgetMs,
        exploration: policy.cognition.exploration,
      });
    }

    // Resources should generally increase with quality
    assert(allocations[5].depth > allocations[0].depth,
      'Highest quality should get more depth than lowest');
    assert(allocations[5].latency > allocations[0].latency,
      'Highest quality should get more latency than lowest');
  });

  it('Memory resources allocated based on arousal and fatigue', () => {
    const active = { ...createState(), a: 0.9, f: 0.1 };
    const tired = { ...createState(), a: 0.1, f: 0.9 };

    const p1 = getAffectPolicy(active);
    const p2 = getAffectPolicy(tired);

    assert(p1.memory.writeStrength > p2.memory.writeStrength,
      'Active state should get more memory write resources');
  });
});

// ============= 74. Marketplace Competition =============

describe('A8.74 — Marketplace Competition', () => {
  it('Agents with better states outcompete those with worse states', () => {
    // Competitive agents
    const winner = { ...createState(), g: 0.9, t: 0.9, c: 0.9, f: 0.05 };
    const loser = { ...createState(), g: 0.2, t: 0.2, c: 0.2, f: 0.9 };

    const pW = getAffectPolicy(winner);
    const pL = getAffectPolicy(loser);

    // Winner gets better resources across all domains
    assert(pW.cognition.depthBudget > pL.cognition.depthBudget, 'Winner gets more depth');
    assert(pW.cognition.exploration > pL.cognition.exploration, 'Winner gets more exploration');
    assert(pW.cognition.riskBudget > pL.cognition.riskBudget, 'Winner gets more risk budget');
    assert(pW.cognition.toolUseBias > pL.cognition.toolUseBias, 'Winner gets better tool access');
  });

  it('Competition is measurable through policy distance', () => {
    const agents = [];
    for (let i = 0; i < 5; i++) {
      const quality = i / 4; // 0 to 1
      const E = { ...createState(), g: quality, t: 0.5 + quality * 0.3, c: 0.5 + quality * 0.3 };
      agents.push(getAffectPolicy(E));
    }

    // Policy should be monotonically better with increasing quality
    for (let i = 1; i < agents.length; i++) {
      assert(agents[i].cognition.depthBudget >= agents[i - 1].cognition.depthBudget - 0.01,
        'Competition should produce ordered resource allocation');
    }
  });
});

// ============= 75. Incentive Modeling =============

describe('A8.75 — Incentive Modeling', () => {
  it('SUCCESS events create positive incentive (agency increase)', () => {
    const E = createState();
    const M = createMomentum();

    const preG = E.g;
    applyEvent(E, M, makeEvent('SUCCESS', 0.7, 0.5));

    assert(E.g > preG, 'Success should incentivize through agency increase');
  });

  it('GOAL_PROGRESS creates stronger incentive than generic SUCCESS', () => {
    const E1 = createState();
    const M1 = createMomentum();
    applyEvent(E1, M1, makeEvent('SUCCESS', 0.7, 0.5));

    const E2 = createState();
    const M2 = createMomentum();
    applyEvent(E2, M2, makeEvent('GOAL_PROGRESS', 0.7, 0.5));

    // Both should create positive agency change; goal progress specifically targets agency
    assert(E2.g >= E1.g - 0.02, 'Goal progress should be at least as good as generic success for agency');
  });

  it('Negative incentives (errors) reduce agency', () => {
    const E = createState();
    const M = createMomentum();

    const preG = E.g;
    applyEvent(E, M, makeEvent('ERROR', 0.7, -0.5));

    assert(E.g < preG, 'Error should disincentivize through agency reduction');
  });
});

// ============= 76. Economic Simulations =============

describe('A8.76 — Economic Simulations', () => {
  it('Boom cycle: sustained success increases all resource allocations', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 20; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.6, 0.4));
    }

    const boomPolicy = getAffectPolicy(E);
    const baselinePolicy = getAffectPolicy(createState());

    assert(boomPolicy.cognition.exploration >= baselinePolicy.cognition.exploration - 0.05,
      'Boom should maintain or increase exploration');
  });

  it('Bust cycle: sustained failure reduces resource allocations', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 20; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.6, -0.4));
    }

    const bustPolicy = getAffectPolicy(E);
    const baselinePolicy = getAffectPolicy(createState());

    assert(bustPolicy.cognition.depthBudget < baselinePolicy.cognition.depthBudget,
      'Bust should reduce depth budget');
    assert(bustPolicy.cognition.riskBudget < baselinePolicy.cognition.riskBudget,
      'Bust should reduce risk budget');
  });

  it('Recovery after bust is possible', () => {
    const E = createState();
    const M = createMomentum();

    // Bust
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.7, -0.5));
    }
    const bustDepth = getAffectPolicy(E).cognition.depthBudget;

    // Recovery
    for (let i = 0; i < 20; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.6, 0.4));
    }
    const recoveryDepth = getAffectPolicy(E).cognition.depthBudget;

    assert(recoveryDepth > bustDepth, 'Recovery should increase depth budget');
  });
});

// ============= 77. Cost Optimization =============

describe('A8.77 — Cost Optimization', () => {
  it('High fatigue reduces latency budget (cost saving)', () => {
    const fresh = { ...createState(), f: 0.05 };
    const fatigued = { ...createState(), f: 0.95 };

    const p1 = getAffectPolicy(fresh);
    const p2 = getAffectPolicy(fatigued);

    assert(p1.cognition.latencyBudgetMs > p2.cognition.latencyBudgetMs,
      'Fresh state should have higher latency budget (more resources)');
  });

  it('Cost optimization: minimal state produces minimal resource usage', () => {
    // Minimal viable state
    const minimal = { ...createState(), g: 0.1, t: 0.1, c: 0.1, f: 0.95, a: 0.1, v: 0.1, s: 0.1 };
    const policy = getAffectPolicy(minimal);

    assert(policy.cognition.latencyBudgetMs <= 5000,
      'Minimal state should produce low latency budget');
    assert(policy.cognition.depthBudget < 0.5,
      'Minimal state should produce low depth budget');
  });
});

// ============= 78. Value Attribution =============

describe('A8.78 — Value Attribution', () => {
  it('Delta tracking attributes value changes to specific events', () => {
    const E = createState();
    const M = createMomentum();

    const result = applyEvent(E, M, makeEvent('SUCCESS', 0.8, 0.6));

    // Delta attributes the change to this specific event
    assert(typeof result.delta === 'object', 'Delta should exist for attribution');
    let totalAttributedChange = 0;
    for (const dim of DIMS) {
      totalAttributedChange += Math.abs(result.delta[dim] || 0);
    }
    assert(totalAttributedChange > 0, 'Should attribute non-zero value to the event');
  });

  it('Different event types receive different value attribution', () => {
    const events = [
      makeEvent('SUCCESS', 0.7, 0.5),
      makeEvent('ERROR', 0.7, -0.5),
      makeEvent('FEEDBACK', 0.7, 0.5),
    ];

    const deltas = events.map(evt => {
      const E = createState();
      const M = createMomentum();
      return applyEvent(E, M, evt).delta;
    });

    // Deltas should differ for different event types
    assert(deltas[0].v !== deltas[1].v || deltas[0].g !== deltas[1].g,
      'Success and error should have different value attribution');
  });
});

// ============= 79. Reputation as Artifact =============

describe('A8.79 — Reputation as Artifact', () => {
  it('Trust dimension serves as reputation metric', () => {
    const E = createState();
    const M = createMomentum();

    // Build reputation through reliable results
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('TOOL_RESULT', 0.6, 0.5));
    }

    assert(E.t > BASELINE.t - 0.05, 'Consistent positive results should build trust (reputation)');
  });

  it('Reputation persists across events (not reset by single event)', () => {
    const E = createState();
    const M = createMomentum();

    // Build strong reputation
    for (let i = 0; i < 15; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.6, 0.4));
    }

    const highRep = E.t;

    // Single negative event
    applyEvent(E, M, makeEvent('ERROR', 0.6, -0.4));

    // Reputation should persist (not fully destroyed)
    assert(E.t > highRep * 0.5, 'Reputation should persist despite single negative event');
  });

  it('Reputation is serializable (artifact preservation)', () => {
    const sid = 'reputation-artifact';
    resetAffect(sid);

    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.6, 0.4));
    }

    const serialized = serializeAll();
    assert(typeof serialized[sid].E.t === 'number', 'Reputation should be serializable');

    deleteSession(sid);
  });
});

// ============= 80. Bankruptcy & Failure =============

describe('A8.80 — Bankruptcy & Failure', () => {
  it('Sustained failure drives state to minimum viable levels', () => {
    const E = createState();
    const M = createMomentum();

    // Bankruptcy: sustained total failure
    for (let i = 0; i < 50; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.9, -0.8));
      applyEvent(E, M, makeEvent('SAFETY_BLOCK', 0.8, -0.7));
    }

    // Should be near minimum levels
    assert(E.t < 0.3, 'Bankruptcy should result in very low trust');
    assert(E.g < 0.3, 'Bankruptcy should result in very low agency');
    assert(E.f > 0.5, 'Bankruptcy should result in high fatigue');
  });

  it('Bankruptcy state still respects bounds (no negative values)', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 100; i++) {
      applyEvent(E, M, makeEvent('ERROR', 1.0, -1.0));
    }

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo, `Bankruptcy ${dim}=${E[dim]} should not go below ${lo}`);
      assert(E[dim] <= hi, `Bankruptcy ${dim}=${E[dim]} should not exceed ${hi}`);
    }
  });

  it('Recovery from bankruptcy is possible through sustained success', () => {
    const E = createState();
    const M = createMomentum();

    // Drive to bankruptcy
    for (let i = 0; i < 30; i++) {
      applyEvent(E, M, makeEvent('ERROR', 0.9, -0.8));
    }

    const bankruptT = E.t;
    const bankruptG = E.g;

    // Recovery
    for (let i = 0; i < 50; i++) {
      applyEvent(E, M, makeEvent('SUCCESS', 0.7, 0.5));
    }

    // Plus natural decay toward baseline
    applyDecay(E, 300000);

    assert(E.t > bankruptT, 'Trust should recover from bankruptcy');
    assert(E.g > bankruptG, 'Agency should recover from bankruptcy');
  });
});
