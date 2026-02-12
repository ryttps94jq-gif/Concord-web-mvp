// Atlas Global — TypeScript Types for Frontend

// ── Domain Types ─────────────────────────────────────────────────────────

export type DomainType =
  | 'formal.math' | 'formal.logic'
  | 'empirical.physics' | 'empirical.biology' | 'empirical.medicine'
  | 'historical.world' | 'historical.economic'
  | 'interpretive.philosophy' | 'interpretive.linguistics'
  | 'model.economics' | 'model.policy'
  | 'arts.visual' | 'arts.music' | 'arts.literature'
  | 'design.architecture' | 'design.product'
  | 'general.note';

export type EpistemicClass =
  | 'FORMAL' | 'EMPIRICAL' | 'HISTORICAL'
  | 'INTERPRETIVE' | 'MODEL' | 'ARTS' | 'DESIGN' | 'GENERAL';

export type AtlasStatus = 'DRAFT' | 'PROPOSED' | 'VERIFIED' | 'DISPUTED' | 'DEPRECATED' | 'QUARANTINED';

// ── Lane-specific statuses ──────────────────────────────────────────────
export type LocalStatus = 'LOCAL_DRAFT' | 'LOCAL_PROPOSED' | 'LOCAL_VERIFIED' | 'LOCAL_DISPUTED';
export type MarketStatus = 'LISTING_DRAFT' | 'LISTING_REVIEW' | 'LISTED' | 'LISTING_DISPUTED' | 'DELISTED' | 'QUARANTINED';
export type AtlasScope = 'local' | 'global' | 'marketplace';

export type ClaimType = 'FACT' | 'INTERPRETATION' | 'RECEPTION' | 'PROVENANCE' | 'SPEC' | 'HYPOTHESIS' | 'MODEL_OUTPUT';

export type SourceTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'UNCITED';

export type ContradictionType = 'NUMERIC' | 'DATE' | 'CAUSAL' | 'ATTRIBUTION' | 'DEFINITIONAL' | 'MODEL_ASSUMPTION' | 'INTERPRETATION_CONFLICT' | 'PROVENANCE_CHAIN';

export type ContradictionSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Atlas DTU ────────────────────────────────────────────────────────────

export interface AtlasSource {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
  sourceTier: SourceTier;
  retrievedAt: number;
  quoteAnchors: { start: number; end: number }[];
}

export interface AtlasClaim {
  claimId: string;
  claimType: ClaimType;
  text: string;
  entities: string[];
  timeRange?: { start: string; end: string } | null;
  numeric: { value: number; unit: string; context: string }[];
  sources: AtlasSource[];
  evidenceTier: string;
  confidence: { factual: number; structural: number; overall: number };
  dispute: { isDisputed: boolean; reasons: string[] };
  _needsSources?: boolean;
}

export interface AtlasInterpretation {
  interpId: string;
  school: string;
  text: string;
  supportsClaims: string[];
  sources: AtlasSource[];
  confidence: { structural: number; overall: number };
}

export interface AtlasAssumption {
  assumptionId: string;
  text: string;
  appliesTo: string[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AtlasProvenance {
  provId: string;
  type: string;
  text: string;
  sources: AtlasSource[];
}

export interface AtlasLink {
  targetDtuId: string;
  claimIds: string[];
  strength: number;
  type?: ContradictionType | null;
  severity?: ContradictionSeverity;
  createdAt: string;
  createdBy: string;
}

export interface AtlasAuditEvent {
  ts: number;
  actor: string;
  action: string;
  diff: string;
}

export interface AtlasDTU {
  id: string;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;

  title: string;
  tags: string[];
  domainType: DomainType;
  epistemicClass: EpistemicClass;

  status: AtlasStatus;
  author: {
    userId: string;
    display: string;
    isSystem: boolean;
  };

  claims: AtlasClaim[];
  interpretations: AtlasInterpretation[];
  assumptions: AtlasAssumption[];
  provenance: AtlasProvenance[];

  links: {
    supports: AtlasLink[];
    contradicts: AtlasLink[];
    sameAs: AtlasLink[];
    about: { entityId: string; role: string }[];
  };

  scores: {
    confidence_factual: number;
    credibility_structural: number;
    confidence_overall: number;
  };

  lineage: {
    origin: 'HUMAN' | 'AUTOGEN' | 'IMPORT';
    generationDepth: number;
    parents: { dtuId: string; weight: number }[];
    runId: string | null;
    hash: string;
  };

  audit: {
    events: AtlasAuditEvent[];
  };

  proofVerified?: boolean;
  replicationCount?: number;
}

// ── Score Explanation ────────────────────────────────────────────────────

export interface ScoreComponent {
  name: string;
  value: number;
  weight: number;
}

export interface ScoreExplanation {
  confidence_factual: number;
  credibility_structural: number;
  confidence_overall: number;
  factualBreakdown: ScoreComponent[];
  structuralBreakdown: ScoreComponent[];
  whyNotVerified: {
    gate: string;
    required: number;
    actual: number;
    message: string;
  }[];
  canBeProposed: boolean;
  canBeVerified: boolean;
}

// ── Social Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  displayName: string;
  bio: string;
  avatar: string;
  isPublic: boolean;
  specialization: string[];
  website: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    dtuCount: number;
    publicDtuCount: number;
    citationCount: number;
    followerCount: number;
    followingCount: number;
  };
}

export interface FeedItem {
  dtuId: string;
  title: string;
  authorId: string;
  authorName: string;
  tags: string[];
  tier: string;
  createdAt: string;
  citationCount: number;
}

export interface TrendingItem {
  dtuId: string;
  title: string;
  authorId: string;
  authorName: string;
  tags: string[];
  citationCount: number;
  score: number;
  createdAt: string;
}

// ── Collaboration Types ──────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: {
    userId: string;
    role: string;
    joinedAt: string;
  }[];
  visibility: 'private' | 'org' | 'public';
  dtuCount?: number;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  dtuId: string;
  userId: string;
  text: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: Record<string, number>;
  isResolved: boolean;
  replies?: Comment[];
}

export interface RevisionProposal {
  id: string;
  dtuId: string;
  proposerId: string;
  changes: Record<string, unknown>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'APPLIED';
  votes: { userId: string; vote: 'approve' | 'reject'; votedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Analytics Types ──────────────────────────────────────────────────────

export interface PersonalAnalytics {
  userId: string;
  summary: {
    dtuCount: number;
    citationCount: number;
    followerCount: number;
    followingCount: number;
    publicDtuCount: number;
    revenue: number;
    sales: number;
  };
  tierDistribution: Record<string, number>;
  topTags: { tag: string; count: number }[];
  recentDtus: { id: string; title: string; tier: string; createdAt: string }[];
}

export interface EfficiencyDashboard {
  headline: {
    llmCallsSaved: number;
    reuseRate: string;
    tokensEstimatedSaved: number;
    costEstimatedSaved: string;
    timeEstimatedSaved: string;
  };
  comparison: {
    substrateReuseCount: number;
    llmCallCount: number;
    reusePercentage: number;
    cacheHitRate: string;
  };
  byOperation: {
    operation: string;
    saved: number;
    made: number;
    reuseRate: number;
  }[];
}

// ── RBAC Types ───────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer' | 'api_only';

export interface OrgWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  settings: {
    maxMembers: number;
    maxDtus: number;
    dataRegion: string;
    complianceLevel: string;
  };
  memberCount: number;
}

// ── Webhook Types ────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  ownerId: string;
  createdAt: string;
  lastDeliveryAt: string | null;
  consecutiveFailures: number;
}

// ── Status Badge Colors ──────────────────────────────────────────────────

export const ATLAS_STATUS_CONFIG: Record<AtlasStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT:        { label: 'Draft',       color: 'text-gray-400',   bgColor: 'bg-gray-500/10' },
  PROPOSED:     { label: 'Proposed',    color: 'text-blue-400',   bgColor: 'bg-blue-500/10' },
  VERIFIED:     { label: 'Verified',    color: 'text-green-400',  bgColor: 'bg-green-500/10' },
  DISPUTED:     { label: 'Disputed',    color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  DEPRECATED:   { label: 'Deprecated',  color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  QUARANTINED:  { label: 'Quarantined', color: 'text-red-400',    bgColor: 'bg-red-500/10' },
};

export const EPISTEMIC_CLASS_CONFIG: Record<EpistemicClass, { label: string; description: string; color: string }> = {
  FORMAL:       { label: 'Formal',       description: 'Proof/logic-based truth',        color: 'text-purple-400' },
  EMPIRICAL:    { label: 'Empirical',    description: 'Replication/statistics-based',    color: 'text-cyan-400' },
  HISTORICAL:   { label: 'Historical',   description: 'Corroboration-weighted',          color: 'text-amber-400' },
  INTERPRETIVE: { label: 'Interpretive', description: 'Argument/school-of-thought',      color: 'text-rose-400' },
  MODEL:        { label: 'Model',        description: 'Assumption/scenario-based',       color: 'text-indigo-400' },
  ARTS:         { label: 'Arts',         description: 'Provenance + interpretation',     color: 'text-pink-400' },
  DESIGN:       { label: 'Design',       description: 'Specs + process + constraints',   color: 'text-teal-400' },
  GENERAL:      { label: 'General',      description: 'Unclassified / chat-originated',  color: 'text-gray-400' },
};

// ── License Types ───────────────────────────────────────────────────────

export type LicenseType =
  | 'CONCORD_PERSONAL'
  | 'CONCORD_OPEN'
  | 'CONCORD_ATTRIBUTION_OPEN'
  | 'CONCORD_NONCOMMERCIAL'
  | 'CONCORD_MARKET_EXCLUSIVE'
  | 'CUSTOM';

export interface LicenseProfile {
  attribution_required: boolean;
  derivative_allowed: boolean;
  commercial_use_allowed: boolean;
  redistribution_allowed: boolean;
  royalty_required: boolean;
  exclusive?: boolean;
}

export const LICENSE_CONFIG: Record<LicenseType, { label: string; description: string; color: string; icon: string }> = {
  CONCORD_PERSONAL:         { label: 'Personal',         description: 'Local only, no sharing',                color: 'text-gray-400',   icon: 'Lock' },
  CONCORD_OPEN:             { label: 'Open',             description: 'Share freely, no attribution needed',   color: 'text-green-400',  icon: 'Globe' },
  CONCORD_ATTRIBUTION_OPEN: { label: 'Attribution Open', description: 'Share with credit',                     color: 'text-blue-400',   icon: 'Quote' },
  CONCORD_NONCOMMERCIAL:    { label: 'Noncommercial',    description: 'Share with credit, no commercial use',  color: 'text-yellow-400', icon: 'Ban' },
  CONCORD_MARKET_EXCLUSIVE: { label: 'Market Exclusive', description: 'Marketplace only, no redistribution',   color: 'text-purple-400', icon: 'Store' },
  CUSTOM:                   { label: 'Custom',           description: 'Custom license terms',                  color: 'text-orange-400', icon: 'Settings' },
};

// ── Rights Types ────────────────────────────────────────────────────────

export type RightsAction = 'VIEW' | 'CITE' | 'DERIVE' | 'REDISTRIBUTE' | 'COMMERCIAL_USE' | 'LIST_ON_MARKET' | 'TRANSFER';

export type DerivationType = 'EXTENSION' | 'REVISION' | 'TRANSLATION' | 'SYNTHESIS' | 'CRITIQUE';

export interface ArtifactRights {
  content_hash: string;
  evidence_hash: string;
  lineage_hash: string;
  license_type: LicenseType;
  license_profile: LicenseProfile | null;
  origin_lane: AtlasScope;
  stamped_at: string;
  creator_id: string;
}

export interface OriginRecord {
  artifact_id: string;
  content_hash: string;
  creator_id: string;
  created_at: string;
  instance_id: string;
  origin_fingerprint: string;
}

export interface Citation {
  artifact_id: string;
  title: string;
  author: string;
  license: LicenseType;
  content_hash: string;
  created_at: string;
  citation_text: string;
  attribution_required: boolean;
}

export interface RightsCheck {
  allowed: boolean;
  reason: string;
  license_type: LicenseType;
}

// ── Chat Loose Mode Types ───────────────────────────────────────────────

export interface ChatContext {
  id: string;
  title: string;
  claims: { text: string; claimType: ClaimType }[];
  tags: string[];
  sourceScope: AtlasScope;
  scopeLabel: string;
  confidenceBadge: {
    score: number;
    label: string;
    verified: boolean;
    disputed: boolean;
  } | null;
  disputeIndicator: boolean;
  isVerified: boolean;
}

export interface ChatMeta {
  mode: 'chat';
  profile: string;
  validationLevel: 'OFF';
  contradictionGate: 'OFF';
  policy: string;
  query: string;
  resultCount: number;
  ts: number;
}

export interface ChatRetrieveResponse {
  ok: boolean;
  context: ChatContext[];
  total?: number;
  meta: ChatMeta;
}

export interface ChatMetrics {
  ok: boolean;
  queries: number;
  retrievals: number;
  escalations: number;
  savesAsDtu: number;
  publishToGlobal: number;
  listOnMarket: number;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  exchanges: {
    ts: number;
    query: string;
    contextCount: number;
    hasGlobalRefs: boolean;
    hasLocalRefs: boolean;
  }[];
  escalations: {
    ts: number;
    type: string;
    dtuId: string;
    submissionId: string | null;
  }[];
}

// ── Scope Label Config ──────────────────────────────────────────────────

export const SCOPE_LABEL_CONFIG: Record<AtlasScope, { label: string; color: string; bgColor: string }> = {
  local:       { label: 'Local Knowledge',      color: 'text-blue-400',   bgColor: 'bg-blue-500/10' },
  global:      { label: 'Global Atlas',         color: 'text-green-400',  bgColor: 'bg-green-500/10' },
  marketplace: { label: 'Marketplace Listing',  color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
};
