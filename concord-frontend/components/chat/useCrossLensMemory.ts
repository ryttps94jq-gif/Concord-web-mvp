'use client';

/**
 * useCrossLensMemory — Tracks which lenses a conversation has crossed.
 *
 * Features:
 *   - Lens trail breadcrumb (ordered list of visited lenses)
 *   - Memory context badge (how many lenses of context the AI has)
 *   - Toggle to clear/preserve cross-lens memory
 *   - Persisted to sessionStorage for tab lifetime
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LensTrailEntry, CrossLensMemoryState } from './ChatModeTypes';

const STORAGE_KEY = 'concord_cross_lens_memory';

function loadFromStorage(): CrossLensMemoryState {
  if (typeof window === 'undefined') {
    return { trail: [], totalLensCount: 0, memoryPreserved: true };
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return { trail: [], totalLensCount: 0, memoryPreserved: true };
}

function saveToStorage(state: CrossLensMemoryState): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function useCrossLensMemory(currentLens: string) {
  const [state, setState] = useState<CrossLensMemoryState>(loadFromStorage);
  const prevLensRef = useRef<string>(currentLens);

  // Track lens transitions
  useEffect(() => {
    if (currentLens === prevLensRef.current) return;
    prevLensRef.current = currentLens;

    setState(prev => {
      // Check if this lens was the most recent entry
      const lastEntry = prev.trail[prev.trail.length - 1];
      if (lastEntry?.lens === currentLens) return prev;

      // Update the trail: increment count if already visited, or add new entry
      const existingIndex = prev.trail.findIndex(e => e.lens === currentLens);
      let newTrail: LensTrailEntry[];

      if (existingIndex !== -1) {
        // Lens was visited before — move to end and increment count
        const existing = prev.trail[existingIndex];
        newTrail = [
          ...prev.trail.slice(0, existingIndex),
          ...prev.trail.slice(existingIndex + 1),
          { ...existing, messageCount: existing.messageCount, enteredAt: new Date().toISOString() },
        ];
      } else {
        // New lens
        newTrail = [
          ...prev.trail,
          { lens: currentLens, enteredAt: new Date().toISOString(), messageCount: 0 },
        ];
      }

      const uniqueLenses = new Set(newTrail.map(e => e.lens));
      const newState: CrossLensMemoryState = {
        trail: newTrail,
        totalLensCount: uniqueLenses.size,
        memoryPreserved: prev.memoryPreserved,
      };
      saveToStorage(newState);
      return newState;
    });
  }, [currentLens]);

  // Increment message count for current lens
  const recordMessage = useCallback(() => {
    setState(prev => {
      const newTrail = prev.trail.map(entry =>
        entry.lens === currentLens
          ? { ...entry, messageCount: entry.messageCount + 1 }
          : entry
      );

      // If current lens isn't tracked yet, add it
      const hasEntry = newTrail.some(e => e.lens === currentLens);
      if (!hasEntry) {
        newTrail.push({
          lens: currentLens,
          enteredAt: new Date().toISOString(),
          messageCount: 1,
        });
      }

      const uniqueLenses = new Set(newTrail.map(e => e.lens));
      const newState: CrossLensMemoryState = {
        trail: newTrail,
        totalLensCount: uniqueLenses.size,
        memoryPreserved: prev.memoryPreserved,
      };
      saveToStorage(newState);
      return newState;
    });
  }, [currentLens]);

  // Toggle memory preservation
  const toggleMemoryPreserved = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, memoryPreserved: !prev.memoryPreserved };
      saveToStorage(newState);
      return newState;
    });
  }, []);

  // Clear the lens trail (start fresh)
  const clearTrail = useCallback(() => {
    const newState: CrossLensMemoryState = {
      trail: [{
        lens: currentLens,
        enteredAt: new Date().toISOString(),
        messageCount: 0,
      }],
      totalLensCount: 1,
      memoryPreserved: true,
    };
    saveToStorage(newState);
    setState(newState);
  }, [currentLens]);

  return {
    trail: state.trail,
    totalLensCount: state.totalLensCount,
    memoryPreserved: state.memoryPreserved,
    recordMessage,
    toggleMemoryPreserved,
    clearTrail,
  };
}
