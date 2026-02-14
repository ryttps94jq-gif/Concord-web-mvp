'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LENS_CATEGORIES, LENS_REGISTRY, type LensCategory } from '@/lib/lens-registry';

export default function LensesHubPage() {
  const [q, setQ] = useState('');

  const grouped = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = LENS_REGISTRY.filter((lens) => {
      if (!query) return true;
      const haystack = [lens.name, lens.description, ...(lens.keywords || [])].join(' ').toLowerCase();
      return haystack.includes(query);
    }).sort((a, b) => a.order - b.order);

    const byCategory = new Map<LensCategory, typeof filtered>();
    for (const lens of filtered) {
      const curr = byCategory.get(lens.category) || [];
      curr.push(lens);
      byCategory.set(lens.category, curr);
    }
    return byCategory;
  }, [q]);

  return (
    <main className="p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Lens Hub</h1>
      <p className="text-sm text-gray-400">All lenses are discoverable here, even when sidebar navigation is curated.</p>

      <input
        className="border border-gray-700 bg-transparent rounded px-3 py-2 w-full max-w-xl"
        placeholder="Search lenses"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {Object.entries(LENS_CATEGORIES).map(([category, config]) => {
        const lenses = grouped.get(category as LensCategory) || [];
        if (!lenses.length) return null;
        return (
          <section key={category} className="space-y-2">
            <h2 className={`text-lg font-medium ${config.color}`}>{config.label}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lenses.map((lens) => (
                <Link key={lens.id} href={lens.path} className="border border-gray-800 rounded p-3 hover:border-gray-600">
                  <p className="font-medium">{lens.name}</p>
                  <p className="text-sm text-gray-400">{lens.description}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
