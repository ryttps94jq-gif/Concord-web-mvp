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
  category: 'knowledge' | 'creative' | 'system' | 'social' | 'productivity' | 'finance';
}

// ---- Lens Manifests ----
// Each manifest declares the runtime contract for one lens domain.

export const LENS_MANIFESTS: LensManifest[] = [
  // === CREATIVE ===
  {
    domain: 'music',
    label: 'Music',
    artifacts: ['track', 'playlist', 'artist'],
    macros: { list: 'lens.music.list', get: 'lens.music.get', create: 'lens.music.create', update: 'lens.music.update', delete: 'lens.music.delete', run: 'lens.music.run', export: 'lens.music.export' },
    exports: ['json'],
    actions: ['analyze', 'render', 'publish'],
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
    artifacts: ['take', 'effect', 'preset'],
    macros: { list: 'lens.voice.list', get: 'lens.voice.get', create: 'lens.voice.create', update: 'lens.voice.update', run: 'lens.voice.run', export: 'lens.voice.export' },
    exports: ['json'],
    actions: ['transcribe', 'process', 'analyze'],
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
    artifacts: ['event', 'category', 'project'],
    macros: { list: 'lens.calendar.list', get: 'lens.calendar.get', create: 'lens.calendar.create', update: 'lens.calendar.update', delete: 'lens.calendar.delete', export: 'lens.calendar.export' },
    exports: ['json', 'ics'],
    actions: ['schedule', 'remind'],
    category: 'productivity',
  },
  {
    domain: 'daily',
    label: 'Daily',
    artifacts: ['entry', 'session', 'reminder', 'clip'],
    macros: { list: 'lens.daily.list', get: 'lens.daily.get', create: 'lens.daily.create', update: 'lens.daily.update', export: 'lens.daily.export' },
    exports: ['json', 'csv'],
    actions: ['summarize', 'analyze'],
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
    artifacts: ['deck', 'card'],
    macros: { list: 'lens.srs.list', get: 'lens.srs.get', create: 'lens.srs.create', update: 'lens.srs.update', delete: 'lens.srs.delete', run: 'lens.srs.run', export: 'lens.srs.export' },
    exports: ['json', 'csv'],
    actions: ['review', 'schedule'],
    category: 'productivity',
  },

  // === SOCIAL ===
  {
    domain: 'forum',
    label: 'Forum',
    artifacts: ['post', 'comment', 'community'],
    macros: { list: 'lens.forum.list', get: 'lens.forum.get', create: 'lens.forum.create', update: 'lens.forum.update', run: 'lens.forum.run' },
    exports: ['json'],
    actions: ['vote', 'pin', 'moderate'],
    category: 'social',
  },
  {
    domain: 'collab',
    label: 'Collab',
    artifacts: ['session', 'participant', 'change'],
    macros: { list: 'lens.collab.list', get: 'lens.collab.get', create: 'lens.collab.create', update: 'lens.collab.update' },
    exports: ['json'],
    actions: ['merge', 'lock', 'unlock'],
    category: 'social',
  },
  {
    domain: 'feed',
    label: 'Feed',
    artifacts: ['post', 'author', 'interaction'],
    macros: { list: 'lens.feed.list', get: 'lens.feed.get', create: 'lens.feed.create', update: 'lens.feed.update' },
    exports: ['json'],
    actions: ['like', 'repost', 'bookmark'],
    category: 'social',
  },
  {
    domain: 'experience',
    label: 'Experience',
    artifacts: ['portfolio', 'skill', 'history', 'insight'],
    macros: { list: 'lens.experience.list', get: 'lens.experience.get', create: 'lens.experience.create', update: 'lens.experience.update', export: 'lens.experience.export' },
    exports: ['json'],
    actions: ['endorse', 'analyze'],
    category: 'social',
  },

  // === FINANCE ===
  {
    domain: 'finance',
    label: 'Finance',
    artifacts: ['asset', 'transaction', 'order', 'alert'],
    macros: { list: 'lens.finance.list', get: 'lens.finance.get', create: 'lens.finance.create', update: 'lens.finance.update', run: 'lens.finance.run', export: 'lens.finance.export' },
    exports: ['json', 'csv'],
    actions: ['trade', 'analyze', 'alert'],
    category: 'finance',
  },
  {
    domain: 'marketplace',
    label: 'Marketplace',
    artifacts: ['listing', 'purchase', 'review'],
    macros: { list: 'lens.marketplace.list', get: 'lens.marketplace.get', create: 'lens.marketplace.create', update: 'lens.marketplace.update', run: 'lens.marketplace.run' },
    exports: ['json'],
    actions: ['buy', 'sell', 'review'],
    category: 'finance',
  },

  // === KNOWLEDGE ===
  {
    domain: 'ml',
    label: 'ML',
    artifacts: ['model', 'experiment', 'dataset', 'deployment'],
    macros: { list: 'lens.ml.list', get: 'lens.ml.get', create: 'lens.ml.create', update: 'lens.ml.update', run: 'lens.ml.run', export: 'lens.ml.export' },
    exports: ['json'],
    actions: ['train', 'infer', 'deploy', 'evaluate'],
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
    artifacts: ['thread', 'node'],
    macros: { list: 'lens.thread.list', get: 'lens.thread.get', create: 'lens.thread.create', update: 'lens.thread.update' },
    exports: ['json'],
    actions: ['branch', 'merge', 'summarize'],
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
    artifacts: ['achievement', 'quest', 'skill', 'profile'],
    macros: { list: 'lens.game.list', get: 'lens.game.get', create: 'lens.game.create', update: 'lens.game.update', run: 'lens.game.run' },
    exports: ['json'],
    actions: ['complete', 'claim', 'levelup'],
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
