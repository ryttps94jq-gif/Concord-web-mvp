/**
 * substrate-cache.ts — Full offline substrate caching in IndexedDB.
 * Enables Concord to run fully offline with local substrate data.
 */

import { api } from '@/lib/api/client';

const DB_NAME = 'concord-offline';
const DB_VERSION = 1;
const STORE_NAME = 'substrate';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheSubstrateLocally(userId: string): Promise<void> {
  const response = await api.get('/api/substrate/export', {
    responseType: 'arraybuffer',
  });

  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put({
    userId,
    data: response.data,
    cachedAt: new Date().toISOString(),
  }, 'current');

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface SubstrateData {
  version: string;
  exportedAt: string;
  userId: string;
  dtus: Array<{
    id: string;
    title: string;
    domain: string;
    scope: string;
    [key: string]: unknown;
  }>;
  entities: Array<{
    id: string;
    type: string;
    [key: string]: unknown;
  }>;
  sovereignty?: {
    mode: string;
    globalAssistConsent: string;
  };
}

export async function loadOfflineSubstrate(): Promise<SubstrateData | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => {
      const cached = request.result;
      if (!cached) { resolve(null); return; }

      try {
        // Decompress using pako if available, otherwise raw parse
        const raw = new Uint8Array(cached.data);
        // Check for gzip magic bytes
        if (raw[0] === 0x1f && raw[1] === 0x8b) {
          // Need pako for decompression in browser
          import('pako').then(pako => {
            const decompressed = pako.ungzip(raw);
            resolve(JSON.parse(new TextDecoder().decode(decompressed)));
          }).catch(() => {
            // If pako not available, can't decompress
            resolve(null);
          });
        } else {
          resolve(JSON.parse(new TextDecoder().decode(raw)));
        }
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineSubstrate(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete('current');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineCacheInfo(): Promise<{ cached: boolean; cachedAt?: string; userId?: string } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get('current');
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const cached = request.result;
        resolve(cached ? { cached: true, cachedAt: cached.cachedAt, userId: cached.userId } : { cached: false });
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
