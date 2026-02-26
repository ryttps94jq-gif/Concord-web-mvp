// learning/index.js
// Learning Verification & Substrate Integrity — Module Entry Point
//
// Re-exports all learning verification functionality for clean imports.

export {
  CLASSIFICATIONS, PUBLIC_CLASSIFICATIONS, INTERNAL_CLASSIFICATIONS,
  classifyDTU, isRepairDTU, isPublicDTU, applyClassification,
  migrateClassifications, computeSubstrateStats,
} from "./classification.js";

export {
  getLearningStore,
  recordQueryMethod, getRetrievalHitRate, getRetrievalTrend,
  recordCitation, recordNegativeSignal, getUtilizationStats,
  recordGeneration, getNoveltyStats, checkNovelty,
  recordResponseQuality, getHelpfulnessScores,
  checkGenerationQuota, recordGenerationUsed, getRecommendedEvolutionRatio,
  checkProbation, runProbationAudit,
  getDomainCoverage,
  runSubstratePruning,
  getLearningDashboard, runDedupAudit,
} from "./metrics.js";
