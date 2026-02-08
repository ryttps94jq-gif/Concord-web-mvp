/**
 * Lens Merge Map — Step 2 of the Core Lenses Roadmap.
 *
 * Defines the concrete merge groups that reduce ~97 lenses to ~18 real products.
 * Each merge group specifies:
 *   - The target product lens
 *   - The lenses being absorbed
 *   - What role each absorbed lens plays (mode, engine, absorbed)
 *   - The resulting artifact set after merge
 *   - The engines the merged lens gains
 *
 * This is the highest-leverage structural move: it concentrates capability
 * instead of diluting it across 80 half-products.
 */

export interface MergeSource {
  /** Lens ID being merged */
  id: string;
  /** Role in the target lens */
  role: 'mode' | 'engine' | 'absorbed';
  /** What capabilities transfer to the target */
  capabilities: string[];
}

export interface MergeGroup {
  /** The target product lens that survives */
  targetId: string;
  /** Display name for the super-lens */
  targetName: string;
  /** Primary artifacts the merged lens will own */
  artifacts: string[];
  /** Engines the merged lens will run */
  engines: string[];
  /** Pipelines the merged lens will execute */
  pipelines: string[];
  /** Lenses being merged in */
  sources: MergeSource[];
  /** Why this merge matters */
  rationale: string;
}

/**
 * The four core merge groups. After these merges, Concord drops from
 * ~97 lenses to ~18 that actually matter.
 */
export const LENS_MERGE_GROUPS: MergeGroup[] = [
  // ── MERGE GROUP A: Research Super-Lens ────────────────────────
  {
    targetId: 'paper',
    targetName: 'Research',
    artifacts: [
      'ResearchProject',
      'Claim',
      'Hypothesis',
      'Evidence',
      'Experiment',
      'Synthesis',
      'Goal',
      'StudyDeck',
    ],
    engines: [
      'claim-evidence-consistency',
      'hypothesis-mutation-retest',
      'contradiction-detection',
      'temporal-lineage-tracking',
      'affect-state-tracking',
      'transfer-analogy',
      'spaced-repetition',
    ],
    pipelines: [
      'ingest → extract-claims → validate → synthesize',
      're-run-hypothesis-on-new-evidence',
      'reflect → audit-cognition → update-strategy',
      'goal-evaluate → research-plan → execute',
    ],
    sources: [
      { id: 'hypothesis', role: 'mode', capabilities: ['hypothesis-testing', 'experiment-design'] },
      { id: 'reflection', role: 'mode', capabilities: ['self-reflection', 'insight-extraction'] },
      { id: 'metacognition', role: 'mode', capabilities: ['calibration', 'self-awareness-monitoring'] },
      { id: 'metalearning', role: 'mode', capabilities: ['strategy-optimization', 'learning-rate-tracking'] },
      { id: 'attention', role: 'mode', capabilities: ['focus-management', 'priority-routing'] },
      { id: 'experience', role: 'mode', capabilities: ['experience-replay', 'pattern-extraction'] },
      { id: 'suffering', role: 'mode', capabilities: ['harm-detection', 'wellbeing-monitoring'] },
      { id: 'organ', role: 'absorbed', capabilities: ['structural-organization'] },
      { id: 'affect', role: 'engine', capabilities: ['emotional-state-tracking', '7d-affect-vector'] },
      { id: 'transfer', role: 'engine', capabilities: ['analogy-generation', 'cross-domain-transfer'] },
      { id: 'lab', role: 'mode', capabilities: ['experimentation-sandbox', 'a-b-testing'] },
      { id: 'goals', role: 'mode', capabilities: ['goal-tracking', 'milestone-planning'] },
      { id: 'srs', role: 'mode', capabilities: ['spaced-repetition', 'knowledge-retention'] },
    ],
    rationale: 'These lenses are conceptually inseparable from research. Separating them weakens all of them. Together, they form a product no incumbent has.',
  },

  // ── MERGE GROUP B: Science + Simulation Super-Lens ────────────
  {
    targetId: 'sim',
    targetName: 'Simulation',
    artifacts: [
      'Scenario',
      'AssumptionSet',
      'SimulationRun',
      'OutcomeDistribution',
      'Model',
      'Dataset',
      'FinancialModel',
    ],
    engines: [
      'monte-carlo',
      'sensitivity-analysis',
      'regime-detection',
      'differential-equations',
      'molecular-dynamics',
      'quantum-circuit-sim',
      'neural-network-sim',
      'financial-projection',
    ],
    pipelines: [
      'define → simulate → summarize → reuse',
      'hypothesis → model → run → validate',
      'assumption-set → monte-carlo → distribution → decision',
      'portfolio → project → stress-test → rebalance',
    ],
    sources: [
      { id: 'math', role: 'engine', capabilities: ['symbolic-computation', 'numerical-methods'] },
      { id: 'physics', role: 'engine', capabilities: ['mechanics-simulation', 'field-equations'] },
      { id: 'quantum', role: 'engine', capabilities: ['qubit-simulation', 'quantum-gates'] },
      { id: 'chem', role: 'engine', capabilities: ['molecular-modeling', 'reaction-simulation'] },
      { id: 'bio', role: 'engine', capabilities: ['genomics', 'population-dynamics'] },
      { id: 'neuro', role: 'engine', capabilities: ['neural-modeling', 'brain-simulation'] },
      { id: 'finance', role: 'mode', capabilities: ['portfolio-analysis', 'risk-modeling'] },
    ],
    rationale: 'Nobody opens Mathematica "just for math" — they open it to model something. Science without simulation is a DTU viewer.',
  },

  // ── MERGE GROUP C: Knowledge Graph Super-Lens ─────────────────
  {
    targetId: 'graph',
    targetName: 'Knowledge Graph',
    artifacts: [
      'Entity',
      'Relation',
      'Assertion',
      'Source',
      'Invariant',
      'OntologyNode',
    ],
    engines: [
      'conflict-resolution',
      'temporal-truth-tracking',
      'confidence-scoring',
      'entity-resolution',
      'grounding-validation',
      'commonsense-inference',
    ],
    pipelines: [
      'ingest → link → validate → propagate',
      'conflict → resolve → update-confidence',
      'entity → ground → verify → trust-score',
    ],
    sources: [
      { id: 'entity', role: 'mode', capabilities: ['entity-browsing', 'world-model-exploration'] },
      { id: 'invariant', role: 'engine', capabilities: ['constraint-checking', 'rule-enforcement'] },
      { id: 'meta', role: 'absorbed', capabilities: ['system-introspection'] },
      { id: 'grounding', role: 'engine', capabilities: ['embodied-grounding', 'real-world-anchoring'] },
      { id: 'commonsense', role: 'engine', capabilities: ['common-knowledge', 'default-reasoning'] },
      { id: 'eco', role: 'absorbed', capabilities: ['ecosystem-overview'] },
      { id: 'temporal', role: 'engine', capabilities: ['temporal-reasoning', 'causal-ordering'] },
    ],
    rationale: 'Knowledge is alive. Conflicts are first-class. DTUs keep reasoning explicit.',
  },

  // ── MERGE GROUP D: Collaboration / Discourse Super-Lens ───────
  {
    targetId: 'whiteboard',
    targetName: 'Collaboration',
    artifacts: [
      'Board',
      'Node',
      'Connection',
      'Comment',
      'Discussion',
      'Decision',
      'Outcome',
      'Event',
      'Task',
    ],
    engines: [
      'consensus-detection',
      'pattern-extraction',
      'decision-summarization',
      'scheduling',
      'kanban-workflow',
    ],
    pipelines: [
      'collaborate → decide → extract-DTUs',
      'discuss → converge → record-decision',
      'plan → schedule → track → review',
    ],
    sources: [
      { id: 'forum', role: 'mode', capabilities: ['threaded-discussion', 'moderation'] },
      { id: 'thread', role: 'mode', capabilities: ['conversation-branching', 'summarization'] },
      { id: 'feed', role: 'mode', capabilities: ['content-aggregation', 'social-interaction'] },
      { id: 'daily', role: 'mode', capabilities: ['journaling', 'daily-summary'] },
      { id: 'news', role: 'mode', capabilities: ['news-aggregation', 'headline-tracking'] },
      { id: 'docs', role: 'mode', capabilities: ['documentation', 'reference-browsing'] },
      { id: 'collab', role: 'mode', capabilities: ['real-time-editing', 'presence-tracking'] },
      { id: 'anon', role: 'mode', capabilities: ['anonymous-messaging'] },
      { id: 'timeline', role: 'mode', capabilities: ['chronological-view', 'history-tracking'] },
      { id: 'board', role: 'mode', capabilities: ['kanban', 'task-management'] },
      { id: 'calendar', role: 'mode', capabilities: ['scheduling', 'event-management'] },
    ],
    rationale: 'Meetings produce reusable knowledge. Decisions do not vanish.',
  },
];

// ── Derived helpers ─────────────────────────────────────────────

const _mergeGroupMap = new Map(LENS_MERGE_GROUPS.map(g => [g.targetId, g]));

/** Get the merge group for a target lens. */
export function getMergeGroup(targetId: string): MergeGroup | undefined {
  return _mergeGroupMap.get(targetId);
}

/** Get all lens IDs scheduled for merge (across all groups). */
export function getAllMergeSourceIds(): string[] {
  return LENS_MERGE_GROUPS.flatMap(g => g.sources.map(s => s.id));
}

/** Find which merge group a source lens belongs to. */
export function findMergeGroupForSource(sourceId: string): MergeGroup | undefined {
  return LENS_MERGE_GROUPS.find(g => g.sources.some(s => s.id === sourceId));
}

/** Get the total number of lenses being merged away. */
export function getMergeReductionCount(): { before: number; after: number; merged: number } {
  const merged = new Set(getAllMergeSourceIds()).size;
  return { before: 97, after: 97 - merged, merged };
}

/**
 * After all merges, these are the surviving standalone lenses.
 * This is what Concord's public nav should show.
 */
export const POST_MERGE_STANDALONE_LENSES = [
  // Product lenses (the 10 world-class targets)
  'paper',       // Research
  'reasoning',   // Reasoning / Argument
  'council',     // Governance / City
  'agents',      // Agents / Council
  'sim',         // Simulation / Forecasting
  'studio',      // Studio (Creative) — note: needs to be created as super-lens absorbing music/game/ar/fractal
  'law',         // Legal / Policy
  'graph',       // Knowledge Graph / Entity
  'whiteboard',  // Collaboration / Whiteboard
  'database',    // Database / Structured Knowledge

  // Core interaction surfaces
  'chat',
  'code',

  // Marketplace
  'marketplace',

  // System (not in public nav but standalone)
  'admin', 'debug', 'audit', 'resonance', 'schema', 'integrations',
  'queue', 'tick', 'lock', 'offline', 'export', 'import', 'custom',
  'billing', 'crypto', 'fork', 'legacy',
] as const;

export type PostMergeStandaloneLens = typeof POST_MERGE_STANDALONE_LENSES[number];
