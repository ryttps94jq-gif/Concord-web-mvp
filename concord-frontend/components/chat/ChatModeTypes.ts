/**
 * ChatModeTypes — Shared types for the 5-mode Chat Rail system.
 *
 * Modes:
 *   welcome  — Greeting state (0 messages)
 *   assist   — Task-focused assistant
 *   explore  — Discovery and learning
 *   connect  — Social and collaboration
 *   chat     — Free-form conversation (legacy default)
 */

// ── Chat modes ──────────────────────────────────────────────────

export type ChatMode = 'welcome' | 'assist' | 'explore' | 'connect' | 'chat';

export interface ChatModeConfig {
  id: ChatMode;
  label: string;
  icon: string; // lucide-react icon name reference (used in selector)
  color: string; // neon-* color token
  description: string;
  placeholder: string;
}

export const CHAT_MODES: ChatModeConfig[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    icon: 'Sparkles',
    color: 'neon-cyan',
    description: 'Your personalized home',
    placeholder: 'Ask Concord anything...',
  },
  {
    id: 'assist',
    label: 'Assist',
    icon: 'Wrench',
    color: 'neon-blue',
    description: 'Task-focused assistant',
    placeholder: 'What task can I help with?',
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: 'Compass',
    color: 'neon-purple',
    description: 'Discover and learn',
    placeholder: 'What would you like to explore?',
  },
  {
    id: 'connect',
    label: 'Connect',
    icon: 'Users',
    color: 'neon-pink',
    description: 'Collaborate with others',
    placeholder: 'Start a collaborative message...',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: 'MessageSquare',
    color: 'neon-cyan',
    description: 'Free-form conversation',
    placeholder: 'Ask Concord anything...',
  },
];

// ── Proactive message types ────────────────────────────────────

export type ProactiveTrigger = 'time_based' | 'lens_navigation' | 'idle' | 'dtu_event';

export interface ProactiveMessage {
  id: string;
  trigger: ProactiveTrigger;
  content: string;
  actionLabel?: string;
  actionPayload?: string;
  dismissed: boolean;
  timestamp: string;
}

// ── Action button types ────────────────────────────────────────

export interface ActionButton {
  id: string;
  label: string;
  icon: string;
  action: string; // The action identifier (e.g., 'create_dtu', 'search', etc.)
  payload?: string; // Optional payload to send with the action
  variant?: 'primary' | 'secondary' | 'ghost';
}

// ── Cross-lens memory types ────────────────────────────────────

export interface LensTrailEntry {
  lens: string;
  enteredAt: string;
  messageCount: number;
}

export interface CrossLensMemoryState {
  trail: LensTrailEntry[];
  totalLensCount: number;
  memoryPreserved: boolean;
}
