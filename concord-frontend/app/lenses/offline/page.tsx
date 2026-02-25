'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { Wifi, WifiOff, Database, RefreshCw, Upload, Download, Trash2, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';

interface SyncItem {
  id: string;
  type: 'dtu' | 'event' | 'setting';
  action: 'create' | 'update' | 'delete';
  timestamp: string;
  synced: boolean;
}

// Seed data for pending sync items
const SEED_SYNC_ITEMS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function OfflineLensPage() {
  useLensNav('offline');
  const [isOnline, setIsOnline] = useState(true);
  const qc = useQueryClient();

  // Fetch cache stats from the real DB status endpoint
  const { data: dbStatusResponse, isLoading: statsLoading, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['db', 'status'],
    queryFn: async () => {
      const { data } = await apiHelpers.db.status();
      return data as {
        ok: boolean;
        dtus?: number;
        events?: number;
        settings?: number;
        totalSize?: string;
        [key: string]: unknown;
      };
    },
    staleTime: 10000,
    retry: 1,
  });

  const cacheStats = {
    dtus: dbStatusResponse?.dtus ?? 0,
    events: dbStatusResponse?.events ?? 0,
    settings: dbStatusResponse?.settings ?? 0,
    totalSize: dbStatusResponse?.totalSize ?? '-- MB',
  };

  // Fetch pending sync items via useLensData
  const {
    items: syncItems,
    isLoading: syncLoading, isError: isError, error: error,
    remove: removeSyncItem,
    refetch: refetchSync,
  } = useLensData<SyncItem>('offline', 'sync-item', {
    seed: SEED_SYNC_ITEMS,
  });

  const pendingSync: SyncItem[] = syncItems.map((item) => {
    const d = item.data as unknown as SyncItem;
    return {
      id: item.id,
      type: d.type ?? 'dtu',
      action: d.action ?? 'create',
      timestamp: d.timestamp ?? item.createdAt,
      synced: d.synced ?? false,
    };
  });

  // Sync All mutation — calls apiHelpers.db.sync()
  const syncAllMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiHelpers.db.sync();
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db', 'status'] });
      qc.invalidateQueries({ queryKey: ['lens', 'offline', 'list'] });
    },
    onError: (err) => console.error('syncAllMut failed:', err instanceof Error ? err.message : err),
  });

  // Clear Cache mutation — deletes all sync items one by one
  const clearCacheMut = useMutation({
    mutationFn: async () => {
      const deletePromises = syncItems.map((item) => removeSyncItem(item.id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db', 'status'] });
      qc.invalidateQueries({ queryKey: ['lens', 'offline', 'list'] });
    },
    onError: (err) => console.error('clearCacheMut failed:', err instanceof Error ? err.message : err),
  });

  // Sync a single item
  const syncSingleMut = useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await apiHelpers.db.sync(1);
      await removeSyncItem(itemId);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lens', 'offline', 'list'] });
    },
    onError: (err) => console.error('syncSingleMut failed:', err instanceof Error ? err.message : err),
  });

  // Force Refresh — invalidate all queries to re-fetch from server
  const handleForceRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['db', 'status'] });
    qc.invalidateQueries({ queryKey: ['lens', 'offline', 'list'] });
    refetchSync();
  }, [qc, refetchSync]);

  const handleSyncAll = useCallback(() => {
    if (!isOnline) return;
    syncAllMut.mutate();
  }, [isOnline, syncAllMut]);

  const handleClearCache = useCallback(() => {
    clearCacheMut.mutate();
  }, [clearCacheMut]);

  const handleSyncSingle = useCallback(
    (itemId: string) => {
      if (!isOnline) return;
      syncSingleMut.mutate(itemId);
    },
    [isOnline, syncSingleMut]
  );

  const handleDeleteSingle = useCallback(
    (itemId: string) => {
      removeSyncItem(itemId);
    },
    [removeSyncItem]
  );

  const isLoading = statsLoading || syncLoading;
  const isSyncing = syncAllMut.isPending || syncSingleMut.isPending;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue" />
        <span className="ml-3 text-gray-400">Loading offline cache data...</span>
      </div>
    );
  }


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetchSync(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📴</span>
          <div>
            <h1 className="text-xl font-bold">Offline Lens</h1>
            <p className="text-sm text-gray-400">
              Dexie cache manager and sync queue resolution
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isOnline ? 'bg-neon-green/20 text-neon-green' : 'bg-neon-pink/20 text-neon-pink'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="offline" artifactId={items[0]?.id} compact />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{cacheStats.dtus}</p>
          <p className="text-sm text-gray-400">Cached DTUs</p>
        </div>
        <div className="lens-card">
          <RefreshCw className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{pendingSync.length}</p>
          <p className="text-sm text-gray-400">Pending Sync</p>
        </div>
        <div className="lens-card">
          <Download className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{cacheStats.totalSize}</p>
          <p className="text-sm text-gray-400">Cache Size</p>
        </div>
        <div className="lens-card">
          <Upload className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{cacheStats.events}</p>
          <p className="text-sm text-gray-400">Cached Events</p>
        </div>
      </div>

      {/* Sync Queue */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-neon-purple ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Queue
          </h2>
          <button
            className="btn-neon text-sm"
            disabled={!isOnline || isSyncing}
            onClick={handleSyncAll}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 inline animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2 inline" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </button>
        </div>
        <div className="space-y-2">
          {pendingSync.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No pending sync items</p>
          )}
          {pendingSync.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${item.synced ? 'bg-neon-green' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium capitalize">{item.action} {item.type}</p>
                  <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="p-2 bg-neon-green/20 text-neon-green rounded"
                  disabled={!isOnline || isSyncing}
                  onClick={() => handleSyncSingle(item.id)}
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  className="p-2 bg-neon-pink/20 text-neon-pink rounded"
                  onClick={() => handleDeleteSingle(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cache Management */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-neon-blue" />
          Cache Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            className="lens-card text-left hover:border-neon-green"
            onClick={handleSyncAll}
            disabled={!isOnline || isSyncing}
          >
            <Download className="w-5 h-5 text-neon-green mb-2" />
            <p className="font-medium">Download All</p>
            <p className="text-xs text-gray-400">Cache entire database locally</p>
          </button>
          <button
            className="lens-card text-left hover:border-neon-blue"
            onClick={handleForceRefresh}
          >
            <RefreshCw className="w-5 h-5 text-neon-blue mb-2" />
            <p className="font-medium">Force Refresh</p>
            <p className="text-xs text-gray-400">Re-sync from server</p>
          </button>
          <button
            className="lens-card text-left hover:border-neon-pink"
            onClick={handleClearCache}
            disabled={clearCacheMut.isPending}
          >
            <Trash2 className="w-5 h-5 text-neon-pink mb-2" />
            <p className="font-medium">{clearCacheMut.isPending ? 'Clearing...' : 'Clear Cache'}</p>
            <p className="text-xs text-gray-400">Remove all cached data</p>
          </button>
        </div>
      </div>
    </div>
  );
}
