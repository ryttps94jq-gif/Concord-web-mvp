import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock zustand/middleware/immer since immer is not installed.
// The immer middleware wraps a state creator and adds draft-based mutations.
// For testing we provide a pass-through that deeply clones state (preserving
// non-serializable values like functions) then calls the recipe on the clone.
vi.mock('zustand/middleware/immer', () => ({
  immer:
    (config: (...args: unknown[]) => unknown) =>
    (set: (...args: unknown[]) => void, get: () => unknown, api: unknown) => {
      const immerSet = (recipe: unknown) => {
        if (typeof recipe === 'function') {
          // Shallow-clone state, deep-clone arrays (preserves functions inside arrays)
          const current = get() as Record<string, unknown>;
          const draft: Record<string, unknown> = { ...current };
          for (const key of Object.keys(draft)) {
            if (Array.isArray(draft[key])) {
              draft[key] = [...(draft[key] as unknown[])];
            }
          }
          (recipe as (d: Record<string, unknown>) => void)(draft);
          // Only pass plain-data keys back to zustand set
          const patch: Record<string, unknown> = {};
          for (const key of Object.keys(draft)) {
            if (typeof draft[key] !== 'function') {
              patch[key] = draft[key];
            }
          }
          (set as (partial: unknown) => void)(patch);
        } else {
          (set as (partial: unknown) => void)(recipe);
        }
      };
      return config(immerSet, get, api);
    },
}));

import { useHistoryStore, createUndoableAction, batchUndoable } from '@/store/history';

describe('History Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useHistoryStore.setState({
      past: [],
      future: [],
      maxSize: 100,
      isUndoing: false,
      isRedoing: false,
    });
  });

  describe('initial state', () => {
    it('has empty past and future', () => {
      const state = useHistoryStore.getState();
      expect(state.past).toEqual([]);
      expect(state.future).toEqual([]);
    });

    it('has default maxSize of 100', () => {
      expect(useHistoryStore.getState().maxSize).toBe(100);
    });

    it('is not undoing or redoing', () => {
      const state = useHistoryStore.getState();
      expect(state.isUndoing).toBe(false);
      expect(state.isRedoing).toBe(false);
    });
  });

  describe('push', () => {
    it('adds an action to the past', () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test action',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      const { past } = useHistoryStore.getState();
      expect(past).toHaveLength(1);
      expect(past[0].type).toBe('test');
      expect(past[0].description).toBe('Test action');
    });

    it('generates an id and timestamp for the action', () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      const action = useHistoryStore.getState().past[0];
      expect(action.id).toBeTruthy();
      expect(action.timestamp).toBeGreaterThan(0);
    });

    it('clears the future when a new action is pushed', () => {
      // Set up some future actions manually
      useHistoryStore.setState({
        future: [
          {
            id: 'future-1',
            type: 'old',
            description: 'Old future',
            timestamp: Date.now(),
            undo: vi.fn(),
            redo: vi.fn(),
          },
        ],
      });

      useHistoryStore.getState().push({
        type: 'new',
        description: 'New action',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      expect(useHistoryStore.getState().future).toEqual([]);
    });

    it('trims past when exceeding maxSize', () => {
      useHistoryStore.setState({ maxSize: 3 });

      for (let i = 0; i < 5; i++) {
        useHistoryStore.getState().push({
          type: 'test',
          description: `Action ${i}`,
          undo: vi.fn(),
          redo: vi.fn(),
        });
      }

      const { past } = useHistoryStore.getState();
      expect(past).toHaveLength(3);
      // Should keep the most recent 3
      expect(past[0].description).toBe('Action 2');
      expect(past[1].description).toBe('Action 3');
      expect(past[2].description).toBe('Action 4');
    });

    it('allows pushing multiple actions', () => {
      for (let i = 0; i < 3; i++) {
        useHistoryStore.getState().push({
          type: 'test',
          description: `Action ${i}`,
          undo: vi.fn(),
          redo: vi.fn(),
        });
      }

      expect(useHistoryStore.getState().past).toHaveLength(3);
    });
  });

  describe('undo', () => {
    it('calls the undo function of the last action', async () => {
      const undoFn = vi.fn();
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: undoFn,
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      expect(undoFn).toHaveBeenCalledOnce();
    });

    it('moves the action from past to future', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(1);
      expect(useHistoryStore.getState().future[0].description).toBe('Test');
    });

    it('does nothing when past is empty', async () => {
      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('does not undo while already undoing', async () => {
      const undoFn = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 50)));
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: undoFn,
        redo: vi.fn(),
      });

      // Start first undo
      const firstUndo = useHistoryStore.getState().undo();

      // Immediately try second undo — should be blocked since isUndoing is true
      await useHistoryStore.getState().undo();

      await firstUndo;

      // undo should only be called once
      expect(undoFn).toHaveBeenCalledOnce();
    });

    it('resets isUndoing on failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: () => {
          throw new Error('Undo failed');
        },
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().isUndoing).toBe(false);
      // The action remains in past since undo failed
      expect(useHistoryStore.getState().past).toHaveLength(1);
      errorSpy.mockRestore();
    });

    it('sets isUndoing to false after successful undo', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().isUndoing).toBe(false);
    });
  });

  describe('redo', () => {
    it('calls the redo function of the first future action', async () => {
      const redoFn = vi.fn();
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: redoFn,
      });

      await useHistoryStore.getState().undo();
      await useHistoryStore.getState().redo();

      expect(redoFn).toHaveBeenCalledOnce();
    });

    it('moves the action from future back to past', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(1);

      await useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('does nothing when future is empty', async () => {
      await useHistoryStore.getState().redo();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('does not redo while already redoing', async () => {
      const redoFn = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 50)));
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: redoFn,
      });

      await useHistoryStore.getState().undo();

      const firstRedo = useHistoryStore.getState().redo();
      await useHistoryStore.getState().redo();

      await firstRedo;

      expect(redoFn).toHaveBeenCalledOnce();
    });

    it('resets isRedoing on failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: () => {
          throw new Error('Redo failed');
        },
      });

      await useHistoryStore.getState().undo();
      await useHistoryStore.getState().redo();

      expect(useHistoryStore.getState().isRedoing).toBe(false);
      errorSpy.mockRestore();
    });
  });

  describe('canUndo', () => {
    it('returns false when past is empty', () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it('returns true when past has actions', () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });

    it('returns false when currently undoing', () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });
      useHistoryStore.setState({ isUndoing: true });

      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });
  });

  describe('canRedo', () => {
    it('returns false when future is empty', () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    it('returns true when future has actions', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });

    it('returns false when currently redoing', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();
      useHistoryStore.setState({ isRedoing: true });

      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears both past and future', async () => {
      useHistoryStore.getState().push({
        type: 'test',
        description: 'Test',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      useHistoryStore.getState().push({
        type: 'test2',
        description: 'Test2',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      await useHistoryStore.getState().undo();

      // Now we have 1 in past and 1 in future
      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().future).toHaveLength(1);

      useHistoryStore.getState().clear();

      expect(useHistoryStore.getState().past).toHaveLength(0);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });
  });

  describe('getLastAction', () => {
    it('returns null when past is empty', () => {
      expect(useHistoryStore.getState().getLastAction()).toBeNull();
    });

    it('returns the most recent action', () => {
      useHistoryStore.getState().push({
        type: 'first',
        description: 'First',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      useHistoryStore.getState().push({
        type: 'second',
        description: 'Second',
        undo: vi.fn(),
        redo: vi.fn(),
      });

      const lastAction = useHistoryStore.getState().getLastAction();
      expect(lastAction).not.toBeNull();
      expect(lastAction!.description).toBe('Second');
    });
  });

  describe('undo/redo round-trip', () => {
    it('performs full undo-redo cycle correctly', async () => {
      let value = 0;
      useHistoryStore.getState().push({
        type: 'increment',
        description: 'Increment',
        undo: () => { value--; },
        redo: () => { value++; },
      });

      value = 1; // simulate the action having been done

      await useHistoryStore.getState().undo();
      expect(value).toBe(0);

      await useHistoryStore.getState().redo();
      expect(value).toBe(1);
    });

    it('handles multiple undo operations in sequence', async () => {
      const actions: string[] = [];

      for (let i = 0; i < 3; i++) {
        useHistoryStore.getState().push({
          type: 'action',
          description: `Action ${i}`,
          undo: () => { actions.push(`undo-${i}`); },
          redo: () => { actions.push(`redo-${i}`); },
        });
      }

      await useHistoryStore.getState().undo();
      await useHistoryStore.getState().undo();

      expect(useHistoryStore.getState().past).toHaveLength(1);
      expect(useHistoryStore.getState().future).toHaveLength(2);
    });
  });
});

describe('createUndoableAction', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      past: [],
      future: [],
      maxSize: 100,
      isUndoing: false,
      isRedoing: false,
    });
  });

  it('executes the action and pushes to history', async () => {
    let value = 0;
    const action = createUndoableAction(
      'increment',
      () => { value++; return value; },
      (result) => { value = result - 1; },
    );

    const result = await action();

    expect(result).toBe(1);
    expect(value).toBe(1);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().past[0].description).toBe('increment');
  });

  it('creates an undoable action with correct undo behavior', async () => {
    let value = 0;
    const action = createUndoableAction(
      'set value',
      () => { value = 42; return 42; },
      (result) => { value = 0; },
    );

    await action();
    expect(value).toBe(42);

    await useHistoryStore.getState().undo();
    expect(value).toBe(0);
  });
});

describe('batchUndoable', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      past: [],
      future: [],
      maxSize: 100,
      isUndoing: false,
      isRedoing: false,
    });
  });

  it('executes all actions and pushes a single history entry', async () => {
    const log: string[] = [];

    await batchUndoable('batch operation', [
      { execute: () => { log.push('exec-1'); }, undo: () => { log.push('undo-1'); } },
      { execute: () => { log.push('exec-2'); }, undo: () => { log.push('undo-2'); } },
      { execute: () => { log.push('exec-3'); }, undo: () => { log.push('undo-3'); } },
    ]);

    expect(log).toEqual(['exec-1', 'exec-2', 'exec-3']);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().past[0].type).toBe('batch');
    expect(useHistoryStore.getState().past[0].description).toBe('batch operation');
  });

  it('undoes batch in reverse order', async () => {
    const log: string[] = [];

    await batchUndoable('batch', [
      { execute: () => { log.push('exec-1'); }, undo: () => { log.push('undo-1'); } },
      { execute: () => { log.push('exec-2'); }, undo: () => { log.push('undo-2'); } },
      { execute: () => { log.push('exec-3'); }, undo: () => { log.push('undo-3'); } },
    ]);

    log.length = 0; // clear execution log

    await useHistoryStore.getState().undo();

    expect(log).toEqual(['undo-3', 'undo-2', 'undo-1']);
  });

  it('redoes batch in original order', async () => {
    const log: string[] = [];

    await batchUndoable('batch', [
      { execute: () => { log.push('exec-1'); }, undo: () => { log.push('undo-1'); } },
      { execute: () => { log.push('exec-2'); }, undo: () => { log.push('undo-2'); } },
    ]);

    await useHistoryStore.getState().undo();
    log.length = 0;

    await useHistoryStore.getState().redo();

    expect(log).toEqual(['exec-1', 'exec-2']);
  });
});
