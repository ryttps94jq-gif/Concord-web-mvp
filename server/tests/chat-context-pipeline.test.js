/**
 * Chat Context Pipeline — Comprehensive Tests
 * Run: node --test tests/chat-context-pipeline.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  detectHardwareTier,
  getMaxWorkingSet,
  harvestEntityState,
  formatEntityStateBlock,
  consolidateMegaHypers,
  runContextHarvest,
  recordHarvestMetrics,
  getHarvestMetrics,
} from '../lib/chat-context-pipeline.js';

// ── detectHardwareTier tests ────────────────────────────────────────────────

describe('detectHardwareTier', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.CUDA_VISIBLE_DEVICES;
    delete process.env.NVIDIA_VISIBLE_DEVICES;
    delete process.env.GPU_ENABLED;
    delete process.env.OLLAMA_GPU;
    delete process.env.MULTI_GPU;
  });

  afterEach(() => {
    Object.assign(process.env, savedEnv);
  });

  it('returns "cpu" with no GPU env vars', () => {
    assert.strictEqual(detectHardwareTier(), 'cpu');
  });

  it('returns "gpu" with CUDA_VISIBLE_DEVICES set (single)', () => {
    process.env.CUDA_VISIBLE_DEVICES = '0';
    assert.strictEqual(detectHardwareTier(), 'gpu');
  });

  it('returns "gpu" with GPU_ENABLED=true', () => {
    process.env.GPU_ENABLED = 'true';
    assert.strictEqual(detectHardwareTier(), 'gpu');
  });

  it('returns "gpu" with OLLAMA_GPU=true', () => {
    process.env.OLLAMA_GPU = 'true';
    assert.strictEqual(detectHardwareTier(), 'gpu');
  });

  it('returns "multi_gpu" with MULTI_GPU=true', () => {
    process.env.MULTI_GPU = 'true';
    assert.strictEqual(detectHardwareTier(), 'multi_gpu');
  });

  it('returns "multi_gpu" with comma-separated CUDA devices', () => {
    process.env.CUDA_VISIBLE_DEVICES = '0,1';
    assert.strictEqual(detectHardwareTier(), 'multi_gpu');
  });
});

// ── getMaxWorkingSet tests ──────────────────────────────────────────────────

describe('getMaxWorkingSet', () => {
  it('returns 10 for cpu', () => {
    assert.strictEqual(getMaxWorkingSet('cpu'), 10);
  });

  it('returns 50 for gpu', () => {
    assert.strictEqual(getMaxWorkingSet('gpu'), 50);
  });

  it('returns 100 for multi_gpu', () => {
    assert.strictEqual(getMaxWorkingSet('multi_gpu'), 100);
  });

  it('returns 10 for unknown tier', () => {
    assert.strictEqual(getMaxWorkingSet('unknown'), 10);
  });
});

// ── harvestEntityState tests ────────────────────────────────────────────────

describe('harvestEntityState', () => {
  it('returns ok with empty state', () => {
    const result = harvestEntityState({});
    assert.strictEqual(result.ok, true);
    assert.ok(result.entityState);
  });

  it('harvests existential state', () => {
    const STATE = {
      existential: {
        sleepPhase: 'DEEP',
        fatigue: 0.7,
        consciousness: 0.9,
      },
    };
    const result = harvestEntityState(STATE);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.entityState.sleepPhase, 'DEEP');
    assert.strictEqual(result.entityState.fatigue, 0.7);
    assert.strictEqual(result.entityState.consciousness, 0.9);
  });

  it('harvests affect state', () => {
    const STATE = {
      affect: {
        valence: 0.6,
        arousal: 0.5,
        dominance: 0.7,
        fatigue: 0.3,
      },
    };
    const result = harvestEntityState(STATE);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.entityState.valence, 0.6);
    assert.strictEqual(result.entityState.arousal, 0.5);
    assert.strictEqual(result.entityState.dominance, 0.7);
  });

  it('harvests active wounds from organs', () => {
    const organs = new Map([
      ['organ1', {
        wounds: [
          { source: 'rejection', severity: 0.8, domain: 'social' },
          { source: 'minor', severity: 0.1, domain: 'test' }, // Below threshold
        ],
      }],
    ]);
    const STATE = { organs };
    const result = harvestEntityState(STATE);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.entityState.activeWounds.length, 1);
    assert.strictEqual(result.entityState.activeWounds[0].source, 'rejection');
  });

  it('caps wounds at 5', () => {
    const wounds = Array.from({ length: 10 }, (_, i) => ({
      source: `wound_${i}`, severity: 0.5 + i * 0.01, domain: 'test',
    }));
    const STATE = { organs: new Map([['o1', { wounds }]]) };
    const result = harvestEntityState(STATE);
    assert.ok(result.entityState.activeWounds.length <= 5);
  });

  it('harvests avoidance rules', () => {
    const STATE = {
      avoidanceRules: [
        { pattern: 'politics', reason: 'causes conflict', strength: 0.8 },
        { trigger: 'anger', reason: 'escalation risk', strength: 0.6 },
      ],
    };
    const result = harvestEntityState(STATE);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.entityState.avoidanceRules.length, 2);
    assert.strictEqual(result.entityState.avoidanceRules[0].pattern, 'politics');
    assert.strictEqual(result.entityState.avoidanceRules[1].pattern, 'anger');
  });

  it('harvests active wants', () => {
    const STATE = {
      wants: [
        { description: 'learn physics', priority: 0.9, active: true, domain: 'science' },
        { description: 'low priority', priority: 0.1, active: true },
        { description: 'inactive', priority: 0.8, active: false },
      ],
    };
    const result = harvestEntityState(STATE);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.entityState.currentWants.length, 1);
    assert.strictEqual(result.entityState.currentWants[0].description, 'learn physics');
  });
});

// ── formatEntityStateBlock tests ────────────────────────────────────────────

describe('formatEntityStateBlock', () => {
  it('returns empty string for null', () => {
    assert.strictEqual(formatEntityStateBlock(null), '');
  });

  it('returns empty string for empty object', () => {
    assert.strictEqual(formatEntityStateBlock({}), '');
  });

  it('includes sleep phase when not AWAKE', () => {
    const block = formatEntityStateBlock({ sleepPhase: 'DEEP' });
    assert.ok(block.includes('Sleep: DEEP'));
  });

  it('omits sleep phase when AWAKE', () => {
    const block = formatEntityStateBlock({ sleepPhase: 'AWAKE', valence: 0.5 });
    assert.ok(!block.includes('Sleep:'));
  });

  it('includes fatigue when above threshold', () => {
    const block = formatEntityStateBlock({ fatigue: 0.7 });
    assert.ok(block.includes('Fatigue: 70%'));
  });

  it('omits fatigue when below threshold', () => {
    const block = formatEntityStateBlock({ fatigue: 0.2, valence: 0.5 });
    assert.ok(!block.includes('Fatigue'));
  });

  it('classifies mood correctly', () => {
    assert.ok(formatEntityStateBlock({ valence: 0.8 }).includes('positive'));
    assert.ok(formatEntityStateBlock({ valence: 0.3 }).includes('low'));
    assert.ok(formatEntityStateBlock({ valence: 0.5 }).includes('neutral'));
  });

  it('includes wounds', () => {
    const block = formatEntityStateBlock({
      activeWounds: [{ source: 'conflict', severity: 0.6 }],
    });
    assert.ok(block.includes('Active wounds'));
    assert.ok(block.includes('conflict'));
  });

  it('includes avoidance rules', () => {
    const block = formatEntityStateBlock({
      avoidanceRules: [{ pattern: 'politics' }],
    });
    assert.ok(block.includes('Avoidance'));
    assert.ok(block.includes('politics'));
  });

  it('includes wants', () => {
    const block = formatEntityStateBlock({
      currentWants: [{ description: 'learn more' }],
    });
    assert.ok(block.includes('Wants'));
    assert.ok(block.includes('learn more'));
  });

  it('starts with [Entity State] header', () => {
    const block = formatEntityStateBlock({ valence: 0.5 });
    assert.ok(block.startsWith('[Entity State]'));
  });
});

// ── consolidateMegaHypers tests ─────────────────────────────────────────────

describe('consolidateMegaHypers', () => {
  it('returns empty for empty working set', () => {
    const result = consolidateMegaHypers([], {});
    assert.deepStrictEqual(result.consolidated, []);
    assert.strictEqual(result.removedCount, 0);
  });

  it('returns original set when no MEGA/HYPER present', () => {
    const ws = [
      { id: 'dtu1', tier: 'regular', tags: [] },
      { id: 'dtu2', tier: 'regular', tags: [] },
    ];
    const result = consolidateMegaHypers(ws, {});
    assert.strictEqual(result.consolidated.length, 2);
    assert.strictEqual(result.removedCount, 0);
  });

  it('removes children of MEGA DTUs', () => {
    const ws = [
      { id: 'mega1', tier: 'mega', lineage: { children: ['child1', 'child2'] }, tags: [] },
      { id: 'child1', tier: 'regular', tags: [] },
      { id: 'child2', tier: 'regular', tags: [] },
      { id: 'unrelated', tier: 'regular', tags: [] },
    ];
    const result = consolidateMegaHypers(ws, {});
    assert.strictEqual(result.consolidated.length, 2); // mega1 + unrelated
    assert.strictEqual(result.removedCount, 2);
    assert.ok(result.consolidated.find(d => d.id === 'mega1'));
    assert.ok(result.consolidated.find(d => d.id === 'unrelated'));
  });

  it('removes children of HYPER DTUs', () => {
    const ws = [
      { id: 'hyper1', tier: 'hyper', lineage: { children: ['c1'] }, tags: [] },
      { id: 'c1', tier: 'regular', tags: [] },
    ];
    const result = consolidateMegaHypers(ws, {});
    assert.strictEqual(result.consolidated.length, 1);
    assert.strictEqual(result.removedCount, 1);
  });

  it('annotates MEGA with _consolidates count', () => {
    const ws = [
      { id: 'mega1', tier: 'mega', lineage: { children: ['c1', 'c2', 'c3'] }, tags: [] },
      { id: 'c1', tier: 'regular', tags: [] },
    ];
    const result = consolidateMegaHypers(ws, {});
    const mega = result.consolidated.find(d => d.id === 'mega1');
    assert.strictEqual(mega._consolidates, 3);
  });

  it('handles meta.tier detection', () => {
    const ws = [
      { id: 'mega1', tier: 'regular', meta: { tier: 'mega' }, lineage: { children: ['c1'] }, tags: [] },
      { id: 'c1', tier: 'regular', tags: [] },
    ];
    const result = consolidateMegaHypers(ws, {});
    assert.strictEqual(result.removedCount, 1);
  });

  it('checks STATE.dtus for lineage when not on DTU', () => {
    const ws = [
      { id: 'mega1', tier: 'mega', tags: [] },
      { id: 'c1', tier: 'regular', tags: [] },
    ];
    const STATE = {
      dtus: new Map([
        ['mega1', { lineage: { children: ['c1'] } }],
      ]),
    };
    const result = consolidateMegaHypers(ws, STATE);
    assert.strictEqual(result.removedCount, 1);
  });

  it('handles null working set', () => {
    const result = consolidateMegaHypers(null, {});
    assert.deepStrictEqual(result.consolidated, []);
  });
});

// ── runContextHarvest tests ─────────────────────────────────────────────────

describe('runContextHarvest', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.CUDA_VISIBLE_DEVICES;
    delete process.env.GPU_ENABLED;
    delete process.env.MULTI_GPU;
  });

  afterEach(() => {
    Object.assign(process.env, savedEnv);
  });

  it('returns structured harvest result', () => {
    const STATE = { sessions: new Map(), shadowDtus: new Map() };
    const result = runContextHarvest(STATE, { sessionId: 's1', prompt: 'hello' });
    assert.strictEqual(result.ok, true);
    assert.ok(result.sources);
    assert.ok(result.hardwareTier);
    assert.ok(typeof result.maxWorkingSet === 'number');
  });

  it('harvests entity state', () => {
    const STATE = {
      sessions: new Map(),
      shadowDtus: new Map(),
      affect: { valence: 0.6 },
    };
    const result = runContextHarvest(STATE, { sessionId: 's1', prompt: 'test' });
    assert.strictEqual(result.sources.entityState, 'available');
    assert.ok(result.entityState.valence);
    assert.ok(result.entityStateBlock.includes('Mood'));
  });

  it('consolidates MEGA/HYPER DTUs', () => {
    const STATE = { sessions: new Map(), shadowDtus: new Map() };
    const dtus = [
      { id: 'mega1', tier: 'mega', lineage: { children: ['c1'] }, tags: [] },
      { id: 'c1', tier: 'regular', tags: [] },
      { id: 'c2', tier: 'regular', tags: [] },
    ];
    const result = runContextHarvest(STATE, {
      sessionId: 's1',
      prompt: 'test',
      workingSetDtus: dtus,
    });
    assert.strictEqual(result.consolidatedOut, 1);
    assert.strictEqual(result.consolidatedWorkingSet.length, 2); // mega1 + c2
  });

  it('caps working set to max N', () => {
    const STATE = { sessions: new Map(), shadowDtus: new Map() };
    const dtus = Array.from({ length: 50 }, (_, i) => ({
      id: `dtu_${i}`, tier: 'regular', tags: [],
    }));
    const result = runContextHarvest(STATE, {
      sessionId: 's1',
      prompt: 'test',
      workingSetDtus: dtus,
    });
    assert.ok(result.consolidatedWorkingSet.length <= result.maxWorkingSet);
  });

  it('includes conversation summary when available', () => {
    const STATE = {
      sessions: new Map(),
      shadowDtus: new Map([
        ['summary_session_s1', { machine: { summaryText: 'Previous context' } }],
      ]),
    };
    const result = runContextHarvest(STATE, { sessionId: 's1', prompt: 'test' });
    assert.strictEqual(result.conversationSummary, 'Previous context');
    assert.strictEqual(result.sources.conversationSummary, 'available');
  });

  it('marks summary as empty when not available', () => {
    const STATE = { sessions: new Map(), shadowDtus: new Map() };
    const result = runContextHarvest(STATE, { sessionId: 's1', prompt: 'test' });
    assert.strictEqual(result.conversationSummary, '');
    assert.strictEqual(result.sources.conversationSummary, 'empty');
  });
});

// ── Metrics tests ───────────────────────────────────────────────────────────

describe('harvestMetrics', () => {
  it('getHarvestMetrics returns metrics object', () => {
    const result = getHarvestMetrics();
    assert.strictEqual(result.ok, true);
    assert.ok(result.metrics);
    assert.ok(typeof result.metrics.totalHarvests === 'number');
  });

  it('recordHarvestMetrics updates counters', () => {
    const before = getHarvestMetrics().metrics.totalHarvests;
    recordHarvestMetrics({
      consolidatedWorkingSet: [1, 2, 3],
      conversationSummary: 'summary',
      sources: { entityState: 'available' },
      consolidatedOut: 1,
    });
    const after = getHarvestMetrics().metrics.totalHarvests;
    assert.ok(after > before);
  });
});
