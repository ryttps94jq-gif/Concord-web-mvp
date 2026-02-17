import { describe, it, expect } from 'vitest';
import {
  IMPORT_EXPORT_PROFILES,
  AUTOMATION_PROFILES,
  DOMAIN_RBAC_PROFILES,
  getImportExportProfile,
  getAutomationProfile,
  getDomainRBAC,
  getDomainsWithImportExport,
  getDomainsWithAutomation,
  getDomainsWithRBAC,
} from '@/lib/lenses/automation-bindings';

describe('IMPORT_EXPORT_PROFILES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(IMPORT_EXPORT_PROFILES)).toBe(true);
    expect(IMPORT_EXPORT_PROFILES.length).toBeGreaterThan(0);
  });

  it('every profile has required fields', () => {
    for (const profile of IMPORT_EXPORT_PROFILES) {
      expect(typeof profile.domain).toBe('string');
      expect(profile.domain.length).toBeGreaterThan(0);
      expect(Array.isArray(profile.imports)).toBe(true);
      expect(Array.isArray(profile.exports)).toBe(true);
      expect(Array.isArray(profile.webhookEvents)).toBe(true);
      expect(profile.webhookEvents.length).toBeGreaterThan(0);
    }
  });

  it('every import entry has format, entity, and hint', () => {
    for (const profile of IMPORT_EXPORT_PROFILES) {
      for (const imp of profile.imports) {
        expect(typeof imp.format).toBe('string');
        expect(typeof imp.entity).toBe('string');
        expect(typeof imp.hint).toBe('string');
      }
    }
  });

  it('every export entry has format, entity, and hint', () => {
    for (const profile of IMPORT_EXPORT_PROFILES) {
      for (const exp of profile.exports) {
        expect(typeof exp.format).toBe('string');
        expect(typeof exp.entity).toBe('string');
        expect(typeof exp.hint).toBe('string');
      }
    }
  });

  it('includes core and super-lens domains', () => {
    const domains = IMPORT_EXPORT_PROFILES.map(p => p.domain);
    expect(domains).toContain('healthcare');
    expect(domains).toContain('legal');
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
  });

  it('healthcare profile has apiCompat', () => {
    const hc = IMPORT_EXPORT_PROFILES.find(p => p.domain === 'healthcare');
    expect(hc).toBeDefined();
    expect(hc!.apiCompat).toBeDefined();
    expect(hc!.apiCompat).toContain('FHIR R4');
  });
});

describe('AUTOMATION_PROFILES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(AUTOMATION_PROFILES)).toBe(true);
    expect(AUTOMATION_PROFILES.length).toBeGreaterThan(0);
  });

  it('every profile has domain and triggers', () => {
    for (const profile of AUTOMATION_PROFILES) {
      expect(typeof profile.domain).toBe('string');
      expect(Array.isArray(profile.triggers)).toBe(true);
      expect(profile.triggers.length).toBeGreaterThan(0);
    }
  });

  it('every trigger has required fields', () => {
    for (const profile of AUTOMATION_PROFILES) {
      for (const trigger of profile.triggers) {
        expect(typeof trigger.event).toBe('string');
        expect(typeof trigger.label).toBe('string');
        expect(typeof trigger.macro).toBe('string');
        expect(typeof trigger.defaultEnabled).toBe('boolean');
      }
    }
  });

  it('some triggers have conditions', () => {
    const allTriggers = AUTOMATION_PROFILES.flatMap(p => p.triggers);
    const withConditions = allTriggers.filter(t => t.condition);
    expect(withConditions.length).toBeGreaterThan(0);
  });

  it('includes healthcare automation', () => {
    const hc = AUTOMATION_PROFILES.find(p => p.domain === 'healthcare');
    expect(hc).toBeDefined();
    expect(hc!.triggers.length).toBeGreaterThan(0);
  });
});

describe('DOMAIN_RBAC_PROFILES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DOMAIN_RBAC_PROFILES)).toBe(true);
    expect(DOMAIN_RBAC_PROFILES.length).toBeGreaterThan(0);
  });

  it('every profile has required fields', () => {
    for (const profile of DOMAIN_RBAC_PROFILES) {
      expect(typeof profile.domain).toBe('string');
      expect(Array.isArray(profile.permissions)).toBe(true);
      expect(profile.permissions.length).toBeGreaterThan(0);
      expect(typeof profile.sharedArtifacts).toBe('boolean');
      expect(typeof profile.activityFeed).toBe('boolean');
    }
  });

  it('every permission has required fields', () => {
    for (const profile of DOMAIN_RBAC_PROFILES) {
      for (const perm of profile.permissions) {
        expect(typeof perm.action).toBe('string');
        expect(typeof perm.label).toBe('string');
        expect(['viewer', 'reviewer', 'editor', 'admin', 'owner']).toContain(perm.minRole);
      }
    }
  });

  it('some permissions are non-delegable', () => {
    const allPerms = DOMAIN_RBAC_PROFILES.flatMap(p => p.permissions);
    const nonDelegable = allPerms.filter(p => p.delegable === false);
    expect(nonDelegable.length).toBeGreaterThan(0);
  });

  it('fitness profile has sharedArtifacts = false', () => {
    const fitness = DOMAIN_RBAC_PROFILES.find(p => p.domain === 'fitness');
    expect(fitness).toBeDefined();
    expect(fitness!.sharedArtifacts).toBe(false);
  });
});

describe('getImportExportProfile', () => {
  it('returns profile for known domain', () => {
    const profile = getImportExportProfile('healthcare');
    expect(profile).toBeDefined();
    expect(profile!.domain).toBe('healthcare');
  });

  it('returns profile for paper domain', () => {
    const profile = getImportExportProfile('paper');
    expect(profile).toBeDefined();
    expect(profile!.domain).toBe('paper');
    expect(profile!.imports.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown domain', () => {
    expect(getImportExportProfile('nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getImportExportProfile('')).toBeUndefined();
  });
});

describe('getAutomationProfile', () => {
  it('returns profile for known domain', () => {
    const profile = getAutomationProfile('healthcare');
    expect(profile).toBeDefined();
    expect(profile!.domain).toBe('healthcare');
    expect(profile!.triggers.length).toBeGreaterThan(0);
  });

  it('returns profile for legal domain', () => {
    const profile = getAutomationProfile('legal');
    expect(profile).toBeDefined();
    expect(profile!.triggers.length).toBeGreaterThan(0);
  });

  it('returns undefined for unknown domain', () => {
    expect(getAutomationProfile('nonexistent')).toBeUndefined();
  });
});

describe('getDomainRBAC', () => {
  it('returns profile for known domain', () => {
    const profile = getDomainRBAC('healthcare');
    expect(profile).toBeDefined();
    expect(profile!.domain).toBe('healthcare');
    expect(profile!.permissions.length).toBeGreaterThan(0);
  });

  it('returns profile for paper domain', () => {
    const profile = getDomainRBAC('paper');
    expect(profile).toBeDefined();
    expect(profile!.sharedArtifacts).toBe(true);
  });

  it('returns undefined for unknown domain', () => {
    expect(getDomainRBAC('nonexistent')).toBeUndefined();
  });
});

describe('getDomainsWithImportExport', () => {
  it('returns array of strings', () => {
    const domains = getDomainsWithImportExport();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBe(IMPORT_EXPORT_PROFILES.length);
    for (const d of domains) {
      expect(typeof d).toBe('string');
    }
  });

  it('contains known domains', () => {
    const domains = getDomainsWithImportExport();
    expect(domains).toContain('healthcare');
    expect(domains).toContain('legal');
    expect(domains).toContain('paper');
  });
});

describe('getDomainsWithAutomation', () => {
  it('returns array of strings', () => {
    const domains = getDomainsWithAutomation();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBe(AUTOMATION_PROFILES.length);
    for (const d of domains) {
      expect(typeof d).toBe('string');
    }
  });

  it('contains known domains', () => {
    const domains = getDomainsWithAutomation();
    expect(domains).toContain('healthcare');
    expect(domains).toContain('security');
  });
});

describe('getDomainsWithRBAC', () => {
  it('returns array of strings', () => {
    const domains = getDomainsWithRBAC();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains.length).toBe(DOMAIN_RBAC_PROFILES.length);
    for (const d of domains) {
      expect(typeof d).toBe('string');
    }
  });

  it('contains known domains', () => {
    const domains = getDomainsWithRBAC();
    expect(domains).toContain('healthcare');
    expect(domains).toContain('paper');
    expect(domains).toContain('code');
    expect(domains).toContain('graph');
  });
});
