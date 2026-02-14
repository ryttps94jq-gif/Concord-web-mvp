'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

type GlobalTab = 'dtus' | 'artifacts' | 'jobs' | 'marketplace';

interface PaginatedResponse<T> {
  ok: boolean;
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

const TAB_CONFIG: Record<GlobalTab, { label: string; endpoint: string }> = {
  dtus: { label: 'DTUs', endpoint: '/api/dtus/paginated' },
  artifacts: { label: 'Artifacts', endpoint: '/api/artifacts/paginated' },
  jobs: { label: 'Jobs', endpoint: '/api/jobs/paginated' },
  marketplace: { label: 'Marketplace', endpoint: '/api/marketplace/paginated' },
};

export default function GlobalPage() {
  const [tab, setTab] = useState<GlobalTab>('dtus');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const queryKey = useMemo(() => ['global', tab, q, offset, limit], [tab, q, offset]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (q.trim()) params.set('q', q.trim());
      const response = await api.get<PaginatedResponse<Record<string, unknown>>>(`${TAB_CONFIG[tab].endpoint}?${params.toString()}`);
      return response.data;
    },
  });

  const data = query.data;
  const total = data?.total || 0;
  const showing = data?.items?.length || 0;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Global Truth View</h1>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB_CONFIG) as GlobalTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-1 rounded border ${tab === t ? 'bg-blue-600 text-white border-blue-500' : 'border-gray-700'}`}
            onClick={() => {
              setTab(t);
              setOffset(0);
            }}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          className="border border-gray-700 bg-transparent rounded px-3 py-2 w-full max-w-lg"
          placeholder="Search Global"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
        <span className="text-sm text-gray-400">Showing {showing} of {total}</span>
      </div>

      {query.isLoading ? <p>Loading…</p> : null}
      {query.isError ? <p className="text-red-400">Failed to load Global data.</p> : null}

      <ul className="divide-y divide-gray-800 border border-gray-800 rounded">
        {(data?.items || []).map((item, index) => (
          <li key={String(item.id || `${tab}-${index}`)} className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{String(item.title || item.name || item.id || 'Untitled')}</p>
              <p className="text-xs text-gray-400">{String(item.type || item.status || item.tier || '')}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="text-xs px-2 py-1 border border-gray-700 rounded">Sync to lens</button>
              <button type="button" className="text-xs px-2 py-1 border border-gray-700 rounded">Publish</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-1 border border-gray-700 rounded disabled:opacity-50"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          Prev
        </button>
        <button
          type="button"
          className="px-3 py-1 border border-gray-700 rounded disabled:opacity-50"
          disabled={offset + limit >= total}
          onClick={() => setOffset(offset + limit)}
        >
          Next
        </button>
      </div>
    </main>
  );
}
