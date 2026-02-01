// Lens types for the Concord frontend

export interface Lens {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  category: LensCategory;
  isBuiltIn: boolean;
  isActive: boolean;
  order: number;
  config?: LensConfig;
}

export type LensCategory =
  | 'core'
  | 'science'
  | 'creative'
  | 'governance'
  | 'specialized'
  | 'custom';

export interface LensConfig {
  layout?: 'default' | 'split' | 'full' | 'minimal';
  widgets?: LensWidget[];
  theme?: Partial<LensTheme>;
  permissions?: LensPermissions;
  settings?: Record<string, unknown>;
}

export interface LensWidget {
  id: string;
  type: string;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface LensTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

export interface LensPermissions {
  read: boolean;
  write: boolean;
  configure: boolean;
}

// Built-in lens definitions
export const BUILT_IN_LENSES: Omit<Lens, 'isActive' | 'order'>[] = [
  // Core lenses
  { id: 'chat', name: 'Chat', slug: 'chat', icon: '💬', description: 'Conversational AI interface', category: 'core', isBuiltIn: true },
  { id: 'thread', name: 'Thread', slug: 'thread', icon: '🧵', description: 'Threaded conversations', category: 'core', isBuiltIn: true },
  { id: 'code', name: 'Code', slug: 'code', icon: '💻', description: 'Code editor and execution', category: 'core', isBuiltIn: true },
  { id: 'graph', name: 'Graph', slug: 'graph', icon: '🕸️', description: 'Knowledge graph visualization', category: 'core', isBuiltIn: true },
  { id: 'resonance', name: 'Resonance', slug: 'resonance', icon: '📊', description: 'System health dashboard', category: 'core', isBuiltIn: true },

  // Governance lenses
  { id: 'council', name: 'Council', slug: 'council', icon: '🏛️', description: 'DTU governance', category: 'governance', isBuiltIn: true },
  { id: 'market', name: 'Market', slug: 'market', icon: '🏪', description: 'DTU marketplace', category: 'governance', isBuiltIn: true },
  { id: 'anon', name: 'Anon', slug: 'anon', icon: '👻', description: 'Anonymous messaging', category: 'governance', isBuiltIn: true },
  { id: 'questmarket', name: 'Questmarket', slug: 'questmarket', icon: '🎯', description: 'Bounty system', category: 'governance', isBuiltIn: true },

  // Science lenses
  { id: 'bio', name: 'Bio', slug: 'bio', icon: '🧬', description: 'Biology tools', category: 'science', isBuiltIn: true },
  { id: 'chem', name: 'Chem', slug: 'chem', icon: '⚗️', description: 'Chemistry tools', category: 'science', isBuiltIn: true },
  { id: 'physics', name: 'Physics', slug: 'physics', icon: '⚛️', description: 'Physics simulations', category: 'science', isBuiltIn: true },
  { id: 'ml', name: 'ML', slug: 'ml', icon: '🤖', description: 'Machine learning', category: 'science', isBuiltIn: true },

  // Creative lenses
  { id: 'music', name: 'Music', slug: 'music', icon: '🎵', description: 'Music creation', category: 'creative', isBuiltIn: true },
  { id: 'game', name: 'Game', slug: 'game', icon: '🎮', description: 'Game development', category: 'creative', isBuiltIn: true },
  { id: 'ar', name: 'AR', slug: 'ar', icon: '🥽', description: 'Augmented reality', category: 'creative', isBuiltIn: true },

  // Specialized lenses
  { id: 'lab', name: 'Lab', slug: 'lab', icon: '🔬', description: 'Experimentation', category: 'specialized', isBuiltIn: true },
  { id: 'paper', name: 'Paper', slug: 'paper', icon: '📄', description: 'Research papers', category: 'specialized', isBuiltIn: true },
  { id: 'docs', name: 'Docs', slug: 'docs', icon: '📚', description: 'Documentation', category: 'specialized', isBuiltIn: true },
  { id: 'board', name: 'Board', slug: 'board', icon: '📋', description: 'Kanban board', category: 'specialized', isBuiltIn: true },
  { id: 'calendar', name: 'Calendar', slug: 'calendar', icon: '📅', description: 'Calendar', category: 'specialized', isBuiltIn: true },
  { id: 'fractal', name: 'Fractal', slug: 'fractal', icon: '🌀', description: 'Fractal explorer', category: 'specialized', isBuiltIn: true },
  { id: 'finance', name: 'Finance', slug: 'finance', icon: '💰', description: 'Financial tools', category: 'specialized', isBuiltIn: true },
  { id: 'news', name: 'News', slug: 'news', icon: '📰', description: 'News aggregation', category: 'specialized', isBuiltIn: true },

  // Custom lens builder
  { id: 'custom', name: 'Custom', slug: 'custom', icon: '🔧', description: 'Custom lens builder', category: 'custom', isBuiltIn: true },
];

export const LENS_CATEGORIES: Record<LensCategory, { label: string; color: string }> = {
  core: { label: 'Core', color: 'text-neon-blue' },
  governance: { label: 'Governance', color: 'text-neon-purple' },
  science: { label: 'Science', color: 'text-neon-green' },
  creative: { label: 'Creative', color: 'text-neon-pink' },
  specialized: { label: 'Specialized', color: 'text-neon-cyan' },
  custom: { label: 'Custom', color: 'text-gray-400' },
};
