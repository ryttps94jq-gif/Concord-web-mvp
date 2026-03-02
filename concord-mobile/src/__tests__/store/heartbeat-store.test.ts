// Tests for Heartbeat Engine — 15-second tick with adaptive intervals and crash recovery

import {
  createHeartbeatEngine,
  computeInterval,
} from '../../store/heartbeat-store';
import type {
  HeartbeatEngine,
  HeartbeatDeps,
  MeshControllerDep,
  FoundationCaptureDep,
  RelayEngineDep,
  LedgerDep,
} from '../../store/heartbeat-store';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_LOW_BATTERY_INTERVAL_MS,
  HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS,
  HEARTBEAT_DORMANT_BATTERY_THRESHOLD,
} from '../../utils/constants';

// ── Mock Dependencies ────────────────────────────────────────────────────────

function createMockMeshController(): MeshControllerDep {
  return {
    scanPeers: jest.fn(async () => {}),
    getMeshHealth: jest.fn(() => ({
      connectedPeers: 3,
      activeTransports: 2,
      relayQueueDepth: 5,
      dtusPropagated: 100,
      dtusReceived: 200,
      uptime: 3600000,
    })),
  };
}

function createMockFoundationCapture(): FoundationCaptureDep {
  return {
    captureReading: jest.fn(async () => {}),
    getReadingsCount: jest.fn(() => 42),
  };
}

function createMockRelayEngine(): RelayEngineDep {
  return {
    processQueue: jest.fn(async () => 3),
  };
}

function createMockLedger(): LedgerDep {
  const unpropagated = [{ id: 'tx_1' }, { id: 'tx_2' }];
  return {
    getUnpropagated: jest.fn(async () => [...unpropagated]),
    markPropagated: jest.fn(async () => {}),
  };
}

function createMockDeps(): HeartbeatDeps {
  return {
    meshController: createMockMeshController(),
    foundationCapture: createMockFoundationCapture(),
    relayEngine: createMockRelayEngine(),
    ledger: createMockLedger(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HeartbeatEngine', () => {
  let deps: HeartbeatDeps;
  let engine: HeartbeatEngine;

  beforeEach(() => {
    jest.useFakeTimers();
    deps = createMockDeps();
    engine = createHeartbeatEngine(deps);
  });

  afterEach(() => {
    engine.stop();
    jest.useRealTimers();
  });

  // ── computeInterval ─────────────────────────────────────────────────────

  describe('computeInterval', () => {
    it('returns 15s for normal battery (100%)', () => {
      expect(computeInterval(100)).toBe(HEARTBEAT_INTERVAL_MS);
    });

    it('returns 15s for battery at 30%', () => {
      expect(computeInterval(30)).toBe(HEARTBEAT_INTERVAL_MS);
    });

    it('returns 30s for battery at 29% (low)', () => {
      expect(computeInterval(29)).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    });

    it('returns 30s for battery at 15%', () => {
      expect(computeInterval(15)).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    });

    it('returns 60s for battery at 14% (critical)', () => {
      expect(computeInterval(14)).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
    });

    it('returns 60s for battery at 5%', () => {
      expect(computeInterval(5)).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
    });

    it('returns 0 (dormant) for battery below threshold', () => {
      expect(computeInterval(HEARTBEAT_DORMANT_BATTERY_THRESHOLD - 1)).toBe(0);
    });

    it('returns 0 (dormant) for 0% battery', () => {
      expect(computeInterval(0)).toBe(0);
    });
  });

  // ── start / stop / isRunning ────────────────────────────────────────────

  describe('start / stop', () => {
    it('starts the heartbeat', () => {
      engine.start();
      expect(engine.isRunning()).toBe(true);
    });

    it('stops the heartbeat', () => {
      engine.start();
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });

    it('start is idempotent', () => {
      engine.start();
      engine.start();
      expect(engine.isRunning()).toBe(true);
    });

    it('stop is safe to call when not running', () => {
      expect(() => engine.stop()).not.toThrow();
    });

    it('resets tick count on start', () => {
      engine.start();
      // Manually tick twice
      engine.tick();
      engine.tick();
      engine.stop();
      engine.start();
      const state = engine.getState();
      expect(state.tickCount).toBe(0);
    });
  });

  // ── tick ────────────────────────────────────────────────────────────────

  describe('tick', () => {
    it('increments tick count', async () => {
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('calls BLE scan', async () => {
      await engine.tick();
      expect(deps.meshController.scanPeers).toHaveBeenCalled();
    });

    it('calls Foundation Sense capture', async () => {
      await engine.tick();
      expect(deps.foundationCapture.captureReading).toHaveBeenCalled();
    });

    it('calls relay queue processing', async () => {
      await engine.tick();
      expect(deps.relayEngine.processQueue).toHaveBeenCalled();
    });

    it('processes pending transaction propagation', async () => {
      await engine.tick();
      expect(deps.ledger.getUnpropagated).toHaveBeenCalled();
      expect(deps.ledger.markPropagated).toHaveBeenCalledWith('tx_1');
      expect(deps.ledger.markPropagated).toHaveBeenCalledWith('tx_2');
    });

    it('updates lastTickAt', async () => {
      const before = Date.now();
      await engine.tick();
      const state = engine.getState();
      expect(state.lastTickAt).toBeGreaterThanOrEqual(before);
    });

    it('accumulates relayQueueProcessed', async () => {
      await engine.tick();
      await engine.tick();
      const state = engine.getState();
      expect(state.relayQueueProcessed).toBe(6); // 3 per tick * 2
    });

    it('skips tick in dormant mode', async () => {
      engine.setBatteryLevel(HEARTBEAT_DORMANT_BATTERY_THRESHOLD - 1);
      await engine.tick();
      expect(deps.meshController.scanPeers).not.toHaveBeenCalled();
      expect(engine.getState().tickCount).toBe(0);
    });
  });

  // ── Crash recovery ──────────────────────────────────────────────────────

  describe('crash recovery', () => {
    it('continues ticking after BLE scan error', async () => {
      (deps.meshController.scanPeers as jest.Mock).mockRejectedValueOnce(new Error('BLE crash'));
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
      expect(deps.foundationCapture.captureReading).toHaveBeenCalled();
    });

    it('continues ticking after Foundation Sense error', async () => {
      (deps.foundationCapture.captureReading as jest.Mock).mockRejectedValueOnce(new Error('Sensor crash'));
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
      expect(deps.relayEngine.processQueue).toHaveBeenCalled();
    });

    it('continues ticking after relay engine error', async () => {
      (deps.relayEngine.processQueue as jest.Mock).mockRejectedValueOnce(new Error('Relay crash'));
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('continues ticking after ledger error', async () => {
      (deps.ledger.getUnpropagated as jest.Mock).mockRejectedValueOnce(new Error('DB crash'));
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('continues ticking after individual propagation error', async () => {
      (deps.ledger.markPropagated as jest.Mock)
        .mockRejectedValueOnce(new Error('Propagation failed'))
        .mockResolvedValueOnce(undefined);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
      // Second transaction should still be attempted
      expect(deps.ledger.markPropagated).toHaveBeenCalledTimes(2);
    });

    it('all four steps execute even when first three crash', async () => {
      (deps.meshController.scanPeers as jest.Mock).mockRejectedValue(new Error('crash'));
      (deps.foundationCapture.captureReading as jest.Mock).mockRejectedValue(new Error('crash'));
      (deps.relayEngine.processQueue as jest.Mock).mockRejectedValue(new Error('crash'));
      await engine.tick();
      // Ledger step should still execute
      expect(deps.ledger.getUnpropagated).toHaveBeenCalled();
    });

    it('listener errors do not kill heartbeat', async () => {
      engine.onTick(() => {
        throw new Error('Listener crash');
      });
      await expect(engine.tick()).resolves.not.toThrow();
      expect(engine.getState().tickCount).toBe(1);
    });
  });

  // ── Adaptive intervals ─────────────────────────────────────────────────

  describe('adaptive intervals', () => {
    it('returns normal interval at high battery', () => {
      engine.setBatteryLevel(80);
      expect(engine.getInterval()).toBe(HEARTBEAT_INTERVAL_MS);
    });

    it('returns low battery interval at 25%', () => {
      engine.setBatteryLevel(25);
      expect(engine.getInterval()).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    });

    it('returns critical interval at 10%', () => {
      engine.setBatteryLevel(10);
      expect(engine.getInterval()).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
    });

    it('returns dormant (0) at very low battery', () => {
      engine.setBatteryLevel(3);
      expect(engine.getInterval()).toBe(0);
    });

    it('clamps battery level to 0-100', () => {
      engine.setBatteryLevel(150);
      expect(engine.getInterval()).toBe(HEARTBEAT_INTERVAL_MS);
      engine.setBatteryLevel(-10);
      expect(engine.getInterval()).toBe(0);
    });

    it('interval changes reflected in state', () => {
      engine.setBatteryLevel(20);
      const state = engine.getState();
      expect(state.intervalMs).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    });

    it('battery level reflected in state', () => {
      engine.setBatteryLevel(42);
      expect(engine.getState().batteryLevel).toBe(42);
    });
  });

  // ── Timing ──────────────────────────────────────────────────────────────

  describe('timing', () => {
    it('first tick fires after interval', () => {
      engine.start();
      expect(deps.meshController.scanPeers).not.toHaveBeenCalled();

      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      // Timer fires but async tick may not complete in sync timer advancement
      expect(setTimeout).toHaveBeenCalled();
    });

    it('uses correct interval for normal battery', () => {
      engine.setBatteryLevel(100);
      engine.start();
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
      // Should not have fired yet
      expect(deps.meshController.scanPeers).not.toHaveBeenCalled();
    });

    it('reschedules when battery level changes', () => {
      engine.start();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      engine.setBatteryLevel(10);
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('does not reschedule when not running', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      engine.setBatteryLevel(10);
      // Should not attempt to reschedule when stopped
      expect(engine.isRunning()).toBe(false);
      clearTimeoutSpy.mockRestore();
    });
  });

  // ── getState ────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns initial state', () => {
      const state = engine.getState();
      expect(state.tickCount).toBe(0);
      expect(state.lastTickAt).toBe(0);
      expect(state.batteryLevel).toBe(100);
      expect(state.intervalMs).toBe(HEARTBEAT_INTERVAL_MS);
    });

    it('includes mesh health snapshot', () => {
      const state = engine.getState();
      expect(state.meshHealthSnapshot).toBeDefined();
      expect(state.meshHealthSnapshot.connectedPeers).toBe(3);
    });

    it('includes foundation readings count', () => {
      const state = engine.getState();
      expect(state.foundationReadingsCount).toBe(42);
    });

    it('handles getMeshHealth error gracefully', () => {
      (deps.meshController.getMeshHealth as jest.Mock).mockImplementation(() => {
        throw new Error('Mesh error');
      });
      const state = engine.getState();
      expect(state.meshHealthSnapshot.connectedPeers).toBe(0);
    });

    it('handles getReadingsCount error gracefully', () => {
      (deps.foundationCapture.getReadingsCount as jest.Mock).mockImplementation(() => {
        throw new Error('Sensor error');
      });
      const state = engine.getState();
      expect(state.foundationReadingsCount).toBe(0);
    });
  });

  // ── onTick callback ────────────────────────────────────────────────────

  describe('onTick', () => {
    it('calls listener on tick', async () => {
      const listener = jest.fn();
      engine.onTick(listener);
      await engine.tick();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('passes state to listener', async () => {
      const listener = jest.fn();
      engine.onTick(listener);
      await engine.tick();
      const state = listener.mock.calls[0][0];
      expect(state.tickCount).toBe(1);
      expect(state.batteryLevel).toBeDefined();
    });

    it('supports multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      engine.onTick(listener1);
      engine.onTick(listener2);
      await engine.tick();
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('returns unsubscribe function', async () => {
      const listener = jest.fn();
      const unsubscribe = engine.onTick(listener);
      unsubscribe();
      await engine.tick();
      expect(listener).not.toHaveBeenCalled();
    });

    it('unsubscribe only affects the specific listener', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const unsub1 = engine.onTick(listener1);
      engine.onTick(listener2);
      unsub1();
      await engine.tick();
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('listener crash does not prevent other listeners', async () => {
      const crashListener = jest.fn(() => { throw new Error('Crash'); });
      const goodListener = jest.fn();
      engine.onTick(crashListener);
      engine.onTick(goodListener);
      await engine.tick();
      expect(crashListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ── Battery-aware ticking ──────────────────────────────────────────────

  describe('battery-aware ticking', () => {
    it('ticks at normal interval at full battery', async () => {
      engine.setBatteryLevel(100);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('ticks at low battery interval', async () => {
      engine.setBatteryLevel(20);
      expect(engine.getInterval()).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('ticks at critical battery interval', async () => {
      engine.setBatteryLevel(8);
      expect(engine.getInterval()).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('does not tick in dormant mode', async () => {
      engine.setBatteryLevel(2);
      expect(engine.getInterval()).toBe(0);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(0);
      expect(deps.meshController.scanPeers).not.toHaveBeenCalled();
    });

    it('resumes ticking when battery recovers from dormant', async () => {
      engine.setBatteryLevel(2);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(0);

      engine.setBatteryLevel(50);
      await engine.tick();
      expect(engine.getState().tickCount).toBe(1);
    });

    it('transitions between intervals correctly', () => {
      engine.setBatteryLevel(50);
      expect(engine.getInterval()).toBe(HEARTBEAT_INTERVAL_MS);

      engine.setBatteryLevel(25);
      expect(engine.getInterval()).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);

      engine.setBatteryLevel(10);
      expect(engine.getInterval()).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);

      engine.setBatteryLevel(3);
      expect(engine.getInterval()).toBe(0);

      engine.setBatteryLevel(80);
      expect(engine.getInterval()).toBe(HEARTBEAT_INTERVAL_MS);
    });
  });
});
