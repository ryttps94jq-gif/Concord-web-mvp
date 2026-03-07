/**
 * Chat Parallel Brains — Comprehensive Tests
 * Run: node --test tests/chat-parallel-brains.test.js
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  analyzeUnsaid,
  checkEntityConsistency,
  runParallelBrains,
  recordParallelMetrics,
  getParallelBrainMetrics,
} from '../lib/chat-parallel-brains.js';

// ── Helper ────────────────────────────────────────────────────────────────────

const savedFetch = globalThis.fetch;

function mockFetch(response, ok = true) {
  globalThis.fetch = async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => (typeof response === 'string' ? { response } : response),
  });
}

function restoreFetch() {
  globalThis.fetch = savedFetch;
}

// ── analyzeUnsaid tests ─────────────────────────────────────────────────────

describe('analyzeUnsaid', () => {
  afterEach(restoreFetch);

  it('returns analysis from subconscious brain', async () => {
    mockFetch('The user seems uncertain about their understanding.');

    const STATE = { shadowDtus: new Map() };
    const result = await analyzeUnsaid({
      userMessage: 'Can you explain quantum physics?',
      conversationSummary: 'New conversation',
      sessionId: 's1',
    }, STATE);

    assert.strictEqual(result.ok, true);
    assert.ok(result.analysis);
    assert.ok(result.analysis.includes('uncertain'));
  });

  it('annotates summary DTU with analysis', async () => {
    mockFetch('User seems frustrated with pace of learning.');

    const STATE = {
      shadowDtus: new Map([
        ['summary_session_s1', { machine: { summaryText: 'Test' }, updatedAt: '' }],
      ]),
    };

    await analyzeUnsaid({
      userMessage: 'I still dont get it',
      conversationSummary: 'We discussed quantum physics.',
      sessionId: 's1',
    }, STATE);

    const summary = STATE.shadowDtus.get('summary_session_s1');
    assert.strictEqual(summary.machine.unsaidAnnotation, 'User seems frustrated with pace of learning.');
  });

  it('handles empty brain response', async () => {
    mockFetch('');

    const result = await analyzeUnsaid({
      userMessage: 'test message for empty response',
      sessionId: 's1',
    }, {});

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'empty_analysis');
  });

  it('handles brain HTTP error', async () => {
    mockFetch('', false);

    const result = await analyzeUnsaid({
      userMessage: 'test message for error',
      sessionId: 's1',
    }, {});

    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('brain_http'));
  });

  it('handles fetch timeout', async () => {
    globalThis.fetch = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };

    const result = await analyzeUnsaid({
      userMessage: 'test timeout',
      sessionId: 's1',
    }, {});

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'timeout');
  });

  it('sends correct prompt to brain', async () => {
    let capturedBody = null;
    globalThis.fetch = async (_, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ response: 'Analysis.' }) };
    };

    await analyzeUnsaid({
      userMessage: 'I need help with math',
      conversationSummary: 'We were discussing calculus',
      sessionId: 's1',
    }, {});

    assert.ok(capturedBody.prompt.includes('I need help with math'));
    assert.ok(capturedBody.prompt.includes('We were discussing calculus'));
    assert.ok(capturedBody.prompt.includes('NOT explicitly saying'));
  });
});

// ── checkEntityConsistency tests ────────────────────────────────────────────

describe('checkEntityConsistency', () => {
  afterEach(restoreFetch);

  it('returns consistent=true when no entity state', async () => {
    const result = await checkEntityConsistency({
      response: 'A test response',
      entityStateBlock: '',
      userMessage: 'Test',
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.consistent, true);
    assert.strictEqual(result.score, 1.0);
  });

  it('parses JSON response from repair brain', async () => {
    mockFetch('{"consistent": true, "score": 0.95, "flags": [], "suggestion": null}');

    const result = await checkEntityConsistency({
      response: 'I am doing well!',
      entityStateBlock: '[Entity State]\nMood: positive (v=0.80)',
      userMessage: 'How are you?',
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.consistent, true);
    assert.strictEqual(result.score, 0.95);
    assert.deepStrictEqual(result.flags, []);
  });

  it('detects inconsistency via JSON', async () => {
    mockFetch('{"consistent": false, "score": 0.3, "flags": ["cheerful despite wounds"], "suggestion": "acknowledge pain"}');

    const result = await checkEntityConsistency({
      response: 'Everything is wonderful!',
      entityStateBlock: '[Entity State]\nActive wounds: rejection (sev 80%)',
      userMessage: 'How are you?',
    });

    assert.strictEqual(result.consistent, false);
    assert.ok(result.score < 0.5);
    assert.ok(result.flags.length > 0);
    assert.strictEqual(result.revision, 'acknowledge pain');
  });

  it('falls back to heuristic when JSON parse fails', async () => {
    mockFetch('The response is inconsistent with the entity state. There is a contradiction.');

    const result = await checkEntityConsistency({
      response: 'Test',
      entityStateBlock: '[Entity State]\nMood: low',
      userMessage: 'Test',
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.consistent, false);
    assert.ok(result.score < 0.5);
  });

  it('heuristic detects consistency (no red flag words)', async () => {
    mockFetch('The response seems appropriate and well-aligned with the current state.');

    const result = await checkEntityConsistency({
      response: 'I am feeling a bit tired today.',
      entityStateBlock: '[Entity State]\nFatigue: 70%',
      userMessage: 'How are you?',
    });

    assert.strictEqual(result.consistent, true);
    assert.ok(result.score > 0.5);
  });

  it('handles brain HTTP error gracefully', async () => {
    mockFetch('', false);

    const result = await checkEntityConsistency({
      response: 'Test',
      entityStateBlock: '[Entity State]\nMood: neutral',
      userMessage: 'Test',
    });

    // Should fail gracefully — assume consistent
    assert.strictEqual(result.consistent, true);
    assert.strictEqual(result.score, 1.0);
  });

  it('handles timeout gracefully', async () => {
    globalThis.fetch = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };

    const result = await checkEntityConsistency({
      response: 'Test',
      entityStateBlock: '[Entity State]\nMood: neutral',
      userMessage: 'Test',
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.consistent, true); // fail-safe
  });

  it('clamps score to [0, 1]', async () => {
    mockFetch('{"consistent": true, "score": 5.0, "flags": []}');

    const result = await checkEntityConsistency({
      response: 'Test',
      entityStateBlock: '[Entity State]\nMood: positive',
      userMessage: 'Test',
    });

    assert.ok(result.score <= 1.0);
    assert.ok(result.score >= 0.0);
  });
});

// ── runParallelBrains tests ─────────────────────────────────────────────────

describe('runParallelBrains', () => {
  afterEach(restoreFetch);

  it('returns conscious response when all brains work', async () => {
    // Mock fetch for subconscious and repair
    mockFetch('Some analysis text');

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Hello! I can help with that.' }),
      userMessage: 'Help me with math',
      conversationSummary: 'First message',
      entityStateBlock: '',
      STATE: { shadowDtus: new Map() },
      sessionId: 's1',
    });

    assert.strictEqual(result.response, 'Hello! I can help with that.');
    assert.strictEqual(result.llmUsed, true);
  });

  it('includes unsaid analysis when subconscious succeeds', async () => {
    mockFetch('User seems eager but uncertain.');

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Response' }),
      userMessage: 'Can you help me learn?',
      conversationSummary: '',
      entityStateBlock: '',
      STATE: { shadowDtus: new Map() },
      sessionId: 's1',
      brainFlags: { subconscious: true, repair: false },
    });

    assert.ok(result.unsaidAnalysis);
  });

  it('handles conscious brain failure', async () => {
    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: false, error: 'brain_failed' }),
      userMessage: 'Test',
      conversationSummary: '',
      entityStateBlock: '',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: false, repair: false },
    });

    assert.strictEqual(result.llmUsed, false);
    assert.ok(result.error);
  });

  it('conscious result returned even if subconscious fails', async () => {
    globalThis.fetch = async () => { throw new Error('subconscious failed'); };

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Main response' }),
      userMessage: 'Test',
      conversationSummary: '',
      entityStateBlock: '',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: true, repair: false },
    });

    assert.strictEqual(result.response, 'Main response');
    assert.strictEqual(result.llmUsed, true);
  });

  it('skips subconscious when disabled', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };

    await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Response' }),
      userMessage: 'Test',
      conversationSummary: '',
      entityStateBlock: '',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: false, repair: false },
    });

    assert.strictEqual(fetchCalled, false);
  });

  it('runs repair check when enabled and entity state available', async () => {
    mockFetch('{"consistent": true, "score": 0.9, "flags": []}');

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'I feel great!' }),
      userMessage: 'How are you?',
      conversationSummary: '',
      entityStateBlock: '[Entity State]\nMood: positive (v=0.80)',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: false, repair: true },
    });

    assert.ok(result.consistencyScore != null);
    assert.ok(result.consistencyScore > 0.5);
  });

  it('skips repair when entity state is empty', async () => {
    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Response' }),
      userMessage: 'Test',
      conversationSummary: '',
      entityStateBlock: '',
      STATE: {},
      sessionId: 's1',
      brainFlags: { repair: true },
    });

    assert.strictEqual(result.consistencyScore, undefined);
  });

  it('flags secondPass when repair detects inconsistency', async () => {
    mockFetch('{"consistent": false, "score": 0.2, "flags": ["tone mismatch"], "suggestion": "be more subdued"}');

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Everything is great!' }),
      userMessage: 'How are you?',
      conversationSummary: '',
      entityStateBlock: '[Entity State]\nActive wounds: rejection (sev 80%)',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: false, repair: true },
    });

    assert.strictEqual(result.secondPass, true);
    assert.ok(result.repairSuggestion);
  });

  it('handles repair failure gracefully', async () => {
    globalThis.fetch = async () => { throw new Error('repair crashed'); };

    const result = await runParallelBrains({
      consciousCall: async () => ({ ok: true, content: 'Response' }),
      userMessage: 'Test',
      conversationSummary: '',
      entityStateBlock: '[Entity State]\nMood: positive',
      STATE: {},
      sessionId: 's1',
      brainFlags: { subconscious: false, repair: true },
    });

    // Should not block — repair failure is swallowed
    assert.strictEqual(result.response, 'Response');
    assert.strictEqual(result.llmUsed, true);
  });
});

// ── Metrics tests ───────────────────────────────────────────────────────────

describe('parallelBrainMetrics', () => {
  it('getParallelBrainMetrics returns metrics', () => {
    const result = getParallelBrainMetrics();
    assert.strictEqual(result.ok, true);
    assert.ok(result.metrics);
    assert.ok(typeof result.metrics.totalRuns === 'number');
  });

  it('recordParallelMetrics updates counters', () => {
    const before = getParallelBrainMetrics().metrics.totalRuns;

    recordParallelMetrics({
      unsaidAnalysis: 'User seems curious',
      consistencyScore: 0.9,
    });

    const after = getParallelBrainMetrics().metrics;
    assert.strictEqual(after.totalRuns, before + 1);
    assert.ok(after.subconsciousSuccesses > 0);
  });

  it('tracks inconsistencies', () => {
    const before = getParallelBrainMetrics().metrics.repairInconsistencies;

    recordParallelMetrics({
      consistencyScore: 0.3, // Below 0.6 threshold
    });

    const after = getParallelBrainMetrics().metrics.repairInconsistencies;
    assert.strictEqual(after, before + 1);
  });

  it('tracks second passes', () => {
    const before = getParallelBrainMetrics().metrics.secondPasses;

    recordParallelMetrics({ secondPass: true });

    const after = getParallelBrainMetrics().metrics.secondPasses;
    assert.strictEqual(after, before + 1);
  });
});
