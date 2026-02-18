import { describe, it, expect } from 'vitest';

/**
 * Type export verification tests.
 *
 * These tests verify that the type modules export their expected
 * types, interfaces, constants, and functions correctly.
 */

describe('lib/types/atlas.ts exports', () => {
  it('exports ATLAS_STATUS_CONFIG', async () => {
    const mod = await import('@/lib/types/atlas');
    expect(mod.ATLAS_STATUS_CONFIG).toBeDefined();
    expect(typeof mod.ATLAS_STATUS_CONFIG).toBe('object');
  });

  it('ATLAS_STATUS_CONFIG has all required status keys', async () => {
    const mod = await import('@/lib/types/atlas');
    const statuses = ['DRAFT', 'PROPOSED', 'VERIFIED', 'DISPUTED', 'DEPRECATED', 'QUARANTINED'];
    for (const status of statuses) {
      expect(mod.ATLAS_STATUS_CONFIG).toHaveProperty(status);
      expect(mod.ATLAS_STATUS_CONFIG[status as keyof typeof mod.ATLAS_STATUS_CONFIG]).toHaveProperty('label');
      expect(mod.ATLAS_STATUS_CONFIG[status as keyof typeof mod.ATLAS_STATUS_CONFIG]).toHaveProperty('color');
      expect(mod.ATLAS_STATUS_CONFIG[status as keyof typeof mod.ATLAS_STATUS_CONFIG]).toHaveProperty('bgColor');
    }
  });

  it('exports EPISTEMIC_CLASS_CONFIG', async () => {
    const mod = await import('@/lib/types/atlas');
    expect(mod.EPISTEMIC_CLASS_CONFIG).toBeDefined();
    const classes = ['FORMAL', 'EMPIRICAL', 'HISTORICAL', 'INTERPRETIVE', 'MODEL', 'ARTS', 'DESIGN', 'GENERAL'];
    for (const cls of classes) {
      expect(mod.EPISTEMIC_CLASS_CONFIG).toHaveProperty(cls);
    }
  });

  it('exports LICENSE_CONFIG', async () => {
    const mod = await import('@/lib/types/atlas');
    expect(mod.LICENSE_CONFIG).toBeDefined();
    expect(mod.LICENSE_CONFIG).toHaveProperty('CONCORD_PERSONAL');
    expect(mod.LICENSE_CONFIG).toHaveProperty('CONCORD_OPEN');
    expect(mod.LICENSE_CONFIG).toHaveProperty('CUSTOM');
  });

  it('exports SCOPE_LABEL_CONFIG', async () => {
    const mod = await import('@/lib/types/atlas');
    expect(mod.SCOPE_LABEL_CONFIG).toBeDefined();
    expect(mod.SCOPE_LABEL_CONFIG).toHaveProperty('local');
    expect(mod.SCOPE_LABEL_CONFIG).toHaveProperty('global');
    expect(mod.SCOPE_LABEL_CONFIG).toHaveProperty('marketplace');
  });
});

describe('lib/types/dtu.ts exports', () => {
  it('exports DTU_TIER_CONFIG', async () => {
    const mod = await import('@/lib/types/dtu');
    expect(mod.DTU_TIER_CONFIG).toBeDefined();
    expect(typeof mod.DTU_TIER_CONFIG).toBe('object');
  });

  it('DTU_TIER_CONFIG has all tier keys', async () => {
    const mod = await import('@/lib/types/dtu');
    const tiers = ['regular', 'mega', 'hyper', 'shadow'];
    for (const tier of tiers) {
      expect(mod.DTU_TIER_CONFIG).toHaveProperty(tier);
      const config = mod.DTU_TIER_CONFIG[tier as keyof typeof mod.DTU_TIER_CONFIG];
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('bgColor');
      expect(config).toHaveProperty('borderColor');
      expect(config).toHaveProperty('minResonance');
      expect(config).toHaveProperty('maxChildren');
    }
  });

  it('exports canPromote function', async () => {
    const mod = await import('@/lib/types/dtu');
    expect(typeof mod.canPromote).toBe('function');
  });

  it('canPromote returns correct results', async () => {
    const { canPromote } = await import('@/lib/types/dtu');

    // Regular can promote to mega and hyper
    expect(canPromote('regular', 'mega')).toBe(true);
    expect(canPromote('regular', 'hyper')).toBe(true);

    // Mega can promote to hyper
    expect(canPromote('mega', 'hyper')).toBe(true);

    // Cannot promote to same or lower tier
    expect(canPromote('mega', 'mega')).toBe(false);
    expect(canPromote('mega', 'regular')).toBe(false);
    expect(canPromote('hyper', 'regular')).toBe(false);

    // Shadow cannot be promoted
    expect(canPromote('shadow', 'regular')).toBe(false);
    expect(canPromote('shadow', 'mega')).toBe(false);
    expect(canPromote('shadow', 'hyper')).toBe(false);
  });

  it('regular tier has minResonance of 0', async () => {
    const mod = await import('@/lib/types/dtu');
    expect(mod.DTU_TIER_CONFIG.regular.minResonance).toBe(0);
  });

  it('hyper tier has minResonance of 0.8', async () => {
    const mod = await import('@/lib/types/dtu');
    expect(mod.DTU_TIER_CONFIG.hyper.minResonance).toBe(0.8);
  });
});

describe('lib/types/lens.ts exports', () => {
  it('exports LENS_CATEGORIES', async () => {
    const mod = await import('@/lib/types/lens');
    expect(mod.LENS_CATEGORIES).toBeDefined();
    expect(typeof mod.LENS_CATEGORIES).toBe('object');
  });

  it('LENS_CATEGORIES has expected categories', async () => {
    const mod = await import('@/lib/types/lens');
    const categories = ['core', 'knowledge', 'science', 'creative', 'governance', 'ai', 'system', 'specialized'];
    for (const cat of categories) {
      expect(mod.LENS_CATEGORIES).toHaveProperty(cat);
      expect(mod.LENS_CATEGORIES[cat as keyof typeof mod.LENS_CATEGORIES]).toHaveProperty('label');
      expect(mod.LENS_CATEGORIES[cat as keyof typeof mod.LENS_CATEGORIES]).toHaveProperty('color');
    }
  });

  it('each category has a non-empty label', async () => {
    const mod = await import('@/lib/types/lens');
    for (const [_key, value] of Object.entries(mod.LENS_CATEGORIES)) {
      expect(value.label.length).toBeGreaterThan(0);
      expect(value.color.length).toBeGreaterThan(0);
    }
  });
});
