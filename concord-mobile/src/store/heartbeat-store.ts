// Concord Mobile — Heartbeat Engine
// Background 15-second tick driving BLE scan, Foundation Sense, relay processing,
// and transaction propagation.
//
// Adaptive intervals:
//   100-30%  battery → 15s  (HEARTBEAT_INTERVAL_MS)
//   30-15%   battery → 30s  (HEARTBEAT_LOW_BATTERY_INTERVAL_MS)
//   15-5%    battery → 60s  (HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS)
//   <5%      battery → dormant (no ticking)
//
// Crash recovery: tick handler errors are caught and logged, never kill heartbeat.

import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_LOW_BATTERY_INTERVAL_MS,
  HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS,
  HEARTBEAT_DORMANT_BATTERY_THRESHOLD,
} from '../utils/constants';
import type { HeartbeatState, MeshHealth } from '../utils/types';

// ── Dependencies ─────────────────────────────────────────────────────────────

export interface MeshControllerDep {
  scanPeers(): Promise<void>;
  getMeshHealth(): MeshHealth;
}

export interface FoundationCaptureDep {
  captureReading(): Promise<void>;
  getReadingsCount(): number;
}

export interface RelayEngineDep {
  processQueue(): Promise<number>; // returns number processed
}

export interface LedgerDep {
  getUnpropagated(): Promise<{ id: string }[]>;
  markPropagated(id: string): Promise<void>;
}

export interface HeartbeatDeps {
  meshController: MeshControllerDep;
  foundationCapture: FoundationCaptureDep;
  relayEngine: RelayEngineDep;
  ledger: LedgerDep;
}

// ── Heartbeat Engine Interface ───────────────────────────────────────────────

export interface HeartbeatEngine {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  tick(): Promise<void>;
  getState(): HeartbeatState;
  setBatteryLevel(level: number): void;
  getInterval(): number;
  onTick(callback: (state: HeartbeatState) => void): () => void;
}

// ── Interval Calculation ─────────────────────────────────────────────────────

function computeInterval(batteryLevel: number): number {
  if (batteryLevel < HEARTBEAT_DORMANT_BATTERY_THRESHOLD) {
    return 0; // dormant
  }
  if (batteryLevel < 15) {
    return HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS;
  }
  if (batteryLevel < 30) {
    return HEARTBEAT_LOW_BATTERY_INTERVAL_MS;
  }
  return HEARTBEAT_INTERVAL_MS;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createHeartbeatEngine(deps: HeartbeatDeps): HeartbeatEngine {
  let running = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let batteryLevel = 100;
  let tickCount = 0;
  let lastTickAt = 0;
  let relayQueueProcessed = 0;
  const listeners: Set<(state: HeartbeatState) => void> = new Set();

  function getInterval(): number {
    return computeInterval(batteryLevel);
  }

  function buildState(): HeartbeatState {
    let meshHealth: MeshHealth;
    try {
      meshHealth = deps.meshController.getMeshHealth();
    } catch {
      meshHealth = {
        connectedPeers: 0,
        activeTransports: 0,
        relayQueueDepth: 0,
        dtusPropagated: 0,
        dtusReceived: 0,
        uptime: 0,
      };
    }

    let foundationReadingsCount = 0;
    try {
      foundationReadingsCount = deps.foundationCapture.getReadingsCount();
    } catch {
      // Safe fallback
    }

    return {
      tickCount,
      lastTickAt,
      intervalMs: getInterval(),
      batteryLevel,
      meshHealthSnapshot: meshHealth,
      foundationReadingsCount,
      relayQueueProcessed,
    };
  }

  function notifyListeners(): void {
    const state = buildState();
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // Listener errors must not crash heartbeat
      }
    }
  }

  async function executeTick(): Promise<void> {
    const interval = getInterval();
    if (interval === 0) {
      // Dormant mode — skip tick
      return;
    }

    tickCount++;
    lastTickAt = Date.now();

    // Step 1: BLE scan (crash-safe)
    try {
      await deps.meshController.scanPeers();
    } catch {
      // BLE scan failure is non-fatal
    }

    // Step 2: Foundation Sense reading (crash-safe)
    try {
      await deps.foundationCapture.captureReading();
    } catch {
      // Sensor capture failure is non-fatal
    }

    // Step 3: Relay queue processing (crash-safe)
    try {
      const processed = await deps.relayEngine.processQueue();
      relayQueueProcessed += processed;
    } catch {
      // Relay processing failure is non-fatal
    }

    // Step 4: Pending transaction propagation (crash-safe)
    try {
      const unpropagated = await deps.ledger.getUnpropagated();
      for (const tx of unpropagated) {
        try {
          await deps.ledger.markPropagated(tx.id);
        } catch {
          // Individual propagation failure is non-fatal
        }
      }
    } catch {
      // Ledger access failure is non-fatal
    }

    notifyListeners();
  }

  function scheduleNext(): void {
    if (!running) return;

    const interval = getInterval();
    if (interval === 0) {
      // Dormant — check again in 60s to see if battery recovered
      timerId = setTimeout(() => {
        if (running) {
          scheduleNext();
        }
      }, HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
      return;
    }

    timerId = setTimeout(async () => {
      if (!running) return;

      try {
        await executeTick();
      } catch {
        // Tick errors must NEVER kill the heartbeat
      }

      scheduleNext();
    }, interval);
  }

  function start(): void {
    if (running) return;
    running = true;
    tickCount = 0;
    lastTickAt = 0;
    relayQueueProcessed = 0;
    scheduleNext();
  }

  function stop(): void {
    running = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function isRunning(): boolean {
    return running;
  }

  async function tick(): Promise<void> {
    await executeTick();
  }

  function getState(): HeartbeatState {
    return buildState();
  }

  function setBatteryLevel(level: number): void {
    batteryLevel = Math.max(0, Math.min(100, level));

    // If running, reschedule with new interval
    if (running && timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
      scheduleNext();
    }
  }

  function onTick(callback: (state: HeartbeatState) => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  return {
    start,
    stop,
    isRunning,
    tick,
    getState,
    setBatteryLevel,
    getInterval,
    onTick,
  };
}

// Export for testing
export { computeInterval };
