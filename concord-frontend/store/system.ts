/**
 * System store — brain metrics, repair status, attention, forgetting, fleet status.
 *
 * Fed by socket events and periodic API polling.
 * Does NOT duplicate server data — holds ephemeral real-time snapshots only.
 */

import { create } from 'zustand';
import type {
  BrainMetric,
  BrainName,
  RepairStatus,
  AttentionAllocation,
  FocusOverride,
  ForgettingStats,
  GhostFleetStatus,
  SystemAlert,
  LLMQueueMetrics,
} from '@/lib/types/system';

interface SystemState {
  // Brain metrics
  brainMetrics: Partial<Record<BrainName, BrainMetric>>;
  setBrainMetrics: (metrics: Partial<Record<BrainName, BrainMetric>>) => void;
  updateBrain: (name: BrainName, update: Partial<BrainMetric>) => void;

  // Repair cortex
  repairStatus: RepairStatus | null;
  setRepairStatus: (status: RepairStatus) => void;

  // Attention allocator
  attentionAllocation: AttentionAllocation[];
  focusOverride: FocusOverride | null;
  setAttentionAllocation: (alloc: AttentionAllocation[]) => void;
  setFocusOverride: (override: FocusOverride | null) => void;

  // Forgetting engine
  forgettingStats: ForgettingStats | null;
  setForgettingStats: (stats: ForgettingStats) => void;

  // Ghost fleet
  ghostFleet: GhostFleetStatus | null;
  setGhostFleet: (status: GhostFleetStatus) => void;

  // LLM queue
  llmQueue: LLMQueueMetrics | null;
  setLLMQueue: (metrics: LLMQueueMetrics) => void;

  // System alerts (real-time, ephemeral)
  systemAlerts: SystemAlert[];
  addSystemAlert: (alert: SystemAlert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;

  // Aggregate counters
  entityCount: number;
  uptimeSeconds: number;
  setEntityCount: (count: number) => void;
  setUptimeSeconds: (seconds: number) => void;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  brainMetrics: {},
  setBrainMetrics: (metrics) => set({ brainMetrics: metrics }),
  updateBrain: (name, update) => {
    const { brainMetrics } = get();
    const existing = brainMetrics[name];
    if (existing) {
      set({ brainMetrics: { ...brainMetrics, [name]: { ...existing, ...update } } });
    }
  },

  repairStatus: null,
  setRepairStatus: (status) => set({ repairStatus: status }),

  attentionAllocation: [],
  focusOverride: null,
  setAttentionAllocation: (alloc) => set({ attentionAllocation: alloc }),
  setFocusOverride: (override) => set({ focusOverride: override }),

  forgettingStats: null,
  setForgettingStats: (stats) => set({ forgettingStats: stats }),

  ghostFleet: null,
  setGhostFleet: (status) => set({ ghostFleet: status }),

  llmQueue: null,
  setLLMQueue: (metrics) => set({ llmQueue: metrics }),

  systemAlerts: [],
  addSystemAlert: (alert) =>
    set((state) => ({
      systemAlerts: [...state.systemAlerts.slice(-49), alert],
    })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      systemAlerts: state.systemAlerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
    })),
  clearAlerts: () => set({ systemAlerts: [] }),

  entityCount: 0,
  uptimeSeconds: 0,
  setEntityCount: (count) => set({ entityCount: count }),
  setUptimeSeconds: (seconds) => set({ uptimeSeconds: seconds }),
}));
