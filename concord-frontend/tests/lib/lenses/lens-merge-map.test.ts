import { describe, it, expect } from 'vitest';
import {
  LENS_MERGE_GROUPS,
  SUPER_LENS_MERGE_GROUPS,
  getMergeGroup,
  getAllMergeSourceIds,
  findMergeGroupForSource,
  getMergeReductionCount,
  POST_MERGE_STANDALONE_LENSES,
} from '@/lib/lenses/lens-merge-map';
import type { MergeGroup, MergeSource, PostMergeStandaloneLens } from '@/lib/lenses/lens-merge-map';

describe('LENS_MERGE_GROUPS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(LENS_MERGE_GROUPS)).toBe(true);
    expect(LENS_MERGE_GROUPS.length).toBeGreaterThan(0);
  });

  it('every group has required fields', () => {
    for (const group of LENS_MERGE_GROUPS) {
      expect(typeof group.targetId).toBe('string');
      expect(typeof group.targetName).toBe('string');
      expect(Array.isArray(group.artifacts)).toBe(true);
      expect(Array.isArray(group.engines)).toBe(true);
      expect(Array.isArray(group.pipelines)).toBe(true);
      expect(Array.isArray(group.sources)).toBe(true);
      expect(typeof group.rationale).toBe('string');
      expect(group.rationale.length).toBeGreaterThan(0);
    }
  });

  it('every source has required fields', () => {
    for (const group of LENS_MERGE_GROUPS) {
      for (const source of group.sources) {
        expect(typeof source.id).toBe('string');
        expect(['mode', 'engine', 'absorbed']).toContain(source.role);
        expect(Array.isArray(source.capabilities)).toBe(true);
      }
    }
  });

  it('includes the four core merge groups', () => {
    const targetIds = LENS_MERGE_GROUPS.map(g => g.targetId);
    expect(targetIds).toContain('paper');
    expect(targetIds).toContain('sim');
    expect(targetIds).toContain('graph');
    expect(targetIds).toContain('whiteboard');
  });

  it('LENS_MERGE_GROUPS has exactly 4 core merge groups', () => {
    expect(LENS_MERGE_GROUPS.length).toBe(4);
  });
});

describe('SUPER_LENS_MERGE_GROUPS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SUPER_LENS_MERGE_GROUPS)).toBe(true);
    expect(SUPER_LENS_MERGE_GROUPS.length).toBeGreaterThan(0);
  });

  it('includes super-lens merge groups', () => {
    const targetIds = SUPER_LENS_MERGE_GROUPS.map(g => g.targetId);
    expect(targetIds).toContain('healthcare');
    expect(targetIds).toContain('trades');
    expect(targetIds).toContain('food');
  });

  it('paper merge group has 13 sources', () => {
    const paperGroup = LENS_MERGE_GROUPS.find(g => g.targetId === 'paper');
    expect(paperGroup).toBeDefined();
    expect(paperGroup!.sources.length).toBe(13);
  });
});

describe('getMergeGroup', () => {
  it('returns merge group for known target', () => {
    const group = getMergeGroup('paper');
    expect(group).toBeDefined();
    expect(group!.targetId).toBe('paper');
    expect(group!.targetName).toBe('Research');
  });

  it('returns merge group for sim', () => {
    const group = getMergeGroup('sim');
    expect(group).toBeDefined();
    expect(group!.targetName).toBe('Simulation');
  });

  it('returns merge group for graph', () => {
    const group = getMergeGroup('graph');
    expect(group).toBeDefined();
    expect(group!.targetName).toBe('Knowledge Graph');
  });

  it('returns merge group for whiteboard', () => {
    const group = getMergeGroup('whiteboard');
    expect(group).toBeDefined();
    expect(group!.targetName).toBe('Collaboration');
  });

  it('returns undefined for unknown target', () => {
    expect(getMergeGroup('nonexistent')).toBeUndefined();
  });

  it('returns undefined for source id (not a target)', () => {
    expect(getMergeGroup('hypothesis')).toBeUndefined();
  });
});

describe('getAllMergeSourceIds', () => {
  it('returns an array of strings', () => {
    const ids = getAllMergeSourceIds();
    expect(Array.isArray(ids)).toBe(true);
    for (const id of ids) {
      expect(typeof id).toBe('string');
    }
  });

  it('includes known source ids', () => {
    const ids = getAllMergeSourceIds();
    expect(ids).toContain('hypothesis');
    expect(ids).toContain('math');
    expect(ids).toContain('entity');
    expect(ids).toContain('forum');
  });

  it('does not include target ids (core targets have no self-referencing sources)', () => {
    const ids = getAllMergeSourceIds();
    // Core merge groups: paper/sim/graph/whiteboard targets should not be sources
    expect(ids).not.toContain('paper');
    expect(ids).not.toContain('sim');
    expect(ids).not.toContain('graph');
    expect(ids).not.toContain('whiteboard');
  });
});

describe('findMergeGroupForSource', () => {
  it('finds group for source merging into paper', () => {
    const group = findMergeGroupForSource('hypothesis');
    expect(group).toBeDefined();
    expect(group!.targetId).toBe('paper');
  });

  it('finds group for source merging into sim', () => {
    const group = findMergeGroupForSource('math');
    expect(group).toBeDefined();
    expect(group!.targetId).toBe('sim');
  });

  it('finds group for source merging into graph', () => {
    const group = findMergeGroupForSource('entity');
    expect(group).toBeDefined();
    expect(group!.targetId).toBe('graph');
  });

  it('finds group for source merging into whiteboard', () => {
    const group = findMergeGroupForSource('forum');
    expect(group).toBeDefined();
    expect(group!.targetId).toBe('whiteboard');
  });

  it('returns undefined for a target lens id', () => {
    expect(findMergeGroupForSource('chat')).toBeUndefined();
  });

  it('returns undefined for unknown id', () => {
    expect(findMergeGroupForSource('nonexistent')).toBeUndefined();
  });
});

describe('getMergeReductionCount', () => {
  it('returns before, after, and merged counts', () => {
    const result = getMergeReductionCount();
    expect(typeof result.before).toBe('number');
    expect(typeof result.after).toBe('number');
    expect(typeof result.merged).toBe('number');
  });

  it('before is 97', () => {
    const result = getMergeReductionCount();
    expect(result.before).toBe(97);
  });

  it('after = before - merged', () => {
    const result = getMergeReductionCount();
    expect(result.after).toBe(result.before - result.merged);
  });

  it('merged count is positive', () => {
    const result = getMergeReductionCount();
    expect(result.merged).toBeGreaterThan(0);
  });
});

describe('POST_MERGE_STANDALONE_LENSES', () => {
  it('is a non-empty array', () => {
    expect(POST_MERGE_STANDALONE_LENSES.length).toBeGreaterThan(0);
  });

  it('includes core product lenses', () => {
    expect(POST_MERGE_STANDALONE_LENSES).toContain('paper');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('reasoning');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('council');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('agents');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('sim');
  });

  it('includes core interaction surfaces', () => {
    expect(POST_MERGE_STANDALONE_LENSES).toContain('chat');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('code');
  });

  it('includes super-lenses', () => {
    expect(POST_MERGE_STANDALONE_LENSES).toContain('healthcare');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('trades');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('food');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('retail');
  });

  it('includes system lenses', () => {
    expect(POST_MERGE_STANDALONE_LENSES).toContain('admin');
    expect(POST_MERGE_STANDALONE_LENSES).toContain('debug');
  });

  it('does not include deprecated/merged lenses', () => {
    expect(POST_MERGE_STANDALONE_LENSES).not.toContain('hypothesis');
    expect(POST_MERGE_STANDALONE_LENSES).not.toContain('math');
    expect(POST_MERGE_STANDALONE_LENSES).not.toContain('physics');
  });

  it('has no duplicates', () => {
    const unique = new Set(POST_MERGE_STANDALONE_LENSES);
    expect(unique.size).toBe(POST_MERGE_STANDALONE_LENSES.length);
  });
});
