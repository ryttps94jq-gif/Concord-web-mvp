'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Store, Download, Star, Github, Search, Filter, Plus } from 'lucide-react';

export default function MarketplaceLensPage() {
  useLensNav('marketplace');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: browse, isLoading } = useQuery({
    queryKey: ['marketplace-browse', search, category],
    queryFn: () => api.get(`/api/marketplace/browse?search=${search}&category=${category}`).then(r => r.data),
  });

  const { data: installed } = useQuery({
    queryKey: ['marketplace-installed'],
    queryFn: () => api.get('/api/marketplace/installed').then(r => r.data),
  });

  const installMutation = useMutation({
    mutationFn: (data: { pluginId?: string; fromGithub?: boolean; githubUrl?: string }) =>
      api.post('/api/marketplace/install', data),
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

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-8 h-8 text-neon-purple" />
          <div>
            <h1 className="text-xl font-bold">Plugin Marketplace</h1>
            <p className="text-sm text-gray-400">
              Discover and install community plugins
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Submit Plugin
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Available" value={browse?.pagination?.total || 0} icon={<Store />} />
        <StatCard label="Installed" value={installed?.count || 0} icon={<Download />} />
        <StatCard label="Categories" value={browse?.categories?.length || 0} icon={<Filter />} />
        <StatCard label="Pending Review" value={browse?.items?.filter((p: any) => p.status === 'pending_review').length || 0} icon={<Star />} />
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg"
        >
          <option value="">All Categories</option>
          {browse?.categories?.map((cat: string) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-gray-400">Loading plugins...</div>
        ) : browse?.items?.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">No plugins found</div>
        ) : (
          browse?.items?.map((plugin: any) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              isInstalled={installed?.plugins?.some((p: any) => p.id === plugin.id)}
              onInstall={() => installMutation.mutate({ pluginId: plugin.id })}
              installing={installMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Submit Modal */}
      {showSubmit && (
        <SubmitPluginModal
          onClose={() => setShowSubmit(false)}
          onSubmit={(data) => submitMutation.mutate(data)}
          categories={browse?.categories || []}
          submitting={submitMutation.isPending}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="lens-card flex items-center gap-3">
      <div className="text-neon-purple">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function PluginCard({ plugin, isInstalled, onInstall, installing }: any) {
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{plugin.name}</h3>
          <p className="text-xs text-gray-400">{plugin.category}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${plugin.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {plugin.status}
        </span>
      </div>
      <p className="text-sm text-gray-300 line-clamp-2">{plugin.description}</p>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3 text-gray-400">
          <span className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {plugin.downloads}
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4" />
            {plugin.rating?.toFixed(1) || '0.0'}
          </span>
        </div>
        {isInstalled ? (
          <span className="text-green-400">Installed</span>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="btn-secondary text-xs"
          >
            {installing ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>
      {plugin.githubUrl && (
        <a
          href={plugin.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          <Github className="w-3 h-3" />
          View Source
        </a>
      )}
    </div>
  );
}

function SubmitPluginModal({ onClose, onSubmit, categories, submitting }: any) {
  const [form, setForm] = useState({ name: '', githubUrl: '', description: '', category: 'productivity' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Submit Plugin</h2>
        <input
          type="text"
          placeholder="Plugin Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <input
          type="text"
          placeholder="GitHub URL"
          value={form.githubUrl}
          onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded h-24"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        >
          {categories.map((cat: string) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || !form.name || !form.githubUrl}
            className="btn-primary"
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
