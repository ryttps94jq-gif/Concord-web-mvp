import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemStore } from '@/store/system';
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

function makeBrainMetric(overrides: Partial<BrainMetric> = {}): BrainMetric {
  return {
    name: 'conscious',
    url: 'http://localhost:11434',
    model: 'qwen2.5:7b',
    role: 'conscious',
    enabled: true,
    stats: {
      requests: 100,
      totalMs: 50000,
      dtusGenerated: 25,
      errors: 2,
      lastCallAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

function makeSystemAlert(overrides: Partial<SystemAlert> = {}): SystemAlert {
  return {
    id: `alert-${Math.random().toString(36).slice(2, 8)}`,
    type: 'info',
    message: 'Test alert',
    source: 'test',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('System Store', () => {
  beforeEach(() => {
    useSystemStore.setState({
      brainMetrics: {},
      repairStatus: null,
      attentionAllocation: [],
      focusOverride: null,
      forgettingStats: null,
      ghostFleet: null,
      llmQueue: null,
      systemAlerts: [],
      entityCount: 0,
      uptimeSeconds: 0,
    });
  });

  describe('initial state', () => {
    it('has empty brain metrics', () => {
      expect(useSystemStore.getState().brainMetrics).toEqual({});
    });

    it('has null repair status', () => {
      expect(useSystemStore.getState().repairStatus).toBeNull();
    });

    it('has empty attention allocation', () => {
      expect(useSystemStore.getState().attentionAllocation).toEqual([]);
    });

    it('has null focus override', () => {
      expect(useSystemStore.getState().focusOverride).toBeNull();
    });

    it('has null forgetting stats', () => {
      expect(useSystemStore.getState().forgettingStats).toBeNull();
    });

    it('has null ghost fleet', () => {
      expect(useSystemStore.getState().ghostFleet).toBeNull();
    });

    it('has null LLM queue', () => {
      expect(useSystemStore.getState().llmQueue).toBeNull();
    });

    it('has empty system alerts', () => {
      expect(useSystemStore.getState().systemAlerts).toEqual([]);
    });

    it('has zero entity count and uptime', () => {
      expect(useSystemStore.getState().entityCount).toBe(0);
      expect(useSystemStore.getState().uptimeSeconds).toBe(0);
    });
  });

  describe('brain metrics', () => {
    describe('setBrainMetrics', () => {
      it('sets brain metrics for all brains', () => {
        const metrics: Partial<Record<BrainName, BrainMetric>> = {
          conscious: makeBrainMetric({ name: 'conscious' }),
          subconscious: makeBrainMetric({ name: 'subconscious', role: 'subconscious' }),
        };

        useSystemStore.getState().setBrainMetrics(metrics);

        const state = useSystemStore.getState();
        expect(state.brainMetrics.conscious).toBeTruthy();
        expect(state.brainMetrics.subconscious).toBeTruthy();
      });

      it('replaces existing brain metrics', () => {
        useSystemStore.getState().setBrainMetrics({
          conscious: makeBrainMetric({ name: 'conscious' }),
        });

        useSystemStore.getState().setBrainMetrics({
          utility: makeBrainMetric({ name: 'utility', role: 'utility' }),
        });

        const state = useSystemStore.getState();
        expect(state.brainMetrics.conscious).toBeUndefined();
        expect(state.brainMetrics.utility).toBeTruthy();
      });
    });

    describe('updateBrain', () => {
      it('updates an existing brain with partial data', () => {
        useSystemStore.getState().setBrainMetrics({
          conscious: makeBrainMetric({ name: 'conscious', model: 'old-model' }),
        });

        useSystemStore.getState().updateBrain('conscious', { model: 'new-model' });

        expect(useSystemStore.getState().brainMetrics.conscious!.model).toBe('new-model');
      });

      it('preserves non-updated brain fields', () => {
        useSystemStore.getState().setBrainMetrics({
          conscious: makeBrainMetric({ name: 'conscious', role: 'conscious', model: 'qwen2.5:7b' }),
        });

        useSystemStore.getState().updateBrain('conscious', { model: 'llama3:8b' });

        expect(useSystemStore.getState().brainMetrics.conscious!.role).toBe('conscious');
      });

      it('does nothing for non-existent brain', () => {
        useSystemStore.getState().updateBrain('conscious', { model: 'new' });

        expect(useSystemStore.getState().brainMetrics.conscious).toBeUndefined();
      });
    });
  });

  describe('repair status', () => {
    it('sets repair status', () => {
      const status: RepairStatus = {
        running: true,
        cycleCount: 5,
        errorAccumulatorSize: 10,
        lastCycleAt: new Date().toISOString(),
        executorCount: 3,
        executorsReady: 2,
      };

      useSystemStore.getState().setRepairStatus(status);

      expect(useSystemStore.getState().repairStatus).toEqual(status);
    });

    it('replaces previous repair status', () => {
      useSystemStore.getState().setRepairStatus({
        running: true,
        cycleCount: 1,
        errorAccumulatorSize: 0,
        lastCycleAt: null,
        executorCount: 1,
        executorsReady: 1,
      });

      useSystemStore.getState().setRepairStatus({
        running: false,
        cycleCount: 5,
        errorAccumulatorSize: 3,
        lastCycleAt: new Date().toISOString(),
        executorCount: 3,
        executorsReady: 3,
      });

      expect(useSystemStore.getState().repairStatus!.running).toBe(false);
      expect(useSystemStore.getState().repairStatus!.cycleCount).toBe(5);
    });
  });

  describe('attention allocation', () => {
    it('sets attention allocation', () => {
      const alloc: AttentionAllocation[] = [
        { domain: 'science', budget: 0.5, urgency: 0.8 },
        { domain: 'art', budget: 0.3, urgency: 0.4 },
      ];

      useSystemStore.getState().setAttentionAllocation(alloc);

      expect(useSystemStore.getState().attentionAllocation).toHaveLength(2);
      expect(useSystemStore.getState().attentionAllocation[0].domain).toBe('science');
    });

    it('sets focus override', () => {
      const override: FocusOverride = {
        domain: 'urgent-task',
        weight: 0.9,
        expiresAt: new Date().toISOString(),
      };

      useSystemStore.getState().setFocusOverride(override);

      expect(useSystemStore.getState().focusOverride).toEqual(override);
    });

    it('clears focus override by setting null', () => {
      useSystemStore.getState().setFocusOverride({
        domain: 'test',
        weight: 0.5,
        expiresAt: new Date().toISOString(),
      });

      useSystemStore.getState().setFocusOverride(null);

      expect(useSystemStore.getState().focusOverride).toBeNull();
    });
  });

  describe('forgetting stats', () => {
    it('sets forgetting stats', () => {
      const stats: ForgettingStats = {
        running: true,
        threshold: 0.3,
        lastRun: new Date().toISOString(),
        nextRun: new Date().toISOString(),
        lifetimeForgotten: 100,
        tombstones: 15,
        interval: 3600,
      };

      useSystemStore.getState().setForgettingStats(stats);

      expect(useSystemStore.getState().forgettingStats).toEqual(stats);
    });
  });

  describe('ghost fleet', () => {
    it('sets ghost fleet status', () => {
      const status: GhostFleetStatus = {
        totalLoaded: 5,
        totalFailed: 1,
        loadedAt: new Date().toISOString(),
        modules: [],
      };

      useSystemStore.getState().setGhostFleet(status);

      expect(useSystemStore.getState().ghostFleet).toEqual(status);
    });
  });

  describe('LLM queue', () => {
    it('sets LLM queue metrics', () => {
      const metrics: LLMQueueMetrics = {
        queued: 5,
        inflight: 2,
        completed: 100,
        rejected: 3,
        avgLatencyMs: 250,
        byPriority: {
          high: { queued: 2, inflight: 1, completed: 0, rejected: 0, avgLatencyMs: 0 },
          normal: { queued: 3, inflight: 1, completed: 0, rejected: 0, avgLatencyMs: 0 },
        },
      };

      useSystemStore.getState().setLLMQueue(metrics);

      expect(useSystemStore.getState().llmQueue).toEqual(metrics);
    });
  });

  describe('system alerts', () => {
    describe('addSystemAlert', () => {
      it('adds an alert to the list', () => {
        const alert = makeSystemAlert({ id: 'alert-1' });
        useSystemStore.getState().addSystemAlert(alert);

        expect(useSystemStore.getState().systemAlerts).toHaveLength(1);
        expect(useSystemStore.getState().systemAlerts[0].id).toBe('alert-1');
      });

      it('appends new alerts', () => {
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'a1' }));
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'a2' }));

        const alerts = useSystemStore.getState().systemAlerts;
        expect(alerts).toHaveLength(2);
        expect(alerts[0].id).toBe('a1');
        expect(alerts[1].id).toBe('a2');
      });

      it('caps alerts at 50', () => {
        for (let i = 0; i < 55; i++) {
          useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: `alert-${i}` }));
        }

        expect(useSystemStore.getState().systemAlerts.length).toBeLessThanOrEqual(50);
      });

      it('keeps the most recent alerts when capped', () => {
        for (let i = 0; i < 55; i++) {
          useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: `alert-${i}` }));
        }

        const alerts = useSystemStore.getState().systemAlerts;
        // The last added alert should be present
        expect(alerts[alerts.length - 1].id).toBe('alert-54');
      });
    });

    describe('acknowledgeAlert', () => {
      it('marks an alert as acknowledged', () => {
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'alert-1' }));

        useSystemStore.getState().acknowledgeAlert('alert-1');

        expect(useSystemStore.getState().systemAlerts[0].acknowledged).toBe(true);
      });

      it('does not affect other alerts', () => {
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'a1' }));
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'a2' }));

        useSystemStore.getState().acknowledgeAlert('a1');

        expect(useSystemStore.getState().systemAlerts[0].acknowledged).toBe(true);
        expect(useSystemStore.getState().systemAlerts[1].acknowledged).toBeUndefined();
      });

      it('does nothing for non-existent alert id', () => {
        useSystemStore.getState().addSystemAlert(makeSystemAlert({ id: 'a1' }));

        useSystemStore.getState().acknowledgeAlert('nonexistent');

        expect(useSystemStore.getState().systemAlerts[0].acknowledged).toBeUndefined();
      });
    });

    describe('clearAlerts', () => {
      it('removes all alerts', () => {
        useSystemStore.getState().addSystemAlert(makeSystemAlert());
        useSystemStore.getState().addSystemAlert(makeSystemAlert());

        useSystemStore.getState().clearAlerts();

        expect(useSystemStore.getState().systemAlerts).toHaveLength(0);
      });
    });
  });

  describe('aggregate counters', () => {
    it('sets entity count', () => {
      useSystemStore.getState().setEntityCount(42);
      expect(useSystemStore.getState().entityCount).toBe(42);
    });

    it('sets uptime seconds', () => {
      useSystemStore.getState().setUptimeSeconds(3600);
      expect(useSystemStore.getState().uptimeSeconds).toBe(3600);
    });

    it('can update entity count multiple times', () => {
      useSystemStore.getState().setEntityCount(10);
      useSystemStore.getState().setEntityCount(20);
      expect(useSystemStore.getState().entityCount).toBe(20);
    });
  });
});
