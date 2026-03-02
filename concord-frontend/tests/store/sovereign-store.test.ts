import { describe, it, expect, beforeEach } from 'vitest';
import { useSovereignStore } from '@/store/sovereign';
import type { Dream, Promotion } from '@/lib/types/system';

function makeDream(overrides: Partial<Dream> = {}): Dream {
  return {
    id: `dream-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Dream',
    summary: 'A dream summary',
    convergence: false,
    capturedAt: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

function makePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: `promo-${Math.random().toString(36).slice(2, 8)}`,
    artifactId: 'artifact-1',
    artifactName: 'Test Artifact',
    fromStage: 'draft',
    toStage: 'review',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Sovereign Store', () => {
  beforeEach(() => {
    useSovereignStore.setState({
      dreams: [],
      convergenceCount: 0,
      promotionQueue: [],
      recentMetaEvents: [],
    });
  });

  describe('initial state', () => {
    it('has empty dreams array', () => {
      expect(useSovereignStore.getState().dreams).toEqual([]);
    });

    it('has zero convergence count', () => {
      expect(useSovereignStore.getState().convergenceCount).toBe(0);
    });

    it('has empty promotion queue', () => {
      expect(useSovereignStore.getState().promotionQueue).toEqual([]);
    });

    it('has empty recent meta events', () => {
      expect(useSovereignStore.getState().recentMetaEvents).toEqual([]);
    });
  });

  describe('dreams', () => {
    describe('setDreams', () => {
      it('sets the dreams array', () => {
        const dreams = [makeDream({ id: 'dream-1' }), makeDream({ id: 'dream-2' })];
        useSovereignStore.getState().setDreams(dreams);

        expect(useSovereignStore.getState().dreams).toHaveLength(2);
        expect(useSovereignStore.getState().dreams[0].id).toBe('dream-1');
      });

      it('replaces existing dreams', () => {
        useSovereignStore.getState().setDreams([makeDream({ id: 'old' })]);
        useSovereignStore.getState().setDreams([makeDream({ id: 'new' })]);

        expect(useSovereignStore.getState().dreams).toHaveLength(1);
        expect(useSovereignStore.getState().dreams[0].id).toBe('new');
      });
    });

    describe('addDream', () => {
      it('prepends a dream to the list', () => {
        useSovereignStore.getState().addDream(makeDream({ id: 'first' }));
        useSovereignStore.getState().addDream(makeDream({ id: 'second' }));

        const { dreams } = useSovereignStore.getState();
        expect(dreams[0].id).toBe('second');
        expect(dreams[1].id).toBe('first');
      });

      it('caps dreams at 50', () => {
        for (let i = 0; i < 55; i++) {
          useSovereignStore.getState().addDream(makeDream({ id: `dream-${i}` }));
        }

        expect(useSovereignStore.getState().dreams).toHaveLength(50);
      });

      it('increments convergenceCount when dream has convergence', () => {
        useSovereignStore.getState().addDream(makeDream({ convergence: true }));

        expect(useSovereignStore.getState().convergenceCount).toBe(1);
      });

      it('does not increment convergenceCount when dream has no convergence', () => {
        useSovereignStore.getState().addDream(makeDream({ convergence: false }));

        expect(useSovereignStore.getState().convergenceCount).toBe(0);
      });

      it('accumulates convergenceCount across multiple convergent dreams', () => {
        useSovereignStore.getState().addDream(makeDream({ convergence: true }));
        useSovereignStore.getState().addDream(makeDream({ convergence: true }));
        useSovereignStore.getState().addDream(makeDream({ convergence: false }));

        expect(useSovereignStore.getState().convergenceCount).toBe(2);
      });
    });

    describe('setConvergenceCount', () => {
      it('sets convergence count directly', () => {
        useSovereignStore.getState().setConvergenceCount(42);
        expect(useSovereignStore.getState().convergenceCount).toBe(42);
      });

      it('can reset to zero', () => {
        useSovereignStore.getState().setConvergenceCount(10);
        useSovereignStore.getState().setConvergenceCount(0);
        expect(useSovereignStore.getState().convergenceCount).toBe(0);
      });
    });
  });

  describe('promotion queue', () => {
    describe('setPromotionQueue', () => {
      it('sets the entire promotion queue', () => {
        const queue = [makePromotion({ id: 'p1' }), makePromotion({ id: 'p2' })];
        useSovereignStore.getState().setPromotionQueue(queue);

        expect(useSovereignStore.getState().promotionQueue).toHaveLength(2);
      });

      it('replaces existing queue', () => {
        useSovereignStore.getState().setPromotionQueue([makePromotion({ id: 'old' })]);
        useSovereignStore.getState().setPromotionQueue([makePromotion({ id: 'new' })]);

        expect(useSovereignStore.getState().promotionQueue).toHaveLength(1);
        expect(useSovereignStore.getState().promotionQueue[0].id).toBe('new');
      });
    });

    describe('updatePromotion', () => {
      it('updates a specific promotion by id', () => {
        useSovereignStore.getState().setPromotionQueue([
          makePromotion({ id: 'p1', status: 'pending' }),
          makePromotion({ id: 'p2', status: 'pending' }),
        ]);

        useSovereignStore.getState().updatePromotion('p1', { status: 'approved' });

        const queue = useSovereignStore.getState().promotionQueue;
        expect(queue.find((p) => p.id === 'p1')!.status).toBe('approved');
        expect(queue.find((p) => p.id === 'p2')!.status).toBe('pending');
      });

      it('preserves non-updated fields', () => {
        const promo = makePromotion({ id: 'p1', artifactName: 'My Artifact' });
        useSovereignStore.getState().setPromotionQueue([promo]);

        useSovereignStore.getState().updatePromotion('p1', { status: 'rejected' });

        expect(useSovereignStore.getState().promotionQueue[0].artifactName).toBe('My Artifact');
      });

      it('does nothing for non-existent promotion', () => {
        useSovereignStore.getState().setPromotionQueue([makePromotion({ id: 'p1' })]);

        useSovereignStore.getState().updatePromotion('nonexistent', { status: 'approved' });

        expect(useSovereignStore.getState().promotionQueue).toHaveLength(1);
        expect(useSovereignStore.getState().promotionQueue[0].id).toBe('p1');
      });
    });

    describe('removePromotion', () => {
      it('removes a promotion by id', () => {
        useSovereignStore.getState().setPromotionQueue([
          makePromotion({ id: 'p1' }),
          makePromotion({ id: 'p2' }),
        ]);

        useSovereignStore.getState().removePromotion('p1');

        const queue = useSovereignStore.getState().promotionQueue;
        expect(queue).toHaveLength(1);
        expect(queue[0].id).toBe('p2');
      });

      it('does nothing for non-existent id', () => {
        useSovereignStore.getState().setPromotionQueue([makePromotion({ id: 'p1' })]);

        useSovereignStore.getState().removePromotion('nonexistent');

        expect(useSovereignStore.getState().promotionQueue).toHaveLength(1);
      });
    });
  });

  describe('meta events', () => {
    describe('addMetaEvent', () => {
      it('adds a meta event to the list', () => {
        useSovereignStore.getState().addMetaEvent({
          id: 'meta-1',
          summary: 'Test convergence',
          timestamp: new Date().toISOString(),
          type: 'lattice:meta:convergence',
        });

        expect(useSovereignStore.getState().recentMetaEvents).toHaveLength(1);
        expect(useSovereignStore.getState().recentMetaEvents[0].id).toBe('meta-1');
      });

      it('prepends new events', () => {
        useSovereignStore.getState().addMetaEvent({
          id: 'meta-1',
          summary: 'First',
          timestamp: new Date().toISOString(),
          type: 'meta:committed',
        });
        useSovereignStore.getState().addMetaEvent({
          id: 'meta-2',
          summary: 'Second',
          timestamp: new Date().toISOString(),
          type: 'meta:committed',
        });

        const events = useSovereignStore.getState().recentMetaEvents;
        expect(events[0].id).toBe('meta-2');
        expect(events[1].id).toBe('meta-1');
      });

      it('caps events at 30', () => {
        for (let i = 0; i < 35; i++) {
          useSovereignStore.getState().addMetaEvent({
            id: `meta-${i}`,
            summary: `Event ${i}`,
            timestamp: new Date().toISOString(),
            type: 'lattice:meta:derived',
          });
        }

        expect(useSovereignStore.getState().recentMetaEvents).toHaveLength(30);
      });

      it('keeps the most recent events when capped', () => {
        for (let i = 0; i < 35; i++) {
          useSovereignStore.getState().addMetaEvent({
            id: `meta-${i}`,
            summary: `Event ${i}`,
            timestamp: new Date().toISOString(),
            type: 'lattice:meta:derived',
          });
        }

        const events = useSovereignStore.getState().recentMetaEvents;
        // Most recent should be first
        expect(events[0].id).toBe('meta-34');
      });
    });
  });
});
