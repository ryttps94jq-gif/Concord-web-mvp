'use client';

/**
 * useLensBridge — Bridges domain API data into the universal lens artifact system.
 *
 * Tier C lenses fetch data from domain-specific APIs (apiHelpers.affect.*,
 * apiHelpers.hypothesis.*, etc.) but don't persist into the lens artifact store.
 * This hook creates a one-way mirror: when domain data arrives, it's persisted
 * as lens artifacts so universal actions (analyze/generate/suggest) can operate
 * on it.
 *
 * Usage:
 *   const bridge = useLensBridge('affect', 'snapshot');
 *   bridge.sync(affectState);              // single object → one artifact
 *   bridge.syncList(hypotheses, h => ({    // array → multiple artifacts
 *     title: h.statement,
 *     data: h,
 *     meta: { status: h.status },
 *   }));
 *
 * The bridge is idempotent — it only creates artifacts once per component mount.
 * Returns { lensItems, selectedId, setSelectedId } for wiring to UniversalActions.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { useLensData } from './use-lens-data';

interface BridgeItem {
  title: string;
  data: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export function useLensBridge(domain: string, type: string = 'record') {
  const { items, create } = useLensData(domain, type, { noSeed: true });
  const synced = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first item when items arrive
  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const sync = useCallback((data: Record<string, unknown> | null | undefined, title?: string) => {
    if (!data || synced.current || items.length > 0) return;
    synced.current = true;
    const label = title || `${domain} — ${new Date().toLocaleDateString()}`;
    create({ title: label, data });
  }, [domain, items.length, create]);

  const syncList = useCallback((
    list: unknown[] | null | undefined,
    mapper: (item: unknown, index: number) => BridgeItem
  ) => {
    if (!list?.length || synced.current || items.length > 0) return;
    synced.current = true;
    const capped = list.slice(0, 50); // cap to prevent bulk overload
    for (const item of capped) {
      const mapped = mapper(item, capped.indexOf(item));
      create({ title: mapped.title, data: mapped.data, meta: mapped.meta });
    }
  }, [items.length, create]);

  return {
    lensItems: items,
    selectedId,
    setSelectedId,
    sync,
    syncList,
  };
}
