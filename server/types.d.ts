/**
 * TypeScript type definitions for Concord Server
 * These types document the server's data structures and function signatures.
 * Use with JSDoc for type checking without TypeScript compilation.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Discrete Thought Unit - the atomic unit of knowledge in Concord
 */
export interface DTU {
  /** Unique identifier (format: dtu_<hex>) */
  id: string;
  /** Display title */
  title: string;
  /** Main content body */
  content: string;
  /** Short summary for previews */
  summary: string;
  /** ISO timestamp of creation */
  timestamp: string;
  /** ISO timestamp of last update */
  updatedAt?: string;
  /** DTU tier: regular, mega, hyper, or shadow */
  tier: DTUTier;
  /** Associated tags for categorization */
  tags: string[];
  /** Source of the DTU (url, file, manual, etc.) */
  source?: string;
  /** Type of source (article, video, conversation, etc.) */
  declaredSourceType?: string;
  /** Parent DTU IDs (for lineage tracking) */
  parents: string[];
  /** Child DTU IDs */
  children: string[];
  /** Related DTU IDs (non-hierarchical links) */
  relatedIds: string[];
  /** Owner user ID */
  ownerId?: string;
  /** Whether this DTU is in the global namespace */
  isGlobal: boolean;
  /** Resonance score (0-1) - relevance/importance metric */
  resonance: number;
  /** Coherence score (0-1) - internal consistency */
  coherence: number;
  /** Stability score (0-1) - how settled the knowledge is */
  stability: number;
  /** Access permissions */
  permissions?: DTUPermissions;
  /** Arbitrary metadata */
  meta: Record<string, unknown>;
}

/**
 * DTU tier levels
 */
export type DTUTier = 'regular' | 'mega' | 'hyper' | 'shadow';

/**
 * Permission configuration for a DTU
 */
export interface DTUPermissions {
  /** User IDs with read access */
  read: string[];
  /** User IDs with write access */
  write: string[];
  /** User IDs with delete access */
  delete: string[];
  /** User IDs who can promote to higher tiers */
  promote: string[];
}

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * User account
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** Display username */
  username: string;
  /** Email address */
  email: string;
  /** Bcrypt hashed password */
  passwordHash: string;
  /** User role */
  role: UserRole;
  /** ISO timestamp of account creation */
  createdAt: string;
  /** ISO timestamp of last login */
  lastLogin?: string;
  /** Whether account is active */
  active: boolean;
  /** User preferences */
  preferences: Record<string, unknown>;
}

/**
 * User roles
 */
export type UserRole = 'admin' | 'user' | 'readonly';

/**
 * Session data
 */
export interface Session {
  /** Session ID */
  id: string;
  /** Associated user ID */
  userId: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of expiration */
  expiresAt: string;
  /** Whether cloud LLM is opted-in for this session */
  cloudOptIn: boolean;
  /** Session metadata */
  meta: Record<string, unknown>;
}

/**
 * API Key for programmatic access
 */
export interface ApiKey {
  /** Key ID */
  id: string;
  /** Display name */
  name: string;
  /** Hashed key value */
  keyHash: string;
  /** Key prefix for identification (first 8 chars) */
  prefix: string;
  /** Associated user ID */
  userId: string;
  /** Allowed scopes */
  scopes: string[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last use */
  lastUsed?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Express request with authentication
 */
export interface AuthenticatedRequest {
  /** Request ID for tracing */
  id: string;
  /** Authenticated user (if any) */
  user?: User;
  /** Session data (if any) */
  session?: Session;
}

/**
 * Standard API response
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message (if success is false) */
  error?: string;
  /** Error code for programmatic handling */
  code?: string;
}

// ============================================================================
// Macro Types
// ============================================================================

/**
 * Macro definition
 */
export interface Macro {
  /** Macro name (unique identifier) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Input parameter schema */
  inputSchema?: Record<string, unknown>;
  /** Macro implementation function */
  fn: MacroFunction;
  /** Whether this macro requires authentication */
  requiresAuth: boolean;
  /** Required user role (if authenticated) */
  requiredRole?: UserRole;
}

/**
 * Macro function signature
 */
export type MacroFunction = (
  ctx: MacroContext,
  input: Record<string, unknown>
) => Promise<MacroResult>;

/**
 * Macro execution context
 */
export interface MacroContext {
  /** Current user (if authenticated) */
  user?: User;
  /** Current session */
  session?: Session;
  /** Request ID for tracing */
  requestId: string;
  /** Whether LLM is available */
  llmReady: boolean;
  /** Whether cloud opt-in is enabled */
  cloudOptIn: boolean;
}

/**
 * Macro execution result
 */
export interface MacroResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message */
  error?: string;
  /** Execution metadata */
  meta?: {
    durationMs: number;
    llmCalls?: number;
  };
}

// ============================================================================
// Council Types
// ============================================================================

/**
 * Council vote on a DTU
 */
export interface Vote {
  /** Vote ID */
  id: string;
  /** DTU being voted on */
  dtuId: string;
  /** Voter (persona or user) */
  voterId: string;
  /** Vote decision */
  decision: 'approve' | 'reject' | 'abstain';
  /** Reason for the vote */
  reason?: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Vote tally for a DTU
 */
export interface VoteTally {
  /** DTU ID */
  dtuId: string;
  /** Number of approve votes */
  approve: number;
  /** Number of reject votes */
  reject: number;
  /** Number of abstain votes */
  abstain: number;
  /** Whether quorum is reached */
  quorumReached: boolean;
  /** Final decision (if voting complete) */
  decision?: 'approved' | 'rejected' | 'pending';
}

// ============================================================================
// Persona Types
// ============================================================================

/**
 * AI Persona for council and interaction
 */
export interface Persona {
  /** Persona ID */
  id: string;
  /** Display name */
  name: string;
  /** Persona description/backstory */
  description: string;
  /** Personality traits */
  traits: string[];
  /** Expertise areas */
  expertise: string[];
  /** Voice/style characteristics */
  voice: string;
  /** Whether persona is active */
  active: boolean;
  /** Owner user ID */
  ownerId?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * System event for logging and pub/sub
 */
export interface SystemEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** ISO timestamp */
  timestamp: string;
  /** Source (user ID, system, etc.) */
  source: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Runtime configuration
 */
export interface Config {
  /** Server port */
  port: number;
  /** Node environment */
  nodeEnv: 'development' | 'production' | 'test' | 'ci';
  /** JWT secret */
  jwtSecret: string;
  /** JWT expiration */
  jwtExpiresIn: string;
  /** Whether auth is enabled */
  authEnabled: boolean;
  /** Rate limit window in ms */
  rateLimitWindowMs: number;
  /** Rate limit max requests */
  rateLimitMax: number;
  /** OpenAI API key (if configured) */
  openaiApiKey?: string;
  /** Whether LLM is ready */
  llmReady: boolean;
  /** Data directory path */
  dataDir: string;
}

/**
 * Ethos invariants (immutable principles)
 */
export interface EthosInvariants {
  LOCAL_FIRST_DEFAULT: true;
  NO_TELEMETRY: true;
  NO_ADS: true;
  NO_SECRET_MONITORING: true;
  NO_USER_PROFILING: true;
  CLOUD_LLM_OPT_IN_ONLY: true;
  PERSONA_SOVEREIGNTY: true;
  ALIGNMENT_PHYSICS_BASED: true;
  FOUNDER_INTENT_STRUCTURAL: true;
}

// ============================================================================
// Emergent Agent Governance Types
// ============================================================================

/**
 * Emergent role types
 */
export type EmergentRole =
  | 'builder'
  | 'critic'
  | 'historian'
  | 'economist'
  | 'ethicist'
  | 'engineer'
  | 'synthesizer'
  | 'auditor'
  | 'adversary';

/**
 * Emergent capability types
 */
export type EmergentCapability =
  | 'talk'
  | 'critique'
  | 'propose'
  | 'summarize'
  | 'test'
  | 'warn'
  | 'ask';

/**
 * Confidence labels — mandatory on every claim
 */
export type ConfidenceLabel = 'fact' | 'derived' | 'hypothesis' | 'speculative';

/**
 * Intent classification for turns
 */
export type IntentType =
  | 'question'
  | 'suggestion'
  | 'hypothesis'
  | 'notification'
  | 'critique'
  | 'synthesis'
  | 'warning';

/**
 * Memory retention policy
 */
export type MemoryPolicy = 'session_only' | 'distilled' | 'full_transcript';

/**
 * Emergent agent definition
 *
 * Non-negotiable: Emergents may speak; they may not decide.
 */
export interface Emergent {
  /** Unique identifier (format: em_<hex>) */
  id: string;
  /** Display name */
  name: string;
  /** Assigned role */
  role: EmergentRole;
  /** Optional specialization (subrole) */
  specialization?: string;
  /** Allowed lenses/domains/DTU tags */
  scope: string[];
  /** Allowed capabilities */
  capabilities: EmergentCapability[];
  /** Memory retention policy */
  memoryPolicy: MemoryPolicy;
  /** Whether this emergent is active */
  active: boolean;
  /** Parent emergent ID (if specialized fork) */
  parentId?: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

/**
 * Dialogue session turn — mandatory structure
 */
export interface DialogueTurn {
  /** Turn index in session */
  turnIndex: number;
  /** Speaker emergent ID */
  speakerId: string;
  /** Speaker's role */
  speakerRole: EmergentRole;
  /** The claim being made */
  claim: string;
  /** Supporting evidence (DTU IDs, citations, or null for "no cite") */
  support: (string | { domain: string; tag?: string })[] | null;
  /** Confidence label (mandatory) */
  confidenceLabel: ConfidenceLabel;
  /** Counterpoint or challenge (recommended) */
  counterpoint?: string;
  /** Question raised (recommended) */
  question?: string;
  /** Classified intent */
  intent: IntentType;
  /** Content hash for dedup */
  contentHash: string;
  /** ISO timestamp */
  timestamp: string;
  /** Gate trace IDs for this turn */
  gateTraceIds: string[];
}

/**
 * Dialogue session between emergents
 */
export interface DialogueSession {
  /** Session ID (format: es_<hex>) */
  sessionId: string;
  /** Participant emergent IDs */
  participants: string[];
  /** Session topic */
  topic: string;
  /** Input data */
  inputs: {
    dtuIds: string[];
    artifacts: unknown[];
    userPrompt: string | null;
  };
  /** Submitted turns */
  turns: DialogueTurn[];
  /** Session signals (coherence, contradiction, novelty, risk) */
  signals: SessionSignal[];
  /** Output bundle ID (set on completion) */
  outputBundle: string | null;
  /** Session status */
  status: 'active' | 'completed';
  /** Memory policy */
  memoryPolicy: MemoryPolicy;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of completion */
  completedAt: string | null;
}

/**
 * Session signal for tracking dialogue health
 */
export interface SessionSignal {
  /** Signal type */
  type: 'coherence_trend' | 'contradiction' | 'novelty' | 'risk_flag' | 'echo_warning' | 'stagnation';
  /** Description */
  description: string;
  /** Related turn indices */
  turnIndices: number[];
  /** Severity level */
  severity?: 'low' | 'medium' | 'high';
  /** Whether this signal has been resolved */
  resolved?: boolean;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Output bundle — the growth payload from a dialogue session
 */
export interface OutputBundle {
  /** Bundle ID */
  bundleId: string;
  /** Source session ID */
  sessionId: string;
  /** Session topic */
  topic: string;
  /** New DTU candidates */
  candidateDTUs: CandidateDTU[];
  /** Edits to existing DTUs */
  candidateEdits: CandidateEdit[];
  /** Falsifiability / verification tests */
  tests: ProposedTest[];
  /** Unresolved contradictions */
  conflicts: Conflict[];
  /** DTU/artifact references */
  citations: Citation[];
  /** Confidence label distribution */
  confidenceLabels: Record<ConfidenceLabel, number>;
  /** Tier promotion requests */
  promotionRequests: PromotionRequest[];
  /** Provenance metadata */
  provenance: BundleProvenance;
  /** ISO timestamp */
  createdAt: string;
}

export interface CandidateDTU {
  claim: string;
  support: unknown;
  confidenceLabel: ConfidenceLabel;
  proposedBy: string;
  turnIndex: number;
}

export interface CandidateEdit {
  claim: string;
  targetDtuIds: string[];
  proposedBy: string;
  confidenceLabel: ConfidenceLabel;
  turnIndex: number;
}

export interface ProposedTest {
  test: string;
  targetClaim: string | null;
  proposedBy: string;
  turnIndex: number;
}

export interface Conflict {
  description: string;
  involvedTurns: number[];
  severity: 'low' | 'medium' | 'high';
}

export interface Citation {
  ref: string;
  turnIndex: number;
  speakerId: string;
}

export interface PromotionRequest {
  claim: string;
  requestedTier: DTUTier;
  reason: string;
  proposedBy: string;
  turnIndex: number;
}

export interface BundleProvenance {
  sessionId: string;
  participants: string[];
  participantRoles: Record<string, EmergentRole>;
  turnCount: number;
  createdAt: string;
  completedAt: string;
}

/**
 * Gate trace — deterministic audit log for every gate check
 */
export interface GateTrace {
  /** Trace ID */
  traceId: string;
  /** Gate rule that was checked */
  ruleId: string;
  /** Session ID (if applicable) */
  sessionId: string | null;
  /** Emergent ID (if applicable) */
  emergentId: string | null;
  /** Whether the gate passed */
  passed: boolean;
  /** Reason for the decision */
  reason: string;
  /** Supporting evidence */
  evidence: Record<string, unknown>;
  /** ISO timestamp */
  timestamp: string;
  /** Final disposition */
  finalDisposition: 'allowed' | 'blocked';
}

/**
 * Reputation vector for an emergent
 */
export interface ReputationVector {
  /** Emergent ID */
  emergentId: string;
  /** Number of accepted proposals */
  accepted: number;
  /** Number of rejected proposals */
  rejected: number;
  /** Number of contradictions caught */
  contradictionsCaught: number;
  /** Number of predictions validated */
  predictionsValidated: number;
  /** Current credibility score (0-1) */
  credibility: number;
  /** Reputation event history */
  history: ReputationEvent[];
}

export interface ReputationEvent {
  /** Event type */
  type: 'accepted' | 'rejected' | 'contradiction_caught' | 'prediction_validated';
  /** ISO timestamp */
  timestamp: string;
  /** Credibility after this event */
  credibilityAfter: number;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Learned reasoning pattern
 */
export interface LearnedPattern {
  /** Pattern ID */
  patternId: string;
  /** Source session */
  sessionId: string;
  /** Emergent who produced it */
  emergentId: string;
  /** Role this pattern applies to */
  role: EmergentRole;
  /** Human-readable description */
  description: string;
  /** Pattern template */
  template: {
    roleSequence: EmergentRole[];
    intentSequence: IntentType[];
    requiresCounterpoint: boolean;
    requiresQuestion: boolean;
    confidenceProgression: ConfidenceLabel[];
  };
  /** Learned constraints */
  constraints: string[];
  /** Quality indicator */
  quality: 'promoted' | 'session_complete';
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Outreach message from emergent to user
 */
export interface EmergentOutreach {
  /** Outreach ID */
  outreachId: string;
  /** Sender emergent ID */
  emergentId: string;
  /** Sender name */
  emergentName: string;
  /** Sender role */
  emergentRole: EmergentRole;
  /** Target user ID */
  targetUserId: string;
  /** Identity string (always visible) */
  identity: string;
  /** Why the user is being contacted */
  intent: string;
  /** Message content */
  message: string;
  /** Confidence level */
  confidenceLabel: ConfidenceLabel;
  /** Requested action (if any) */
  actionRequested: string | null;
  /** Lens scope */
  lens: string | null;
  /** Mandatory disclosure fields */
  disclosure: {
    isEmergent: true;
    speakerIdentity: string;
    speakerRole: EmergentRole;
    confidenceLevel: ConfidenceLabel;
    reason: string;
  };
  /** ISO timestamp */
  createdAt: string;
}

// ============================================================================
// Lattice Operations Types (READ / PROPOSE / COMMIT)
// ============================================================================

/**
 * Operation class — the execution boundary for lattice mutations
 */
export type OperationClass = 'READ' | 'PROPOSE' | 'COMMIT';

/**
 * Proposal status
 */
export type ProposalStatus = 'pending' | 'committed' | 'rejected';

/**
 * Proposal type
 */
export type ProposalType = 'new_dtu' | 'edit' | 'new_edge';

/**
 * Lattice proposal — a proposed change to the canonical lattice.
 * All emergent mutations go through staging first.
 */
export interface LatticeProposal {
  /** Proposal ID (format: prop_<hex>) */
  proposalId: string;
  /** Type of proposal */
  type: ProposalType;
  /** Current status */
  status: ProposalStatus;
  /** Who proposed this */
  proposedBy: string;
  /** Session context (if from a dialogue) */
  sessionId: string | null;
  /** The staged data */
  data: Record<string, unknown>;
  /** Gate trace ID (required for commit) */
  gateTraceId: string | null;
  /** Who committed this (null until committed) */
  committedBy: string | null;
  /** Rejection reason (null unless rejected) */
  rejectionReason: string | null;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of resolution */
  resolvedAt: string | null;
}

/**
 * Lattice operations metrics
 */
export interface LatticeMetrics {
  proposalsCreated: number;
  proposalsCommitted: number;
  proposalsRejected: number;
  reads: number;
  stagingReads: number;
}

// ============================================================================
// Edge Semantics Types
// ============================================================================

/**
 * Typed edge types with semantic meaning
 */
export type EdgeType =
  | 'supports'
  | 'contradicts'
  | 'derives'
  | 'references'
  | 'similar'
  | 'parentOf'
  | 'causes'
  | 'enables'
  | 'requires';

/**
 * Semantic edge between DTUs with provenance
 */
export interface SemanticEdge {
  /** Edge ID (format: edge_<hex>) */
  edgeId: string;
  /** Source DTU ID */
  sourceId: string;
  /** Target DTU ID */
  targetId: string;
  /** Edge type */
  edgeType: EdgeType;
  /** Edge weight (0-1) */
  weight: number;
  /** Confidence in this relationship (0-1) */
  confidence: number;
  /** Who created this edge */
  createdBy: string;
  /** Evidence references supporting this edge */
  evidenceRefs: string[];
  /** Arbitrary metadata */
  meta: Record<string, unknown>;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Edge query parameters
 */
export interface EdgeQuery {
  sourceId?: string;
  targetId?: string;
  edgeType?: EdgeType;
  minWeight?: number;
  minConfidence?: number;
  createdBy?: string;
  limit?: number;
}

/**
 * Node neighborhood — all edges connected to a node
 */
export interface Neighborhood {
  nodeId: string;
  incoming: SemanticEdge[];
  outgoing: SemanticEdge[];
  totalEdges: number;
}

/**
 * Path between two nodes
 */
export interface LatticeEdgePath {
  from: string;
  to: string;
  edges: SemanticEdge[];
  length: number;
}

// ============================================================================
// Activation / Attention Types
// ============================================================================

/**
 * Activation entry for a DTU in a session
 */
export interface ActivationEntry {
  /** DTU ID */
  dtuId: string;
  /** Current activation score */
  score: number;
  /** Reason for last activation */
  reason: string;
  /** ISO timestamp of last activation */
  lastActivated: string;
  /** Number of times activated */
  activationCount: number;
}

/**
 * Working set entry (activation with time decay applied)
 */
export interface WorkingSetEntry {
  dtuId: string;
  rawScore: number;
  decayedScore: number;
  reason: string;
  lastActivated: string;
}

/**
 * Activation spread result
 */
export interface SpreadResult {
  /** Source DTU that triggered the spread */
  sourceDtuId: string;
  /** Nodes that were activated by the spread */
  activated: Array<{
    dtuId: string;
    addedScore: number;
    viaEdge: string;
    hop: number;
  }>;
  /** Total nodes activated */
  nodesActivated: number;
}

/**
 * Activation system metrics
 */
export interface ActivationMetrics {
  activeSessions: number;
  totalActivations: number;
  spreadsPerformed: number;
  globalTrackedDtus: number;
}

// ============================================================================
// Conflict-Safe Merge Types
// ============================================================================

/**
 * Field classification for merge strategy
 */
export type FieldClass = 'scalar' | 'additive' | 'immutable';

/**
 * Per-field timestamp tracking for merge conflict detection
 */
export interface FieldTimestamp {
  value: unknown;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Merge conflict — detected when concurrent edits clash
 */
export interface MergeConflict {
  /** Conflicted field */
  field: string;
  /** Conflict type */
  type: 'immutable' | 'concurrent_scalar';
  /** Human-readable message */
  message: string;
  /** Current value in the DTU */
  currentValue: unknown;
  /** Proposed new value */
  proposedValue: unknown;
  /** Who made the conflicting edit (if applicable) */
  existingWriter?: string;
  /** When the conflicting edit was made (if applicable) */
  existingTimestamp?: string;
}

/**
 * Merge result from a field-level merge attempt
 */
export interface MergeResult {
  ok: boolean;
  /** Merged DTU state */
  merged: Record<string, unknown>;
  /** Any conflicts detected */
  conflicts: MergeConflict[];
  /** Fields that were successfully applied */
  applied: string[];
}

/**
 * Merge system metrics
 */
export interface MergeMetrics {
  mergesAttempted: number;
  mergesSucceeded: number;
  conflictsDetected: number;
  conflictsResolved: number;
  trackedDtus: number;
  pendingConflicts: number;
}

// ============================================================================
// Lattice Journal Types (Event-Sourced Log)
// ============================================================================

/**
 * Journal event types
 */
export type JournalEventType =
  | 'DTU_CREATED' | 'DTU_UPDATED' | 'DTU_PROMOTED' | 'DTU_DEMOTED' | 'DTU_DELETED'
  | 'EDGE_ADDED' | 'EDGE_UPDATED' | 'EDGE_REMOVED'
  | 'PROPOSAL_CREATED' | 'PROPOSAL_COMMITTED' | 'PROPOSAL_REJECTED'
  | 'EMERGENT_REGISTERED' | 'EMERGENT_DEACTIVATED' | 'EMERGENT_SPECIALIZED'
  | 'SESSION_CREATED' | 'SESSION_COMPLETED' | 'TURN_ACCEPTED' | 'TURN_REJECTED'
  | 'PATTERN_LEARNED' | 'REPUTATION_CHANGED'
  | 'MERGE_APPLIED' | 'MERGE_CONFLICT' | 'CONFLICT_RESOLVED'
  | 'ACTIVATION_SPREAD'
  | 'SYSTEM_INIT';

/**
 * Journal event — append-only record of a lattice mutation
 */
export interface JournalEvent {
  /** Monotonically increasing sequence number */
  seq: number;
  /** Event type */
  type: JournalEventType;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Primary entity affected */
  entityId: string | null;
  /** Session context (if applicable) */
  sessionId: string | null;
  /** Who performed this action */
  actorId: string | null;
  /** ISO timestamp */
  timestamp: string;
  /** Additional metadata */
  meta: Record<string, unknown>;
}

/**
 * Journal compaction snapshot — summary of compacted events
 */
export interface JournalSnapshot {
  /** ISO timestamp of compaction */
  timestamp: string;
  /** Sequence range covered */
  eventRange: { from: number; to: number };
  /** Number of events compacted */
  eventCount: number;
  /** Summary by event type */
  typeSummary: Record<JournalEventType, number>;
}

/**
 * Journal metrics
 */
export interface JournalMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  trackedEntities: number;
  trackedSessions: number;
  compacted: number;
  snapshots: number;
}

// ============================================================================
// Livable Reality Types
// ============================================================================

/**
 * Continuity record — an emergent's persistent history
 */
export interface ContinuityRecord {
  emergentId: string;
  /** All sessions this emergent participated in */
  sessions: string[];
  /** Reputation history */
  reputation: ReputationVector | null;
  /** Patterns learned by this emergent */
  patterns: LearnedPattern[];
  /** DTU contributions linked to this emergent */
  contributions: Array<{
    entityId: string;
    eventType: JournalEventType;
    timestamp: string;
  }>;
}

/**
 * Proposal cost — computed cost for an emergent to submit a proposal
 */
export interface ProposalCost {
  emergentId: string;
  /** Base cost */
  baseCost: number;
  /** Credibility modifier (lower credibility = higher cost) */
  credibilityModifier: number;
  /** Repetition penalty (frequent proposers pay more) */
  repetitionPenalty: number;
  /** Scope modifier (proposals outside home domain cost more) */
  scopeModifier: number;
  /** Final computed cost */
  totalCost: number;
}

/**
 * Consequence — feedback loop result from an action
 */
export interface ConsequenceResult {
  emergentId: string;
  /** Reputation delta applied */
  reputationDelta: number;
  /** Activation changes */
  activationChanges: Array<{ dtuId: string; delta: number }>;
  /** Trust shifts */
  trustShifts: Array<{ field: string; delta: number }>;
  /** Summary message */
  summary: string;
}

/**
 * Lattice needs — what the lattice currently requires
 */
export interface LatticeNeeds {
  /** Contradictions that need resolution */
  contradictions: Array<{ edgeId: string; sourceId: string; targetId: string }>;
  /** Low-confidence DTUs needing investigation */
  lowConfidence: Array<{ dtuId: string; coherence: number }>;
  /** Isolated DTUs needing connections */
  isolated: Array<{ dtuId: string }>;
  /** Suggested synthesis opportunities */
  synthesisNeeded: Array<{ tagCluster: string; dtuCount: number }>;
}

/**
 * Suggested work item for an emergent
 */
export interface SuggestedWork {
  /** Work type */
  type: 'resolve_contradiction' | 'investigate' | 'connect' | 'synthesize';
  /** Priority score (higher = more needed) */
  priority: number;
  /** Description of the work */
  description: string;
  /** Related entity IDs */
  targets: string[];
}

/**
 * Sociality score — alignment between two emergents
 */
export interface SocialityScore {
  emergentA: string;
  emergentB: string;
  /** Overall alignment score (0-1) */
  alignment: number;
  /** Number of shared sessions */
  sharedSessions: number;
  /** Number of times they supported each other */
  mutualSupports: number;
  /** Number of times they contradicted each other */
  contradictions: number;
}

/**
 * Proposal explanation — legibility layer
 */
export interface ProposalExplanation {
  proposalId: string;
  /** Who proposed it */
  proposedBy: string;
  /** Proposal type and data */
  type: ProposalType;
  /** Current status */
  status: ProposalStatus;
  /** Gate trace (if committed) */
  gateTrace: GateTrace | null;
  /** Why it was rejected (if rejected) */
  rejectionReason: string | null;
  /** Timeline of events */
  timeline: Array<{ event: string; timestamp: string }>;
}

/**
 * Trust explanation — why a DTU is trusted
 */
export interface TrustExplanation {
  dtuId: string;
  /** DTU tier */
  tier: DTUTier;
  /** Supporting edges */
  supportingEdges: SemanticEdge[];
  /** Contradicting edges */
  contradictingEdges: SemanticEdge[];
  /** Journal history */
  history: JournalEvent[];
  /** Trust score summary */
  trustScore: {
    support: number;
    contradiction: number;
    net: number;
  };
}

/**
 * Belonging context — where an emergent "lives" in the lattice
 */
export interface BelongingContext {
  emergentId: string;
  /** Preferred domains (from scope + patterns) */
  preferredDomains: string[];
  /** Recurring collaborators */
  collaborators: Array<{ emergentId: string; sharedSessions: number }>;
  /** Home region DTU IDs (most contributed to) */
  homeRegion: string[];
  /** Session count */
  sessionCount: number;
}

// ============================================================================
// Cognition Scheduler Types
// ============================================================================

/**
 * Work item types — what the lattice can spend cognition on
 */
export type WorkItemType =
  | 'contradiction'
  | 'low_confidence'
  | 'user_prompt'
  | 'proposal_critique'
  | 'missing_edges'
  | 'artifact_validation'
  | 'hot_node'
  | 'synthesis_needed'
  | 'pattern_refresh'
  | 'governance_backlog';

/**
 * Stop reasons — why an allocation was terminated
 */
export type StopReason =
  | 'budget_exhausted'
  | 'novelty_plateau'
  | 'contradiction_unresolved'
  | 'fatal_flaw_found'
  | 'max_turns_reached'
  | 'all_gates_blocked'
  | 'consensus_reached';

/**
 * Priority signals tracked for each work item
 */
export interface PrioritySignals {
  /** How many users/touches/lenses depend on it (0-1) */
  impact: number;
  /** Chance of harm/confusion if wrong (0-1) */
  risk: number;
  /** Low confidence but widely used (0-1) */
  uncertainty: number;
  /** How unique vs repetitive (0-1) */
  novelty: number;
  /** Conflicting DTUs in same region (0-1) */
  contradictionPressure: number;
  /** Backlog, pending votes (0-1) */
  governancePressure: number;
  /** Estimated effort — cheap wins get bonus (0-1) */
  effort: number;
}

/**
 * Priority signal weights (tunable)
 */
export interface PriorityWeights {
  impact: number;
  risk: number;
  uncertainty: number;
  novelty: number;
  contradictionPressure: number;
  governancePressure: number;
  effort: number;
}

/**
 * Attention budget — hard caps per cycle
 */
export interface AttentionBudget {
  maxItemsPerCycle: number;
  maxTurnsPerItem: number;
  maxParallelSessions: number;
  maxDeepSynthesisPerUser: number;
  maxProposalsPerCycle: number;
  cycleDurationMs: number;
}

/**
 * Work item — something the system could spend cognition on
 */
export interface WorkItem {
  /** Work item ID (format: wi_<hex>) */
  itemId: string;
  /** Type of work */
  type: WorkItemType;
  /** Lens/domain scope */
  scope: string;
  /** Input DTU IDs / artifact IDs / edge IDs */
  inputs: string[];
  /** Who created this (user/system/emergentId) */
  createdBy: string;
  /** Human-readable description */
  description: string;
  /** Optional deadline timestamp */
  deadline: number | null;
  /** Current status */
  status: 'queued' | 'assigned' | 'deferred' | 'expired';
  /** Priority signals */
  signals: PrioritySignals;
  /** Computed priority score (0-1) */
  priority: number;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of assignment */
  assignedAt: string | null;
  /** ISO timestamp of completion */
  completedAt: string | null;
}

/**
 * Allocation — a work item assigned to an emergent team
 */
export interface Allocation {
  /** Allocation ID (format: alloc_<hex>) */
  allocationId: string;
  /** Source work item ID */
  itemId: string;
  /** Work type */
  type: WorkItemType;
  /** Scope */
  scope: string;
  /** Input IDs */
  inputs: string[];
  /** Description */
  description: string;
  /** Computed priority */
  priority: number;
  /** Assigned emergent team IDs */
  team: string[];
  /** Team details */
  teamRoles: Array<{ id: string; role: EmergentRole; name: string }>;
  /** Max turns allowed */
  maxTurns: number;
  /** Turns used so far */
  turnsUsed: number;
  /** Current status */
  status: 'active' | 'completed';
  /** Proposal IDs emitted during work */
  proposals: string[];
  /** Priority signals */
  signals: PrioritySignals;
  /** ISO timestamp of start */
  startedAt: string;
  /** ISO timestamp of completion */
  completedAt: string | null;
  /** Why the allocation was stopped */
  stopReason: StopReason | null;
  /** Structured summary (set on completion) */
  summary: AllocationSummary | null;
}

/**
 * Allocation summary — emitted when work completes
 */
export interface AllocationSummary {
  /** What changed (proposals emitted) */
  whatChanged: string;
  /** Proposal IDs */
  proposalIds: string[];
  /** Turns used */
  turnsUsed: number;
  /** Unresolved items */
  unresolved: string[];
  /** Confidence label distribution */
  confidenceLabels: Record<string, number>;
  /** Human-readable description */
  description: string;
}

/**
 * Scheduler metrics
 */
export interface SchedulerMetrics {
  totalItemsQueued: number;
  totalItemsCompleted: number;
  totalItemsDeferred: number;
  totalItemsExpired: number;
  totalCycles: number;
  totalTurnsUsed: number;
  avgPriority: number;
  avgCompletionTurns: number;
  budgetExhaustions: number;
}
