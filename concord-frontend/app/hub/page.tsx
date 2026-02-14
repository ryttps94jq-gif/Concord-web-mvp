'use client';

/**
 * Lens Hub — "All Lenses" discovery page.
 *
 * Shows all lenses grouped by category with search.
 * Every lens route is reachable via this page.
 * Sidebar remains curated; this is the comprehensive view.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LENS_REGISTRY, type LensEntry, type LensCategory } from '@/lib/lens-registry';
import { cn } from '@/lib/utils';
import { ds } from '@/lib/design-system';
import { Search, X, Compass, ChevronRight } from 'lucide-react';

const CATEGORY_LABELS: Record<LensCategory, string> = {
  core: 'Core',
  knowledge: 'Knowledge',
  science: 'Science',
  creative: 'Creative',
  governance: 'Governance',
  ai: 'AI & Cognitive',
  system: 'System',
  specialized: 'Specialized',
  superlens: 'Super Lenses',
};

const CATEGORY_ORDER: LensCategory[] = [
  'core', 'knowledge', 'creative', 'science', 'ai', 'governance', 'system', 'specialized', 'superlens',
];

export default function LensHubPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filteredLenses = useMemo(() => {
    if (!search) return LENS_REGISTRY;
    const q = search.toLowerCase();
    return LENS_REGISTRY.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<LensCategory, LensEntry[]>();
    for (const lens of filteredLenses) {
      const list = map.get(lens.category) || [];
      list.push(lens);
      map.set(lens.category, list);
    }
    return map;
  }, [filteredLenses]);

  return (
    <div className={cn(ds.pageContainer)}>
      {/* Header */}
      <div className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <div className="text-neon-cyan"><Compass className="w-6 h-6" /></div>
          <div>
            <h1 className={ds.heading1}>Lens Hub</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              All {LENS_REGISTRY.length} lenses — click any to open
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lenses..."
          className={cn(ds.input, 'pl-10 pr-8')}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-gray-400">
        {filteredLenses.length === LENS_REGISTRY.length
          ? `${LENS_REGISTRY.length} lenses available`
          : `${filteredLenses.length} of ${LENS_REGISTRY.length} lenses match "${search}"`}
      </p>

      {/* Grouped lenses */}
      {filteredLenses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No lenses match your search.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const lenses = grouped.get(category);
            if (!lenses || lenses.length === 0) return null;

            return (
              <div key={category}>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[category]} ({lenses.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {lenses
                    .sort((a, b) => a.order - b.order)
                    .map((lens) => {
                      const Icon = lens.icon;
                      return (
                        <button
                          key={lens.id}
                          onClick={() => router.push(lens.path)}
                          className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50 border border-lattice-border hover:border-neon-cyan/40 hover:bg-lattice-surface transition-all text-left group"
                        >
                          <div className="p-2 rounded-lg bg-lattice-void/50 text-gray-400 group-hover:text-neon-cyan transition-colors">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-white truncate">{lens.name}</span>
                              {lens.showInSidebar && (
                                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan flex-shrink-0" title="In sidebar" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{lens.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
