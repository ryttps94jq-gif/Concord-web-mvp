/**
 * Sovereign store — dream capture, promotion queue, focus override,
 * and sovereign-only command state.
 *
 * Fed by socket events (dream:captured, promotion:*, attention:allocation)
 * and API polling for initial loads.
 */

import { create } from 'zustand';
import type { Dream, Promotion, FocusOverride } from '@/lib/types/system';

interface SovereignState {
  // Dream capture
  dreams: Dream[];
  convergenceCount: number;
  setDreams: (dreams: Dream[]) => void;
  addDream: (dream: Dream) => void;
  setConvergenceCount: (count: number) => void;

  // Promotion pipeline
  promotionQueue: Promotion[];
  setPromotionQueue: (queue: Promotion[]) => void;
  updatePromotion: (id: string, update: Partial<Promotion>) => void;
  removePromotion: (id: string) => void;

  // Meta-derivation events
  recentMetaEvents: Array<{ id: string; summary: string; timestamp: string; type: string }>;
  addMetaEvent: (event: { id: string; summary: string; timestamp: string; type: string }) => void;
}

export const useSovereignStore = create<SovereignState>((set, get) => ({
  dreams: [],
  convergenceCount: 0,
  setDreams: (dreams) => set({ dreams }),
  addDream: (dream) =>
    set((state) => ({
      dreams: [dream, ...state.dreams].slice(0, 50),
      convergenceCount: dream.convergence
        ? state.convergenceCount + 1
        : state.convergenceCount,
    })),
  setConvergenceCount: (count) => set({ convergenceCount: count }),

  promotionQueue: [],
  setPromotionQueue: (queue) => set({ promotionQueue: queue }),
  updatePromotion: (id, update) =>
    set((state) => ({
      promotionQueue: state.promotionQueue.map((p) =>
        p.id === id ? { ...p, ...update } : p
      ),
    })),
  removePromotion: (id) =>
    set((state) => ({
      promotionQueue: state.promotionQueue.filter((p) => p.id !== id),
    })),

  recentMetaEvents: [],
  addMetaEvent: (event) =>
    set((state) => ({
      recentMetaEvents: [event, ...state.recentMetaEvents].slice(0, 30),
    })),
}));
