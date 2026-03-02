// Concord Mobile — Shield Store (Zustand)
// Manages threat detection, quarantine, and collective immunity state

import { create } from 'zustand';
import type { ThreatSignature, QuarantineEntry, ScanResult } from '../utils/types';
import { SHIELD_QUARANTINE_MAX_SIZE } from '../utils/constants';

interface ShieldStore {
  // Threat signatures
  signatures: ThreatSignature[];
  signatureVersion: number;
  setSignatures: (sigs: ThreatSignature[]) => void;
  mergeSignatures: (incoming: ThreatSignature[]) => void;

  // Quarantine
  quarantine: Map<string, QuarantineEntry>;
  quarantineCount: number;
  addToQuarantine: (entry: QuarantineEntry) => void;
  releaseFromQuarantine: (dtuId: string) => QuarantineEntry | undefined;
  isQuarantined: (dtuId: string) => boolean;
  getQuarantineEntries: () => QuarantineEntry[];
  pruneQuarantine: (maxAgeDays: number) => number;

  // Scan results
  recentScans: ScanResult[];
  totalScanned: number;
  threatsDetected: number;
  addScanResult: (result: ScanResult) => void;
  getRecentScans: (limit: number) => ScanResult[];

  reset: () => void;
}

export const useShieldStore = create<ShieldStore>((set, get) => ({
  signatures: [],
  signatureVersion: 0,
  quarantine: new Map(),
  quarantineCount: 0,
  recentScans: [],
  totalScanned: 0,
  threatsDetected: 0,

  setSignatures: (sigs) => set({
    signatures: sigs,
    signatureVersion: Math.max(...sigs.map(s => s.version), 0),
  }),

  mergeSignatures: (incoming) => set(state => {
    const existing = new Map(state.signatures.map(s => [s.id, s]));
    for (const sig of incoming) {
      const current = existing.get(sig.id);
      if (!current || sig.version > current.version) {
        existing.set(sig.id, sig);
      }
    }
    const merged = Array.from(existing.values());
    return {
      signatures: merged,
      signatureVersion: Math.max(...merged.map(s => s.version), 0),
    };
  }),

  addToQuarantine: (entry) => set(state => {
    const quarantine = new Map(state.quarantine);

    // Enforce max size — evict oldest if full
    if (quarantine.size >= SHIELD_QUARANTINE_MAX_SIZE) {
      let oldestId = '';
      let oldestTime = Infinity;
      for (const [id, e] of quarantine) {
        if (e.quarantinedAt < oldestTime) {
          oldestTime = e.quarantinedAt;
          oldestId = id;
        }
      }
      if (oldestId) quarantine.delete(oldestId);
    }

    quarantine.set(entry.dtuId, entry);
    return { quarantine, quarantineCount: quarantine.size };
  }),

  releaseFromQuarantine: (dtuId) => {
    const state = get();
    const entry = state.quarantine.get(dtuId);
    if (!entry) return undefined;

    set(state => {
      const quarantine = new Map(state.quarantine);
      quarantine.delete(dtuId);
      return { quarantine, quarantineCount: quarantine.size };
    });

    return { ...entry, released: true };
  },

  isQuarantined: (dtuId) => get().quarantine.has(dtuId),

  getQuarantineEntries: () => Array.from(get().quarantine.values()),

  pruneQuarantine: (maxAgeDays) => {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let pruned = 0;
    set(state => {
      const quarantine = new Map(state.quarantine);
      for (const [id, entry] of quarantine) {
        if (entry.quarantinedAt < cutoff && !entry.released) {
          quarantine.delete(id);
          pruned++;
        }
      }
      return { quarantine, quarantineCount: quarantine.size };
    });
    return pruned;
  },

  addScanResult: (result) => set(state => ({
    recentScans: [result, ...state.recentScans].slice(0, 1000),
    totalScanned: state.totalScanned + 1,
    threatsDetected: state.threatsDetected + (result.clean ? 0 : 1),
  })),

  getRecentScans: (limit) => get().recentScans.slice(0, limit),

  reset: () => set({
    signatures: [],
    signatureVersion: 0,
    quarantine: new Map(),
    quarantineCount: 0,
    recentScans: [],
    totalScanned: 0,
    threatsDetected: 0,
  }),
}));
