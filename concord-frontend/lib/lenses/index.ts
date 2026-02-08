/**
 * Lens Infrastructure — barrel export.
 *
 * Provides unified access to:
 *   - Lens manifest (runtime contract)
 *   - Lens status taxonomy (viewer/hybrid/product/system/deprecated)
 *   - Lens merge map (which lenses combine and how)
 *   - Productization roadmap (execution order)
 *   - Product Lens Gate (quality requirements)
 */

// Runtime contract
export {
  type LensManifest,
  LENS_MANIFESTS,
  getLensManifest,
  getLensManifests,
  getAllLensDomains,
} from './manifest';

// Status taxonomy (Step 1)
export {
  type LensStatus,
  type LensStatusEntry,
  LENS_STATUS_MAP,
  getLensStatus,
  getLensesByStatus,
  getLensesMergingInto,
  getProductLenses,
  getDeprecatedLenses,
  isPublicLens,
  getLensStatusSummary,
} from './lens-status';

// Merge map (Step 2)
export {
  type MergeSource,
  type MergeGroup,
  LENS_MERGE_GROUPS,
  getMergeGroup,
  getAllMergeSourceIds,
  findMergeGroupForSource,
  getMergeReductionCount,
  POST_MERGE_STANDALONE_LENSES,
  type PostMergeStandaloneLens,
} from './lens-merge-map';

// Productization roadmap (Step 3)
export {
  type PhaseStatus,
  type ProductionArtifact,
  type ProductionEngine,
  type ProductionPipeline,
  type ProductionPhase,
  PRODUCTIZATION_PHASES,
  getProductionPhases,
  getCurrentPhase,
  getPhaseByLens,
  areDependenciesMet,
  getTotalArtifactCount,
  getTotalEngineCount,
} from './productization-roadmap';

// Product Lens Gate (the non-negotiable rule)
export {
  type LensCapability,
  type LensScore,
  type CIViolation,
  LENS_CAPABILITIES,
  GATE_PASS_THRESHOLD,
  MAX_SCORE,
  scoreLens,
  CI_HARD_RULES,
} from './product-lens-gate';
