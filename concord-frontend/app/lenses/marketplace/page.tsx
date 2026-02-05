'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Download, Star, Github, Search, Filter, Plus, TrendingUp, Crown, Grid3X3,
  List, ChevronRight, ExternalLink, Settings, Trash2, RefreshCw, Check, X, Clock,
  BarChart2, Users, DollarSign, Code, Shield, Package, Heart, Tag, Award, Eye,
  MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, Zap, Layers, ChevronDown,
  Upload, Edit, Copy, Share2
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  author: {
    name: string;
    avatar?: string;
    verified?: boolean;
  };
  githubUrl?: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  featured?: boolean;
  trending?: boolean;
  price?: number;
  screenshots?: string[];
  tags?: string[];
  permissions?: string[];
  dependencies?: string[];
  changelog?: { version: string; date: string; changes: string[] }[];
  createdAt: string;
  updatedAt: string;
  weeklyDownloads?: number;
  revenue?: number;
}

interface Review {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  helpful: number;
  createdAt: string;
}

type ViewMode = 'grid' | 'list';
type Tab = 'browse' | 'installed' | 'developer' | 'collections';
type SortOption = 'popular' | 'rating' | 'recent' | 'trending' | 'downloads';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Grid3X3 },
  { id: 'productivity', name: 'Productivity', icon: Zap },
  { id: 'visualization', name: 'Visualization', icon: BarChart2 },
  { id: 'ai', name: 'AI & ML', icon: Code },
  { id: 'integration', name: 'Integrations', icon: Layers },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'communication', name: 'Communication', icon: MessageSquare },
  { id: 'data', name: 'Data Tools', icon: Package },
];

const MOCK_FEATURED: Plugin[] = [
  {
    id: 'feat-1',
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
    weeklyDownloads: 1250
  },
  {
    id: 'feat-2',
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
    weeklyDownloads: 890
  },
  {
    id: 'feat-3',
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
    weeklyDownloads: 1520
  }
];

const MOCK_PLUGINS: Plugin[] = [
  ...MOCK_FEATURED,
  {
    id: 'plug-1',
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
    weeklyDownloads: 320
  },
  {
    id: 'plug-2',
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
    weeklyDownloads: 580
  },
  {
    id: 'plug-3',
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
    weeklyDownloads: 920
  },
  {
    id: 'plug-4',
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
    weeklyDownloads: 180
  },
  {
    id: 'plug-5',
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
    weeklyDownloads: 290
  }
];

const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    pluginId: 'feat-1',
    userId: 'user-1',
    userName: 'Alice Johnson',
    rating: 5,
    comment: 'Absolutely fantastic! The sync is seamless and conflict resolution works perfectly.',
    helpful: 24,
    createdAt: '2026-01-18'
  },
  {
    id: 'rev-2',
    pluginId: 'feat-1',
    userId: 'user-2',
    userName: 'Bob Smith',
    rating: 4,
    comment: 'Great plugin, but wish it had more customization options for field mapping.',
    helpful: 12,
    createdAt: '2026-01-15'
  }
];

export default function MarketplaceLensPage() {
  useLensNav('marketplace');
  const queryClient = useQueryClient();

  // State
  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Queries
  const { data: browseData, isLoading } = useQuery({
    queryKey: ['marketplace-browse', search, category],
    queryFn: () => api.get(`/api/marketplace/browse?search=${search}&category=${category}`).then(r => r.data).catch(() => ({
      items: MOCK_PLUGINS,
      categories: CATEGORIES.map(c => c.id),
      pagination: { total: MOCK_PLUGINS.length }
    })),
  });

  const { data: installedData } = useQuery({
    queryKey: ['marketplace-installed'],
    queryFn: () => api.get('/api/marketplace/installed').then(r => r.data).catch(() => ({
      plugins: MOCK_PLUGINS.slice(0, 3).map(p => ({ ...p, installedAt: '2026-01-10', hasUpdate: Math.random() > 0.7 })),
      count: 3
    })),
  });

  // Mutations
  const installMutation = useMutation({
    mutationFn: (data: { pluginId?: string; fromGithub?: boolean; githubUrl?: string }) =>
      api.post('/api/marketplace/install', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-installed'] }),
  });

  const uninstallMutation = useMutation({
    mutationFn: (pluginId: string) =>
      api.delete(`/api/marketplace/uninstall/${pluginId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketplace-installed'] }),
  });

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; githubUrl: string; description: string; category: string }) =>
      api.post('/api/marketplace/submit', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-browse'] });
      setShowSubmit(false);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { pluginId: string; rating: number; comment: string }) =>
      api.post('/api/marketplace/review', data),
    onSuccess: () => setShowReviewModal(false),
  });

  // Computed
  const plugins = browseData?.items || MOCK_PLUGINS;
  const featuredPlugins = plugins.filter((p: Plugin) => p.featured);
  const trendingPlugins = plugins.filter((p: Plugin) => p.trending || (p.weeklyDownloads || 0) > 500);
  const installed = installedData?.plugins || [];

  const filteredPlugins = useMemo(() => {
    let filtered = plugins.filter((p: Plugin) => {
      if (category !== 'all' && p.category !== category) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    switch (sortBy) {
      case 'rating':
        return filtered.sort((a: Plugin, b: Plugin) => b.rating - a.rating);
      case 'recent':
        return filtered.sort((a: Plugin, b: Plugin) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case 'trending':
        return filtered.sort((a: Plugin, b: Plugin) => (b.weeklyDownloads || 0) - (a.weeklyDownloads || 0));
      case 'downloads':
        return filtered.sort((a: Plugin, b: Plugin) => b.downloads - a.downloads);
      default:
        return filtered.sort((a: Plugin, b: Plugin) => (b.downloads * b.rating) - (a.downloads * a.rating));
    }
  }, [plugins, category, search, sortBy]);

  const isInstalled = (pluginId: string) => installed.some((p: any) => p.id === pluginId);

  // Auto-rotate featured
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setFeaturedIndex(i => (i + 1) % Math.max(1, featuredPlugins.length));
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [featuredPlugins.length]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-8 h-8 text-neon-purple" />
          <div>
            <h1 className="text-xl font-bold">Plugin Marketplace</h1>
            <p className="text-sm text-gray-400">
              Discover, install, and manage community plugins
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSubmit(true)}
            className="btn-neon purple flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Submit Plugin
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-lattice-surface/50 p-1 rounded-lg w-fit">
        {[
          { id: 'browse', label: 'Browse', icon: Grid3X3 },
          { id: 'installed', label: 'Installed', icon: Download, badge: installed.length },
          { id: 'developer', label: 'Developer', icon: Code },
          { id: 'collections', label: 'Collections', icon: Layers }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              tab === t.id ? 'bg-neon-purple/20 text-neon-purple' : 'hover:bg-white/5'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="bg-neon-purple/30 text-neon-purple text-xs px-1.5 rounded">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          {/* Featured Section */}
          {featuredPlugins.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold">Featured Plugins</h2>
              </div>
              <div className="relative">
                <motion.div
                  key={featuredIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  {MOCK_FEATURED.map((plugin, i) => (
                    <FeaturedCard
                      key={plugin.id}
                      plugin={plugin}
                      onClick={() => setSelectedPlugin(plugin)}
                      onInstall={() => installMutation.mutate({ pluginId: plugin.id })}
                      isInstalled={isInstalled(plugin.id)}
                    />
                  ))}
                </motion.div>
              </div>
            </section>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Plugins" value={plugins.length} icon={<Package />} color="purple" />
            <StatCard label="This Week" value={plugins.reduce((a: number, p: Plugin) => a + (p.weeklyDownloads || 0), 0)} icon={<Download />} color="cyan" />
            <StatCard label="Categories" value={CATEGORIES.length - 1} icon={<Tag />} color="green" />
            <StatCard label="Developers" value={new Set(plugins.map((p: Plugin) => p.author.name)).size} icon={<Users />} color="pink" />
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg focus:border-neon-purple outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="recent">Recently Updated</option>
                <option value="trending">Trending</option>
                <option value="downloads">Most Downloads</option>
              </select>

              <div className="flex items-center bg-lattice-surface border border-lattice-border rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'text-neon-purple' : 'text-gray-400'}`}
                >
                  <Grid3X3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'text-neon-purple' : 'text-gray-400'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  category === cat.id
                    ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/50'
                    : 'bg-lattice-surface border border-lattice-border hover:border-gray-600'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.name}
              </button>
            ))}
          </div>

          {/* Trending Section */}
          {trendingPlugins.length > 0 && category === 'all' && !search && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-green" />
                <h3 className="font-semibold">Trending This Week</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {trendingPlugins.slice(0, 5).map((plugin: Plugin) => (
                  <TrendingCard
                    key={plugin.id}
                    plugin={plugin}
                    onClick={() => setSelectedPlugin(plugin)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Plugin Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full" />
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No plugins found matching your criteria</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlugins.map((plugin: Plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={isInstalled(plugin.id)}
                  onInstall={() => installMutation.mutate({ pluginId: plugin.id })}
                  onClick={() => setSelectedPlugin(plugin)}
                  installing={installMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlugins.map((plugin: Plugin) => (
                <PluginListItem
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={isInstalled(plugin.id)}
                  onInstall={() => installMutation.mutate({ pluginId: plugin.id })}
                  onClick={() => setSelectedPlugin(plugin)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'installed' && (
        <InstalledTab
          plugins={installed}
          onUninstall={(id: string) => uninstallMutation.mutate(id)}
          onUpdate={(id: string) => installMutation.mutate({ pluginId: id })}
          onSettings={(plugin: Plugin) => setSelectedPlugin(plugin)}
        />
      )}

      {tab === 'developer' && (
        <DeveloperTab
          onSubmit={() => setShowSubmit(true)}
        />
      )}

      {tab === 'collections' && (
        <CollectionsTab />
      )}

      {/* Plugin Detail Modal */}
      <AnimatePresence>
        {selectedPlugin && (
          <PluginDetailModal
            plugin={selectedPlugin}
            reviews={MOCK_REVIEWS.filter(r => r.pluginId === selectedPlugin.id)}
            isInstalled={isInstalled(selectedPlugin.id)}
            onClose={() => setSelectedPlugin(null)}
            onInstall={() => installMutation.mutate({ pluginId: selectedPlugin.id })}
            onReview={() => setShowReviewModal(true)}
          />
        )}
      </AnimatePresence>

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmit && (
          <SubmitPluginModal
            onClose={() => setShowSubmit(false)}
            onSubmit={(data: { name: string; githubUrl: string; description: string; category: string }) => submitMutation.mutate(data)}
            categories={CATEGORIES.slice(1).map(c => c.id)}
            submitting={submitMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && selectedPlugin && (
          <ReviewModal
            plugin={selectedPlugin}
            onClose={() => setShowReviewModal(false)}
            onSubmit={(data: { rating: number; comment: string }) => reviewMutation.mutate({ pluginId: selectedPlugin.id, ...data })}
            submitting={reviewMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'text-neon-purple bg-neon-purple/10',
    cyan: 'text-neon-cyan bg-neon-cyan/10',
    green: 'text-neon-green bg-neon-green/10',
    pink: 'text-neon-pink bg-neon-pink/10'
  };

  return (
    <div className="panel p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function FeaturedCard({ plugin, onClick, onInstall, isInstalled }: { plugin: Plugin; onClick: () => void; onInstall: () => void; isInstalled: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="panel p-5 cursor-pointer bg-gradient-to-br from-neon-purple/10 to-transparent border-neon-purple/30"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-yellow-400">Featured</span>
        </div>
        {plugin.author.verified && (
          <span className="flex items-center gap-1 text-xs text-neon-cyan">
            <Check className="w-3 h-3" /> Verified
          </span>
        )}
      </div>
      <h3 className="font-bold text-lg mb-1">{plugin.name}</h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{plugin.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            {plugin.rating}
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {(plugin.downloads / 1000).toFixed(1)}k
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onInstall(); }}
          disabled={isInstalled}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            isInstalled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-neon-purple text-white hover:bg-neon-purple/80'
          }`}
        >
          {isInstalled ? 'Installed' : 'Install'}
        </button>
      </div>
    </motion.div>
  );
}

function TrendingCard({ plugin, onClick }: { plugin: Plugin; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="panel p-3 min-w-[200px] cursor-pointer hover:border-neon-green/50 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-neon-green" />
        <span className="text-xs text-neon-green">+{plugin.weeklyDownloads} this week</span>
      </div>
      <h4 className="font-semibold text-sm">{plugin.name}</h4>
      <p className="text-xs text-gray-400">{plugin.category}</p>
    </div>
  );
}

function PluginCard({ plugin, isInstalled, onInstall, onClick, installing }: any) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="panel p-4 space-y-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{plugin.name}</h3>
            {plugin.author.verified && <Check className="w-4 h-4 text-neon-cyan" />}
          </div>
          <p className="text-xs text-gray-400">{plugin.category} · v{plugin.version}</p>
        </div>
        {plugin.trending && (
          <span className="flex items-center gap-1 text-xs bg-neon-green/20 text-neon-green px-2 py-0.5 rounded">
            <TrendingUp className="w-3 h-3" /> Trending
          </span>
        )}
      </div>

      <p className="text-sm text-gray-300 line-clamp-2">{plugin.description}</p>

      {plugin.tags && (
        <div className="flex flex-wrap gap-1">
          {plugin.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-xs bg-lattice-surface px-2 py-0.5 rounded text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-lattice-border">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400" />
            {plugin.rating.toFixed(1)}
            <span className="text-gray-500">({plugin.ratingCount})</span>
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {plugin.downloads.toLocaleString()}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onInstall(); }}
          disabled={isInstalled || installing}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            isInstalled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30'
          }`}
        >
          {isInstalled ? 'Installed' : installing ? 'Installing...' : 'Install'}
        </button>
      </div>
    </motion.div>
  );
}

function PluginListItem({ plugin, isInstalled, onInstall, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="panel p-4 flex items-center gap-4 cursor-pointer hover:border-neon-purple/50"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">{plugin.name}</h4>
          {plugin.author.verified && <Check className="w-4 h-4 text-neon-cyan" />}
          <span className="text-xs text-gray-500">by {plugin.author.name}</span>
        </div>
        <p className="text-sm text-gray-400 mt-1">{plugin.description}</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <span className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400" />
          {plugin.rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Download className="w-4 h-4" />
          {plugin.downloads.toLocaleString()}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onInstall(); }}
          disabled={isInstalled}
          className={`px-4 py-2 rounded ${
            isInstalled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-neon-purple text-white'
          }`}
        >
          {isInstalled ? 'Installed' : 'Install'}
        </button>
      </div>
    </div>
  );
}

function InstalledTab({ plugins, onUninstall, onUpdate, onSettings }: any) {
  if (plugins.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No plugins installed yet</p>
        <p className="text-sm mt-1">Browse the marketplace to find useful plugins</p>
      </div>
    );
  }

  const withUpdates = plugins.filter((p: any) => p.hasUpdate);

  return (
    <div className="space-y-6">
      {withUpdates.length > 0 && (
        <div className="panel p-4 bg-neon-cyan/10 border-neon-cyan/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-neon-cyan" />
              <span>{withUpdates.length} update(s) available</span>
            </div>
            <button className="btn-neon cyan">Update All</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plugins.map((plugin: any) => (
          <div key={plugin.id} className="panel p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{plugin.name}</h4>
                <span className="text-xs text-gray-500">v{plugin.version}</span>
                {plugin.hasUpdate && (
                  <span className="text-xs bg-neon-cyan/20 text-neon-cyan px-2 py-0.5 rounded">
                    Update available
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">Installed {plugin.installedAt}</p>
            </div>
            <div className="flex items-center gap-2">
              {plugin.hasUpdate && (
                <button
                  onClick={() => onUpdate(plugin.id)}
                  className="p-2 hover:bg-neon-cyan/20 rounded transition-colors"
                  title="Update"
                >
                  <RefreshCw className="w-5 h-5 text-neon-cyan" />
                </button>
              )}
              <button
                onClick={() => onSettings(plugin)}
                className="p-2 hover:bg-white/10 rounded transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => onUninstall(plugin.id)}
                className="p-2 hover:bg-red-500/20 rounded transition-colors"
                title="Uninstall"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeveloperTab({ onSubmit }: { onSubmit: () => void }) {
  const stats = {
    plugins: 3,
    totalDownloads: 15420,
    totalRevenue: 2450.00,
    avgRating: 4.7
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Your Plugins" value={stats.plugins} icon={<Package />} color="purple" />
        <StatCard label="Total Downloads" value={stats.totalDownloads} icon={<Download />} color="cyan" />
        <StatCard label="Revenue" value={stats.totalRevenue} icon={<DollarSign />} color="green" />
        <StatCard label="Avg Rating" value={stats.avgRating} icon={<Star />} color="pink" />
      </div>

      <div className="panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Your Plugins</h3>
          <button onClick={onSubmit} className="btn-neon purple">
            <Plus className="w-4 h-4 mr-2 inline" />
            Submit New Plugin
          </button>
        </div>

        <div className="space-y-4">
          {[
            { name: 'My Plugin 1', status: 'approved', downloads: 5420, rating: 4.8 },
            { name: 'My Plugin 2', status: 'pending_review', downloads: 0, rating: 0 },
            { name: 'My Plugin 3', status: 'approved', downloads: 10000, rating: 4.6 }
          ].map((plugin, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-lattice-surface rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{plugin.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    plugin.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    plugin.status === 'pending_review' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {plugin.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                  <span>{plugin.downloads.toLocaleString()} downloads</span>
                  {plugin.rating > 0 && <span>{plugin.rating} rating</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-neon small"><Edit className="w-4 h-4" /></button>
                <button className="btn-neon small"><BarChart2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-lg font-semibold mb-4">Developer Resources</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Code, label: 'Plugin API Docs', desc: 'Learn how to build plugins' },
            { icon: Github, label: 'SDK & Templates', desc: 'Get started quickly' },
            { icon: MessageSquare, label: 'Developer Forum', desc: 'Get help from the community' }
          ].map((resource, i) => (
            <div key={i} className="p-4 bg-lattice-surface rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <resource.icon className="w-8 h-8 text-neon-purple mb-2" />
              <h4 className="font-medium">{resource.label}</h4>
              <p className="text-sm text-gray-400">{resource.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionsTab() {
  const collections = [
    { name: 'Essential Productivity', count: 8, curator: 'Concord Team' },
    { name: 'Data Visualization Pack', count: 5, curator: 'DataViz Community' },
    { name: 'Security Essentials', count: 4, curator: 'SecureData' },
    { name: 'AI/ML Toolkit', count: 6, curator: 'Neural Tools' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Plugin Collections</h3>
        <button className="btn-neon">
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Collection
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {collections.map((col, i) => (
          <div key={i} className="panel p-5 cursor-pointer hover:border-neon-purple/50 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-neon-purple/30 to-neon-cyan/30 rounded-lg flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold">{col.name}</h4>
                <p className="text-sm text-gray-400">{col.count} plugins</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">Curated by {col.curator}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PluginDetailModal({ plugin, reviews, isInstalled, onClose, onInstall, onReview }: any) {
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'changelog'>('overview');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-lattice-bg border border-lattice-border rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-lattice-border">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-neon-purple/30 to-neon-cyan/30 rounded-xl flex items-center justify-center">
                <Package className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{plugin.name}</h2>
                  {plugin.author.verified && (
                    <span className="flex items-center gap-1 text-xs text-neon-cyan bg-neon-cyan/20 px-2 py-0.5 rounded">
                      <Check className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
                <p className="text-gray-400">by {plugin.author.name}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    {plugin.rating} ({plugin.ratingCount} reviews)
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <Download className="w-4 h-4" />
                    {plugin.downloads.toLocaleString()} downloads
                  </span>
                  <span className="text-gray-500">v{plugin.version}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={onInstall}
              disabled={isInstalled}
              className={`px-6 py-2 rounded-lg font-medium ${
                isInstalled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-neon-purple text-white hover:bg-neon-purple/80'
              }`}
            >
              {isInstalled ? 'Installed' : 'Install Plugin'}
            </button>
            {plugin.githubUrl && (
              <a
                href={plugin.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <Github className="w-5 h-5" />
              </a>
            )}
            <button className="p-2 hover:bg-white/10 rounded-lg">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-lattice-border">
          {(['overview', 'reviews', 'changelog'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-3 capitalize ${
                activeTab === t
                  ? 'text-neon-purple border-b-2 border-neon-purple'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-300">{plugin.longDescription || plugin.description}</p>
              </div>

              {plugin.tags && (
                <div>
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {plugin.tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1 bg-lattice-surface rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {plugin.permissions && (
                <div>
                  <h3 className="font-semibold mb-2">Permissions</h3>
                  <div className="space-y-2">
                    {(plugin.permissions || ['Read DTUs', 'Write DTUs', 'Network Access']).map((perm: string) => (
                      <div key={perm} className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-yellow-400" />
                        {perm}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-lattice-border">
                <div>
                  <p className="text-sm text-gray-400">Category</p>
                  <p className="capitalize">{plugin.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Last Updated</p>
                  <p>{new Date(plugin.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">User Reviews</h3>
                <button onClick={onReview} className="btn-neon small">Write Review</button>
              </div>

              {reviews.length === 0 ? (
                <p className="text-center py-8 text-gray-400">No reviews yet. Be the first!</p>
              ) : (
                reviews.map((review: Review) => (
                  <div key={review.id} className="p-4 bg-lattice-surface rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neon-purple/30 rounded-full flex items-center justify-center">
                          {review.userName[0]}
                        </div>
                        <span className="font-medium">{review.userName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-300">{review.comment}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                      <button className="flex items-center gap-1 hover:text-white">
                        <ThumbsUp className="w-4 h-4" /> {review.helpful} helpful
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="space-y-4">
              {(plugin.changelog || [
                { version: plugin.version, date: plugin.updatedAt, changes: ['Initial release'] }
              ]).map((entry: any) => (
                <div key={entry.version} className="p-4 bg-lattice-surface rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-neon-purple">v{entry.version}</span>
                    <span className="text-sm text-gray-400">{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    {entry.changes.map((change: string, i: number) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SubmitPluginModal({ onClose, onSubmit, categories, submitting }: any) {
  const [form, setForm] = useState({
    name: '',
    githubUrl: '',
    description: '',
    category: categories[0] || 'productivity'
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Submit Plugin</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Plugin Name</label>
            <input
              type="text"
              placeholder="My Awesome Plugin"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">GitHub Repository URL</label>
            <div className="relative">
              <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                className="w-full pl-10 pr-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              placeholder="Describe what your plugin does..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded h-24 focus:border-neon-purple outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
            >
              {categories.map((cat: string) => (
                <option key={cat} value={cat} className="capitalize">{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-lattice-border">
          <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || !form.name || !form.githubUrl}
            className="btn-neon purple disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReviewModal({ plugin, onClose, onSubmit, submitting }: any) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Review {plugin.name}</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Rating</label>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setRating(i + 1)}
                className="p-1"
              >
                <Star
                  className={`w-8 h-8 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Your Review</label>
          <textarea
            placeholder="Share your experience with this plugin..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded h-32 focus:border-neon-purple outline-none resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-lattice-border">
          <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ rating, comment })}
            disabled={submitting || !comment}
            className="btn-neon purple disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
