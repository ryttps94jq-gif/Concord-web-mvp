'use client';

/**
 * Lens Hub — Redesigned for Core 5 + Extensions model.
 *
 * Shows the 5 core lenses as hero cards with their absorbed sub-lenses,
 * then a collapsible Extensions section for everything else.
 * Search works across all lenses for discoverability via Cmd+K.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CORE_LENSES,
  getAbsorbedLenses,
  getExtensionLenses,
  type LensEntry,
  type CoreLensConfig,
  LENS_CATEGORIES,
  type LensCategory,
} from '@/lib/lens-registry';
import { cn } from '@/lib/utils';
import { ds } from '@/lib/design-system';
import { Search, X, ChevronDown, Puzzle, ArrowRight } from 'lucide-react';

const EXTENSION_CATEGORIES: LensCategory[] = [
  'core', 'system', 'governance', 'science', 'ai', 'specialized', 'superlens',
];

export default function LensHubPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [extensionsOpen, setExtensionsOpen] = useState(false);

  const extensions = useMemo(() => getExtensionLenses(), []);

  const filteredExtensions = useMemo(() => {
    if (!search) return extensions;
    const q = search.toLowerCase();
    return extensions.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }, [search, extensions]);

  const extensionsByCategory = useMemo(() => {
    const map = new Map<LensCategory, LensEntry[]>();
    for (const lens of filteredExtensions) {
      const list = map.get(lens.category) || [];
      list.push(lens);
      map.set(lens.category, list);
    }
    return map;
  }, [filteredExtensions]);

  // When searching, also filter core lenses
  const filteredCores = useMemo(() => {
    if (!search) return CORE_LENSES;
    const q = search.toLowerCase();
    return CORE_LENSES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [search]);

  const totalExtensions = extensions.length;

  return (
    <div className={cn(ds.pageContainer, 'max-w-6xl mx-auto')}>
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold text-white mb-2">Concord</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Five workspaces. Everything connected. Pick one and start.
        </p>
      </div>

      {/* Core 5 Lenses — Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCores.map((core) => (
          <CoreLensCard key={core.id} core={core} router={router} />
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 pt-4">
        <div className="flex-1 border-t border-lattice-border" />
        <button
          onClick={() => setExtensionsOpen(!extensionsOpen)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-lattice-surface"
          aria-expanded={extensionsOpen}
          aria-controls="extensions-panel"
        >
          <Puzzle className="w-4 h-4" />
          <span>Extensions</span>
          <span className="text-xs text-gray-500">({totalExtensions})</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', extensionsOpen && 'rotate-180')} />
        </button>
        <div className="flex-1 border-t border-lattice-border" />
      </div>

      {/* Extensions Panel */}
      {extensionsOpen && (
        <div id="extensions-panel" className="space-y-6">
          <p className="text-sm text-gray-500 text-center">
            Specialized lenses you can enable as your needs grow.
            Always reachable via <kbd className="px-1.5 py-0.5 bg-lattice-surface border border-lattice-border rounded text-xs text-gray-300">Cmd+K</kbd>
          </p>

          {/* Extension Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search extensions..."
              className={cn(ds.input, 'pl-10 pr-8')}
              aria-label="Search extensions"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Extensions by Category */}
          {filteredExtensions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No extensions match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-6">
              {EXTENSION_CATEGORIES.map((category) => {
                const lenses = extensionsByCategory.get(category);
                if (!lenses || lenses.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className={cn(
                      'text-xs font-semibold uppercase tracking-wider mb-2',
                      LENS_CATEGORIES[category]?.color || 'text-gray-500'
                    )}>
                      {LENS_CATEGORIES[category]?.label || category} ({lenses.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {lenses
                        .sort((a, b) => a.order - b.order)
                        .map((lens) => {
                          const Icon = lens.icon;
                          return (
                            <button
                              key={lens.id}
                              onClick={() => router.push(lens.path)}
                              className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50 border border-lattice-border hover:border-gray-500 hover:bg-lattice-surface transition-all text-left group"
                              aria-label={`Open ${lens.name}: ${lens.description}`}
                            >
                              <div className="p-1.5 rounded-lg bg-lattice-void/50 text-gray-400 group-hover:text-white transition-colors">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-white truncate block">{lens.name}</span>
                                <p className="text-xs text-gray-500 truncate">{lens.description}</p>
                              </div>
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
      )}
    </div>
  );
}

/** Hero card for a core lens showing its absorbed sub-lenses */
function CoreLensCard({
  core,
  router,
}: {
  core: CoreLensConfig;
  router: ReturnType<typeof useRouter>;
}) {
  const absorbed = useMemo(() => getAbsorbedLenses(core.id), [core.id]);
  const Icon = core.icon;

  // Make first 2 cards span full width on lg for a 2+3 layout
  const isWide = core.id === 'chat' || core.id === 'board';

  return (
    <button
      onClick={() => router.push(core.path)}
      className={cn(
        'group relative flex flex-col p-6 rounded-xl border transition-all text-left',
        'bg-lattice-surface/60 border-lattice-border',
        `hover:border-${core.color}/50 hover:shadow-lg hover:shadow-${core.color}/5`,
        isWide && 'lg:col-span-1'
      )}
      aria-label={`Open ${core.name}: ${core.description}`}
    >
      {/* Icon + Title */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'p-2.5 rounded-xl transition-colors',
          `bg-${core.color}/10 text-${core.color}`,
          `group-hover:bg-${core.color}/20`
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{core.name}</h2>
          <p className={cn('text-xs font-medium', `text-${core.color}`)}>{core.tagline}</p>
        </div>
        <ArrowRight className={cn(
          'w-5 h-5 ml-auto text-gray-600 transition-all',
          'group-hover:text-white group-hover:translate-x-1'
        )} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4">{core.description}</p>

      {/* Absorbed lenses as badges */}
      {absorbed.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {absorbed.map((lens) => {
            const SubIcon = lens.icon;
            return (
              <span
                key={lens.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-lattice-void/50 text-xs text-gray-400"
                title={lens.description}
              >
                <SubIcon className="w-3 h-3" />
                {lens.tabLabel || lens.name}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}
