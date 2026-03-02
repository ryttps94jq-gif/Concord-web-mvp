// Concord Mobile — Shield: Quarantine Manager
// Manages quarantined DTUs that were flagged by the content scanner.
// Max quarantine size enforced. Oldest entries evicted when full.
// Release mechanism for false positives.

import {
  DTU,
  ThreatMatch,
  QuarantineEntry,
} from '../../utils/types';
import { SHIELD_QUARANTINE_MAX_SIZE } from '../../utils/constants';

// ── Quarantine Manager Interface ─────────────────────────────────────────────

export interface QuarantineManager {
  quarantine(dtu: DTU, reason: string, threats: ThreatMatch[]): void;
  release(dtuId: string): DTU | undefined;
  isQuarantined(dtuId: string): boolean;
  getQuarantined(): QuarantineEntry[];
  getQuarantinedCount(): number;
  clear(): void;
  pruneOld(maxAgeDays: number): number;
}

// ── Internal Storage ─────────────────────────────────────────────────────────

interface QuarantineRecord {
  entry: QuarantineEntry;
  dtu: DTU;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createQuarantineManager(maxSize?: number): QuarantineManager {
  const _maxSize = maxSize ?? SHIELD_QUARANTINE_MAX_SIZE;
  const _records: Map<string, QuarantineRecord> = new Map();
  // Insertion order tracking for eviction
  const _insertionOrder: string[] = [];

  function evictOldestIfNeeded(): void {
    while (_records.size >= _maxSize && _insertionOrder.length > 0) {
      const oldestId = _insertionOrder.shift()!;
      _records.delete(oldestId);
    }
  }

  function quarantine(dtu: DTU, reason: string, threats: ThreatMatch[]): void {
    // If already quarantined, update the record
    if (_records.has(dtu.id)) {
      const existing = _records.get(dtu.id)!;
      existing.entry.reason = reason;
      existing.entry.threats = threats;
      existing.entry.quarantinedAt = Date.now();
      return;
    }

    // Evict oldest if at capacity
    evictOldestIfNeeded();

    const entry: QuarantineEntry = {
      dtuId: dtu.id,
      reason,
      threats: [...threats],
      quarantinedAt: Date.now(),
      released: false,
    };

    _records.set(dtu.id, { entry, dtu });
    _insertionOrder.push(dtu.id);
  }

  function release(dtuId: string): DTU | undefined {
    const record = _records.get(dtuId);
    if (!record) {
      return undefined;
    }

    // Mark as released and remove from quarantine
    record.entry.released = true;
    const dtu = record.dtu;
    _records.delete(dtuId);

    // Remove from insertion order
    const idx = _insertionOrder.indexOf(dtuId);
    if (idx !== -1) {
      _insertionOrder.splice(idx, 1);
    }

    return dtu;
  }

  function isQuarantined(dtuId: string): boolean {
    return _records.has(dtuId);
  }

  function getQuarantined(): QuarantineEntry[] {
    return Array.from(_records.values()).map(r => ({ ...r.entry }));
  }

  function getQuarantinedCount(): number {
    return _records.size;
  }

  function clear(): void {
    _records.clear();
    _insertionOrder.length = 0;
  }

  function pruneOld(maxAgeDays: number): number {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let pruned = 0;

    const toRemove: string[] = [];
    for (const [id, record] of _records) {
      if (record.entry.quarantinedAt < cutoff) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      _records.delete(id);
      const idx = _insertionOrder.indexOf(id);
      if (idx !== -1) {
        _insertionOrder.splice(idx, 1);
      }
      pruned++;
    }

    return pruned;
  }

  return {
    quarantine,
    release,
    isQuarantined,
    getQuarantined,
    getQuarantinedCount,
    clear,
    pruneOld,
  };
}
