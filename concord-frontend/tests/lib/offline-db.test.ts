import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Dexie before importing the module
vi.mock('dexie', () => {
  const mockTable = () => ({
    toArray: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    bulkPut: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    filter: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }),
    orderBy: vi.fn().mockReturnValue({
      filter: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  });

  class MockDexie {
    dtus = mockTable();
    pendingActions = mockTable();
    chatMessages = mockTable();
    conflicts = mockTable();

    version() {
      return {
        stores: vi.fn().mockReturnValue({
          upgrade: vi.fn().mockReturnValue(undefined),
        }),
      };
    }

    constructor(name: string) {
      // no-op
    }
  }

  return {
    default: MockDexie,
    __esModule: true,
  };
});

import {
  getDB,
  dtuOffline,
  pendingActions,
  chatOffline,
  conflicts,
  isOnline,
  onOnlineStatusChange,
  updateClockOffset,
  getNormalizedTimestamp,
  type ConflictRecord,
} from '@/lib/offline/db';

describe('getDB', () => {
  it('returns a database instance', () => {
    const db = getDB();
    expect(db).toBeDefined();
    expect(db.dtus).toBeDefined();
    expect(db.pendingActions).toBeDefined();
    expect(db.chatMessages).toBeDefined();
    expect(db.conflicts).toBeDefined();
  });

  it('returns the same instance on subsequent calls', () => {
    const db1 = getDB();
    const db2 = getDB();
    expect(db1).toBe(db2);
  });
});

describe('updateClockOffset / getNormalizedTimestamp', () => {
  it('adjusts timestamp based on server time', () => {
    const serverTime = new Date(Date.now() + 5000).toISOString(); // 5 seconds ahead
    updateClockOffset(serverTime);

    const normalized = getNormalizedTimestamp();
    const normalizedDate = new Date(normalized).getTime();
    const localDate = Date.now();

    // The normalized time should be roughly 5 seconds ahead of local time
    expect(normalizedDate - localDate).toBeGreaterThan(3000);
    expect(normalizedDate - localDate).toBeLessThan(7000);
  });

  it('handles invalid server timestamps gracefully', () => {
    // Should not crash
    updateClockOffset('not-a-date');
    const ts = getNormalizedTimestamp();
    expect(ts).toBeTruthy();
  });
});

describe('dtuOffline', () => {
  it('has getAll method', () => {
    expect(typeof dtuOffline.getAll).toBe('function');
  });

  it('has get method', () => {
    expect(typeof dtuOffline.get).toBe('function');
  });

  it('has put method', () => {
    expect(typeof dtuOffline.put).toBe('function');
  });

  it('has delete method', () => {
    expect(typeof dtuOffline.delete).toBe('function');
  });

  it('has getUnsynced method', () => {
    expect(typeof dtuOffline.getUnsynced).toBe('function');
  });

  it('has markSynced method', () => {
    expect(typeof dtuOffline.markSynced).toBe('function');
  });

  it('has bulkPut method', () => {
    expect(typeof dtuOffline.bulkPut).toBe('function');
  });

  it('has mergeFromServer method', () => {
    expect(typeof dtuOffline.mergeFromServer).toBe('function');
  });

  it('has updateField method', () => {
    expect(typeof dtuOffline.updateField).toBe('function');
  });

  it('getAll calls dtus.toArray', async () => {
    const db = getDB();
    await dtuOffline.getAll();
    expect(db.dtus.toArray).toHaveBeenCalled();
  });

  it('get calls dtus.get with id', async () => {
    const db = getDB();
    await dtuOffline.get('test-id');
    expect(db.dtus.get).toHaveBeenCalledWith('test-id');
  });

  it('delete calls dtus.delete with id', async () => {
    const db = getDB();
    await dtuOffline.delete('test-id');
    expect(db.dtus.delete).toHaveBeenCalledWith('test-id');
  });

  it('markSynced calls dtus.update with synced flag', async () => {
    const db = getDB();
    await dtuOffline.markSynced('test-id');
    expect(db.dtus.update).toHaveBeenCalledWith('test-id', { synced: true });
  });
});

describe('pendingActions', () => {
  it('has add, getAll, remove, incrementAttempts, clear, getQuarantined methods', () => {
    expect(typeof pendingActions.add).toBe('function');
    expect(typeof pendingActions.getAll).toBe('function');
    expect(typeof pendingActions.remove).toBe('function');
    expect(typeof pendingActions.incrementAttempts).toBe('function');
    expect(typeof pendingActions.clear).toBe('function');
    expect(typeof pendingActions.getQuarantined).toBe('function');
  });

  it('remove calls pendingActions.delete', async () => {
    const db = getDB();
    await pendingActions.remove('action-1');
    expect(db.pendingActions.delete).toHaveBeenCalledWith('action-1');
  });

  it('clear calls pendingActions.clear', async () => {
    const db = getDB();
    await pendingActions.clear();
    expect(db.pendingActions.clear).toHaveBeenCalled();
  });
});

describe('chatOffline', () => {
  it('has getRecent, add, markSynced, clear methods', () => {
    expect(typeof chatOffline.getRecent).toBe('function');
    expect(typeof chatOffline.add).toBe('function');
    expect(typeof chatOffline.markSynced).toBe('function');
    expect(typeof chatOffline.clear).toBe('function');
  });

  it('clear calls chatMessages.clear', async () => {
    const db = getDB();
    await chatOffline.clear();
    expect(db.chatMessages.clear).toHaveBeenCalled();
  });
});

describe('conflicts', () => {
  it('has record, getPending, resolve, getRecent, clear methods', () => {
    expect(typeof conflicts.record).toBe('function');
    expect(typeof conflicts.getPending).toBe('function');
    expect(typeof conflicts.resolve).toBe('function');
    expect(typeof conflicts.getRecent).toBe('function');
    expect(typeof conflicts.clear).toBe('function');
  });

  it('clear calls conflicts.clear', async () => {
    const db = getDB();
    await conflicts.clear();
    expect(db.conflicts.clear).toHaveBeenCalled();
  });
});

describe('isOnline', () => {
  it('returns navigator.onLine when available', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    expect(isOnline()).toBe(true);

    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    expect(isOnline()).toBe(false);
  });
});

describe('onOnlineStatusChange', () => {
  it('registers online/offline event listeners and returns cleanup function', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const callback = vi.fn();

    const cleanup = onOnlineStatusChange(callback);

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    cleanup();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('calls callback with true on online event', () => {
    const callback = vi.fn();
    onOnlineStatusChange(callback);

    window.dispatchEvent(new Event('online'));
    expect(callback).toHaveBeenCalledWith(true);
  });

  it('calls callback with false on offline event', () => {
    const callback = vi.fn();
    onOnlineStatusChange(callback);

    window.dispatchEvent(new Event('offline'));
    expect(callback).toHaveBeenCalledWith(false);
  });
});
