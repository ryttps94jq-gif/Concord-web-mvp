import Dexie, { Table } from 'dexie';

// DTU record for offline storage
interface DTURecord {
  id: string;
  tier: 'regular' | 'mega' | 'hyper' | 'shadow';
  content: string;
  summary: string;
  timestamp: string;
  parentId?: string;
  tags?: string[];
  resonance?: number;
  synced: boolean;
  localOnly?: boolean;
}

// Pending action for sync
interface PendingAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'dtu' | 'chat' | 'market';
  payload: unknown;
  timestamp: string;
  attempts: number;
}

// Chat message for offline
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  synced: boolean;
}

// Offline database using Dexie
class ConcordDB extends Dexie {
  dtus!: Table<DTURecord, string>;
  pendingActions!: Table<PendingAction, string>;
  chatMessages!: Table<ChatMessage, string>;

  constructor() {
    super('ConcordDB');

    this.version(1).stores({
      dtus: 'id, tier, timestamp, parentId, synced',
      pendingActions: 'id, type, entity, timestamp',
      chatMessages: 'id, role, timestamp, synced',
    });
  }
}

// Singleton instance
let db: ConcordDB | null = null;

export function getDB(): ConcordDB {
  if (!db) {
    db = new ConcordDB();
  }
  return db;
}

// DTU operations
export const dtuOffline = {
  async getAll(): Promise<DTURecord[]> {
    return getDB().dtus.toArray();
  },

  async get(id: string): Promise<DTURecord | undefined> {
    return getDB().dtus.get(id);
  },

  async put(dtu: DTURecord): Promise<void> {
    await getDB().dtus.put(dtu);
  },

  async delete(id: string): Promise<void> {
    await getDB().dtus.delete(id);
  },

  async getUnsynced(): Promise<DTURecord[]> {
    return getDB().dtus.filter(dtu => !dtu.synced).toArray();
  },

  async markSynced(id: string): Promise<void> {
    await getDB().dtus.update(id, { synced: true });
  },

  async bulkPut(dtus: DTURecord[]): Promise<void> {
    await getDB().dtus.bulkPut(dtus);
  },
};

// Pending actions operations
export const pendingActions = {
  async add(action: Omit<PendingAction, 'id' | 'timestamp' | 'attempts'>): Promise<void> {
    const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    await getDB().pendingActions.add({
      ...action,
      id,
      timestamp: new Date().toISOString(),
      attempts: 0,
    });
  },

  async getAll(): Promise<PendingAction[]> {
    return getDB().pendingActions.orderBy('timestamp').toArray();
  },

  async remove(id: string): Promise<void> {
    await getDB().pendingActions.delete(id);
  },

  async incrementAttempts(id: string): Promise<void> {
    const action = await getDB().pendingActions.get(id);
    if (action) {
      await getDB().pendingActions.update(id, { attempts: action.attempts + 1 });
    }
  },

  async clear(): Promise<void> {
    await getDB().pendingActions.clear();
  },
};

// Chat messages operations
export const chatOffline = {
  async getRecent(limit = 50): Promise<ChatMessage[]> {
    return getDB()
      .chatMessages.orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray()
      .then((msgs) => msgs.reverse());
  },

  async add(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<void> {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    await getDB().chatMessages.add({
      ...message,
      id,
      timestamp: new Date().toISOString(),
    });
  },

  async markSynced(id: string): Promise<void> {
    await getDB().chatMessages.update(id, { synced: true });
  },

  async clear(): Promise<void> {
    await getDB().chatMessages.clear();
  },
};

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Online status listener
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
