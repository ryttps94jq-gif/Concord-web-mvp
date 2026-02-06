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
