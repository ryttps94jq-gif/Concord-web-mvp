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

// ── Super-Lens Merge Groups ─────────────────────────────────────
// Each super-lens absorbs multiple niches into a single product-grade lens.

export const SUPER_LENS_MERGE_GROUPS: MergeGroup[] = [
  {
    targetId: 'healthcare',
    targetName: 'Healthcare',
    artifacts: ['Patient', 'Encounter', 'CareProtocol', 'Prescription', 'LabResult', 'Treatment'],
    engines: ['drug-interaction-checker', 'protocol-matcher', 'patient-summary-generator'],
    pipelines: ['encounter → assess → prescribe → follow-up', 'lab-order → result → interpret → act'],
    sources: [],
    rationale: 'Absorbs clinical, pharmacy, mental health, veterinary, dental, PT, rehab, emergency, home health, research trials, nutrition into one healthcare product.',
  },
  {
    targetId: 'trades',
    targetName: 'Trades & Construction',
    artifacts: ['Job', 'Estimate', 'MaterialsList', 'Permit', 'Equipment', 'Client'],
    engines: ['estimate-calculator', 'inspection-scheduler', 'materials-aggregator'],
    pipelines: ['estimate → approve → schedule → inspect → invoice', 'equipment → maintain → track'],
    sources: [],
    rationale: 'Absorbs general contracting, electrical, plumbing, HVAC, welding, landscaping, auto mechanics, carpentry.',
  },
  {
    targetId: 'food',
    targetName: 'Food & Hospitality',
    artifacts: ['Recipe', 'Menu', 'InventoryItem', 'Booking', 'Batch', 'Shift'],
    engines: ['recipe-scaler', 'food-cost-calculator', 'spoilage-checker', 'pour-cost-calculator'],
    pipelines: ['recipe → menu → cost → price', 'inventory → order → receive → track'],
    sources: [],
    rationale: 'Absorbs restaurant, catering, brewing/distilling, bakery, hotel, bar, food truck operations.',
  },
  {
    targetId: 'retail',
    targetName: 'Retail & Commerce',
    artifacts: ['Product', 'Order', 'Customer', 'Lead', 'Ticket', 'Display'],
    engines: ['reorder-checker', 'pipeline-calculator', 'ltv-calculator', 'sla-tracker'],
    pipelines: ['lead → qualify → propose → close', 'order → fulfill → ship → deliver'],
    sources: [],
    rationale: 'Absorbs inventory, POS, CRM, helpdesk, e-commerce, merchandising, wholesale.',
  },
  {
    targetId: 'household',
    targetName: 'Home & Family',
    artifacts: ['FamilyMember', 'MealPlan', 'Chore', 'MaintenanceItem', 'Pet', 'MajorEvent'],
    engines: ['grocery-list-generator', 'maintenance-tracker', 'chore-rotator'],
    pipelines: ['plan-meals → generate-groceries → shop', 'schedule-chore → assign → complete → rotate'],
    sources: [],
    rationale: 'Absorbs family coordination, childcare, pet care, home maintenance, elder care, event planning, moving.',
  },
  {
    targetId: 'accounting',
    targetName: 'Accounting & Finance',
    artifacts: ['Account', 'Transaction', 'Invoice', 'PayrollEntry', 'Budget', 'Property', 'TaxItem'],
    engines: ['trial-balance', 'profit-loss', 'invoice-aging', 'budget-variance', 'rent-roll'],
    pipelines: ['record → categorize → reconcile → report', 'invoice → send → track → collect'],
    sources: [],
    rationale: 'Absorbs bookkeeping, invoicing, tax prep, payroll, personal budgeting, rental property, insurance tracking.',
  },
  {
    targetId: 'agriculture',
    targetName: 'Agriculture & Farming',
    artifacts: ['Field', 'Crop', 'Animal', 'FarmEquipment', 'WaterSystem', 'Harvest', 'Certification'],
    engines: ['rotation-planner', 'yield-analyzer', 'equipment-tracker', 'water-scheduler'],
    pipelines: ['plant → grow → harvest → store → sell', 'animal → breed → feed → health-check'],
    sources: [],
    rationale: 'Absorbs crop management, livestock, farm equipment, irrigation, harvest/storage, organic certification.',
  },
  {
    targetId: 'logistics',
    targetName: 'Transportation & Logistics',
    artifacts: ['Vehicle', 'Driver', 'Shipment', 'WarehouseItem', 'Route', 'ComplianceLog'],
    engines: ['route-optimizer', 'hos-checker', 'maintenance-tracker', 'inventory-auditor'],
    pipelines: ['book → pick-up → transit → deliver → POD', 'receive → store → pick → pack → ship'],
    sources: [],
    rationale: 'Absorbs fleet management, shipping, warehouse, route planning, CDL compliance, moving operations.',
  },
  {
    targetId: 'education',
    targetName: 'Education',
    artifacts: ['Student', 'Course', 'Assignment', 'Grade', 'LessonPlan', 'Certification'],
    engines: ['grade-calculator', 'attendance-reporter', 'progress-tracker', 'schedule-conflict-detector'],
    pipelines: ['enroll → attend → assess → grade → certify', 'plan-lesson → teach → evaluate'],
    sources: [],
    rationale: 'Absorbs classroom, tutoring, school admin, corporate training, driving school, studio management.',
  },
  {
    targetId: 'legal',
    targetName: 'Legal',
    artifacts: ['Case', 'Contract', 'ComplianceItem', 'Filing', 'IPAsset'],
    engines: ['deadline-checker', 'contract-renewal-tracker', 'conflict-checker', 'compliance-scorer'],
    pipelines: ['case-intake → discovery → negotiate → trial → close', 'contract-draft → review → execute → manage'],
    sources: [],
    rationale: 'Absorbs case management, contract lifecycle, compliance tracking, immigration, IP portfolio.',
  },
  {
    targetId: 'nonprofit',
    targetName: 'Nonprofit & Community',
    artifacts: ['Donor', 'Grant', 'Volunteer', 'Campaign', 'ImpactMetric', 'Member'],
    engines: ['donor-retention-calculator', 'grant-reporter', 'volunteer-matcher', 'campaign-tracker'],
    pipelines: ['identify-donor → cultivate → solicit → steward', 'apply-grant → execute → report'],
    sources: [],
    rationale: 'Absorbs donor management, grant tracking, volunteer coordination, impact reporting, religious org, community organizing.',
  },
  {
    targetId: 'realestate',
    targetName: 'Real Estate',
    artifacts: ['Listing', 'Showing', 'Transaction', 'RentalUnit', 'Deal'],
    engines: ['cap-rate-calculator', 'cash-flow-analyzer', 'closing-timeline-generator', 'vacancy-tracker'],
    pipelines: ['list → show → offer → inspect → close', 'acquire → rehab → rent → manage'],
    sources: [],
    rationale: 'Absorbs listings, transaction coordination, property management, investing, appraisal.',
  },
  {
    targetId: 'fitness',
    targetName: 'Fitness & Wellness',
    artifacts: ['Client', 'Program', 'Workout', 'Class', 'Team', 'Athlete'],
    engines: ['progression-calculator', 'class-utilization-tracker', 'periodization-planner', 'recruit-profiler'],
    pipelines: ['assess → program → train → progress → reassess', 'enroll → attend → track → graduate'],
    sources: [],
    rationale: 'Absorbs personal training, gym management, yoga, sports coaching, athletic recruiting.',
  },
  {
    targetId: 'creative',
    targetName: 'Creative Production',
    artifacts: ['Project', 'Shoot', 'Asset', 'Episode', 'Collection', 'ClientProof'],
    engines: ['shot-list-generator', 'asset-organizer', 'budget-tracker', 'distribution-checklist'],
    pipelines: ['brief → pre-production → production → post → deliver', 'record → edit → master → distribute'],
    sources: [],
    rationale: 'Absorbs photography, video, podcast, fashion, interior design, print/graphic design.',
  },
  {
    targetId: 'manufacturing',
    targetName: 'Manufacturing',
    artifacts: ['WorkOrder', 'BOM', 'QCInspection', 'Machine', 'SafetyItem', 'Part'],
    engines: ['schedule-optimizer', 'bom-cost-calculator', 'oee-calculator', 'safety-rate-calculator'],
    pipelines: ['plan → release → produce → inspect → ship', 'report → investigate → correct → close'],
    sources: [],
    rationale: 'Absorbs production scheduling, quality control, BOM, equipment maintenance, safety/OSHA.',
  },
  {
    targetId: 'environment',
    targetName: 'Environmental & Outdoors',
    artifacts: ['Site', 'Species', 'Survey', 'TrailAsset', 'EnvironmentalSample', 'WasteStream'],
    engines: ['population-trend-analyzer', 'compliance-checker', 'trail-condition-ranker', 'diversion-rate-calculator'],
    pipelines: ['survey → record → analyze → report', 'sample → test → compare → comply'],
    sources: [],
    rationale: 'Absorbs wildlife management, forestry, marine/fisheries, park/trail, environmental monitoring, waste management.',
  },
  {
    targetId: 'government',
    targetName: 'Government & Public Service',
    artifacts: ['Permit', 'Project', 'Violation', 'EmergencyPlan', 'Record', 'CourtCase'],
    engines: ['permit-timeline-calculator', 'violation-escalator', 'resource-stager', 'retention-checker'],
    pipelines: ['apply → review → approve → inspect', 'observe → notice → enforce → resolve'],
    sources: [],
    rationale: 'Absorbs permitting, public works, code enforcement, emergency management, public records, court admin.',
  },
  {
    targetId: 'aviation',
    targetName: 'Aviation & Maritime',
    artifacts: ['Flight', 'Aircraft', 'Vessel', 'Slip', 'Charter', 'CrewMember'],
    engines: ['currency-checker', 'maintenance-tracker', 'hobbs-logger', 'slip-utilization-calculator'],
    pipelines: ['plan → preflight → fly → log', 'book-charter → crew → depart → arrive → settle'],
    sources: [],
    rationale: 'Absorbs flight planning, pilot logbooks, marina management, charter operations.',
  },
  {
    targetId: 'events',
    targetName: 'Events & Entertainment',
    artifacts: ['Event', 'Venue', 'Performer', 'Tour', 'Production', 'Vendor'],
    engines: ['budget-reconciler', 'advance-sheet-generator', 'tech-rider-matcher', 'settlement-calculator'],
    pipelines: ['plan → book → advance → produce → settle', 'audition → cast → rehearse → perform → strike'],
    sources: [],
    rationale: 'Absorbs venue management, touring, festivals, DJ/performer management, theater production.',
  },
  {
    targetId: 'science',
    targetName: 'Science & Field Work',
    artifacts: ['Expedition', 'Observation', 'Sample', 'LabProtocol', 'Analysis', 'Equipment'],
    engines: ['chain-of-custody-verifier', 'calibration-checker', 'data-exporter', 'spatial-clusterer'],
    pipelines: ['plan → collect → analyze → publish', 'sample → custody → process → report'],
    sources: [],
    rationale: 'Absorbs field data collection, lab management, archaeological sites, geological survey/mining.',
  },
  {
    targetId: 'security',
    targetName: 'Security',
    artifacts: ['Post', 'Incident', 'Patrol', 'Threat', 'Investigation', 'Asset'],
    engines: ['incident-trend-analyzer', 'patrol-coverage-calculator', 'threat-matrix-mapper', 'evidence-chain-verifier'],
    pipelines: ['detect → respond → investigate → resolve', 'assess → monitor → mitigate → review'],
    sources: [],
    rationale: 'Absorbs physical security, cybersecurity ops, investigations, loss prevention.',
  },
  {
    targetId: 'services',
    targetName: 'Personal Services',
    artifacts: ['Client', 'Appointment', 'ServiceType', 'Provider', 'ChildProfile', 'PortfolioItem'],
    engines: ['schedule-optimizer', 'reminder-generator', 'revenue-calculator', 'supply-checker'],
    pipelines: ['book → confirm → serve → follow-up', 'check-in → care → update → bill'],
    sources: [],
    rationale: 'Absorbs salon, cleaning, handyman, daycare, dog walking, tattoo studio.',
  },
  {
    targetId: 'insurance',
    targetName: 'Insurance & Risk',
    artifacts: ['Policy', 'Claim', 'Risk', 'Benefit', 'Renewal'],
    engines: ['coverage-gap-analyzer', 'premium-history-tracker', 'claim-status-aggregator', 'risk-scorer'],
    pipelines: ['identify-risk → insure → claim → resolve', 'renew → compare → decide → bind'],
    sources: [],
    rationale: 'Absorbs policy tracking, claims management, risk assessment, benefits administration.',
  },
];

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

  // 23 Super-Lenses (universal coverage)
  'healthcare', 'trades', 'food', 'retail', 'household', 'accounting',
  'agriculture', 'logistics', 'education', 'legal', 'nonprofit', 'realestate',
  'fitness', 'creative', 'manufacturing', 'environment', 'government',
  'aviation', 'events', 'science', 'security', 'services', 'insurance',

  // System (not in public nav but standalone)
  'admin', 'debug', 'audit', 'resonance', 'schema', 'integrations',
  'queue', 'tick', 'lock', 'offline', 'export', 'import', 'custom',
  'billing', 'crypto', 'fork', 'legacy',
] as const;

export type PostMergeStandaloneLens = typeof POST_MERGE_STANDALONE_LENSES[number];
