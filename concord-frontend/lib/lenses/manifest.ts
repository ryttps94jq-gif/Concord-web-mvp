/**
 * Lens Runtime Contract — Manifest Schema
 *
 * Each lens declares its domain, artifact types, macro mappings, supported exports,
 * and available actions. The generic UI shell can render library/editor/actions/DTU feed
 * panels from this manifest alone.
 *
 * Usage:
 *   import { LENS_MANIFESTS, getLensManifest } from '@/lib/lenses/manifest';
 *   const manifest = getLensManifest('music');
 */

export interface LensManifest {
  /** Unique domain identifier (e.g. 'music', 'finance', 'studio') */
  domain: string;
  /** Human-readable label */
  label: string;
  /** Artifact types this lens manages */
  artifacts: string[];
  /** Macro name mappings (follows lens.<domain>.* convention) */
  macros: {
    list: string;
    get: string;
    create?: string;
    update?: string;
    delete?: string;
    run?: string;
    export?: string;
  };
  /** Supported export formats */
  exports: string[];
  /** Domain-specific actions available via run */
  actions: string[];
  /** Category for grouping in UI */
  category: 'knowledge' | 'creative' | 'system' | 'social' | 'productivity' | 'finance'
          | 'healthcare' | 'trades' | 'operations' | 'agriculture' | 'government' | 'services';
}

// ---- Lens Manifests ----
// Each manifest declares the runtime contract for one lens domain.

export const LENS_MANIFESTS: LensManifest[] = [
  // === CORE ===
  {
    domain: 'chat',
    label: 'Chat',
    artifacts: ['conversation', 'message', 'session'],
    macros: { list: 'lens.chat.list', get: 'lens.chat.get', create: 'lens.chat.create', update: 'lens.chat.update', delete: 'lens.chat.delete', run: 'lens.chat.run', export: 'lens.chat.export' },
    exports: ['json', 'md', 'txt'],
    actions: ['send', 'summarize', 'branch', 'export_transcript'],
    category: 'knowledge',
  },
  {
    domain: 'code',
    label: 'Code',
    artifacts: ['file', 'snippet', 'project', 'workspace'],
    macros: { list: 'lens.code.list', get: 'lens.code.get', create: 'lens.code.create', update: 'lens.code.update', delete: 'lens.code.delete', run: 'lens.code.run', export: 'lens.code.export' },
    exports: ['json', 'zip', 'tar'],
    actions: ['execute', 'lint', 'format', 'refactor', 'diff'],
    category: 'knowledge',
  },

  // === CREATIVE ===
  {
    domain: 'music',
    label: 'Music',
    artifacts: ['track', 'playlist', 'artist', 'album'],
    macros: { list: 'lens.music.list', get: 'lens.music.get', create: 'lens.music.create', update: 'lens.music.update', delete: 'lens.music.delete', run: 'lens.music.run', export: 'lens.music.export' },
    exports: ['json', 'csv', 'm3u'],
    actions: ['analyze', 'render', 'publish', 'export_stems', 'generate_arrangement'],
    category: 'creative',
  },
  {
    domain: 'studio',
    label: 'Studio',
    artifacts: ['project', 'track', 'effect', 'instrument'],
    macros: { list: 'lens.studio.list', get: 'lens.studio.get', create: 'lens.studio.create', update: 'lens.studio.update', delete: 'lens.studio.delete', run: 'lens.studio.run', export: 'lens.studio.export' },
    exports: ['json'],
    actions: ['mix', 'master', 'bounce', 'render'],
    category: 'creative',
  },
  {
    domain: 'voice',
    label: 'Voice',
    artifacts: ['take', 'effect', 'preset', 'transcript', 'voice_note'],
    macros: { list: 'lens.voice.list', get: 'lens.voice.get', create: 'lens.voice.create', update: 'lens.voice.update', delete: 'lens.voice.delete', run: 'lens.voice.run', export: 'lens.voice.export' },
    exports: ['json', 'csv', 'txt'],
    actions: ['transcribe', 'process', 'analyze', 'summarize', 'extract_tasks'],
    category: 'creative',
  },
  {
    domain: 'art',
    label: 'Art',
    artifacts: ['artwork', 'collection', 'style'],
    macros: { list: 'lens.art.list', get: 'lens.art.get', create: 'lens.art.create', update: 'lens.art.update', run: 'lens.art.run', export: 'lens.art.export' },
    exports: ['json'],
    actions: ['generate', 'remix', 'analyze'],
    category: 'creative',
  },

  // === PRODUCTIVITY ===
  {
    domain: 'calendar',
    label: 'Calendar',
    artifacts: ['event', 'category', 'project', 'recurrence'],
    macros: { list: 'lens.calendar.list', get: 'lens.calendar.get', create: 'lens.calendar.create', update: 'lens.calendar.update', delete: 'lens.calendar.delete', run: 'lens.calendar.run', export: 'lens.calendar.export' },
    exports: ['json', 'ics', 'csv'],
    actions: ['schedule', 'remind', 'plan_day', 'plan_week', 'resolve_conflicts'],
    category: 'productivity',
  },
  {
    domain: 'daily',
    label: 'Daily',
    artifacts: ['entry', 'session', 'reminder', 'clip', 'insight'],
    macros: { list: 'lens.daily.list', get: 'lens.daily.get', create: 'lens.daily.create', update: 'lens.daily.update', delete: 'lens.daily.delete', run: 'lens.daily.run', export: 'lens.daily.export' },
    exports: ['json', 'csv', 'md'],
    actions: ['summarize', 'analyze', 'detect_patterns', 'generate_insights'],
    category: 'productivity',
  },
  {
    domain: 'goals',
    label: 'Goals',
    artifacts: ['goal', 'challenge', 'milestone', 'achievement'],
    macros: { list: 'lens.goals.list', get: 'lens.goals.get', create: 'lens.goals.create', update: 'lens.goals.update', run: 'lens.goals.run', export: 'lens.goals.export' },
    exports: ['json'],
    actions: ['evaluate', 'activate', 'complete'],
    category: 'productivity',
  },
  {
    domain: 'srs',
    label: 'SRS',
    artifacts: ['deck', 'card', 'review_log'],
    macros: { list: 'lens.srs.list', get: 'lens.srs.get', create: 'lens.srs.create', update: 'lens.srs.update', delete: 'lens.srs.delete', run: 'lens.srs.run', export: 'lens.srs.export' },
    exports: ['json', 'csv', 'anki'],
    actions: ['review', 'schedule', 'optimize_intervals', 'generate_cards_from_dtus'],
    category: 'productivity',
  },

  // === SOCIAL ===
  {
    domain: 'forum',
    label: 'Forum',
    artifacts: ['post', 'comment', 'community', 'tag'],
    macros: { list: 'lens.forum.list', get: 'lens.forum.get', create: 'lens.forum.create', update: 'lens.forum.update', delete: 'lens.forum.delete', run: 'lens.forum.run', export: 'lens.forum.export' },
    exports: ['json', 'csv', 'rss'],
    actions: ['vote', 'pin', 'moderate', 'rank_posts', 'extract_thesis', 'generate_summary_dtu'],
    category: 'social',
  },
  {
    domain: 'collab',
    label: 'Collab',
    artifacts: ['session', 'participant', 'change', 'decision'],
    macros: { list: 'lens.collab.list', get: 'lens.collab.get', create: 'lens.collab.create', update: 'lens.collab.update', delete: 'lens.collab.delete', run: 'lens.collab.run', export: 'lens.collab.export' },
    exports: ['json', 'csv'],
    actions: ['merge', 'lock', 'unlock', 'summarize_thread', 'run_council', 'extract_actions'],
    category: 'social',
  },
  {
    domain: 'feed',
    label: 'Feed',
    artifacts: ['post', 'author', 'interaction', 'topic'],
    macros: { list: 'lens.feed.list', get: 'lens.feed.get', create: 'lens.feed.create', update: 'lens.feed.update', delete: 'lens.feed.delete', run: 'lens.feed.run', export: 'lens.feed.export' },
    exports: ['json', 'csv', 'rss'],
    actions: ['like', 'repost', 'bookmark', 'rank', 'personalize', 'cluster_topics'],
    category: 'social',
  },
  {
    domain: 'experience',
    label: 'Experience',
    artifacts: ['portfolio', 'skill', 'history', 'insight', 'credential'],
    macros: { list: 'lens.experience.list', get: 'lens.experience.get', create: 'lens.experience.create', update: 'lens.experience.update', delete: 'lens.experience.delete', run: 'lens.experience.run', export: 'lens.experience.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['endorse', 'analyze', 'generate_resume', 'compare_versions', 'validate_claims'],
    category: 'social',
  },

  // === FINANCE ===
  {
    domain: 'finance',
    label: 'Finance',
    artifacts: ['asset', 'transaction', 'order', 'alert', 'portfolio', 'report'],
    macros: { list: 'lens.finance.list', get: 'lens.finance.get', create: 'lens.finance.create', update: 'lens.finance.update', delete: 'lens.finance.delete', run: 'lens.finance.run', export: 'lens.finance.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['trade', 'analyze', 'alert', 'simulate', 'generate_report'],
    category: 'finance',
  },
  {
    domain: 'marketplace',
    label: 'Marketplace',
    artifacts: ['listing', 'purchase', 'review', 'license'],
    macros: { list: 'lens.marketplace.list', get: 'lens.marketplace.get', create: 'lens.marketplace.create', update: 'lens.marketplace.update', delete: 'lens.marketplace.delete', run: 'lens.marketplace.run', export: 'lens.marketplace.export' },
    exports: ['json', 'csv'],
    actions: ['buy', 'sell', 'review', 'verify_artifact_hash', 'issue_license', 'distribute_royalties'],
    category: 'finance',
  },

  // === KNOWLEDGE ===
  {
    domain: 'ml',
    label: 'ML',
    artifacts: ['model', 'experiment', 'dataset', 'deployment', 'run_log'],
    macros: { list: 'lens.ml.list', get: 'lens.ml.get', create: 'lens.ml.create', update: 'lens.ml.update', delete: 'lens.ml.delete', run: 'lens.ml.run', export: 'lens.ml.export' },
    exports: ['json', 'csv', 'onnx'],
    actions: ['train', 'infer', 'deploy', 'evaluate', 'run_experiment', 'compare_runs', 'generate_report'],
    category: 'knowledge',
  },
  {
    domain: 'agents',
    label: 'Agents',
    artifacts: ['agent', 'role', 'task', 'deliberation', 'decision'],
    macros: { list: 'lens.agents.list', get: 'lens.agents.get', create: 'lens.agents.create', update: 'lens.agents.update', delete: 'lens.agents.delete', run: 'lens.agents.run', export: 'lens.agents.export' },
    exports: ['json'],
    actions: ['start', 'stop', 'reset', 'configure', 'deliberate', 'arbitrate'],
    category: 'knowledge',
  },
  {
    domain: 'thread',
    label: 'Thread',
    artifacts: ['thread', 'node', 'decision'],
    macros: { list: 'lens.thread.list', get: 'lens.thread.get', create: 'lens.thread.create', update: 'lens.thread.update', delete: 'lens.thread.delete', run: 'lens.thread.run', export: 'lens.thread.export' },
    exports: ['json', 'csv', 'md'],
    actions: ['branch', 'merge', 'summarize', 'detect_consensus', 'extract_decisions'],
    category: 'knowledge',
  },
  {
    domain: 'paper',
    label: 'Paper',
    artifacts: ['project', 'claim', 'hypothesis', 'evidence', 'experiment', 'synthesis'],
    macros: { list: 'lens.paper.list', get: 'lens.paper.get', create: 'lens.paper.create', update: 'lens.paper.update', delete: 'lens.paper.delete', run: 'lens.paper.run', export: 'lens.paper.export' },
    exports: ['json', 'md'],
    actions: ['validate', 'synthesize', 'detect-contradictions', 'trace-lineage'],
    category: 'knowledge',
  },
  {
    domain: 'reasoning',
    label: 'Reasoning',
    artifacts: ['chain', 'premise', 'inference', 'conclusion'],
    macros: { list: 'lens.reasoning.list', get: 'lens.reasoning.get', create: 'lens.reasoning.create', update: 'lens.reasoning.update', delete: 'lens.reasoning.delete', run: 'lens.reasoning.run', export: 'lens.reasoning.export' },
    exports: ['json'],
    actions: ['validate', 'trace', 'conclude', 'fork'],
    category: 'knowledge',
  },
  {
    domain: 'graph',
    label: 'Graph',
    artifacts: ['entity', 'relation', 'assertion', 'source'],
    macros: { list: 'lens.graph.list', get: 'lens.graph.get', create: 'lens.graph.create', update: 'lens.graph.update', delete: 'lens.graph.delete', run: 'lens.graph.run', export: 'lens.graph.export' },
    exports: ['json', 'csv', 'graphml'],
    actions: ['query', 'cluster', 'analyze', 'merge'],
    category: 'knowledge',
  },

  // === GOVERNANCE ===
  {
    domain: 'council',
    label: 'Council',
    artifacts: ['proposal', 'vote', 'budget', 'project', 'audit'],
    macros: { list: 'lens.council.list', get: 'lens.council.get', create: 'lens.council.create', update: 'lens.council.update', delete: 'lens.council.delete', run: 'lens.council.run', export: 'lens.council.export' },
    exports: ['json', 'csv'],
    actions: ['debate', 'vote', 'simulate-budget', 'audit'],
    category: 'social',
  },
  {
    domain: 'law',
    label: 'Law',
    artifacts: ['case', 'clause', 'draft', 'precedent'],
    macros: { list: 'lens.law.list', get: 'lens.law.get', create: 'lens.law.create', update: 'lens.law.update', delete: 'lens.law.delete', run: 'lens.law.run', export: 'lens.law.export' },
    exports: ['json', 'md'],
    actions: ['check-compliance', 'analyze', 'draft', 'cite'],
    category: 'social',
  },

  // === SIMULATION ===
  {
    domain: 'sim',
    label: 'Sim',
    artifacts: ['scenario', 'assumption', 'run', 'outcome'],
    macros: { list: 'lens.sim.list', get: 'lens.sim.get', create: 'lens.sim.create', update: 'lens.sim.update', delete: 'lens.sim.delete', run: 'lens.sim.run', export: 'lens.sim.export' },
    exports: ['json', 'csv'],
    actions: ['simulate', 'analyze', 'compare', 'archive'],
    category: 'system',
  },

  // === COLLABORATION ===
  {
    domain: 'whiteboard',
    label: 'Whiteboard',
    artifacts: ['board', 'element', 'connection', 'comment'],
    macros: { list: 'lens.whiteboard.list', get: 'lens.whiteboard.get', create: 'lens.whiteboard.create', update: 'lens.whiteboard.update', delete: 'lens.whiteboard.delete', run: 'lens.whiteboard.run', export: 'lens.whiteboard.export' },
    exports: ['json', 'png', 'svg'],
    actions: ['render', 'layout', 'collaborate', 'snapshot'],
    category: 'creative',
  },

  // === SYSTEM ===
  {
    domain: 'database',
    label: 'Database',
    artifacts: ['query', 'snapshot', 'table', 'view'],
    macros: { list: 'lens.database.list', get: 'lens.database.get', create: 'lens.database.create', update: 'lens.database.update', delete: 'lens.database.delete', run: 'lens.database.run', export: 'lens.database.export' },
    exports: ['json', 'csv', 'sql'],
    actions: ['query', 'analyze', 'optimize', 'schema-inspect'],
    category: 'system',
  },
  {
    domain: 'game',
    label: 'Game',
    artifacts: ['achievement', 'quest', 'skill', 'profile', 'game_state', 'reward_event'],
    macros: { list: 'lens.game.list', get: 'lens.game.get', create: 'lens.game.create', update: 'lens.game.update', delete: 'lens.game.delete', run: 'lens.game.run', export: 'lens.game.export' },
    exports: ['json', 'csv'],
    actions: ['complete', 'claim', 'levelup', 'simulate', 'resolve_turn', 'balance'],
    category: 'system',
  },
  {
    domain: 'resonance',
    label: 'Resonance',
    artifacts: ['alert', 'metric'],
    macros: { list: 'lens.resonance.list', get: 'lens.resonance.get', update: 'lens.resonance.update' },
    exports: ['json'],
    actions: ['acknowledge', 'dismiss'],
    category: 'system',
  },

  // ═══════════════════════════════════════════════════════════════
  // SUPER-LENSES — Universal coverage across all human work
  // ═══════════════════════════════════════════════════════════════

  // === HEALTHCARE ===
  {
    domain: 'healthcare',
    label: 'Healthcare',
    artifacts: ['Patient', 'Encounter', 'CareProtocol', 'Prescription', 'LabResult', 'Treatment'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['checkInteractions', 'protocolMatch', 'generateSummary'],
    category: 'healthcare',
  },

  // === TRADES ===
  {
    domain: 'trades',
    label: 'Trades & Construction',
    artifacts: ['Job', 'Estimate', 'MaterialsList', 'Permit', 'Equipment', 'Client'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['calculateEstimate', 'scheduleInspection', 'materialsCost'],
    category: 'trades',
  },

  // === FOOD ===
  {
    domain: 'food',
    label: 'Food & Hospitality',
    artifacts: ['Recipe', 'Menu', 'InventoryItem', 'Booking', 'Batch', 'Shift'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['scaleRecipe', 'costPlate', 'spoilageCheck', 'pourCost'],
    category: 'operations',
  },

  // === RETAIL ===
  {
    domain: 'retail',
    label: 'Retail & Commerce',
    artifacts: ['Product', 'Order', 'Customer', 'Lead', 'Ticket', 'Display'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['reorderCheck', 'pipelineValue', 'customerLTV', 'slaStatus'],
    category: 'operations',
  },

  // === HOUSEHOLD ===
  {
    domain: 'household',
    label: 'Home & Family',
    artifacts: ['FamilyMember', 'MealPlan', 'Chore', 'MaintenanceItem', 'Pet', 'MajorEvent'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['generateGroceryList', 'maintenanceDue', 'choreRotation'],
    category: 'productivity',
  },

  // === ACCOUNTING ===
  {
    domain: 'accounting',
    label: 'Accounting & Finance',
    artifacts: ['Account', 'Transaction', 'Invoice', 'PayrollEntry', 'Budget', 'Property', 'TaxItem'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf', 'qbo'],
    actions: ['trialBalance', 'profitLoss', 'invoiceAging', 'budgetVariance', 'rentRoll'],
    category: 'finance',
  },

  // === AGRICULTURE ===
  {
    domain: 'agriculture',
    label: 'Agriculture & Farming',
    artifacts: ['Field', 'Crop', 'Animal', 'FarmEquipment', 'WaterSystem', 'Harvest', 'Certification'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['rotationPlan', 'yieldAnalysis', 'equipmentDue', 'waterSchedule'],
    category: 'agriculture',
  },

  // === LOGISTICS ===
  {
    domain: 'logistics',
    label: 'Transportation & Logistics',
    artifacts: ['Vehicle', 'Driver', 'Shipment', 'WarehouseItem', 'Route', 'ComplianceLog'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['optimizeRoute', 'hosCheck', 'maintenanceDue', 'inventoryAudit'],
    category: 'operations',
  },

  // === EDUCATION ===
  {
    domain: 'education',
    label: 'Education',
    artifacts: ['Student', 'Course', 'Assignment', 'Grade', 'LessonPlan', 'Certification'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['gradeCalculation', 'attendanceReport', 'progressTrack', 'scheduleConflict'],
    category: 'services',
  },

  // === LEGAL ===
  {
    domain: 'legal',
    label: 'Legal',
    artifacts: ['Case', 'Contract', 'ComplianceItem', 'Filing', 'IPAsset'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['deadlineCheck', 'contractRenewal', 'conflictCheck', 'complianceScore'],
    category: 'services',
  },

  // === NONPROFIT ===
  {
    domain: 'nonprofit',
    label: 'Nonprofit & Community',
    artifacts: ['Donor', 'Grant', 'Volunteer', 'Campaign', 'ImpactMetric', 'Member'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['donorRetention', 'grantReporting', 'volunteerMatch', 'campaignProgress'],
    category: 'social',
  },

  // === REALESTATE ===
  {
    domain: 'realestate',
    label: 'Real Estate',
    artifacts: ['Listing', 'Showing', 'Transaction', 'RentalUnit', 'Deal'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['capRate', 'cashFlow', 'closingTimeline', 'vacancyRate'],
    category: 'finance',
  },

  // === FITNESS ===
  {
    domain: 'fitness',
    label: 'Fitness & Wellness',
    artifacts: ['Client', 'Program', 'Workout', 'Class', 'Team', 'Athlete'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['progressionCalc', 'classUtilization', 'periodization', 'recruitProfile'],
    category: 'services',
  },

  // === CREATIVE PRODUCTION ===
  {
    domain: 'creative',
    label: 'Creative Production',
    artifacts: ['Project', 'Shoot', 'Asset', 'Episode', 'Collection', 'ClientProof'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['shotListGenerate', 'assetOrganize', 'budgetTrack', 'distributionChecklist'],
    category: 'creative',
  },

  // === MANUFACTURING ===
  {
    domain: 'manufacturing',
    label: 'Manufacturing',
    artifacts: ['WorkOrder', 'BOM', 'QCInspection', 'Machine', 'SafetyItem', 'Part'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['scheduleOptimize', 'bomCost', 'oeeCalculate', 'safetyRate'],
    category: 'operations',
  },

  // === ENVIRONMENT ===
  {
    domain: 'environment',
    label: 'Environmental & Outdoors',
    artifacts: ['Site', 'Species', 'Survey', 'TrailAsset', 'EnvironmentalSample', 'WasteStream'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf', 'geojson'],
    actions: ['populationTrend', 'complianceCheck', 'trailCondition', 'diversionRate'],
    category: 'government',
  },

  // === GOVERNMENT ===
  {
    domain: 'government',
    label: 'Government & Public Service',
    artifacts: ['Permit', 'Project', 'Violation', 'EmergencyPlan', 'Record', 'CourtCase'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['permitTimeline', 'violationEscalation', 'resourceStaging', 'retentionCheck'],
    category: 'government',
  },

  // === AVIATION ===
  {
    domain: 'aviation',
    label: 'Aviation & Maritime',
    artifacts: ['Flight', 'Aircraft', 'Vessel', 'Slip', 'Charter', 'CrewMember'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['currencyCheck', 'maintenanceDue', 'hobbsLog', 'slipUtilization'],
    category: 'operations',
  },

  // === EVENTS ===
  {
    domain: 'events',
    label: 'Events & Entertainment',
    artifacts: ['Event', 'Venue', 'Performer', 'Tour', 'Production', 'Vendor'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['budgetReconcile', 'advanceSheet', 'techRiderMatch', 'settlementCalc'],
    category: 'creative',
  },

  // === SCIENCE ===
  {
    domain: 'science',
    label: 'Science & Field Work',
    artifacts: ['Expedition', 'Observation', 'Sample', 'LabProtocol', 'Analysis', 'Equipment'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf', 'geojson'],
    actions: ['chainOfCustody', 'calibrationCheck', 'dataExport', 'spatialCluster'],
    category: 'knowledge',
  },

  // === SECURITY ===
  {
    domain: 'security',
    label: 'Security',
    artifacts: ['Post', 'Incident', 'Patrol', 'Threat', 'Investigation', 'Asset'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['incidentTrend', 'patrolCoverage', 'threatMatrix', 'evidenceChain'],
    category: 'operations',
  },

  // === SERVICES ===
  {
    domain: 'services',
    label: 'Personal Services',
    artifacts: ['Client', 'Appointment', 'ServiceType', 'Provider', 'ChildProfile', 'PortfolioItem'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['scheduleOptimize', 'reminderGenerate', 'revenueByProvider', 'supplyCheck'],
    category: 'services',
  },

  // === INSURANCE ===
  {
    domain: 'insurance',
    label: 'Insurance & Risk',
    artifacts: ['Policy', 'Claim', 'Risk', 'Benefit', 'Renewal'],
    macros: { list: 'lens.list', get: 'lens.get', create: 'lens.create', update: 'lens.update', delete: 'lens.delete', run: 'lens.run', export: 'lens.export' },
    exports: ['json', 'csv', 'pdf'],
    actions: ['coverageGap', 'premiumHistory', 'claimStatus', 'riskScore'],
    category: 'finance',
  },
];

// ---- Lookup helpers ----

const _manifestMap = new Map(LENS_MANIFESTS.map(m => [m.domain, m]));

export function getLensManifest(domain: string): LensManifest | undefined {
  return _manifestMap.get(domain);
}

export function getLensManifests(category?: string): LensManifest[] {
  if (!category) return LENS_MANIFESTS;
  return LENS_MANIFESTS.filter(m => m.category === category);
}

export function getAllLensDomains(): string[] {
  return LENS_MANIFESTS.map(m => m.domain);
}
