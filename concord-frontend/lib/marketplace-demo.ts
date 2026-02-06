/**
 * FE-006: Marketplace demo/mock data — strictly separated from real logic.
 *
 * This module contains ONLY demo fixtures used when the backend marketplace
 * API is unavailable. Components should check `isDemoMode()` before falling
 * back to this data, and render a visible "Demo Mode" indicator.
 */

export interface DemoPlugin {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  author: { name: string; avatar?: string; verified?: boolean };
  githubUrl?: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  featured?: boolean;
  trending?: boolean;
  price?: number;
  tags?: string[];
  permissions?: string[];
  changelog?: { version: string; date: string; changes: string[] }[];
  createdAt: string;
  updatedAt: string;
  weeklyDownloads?: number;
}

export interface DemoReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  helpful: number;
  createdAt: string;
}

export const DEMO_FEATURED: DemoPlugin[] = [
  {
    id: 'demo-feat-1',
    name: 'Notion Sync Pro',
    description: 'Seamlessly sync your DTUs with Notion databases. Bi-directional sync with conflict resolution.',
    category: 'integration',
    author: { name: 'Concord Labs', verified: true },
    version: '2.1.0',
    downloads: 12540,
    rating: 4.9,
    ratingCount: 342,
    status: 'approved',
    featured: true,
    tags: ['notion', 'sync', 'integration'],
    createdAt: '2025-01-15',
    updatedAt: '2026-01-20',
    weeklyDownloads: 1250,
  },
  {
    id: 'demo-feat-2',
    name: 'AI Knowledge Graph',
    description: 'Automatically generate knowledge graphs from your DTUs using advanced NLP models.',
    category: 'ai',
    author: { name: 'Neural Tools', verified: true },
    version: '1.5.2',
    downloads: 8920,
    rating: 4.8,
    ratingCount: 215,
    status: 'approved',
    featured: true,
    tags: ['ai', 'graph', 'nlp'],
    createdAt: '2025-03-10',
    updatedAt: '2026-01-18',
    weeklyDownloads: 890,
  },
  {
    id: 'demo-feat-3',
    name: 'Advanced Analytics',
    description: 'Deep analytics and insights for your knowledge base with customizable dashboards.',
    category: 'visualization',
    author: { name: 'DataViz Co', verified: true },
    version: '3.0.0',
    downloads: 15200,
    rating: 4.7,
    ratingCount: 428,
    status: 'approved',
    featured: true,
    tags: ['analytics', 'dashboard', 'charts'],
    createdAt: '2024-11-20',
    updatedAt: '2026-01-22',
    weeklyDownloads: 1520,
  },
];

export const DEMO_PLUGINS: DemoPlugin[] = [
  ...DEMO_FEATURED,
  {
    id: 'demo-plug-1',
    name: 'Slack Notifier',
    description: 'Get Slack notifications for DTU changes and council decisions.',
    category: 'communication',
    author: { name: 'SlackTools' },
    version: '1.2.0',
    downloads: 5420,
    rating: 4.5,
    ratingCount: 89,
    status: 'approved',
    tags: ['slack', 'notifications'],
    createdAt: '2025-06-15',
    updatedAt: '2025-12-10',
    weeklyDownloads: 320,
  },
  {
    id: 'demo-plug-2',
    name: 'PDF Exporter',
    description: 'Export DTUs to beautifully formatted PDF documents with templates.',
    category: 'productivity',
    author: { name: 'ExportPro' },
    version: '2.0.1',
    downloads: 7850,
    rating: 4.6,
    ratingCount: 156,
    status: 'approved',
    tags: ['pdf', 'export', 'documents'],
    createdAt: '2025-04-20',
    updatedAt: '2026-01-05',
    weeklyDownloads: 580,
  },
  {
    id: 'demo-plug-3',
    name: 'Code Highlighter',
    description: 'Syntax highlighting for code blocks in DTUs with 100+ languages.',
    category: 'productivity',
    author: { name: 'DevTools Inc', verified: true },
    version: '1.8.0',
    downloads: 9200,
    rating: 4.8,
    ratingCount: 234,
    status: 'approved',
    trending: true,
    tags: ['code', 'syntax', 'highlighting'],
    createdAt: '2025-02-28',
    updatedAt: '2026-01-15',
    weeklyDownloads: 920,
  },
  {
    id: 'demo-plug-4',
    name: 'Security Scanner',
    description: 'Scan DTUs for sensitive information and PII with customizable rules.',
    category: 'security',
    author: { name: 'SecureData' },
    version: '1.1.0',
    downloads: 3200,
    rating: 4.4,
    ratingCount: 67,
    status: 'approved',
    tags: ['security', 'pii', 'scanner'],
    createdAt: '2025-08-10',
    updatedAt: '2025-12-20',
    weeklyDownloads: 180,
  },
  {
    id: 'demo-plug-5',
    name: 'Calendar Integration',
    description: 'Link DTUs to calendar events and set reminders for reviews.',
    category: 'integration',
    author: { name: 'CalTools' },
    version: '1.3.2',
    downloads: 4100,
    rating: 4.3,
    ratingCount: 92,
    status: 'approved',
    tags: ['calendar', 'reminders', 'events'],
    createdAt: '2025-05-05',
    updatedAt: '2025-11-30',
    weeklyDownloads: 290,
  },
];

export const DEMO_REVIEWS: DemoReview[] = [
  {
    id: 'demo-rev-1',
    pluginId: 'demo-feat-1',
    userId: 'user-1',
    userName: 'Alice Johnson',
    rating: 5,
    comment: 'Absolutely fantastic! The sync is seamless and conflict resolution works perfectly.',
    helpful: 24,
    createdAt: '2026-01-18',
  },
  {
    id: 'demo-rev-2',
    pluginId: 'demo-feat-1',
    userId: 'user-2',
    userName: 'Bob Smith',
    rating: 4,
    comment: 'Great plugin, but wish it had more customization options for field mapping.',
    helpful: 12,
    createdAt: '2026-01-15',
  },
];

/** Returns true when the marketplace API returned an error and we fell back to demo data. */
export function isDemoMode(apiData: unknown): boolean {
  return !apiData || (typeof apiData === 'object' && apiData !== null && '_demo' in apiData);
}

/** Wraps demo data with a `_demo` flag so consumers can detect it. */
export function asDemoResponse<T>(data: T): T & { _demo: true } {
  return { ...data, _demo: true as const };
}
