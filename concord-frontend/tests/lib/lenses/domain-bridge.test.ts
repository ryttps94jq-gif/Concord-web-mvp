import { describe, it, expect } from 'vitest';
import {
  getDomainProfile,
  getCompetitorParityScore,
  getAllBoundDomains,
  getFleetParityReport,
  getFleetSummary,
} from '@/lib/lenses/domain-bridge';

describe('getDomainProfile', () => {
  it('returns full profile for healthcare (all 5 dimensions)', () => {
    const profile = getDomainProfile('healthcare');
    expect(profile.domain).toBe('healthcare');
    expect(profile.schema).not.toBeNull();
    expect(profile.workflows.length).toBeGreaterThan(0);
    expect(profile.importExport).not.toBeNull();
    expect(profile.automation).not.toBeNull();
    expect(profile.rbac).not.toBeNull();
  });

  it('returns profile for paper domain', () => {
    const profile = getDomainProfile('paper');
    expect(profile.domain).toBe('paper');
    expect(profile.schema).not.toBeNull();
    expect(profile.workflows.length).toBeGreaterThan(0);
    expect(profile.importExport).not.toBeNull();
    expect(profile.rbac).not.toBeNull();
  });

  it('returns profile with nulls for unknown domain', () => {
    const profile = getDomainProfile('nonexistent');
    expect(profile.domain).toBe('nonexistent');
    expect(profile.schema).toBeNull();
    expect(profile.workflows).toEqual([]);
    expect(profile.importExport).toBeNull();
    expect(profile.automation).toBeNull();
    expect(profile.rbac).toBeNull();
  });

  it('returns correct shape for all fields', () => {
    const profile = getDomainProfile('legal');
    expect(typeof profile.domain).toBe('string');
    // schema is either DomainSchema or null
    if (profile.schema) {
      expect(typeof profile.schema.domain).toBe('string');
      expect(Array.isArray(profile.schema.entities)).toBe(true);
    }
    expect(Array.isArray(profile.workflows)).toBe(true);
  });

  it('code domain has some dimensions', () => {
    const profile = getDomainProfile('code');
    expect(profile.schema).not.toBeNull();
    expect(profile.workflows.length).toBeGreaterThan(0);
    expect(profile.importExport).not.toBeNull();
    expect(profile.rbac).not.toBeNull();
  });
});

describe('getCompetitorParityScore', () => {
  it('returns score for healthcare (expected 5/5 - competitor-level)', () => {
    const score = getCompetitorParityScore('healthcare');
    expect(score.domain).toBe('healthcare');
    expect(score.score).toBe(5);
    expect(score.tier).toBe('competitor-level');
    expect(score.dimensions.schema).toBe(true);
    expect(score.dimensions.workflows).toBe(true);
    expect(score.dimensions.importExport).toBe(true);
    expect(score.dimensions.automation).toBe(true);
    expect(score.dimensions.rbac).toBe(true);
  });

  it('returns score for paper domain', () => {
    const score = getCompetitorParityScore('paper');
    expect(score.domain).toBe('paper');
    expect(score.score).toBeGreaterThanOrEqual(2);
    expect(score.dimensions.schema).toBe(true);
    expect(score.dimensions.workflows).toBe(true);
  });

  it('returns zero score for unknown domain', () => {
    const score = getCompetitorParityScore('nonexistent');
    expect(score.domain).toBe('nonexistent');
    expect(score.score).toBe(0);
    expect(score.tier).toBe('scaffold');
    expect(score.dimensions.schema).toBe(false);
    expect(score.dimensions.workflows).toBe(false);
    expect(score.dimensions.importExport).toBe(false);
    expect(score.dimensions.automation).toBe(false);
    expect(score.dimensions.rbac).toBe(false);
  });

  it('tier is competitor-level for score >= 4', () => {
    const score = getCompetitorParityScore('healthcare');
    expect(score.score).toBeGreaterThanOrEqual(4);
    expect(score.tier).toBe('competitor-level');
  });

  it('tier is platform-ready for score 2-3', () => {
    // graph domain has schema and workflows (2 dims bound via schemas + workflows)
    // but may not have all 5 dimensions
    const score = getCompetitorParityScore('graph');
    if (score.score >= 2 && score.score < 4) {
      expect(score.tier).toBe('platform-ready');
    }
  });

  it('tier is scaffold for score 0-1', () => {
    const score = getCompetitorParityScore('nonexistent');
    expect(score.tier).toBe('scaffold');
  });

  it('dimensions are boolean values', () => {
    const score = getCompetitorParityScore('legal');
    expect(typeof score.dimensions.schema).toBe('boolean');
    expect(typeof score.dimensions.workflows).toBe('boolean');
    expect(typeof score.dimensions.importExport).toBe('boolean');
    expect(typeof score.dimensions.automation).toBe('boolean');
    expect(typeof score.dimensions.rbac).toBe('boolean');
  });

  it('score equals the number of true dimensions', () => {
    const score = getCompetitorParityScore('legal');
    const trueCount = Object.values(score.dimensions).filter(Boolean).length;
    expect(score.score).toBe(trueCount);
  });
});

describe('getAllBoundDomains', () => {
  it('returns a non-empty array', () => {
    const domains = getAllBoundDomains();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBeGreaterThan(0);
  });

  it('returns sorted array', () => {
    const domains = getAllBoundDomains();
    const sorted = [...domains].sort();
    expect(domains).toEqual(sorted);
  });

  it('contains no duplicates', () => {
    const domains = getAllBoundDomains();
    const unique = new Set(domains);
    expect(unique.size).toBe(domains.length);
  });

  it('includes domains from all dimension sources', () => {
    const domains = getAllBoundDomains();
    // healthcare appears in schemas, workflows, import/export, automation, rbac
    expect(domains).toContain('healthcare');
    // paper appears in schemas, workflows, import/export, rbac
    expect(domains).toContain('paper');
  });

  it('includes domains that only have some dimensions', () => {
    const domains = getAllBoundDomains();
    // graph has schema but may not have automation
    expect(domains).toContain('graph');
  });
});

describe('getFleetParityReport', () => {
  it('returns non-empty array', () => {
    const report = getFleetParityReport();
    expect(Array.isArray(report)).toBe(true);
    expect(report.length).toBeGreaterThan(0);
  });

  it('is sorted by score descending', () => {
    const report = getFleetParityReport();
    for (let i = 1; i < report.length; i++) {
      expect(report[i].score).toBeLessThanOrEqual(report[i - 1].score);
    }
  });

  it('every entry has the CompetitorParityScore shape', () => {
    const report = getFleetParityReport();
    for (const entry of report) {
      expect(typeof entry.domain).toBe('string');
      expect(typeof entry.score).toBe('number');
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(5);
      expect(typeof entry.dimensions).toBe('object');
      expect(['competitor-level', 'platform-ready', 'scaffold']).toContain(entry.tier);
    }
  });

  it('report length matches getAllBoundDomains length', () => {
    const report = getFleetParityReport();
    const domains = getAllBoundDomains();
    expect(report.length).toBe(domains.length);
  });

  it('highest-scoring domains are competitor-level', () => {
    const report = getFleetParityReport();
    const topScorer = report[0];
    expect(topScorer.score).toBeGreaterThanOrEqual(4);
    expect(topScorer.tier).toBe('competitor-level');
  });
});

describe('getFleetSummary', () => {
  it('returns summary with all fields', () => {
    const summary = getFleetSummary();
    expect(typeof summary.competitorLevel).toBe('number');
    expect(typeof summary.platformReady).toBe('number');
    expect(typeof summary.scaffold).toBe('number');
    expect(typeof summary.total).toBe('number');
  });

  it('total equals sum of tiers', () => {
    const summary = getFleetSummary();
    expect(summary.total).toBe(
      summary.competitorLevel + summary.platformReady + summary.scaffold,
    );
  });

  it('total matches getAllBoundDomains count', () => {
    const summary = getFleetSummary();
    const domains = getAllBoundDomains();
    expect(summary.total).toBe(domains.length);
  });

  it('has at least one competitor-level domain', () => {
    const summary = getFleetSummary();
    expect(summary.competitorLevel).toBeGreaterThan(0);
  });

  it('all counts are non-negative', () => {
    const summary = getFleetSummary();
    expect(summary.competitorLevel).toBeGreaterThanOrEqual(0);
    expect(summary.platformReady).toBeGreaterThanOrEqual(0);
    expect(summary.scaffold).toBeGreaterThanOrEqual(0);
    expect(summary.total).toBeGreaterThan(0);
  });
});
