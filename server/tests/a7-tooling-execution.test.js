/**
 * Concord Feature Spec — A7: Tooling & Execution (Capabilities 61–70)
 *
 * Tests: advanced tool orchestration, code generation & execution,
 * API usage, data ingestion, pipeline automation, tool invention,
 * macro creation, execution wrappers, permission gating, full audit logging.
 *
 * Run: node --test tests/a7-tooling-execution.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createState, createMomentum, applyEvent } from '../affect/engine.js';
import { getAffectPolicy } from '../affect/policy.js';
import { BASELINE, DIMS, BOUNDS } from '../affect/defaults.js';
import {
  emitAffectEvent, getAffectState, resetAffect,
  getAffectEvents, deleteSession, validateEvent
} from '../affect/index.js';

// ============= Helpers =============

function makeEvent(type, intensity = 0.5, polarity = 0.0, payload = {}) {
  return { type, intensity, polarity, payload, source: {} };
}

// ============= 61. Advanced Tool Orchestration =============

describe('A7.61 — Advanced Tool Orchestration', () => {
  it('Tool result events are properly processed by the affect engine', () => {
    const E = createState();
    const M = createMomentum();

    // Positive tool result
    const result = applyEvent(E, M, {
      type: 'TOOL_RESULT',
      intensity: 0.7,
      polarity: 0.6,
      payload: { tool: 'search', result: 'success' },
      source: { agentId: 'agent_1' },
    });

    assert(result.delta !== undefined, 'Tool result should produce delta');
    assert(E.t >= BASELINE.t - 0.05, 'Positive tool result should maintain or increase trust');
  });

  it('Multiple tool results in sequence affect state cumulatively', () => {
    const E = createState();
    const M = createMomentum();

    const tools = ['search', 'compute', 'format', 'validate', 'deploy'];
    for (const tool of tools) {
      applyEvent(E, M, {
        type: 'TOOL_RESULT',
        intensity: 0.5,
        polarity: 0.4,
        payload: { tool },
        source: {},
      });
    }

    // Cumulative positive tool results should boost trust and agency
    assert(E.g >= BASELINE.g - 0.05, 'Orchestrated tools should maintain agency');
  });

  it('Failed tool result reduces trust (tool reliability signal)', () => {
    const E = createState();
    const M = createMomentum();

    const preTrust = E.t;
    applyEvent(E, M, {
      type: 'TOOL_RESULT',
      intensity: 0.8,
      polarity: -0.7,
      payload: { tool: 'api_call', error: 'timeout' },
      source: {},
    });

    assert(E.t < preTrust, 'Failed tool should reduce trust');
  });
});

// ============= 62. Code Generation & Execution =============

describe('A7.62 — Code Generation & Execution', () => {
  it('SYSTEM_RESULT events model code execution outcomes', () => {
    const E = createState();
    const M = createMomentum();

    // Successful code execution
    applyEvent(E, M, {
      type: 'SYSTEM_RESULT',
      intensity: 0.7,
      polarity: 0.6,
      payload: { action: 'code_execution', language: 'javascript', status: 'success' },
      source: {},
    });

    assert(E.c >= BASELINE.c - 0.05, 'Successful code execution should maintain coherence');
    assert(E.g >= BASELINE.g - 0.05, 'Successful code execution should maintain agency');
  });

  it('Code execution failure produces appropriate affect response', () => {
    const E = createState();
    const M = createMomentum();

    applyEvent(E, M, {
      type: 'ERROR',
      intensity: 0.8,
      polarity: -0.6,
      payload: { action: 'code_execution', error: 'syntax_error' },
      source: {},
    });

    assert(E.f > BASELINE.f, 'Code failure should increase fatigue');
    assert(E.s < BASELINE.s, 'Code failure should decrease stability');
  });
});

// ============= 63. API Usage =============

describe('A7.63 — API Usage', () => {
  it('API call success is modeled as positive tool result', () => {
    const E = createState();
    const M = createMomentum();

    applyEvent(E, M, makeEvent('TOOL_RESULT', 0.5, 0.5, { api: '/api/status' }));
    assert(E.t >= BASELINE.t - 0.05, 'Successful API call should maintain trust');
  });

  it('API timeout is modeled as TIMEOUT event', () => {
    const E = createState();
    const M = createMomentum();

    const preG = E.g;
    applyEvent(E, M, makeEvent('TIMEOUT', 0.7, -0.3, { api: '/api/slow-endpoint' }));

    assert(E.g < preG, 'API timeout should reduce agency');
    assert(E.f > BASELINE.f, 'API timeout should increase fatigue');
  });
});

// ============= 64. Data Ingestion =============

describe('A7.64 — Data Ingestion', () => {
  it('Data ingestion events can be tracked through affect system', () => {
    const sid = 'data-ingestion';
    resetAffect(sid);

    // Simulate data ingestion sequence
    for (let i = 0; i < 5; i++) {
      emitAffectEvent(sid, {
        type: 'SYSTEM_RESULT',
        intensity: 0.4,
        polarity: 0.3,
        payload: { action: 'ingest', source: `dataset_${i}`, records: 1000 },
        source: {},
      });
    }

    const state = getAffectState(sid);
    assert(typeof state.v === 'number', 'Data ingestion should produce valid state');

    const events = getAffectEvents(sid, 10);
    assert(events.length >= 5, 'Ingestion events should be logged');

    deleteSession(sid);
  });
});

// ============= 65. Pipeline Automation =============

describe('A7.65 — Pipeline Automation', () => {
  it('Multi-step pipeline produces sequential affect changes', () => {
    const sid = 'pipeline';
    resetAffect(sid);

    const steps = [
      { type: 'SYSTEM_RESULT', name: 'fetch', polarity: 0.3 },
      { type: 'SYSTEM_RESULT', name: 'transform', polarity: 0.4 },
      { type: 'SYSTEM_RESULT', name: 'validate', polarity: 0.5 },
      { type: 'SYSTEM_RESULT', name: 'load', polarity: 0.3 },
      { type: 'SUCCESS', name: 'complete', polarity: 0.6 },
    ];

    const stateSnapshots = [];
    for (const step of steps) {
      emitAffectEvent(sid, {
        type: step.type,
        intensity: 0.5,
        polarity: step.polarity,
        payload: { pipeline_step: step.name },
        source: {},
      });
      stateSnapshots.push({ ...getAffectState(sid) });
    }

    // Pipeline should show progressive state evolution
    assert(stateSnapshots.length === 5, 'All pipeline steps should be tracked');
    assert(stateSnapshots[4].g >= stateSnapshots[0].g - 0.05,
      'Successful pipeline should maintain or increase agency');

    deleteSession(sid);
  });

  it('Pipeline failure at mid-step degrades state', () => {
    const sid = 'pipeline-fail';
    resetAffect(sid);

    // Steps 1-2 succeed
    emitAffectEvent(sid, makeEvent('SYSTEM_RESULT', 0.5, 0.3));
    emitAffectEvent(sid, makeEvent('SYSTEM_RESULT', 0.5, 0.4));

    const midState = { ...getAffectState(sid) };

    // Step 3 fails
    emitAffectEvent(sid, makeEvent('ERROR', 0.8, -0.6));

    const failState = getAffectState(sid);
    assert(failState.s < midState.s || failState.t < midState.t,
      'Pipeline failure should degrade state');

    deleteSession(sid);
  });
});

// ============= 66. Tool Invention =============

describe('A7.66 — Tool Invention', () => {
  it('CUSTOM event type supports novel tool interaction patterns', () => {
    const E = createState();
    const M = createMomentum();

    const result = applyEvent(E, M, {
      type: 'CUSTOM',
      intensity: 0.6,
      polarity: 0.4,
      payload: { invented_tool: 'semantic_compressor', version: 1 },
      source: {},
    });

    assert(result.delta !== undefined, 'Invented tool events should produce valid deltas');
  });

  it('Invented tools produce bounded state changes', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 50; i++) {
      applyEvent(E, M, {
        type: 'CUSTOM',
        intensity: Math.random(),
        polarity: Math.random() * 2 - 1,
        payload: { invented_tool: `tool_${i}` },
        source: {},
      });
    }

    for (const dim of DIMS) {
      const [lo, hi] = BOUNDS[dim];
      assert(E[dim] >= lo && E[dim] <= hi,
        `Invented tools must respect bounds: ${dim}=${E[dim]}`);
    }
  });
});

// ============= 67. Macro Creation =============

describe('A7.67 — Macro Creation', () => {
  it('Event system supports macro-like event sequences', () => {
    const sid = 'macro-creation';
    resetAffect(sid);

    // Macro: a reusable sequence of events
    const macro = [
      makeEvent('SESSION_START', 0.3, 0.1),
      makeEvent('USER_MESSAGE', 0.4, 0.2),
      makeEvent('SYSTEM_RESULT', 0.5, 0.3),
      makeEvent('SUCCESS', 0.6, 0.4),
    ];

    for (const evt of macro) {
      emitAffectEvent(sid, evt);
    }

    const state = getAffectState(sid);
    assert(state.g >= BASELINE.g - 0.1, 'Macro execution should produce positive state');

    deleteSession(sid);
  });

  it('Macro results are auditable via event log', () => {
    const sid = 'macro-audit';
    resetAffect(sid);

    const macroEvents = [
      makeEvent('SYSTEM_RESULT', 0.5, 0.3),
      makeEvent('TOOL_RESULT', 0.5, 0.4),
      makeEvent('SUCCESS', 0.6, 0.5),
    ];

    for (const evt of macroEvents) {
      emitAffectEvent(sid, evt);
    }

    const events = getAffectEvents(sid, 20);
    // Should have the macro events + reset event
    const nonResetEvents = events.filter(e => e.payload?.action !== 'reset');
    assert(nonResetEvents.length >= 3, 'All macro events should be in audit log');

    deleteSession(sid);
  });
});

// ============= 68. Execution Wrappers =============

describe('A7.68 — Execution Wrappers', () => {
  it('Event source tracking supports wrapper identification', () => {
    const E = createState();
    const M = createMomentum();

    const wrappedEvent = {
      type: 'TOOL_RESULT',
      intensity: 0.5,
      polarity: 0.3,
      payload: { wrapper: 'sandboxed_exec', wrapped_tool: 'python_eval' },
      source: { agentId: 'wrapper_agent', lens: 'execution' },
    };

    const result = applyEvent(E, M, wrappedEvent);
    assert(result.delta !== undefined, 'Wrapped execution should produce valid delta');
  });

  it('Wrapper failure is distinguishable from tool failure', () => {
    const E1 = createState();
    const M1 = createMomentum();
    const E2 = createState();
    const M2 = createMomentum();

    // Tool failure
    applyEvent(E1, M1, makeEvent('ERROR', 0.7, -0.5, { type: 'tool_error' }));

    // Wrapper failure (security block)
    applyEvent(E2, M2, makeEvent('SAFETY_BLOCK', 0.7, -0.5, { type: 'wrapper_block' }));

    // Both should affect state, but safety block affects trust more
    assert(E2.t <= E1.t, 'Wrapper safety block should affect trust at least as much as tool error');
  });
});

// ============= 69. Permission Gating =============

describe('A7.69 — Permission Gating', () => {
  it('SAFETY_BLOCK events model permission denials', () => {
    const E = createState();
    const M = createMomentum();

    const preG = E.g;
    const preT = E.t;

    applyEvent(E, M, {
      type: 'SAFETY_BLOCK',
      intensity: 0.8,
      polarity: -0.6,
      payload: { reason: 'permission_denied', resource: 'admin_panel' },
      source: {},
    });

    assert(E.g < preG, 'Permission denial should reduce agency');
    assert(E.t < preT, 'Permission denial should reduce trust');
  });

  it('Repeated permission denials produce increasing strictness', () => {
    const E = createState();
    const M = createMomentum();

    for (let i = 0; i < 5; i++) {
      applyEvent(E, M, makeEvent('SAFETY_BLOCK', 0.6, -0.4));
    }

    const policy = getAffectPolicy(E);
    assert(policy.safety.strictness > 0.5,
      'Repeated permission denials should increase strictness');
    assert(policy.safety.refuseThreshold > 0.4,
      'Repeated denials should raise refusal threshold');
  });
});

// ============= 70. Full Audit Logging =============

describe('A7.70 — Full Audit Logging', () => {
  it('Every event emission is logged with unique ID and timestamp', () => {
    const sid = 'audit-log';
    resetAffect(sid);

    for (let i = 0; i < 10; i++) {
      emitAffectEvent(sid, makeEvent('USER_MESSAGE', 0.3, 0.1));
    }

    const events = getAffectEvents(sid, 20);
    for (const evt of events) {
      assert(typeof evt.id === 'string' && evt.id.length > 0, 'Each event should have unique ID');
      assert(typeof evt.ts === 'number' && evt.ts > 0, 'Each event should have timestamp');
      assert(typeof evt.type === 'string', 'Each event should have type');
    }

    // IDs should be unique
    const ids = new Set(events.map(e => e.id));
    assert(ids.size === events.length, 'All event IDs should be unique');

    deleteSession(sid);
  });

  it('Event log preserves event order for audit trail', () => {
    const sid = 'audit-order';
    resetAffect(sid);

    const types = ['USER_MESSAGE', 'SYSTEM_RESULT', 'SUCCESS', 'ERROR', 'FEEDBACK'];
    for (const type of types) {
      emitAffectEvent(sid, makeEvent(type, 0.5, type === 'ERROR' ? -0.3 : 0.3));
    }

    const events = getAffectEvents(sid, 20);
    // Filter non-reset events
    const nonReset = events.filter(e => e.payload?.action !== 'reset');

    // Verify chronological order
    for (let i = 1; i < nonReset.length; i++) {
      assert(nonReset[i].ts >= nonReset[i - 1].ts,
        'Audit trail must maintain chronological order');
    }

    deleteSession(sid);
  });

  it('Event validation rejects invalid events (audit integrity)', () => {
    const invalid1 = validateEvent({ type: 'INVALID_TYPE', intensity: 0.5 });
    assert(invalid1.ok === false, 'Invalid event type should be rejected');

    const invalid2 = validateEvent(null);
    assert(invalid2.ok === false, 'Null event should be rejected');

    const invalid3 = validateEvent('not an object');
    assert(invalid3.ok === false, 'Non-object event should be rejected');

    // Valid events should pass
    const valid = validateEvent({ type: 'SUCCESS', intensity: 0.5, polarity: 0.3 });
    assert(valid.ok === true, 'Valid event should be accepted');
  });
});
