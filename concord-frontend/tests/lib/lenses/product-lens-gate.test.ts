import { describe, it, expect } from 'vitest';
import {
  LENS_CAPABILITIES,
  GATE_PASS_THRESHOLD,
  MAX_SCORE,
  scoreLens,
  CI_HARD_RULES,
} from '@/lib/lenses/product-lens-gate';
import type { LensCapability, LensScore, CIViolation } from '@/lib/lenses/product-lens-gate';

describe('LENS_CAPABILITIES', () => {
  it('is an array of 7 capabilities', () => {
    expect(Array.isArray(LENS_CAPABILITIES)).toBe(true);
    expect(LENS_CAPABILITIES.length).toBe(7);
  });

  it('every capability has required fields', () => {
    for (const cap of LENS_CAPABILITIES) {
      expect(typeof cap.name).toBe('string');
      expect(cap.name.length).toBeGreaterThan(0);
      expect(typeof cap.description).toBe('string');
      expect(typeof cap.verification).toBe('string');
      expect(typeof cap.weight).toBe('number');
      expect(cap.weight).toBe(1);
    }
  });

  it('has no duplicate capability names', () => {
    const names = LENS_CAPABILITIES.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('includes the 7 mandatory capabilities', () => {
    const names = LENS_CAPABILITIES.map(c => c.name);
    expect(names).toContain('primary_artifact');
    expect(names).toContain('persistence');
    expect(names).toContain('editor_workspace');
    expect(names).toContain('engine');
    expect(names).toContain('pipeline');
    expect(names).toContain('import_export');
    expect(names).toContain('dtu_exhaust');
  });
});

describe('GATE_PASS_THRESHOLD', () => {
  it('is 5', () => {
    expect(GATE_PASS_THRESHOLD).toBe(5);
  });
});

describe('MAX_SCORE', () => {
  it('equals the number of capabilities', () => {
    expect(MAX_SCORE).toBe(LENS_CAPABILITIES.length);
    expect(MAX_SCORE).toBe(7);
  });
});

describe('scoreLens', () => {
  it('scores a perfect lens 7/7', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: true,
      editor_workspace: true,
      engine: true,
      pipeline: true,
      import_export: true,
      dtu_exhaust: true,
    };
    const score = scoreLens('test-lens', capabilities);
    expect(score.lensId).toBe('test-lens');
    expect(score.total).toBe(7);
    expect(score.maxScore).toBe(7);
    expect(score.passes).toBe(true);
    expect(score.isPublicReady).toBe(true);
  });

  it('scores a lens at exactly threshold (5/7)', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: true,
      editor_workspace: true,
      engine: true,
      pipeline: true,
      import_export: false,
      dtu_exhaust: false,
    };
    const score = scoreLens('threshold-lens', capabilities);
    expect(score.total).toBe(5);
    expect(score.passes).toBe(true);
    expect(score.isPublicReady).toBe(true);
  });

  it('fails a lens below threshold (4/7)', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: true,
      editor_workspace: true,
      engine: true,
      pipeline: false,
      import_export: false,
      dtu_exhaust: false,
    };
    const score = scoreLens('below-threshold', capabilities);
    expect(score.total).toBe(4);
    expect(score.passes).toBe(false);
    expect(score.isPublicReady).toBe(false);
  });

  it('scores zero for no capabilities', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: false,
      persistence: false,
      editor_workspace: false,
      engine: false,
      pipeline: false,
      import_export: false,
      dtu_exhaust: false,
    };
    const score = scoreLens('zero-lens', capabilities);
    expect(score.total).toBe(0);
    expect(score.passes).toBe(false);
    expect(score.isPublicReady).toBe(false);
  });

  it('handles empty capabilities object', () => {
    const score = scoreLens('empty-lens', {});
    expect(score.total).toBe(0);
    expect(score.passes).toBe(false);
  });

  it('preserves capabilities map in the result', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: false,
    };
    const score = scoreLens('partial', capabilities);
    expect(score.capabilities).toBe(capabilities);
    expect(score.capabilities.primary_artifact).toBe(true);
    expect(score.capabilities.persistence).toBe(false);
  });

  it('scores 6/7 (passes)', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: true,
      editor_workspace: true,
      engine: true,
      pipeline: true,
      import_export: true,
      dtu_exhaust: false,
    };
    const score = scoreLens('six-of-seven', capabilities);
    expect(score.total).toBe(6);
    expect(score.passes).toBe(true);
  });

  it('scores 1/7 (fails)', () => {
    const capabilities: Record<string, boolean> = {
      primary_artifact: true,
      persistence: false,
      editor_workspace: false,
      engine: false,
      pipeline: false,
      import_export: false,
      dtu_exhaust: false,
    };
    const score = scoreLens('one-of-seven', capabilities);
    expect(score.total).toBe(1);
    expect(score.passes).toBe(false);
  });
});

describe('CI_HARD_RULES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CI_HARD_RULES)).toBe(true);
    expect(CI_HARD_RULES.length).toBeGreaterThan(0);
  });

  it('every rule has required fields', () => {
    for (const rule of CI_HARD_RULES) {
      expect(typeof rule.id).toBe('string');
      expect(rule.id.length).toBeGreaterThan(0);
      expect(typeof rule.description).toBe('string');
      expect(['error', 'warning']).toContain(rule.severity);
      expect(typeof rule.check).toBe('string');
    }
  });

  it('has no duplicate rule IDs', () => {
    const ids = CI_HARD_RULES.map(r => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('includes known rules', () => {
    const ids = CI_HARD_RULES.map(r => r.id);
    expect(ids).toContain('no_mock_imports');
    expect(ids).toContain('no_artifact_no_product');
    expect(ids).toContain('no_write_macro');
    expect(ids).toContain('deprecated_in_sidebar');
    expect(ids).toContain('low_score_public');
  });

  it('error rules are the core blockers', () => {
    const errors = CI_HARD_RULES.filter(r => r.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    const errorIds = errors.map(r => r.id);
    expect(errorIds).toContain('no_mock_imports');
    expect(errorIds).toContain('no_artifact_no_product');
    expect(errorIds).toContain('no_write_macro');
  });

  it('warning rules exist', () => {
    const warnings = CI_HARD_RULES.filter(r => r.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
  });
});
