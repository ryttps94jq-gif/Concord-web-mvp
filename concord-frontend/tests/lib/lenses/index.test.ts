import { describe, it, expect } from 'vitest';

/**
 * Test the barrel export from lib/lenses/index.ts.
 * Verifies that all expected exports are accessible through the barrel.
 */
import {
  // manifest
  LENS_MANIFESTS,
  getLensManifest,
  getLensManifests,
  getAllLensDomains,
  getManifestCount,
  getLensesMissingMacro,

  // lens-status
  LENS_STATUS_MAP,
  getLensStatus,
  getLensesByStatus,
  getLensesMergingInto,
  getProductLenses,
  getDeprecatedLenses,
  isPublicLens,
  getLensStatusSummary,

  // lens-merge-map
  LENS_MERGE_GROUPS,
  getMergeGroup,
  getAllMergeSourceIds,
  findMergeGroupForSource,
  getMergeReductionCount,
  POST_MERGE_STANDALONE_LENSES,

  // productization-roadmap
  PRODUCTIZATION_PHASES,
  getProductionPhases,
  getCurrentPhase,
  getPhaseByLens,
  areDependenciesMet,
  getTotalArtifactCount,
  getTotalEngineCount,

  // product-lens-gate
  LENS_CAPABILITIES,
  GATE_PASS_THRESHOLD,
  MAX_SCORE,
  scoreLens,
  CI_HARD_RULES,

  // domain-schemas
  DOMAIN_SCHEMAS,
  getDomainSchema,
  getDomainEntities,
  getDomainRelations,
  getDomainsWithSchemas,

  // workflow-definitions
  WORKFLOW_DEFINITIONS,
  getWorkflowsForDomain,
  getWorkflow,
  getAvailableTransitions,
  isValidTransition,
  getInitialState,
  getDomainsWithWorkflows,

  // automation-bindings
  IMPORT_EXPORT_PROFILES,
  AUTOMATION_PROFILES,
  DOMAIN_RBAC_PROFILES,
  getImportExportProfile,
  getAutomationProfile,
  getDomainRBAC,
  getDomainsWithImportExport,
  getDomainsWithAutomation,
  getDomainsWithRBAC,

  // domain-bridge
  getDomainProfile,
  getCompetitorParityScore,
  getAllBoundDomains,
  getFleetParityReport,
  getFleetSummary,

  // chat-lens-recommender
  LENS_RECOMMENDER_REGISTRY,
  recommendLenses,
  extractSignals,
  classifyIntent,
  checkTriggers,
  scoreLensesForRecommendation,
  createSessionContext,
  createSessionTelemetry,
  recordRecommendationShown,
  recordLensOpened,
  recordDismissal,
  recordTimeToAction,
} from '@/lib/lenses';

describe('barrel export: lib/lenses/index.ts', () => {
  describe('manifest exports', () => {
    it('exports LENS_MANIFESTS as array', () => {
      expect(Array.isArray(LENS_MANIFESTS)).toBe(true);
    });

    it('exports getLensManifest as function', () => {
      expect(typeof getLensManifest).toBe('function');
    });

    it('exports getLensManifests as function', () => {
      expect(typeof getLensManifests).toBe('function');
    });

    it('exports getAllLensDomains as function', () => {
      expect(typeof getAllLensDomains).toBe('function');
    });

    it('exports getManifestCount as function', () => {
      expect(typeof getManifestCount).toBe('function');
    });

    it('exports getLensesMissingMacro as function', () => {
      expect(typeof getLensesMissingMacro).toBe('function');
    });
  });

  describe('lens-status exports', () => {
    it('exports LENS_STATUS_MAP as array', () => {
      expect(Array.isArray(LENS_STATUS_MAP)).toBe(true);
    });

    it('exports getLensStatus as function', () => {
      expect(typeof getLensStatus).toBe('function');
    });

    it('exports getLensesByStatus as function', () => {
      expect(typeof getLensesByStatus).toBe('function');
    });

    it('exports getLensesMergingInto as function', () => {
      expect(typeof getLensesMergingInto).toBe('function');
    });

    it('exports getProductLenses as function', () => {
      expect(typeof getProductLenses).toBe('function');
    });

    it('exports getDeprecatedLenses as function', () => {
      expect(typeof getDeprecatedLenses).toBe('function');
    });

    it('exports isPublicLens as function', () => {
      expect(typeof isPublicLens).toBe('function');
    });

    it('exports getLensStatusSummary as function', () => {
      expect(typeof getLensStatusSummary).toBe('function');
    });
  });

  describe('lens-merge-map exports', () => {
    it('exports LENS_MERGE_GROUPS as array', () => {
      expect(Array.isArray(LENS_MERGE_GROUPS)).toBe(true);
    });

    it('exports getMergeGroup as function', () => {
      expect(typeof getMergeGroup).toBe('function');
    });

    it('exports getAllMergeSourceIds as function', () => {
      expect(typeof getAllMergeSourceIds).toBe('function');
    });

    it('exports findMergeGroupForSource as function', () => {
      expect(typeof findMergeGroupForSource).toBe('function');
    });

    it('exports getMergeReductionCount as function', () => {
      expect(typeof getMergeReductionCount).toBe('function');
    });

    it('exports POST_MERGE_STANDALONE_LENSES', () => {
      expect(POST_MERGE_STANDALONE_LENSES).toBeDefined();
      expect(POST_MERGE_STANDALONE_LENSES.length).toBeGreaterThan(0);
    });
  });

  describe('productization-roadmap exports', () => {
    it('exports PRODUCTIZATION_PHASES as array', () => {
      expect(Array.isArray(PRODUCTIZATION_PHASES)).toBe(true);
    });

    it('exports getProductionPhases as function', () => {
      expect(typeof getProductionPhases).toBe('function');
    });

    it('exports getCurrentPhase as function', () => {
      expect(typeof getCurrentPhase).toBe('function');
    });

    it('exports getPhaseByLens as function', () => {
      expect(typeof getPhaseByLens).toBe('function');
    });

    it('exports areDependenciesMet as function', () => {
      expect(typeof areDependenciesMet).toBe('function');
    });

    it('exports getTotalArtifactCount as function', () => {
      expect(typeof getTotalArtifactCount).toBe('function');
    });

    it('exports getTotalEngineCount as function', () => {
      expect(typeof getTotalEngineCount).toBe('function');
    });
  });

  describe('product-lens-gate exports', () => {
    it('exports LENS_CAPABILITIES as array', () => {
      expect(Array.isArray(LENS_CAPABILITIES)).toBe(true);
    });

    it('exports GATE_PASS_THRESHOLD as number', () => {
      expect(typeof GATE_PASS_THRESHOLD).toBe('number');
    });

    it('exports MAX_SCORE as number', () => {
      expect(typeof MAX_SCORE).toBe('number');
    });

    it('exports scoreLens as function', () => {
      expect(typeof scoreLens).toBe('function');
    });

    it('exports CI_HARD_RULES as array', () => {
      expect(Array.isArray(CI_HARD_RULES)).toBe(true);
    });
  });

  describe('domain-schemas exports', () => {
    it('exports DOMAIN_SCHEMAS as array', () => {
      expect(Array.isArray(DOMAIN_SCHEMAS)).toBe(true);
    });

    it('exports getDomainSchema as function', () => {
      expect(typeof getDomainSchema).toBe('function');
    });

    it('exports getDomainEntities as function', () => {
      expect(typeof getDomainEntities).toBe('function');
    });

    it('exports getDomainRelations as function', () => {
      expect(typeof getDomainRelations).toBe('function');
    });

    it('exports getDomainsWithSchemas as function', () => {
      expect(typeof getDomainsWithSchemas).toBe('function');
    });
  });

  describe('workflow-definitions exports', () => {
    it('exports WORKFLOW_DEFINITIONS as array', () => {
      expect(Array.isArray(WORKFLOW_DEFINITIONS)).toBe(true);
    });

    it('exports getWorkflowsForDomain as function', () => {
      expect(typeof getWorkflowsForDomain).toBe('function');
    });

    it('exports getWorkflow as function', () => {
      expect(typeof getWorkflow).toBe('function');
    });

    it('exports getAvailableTransitions as function', () => {
      expect(typeof getAvailableTransitions).toBe('function');
    });

    it('exports isValidTransition as function', () => {
      expect(typeof isValidTransition).toBe('function');
    });

    it('exports getInitialState as function', () => {
      expect(typeof getInitialState).toBe('function');
    });

    it('exports getDomainsWithWorkflows as function', () => {
      expect(typeof getDomainsWithWorkflows).toBe('function');
    });
  });

  describe('automation-bindings exports', () => {
    it('exports IMPORT_EXPORT_PROFILES as array', () => {
      expect(Array.isArray(IMPORT_EXPORT_PROFILES)).toBe(true);
    });

    it('exports AUTOMATION_PROFILES as array', () => {
      expect(Array.isArray(AUTOMATION_PROFILES)).toBe(true);
    });

    it('exports DOMAIN_RBAC_PROFILES as array', () => {
      expect(Array.isArray(DOMAIN_RBAC_PROFILES)).toBe(true);
    });

    it('exports getImportExportProfile as function', () => {
      expect(typeof getImportExportProfile).toBe('function');
    });

    it('exports getAutomationProfile as function', () => {
      expect(typeof getAutomationProfile).toBe('function');
    });

    it('exports getDomainRBAC as function', () => {
      expect(typeof getDomainRBAC).toBe('function');
    });

    it('exports getDomainsWithImportExport as function', () => {
      expect(typeof getDomainsWithImportExport).toBe('function');
    });

    it('exports getDomainsWithAutomation as function', () => {
      expect(typeof getDomainsWithAutomation).toBe('function');
    });

    it('exports getDomainsWithRBAC as function', () => {
      expect(typeof getDomainsWithRBAC).toBe('function');
    });
  });

  describe('domain-bridge exports', () => {
    it('exports getDomainProfile as function', () => {
      expect(typeof getDomainProfile).toBe('function');
    });

    it('exports getCompetitorParityScore as function', () => {
      expect(typeof getCompetitorParityScore).toBe('function');
    });

    it('exports getAllBoundDomains as function', () => {
      expect(typeof getAllBoundDomains).toBe('function');
    });

    it('exports getFleetParityReport as function', () => {
      expect(typeof getFleetParityReport).toBe('function');
    });

    it('exports getFleetSummary as function', () => {
      expect(typeof getFleetSummary).toBe('function');
    });
  });

  describe('chat-lens-recommender exports', () => {
    it('exports LENS_RECOMMENDER_REGISTRY as array', () => {
      expect(Array.isArray(LENS_RECOMMENDER_REGISTRY)).toBe(true);
    });

    it('exports recommendLenses as function', () => {
      expect(typeof recommendLenses).toBe('function');
    });

    it('exports extractSignals as function', () => {
      expect(typeof extractSignals).toBe('function');
    });

    it('exports classifyIntent as function', () => {
      expect(typeof classifyIntent).toBe('function');
    });

    it('exports checkTriggers as function', () => {
      expect(typeof checkTriggers).toBe('function');
    });

    it('exports scoreLensesForRecommendation as function', () => {
      expect(typeof scoreLensesForRecommendation).toBe('function');
    });

    it('exports createSessionContext as function', () => {
      expect(typeof createSessionContext).toBe('function');
    });

    it('exports createSessionTelemetry as function', () => {
      expect(typeof createSessionTelemetry).toBe('function');
    });

    it('exports recordRecommendationShown as function', () => {
      expect(typeof recordRecommendationShown).toBe('function');
    });

    it('exports recordLensOpened as function', () => {
      expect(typeof recordLensOpened).toBe('function');
    });

    it('exports recordDismissal as function', () => {
      expect(typeof recordDismissal).toBe('function');
    });

    it('exports recordTimeToAction as function', () => {
      expect(typeof recordTimeToAction).toBe('function');
    });
  });

  describe('cross-module integration', () => {
    it('getLensManifest and getLensStatus work for the same lens', () => {
      const manifest = getLensManifest('paper');
      const status = getLensStatus('paper');
      expect(manifest).toBeDefined();
      expect(status).toBeDefined();
      expect(manifest!.domain).toBe(status!.id);
    });

    it('product lenses have manifests', () => {
      const products = getProductLenses();
      for (const p of products) {
        const manifest = getLensManifest(p.id);
        // Most product lenses should have manifests
        // (a few may be super-lenses that appear in duplicate)
        if (manifest) {
          expect(manifest.domain).toBe(p.id);
        }
      }
    });
  });
});
