'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
import { apiHelpers } from '@/lib/api/client';
import { useLensNav } from '@/hooks/useLensNav';
import { getCommandPaletteLenses } from '@/lib/lens-registry';

const PAGE_SIZE = 50;

export default function GlobalLensPage() {
  useLensNav('global');
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState('');
  const [offset, setOffset] = useState(0);

  const paletteLenses = useMemo(
    () => getCommandPaletteLenses().filter((l) => !['global', 'all'].includes(l.id)),
    []
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['global-dtus-browser', PAGE_SIZE, offset, query, tags],
    queryFn: () =>
      apiHelpers.dtus
        .paginated({
          limit: PAGE_SIZE,
          offset,
          query,
          tags,
        })
        .then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: ({ id, lens }: { id: string; lens: string }) =>
      apiHelpers.dtus.syncToLens(id, { lens, scope: 'global' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-dtus-browser'] });
    },
  });

  const items = data?.items || [];
  const total = Number(data?.total || 0);

  return (
    <div className="p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-gray-400 tracking-wider">Truth Lens</p>
          <h1 className="text-3xl font-bold text-gradient-neon">Global DTU Browser</h1>
          <p className="text-neon-cyan mt-1 text-sm">{total.toLocaleString()} DTUs</p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['global-dtus-browser'] })}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <section className="panel p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-gray-400">Search</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => {
                setOffset(0);
                setQuery(e.target.value);
              }}
              placeholder="Search title, content, tags"
              className="w-full bg-lattice-void border border-lattice-border rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-gray-400">Filter tags</span>
          <input
            value={tags}
            onChange={(e) => {
              setOffset(0);
              setTags(e.target.value);
            }}
            placeholder="comma,separated,tags"
            className="w-full bg-lattice-void border border-lattice-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </section>

      <section className="panel divide-y divide-lattice-border">
        {isLoading ? (
          <div className="p-6 text-gray-400">Loading DTUs…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-gray-400">No DTUs match this query.</div>
        ) : (
          items.map((dtu: { id: string; title?: string; content?: string; tags?: string[]; createdAt?: string }) => (
            <article key={dtu.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{dtu.title || 'Untitled DTU'}</h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{dtu.content || 'No content'}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {dtu.id} {dtu.createdAt ? `• ${new Date(dtu.createdAt).toLocaleString()}` : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(dtu.tags || []).slice(0, 8).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 rounded bg-lattice-elevated text-neon-cyan">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  className="bg-lattice-void border border-lattice-border rounded px-2 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const lens = e.target.value;
                    if (!lens) return;
                    syncMutation.mutate({ id: dtu.id, lens });
                    e.target.value = '';
                  }}
                  disabled={syncMutation.isPending}
                >
                  <option value="">Sync to…</option>
                  {paletteLenses.map((lens) => (
                    <option key={lens.id} value={lens.id}>{lens.name}</option>
                  ))}
                </select>
              </div>
            </article>
          ))
        )}
      </section>

      <footer className="flex items-center justify-between panel p-3">
        <p className="text-xs text-gray-400">
          Showing {total === 0 ? 0 : offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
            disabled={offset === 0}
          >
            <ChevronsLeft className="w-4 h-4 mr-1" /> Prev
          </button>
          <button
            className="btn-ghost text-sm"
            onClick={() => setOffset((v) => v + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
          >
            Next <ChevronsRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </footer>
    </div>
  );
}
