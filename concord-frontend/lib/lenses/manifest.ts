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
    artifacts: ['agent', 'memory', 'log'],
    macros: { list: 'lens.agents.list', get: 'lens.agents.get', create: 'lens.agents.create', update: 'lens.agents.update', run: 'lens.agents.run' },
    exports: ['json'],
    actions: ['start', 'stop', 'reset', 'configure'],
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

  // === SYSTEM ===
  {
    domain: 'database',
    label: 'Database',
    artifacts: ['query', 'snapshot'],
    macros: { list: 'lens.database.list', get: 'lens.database.get', create: 'lens.database.create', update: 'lens.database.update', run: 'lens.database.run', export: 'lens.database.export' },
    exports: ['json', 'csv'],
    actions: ['query', 'analyze', 'optimize'],
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
