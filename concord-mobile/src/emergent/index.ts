// Concord Mobile — Emergent Intelligence barrel export

export {
  detectTemporalBurst,
  detectGeoClusters,
  computePatternConfidence,
  detectPatterns,
} from './pattern-detector';
export type { EmergentPattern, TemporalBurst, GeoCluster, PatternKind } from './pattern-detector';

export {
  proposeConsensus,
  processVote,
  checkQuorum,
  expireProposals,
} from './swarm-consensus';
export type { ConsensusProposal, QuorumResult, VoteRecord, ProposalStatus } from './swarm-consensus';

export {
  buildCollectiveSnapshot,
  computeDiversityScore,
  identifyKnowledgeGaps,
  prioritizeSync,
} from './collective-memory';
export type {
  CollectiveSnapshot,
  KnowledgeGap,
  GapKind,
  TagFrequency,
  TypeFrequency,
  GeoCoverage,
  TemporalCoverage,
} from './collective-memory';
