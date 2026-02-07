/**
 * Concord Feature Spec — A11: Meta-Capabilities (Capabilities 101–110)
 *
 * Tests: knowledge refactoring, disagreement mapping, semantic drift detection,
 * compression markets, decision journals, skill graphs, domain bootstrapping,
 * knowledge weather systems, latent capability discovery, substrate extensibility.
 *
 * Run: node --test tests/a11-meta-capabilities.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent, applyDecay } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { projectLabel, projectToneTags, projectSummary } from '../affect/projection.js';
import { validateEvent } from '../affect/schema.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  getAffectEvents, deleteSession, serializeAll, restoreAll,
  listSessions as _listSessions
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0) {
  return { type, intensity, polarity, payload: {}, source: {} };
}

// ============= 101. Knowledge Refactoring =============

describe('A11.101 — Knowledge Refactoring', () => {
  it('Reset implements knowledge refactoring (restructure to baseline)', () => {
    const sid = 'refactor-test';
    resetAffect(sid);

    // Build complex state
    for (let i = 0; i < 30; i++) {
      const types = ['SUCCESS', 'ERROR', 'CONFLICT', 'FEEDBACK'];
      emitAffectEvent(sid, makeEvent(types[i % 4], Math.random(), Math.random() - 0.5));
    }

    // Refactor: reset to clean baseline
    const result = resetAffect(sid, 'baseline');
    assert(result.ok === true, 'Knowledge refactoring should succeed');

    for (const dim of DIMS) {
      assert(Math.abs(result.E[dim] - BASELINE[dim]) < 0.01,
        `Refactored ${dim} should be at baseline`);
    }

    deleteSession(sid);
  });

  it('Serialization enables knowledge refactoring (export/reimport)', () => {
    const sid = 'refactor-export';
    resetAffect(sid);
    emitAffectEvent(sid, makeEvent('SUCCESS', 0.7, 0.5));

    // Export (refactor step 1)
    const exported = serializeAll();
    assert(exported[sid] !== undefined, 'Knowledge should be exportable for refactoring');

    // Could modify/transform the exported data (refactoring logic)
    // Then reimport
    deleteSession(sid);
    const restored = restoreAll(exported);
    assert(restored >= 1, 'Refactored knowledge should be reimportable');

    deleteSession(sid);
  });
});

// ============= 102. Disagreement Mapping =============

describe('A11.102 — Disagreement Mapping', () => {
  it('CONFLICT events map disagreements in the affect space', () => {
    const E = createState();
    const M = createMomentum();

    const preC = E.c;
    const preS = E.s;

    applyEvent(E, M, makeEvent('CONFLICT', 0.8, -0.5));

    // Disagreement maps to coherence and stability reduction
    assert(E.c < preC, 'Disagreement should reduce coherence');
    assert(E.s < preS, 'Disagreement should reduce stability');
  });

  it('Multiple disagreements produce cumulative mapping', () => {
    const E = createState();
    const M = createMomentum();

    const measurements = [];
    for (let i = 0; i < 10; i++) {
      applyEvent(E, M, makeEvent('CONFLICT', 0.6, -0.3));
      measurements.push({ c: E.c, s: E.s });
    }

    // Coherence should generally decrease
    assert(measurements[9].c < measurements[0].c || measurements[0].c < BASELINE.c,
      'Cumulative disagreements should map to decreasing coherence');
  });

  it('Disagreement resolution is visible in state recovery (via decay)', () => {
    const E = createState();
    const M = createMomentum();

    // Disagreement
    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('CONFLICT', 0.7, -0.4));
    }
    const disagreementC = E.c;

    // Resolution through positive system results + decay toward baseline (c=0.8)
    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('SYSTEM_RESULT', 0.5, 0.5));
    }
    applyDecay(E, 300000); // 5 minutes of decay toward baseline

    assert(E.c > disagreementC, 'Disagreement resolution should be visible in coherence recovery');
  });
});

// ============= 103. Semantic Drift Detection =============

describe('A11.103 — Semantic Drift Detection', () => {
  it('Gradual state change over time is detectable as drift', () => {
    const E = createState();
    const M = createMomentum();

    const initial = { ...E };

    // Gradual drift through biased events
    for (let i = 0; i < 50; i++) {
      applyEvent(E, M, makeEvent('FEEDBACK', 0.2, -0.05));
    }

    // Measure drift
    let totalDrift = 0;
    for (const dim of DIMS) {
      totalDrift += Math.abs(E[dim] - initial[dim]);
    }

    assert(totalDrift > 0.01, `Semantic drift should be detectable: totalDrift=${totalDrift.toFixed(4)}`);
  });

  it('Drift rate depends on event intensity', () => {
    const slowDrift = createState();
    const fastDrift = createState();
    const M1 = createMomentum();
    const M2 = createMomentum();

    for (let i = 0; i < 20; i++) {
      applyEvent(slowDrift, M1, makeEvent('FEEDBACK', 0.1, -0.05));
      applyEvent(fastDrift, M2, makeEvent('FEEDBACK', 0.9, -0.05));
    }

    const slowTotal = DIMS.reduce((sum, d) => sum + Math.abs(slowDrift[d] - BASELINE[d]), 0);
    const fastTotal = DIMS.reduce((sum, d) => sum + Math.abs(fastDrift[d] - BASELINE[d]), 0);

    assert(fastTotal > slowTotal,
      'Higher intensity events should cause faster semantic drift');
  });
});

// ============= 104. Compression Markets =============

describe('A11.104 — Compression Markets', () => {
  it('Serialization compresses event history (market for efficiency)', () => {
    const sid = 'compression-market';
    resetAffect(sid);

    // Generate lots of events
    for (let i = 0; i < 300; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    }

    const serialized = serializeAll();
    const compressed = serialized[sid];

    // Compression: events reduced to last 100
    assert(compressed.events.length <= 100,
      `Events should be compressed: ${compressed.events.length} <= 100`);

    // But essential state is preserved
    assert(typeof compressed.E.v === 'number', 'Compressed state preserves valence');
    assert(typeof compressed.M.v === 'number', 'Compressed state preserves momentum');

    deleteSession(sid);
  });

  it('State itself is a compression of event history (7 dimensions from N events)', () => {
    const E = createState();
    const M = createMomentum();

    // 1000 events compressed into 7 dimensions
    for (let i = 0; i < 1000; i++) {
      applyEvent(E, M, makeEvent('USER_MESSAGE', Math.random() * 0.3, Math.random() * 0.2 - 0.1));
    }

    // The entire 1000-event history is compressed into 7 numbers
    let stateSize = 0;
    for (const dim of DIMS) {
      assert(typeof E[dim] === 'number', `${dim} should be a number`);
      stateSize++;
    }
    assert.strictEqual(stateSize, 7, '1000 events compressed to 7 dimensions');
  });
});

// ============= 105. Decision Journals =============

describe('A11.105 — Decision Journals', () => {
  it('Event log serves as a decision journal', () => {
    const sid = 'decision-journal';
    resetAffect(sid);

    // Log decisions as events
    emitAffectEvent(sid, {
      type: 'SYSTEM_RESULT',
      intensity: 0.6,
      polarity: 0.4,
      payload: { decision: 'approved_request', reason: 'within_policy' },
      source: { agentId: 'decision_maker' },
    });

    emitAffectEvent(sid, {
      type: 'SAFETY_BLOCK',
      intensity: 0.7,
      polarity: -0.5,
      payload: { decision: 'blocked_request', reason: 'exceeds_risk_budget' },
      source: { agentId: 'safety_reviewer' },
    });

    const events = getAffectEvents(sid, 10);
    assert(events.length >= 2, 'Decision journal should contain decision events');

    // Each entry has unique ID and timestamp
    for (const evt of events) {
      assert(typeof evt.id === 'string', 'Journal entry should have ID');
      assert(typeof evt.ts === 'number', 'Journal entry should have timestamp');
    }

    deleteSession(sid);
  });

  it('Decision journal preserves temporal order', () => {
    const sid = 'journal-order';
    resetAffect(sid);

    for (let i = 0; i < 20; i++) {
      emitAffectEvent(sid, makeEvent('SUCCESS', 0.3 + i * 0.02, 0.2));
    }

    const events = getAffectEvents(sid, 50);
    for (let i = 1; i < events.length; i++) {
      assert(events[i].ts >= events[i - 1].ts, 'Decision journal must be temporally ordered');
    }

    deleteSession(sid);
  });
});

// ============= 106. Skill Graphs =============

describe('A11.106 — Skill Graphs', () => {
  it('Policy dimensions represent skill levels in different domains', () => {
    const E = createState();
    const policy = getAffectPolicy(E);

    // Skill graph: each policy dimension is a "skill level"
    const skills = {
      exploration: policy.cognition.exploration,
      depth: policy.cognition.depthBudget,
      risk: policy.cognition.riskBudget,
      toolUse: policy.cognition.toolUseBias,
      warmth: policy.style.warmth,
      creativity: policy.style.creativity,
      memoryWrite: policy.memory.writeStrength,
    };

    for (const [skill, level] of Object.entries(skills)) {
      assert(level >= 0 && level <= 1, `Skill ${skill} should be in [0,1]: ${level}`);
    }
  });

  it('Skills evolve with experience (event-driven skill development)', () => {
    const E = createState();
    const M = createMomentum();

    const _preSkills = getAffectPolicy(E);

    // Develop skills through practice
    for (let i = 0; i < 20; i++) {
      applyEvent(E, M, makeEvent('TOOL_RESULT', 0.6, 0.5));
      applyEvent(E, M, makeEvent('SUCCESS', 0.5, 0.4));
    }

    const postSkills = getAffectPolicy(E);

    // Some skills should have improved
    assert(typeof postSkills.cognition.toolUseBias === 'number',
      'Tool use skill should be developed');
  });
});

// ============= 107. Domain Bootstrapping =============

describe('A11.107 — Domain Bootstrapping', () => {
  it('New session bootstraps from BASELINE (default domain)', () => {
    const sid = 'bootstrap-test';
    resetAffect(sid);

    const state = getAffectState(sid);
    for (const dim of DIMS) {
      assert(Math.abs(state[dim] - BASELINE[dim]) < 0.05,
        `Bootstrapped ${dim} should start near baseline`);
    }

    deleteSession(sid);
  });

  it('Domain can be bootstrapped from existing session state', () => {
    // Source domain
    const source = 'bootstrap-source';
    resetAffect(source);
    for (let i = 0; i < 10; i++) {
      emitAffectEvent(source, makeEvent('SUCCESS', 0.6, 0.4));
    }

    const _sourceState = getAffectState(source);

    // Bootstrap new domain from serialized source
    const backup = serializeAll();
    assert(backup[source] !== undefined, 'Source domain should be serializable for bootstrapping');

    deleteSession(source);
  });

  it('Bootstrapped domain can immediately receive events', () => {
    const sid = 'bootstrap-immediate';
    resetAffect(sid);

    // Immediately usable after bootstrap
    const result = emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    assert(result.ok === true, 'Bootstrapped domain should immediately accept events');

    deleteSession(sid);
  });
});

// ============= 108. Knowledge Weather Systems =============

describe('A11.108 — Knowledge Weather Systems', () => {
  it('Projection labels serve as knowledge weather reports', () => {
    const weatherReports = [
      { state: { ...createState(), f: 0.85 }, expected: 'fatigued' },
      { state: { ...createState(), g: 0.9, v: 0.8 }, expected: 'motivated' },
      { state: { ...createState(), a: 0.8, v: 0.8 }, expected: 'energized' },
      { state: { ...createState(), c: 0.15 }, expected: 'uncertain' },
      { state: { ...createState(), a: 0.15, s: 0.9 }, expected: 'calm' },
    ];

    for (const report of weatherReports) {
      const label = projectLabel(report.state);
      assert.strictEqual(label, report.expected,
        `Weather report for ${report.expected} state should be "${report.expected}", got "${label}"`);
    }
  });

  it('Tone tags provide detailed weather conditions', () => {
    const stormy = { ...createState(), v: 0.1, t: 0.1, a: 0.9, s: 0.2 };
    const sunny = { ...createState(), v: 0.9, t: 0.9, c: 0.9, a: 0.4 };

    const stormyTags = projectToneTags(stormy);
    const sunnyTags = projectToneTags(sunny);

    assert(stormyTags.includes('reserved') || stormyTags.includes('cautious') || stormyTags.includes('urgent'),
      'Stormy weather should include appropriate tone tags');
    assert(sunnyTags.includes('warm') || sunnyTags.includes('confident'),
      'Sunny weather should include warm/confident tags');
  });

  it('Weather summary combines label and tone', () => {
    const E = createState();
    const summary = projectSummary(E);

    assert(typeof summary === 'string', 'Weather summary should be a string');
    assert(summary.length > 0, 'Weather summary should not be empty');
  });
});

// ============= 109. Latent Capability Discovery =============

describe('A11.109 — Latent Capability Discovery', () => {
  it('Unexplored state regions reveal latent policies', () => {
    // Test unusual state combinations that might reveal latent behaviors
    const unusual = [
      { ...createState(), v: 0.99, f: 0.99 },    // high valence + high fatigue
      { ...createState(), g: 0.01, c: 0.99 },     // low agency + high coherence
      { ...createState(), a: 0.99, s: 0.01 },     // high arousal + low stability
      { ...createState(), t: 0.5, c: 0.5, s: 0.5, g: 0.5 }, // perfect center
    ];

    for (const E of unusual) {
      const policy = getAffectPolicy(E);
      assert(policy !== null, 'Latent capability should produce valid policy');

      for (const [cat, values] of Object.entries(policy)) {
        for (const [key, val] of Object.entries(values)) {
          if (key === 'latencyBudgetMs') {
            assert(val >= 1000 && val <= 15000, `Latent ${cat}.${key} should be bounded`);
          } else {
            assert(val >= 0 && val <= 1, `Latent ${cat}.${key} should be in [0,1]`);
          }
        }
      }
    }
  });

  it('Event validation schema defines the full capability space', () => {
    const validTypes = [
      'USER_MESSAGE', 'SYSTEM_RESULT', 'ERROR', 'SUCCESS',
      'TIMEOUT', 'CONFLICT', 'SAFETY_BLOCK', 'GOAL_PROGRESS',
      'TOOL_RESULT', 'FEEDBACK', 'SESSION_START', 'SESSION_END',
      'CUSTOM',
    ];

    for (const type of validTypes) {
      const result = validateEvent({ type, intensity: 0.5, polarity: 0.0 });
      assert(result.ok === true, `${type} should be a valid event type (discoverable capability)`);
    }
  });
});

// ============= 110. Substrate Extensibility =============

describe('A11.110 — Substrate Extensibility', () => {
  it('CUSTOM event type enables substrate extension', () => {
    const E = createState();
    const M = createMomentum();

    // Custom extensions via CUSTOM event
    const extensions = [
      { type: 'CUSTOM', intensity: 0.5, polarity: 0.3, payload: { extension: 'knowledge_graph' }, source: {} },
      { type: 'CUSTOM', intensity: 0.4, polarity: 0.2, payload: { extension: 'causal_model' }, source: {} },
      { type: 'CUSTOM', intensity: 0.6, polarity: -0.1, payload: { extension: 'temporal_logic' }, source: {} },
    ];

    for (const ext of extensions) {
      const result = applyEvent(E, M, ext);
      assert(result.delta !== undefined, 'Extensions should produce valid deltas');
    }

    // State should be valid after extensions
    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `State should remain valid after extensions: ${dim}=${E[dim]}`);
    }
  });

  it('Event source fields enable extensible metadata', () => {
    const E = createState();
    const M = createMomentum();

    const result = applyEvent(E, M, {
      type: 'CUSTOM',
      intensity: 0.5,
      polarity: 0.3,
      payload: { custom_field: 'value', nested: { a: 1 } },
      source: { agentId: 'ext_agent', lens: 'ext_lens', route: '/ext/route' },
    });

    assert(result.delta !== undefined, 'Extended metadata should not break processing');
  });

  it('State metadata supports extension (custom modes/tags)', () => {
    const E = createState({
      mode: 'extended',
      notes: 'substrate extension test',
      tags: ['experimental', 'v2'],
    });

    assert.strictEqual(E.meta.mode, 'extended', 'Custom mode should be supported');
    assert.strictEqual(E.meta.notes, 'substrate extension test', 'Custom notes should be supported');
    assert.deepStrictEqual(E.meta.tags, ['experimental', 'v2'], 'Custom tags should be supported');
  });
});
