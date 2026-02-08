/**
 * Lens Status Taxonomy — Step 1 of the Core Lenses Roadmap.
 *
 * Every lens is tagged with its maturity level. This stops entropy:
 * no new lens advances past 'viewer' without passing the Product Lens Gate.
 *
 * Statuses:
 *   - product:  Has primary artifact, persistence, engine, pipeline, DTU exhaust.
 *              These are the world-class lenses Concord bets on.
 *   - hybrid:   Has some persistence or artifacts but missing engine/pipeline.
 *              In transition toward product status.
 *   - viewer:   Displays DTU exhaust or data but produces no primary artifact.
 *              These should merge into a product lens as a mode.
 *   - system:   Infrastructure lens (admin, debug, queue). Not user-facing products.
 *   - deprecated: Scheduled for merge into a product lens. Will be removed.
 *
 * The non-negotiable rule:
 *   A lens must have a primary artifact that survives without DTUs.
 *   DTUs are exhaust — not the product.
 */

export type LensStatus = 'product' | 'hybrid' | 'viewer' | 'system' | 'deprecated';

export interface LensStatusEntry {
  /** Lens ID matching lens-registry.ts */
  id: string;
  /** Current maturity level */
  status: LensStatus;
  /** Which product lens this merges into (null if standalone) */
  mergeTarget: string | null;
  /** Role after merge: 'standalone' | 'mode' | 'engine' | 'absorbed' */
  postMergeRole: 'standalone' | 'mode' | 'engine' | 'absorbed';
  /** Brief rationale for classification */
  rationale: string;
}

/**
 * Complete lens status map. Every lens in the registry must appear here.
 * This is the source of truth for what stays, what merges, and what role each plays.
 */
export const LENS_STATUS_MAP: LensStatusEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  // TIER A — PRODUCT LENSES (world-class targets)
  // These are the 10 lenses Concord pushes to dominance.
  // ═══════════════════════════════════════════════════════════════

  // 1. Research (the crown jewel)
  {
    id: 'paper',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Core of the Research super-lens. Artifacts: ResearchProject, Claim, Hypothesis, Evidence, Experiment, Synthesis.',
  },

  // 2. Reasoning / Argument
  {
    id: 'reasoning',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Argument construction + logical consistency. Artifacts: ArgumentTree, Premise, Inference, Counterexample, Conclusion.',
  },

  // 3. Governance / City / Microbond
  {
    id: 'council',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Governance super-lens. Artifacts: Proposal, Vote, BudgetModel, Project, AuditTrail.',
  },
  {
    id: 'vote',
    status: 'hybrid',
    mergeTarget: 'council',
    postMergeRole: 'mode',
    rationale: 'Voting is a mode within Governance, not a standalone product.',
  },
  {
    id: 'ethics',
    status: 'hybrid',
    mergeTarget: 'council',
    postMergeRole: 'mode',
    rationale: 'Ethics review is a governance mode.',
  },
  {
    id: 'alliance',
    status: 'hybrid',
    mergeTarget: 'council',
    postMergeRole: 'mode',
    rationale: 'Alliance management is a governance mode.',
  },

  // 4. Agents / Council
  {
    id: 'agents',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Enterprise agent OS. Artifacts: Agent, Role, Task, Deliberation, Decision.',
  },
  {
    id: 'ml',
    status: 'hybrid',
    mergeTarget: 'agents',
    postMergeRole: 'engine',
    rationale: 'ML is an engine powering agents, not a standalone product.',
  },

  // 5. Simulation / Forecasting
  {
    id: 'sim',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Simulation super-lens. Artifacts: Scenario, AssumptionSet, SimulationRun, OutcomeDistribution.',
  },

  // 6. Studio (Creative Super-Lens)
  {
    id: 'music',
    status: 'hybrid',
    mergeTarget: 'studio',
    postMergeRole: 'mode',
    rationale: 'Music creation is a Studio mode.',
  },
  {
    id: 'game',
    status: 'hybrid',
    mergeTarget: 'studio',
    postMergeRole: 'mode',
    rationale: 'Game development is a Studio mode.',
  },
  {
    id: 'ar',
    status: 'hybrid',
    mergeTarget: 'studio',
    postMergeRole: 'mode',
    rationale: 'AR experiences are a Studio mode.',
  },
  {
    id: 'fractal',
    status: 'viewer',
    mergeTarget: 'studio',
    postMergeRole: 'mode',
    rationale: 'Fractal visualization is a Studio generative mode.',
  },

  // 7. Legal / Policy
  {
    id: 'law',
    status: 'hybrid',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Legal super-lens. Artifacts: CaseFile, Clause, Draft, PrecedentGraph.',
  },

  // 8. Knowledge Graph / Entity
  {
    id: 'graph',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Knowledge graph super-lens. Artifacts: Entity, Relation, Assertion, Source.',
  },
  {
    id: 'entity',
    status: 'hybrid',
    mergeTarget: 'graph',
    postMergeRole: 'mode',
    rationale: 'Entity browser is a Knowledge Graph mode.',
  },
  {
    id: 'invariant',
    status: 'viewer',
    mergeTarget: 'graph',
    postMergeRole: 'engine',
    rationale: 'Invariant checking is a Knowledge Graph engine.',
  },
  {
    id: 'meta',
    status: 'viewer',
    mergeTarget: 'graph',
    postMergeRole: 'absorbed',
    rationale: 'Meta-information feeds Knowledge Graph.',
  },

  // 9. Collaboration / Whiteboard
  {
    id: 'whiteboard',
    status: 'hybrid',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Collaboration super-lens. Artifacts: Board, Node, Connection, Comment.',
  },
  {
    id: 'collab',
    status: 'hybrid',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Real-time collab is a Collaboration mode.',
  },

  // 10. Database / Structured Knowledge
  {
    id: 'database',
    status: 'hybrid',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Structured knowledge lens. Artifacts: Table, Record, Schema, View.',
  },

  // ═══════════════════════════════════════════════════════════════
  // MERGE GROUP A — Into Research super-lens as modes
  // These are conceptually inseparable from research.
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'hypothesis',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Hypothesis testing is a Research mode.',
  },
  {
    id: 'reflection',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Self-reflection is a Research mode.',
  },
  {
    id: 'inference',
    status: 'deprecated',
    mergeTarget: 'reasoning',
    postMergeRole: 'mode',
    rationale: 'Inference engine is a Reasoning mode.',
  },
  {
    id: 'metacognition',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Metacognition is a Research cognitive-audit mode.',
  },
  {
    id: 'metalearning',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Learning strategy optimization is a Research mode.',
  },
  {
    id: 'commonsense',
    status: 'deprecated',
    mergeTarget: 'graph',
    postMergeRole: 'engine',
    rationale: 'Commonsense knowledge feeds Knowledge Graph.',
  },
  {
    id: 'attention',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Attention management is a Research mode.',
  },
  {
    id: 'experience',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Experience learning is a Research mode.',
  },
  {
    id: 'suffering',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Suffering detection is a Research / ethics mode.',
  },
  {
    id: 'organ',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'absorbed',
    rationale: 'Organization tools absorbed into Research.',
  },
  {
    id: 'affect',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'engine',
    rationale: 'Affect engine feeds Research as emotional-state tracking.',
  },
  {
    id: 'transfer',
    status: 'deprecated',
    mergeTarget: 'paper',
    postMergeRole: 'engine',
    rationale: 'Transfer learning is a Research engine.',
  },
  {
    id: 'grounding',
    status: 'deprecated',
    mergeTarget: 'graph',
    postMergeRole: 'engine',
    rationale: 'Grounding feeds Knowledge Graph entity resolution.',
  },

  // ═══════════════════════════════════════════════════════════════
  // MERGE GROUP B — Into Science + Simulation as engines
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'math',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Math is a Simulation engine, not a standalone viewer.',
  },
  {
    id: 'physics',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Physics simulations are a Simulation engine.',
  },
  {
    id: 'quantum',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Quantum computing explorer is a Simulation engine.',
  },
  {
    id: 'chem',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Chemistry tools are a Simulation engine.',
  },
  {
    id: 'bio',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Biology tools are a Simulation engine.',
  },
  {
    id: 'neuro',
    status: 'deprecated',
    mergeTarget: 'sim',
    postMergeRole: 'engine',
    rationale: 'Neuroscience tools are a Simulation engine.',
  },

  // ═══════════════════════════════════════════════════════════════
  // MERGE GROUP D — Into Collaboration / Discourse
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'forum',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Forum discussions become a Collaboration mode.',
  },
  {
    id: 'thread',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Threaded conversations become a Collaboration mode.',
  },
  {
    id: 'feed',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Feed/timeline becomes a Collaboration mode.',
  },
  {
    id: 'daily',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Daily journal becomes a Collaboration mode.',
  },
  {
    id: 'news',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'News aggregation becomes a Collaboration mode.',
  },
  {
    id: 'docs',
    status: 'deprecated',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Docs viewer becomes a Collaboration mode.',
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE LENSES THAT STAY (not in the 10 but standalone)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'chat',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Primary interaction surface. Artifact: Conversation.',
  },
  {
    id: 'code',
    status: 'product',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Code editing and execution. Artifact: Codebase, Snippet, Project.',
  },

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM LENSES (infrastructure, not user-facing products)
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'admin',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'System administration. Infrastructure.',
  },
  {
    id: 'debug',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Debug console. Infrastructure.',
  },
  {
    id: 'audit',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Audit trail viewer. Infrastructure.',
  },
  {
    id: 'schema',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Schema management. Infrastructure.',
  },
  {
    id: 'integrations',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Third-party integrations. Infrastructure.',
  },
  {
    id: 'queue',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Job queue monitor. Infrastructure.',
  },
  {
    id: 'tick',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'System tick monitor. Infrastructure.',
  },
  {
    id: 'lock',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Sovereignty lock status. Infrastructure.',
  },
  {
    id: 'offline',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Offline data manager. Infrastructure.',
  },
  {
    id: 'export',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Data export utility. Infrastructure.',
  },
  {
    id: 'import',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Data import utility. Infrastructure.',
  },
  {
    id: 'custom',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Custom lens builder. Infrastructure.',
  },

  // ═══════════════════════════════════════════════════════════════
  // REMAINING LENSES — classified for merge or standalone
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'resonance',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'System health dashboard. Infrastructure.',
  },
  {
    id: 'marketplace',
    status: 'hybrid',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Plugin marketplace. Needs productization.',
  },
  {
    id: 'market',
    status: 'hybrid',
    mergeTarget: 'marketplace',
    postMergeRole: 'mode',
    rationale: 'DTU market merges into general Marketplace.',
  },
  {
    id: 'questmarket',
    status: 'hybrid',
    mergeTarget: 'marketplace',
    postMergeRole: 'mode',
    rationale: 'Bounty system merges into Marketplace.',
  },
  {
    id: 'finance',
    status: 'hybrid',
    mergeTarget: 'sim',
    postMergeRole: 'mode',
    rationale: 'Financial tools become a Simulation/Forecasting mode.',
  },
  {
    id: 'anon',
    status: 'viewer',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Anonymous messaging becomes a Collaboration mode.',
  },
  {
    id: 'billing',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Billing is system infrastructure.',
  },
  {
    id: 'crypto',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Cryptography tools are system infrastructure.',
  },
  {
    id: 'lab',
    status: 'hybrid',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Lab experimentation is a Research mode.',
  },
  {
    id: 'voice',
    status: 'viewer',
    mergeTarget: 'studio',
    postMergeRole: 'mode',
    rationale: 'Voice I/O is a Studio mode.',
  },
  {
    id: 'temporal',
    status: 'viewer',
    mergeTarget: 'graph',
    postMergeRole: 'engine',
    rationale: 'Temporal reasoning feeds Knowledge Graph.',
  },
  {
    id: 'fork',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'DTU fork management is system infrastructure.',
  },
  {
    id: 'eco',
    status: 'viewer',
    mergeTarget: 'graph',
    postMergeRole: 'absorbed',
    rationale: 'Ecosystem overview absorbed into Knowledge Graph.',
  },
  {
    id: 'legacy',
    status: 'system',
    mergeTarget: null,
    postMergeRole: 'standalone',
    rationale: 'Legacy data viewer. System infrastructure.',
  },
  {
    id: 'repos',
    status: 'hybrid',
    mergeTarget: 'code',
    postMergeRole: 'mode',
    rationale: 'Repository browser is a Code lens mode.',
  },
  {
    id: 'timeline',
    status: 'viewer',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Timeline is a Collaboration mode.',
  },
  {
    id: 'board',
    status: 'hybrid',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Kanban board is a Collaboration mode.',
  },
  {
    id: 'calendar',
    status: 'hybrid',
    mergeTarget: 'whiteboard',
    postMergeRole: 'mode',
    rationale: 'Calendar is a Collaboration mode.',
  },
  {
    id: 'goals',
    status: 'hybrid',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Goals feed Research planning.',
  },
  {
    id: 'srs',
    status: 'hybrid',
    mergeTarget: 'paper',
    postMergeRole: 'mode',
    rationale: 'Spaced repetition supports Research learning.',
  },
];

// ── Derived helpers ─────────────────────────────────────────────

const _statusMap = new Map(LENS_STATUS_MAP.map(e => [e.id, e]));

/** Get status entry for a lens. */
export function getLensStatus(id: string): LensStatusEntry | undefined {
  return _statusMap.get(id);
}

/** Get all lenses with a given status. */
export function getLensesByStatus(status: LensStatus): LensStatusEntry[] {
  return LENS_STATUS_MAP.filter(e => e.status === status);
}

/** Get all lenses that merge into a given target. */
export function getLensesMergingInto(targetId: string): LensStatusEntry[] {
  return LENS_STATUS_MAP.filter(e => e.mergeTarget === targetId);
}

/** Get all standalone product lenses (the ones Concord bets on). */
export function getProductLenses(): LensStatusEntry[] {
  return LENS_STATUS_MAP.filter(e => e.status === 'product' && e.postMergeRole === 'standalone');
}

/** Get all deprecated lenses (scheduled for merge). */
export function getDeprecatedLenses(): LensStatusEntry[] {
  return LENS_STATUS_MAP.filter(e => e.status === 'deprecated');
}

/** Check if a lens is safe to show in public UI (not deprecated, not system). */
export function isPublicLens(id: string): boolean {
  const entry = _statusMap.get(id);
  if (!entry) return false;
  return entry.status === 'product' || entry.status === 'hybrid';
}

/** Summary statistics. */
export function getLensStatusSummary(): Record<LensStatus, number> {
  const counts: Record<LensStatus, number> = { product: 0, hybrid: 0, viewer: 0, system: 0, deprecated: 0 };
  for (const e of LENS_STATUS_MAP) {
    counts[e.status]++;
  }
  return counts;
}
