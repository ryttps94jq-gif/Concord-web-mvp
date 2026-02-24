/**
 * Canonical Lens Registry — single source of truth for all lens metadata.
 *
 * Fixes FE-001 (discoverability), FE-007 (command palette), FE-008 (sidebar drift).
 * Implements FE-030: Core Lens Consolidation.
 *
 * Every lens route MUST have an entry here. The sidebar, command palette,
 * and route validation script all read from this registry.
 *
 * CONSOLIDATION MODEL:
 * Five core lenses (Chat, Board, Graph, Code, Studio) serve as primary
 * workspaces. Related lenses are "absorbed" into a core lens as sub-tabs,
 * keeping their routes but being navigable from within the parent.
 * Everything else is an Extension — hidden by default, discoverable on demand.
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
  Stethoscope, Wrench, UtensilsCrossed, ShoppingCart, Home,
  Calculator, Wheat, Truck, GraduationCap, Briefcase,
  HeartHandshake, Building2, Dumbbell, Palette, Factory,
  TreePine, Landmark, Plane, PartyPopper, FlaskRound,
  ShieldCheck, Scissors, Umbrella,
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
  | 'specialized'
  | 'superlens';

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
  /** If set, this lens is absorbed into the specified core lens as a sub-tab */
  coreLens?: CoreLensId;
  /** Display label when shown as a sub-tab inside a core lens */
  tabLabel?: string;
}

// ── Core Lens Consolidation ──────────────────────────────────────

/** The five primary workspace lenses */
export type CoreLensId = 'chat' | 'board' | 'graph' | 'code' | 'studio';

export interface CoreLensConfig {
  id: CoreLensId;
  name: string;
  icon: LucideIcon;
  description: string;
  tagline: string;
  path: string;
  color: string;
  /** IDs of lenses absorbed into this core lens */
  absorbedLensIds: string[];
}

/**
 * The 5 core lenses and their consolidation mapping.
 * Each core lens absorbs related lenses as sub-tabs/modes.
 */
export const CORE_LENSES: CoreLensConfig[] = [
  {
    id: 'chat',
    name: 'Chat',
    icon: MessageSquare,
    description: 'AI conversations, forums, governance discussions, and daily notes',
    tagline: 'Think out loud',
    path: '/lenses/chat',
    color: 'neon-cyan',
    absorbedLensIds: ['thread', 'forum', 'daily', 'council', 'anon', 'voice', 'feed', 'news'],
  },
  {
    id: 'board',
    name: 'Board',
    icon: Layout,
    description: 'Tasks, goals, calendar, timeline, and spaced repetition',
    tagline: 'Get things done',
    path: '/lenses/board',
    color: 'neon-purple',
    absorbedLensIds: ['goals', 'calendar', 'timeline', 'srs', 'whiteboard'],
  },
  {
    id: 'graph',
    name: 'Graph',
    icon: Share2,
    description: 'Knowledge graph, schemas, entities, and ecosystem mapping',
    tagline: 'Connect everything',
    path: '/lenses/graph',
    color: 'neon-green',
    absorbedLensIds: ['schema', 'entity', 'temporal', 'eco', 'meta'],
  },
  {
    id: 'code',
    name: 'Code',
    icon: Code,
    description: 'Editor, debugger, database explorer, and repository browser',
    tagline: 'Build and ship',
    path: '/lenses/code',
    color: 'neon-blue',
    absorbedLensIds: ['debug', 'database', 'repos'],
  },
  {
    id: 'studio',
    name: 'Studio',
    icon: Music,
    description: 'Music production, visual art, game dev, and creative tools',
    tagline: 'Create anything',
    path: '/lenses/studio',
    color: 'neon-pink',
    absorbedLensIds: ['music', 'art', 'fractal', 'game', 'sim', 'ar'],
  },
];

/** Set of all core lens IDs for quick lookup */
const CORE_LENS_IDS = new Set<string>(CORE_LENSES.map(c => c.id));

/** Map from absorbed lens ID to its parent core lens ID */
const ABSORPTION_MAP = new Map<string, CoreLensId>();
for (const core of CORE_LENSES) {
  for (const absorbedId of core.absorbedLensIds) {
    ABSORPTION_MAP.set(absorbedId, core.id);
  }
}

/**
 * Complete lens registry. Every lens under app/lenses/ must be listed here.
 * New lenses should be added to this array — sidebar and command palette
 * are generated automatically.
 */
export const LENS_REGISTRY: LensEntry[] = [
  // ── Platform ────────────────────────────────────────────────────
  { id: 'global', name: 'Global', icon: Globe, description: 'Browse all DTUs, artifacts, jobs, marketplace', category: 'core', showInSidebar: false, showInCommandPalette: true, path: '/global', order: 0, keywords: ['browse', 'all', 'truth', 'global', 'everything'] },
  { id: 'hub', name: 'Lens Hub', icon: Compass, description: 'Discover all lenses', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/hub', order: 0, keywords: ['all', 'lenses', 'discover', 'hub', 'browse'] },

  // ── Core 5 ──────────────────────────────────────────────────────
  { id: 'chat', name: 'Chat', icon: MessageSquare, description: 'AI conversations, forums, and daily notes', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/chat', order: 1, keywords: ['message', 'talk', 'ai', 'forum', 'daily'] },
  { id: 'board', name: 'Board', icon: Layout, description: 'Tasks, goals, calendar, and planning', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/board', order: 2, keywords: ['kanban', 'tasks', 'project', 'goals', 'calendar'] },
  { id: 'graph', name: 'Graph', icon: Share2, description: 'Knowledge graph and entity exploration', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/graph', order: 3, keywords: ['network', 'nodes', 'edges', 'knowledge', 'schema'] },
  { id: 'code', name: 'Code', icon: Code, description: 'Editor, debugger, and repository browser', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/code', order: 4, keywords: ['editor', 'programming', 'dev', 'debug', 'database'] },
  { id: 'studio', name: 'Studio', icon: Music, description: 'Music, art, game dev, and creative production', category: 'core', showInSidebar: true, showInCommandPalette: true, path: '/lenses/studio', order: 5, keywords: ['production', 'audio', 'mix', 'master', 'art', 'music'] },

  // ── Absorbed into Chat ──────────────────────────────────────────
  { id: 'thread', name: 'Threads', icon: MessageCircle, description: 'Threaded conversations', category: 'core', showInSidebar: false, showInCommandPalette: true, path: '/lenses/thread', order: 10, keywords: ['conversation', 'discussion'], coreLens: 'chat', tabLabel: 'Threads' },
  { id: 'forum', name: 'Forum', icon: Hash, description: 'Discussion forum', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/forum', order: 11, keywords: ['discuss', 'community'], coreLens: 'chat', tabLabel: 'Forum' },
  { id: 'daily', name: 'Daily', icon: BookOpen, description: 'Daily notes and journal', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/daily', order: 12, keywords: ['journal', 'notes', 'diary'], coreLens: 'chat', tabLabel: 'Daily' },
  { id: 'council', name: 'Council', icon: Users, description: 'DTU governance council', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/council', order: 13, keywords: ['vote', 'governance', 'decisions'], coreLens: 'chat', tabLabel: 'Governance' },
  { id: 'anon', name: 'Anon', icon: User, description: 'Anonymous messaging', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/anon', order: 14, keywords: ['anonymous', 'private'], coreLens: 'chat', tabLabel: 'Anonymous' },
  { id: 'voice', name: 'Voice', icon: Headphones, description: 'Voice input and TTS', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/voice', order: 15, keywords: ['audio', 'speech', 'microphone'], coreLens: 'chat', tabLabel: 'Voice' },
  { id: 'feed', name: 'Feed', icon: Rss, description: 'RSS and content feed', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/feed', order: 16, keywords: ['rss', 'news', 'content'], coreLens: 'chat', tabLabel: 'Feed' },
  { id: 'news', name: 'News', icon: Newspaper, description: 'News aggregation', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/news', order: 17, keywords: ['articles', 'headlines'], coreLens: 'chat', tabLabel: 'News' },

  // ── Absorbed into Board ─────────────────────────────────────────
  { id: 'goals', name: 'Goals', icon: Target, description: 'Goal tracking and planning', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/goals', order: 20, keywords: ['objectives', 'planning', 'targets'], coreLens: 'board', tabLabel: 'Goals' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, description: 'Calendar and scheduling', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/calendar', order: 21, keywords: ['schedule', 'events', 'dates'], coreLens: 'board', tabLabel: 'Calendar' },
  { id: 'timeline', name: 'Timeline', icon: Heart, description: 'Chronological timeline', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/timeline', order: 22, keywords: ['history', 'chronological'], coreLens: 'board', tabLabel: 'Timeline' },
  { id: 'srs', name: 'SRS', icon: Layers, description: 'Spaced repetition study', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/srs', order: 23, keywords: ['study', 'flashcards', 'memory'], coreLens: 'board', tabLabel: 'Study' },
  { id: 'whiteboard', name: 'Whiteboard', icon: PenTool, description: 'Freeform whiteboard', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/whiteboard', order: 24, keywords: ['draw', 'diagram', 'sketch'], coreLens: 'board', tabLabel: 'Whiteboard' },

  // ── Absorbed into Graph ─────────────────────────────────────────
  { id: 'schema', name: 'Schema', icon: FileCode, description: 'Schema management', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/schema', order: 30, keywords: ['types', 'validation', 'structure'], coreLens: 'graph', tabLabel: 'Schema' },
  { id: 'entity', name: 'Entity', icon: Boxes, description: 'World model entity browser', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/entity', order: 31, keywords: ['world', 'model', 'object'], coreLens: 'graph', tabLabel: 'Entities' },
  { id: 'temporal', name: 'Temporal', icon: Clock, description: 'Temporal reasoning', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/temporal', order: 32, keywords: ['time', 'chronology', 'sequence'], coreLens: 'graph', tabLabel: 'Temporal' },
  { id: 'eco', name: 'Eco', icon: Globe, description: 'Ecosystem overview', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/eco', order: 33, keywords: ['ecosystem', 'environment'], coreLens: 'graph', tabLabel: 'Ecosystem' },
  { id: 'meta', name: 'Meta', icon: Eye, description: 'System meta-information', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/meta', order: 34, keywords: ['about', 'info', 'system'], coreLens: 'graph', tabLabel: 'Meta' },

  // ── Absorbed into Code ──────────────────────────────────────────
  { id: 'debug', name: 'Debug', icon: Terminal, description: 'Debug console', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/debug', order: 40, keywords: ['console', 'logs', 'troubleshoot'], coreLens: 'code', tabLabel: 'Debug' },
  { id: 'database', name: 'Database', icon: Database, description: 'Database explorer', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/database', order: 41, keywords: ['sql', 'data', 'tables'], coreLens: 'code', tabLabel: 'Database' },
  { id: 'repos', name: 'Repos', icon: FolderGit2, description: 'Repository browser', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/repos', order: 42, keywords: ['git', 'repository', 'source'], coreLens: 'code', tabLabel: 'Repos' },

  // ── Absorbed into Studio ────────────────────────────────────────
  { id: 'music', name: 'Music', icon: Music, description: 'Music creation tools', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/music', order: 50, keywords: ['audio', 'composition', 'sound'], coreLens: 'studio', tabLabel: 'Music' },
  { id: 'art', name: 'Art', icon: Palette, description: 'Visual art creation and gallery', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/art', order: 51, keywords: ['artwork', 'gallery', 'visual', 'illustration'], coreLens: 'studio', tabLabel: 'Art' },
  { id: 'fractal', name: 'Fractal', icon: Sparkles, description: 'Fractal explorer', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/fractal', order: 52, keywords: ['visualization', 'patterns', 'generative'], coreLens: 'studio', tabLabel: 'Visuals' },
  { id: 'game', name: 'Game', icon: Gamepad2, description: 'Game development', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/game', order: 53, keywords: ['gaming', 'development'], coreLens: 'studio', tabLabel: 'Game' },
  { id: 'sim', name: 'Sim', icon: Boxes, description: 'Simulation sandbox', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/sim', order: 54, keywords: ['simulation', 'sandbox', 'worldmodel'], coreLens: 'studio', tabLabel: 'Simulation' },
  { id: 'ar', name: 'AR', icon: Glasses, description: 'Augmented reality', category: 'creative', showInSidebar: false, showInCommandPalette: true, path: '/lenses/ar', order: 55, keywords: ['augmented reality', 'webxr', '3d'], coreLens: 'studio', tabLabel: 'AR' },

  // ── Extensions: Platform & System ───────────────────────────────
  { id: 'resonance', name: 'Resonance', icon: Activity, description: 'System health dashboard', category: 'core', showInSidebar: false, showInCommandPalette: true, path: '/lenses/resonance', order: 100, keywords: ['health', 'metrics', 'status'] },
  { id: 'docs', name: 'Docs', icon: Book, description: 'Documentation viewer', category: 'core', showInSidebar: false, showInCommandPalette: true, path: '/lenses/docs', order: 101, keywords: ['documentation', 'reference', 'help'] },
  { id: 'paper', name: 'Paper', icon: FileText, description: 'Research paper editor', category: 'core', showInSidebar: false, showInCommandPalette: true, path: '/lenses/paper', order: 102, keywords: ['research', 'writing', 'academic'] },
  { id: 'platform', name: 'Platform', icon: Activity, description: 'Mega platform dashboard', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/platform', order: 103, keywords: ['pipeline', 'empirical', 'bridge', 'beacon', 'scope', 'nerve', 'monitor', 'dashboard', 'platform'] },
  { id: 'admin', name: 'Admin', icon: Shield, description: 'System administration', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/admin', order: 104, keywords: ['settings', 'configuration', 'manage'] },
  { id: 'audit', name: 'Audit', icon: Eye, description: 'Audit log viewer', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/audit', order: 105, keywords: ['log', 'history', 'trail'] },
  { id: 'integrations', name: 'Integrations', icon: Puzzle, description: 'Third-party integrations', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/integrations', order: 106, keywords: ['connect', 'api', 'external'] },
  { id: 'queue', name: 'Queue', icon: Layers, description: 'Job queue monitor', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/queue', order: 107, keywords: ['jobs', 'workers', 'background'] },
  { id: 'tick', name: 'Tick', icon: Clock, description: 'System tick monitor', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/tick', order: 108, keywords: ['heartbeat', 'pulse', 'cycle'] },
  { id: 'lock', name: 'Lock', icon: Lock, description: 'Sovereignty lock status', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/lock', order: 109, keywords: ['sovereignty', '70%', 'control'] },
  { id: 'offline', name: 'Offline', icon: Download, description: 'Offline data manager', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/offline', order: 110, keywords: ['local', 'sync', 'cache'] },

  // ── Extensions: Governance & Economy ────────────────────────────
  { id: 'market', name: 'Market', icon: Store, description: 'DTU marketplace', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/market', order: 120, keywords: ['trade', 'exchange'] },
  { id: 'marketplace', name: 'Marketplace', icon: Store, description: 'Plugin marketplace', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/marketplace', order: 121, keywords: ['plugins', 'extensions', 'store'] },
  { id: 'questmarket', name: 'Questmarket', icon: Target, description: 'Bounty and quest system', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/questmarket', order: 122, keywords: ['bounty', 'quest', 'rewards'] },
  { id: 'vote', name: 'Vote', icon: Vote, description: 'Voting system', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/vote', order: 123, keywords: ['poll', 'election', 'ballot'] },
  { id: 'ethics', name: 'Ethics', icon: Scale, description: 'Ethics and alignment review', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/ethics', order: 124, keywords: ['alignment', 'values', 'moral'] },
  { id: 'alliance', name: 'Alliance', icon: Users, description: 'Alliance management', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/alliance', order: 125, keywords: ['group', 'collaboration', 'team'] },
  { id: 'billing', name: 'Billing', icon: Wallet, description: 'Billing and credits', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/billing', order: 126, keywords: ['payment', 'credits', 'wallet'] },
  { id: 'crypto', name: 'Crypto', icon: Lock, description: 'Cryptography tools', category: 'governance', showInSidebar: false, showInCommandPalette: true, path: '/lenses/crypto', order: 127, keywords: ['encryption', 'keys', 'security'] },

  // ── Extensions: Science ─────────────────────────────────────────
  { id: 'bio', name: 'Bio', icon: Dna, description: 'Biology tools', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/bio', order: 130, keywords: ['biology', 'genetics', 'life'] },
  { id: 'chem', name: 'Chem', icon: Atom, description: 'Chemistry tools', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/chem', order: 131, keywords: ['chemistry', 'molecules', 'elements'] },
  { id: 'physics', name: 'Physics', icon: Orbit, description: 'Physics simulations', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/physics', order: 132, keywords: ['simulation', 'mechanics', 'quantum'] },
  { id: 'math', name: 'Math', icon: Compass, description: 'Mathematics tools', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/math', order: 133, keywords: ['calculation', 'algebra', 'geometry'] },
  { id: 'quantum', name: 'Quantum', icon: Cpu, description: 'Quantum computing explorer', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/quantum', order: 134, keywords: ['qubit', 'quantum computing'] },
  { id: 'neuro', name: 'Neuro', icon: Network, description: 'Neuroscience tools', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/neuro', order: 135, keywords: ['brain', 'neuroscience', 'neural'] },

  // ── Extensions: AI & Cognition ──────────────────────────────────
  { id: 'ml', name: 'ML', icon: Brain, description: 'Machine learning tools', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/ml', order: 140, keywords: ['machine learning', 'training', 'models'] },
  { id: 'agents', name: 'Agents', icon: Cpu, description: 'AI agent management', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/agents', order: 141, keywords: ['autonomous', 'bot', 'agent'] },
  { id: 'reasoning', name: 'Reasoning', icon: Lightbulb, description: 'Reasoning chain builder', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/reasoning', order: 142, keywords: ['logic', 'inference', 'chain'] },
  { id: 'hypothesis', name: 'Hypothesis', icon: Beaker, description: 'Hypothesis testing', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/hypothesis', order: 143, keywords: ['test', 'experiment', 'theory'] },
  { id: 'research', name: 'Research', icon: BookOpen, description: 'Full-text search across DTUs', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/research', order: 115, keywords: ['search', 'find', 'query', 'explore'] },
  { id: 'cri', name: 'CRI', icon: Activity, description: 'CRETI score analysis', category: 'knowledge', showInSidebar: false, showInCommandPalette: true, path: '/lenses/cri', order: 116, keywords: ['score', 'quality', 'creti', 'metrics'] },
  { id: 'ingest', name: 'Ingest', icon: Upload, description: 'Document ingestion & chunking', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/ingest', order: 171, keywords: ['upload', 'chunk', 'import', 'document'] },
  { id: 'inference', name: 'Inference', icon: Workflow, description: 'Inference engine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/inference', order: 144, keywords: ['deduce', 'rules', 'facts'] },
  { id: 'metacognition', name: 'Metacognition', icon: Eye, description: 'Self-awareness monitoring', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/metacognition', order: 145, keywords: ['awareness', 'introspection', 'calibration'] },
  { id: 'metalearning', name: 'Metalearning', icon: Rocket, description: 'Learning strategy optimization', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/metalearning', order: 146, keywords: ['strategy', 'optimization', 'learning'] },
  { id: 'reflection', name: 'Reflection', icon: Microscope, description: 'Self-reflection engine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/reflection', order: 147, keywords: ['reflect', 'introspect', 'insight'] },
  { id: 'affect', name: 'Affect', icon: Heart, description: 'Affect translation spine', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/affect', order: 148, keywords: ['emotion', 'sentiment', 'feeling'] },
  { id: 'attention', name: 'Attention', icon: Zap, description: 'Attention management', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/attention', order: 149, keywords: ['focus', 'priority', 'thread'] },
  { id: 'commonsense', name: 'Commonsense', icon: Lightbulb, description: 'Commonsense knowledge base', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/commonsense', order: 150, keywords: ['facts', 'knowledge', 'common'] },
  { id: 'transfer', name: 'Transfer', icon: Share2, description: 'Transfer learning', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/transfer', order: 151, keywords: ['analogy', 'pattern', 'domain'] },
  { id: 'grounding', name: 'Grounding', icon: Globe, description: 'Embodied cognition grounding', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/grounding', order: 152, keywords: ['sensor', 'embodied', 'real-world'] },
  { id: 'experience', name: 'Experience', icon: BookOpen, description: 'Experience learning', category: 'ai', showInSidebar: false, showInCommandPalette: true, path: '/lenses/experience', order: 153, keywords: ['learn', 'memory', 'pattern'] },

  // ── Extensions: Specialized ─────────────────────────────────────
  { id: 'lab', name: 'Lab', icon: FlaskConical, description: 'Experimentation sandbox', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/lab', order: 160, keywords: ['experiment', 'test', 'sandbox'] },
  { id: 'finance', name: 'Finance', icon: DollarSign, description: 'Financial tools', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/finance', order: 161, keywords: ['money', 'investment', 'portfolio'] },
  { id: 'collab', name: 'Collab', icon: Users, description: 'Real-time collaboration', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/collab', order: 162, keywords: ['collaborate', 'share', 'teamwork'] },
  { id: 'suffering', name: 'Suffering', icon: AlertTriangle, description: 'Suffering detection monitor', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/suffering', order: 163, keywords: ['harm', 'pain', 'wellbeing'] },
  { id: 'invariant', name: 'Invariant', icon: Shield, description: 'System invariant checker', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/invariant', order: 164, keywords: ['constraint', 'rule', 'check'] },
  { id: 'fork', name: 'Fork', icon: GitFork, description: 'DTU fork manager', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/fork', order: 165, keywords: ['branch', 'version', 'copy'] },
  { id: 'law', name: 'Law', icon: Scale, description: 'Legal and compliance tools', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/law', order: 166, keywords: ['legal', 'compliance', 'regulation'] },
  { id: 'legacy', name: 'Legacy', icon: Clock, description: 'Legacy data viewer', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/legacy', order: 167, keywords: ['old', 'archive', 'historical'] },
  { id: 'organ', name: 'Organ', icon: Workflow, description: 'Organization tools', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/organ', order: 168, keywords: ['organize', 'structure'] },
  { id: 'export', name: 'Export', icon: Upload, description: 'Data export', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/export', order: 169, keywords: ['download', 'backup'] },
  { id: 'import', name: 'Import', icon: Download, description: 'Data import', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/import', order: 170, keywords: ['upload', 'ingest'] },
  { id: 'custom', name: 'Custom', icon: Wand2, description: 'Custom lens builder', category: 'specialized', showInSidebar: false, showInCommandPalette: true, path: '/lenses/custom', order: 999, keywords: ['build', 'create', 'configure'] },

  // ── Extensions: Super-Lenses (industry domains) ────────────────
  { id: 'healthcare', name: 'Healthcare', icon: Stethoscope, description: 'Healthcare & clinical management', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/healthcare', order: 200, keywords: ['medical', 'clinical', 'patient', 'health'] },
  { id: 'trades', name: 'Trades', icon: Wrench, description: 'Trades & construction', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/trades', order: 201, keywords: ['construction', 'plumbing', 'electrical', 'contractor'] },
  { id: 'food', name: 'Food', icon: UtensilsCrossed, description: 'Food & hospitality', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/food', order: 202, keywords: ['restaurant', 'recipe', 'catering', 'kitchen'] },
  { id: 'retail', name: 'Retail', icon: ShoppingCart, description: 'Retail & commerce', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/retail', order: 203, keywords: ['store', 'inventory', 'pos', 'ecommerce'] },
  { id: 'household', name: 'Household', icon: Home, description: 'Home & family management', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/household', order: 204, keywords: ['family', 'home', 'chores', 'maintenance'] },
  { id: 'accounting', name: 'Accounting', icon: Calculator, description: 'Accounting & finance', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/accounting', order: 205, keywords: ['bookkeeping', 'invoicing', 'tax', 'payroll'] },
  { id: 'agriculture', name: 'Agriculture', icon: Wheat, description: 'Agriculture & farming', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/agriculture', order: 206, keywords: ['farming', 'crops', 'livestock', 'harvest'] },
  { id: 'logistics', name: 'Logistics', icon: Truck, description: 'Transportation & logistics', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/logistics', order: 207, keywords: ['shipping', 'fleet', 'warehouse', 'route'] },
  { id: 'education', name: 'Education', icon: GraduationCap, description: 'Education & learning', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/education', order: 208, keywords: ['school', 'student', 'course', 'teaching'] },
  { id: 'legal', name: 'Legal', icon: Briefcase, description: 'Legal & compliance', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/legal', order: 209, keywords: ['case', 'contract', 'compliance', 'filing'] },
  { id: 'nonprofit', name: 'Nonprofit', icon: HeartHandshake, description: 'Nonprofit & community', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/nonprofit', order: 210, keywords: ['donor', 'grant', 'volunteer', 'charity'] },
  { id: 'realestate', name: 'Real Estate', icon: Building2, description: 'Real estate management', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/realestate', order: 211, keywords: ['property', 'listing', 'tenant', 'mortgage'] },
  { id: 'fitness', name: 'Fitness', icon: Dumbbell, description: 'Fitness & wellness', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/fitness', order: 212, keywords: ['training', 'workout', 'gym', 'wellness'] },
  { id: 'creative', name: 'Creative Production', icon: Palette, description: 'Creative production', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/creative', order: 213, keywords: ['photography', 'video', 'design', 'production'] },
  { id: 'manufacturing', name: 'Manufacturing', icon: Factory, description: 'Manufacturing & production', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/manufacturing', order: 214, keywords: ['factory', 'assembly', 'quality', 'bom'] },
  { id: 'environment', name: 'Environment', icon: TreePine, description: 'Environmental & outdoors', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/environment', order: 215, keywords: ['ecology', 'wildlife', 'conservation', 'sustainability'] },
  { id: 'government', name: 'Government', icon: Landmark, description: 'Government & public service', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/government', order: 216, keywords: ['permit', 'public', 'emergency', 'records'] },
  { id: 'aviation', name: 'Aviation', icon: Plane, description: 'Aviation & maritime', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/aviation', order: 217, keywords: ['flight', 'pilot', 'vessel', 'charter'] },
  { id: 'events', name: 'Events', icon: PartyPopper, description: 'Events & entertainment', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/events', order: 218, keywords: ['venue', 'festival', 'concert', 'production'] },
  { id: 'science', name: 'Science', icon: FlaskRound, description: 'Science & field work', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/science', order: 219, keywords: ['expedition', 'lab', 'sample', 'research'] },
  { id: 'security', name: 'Security', icon: ShieldCheck, description: 'Security operations', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/security', order: 220, keywords: ['patrol', 'incident', 'surveillance', 'investigation'] },
  { id: 'services', name: 'Services', icon: Scissors, description: 'Personal services', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/services', order: 221, keywords: ['salon', 'cleaning', 'daycare', 'appointment'] },
  { id: 'insurance', name: 'Insurance', icon: Umbrella, description: 'Insurance & risk management', category: 'superlens', showInSidebar: false, showInCommandPalette: true, path: '/lenses/insurance', order: 222, keywords: ['policy', 'claim', 'premium', 'coverage'] },

  // ── New Cognitive System Lenses ──────────────────────────────────
  { id: 'lab', name: 'Lab', icon: FlaskConical, description: 'Adjacent reality explorer — constraint-based parameter space exploration', category: 'science', showInSidebar: false, showInCommandPalette: true, path: '/lenses/lab', order: 230, keywords: ['explore', 'adjacent', 'reality', 'constraints', 'physics', 'research'] },
  { id: 'app-maker', name: 'App Maker', icon: Boxes, description: 'Compose apps from existing primitives', category: 'system', showInSidebar: false, showInCommandPalette: true, path: '/lenses/app-maker', order: 231, keywords: ['app', 'maker', 'compose', 'primitives', 'builder'] },
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
  superlens: { label: 'Industry Domains', color: 'text-orange-400' },
};

// ── Derived accessors ──────────────────────────────────────────

/** The 5 core lenses for sidebar display. */
export function getCoreLenses(): LensEntry[] {
  return LENS_REGISTRY
    .filter((l) => CORE_LENS_IDS.has(l.id))
    .sort((a, b) => a.order - b.order);
}

/** Lenses absorbed into a specific core lens, ordered. */
export function getAbsorbedLenses(coreLensId: CoreLensId): LensEntry[] {
  return LENS_REGISTRY
    .filter((l) => l.coreLens === coreLensId)
    .sort((a, b) => a.order - b.order);
}

/** Extension lenses — not core and not absorbed into a core lens. */
export function getExtensionLenses(): LensEntry[] {
  return LENS_REGISTRY
    .filter((l) => !CORE_LENS_IDS.has(l.id) && !l.coreLens && l.id !== 'hub' && l.id !== 'global')
    .sort((a, b) => a.order - b.order);
}

/** Check if a lens is a core lens */
export function isCoreLens(id: string): boolean {
  return CORE_LENS_IDS.has(id);
}

/** Get the parent core lens for an absorbed lens */
export function getParentCoreLens(lensId: string): CoreLensId | undefined {
  return ABSORPTION_MAP.get(lensId);
}

/** Get core lens config by ID */
export function getCoreLensConfig(id: CoreLensId): CoreLensConfig | undefined {
  return CORE_LENSES.find(c => c.id === id);
}

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
