/**
 * Lens types for the Concord frontend.
 *
 * NOTE: The canonical source of truth for lens metadata is LENS_REGISTRY
 * in lib/lens-registry.ts. These types are kept for compatibility with
 * any backend DTOs or custom lens builder payloads.
 */

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
  | 'knowledge'
  | 'science'
  | 'creative'
  | 'governance'
  | 'ai'
  | 'system'
  | 'specialized';

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
