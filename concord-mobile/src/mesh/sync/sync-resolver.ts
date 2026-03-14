// Concord Mobile — Sync Conflict Resolution
// Provides versioning, conflict detection, and merge strategies for DTU sync.
// Three strategies: last-write-wins (default), content-hash priority, manual.

import type { DTU } from '../../utils/types';

// ── Sync Metadata ────────────────────────────────────────────────────────────

export interface SyncMeta {
  dtuId: string;
  localVersion: number;
  remoteVersion: number;
  syncedAt: number;
  status: SyncStatus;
  conflictData?: ConflictRecord;
}

export type SyncStatus = 'synced' | 'pending_upload' | 'pending_download' | 'conflicted';

export interface ConflictRecord {
  localTimestamp: number;
  remoteTimestamp: number;
  localContentHash: string;
  remoteContentHash: string;
  detectedAt: number;
  resolution?: ConflictResolution;
}

export type MergeStrategy = 'last-write-wins' | 'content-hash-priority' | 'manual';

export interface ConflictResolution {
  strategy: MergeStrategy;
  winner: 'local' | 'remote';
  resolvedAt: number;
  resolvedBy: 'auto' | 'user';
}

// ── Version Clock ────────────────────────────────────────────────────────────

export interface VersionClock {
  deviceId: string;
  counter: number;
  timestamp: number;
}

// ── Sync Resolver ────────────────────────────────────────────────────────────

export interface SyncResolver {
  detectConflict(local: DTU, remote: DTU): ConflictRecord | null;
  resolve(local: DTU, remote: DTU, strategy: MergeStrategy): ConflictResolution;
  getSyncMeta(dtuId: string): SyncMeta | undefined;
  setSyncMeta(meta: SyncMeta): void;
  getPendingUploads(): SyncMeta[];
  getPendingDownloads(): SyncMeta[];
  getConflicts(): SyncMeta[];
  markSynced(dtuId: string, version: number): void;
  markDirty(dtuId: string): void;
  getStats(): SyncStats;
  clear(): void;
}

export interface SyncStats {
  totalTracked: number;
  synced: number;
  pendingUpload: number;
  pendingDownload: number;
  conflicted: number;
  lastSyncAt: number;
}

// ── Implementation ───────────────────────────────────────────────────────────

function contentHashHex(dtu: DTU): string {
  const hash = dtu.header.contentHash;
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createSyncResolver(_deviceId: string): SyncResolver {
  const metaMap = new Map<string, SyncMeta>();

  function detectConflict(local: DTU, remote: DTU): ConflictRecord | null {
    if (local.id !== remote.id) return null;

    const localHash = contentHashHex(local);
    const remoteHash = contentHashHex(remote);

    // Same content — no conflict
    if (localHash === remoteHash) return null;

    // Different content for the same DTU ID — conflict
    return {
      localTimestamp: local.header.timestamp,
      remoteTimestamp: remote.header.timestamp,
      localContentHash: localHash,
      remoteContentHash: remoteHash,
      detectedAt: Date.now(),
    };
  }

  function resolve(
    local: DTU,
    remote: DTU,
    strategy: MergeStrategy,
  ): ConflictResolution {
    let winner: 'local' | 'remote';

    switch (strategy) {
      case 'last-write-wins':
        winner = local.header.timestamp >= remote.header.timestamp ? 'local' : 'remote';
        break;

      case 'content-hash-priority': {
        // Deterministic: higher content hash wins (ensures all nodes converge)
        const localHash = contentHashHex(local);
        const remoteHash = contentHashHex(remote);
        winner = localHash >= remoteHash ? 'local' : 'remote';
        break;
      }

      case 'manual':
        // Default to local for manual — caller should present UI for user choice
        winner = 'local';
        break;
    }

    return {
      strategy,
      winner,
      resolvedAt: Date.now(),
      resolvedBy: strategy === 'manual' ? 'user' : 'auto',
    };
  }

  function getSyncMeta(dtuId: string): SyncMeta | undefined {
    return metaMap.get(dtuId);
  }

  function setSyncMeta(meta: SyncMeta): void {
    metaMap.set(meta.dtuId, meta);
  }

  function getPendingUploads(): SyncMeta[] {
    return [...metaMap.values()].filter(m => m.status === 'pending_upload');
  }

  function getPendingDownloads(): SyncMeta[] {
    return [...metaMap.values()].filter(m => m.status === 'pending_download');
  }

  function getConflicts(): SyncMeta[] {
    return [...metaMap.values()].filter(m => m.status === 'conflicted');
  }

  function markSynced(dtuId: string, version: number): void {
    const existing = metaMap.get(dtuId);
    metaMap.set(dtuId, {
      dtuId,
      localVersion: version,
      remoteVersion: version,
      syncedAt: Date.now(),
      status: 'synced',
      conflictData: existing?.status === 'conflicted' ? existing.conflictData : undefined,
    });
  }

  function markDirty(dtuId: string): void {
    const existing = metaMap.get(dtuId);
    if (existing) {
      existing.status = 'pending_upload';
      existing.localVersion += 1;
    } else {
      metaMap.set(dtuId, {
        dtuId,
        localVersion: 1,
        remoteVersion: 0,
        syncedAt: 0,
        status: 'pending_upload',
      });
    }
  }

  function getStats(): SyncStats {
    let synced = 0, pendingUpload = 0, pendingDownload = 0, conflicted = 0;
    let lastSyncAt = 0;

    for (const m of metaMap.values()) {
      switch (m.status) {
        case 'synced': synced++; break;
        case 'pending_upload': pendingUpload++; break;
        case 'pending_download': pendingDownload++; break;
        case 'conflicted': conflicted++; break;
      }
      if (m.syncedAt > lastSyncAt) lastSyncAt = m.syncedAt;
    }

    return {
      totalTracked: metaMap.size,
      synced,
      pendingUpload,
      pendingDownload,
      conflicted,
      lastSyncAt,
    };
  }

  function clear(): void {
    metaMap.clear();
  }

  return {
    detectConflict,
    resolve,
    getSyncMeta,
    setSyncMeta,
    getPendingUploads,
    getPendingDownloads,
    getConflicts,
    markSynced,
    markDirty,
    getStats,
    clear,
  };
}
