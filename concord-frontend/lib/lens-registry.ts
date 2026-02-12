/**
 * Canonical Lens Registry — single source of truth for all lens metadata.
 *
 * Fixes FE-001 (discoverability), FE-007 (command palette), FE-008 (sidebar drift).
 *
 * Every lens route MUST have an entry here. The sidebar, command palette,
 * and route validation script all read from this registry.
 */

import {
  MessageSquare, MessageCircle, Code, FlaskConical, Store, FileText,
  Book, Layout, Calendar, Share2, Sparkles, Target, Activity, Users,
  User, Dna, Atom, Orbit, DollarSign, Gamepad2, Glasses, Newspaper,
  Music, Brain, Wand2, Hash, Rss, FolderGit2, Heart,
  Shield, Database, FileCode, Globe, Cpu,
  GitFork, Scale, Lock, Layers, Lightbulb, Microscope, Beaker,
  Compass, Terminal, Wallet, Eye, Workflow, BookOpen,
  Network, Headphones, Vote, PenTool, Boxes, Clock, Zap,
  Upload, Download, AlertTriangle, Rocket, Puzzle,
  type LucideIcon,
} from 'lucide-react';

export type LensCategory =
  | 'core'
  | 'knowledge'
  | 'science'
  | 'creative'
  | 'governance'
  | 'ai'
  | 'system'
  | 'specialized';

export interface LensEntry {
  /** Unique identifier matching the route directory name */
  id: string;
  /** Display name */
  name: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Short description for command palette / tooltips */
  description: string;
  /** Grouping category */
  category: LensCategory;
  /** Whether to show in sidebar navigation */
  showInSidebar: boolean;
  /** Whether to show in command palette */
  showInCommandPalette: boolean;
  /** Route path */
  path: string;
  /** Sort order within category (lower = higher) */
  order: number;
  /** Keywords for search */
  keywords?: string[];
}

/**
 * Complete lens registry. Every lens under app/lenses/ must be listed here.
 * New lenses should be added to this array — sidebar and command palette
 * are generated automatically.
 */
export const LENS_REGISTRY: LensEntry[] = [
  // ── Core ──────────────────────────────────────────────────────
  { id: 'chat', name: 'Chat', icon: MessageSquare, description: 'Conversational AI interface', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/chat', order: 1, keywords: ['message', 'talk', 'ai'] },
  { id: 'thread', name: 'Thread', icon: MessageCircle, description: 'Threaded conversations', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/thread', order: 2, keywords: ['conversation', 'discussion'] },
  { id: 'code', name: 'Code', icon: Code, description: 'Code editor and execution', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/code', order: 3, keywords: ['editor', 'programming', 'dev'] },
  { id: 'graph', name: 'Graph', icon: Share2, description: 'Knowledge graph visualization', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/graph', order: 4, keywords: ['network', 'nodes', 'edges', 'knowledge'] },
  { id: 'resonance', name: 'Resonance', icon: Activity, description: 'System health dashboard', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/resonance', order: 5, keywords: ['health', 'metrics', 'status'] },
  { id: 'docs', name: 'Docs', icon: Book, description: 'Documentation viewer', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/docs', order: 6, keywords: ['documentation', 'reference', 'help'] },
  { id: 'paper', name: 'Paper', icon: FileText, description: 'Research paper editor', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/paper', order: 7, keywords: ['research', 'writing', 'academic'] },

  // ── Knowledge ─────────────────────────────────────────────────
  { id: 'forum', name: 'Forum', icon: Hash, description: 'Discussion forum', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/forum', order: 10, keywords: ['discuss', 'community'] },
  { id: 'feed', name: 'Feed', icon: Rss, description: 'RSS and content feed', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/feed', order: 11, keywords: ['rss', 'news', 'content'] },
  { id: 'repos', name: 'Repos', icon: FolderGit2, description: 'Repository browser', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/repos', order: 12, keywords: ['git', 'repository', 'source'] },
  { id: 'timeline', name: 'Timeline', icon: Heart, description: 'Chronological timeline', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/timeline', order: 13, keywords: ['history', 'chronological'] },
  { id: 'board', name: 'Board', icon: Layout, description: 'Kanban board', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/board', order: 14, keywords: ['kanban', 'tasks', 'project'] },
  { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Calendar and scheduling', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/calendar', order: 15, keywords: ['schedule', 'events', 'dates'] },
  { id: 'daily', name: 'Daily', icon: BookOpen, description: 'Daily notes and journal', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/daily', order: 16, keywords: ['journal', 'notes', 'diary'] },
  { id: 'goals', name: 'Goals', icon: Target, description: 'Goal tracking and planning', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/goals', order: 17, keywords: ['objectives', 'planning', 'targets'] },
  { id: 'srs', name: 'SRS', icon: Layers, description: 'Spaced repetition study', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/srs', order: 18, keywords: ['study', 'flashcards', 'memory'] },
  { id: 'whiteboard', name: 'Whiteboard', icon: PenTool, description: 'Freeform whiteboard', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/whiteboard', order: 19, keywords: ['draw', 'diagram', 'sketch'] },
  { id: 'news', name: 'News', icon: Newspaper, description: 'News aggregation', category: 'knowledge', showInSidebar: true, showInCommandPalette: true, path: '/lenses/news', order: 20, keywords: ['articles', 'headlines'] },

  // ── Science ───────────────────────────────────────────────────
  { id: 'bio', name: 'Bio', icon: Dna, description: 'Biology tools', category: 'science', showInSidebar: true, showInCommandPalette: true, path: '/lenses/bio', order: 30, keywords: ['biology', 'genetics', 'life'] },
  { id: 'chem', name: 'Chem', icon: Atom, description: 'Chemistry tools', category: 'science', showInSidebar: true, showInCommandPalette: true, path: '/lenses/chem', order: 31, keywords: ['chemistry', 'molecules', 'elements'] },
  { id: 'physics', name: 'Physics', icon: Orbit, description: 'Physics simulations', category: 'science', showInSidebar: true, showInCommandPalette: true, path: '/lenses/physics', order: 32, keywords: ['simulation', 'mechanics', 'quantum'] },
  { id: 'math', name: 'Math', icon: Compass, description: 'Mathematics tools', category: 'science', showInSidebar: true, showInCommandPalette: true, path: '/lenses/math', order: 33, keywords: ['calculation', 'algebra', 'geometry'] },
  { id: 'quantum', name: 'Quantum', icon: Cpu, description: 'Quantum computing explorer', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/quantum', order: 34, keywords: ['qubit', 'quantum computing'] },
  { id: 'neuro', name: 'Neuro', icon: Network, description: 'Neuroscience tools', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/neuro', order: 35, keywords: ['brain', 'neuroscience', 'neural'] },

  // ── Creative ──────────────────────────────────────────────────
  { id: 'music', name: 'Music', icon: Music, description: 'Music creation tools', category: 'creative', showInSidebar: true, showInCommandPalette: true, path: '/lenses/music', order: 40, keywords: ['audio', 'composition', 'sound'] },
  { id: 'game', name: 'Game', icon: Gamepad2, description: 'Game development', category: 'creative', showInSidebar: true, showInCommandPalette: true, path: '/lenses/game', order: 41, keywords: ['gaming', 'development'] },
  { id: 'ar', name: 'AR', icon: Glasses, description: 'Augmented reality', category: 'creative', showInSidebar: true, showInCommandPalette: true, path: '/lenses/ar', order: 42, keywords: ['augmented reality', 'webxr', '3d'] },
  { id: 'fractal', name: 'Fractal', icon: Sparkles, description: 'Fractal explorer', category: 'creative', showInSidebar: true, showInCommandPalette: true, path: '/lenses/fractal', order: 43, keywords: ['visualization', 'patterns', 'generative'] },
  { id: 'sim', name: 'Sim', icon: Boxes, description: 'Simulation sandbox', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/sim', order: 44, keywords: ['simulation', 'sandbox', 'worldmodel'] },

  // ── Governance ────────────────────────────────────────────────
  { id: 'council', name: 'Council', icon: Users, description: 'DTU governance council', category: 'governance', showInSidebar: true, showInCommandPalette: true, path: '/lenses/council', order: 50, keywords: ['vote', 'governance', 'decisions'] },
  { id: 'market', name: 'Market', icon: Store, description: 'DTU marketplace', category: 'governance', showInSidebar: true, showInCommandPalette: true, path: '/lenses/market', order: 51, keywords: ['trade', 'exchange'] },
  { id: 'marketplace', name: 'Marketplace', icon: Store, description: 'Plugin marketplace', category: 'governance', showInSidebar: true, showInCommandPalette: true, path: '/lenses/marketplace', order: 52, keywords: ['plugins', 'extensions', 'store'] },
  { id: 'questmarket', name: 'Questmarket', icon: Target, description: 'Bounty and quest system', category: 'governance', showInSidebar: true, showInCommandPalette: true, path: '/lenses/questmarket', order: 53, keywords: ['bounty', 'quest', 'rewards'] },
  { id: 'anon', name: 'Anon', icon: User, description: 'Anonymous messaging', category: 'governance', showInSidebar: true, showInCommandPalette: true, path: '/lenses/anon', order: 54, keywords: ['anonymous', 'private'] },
  { id: 'vote', name: 'Vote', icon: Vote, description: 'Voting system', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/vote', order: 55, keywords: ['poll', 'election', 'ballot'] },
  { id: 'ethics', name: 'Ethics', icon: Scale, description: 'Ethics and alignment review', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/ethics', order: 56, keywords: ['alignment', 'values', 'moral'] },
  { id: 'alliance', name: 'Alliance', icon: Users, description: 'Alliance management', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/alliance', order: 57, keywords: ['group', 'collaboration', 'team'] },
  { id: 'billing', name: 'Billing', icon: Wallet, description: 'Billing and credits', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/billing', order: 58, keywords: ['payment', 'credits', 'wallet'] },
  { id: 'crypto', name: 'Crypto', icon: Lock, description: 'Cryptography tools', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/crypto', order: 59, keywords: ['encryption', 'keys', 'security'] },

  // ── AI ────────────────────────────────────────────────────────
  { id: 'ml', name: 'ML', icon: Brain, description: 'Machine learning tools', category: 'ai', showInSidebar: true, showInCommandPalette: true, path: '/lenses/ml', order: 60, keywords: ['machine learning', 'training', 'models'] },
  { id: 'agents', name: 'Agents', icon: Cpu, description: 'AI agent management', category: 'ai', showInSidebar: true, showInCommandPalette: true, path: '/lenses/agents', order: 61, keywords: ['autonomous', 'bot', 'agent'] },
  { id: 'reasoning', name: 'Reasoning', icon: Lightbulb, description: 'Reasoning chain builder', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/reasoning', order: 62, keywords: ['logic', 'inference', 'chain'] },
  { id: 'hypothesis', name: 'Hypothesis', icon: Beaker, description: 'Hypothesis testing', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/hypothesis', order: 63, keywords: ['test', 'experiment', 'theory'] },
  { id: 'inference', name: 'Inference', icon: Workflow, description: 'Inference engine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/inference', order: 64, keywords: ['deduce', 'rules', 'facts'] },
  { id: 'metacognition', name: 'Metacognition', icon: Eye, description: 'Self-awareness monitoring', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/metacognition', order: 65, keywords: ['awareness', 'introspection', 'calibration'] },
  { id: 'metalearning', name: 'Metalearning', icon: Rocket, description: 'Learning strategy optimization', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/metalearning', order: 66, keywords: ['strategy', 'optimization', 'learning'] },
  { id: 'reflection', name: 'Reflection', icon: Microscope, description: 'Self-reflection engine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/reflection', order: 67, keywords: ['reflect', 'introspect', 'insight'] },
  { id: 'affect', name: 'Affect', icon: Heart, description: 'Affect translation spine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/affect', order: 68, keywords: ['emotion', 'sentiment', 'feeling'] },
  { id: 'attention', name: 'Attention', icon: Zap, description: 'Attention management', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/attention', order: 69, keywords: ['focus', 'priority', 'thread'] },
  { id: 'commonsense', name: 'Commonsense', icon: Lightbulb, description: 'Commonsense knowledge base', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/commonsense', order: 70, keywords: ['facts', 'knowledge', 'common'] },
  { id: 'transfer', name: 'Transfer', icon: Share2, description: 'Transfer learning', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/transfer', order: 71, keywords: ['analogy', 'pattern', 'domain'] },
  { id: 'grounding', name: 'Grounding', icon: Globe, description: 'Embodied cognition grounding', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/grounding', order: 72, keywords: ['sensor', 'embodied', 'real-world'] },
  { id: 'experience', name: 'Experience', icon: BookOpen, description: 'Experience learning', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/experience', order: 73, keywords: ['learn', 'memory', 'pattern'] },

  // ── System ────────────────────────────────────────────────────
  { id: 'admin', name: 'Admin', icon: Shield, description: 'System administration', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/admin', order: 80, keywords: ['settings', 'configuration', 'manage'] },
  { id: 'database', name: 'Database', icon: Database, description: 'Database explorer', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/database', order: 81, keywords: ['sql', 'data', 'tables'] },
  { id: 'debug', name: 'Debug', icon: Terminal, description: 'Debug console', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/debug', order: 82, keywords: ['console', 'logs', 'troubleshoot'] },
  { id: 'audit', name: 'Audit', icon: Eye, description: 'Audit log viewer', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/audit', order: 83, keywords: ['log', 'history', 'trail'] },
  { id: 'schema', name: 'Schema', icon: FileCode, description: 'Schema management', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/schema', order: 84, keywords: ['types', 'validation', 'structure'] },
  { id: 'integrations', name: 'Integrations', icon: Puzzle, description: 'Third-party integrations', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/integrations', order: 85, keywords: ['connect', 'api', 'external'] },
  { id: 'queue', name: 'Queue', icon: Layers, description: 'Job queue monitor', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/queue', order: 86, keywords: ['jobs', 'workers', 'background'] },
  { id: 'tick', name: 'Tick', icon: Clock, description: 'System tick monitor', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/tick', order: 87, keywords: ['heartbeat', 'pulse', 'cycle'] },
  { id: 'lock', name: 'Lock', icon: Lock, description: 'Sovereignty lock status', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/lock', order: 88, keywords: ['sovereignty', '70%', 'control'] },
  { id: 'offline', name: 'Offline', icon: Download, description: 'Offline data manager', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/offline', order: 89, keywords: ['local', 'sync', 'cache'] },
  { id: 'platform', name: 'Platform', icon: Activity, description: 'Mega platform dashboard — pipeline, empirical gates, nerve center, scopes', category: 'system', showInSidebar: true, showInCommandPalette: true, path: '/lenses/platform', order: 79, keywords: ['pipeline', 'empirical', 'bridge', 'beacon', 'scope', 'nerve', 'monitor', 'dashboard', 'platform'] },

  // ── Specialized ───────────────────────────────────────────────
  { id: 'lab', name: 'Lab', icon: FlaskConical, description: 'Experimentation sandbox', category: 'specialized', showInSidebar: true, showInCommandPalette: true, path: '/lenses/lab', order: 90, keywords: ['experiment', 'test', 'sandbox'] },
  { id: 'finance', name: 'Finance', icon: DollarSign, description: 'Financial tools', category: 'specialized', showInSidebar: true, showInCommandPalette: true, path: '/lenses/finance', order: 91, keywords: ['money', 'investment', 'portfolio'] },
  { id: 'voice', name: 'Voice', icon: Headphones, description: 'Voice input and TTS', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/voice', order: 92, keywords: ['audio', 'speech', 'microphone'] },
  { id: 'collab', name: 'Collab', icon: Users, description: 'Real-time collaboration', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/collab', order: 93, keywords: ['collaborate', 'share', 'teamwork'] },
  { id: 'entity', name: 'Entity', icon: Boxes, description: 'World model entity browser', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/entity', order: 94, keywords: ['world', 'model', 'object'] },
  { id: 'temporal', name: 'Temporal', icon: Clock, description: 'Temporal reasoning', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/temporal', order: 95, keywords: ['time', 'chronology', 'sequence'] },
  { id: 'suffering', name: 'Suffering', icon: AlertTriangle, description: 'Suffering detection monitor', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/suffering', order: 96, keywords: ['harm', 'pain', 'wellbeing'] },
  { id: 'invariant', name: 'Invariant', icon: Shield, description: 'System invariant checker', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/invariant', order: 97, keywords: ['constraint', 'rule', 'check'] },
  { id: 'fork', name: 'Fork', icon: GitFork, description: 'DTU fork manager', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/fork', order: 98, keywords: ['branch', 'version', 'copy'] },
  { id: 'meta', name: 'Meta', icon: Eye, description: 'System meta-information', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/meta', order: 99, keywords: ['about', 'info', 'system'] },
  { id: 'eco', name: 'Eco', icon: Globe, description: 'Ecosystem overview', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/eco', order: 100, keywords: ['ecosystem', 'environment'] },
  { id: 'law', name: 'Law', icon: Scale, description: 'Legal and compliance tools', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/law', order: 101, keywords: ['legal', 'compliance', 'regulation'] },
  { id: 'legacy', name: 'Legacy', icon: Clock, description: 'Legacy data viewer', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/legacy', order: 102, keywords: ['old', 'archive', 'historical'] },
  { id: 'organ', name: 'Organ', icon: Workflow, description: 'Organization tools', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/organ', order: 103, keywords: ['organize', 'structure'] },
  { id: 'export', name: 'Export', icon: Upload, description: 'Data export', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/export', order: 104, keywords: ['download', 'backup'] },
  { id: 'import', name: 'Import', icon: Download, description: 'Data import', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/import', order: 105, keywords: ['upload', 'ingest'] },
  { id: 'custom', name: 'Custom', icon: Wand2, description: 'Custom lens builder', category: 'specialized', showInSidebar: true, showInCommandPalette: true, path: '/lenses/custom', order: 999, keywords: ['build', 'create', 'configure'] },
];

/** Category display configuration */
export const LENS_CATEGORIES: Record<LensCategory, { label: string; color: string }> = {
  core: { label: 'Core', color: 'text-neon-blue' },
  knowledge: { label: 'Knowledge', color: 'text-neon-cyan' },
  science: { label: 'Science', color: 'text-neon-green' },
  creative: { label: 'Creative', color: 'text-neon-pink' },
  governance: { label: 'Governance', color: 'text-neon-purple' },
  ai: { label: 'AI & Cognition', color: 'text-yellow-400' },
  system: { label: 'System', color: 'text-gray-400' },
  specialized: { label: 'Specialized', color: 'text-neon-cyan' },
};

// ── Derived accessors ──────────────────────────────────────────

/** Lenses visible in the sidebar, ordered. */
export function getSidebarLenses(): LensEntry[] {
  return LENS_REGISTRY
    .filter((l) => l.showInSidebar)
    .sort((a, b) => a.order - b.order);
}

/** Lenses available in the command palette, ordered. */
export function getCommandPaletteLenses(): LensEntry[] {
  return LENS_REGISTRY
    .filter((l) => l.showInCommandPalette)
    .sort((a, b) => a.order - b.order);
}

/** All lens IDs — used for build-time route validation. */
export function getAllLensIds(): string[] {
  return LENS_REGISTRY.map((l) => l.id);
}

/** Lookup a lens by id. */
export function getLensById(id: string): LensEntry | undefined {
  return LENS_REGISTRY.find((l) => l.id === id);
}

/** Lenses grouped by category, ordered. */
export function getLensesByCategory(): Record<LensCategory, LensEntry[]> {
  const grouped = {} as Record<LensCategory, LensEntry[]>;
  for (const cat of Object.keys(LENS_CATEGORIES) as LensCategory[]) {
    grouped[cat] = LENS_REGISTRY
      .filter((l) => l.category === cat)
      .sort((a, b) => a.order - b.order);
  }
  return grouped;
}
