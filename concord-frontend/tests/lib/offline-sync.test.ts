import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Dexie so we don't need a real IndexedDB
const mockTable = {
  toArray: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  bulkPut: vi.fn().mockResolvedValue(undefined),
  filter: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  equals: vi.fn().mockReturnThis(),
  first: vi.fn().mockResolvedValue(undefined),
  orderBy: vi.fn().mockReturnThis(),
  reverse: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

vi.mock('dexie', () => {
  return {
    default: class MockDexie {
      dtus = { ...mockTable };
      pendingActions = { ...mockTable };
      chatMessages = { ...mockTable };
      conflicts = { ...mockTable };
      version() {
        return {
          stores: () => ({
            upgrade: () => ({}),
          }),
        };
      }
    },
  };
});

import {
  updateClockOffset,
  getNormalizedTimestamp,
  isOnline,
  onOnlineStatusChange,
  dtuOffline,
  pendingActions,
  chatOffline,
  conflicts,
  getDB,
} from '@/lib/offline/db';

describe('Clock normalization', () => {
  beforeEach(() => {
    // Reset offset by updating with current time
    updateClockOffset(new Date().toISOString());
  });

  it('updateClockOffset calculates offset from server time', () => {
    const futureTime = new Date(Date.now() + 5000).toISOString();
    updateClockOffset(futureTime);

    const normalized = getNormalizedTimestamp();
    const normalizedTime = new Date(normalized).getTime();

    // Normalized time should be close to the future time (within 1s tolerance)
    expect(Math.abs(normalizedTime - (Date.now() + 5000))).toBeLessThan(1000);
  });

  it('getNormalizedTimestamp returns a valid ISO string', () => {
    const timestamp = getNormalizedTimestamp();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(timestamp).getTime()).not.toBeNaN();
  });

  it('ignores invalid server timestamps', () => {
    const before = getNormalizedTimestamp();
    updateClockOffset('invalid-date');
    const after = getNormalizedTimestamp();

    // Timestamps should be very close (within 100ms) since invalid input is ignored
    const diff = Math.abs(new Date(after).getTime() - new Date(before).getTime());
    expect(diff).toBeLessThan(100);
  });
});

describe('isOnline', () => {
  it('returns a boolean', () => {
    const result = isOnline();
    expect(typeof result).toBe('boolean');
  });
});

describe('onOnlineStatusChange', () => {
  it('returns an unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = onOnlineStatusChange(callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('registers online and offline event listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const callback = vi.fn();

    const unsubscribe = onOnlineStatusChange(callback);

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unsubscribe();
    addSpy.mockRestore();
  });

  it('removes event listeners on unsubscribe', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const callback = vi.fn();

    const unsubscribe = onOnlineStatusChange(callback);
    unsubscribe();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('getDB', () => {
  it('returns a database instance', () => {
    const db = getDB();
    expect(db).toBeDefined();
    expect(db.dtus).toBeDefined();
    expect(db.pendingActions).toBeDefined();
    expect(db.chatMessages).toBeDefined();
    expect(db.conflicts).toBeDefined();
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const db1 = getDB();
    const db2 = getDB();
    expect(db1).toBe(db2);
  });
});

describe('dtuOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset toArray to return empty
    const db = getDB();
    (db.dtus.toArray as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('getAll returns an array', async () => {
    const result = await dtuOffline.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it('get retrieves a DTU by id', async () => {
    const db = getDB();
    const mockDtu = { id: 'dtu-1', content: 'test', synced: true };
    (db.dtus.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockDtu);

    const result = await dtuOffline.get('dtu-1');
    expect(result).toEqual(mockDtu);
  });

  it('put stores a DTU', async () => {
    const db = getDB();
    const dtu = {
      id: 'dtu-new',
      tier: 'regular' as const,
      content: 'new DTU',
      summary: 'summary',
      timestamp: new Date().toISOString(),
      synced: false,
    };

    await dtuOffline.put(dtu);
    expect(db.dtus.put).toHaveBeenCalledWith(dtu);
  });

  it('delete removes a DTU by id', async () => {
    const db = getDB();
    await dtuOffline.delete('dtu-1');
    expect(db.dtus.delete).toHaveBeenCalledWith('dtu-1');
  });

  it('markSynced updates synced flag', async () => {
    const db = getDB();
    await dtuOffline.markSynced('dtu-1');
    expect(db.dtus.update).toHaveBeenCalledWith('dtu-1', { synced: true });
  });

  it('bulkPut stores multiple DTUs', async () => {
    const db = getDB();
    const dtus = [
      { id: 'a', tier: 'regular', content: 'a', summary: 's', timestamp: '', synced: false },
      { id: 'b', tier: 'regular', content: 'b', summary: 's', timestamp: '', synced: false },
    ];
    await dtuOffline.bulkPut(dtus as Parameters<typeof dtuOffline.bulkPut>[0]);
    expect(db.dtus.bulkPut).toHaveBeenCalledWith(dtus);
  });
});

describe('pendingActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const db = getDB();
    (db.pendingActions.filter as ReturnType<typeof vi.fn>).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    });
    (db.pendingActions.orderBy as ReturnType<typeof vi.fn>).mockReturnValue({
      filter: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.pendingActions.where as ReturnType<typeof vi.fn>).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('add creates a new pending action', async () => {
    const db = getDB();
    await pendingActions.add({
      type: 'create',
      entity: 'dtu',
      payload: { content: 'test' },
    });
    expect(db.pendingActions.add).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create',
        entity: 'dtu',
        attempts: 0,
      })
    );
  });

  it('add skips duplicate actions with same fingerprint', async () => {
    const db = getDB();
    // Simulate existing action with same fingerprint
    (db.pendingActions.where as ReturnType<typeof vi.fn>).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ id: 'existing', quarantined: false }),
      }),
    });

    await pendingActions.add({
      type: 'create',
      entity: 'dtu',
      payload: { content: 'test' },
    });

    expect(db.pendingActions.add).not.toHaveBeenCalled();
  });

  it('remove deletes a pending action', async () => {
    const db = getDB();
    await pendingActions.remove('action-1');
    expect(db.pendingActions.delete).toHaveBeenCalledWith('action-1');
  });

  it('clear removes all pending actions', async () => {
    const db = getDB();
    await pendingActions.clear();
    expect(db.pendingActions.clear).toHaveBeenCalled();
  });

  it('incrementAttempts quarantines after MAX_SYNC_ATTEMPTS', async () => {
    const db = getDB();
    // Action already at 4 attempts (one more makes 5 = max)
    (db.pendingActions.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'action-1',
      attempts: 4,
    });

    await pendingActions.incrementAttempts('action-1');

    expect(db.pendingActions.update).toHaveBeenCalledWith('action-1', {
      attempts: 5,
      quarantined: true,
    });
  });

  it('incrementAttempts does not quarantine below max attempts', async () => {
    const db = getDB();
    (db.pendingActions.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'action-1',
      attempts: 2,
    });

    await pendingActions.incrementAttempts('action-1');

    expect(db.pendingActions.update).toHaveBeenCalledWith('action-1', {
      attempts: 3,
    });
  });
});

describe('chatOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const db = getDB();
    (db.chatMessages.orderBy as ReturnType<typeof vi.fn>).mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    });
  });

  it('add creates a chat message with generated id and timestamp', async () => {
    const db = getDB();
    await chatOffline.add({
      role: 'user',
      content: 'Hello',
      synced: false,
    });

    expect(db.chatMessages.add).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: 'Hello',
        synced: false,
      })
    );

    // Verify auto-generated fields
    const addedMsg = (db.chatMessages.add as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(addedMsg.id).toMatch(/^msg-/);
    expect(addedMsg.timestamp).toBeTruthy();
  });

  it('markSynced updates a message', async () => {
    const db = getDB();
    await chatOffline.markSynced('msg-1');
    expect(db.chatMessages.update).toHaveBeenCalledWith('msg-1', { synced: true });
  });

  it('clear removes all messages', async () => {
    const db = getDB();
    await chatOffline.clear();
    expect(db.chatMessages.clear).toHaveBeenCalled();
  });
});

describe('conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const db = getDB();
    (db.conflicts.where as ReturnType<typeof vi.fn>).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.conflicts.orderBy as ReturnType<typeof vi.fn>).mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('record creates a conflict entry', async () => {
    const db = getDB();
    await conflicts.record({
      entityType: 'dtu',
      entityId: 'dtu-1',
      localVersion: { content: 'local' },
      serverVersion: { content: 'server' },
      resolution: 'pending',
    });

    expect(db.conflicts.add).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'dtu',
        entityId: 'dtu-1',
        resolution: 'pending',
      })
    );
  });

  it('resolve updates conflict resolution status', async () => {
    const db = getDB();
    await conflicts.resolve('conflict-1', 'local_wins');
    expect(db.conflicts.update).toHaveBeenCalledWith('conflict-1', { resolution: 'local_wins' });
  });

  it('clear removes all conflicts', async () => {
    const db = getDB();
    await conflicts.clear();
    expect(db.conflicts.clear).toHaveBeenCalled();
  });
});
