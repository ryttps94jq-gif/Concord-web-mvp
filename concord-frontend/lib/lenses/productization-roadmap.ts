/**
 * Productization Roadmap — Step 3 of the Core Lenses Roadmap.
 *
 * Defines the strict execution order for upgrading lenses to product status.
 * Order is non-negotiable: each lens unlocks the next.
 *
 * Do NOT reorder. The dependency chain is:
 *   Research → Simulation → Governance → Agents → Studio
 *
 * Each phase specifies:
 *   - Must-have artifacts before moving on
 *   - Must-have engines
 *   - Must-have pipelines
 *   - Acceptance criteria (what "done" means)
 *   - Dependencies on prior phases
 */

export type PhaseStatus = 'blocked' | 'ready' | 'in_progress' | 'completed';

export interface ProductionArtifact {
  /** Artifact type name */
  name: string;
  /** Whether this artifact persists independently of DTUs */
  persistsWithoutDTU: boolean;
  /** Storage domain (lens artifact API) */
  storageDomain: string;
  /** Fields the artifact must have at minimum */
  requiredFields: string[];
}

export interface ProductionEngine {
  /** Engine name */
  name: string;
  /** What it does in one sentence */
  description: string;
  /** Whether it runs automatically or on-demand */
  trigger: 'automatic' | 'on_demand' | 'scheduled';
}

export interface ProductionPipeline {
  /** Pipeline name */
  name: string;
  /** Ordered steps */
  steps: string[];
  /** Which engines power each step */
  engines: string[];
}

export interface ProductionPhase {
  /** Phase number (execution order) */
  order: number;
  /** Target lens ID */
  lensId: string;
  /** Display name */
  name: string;
  /** Why this goes first / here */
  rationale: string;
  /** Which phases must complete first */
  dependsOn: number[];
  /** Artifacts that must exist before phase is "done" */
  artifacts: ProductionArtifact[];
  /** Engines that must be running */
  engines: ProductionEngine[];
  /** Pipelines that must be wired */
  pipelines: ProductionPipeline[];
  /** Acceptance criteria — every item must be true to mark complete */
  acceptanceCriteria: string[];
  /** Incumbent(s) this lens is designed to beat */
  incumbents: string[];
  /** Current status */
  status: PhaseStatus;
}

/**
 * The 5-phase productization roadmap.
 * This is the minimum number of moves that yields maximum dominance.
 */
export const PRODUCTIZATION_PHASES: ProductionPhase[] = [
  // ── PHASE 1: Research ─────────────────────────────────────────
  {
    order: 1,
    lensId: 'paper',
    name: 'Research',
    rationale: 'Upgrades every other lens. Gives compounding intelligence. If Research is weak, everything else is cosmetic.',
    dependsOn: [],
    incumbents: ['Notion', 'Obsidian', 'Google Docs', 'Semantic Scholar'],
    artifacts: [
      {
        name: 'ResearchProject',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'title', 'description', 'status', 'claims', 'hypotheses', 'createdAt', 'updatedAt'],
      },
      {
        name: 'Claim',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'text', 'confidence', 'evidence', 'status', 'projectId'],
      },
      {
        name: 'Hypothesis',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'statement', 'status', 'evidence_for', 'evidence_against', 'projectId'],
      },
      {
        name: 'Evidence',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'type', 'source', 'content', 'confidence', 'claimIds'],
      },
      {
        name: 'Experiment',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'hypothesisId', 'method', 'status', 'results', 'conclusions'],
      },
      {
        name: 'Synthesis',
        persistsWithoutDTU: true,
        storageDomain: 'paper',
        requiredFields: ['id', 'projectId', 'claims', 'narrative', 'confidence', 'version'],
      },
    ],
    engines: [
      { name: 'claim-evidence-consistency', description: 'Validates that evidence actually supports linked claims', trigger: 'automatic' },
      { name: 'hypothesis-mutation-retest', description: 'Mutates hypotheses when new evidence appears and re-evaluates', trigger: 'automatic' },
      { name: 'contradiction-detection', description: 'Finds claims that conflict with each other across projects', trigger: 'automatic' },
      { name: 'temporal-lineage-tracking', description: 'Tracks how knowledge evolves over time with full provenance', trigger: 'automatic' },
    ],
    pipelines: [
      {
        name: 'ingest-validate-synthesize',
        steps: ['ingest', 'extract-claims', 'validate-evidence', 'detect-contradictions', 'synthesize'],
        engines: ['claim-evidence-consistency', 'contradiction-detection'],
      },
      {
        name: 'hypothesis-lifecycle',
        steps: ['propose', 'design-experiment', 'run', 'evaluate', 'update-hypothesis'],
        engines: ['hypothesis-mutation-retest', 'temporal-lineage-tracking'],
      },
    ],
    acceptanceCriteria: [
      'ResearchProject artifact persists in lens store with full CRUD',
      'Claims are first-class objects linked to Evidence',
      'Hypothesis lifecycle runs without manual intervention',
      'Contradiction detection fires automatically on new evidence ingest',
      'DTU exhaust is generated for every claim/evidence/hypothesis mutation',
      'At least one pipeline is end-to-end functional',
      'All merged modes (hypothesis, reflection, metacognition, etc.) are accessible within Research UI',
    ],
    status: 'ready',
  },

  // ── PHASE 2: Simulation ───────────────────────────────────────
  {
    order: 2,
    lensId: 'sim',
    name: 'Simulation',
    rationale: 'Governance, science, and finance all depend on it. Turns ideas into testable outcomes.',
    dependsOn: [1],
    incumbents: ['Excel', '@Risk', 'MATLAB', 'Wolfram Alpha'],
    artifacts: [
      {
        name: 'Scenario',
        persistsWithoutDTU: true,
        storageDomain: 'sim',
        requiredFields: ['id', 'name', 'description', 'assumptionSetId', 'status', 'createdAt'],
      },
      {
        name: 'AssumptionSet',
        persistsWithoutDTU: true,
        storageDomain: 'sim',
        requiredFields: ['id', 'scenarioId', 'assumptions', 'version', 'locked'],
      },
      {
        name: 'SimulationRun',
        persistsWithoutDTU: true,
        storageDomain: 'sim',
        requiredFields: ['id', 'scenarioId', 'assumptionSetId', 'config', 'status', 'startedAt', 'completedAt'],
      },
      {
        name: 'OutcomeDistribution',
        persistsWithoutDTU: true,
        storageDomain: 'sim',
        requiredFields: ['id', 'runId', 'metric', 'distribution', 'percentiles', 'summary'],
      },
    ],
    engines: [
      { name: 'monte-carlo', description: 'Runs Monte Carlo simulations over assumption sets', trigger: 'on_demand' },
      { name: 'sensitivity-analysis', description: 'Identifies which assumptions most affect outcomes', trigger: 'on_demand' },
      { name: 'regime-detection', description: 'Detects phase transitions and non-linear regime changes', trigger: 'automatic' },
    ],
    pipelines: [
      {
        name: 'scenario-sim-summarize',
        steps: ['define-scenario', 'set-assumptions', 'simulate', 'summarize-outcomes', 'archive'],
        engines: ['monte-carlo', 'sensitivity-analysis'],
      },
      {
        name: 'assumption-retest',
        steps: ['load-assumptions', 'perturb', 're-simulate', 'compare-outcomes'],
        engines: ['monte-carlo', 'regime-detection'],
      },
    ],
    acceptanceCriteria: [
      'Scenario artifact persists with full CRUD',
      'AssumptionSet is versioned and lockable',
      'Monte Carlo engine runs and produces OutcomeDistribution',
      'Sensitivity analysis identifies top-3 influential assumptions',
      'Results from Phase 1 Research feed into Simulation scenarios',
      'DTU exhaust is generated for every simulation run',
      'All merged science engines (math, physics, chem, bio, neuro, quantum) are callable',
    ],
    status: 'blocked',
  },

  // ── PHASE 3: Governance / City ────────────────────────────────
  {
    order: 3,
    lensId: 'council',
    name: 'Governance',
    rationale: 'Real-world proof. Investors and cities understand this immediately. Policy becomes executable.',
    dependsOn: [1, 2],
    incumbents: ['PDFs', 'Spreadsheets', 'Civic portals', 'Decidim'],
    artifacts: [
      {
        name: 'Proposal',
        persistsWithoutDTU: true,
        storageDomain: 'council',
        requiredFields: ['id', 'title', 'body', 'author', 'status', 'budgetImpact', 'simulationId', 'createdAt'],
      },
      {
        name: 'Vote',
        persistsWithoutDTU: true,
        storageDomain: 'council',
        requiredFields: ['id', 'proposalId', 'voterId', 'choice', 'weight', 'rationale', 'timestamp'],
      },
      {
        name: 'BudgetModel',
        persistsWithoutDTU: true,
        storageDomain: 'council',
        requiredFields: ['id', 'projectId', 'lineItems', 'assumptions', 'simulationRunId', 'version'],
      },
      {
        name: 'Project',
        persistsWithoutDTU: true,
        storageDomain: 'council',
        requiredFields: ['id', 'proposalId', 'status', 'milestones', 'budget', 'team', 'auditTrailId'],
      },
      {
        name: 'AuditTrail',
        persistsWithoutDTU: true,
        storageDomain: 'council',
        requiredFields: ['id', 'entityType', 'entityId', 'action', 'actor', 'timestamp', 'details'],
      },
    ],
    engines: [
      { name: 'budget-monte-carlo', description: 'Monte Carlo simulation for budget projections using Phase 2 sim engine', trigger: 'on_demand' },
      { name: 'fraud-feasibility-check', description: 'Flags proposals with unrealistic budgets or impossible timelines', trigger: 'automatic' },
      { name: 'spillover-modeling', description: 'Models second-order effects of policy decisions', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'proposal-to-execution',
        steps: ['draft-proposal', 'simulate-budget', 'vote', 'execute', 'audit'],
        engines: ['budget-monte-carlo', 'fraud-feasibility-check'],
      },
      {
        name: 'policy-impact',
        steps: ['define-policy', 'model-spillover', 'simulate', 'review', 'decide'],
        engines: ['spillover-modeling', 'budget-monte-carlo'],
      },
    ],
    acceptanceCriteria: [
      'Proposal → Simulate → Vote → Execute → Audit pipeline is end-to-end functional',
      'BudgetModel links to Simulation Phase 2 AssumptionSets',
      'Votes are immutable and auditable',
      'AuditTrail captures every state transition',
      'DTU exhaust provides full transparency for every governance action',
      'All merged modes (vote, ethics, alliance) are accessible within Governance UI',
    ],
    status: 'blocked',
  },

  // ── PHASE 4: Agents + Council ─────────────────────────────────
  {
    order: 4,
    lensId: 'agents',
    name: 'Agents',
    rationale: 'Agents without governance are toys. Governance + agents = enterprise-grade AI.',
    dependsOn: [1, 3],
    incumbents: ['AutoGPT', 'CrewAI', 'LangChain Agents', 'Microsoft Copilot'],
    artifacts: [
      {
        name: 'Agent',
        persistsWithoutDTU: true,
        storageDomain: 'agents',
        requiredFields: ['id', 'name', 'role', 'capabilities', 'constraints', 'status', 'memoryId'],
      },
      {
        name: 'Role',
        persistsWithoutDTU: true,
        storageDomain: 'agents',
        requiredFields: ['id', 'name', 'permissions', 'constraints', 'safetyEnvelope'],
      },
      {
        name: 'Task',
        persistsWithoutDTU: true,
        storageDomain: 'agents',
        requiredFields: ['id', 'agentId', 'description', 'status', 'input', 'output', 'auditTrailId'],
      },
      {
        name: 'Deliberation',
        persistsWithoutDTU: true,
        storageDomain: 'agents',
        requiredFields: ['id', 'participants', 'topic', 'arguments', 'outcome', 'consensusScore'],
      },
      {
        name: 'Decision',
        persistsWithoutDTU: true,
        storageDomain: 'agents',
        requiredFields: ['id', 'deliberationId', 'choice', 'rationale', 'confidence', 'approvedBy'],
      },
    ],
    engines: [
      { name: 'multi-agent-arbitration', description: 'Resolves conflicts between agents with competing objectives', trigger: 'automatic' },
      { name: 'role-based-constraints', description: 'Enforces role permissions and safety envelopes', trigger: 'automatic' },
      { name: 'memory-reconciliation', description: 'Reconciles divergent agent memories after parallel execution', trigger: 'automatic' },
      { name: 'safety-envelope-enforcement', description: 'Prevents agents from acting outside their safety bounds', trigger: 'automatic' },
    ],
    pipelines: [
      {
        name: 'task-lifecycle',
        steps: ['assign', 'deliberate', 'decide', 'act', 'learn'],
        engines: ['multi-agent-arbitration', 'role-based-constraints'],
      },
      {
        name: 'safety-audit',
        steps: ['monitor', 'detect-violation', 'halt', 'review', 'resume-or-terminate'],
        engines: ['safety-envelope-enforcement', 'memory-reconciliation'],
      },
    ],
    acceptanceCriteria: [
      'Agents are governed by Phase 3 governance primitives',
      'Multi-agent arbitration resolves conflicts with audit trail',
      'Safety envelope prevents unauthorized actions',
      'Memory reconciliation handles parallel agent execution',
      'Every agent action generates DTU exhaust for auditability',
      'Council deliberation produces persistent Decision artifacts',
      'ML engine from merge is callable for model training/inference',
    ],
    status: 'blocked',
  },

  // ── PHASE 5: Studio (Creative) ────────────────────────────────
  {
    order: 5,
    lensId: 'studio',
    name: 'Studio',
    rationale: 'User magnet. Proves Concord is not just thinking. Creative decisions become reusable knowledge.',
    dependsOn: [1],
    incumbents: ['Ableton', 'Figma', 'Adobe Creative Suite', 'Notion'],
    artifacts: [
      {
        name: 'Project',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'name', 'type', 'assets', 'status', 'version', 'createdAt'],
      },
      {
        name: 'Track',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'projectId', 'type', 'data', 'effects', 'version'],
      },
      {
        name: 'Canvas',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'projectId', 'layers', 'dimensions', 'exportFormats'],
      },
      {
        name: 'Asset',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'projectId', 'type', 'url', 'metadata', 'tags'],
      },
      {
        name: 'Preset',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'domain', 'name', 'config', 'isShared'],
      },
      {
        name: 'Render',
        persistsWithoutDTU: true,
        storageDomain: 'studio',
        requiredFields: ['id', 'projectId', 'format', 'status', 'outputUrl', 'createdAt'],
      },
    ],
    engines: [
      { name: 'audio-engine', description: 'Audio processing, mixing, mastering', trigger: 'on_demand' },
      { name: 'visual-layout-engine', description: 'Layout computation, responsive design', trigger: 'on_demand' },
      { name: 'text-generation-engine', description: 'Structured creative writing with style analysis', trigger: 'on_demand' },
      { name: 'style-analysis', description: 'Extracts and compares stylistic patterns across projects', trigger: 'on_demand' },
      { name: 'iteration-comparison', description: 'Compares versions of creative work with diff analysis', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'create-refine-publish',
        steps: ['create', 'refine', 'evaluate', 'render', 'publish'],
        engines: ['audio-engine', 'visual-layout-engine', 'style-analysis'],
      },
      {
        name: 'iteration-learning',
        steps: ['create-version', 'compare-iterations', 'extract-patterns', 'update-presets'],
        engines: ['iteration-comparison', 'style-analysis'],
      },
    ],
    acceptanceCriteria: [
      'Project artifact supports music, visual, and text types',
      'At least one domain engine (audio, visual, or text) is functional',
      'Presets are shareable across projects',
      'Render pipeline produces exportable output',
      'Creative decisions generate DTU exhaust for technique reuse',
      'All merged modes (music, game, AR, fractal, voice) are accessible within Studio UI',
      'Style analysis works across project types',
    ],
    status: 'blocked',
  },

  // ── PHASE 6: Reasoning / Argument ───────────────────────────────
  {
    order: 6,
    lensId: 'reasoning',
    name: 'Reasoning',
    rationale: 'Logical argument construction and validation. Bridges Research and Governance with formal reasoning chains.',
    dependsOn: [1],
    incumbents: ['Roam Research', 'Logseq', 'Prolog IDEs', 'Argument mapping tools'],
    artifacts: [
      {
        name: 'ArgumentTree',
        persistsWithoutDTU: true,
        storageDomain: 'reasoning',
        requiredFields: ['id', 'premise', 'type', 'steps', 'conclusion', 'status', 'createdAt'],
      },
      {
        name: 'Premise',
        persistsWithoutDTU: true,
        storageDomain: 'reasoning',
        requiredFields: ['id', 'text', 'confidence', 'sources', 'chainId'],
      },
      {
        name: 'Inference',
        persistsWithoutDTU: true,
        storageDomain: 'reasoning',
        requiredFields: ['id', 'fromPremises', 'rule', 'conclusion', 'validity', 'chainId'],
      },
    ],
    engines: [
      { name: 'validity-checker', description: 'Validates logical structure of argument chains', trigger: 'automatic' },
      { name: 'counterexample-generator', description: 'Generates counterexamples to test argument strength', trigger: 'on_demand' },
      { name: 'argument-strength-scorer', description: 'Scores overall argument quality on multiple dimensions', trigger: 'automatic' },
    ],
    pipelines: [
      {
        name: 'premise-to-conclusion',
        steps: ['state-premise', 'add-steps', 'validate-logic', 'check-counterexamples', 'conclude'],
        engines: ['validity-checker', 'counterexample-generator'],
      },
      {
        name: 'argument-audit',
        steps: ['load-chain', 'score-strength', 'identify-weaknesses', 'suggest-improvements'],
        engines: ['argument-strength-scorer', 'validity-checker'],
      },
    ],
    acceptanceCriteria: [
      'ArgumentTree artifact persists with full CRUD',
      'Deductive, inductive, abductive, and analogical chains supported',
      'Validity checker flags invalid inference steps automatically',
      'Counterexample generator tests argument robustness',
      'DTU exhaust generated for every chain mutation',
      'Trace visualization shows full reasoning path',
    ],
    status: 'blocked',
  },

  // ── PHASE 7: Knowledge Graph ────────────────────────────────────
  {
    order: 7,
    lensId: 'graph',
    name: 'Knowledge Graph',
    rationale: 'The connective tissue of all knowledge. Every lens produces entities and relations that the graph unifies.',
    dependsOn: [1, 6],
    incumbents: ['Neo4j', 'Obsidian Graph', 'Roam', 'Notion Relations'],
    artifacts: [
      {
        name: 'Entity',
        persistsWithoutDTU: true,
        storageDomain: 'graph',
        requiredFields: ['id', 'label', 'type', 'properties', 'tags', 'createdAt'],
      },
      {
        name: 'Relation',
        persistsWithoutDTU: true,
        storageDomain: 'graph',
        requiredFields: ['id', 'sourceId', 'targetId', 'type', 'weight', 'properties'],
      },
      {
        name: 'Assertion',
        persistsWithoutDTU: true,
        storageDomain: 'graph',
        requiredFields: ['id', 'subject', 'predicate', 'object', 'confidence', 'sources'],
      },
    ],
    engines: [
      { name: 'entity-resolution', description: 'Deduplicates and merges entities across sources', trigger: 'automatic' },
      { name: 'cluster-detection', description: 'Identifies clusters and communities in the graph', trigger: 'on_demand' },
      { name: 'path-analysis', description: 'Finds shortest/weighted paths between entities', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'ingest-resolve-cluster',
        steps: ['ingest-entities', 'resolve-duplicates', 'compute-relations', 'detect-clusters', 'summarize'],
        engines: ['entity-resolution', 'cluster-detection'],
      },
      {
        name: 'graph-query',
        steps: ['parse-query', 'traverse-graph', 'score-results', 'render-subgraph'],
        engines: ['path-analysis', 'cluster-detection'],
      },
    ],
    acceptanceCriteria: [
      'Entity and Relation artifacts persist with full CRUD',
      'Force-directed layout renders interactively',
      'Entity resolution deduplicates on ingest',
      'Cluster detection identifies knowledge communities',
      'DTU exhaust generated for every graph mutation',
      'Export to JSON and GraphML formats',
    ],
    status: 'blocked',
  },

  // ── PHASE 8: Collaboration / Whiteboard ─────────────────────────
  {
    order: 8,
    lensId: 'whiteboard',
    name: 'Collaboration',
    rationale: 'Visual thinking and real-time collaboration. The shared workspace where ideas become visible.',
    dependsOn: [1],
    incumbents: ['Miro', 'FigJam', 'AFFiNE', 'Excalidraw'],
    artifacts: [
      {
        name: 'Board',
        persistsWithoutDTU: true,
        storageDomain: 'whiteboard',
        requiredFields: ['id', 'name', 'mode', 'elements', 'createdAt', 'updatedAt'],
      },
      {
        name: 'Element',
        persistsWithoutDTU: true,
        storageDomain: 'whiteboard',
        requiredFields: ['id', 'boardId', 'type', 'x', 'y', 'width', 'height', 'data'],
      },
      {
        name: 'Connection',
        persistsWithoutDTU: true,
        storageDomain: 'whiteboard',
        requiredFields: ['id', 'boardId', 'fromElementId', 'toElementId', 'type'],
      },
    ],
    engines: [
      { name: 'auto-layout', description: 'Automatically arranges elements for optimal readability', trigger: 'on_demand' },
      { name: 'canvas-renderer', description: 'High-performance canvas rendering with zoom/pan', trigger: 'automatic' },
      { name: 'export-renderer', description: 'Renders boards to PNG/SVG for export', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'create-arrange-export',
        steps: ['create-board', 'add-elements', 'auto-layout', 'render', 'export'],
        engines: ['auto-layout', 'canvas-renderer', 'export-renderer'],
      },
      {
        name: 'moodboard-to-arrangement',
        steps: ['collect-references', 'organize-moodboard', 'derive-structure', 'create-arrangement'],
        engines: ['auto-layout', 'canvas-renderer'],
      },
    ],
    acceptanceCriteria: [
      'Board artifact persists with full CRUD',
      'Canvas, moodboard, and arrangement modes all functional',
      'Elements support shapes, text, images, audio pins, DTU links',
      'Undo/redo with history',
      'Export to PNG works',
      'DTU exhaust generated for board mutations',
    ],
    status: 'blocked',
  },

  // ── PHASE 9: Legal / Policy ─────────────────────────────────────
  {
    order: 9,
    lensId: 'law',
    name: 'Legal',
    rationale: 'Compliance and legal frameworks are required for enterprise adoption. Makes governance decisions legally defensible.',
    dependsOn: [3],
    incumbents: ['LexisNexis', 'Westlaw', 'Clio', 'Contract management tools'],
    artifacts: [
      {
        name: 'CaseFile',
        persistsWithoutDTU: true,
        storageDomain: 'law',
        requiredFields: ['id', 'title', 'jurisdiction', 'status', 'frameworks', 'createdAt'],
      },
      {
        name: 'Clause',
        persistsWithoutDTU: true,
        storageDomain: 'law',
        requiredFields: ['id', 'caseId', 'text', 'type', 'framework', 'status'],
      },
      {
        name: 'Draft',
        persistsWithoutDTU: true,
        storageDomain: 'law',
        requiredFields: ['id', 'caseId', 'title', 'body', 'version', 'status'],
      },
      {
        name: 'PrecedentGraph',
        persistsWithoutDTU: true,
        storageDomain: 'law',
        requiredFields: ['id', 'caseId', 'nodes', 'edges', 'jurisdiction'],
      },
    ],
    engines: [
      { name: 'compliance-checker', description: 'Checks proposals against legal frameworks (GDPR, DMCA, AI Act)', trigger: 'automatic' },
      { name: 'precedent-search', description: 'Finds relevant legal precedents for a given case', trigger: 'on_demand' },
      { name: 'risk-assessor', description: 'Assesses legal risk of proposed actions', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'compliance-review',
        steps: ['ingest-proposal', 'identify-frameworks', 'check-compliance', 'assess-risk', 'generate-report'],
        engines: ['compliance-checker', 'risk-assessor'],
      },
      {
        name: 'draft-review',
        steps: ['draft-clause', 'check-precedents', 'validate-compliance', 'finalize'],
        engines: ['precedent-search', 'compliance-checker'],
      },
    ],
    acceptanceCriteria: [
      'CaseFile artifact persists with full CRUD',
      'Compliance checker validates against GDPR, CCPA, DMCA, EU AI Act',
      'Legality gate blocks non-compliant proposals',
      'Precedent search returns relevant citations',
      'DTU exhaust generated for every legal action',
      'Risk assessment produces quantified risk scores',
    ],
    status: 'blocked',
  },

  // ── PHASE 10: Database / Structured Knowledge ───────────────────
  {
    order: 10,
    lensId: 'database',
    name: 'Database',
    rationale: 'Structured data is the foundation for all analytics. Gives every lens a queryable substrate.',
    dependsOn: [1],
    incumbents: ['DBeaver', 'TablePlus', 'Retool', 'Airtable'],
    artifacts: [
      {
        name: 'SavedQuery',
        persistsWithoutDTU: true,
        storageDomain: 'database',
        requiredFields: ['id', 'title', 'sql', 'description', 'createdAt'],
      },
      {
        name: 'Snapshot',
        persistsWithoutDTU: true,
        storageDomain: 'database',
        requiredFields: ['id', 'queryId', 'results', 'rowCount', 'executionTime', 'createdAt'],
      },
      {
        name: 'SchemaView',
        persistsWithoutDTU: true,
        storageDomain: 'database',
        requiredFields: ['id', 'tables', 'indexes', 'relations', 'version'],
      },
    ],
    engines: [
      { name: 'query-optimizer', description: 'Analyzes and optimizes SQL queries', trigger: 'on_demand' },
      { name: 'schema-inspector', description: 'Introspects database schema and detects issues', trigger: 'on_demand' },
      { name: 'data-profiler', description: 'Profiles data quality and generates statistics', trigger: 'on_demand' },
    ],
    pipelines: [
      {
        name: 'query-optimize-export',
        steps: ['write-query', 'analyze-plan', 'optimize', 'execute', 'export-results'],
        engines: ['query-optimizer', 'data-profiler'],
      },
      {
        name: 'schema-audit',
        steps: ['inspect-schema', 'detect-issues', 'suggest-indexes', 'generate-report'],
        engines: ['schema-inspector', 'query-optimizer'],
      },
    ],
    acceptanceCriteria: [
      'SavedQuery artifact persists with full CRUD',
      'Query editor with syntax highlighting',
      'Results displayed in paginated table',
      'Schema browser shows tables, columns, indexes',
      'Export to JSON and CSV',
      'DTU exhaust generated for query execution',
    ],
    status: 'blocked',
  },
];

// ── Derived helpers ─────────────────────────────────────────────

/** Get all phases in execution order. */
export function getProductionPhases(): ProductionPhase[] {
  return [...PRODUCTIZATION_PHASES].sort((a, b) => a.order - b.order);
}

/** Get the current phase (first non-completed in order). */
export function getCurrentPhase(): ProductionPhase | undefined {
  return getProductionPhases().find(p => p.status !== 'completed');
}

/** Get a phase by lens ID. */
export function getPhaseByLens(lensId: string): ProductionPhase | undefined {
  return PRODUCTIZATION_PHASES.find(p => p.lensId === lensId);
}

/** Check if all dependencies for a phase are met. */
export function areDependenciesMet(phase: ProductionPhase): boolean {
  return phase.dependsOn.every(depOrder => {
    const dep = PRODUCTIZATION_PHASES.find(p => p.order === depOrder);
    return dep?.status === 'completed';
  });
}

/** Get the total artifact count across all phases. */
export function getTotalArtifactCount(): number {
  return PRODUCTIZATION_PHASES.reduce((sum, p) => sum + p.artifacts.length, 0);
}

/** Get the total engine count across all phases. */
export function getTotalEngineCount(): number {
  return PRODUCTIZATION_PHASES.reduce((sum, p) => sum + p.engines.length, 0);
}
