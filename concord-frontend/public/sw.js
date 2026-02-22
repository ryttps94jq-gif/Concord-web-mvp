/**
 * Concord Service Worker — caches the app shell for offline support and
 * queues failed mutations for background sync.
 *
 * Strategy:
 * - App shell (HTML, CSS, JS): Cache-first with network update
 * - API calls (GET): Network-first with cache fallback
 * - API mutations (POST/PUT/DELETE): Network-first, queued in IndexedDB when offline
 * - Static assets: Cache-first
 * - Background sync: Replays queued mutations when connectivity is restored
 */

const CACHE_NAME = 'concord-v1';
const SHELL_ASSETS = [
  '/',
  '/login',
  '/hub',
];

// ---------------------------------------------------------------------------
// Background Sync Queue — stores failed mutations in IndexedDB for replay
// ---------------------------------------------------------------------------
const DB_NAME = 'concord-sync';
const STORE_NAME = 'pending-mutations';

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueMutation(request) {
  const db = await openSyncDB();
  const body = await request.clone().text();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    timestamp: Date.now(),
  });
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
}

async function replayMutations() {
  const db = await openSyncDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const items = await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let replayed = 0;
  for (const item of items) {
    try {
      await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
      // Remove successfully replayed mutation from queue
      const delTx = db.transaction(STORE_NAME, 'readwrite');
      delTx.objectStore(STORE_NAME).delete(item.id);
      await new Promise((resolve, reject) => { delTx.oncomplete = resolve; delTx.onerror = reject; });
      replayed++;
    } catch {
      break; // Still offline — stop replaying
    }
  }

  // Notify all clients about sync completion
  const clients = await self.clients.matchAll();
  clients.forEach((c) => c.postMessage({ type: 'SYNC_COMPLETE', replayed, total: items.length }));
}

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {
        // Some assets may fail during first install — that's OK
        console.warn('[SW] Some shell assets failed to cache during install');
      });
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets, offline queue for mutations
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip WebSocket upgrades and chrome-extension requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.protocol === 'chrome-extension:') return;

  // Mutation requests (POST/PUT/DELETE) to /api/*: attempt fetch, queue on failure
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(request.method);
  if (isMutation && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Network error — queue the mutation for background sync
        await queueMutation(request);
        // Register for background sync if the API is available
        if (self.registration && self.registration.sync) {
          self.registration.sync.register('concord-mutation-sync').catch(() => {});
        }
        return new Response(
          JSON.stringify({ ok: true, queued: true, message: 'Mutation queued for background sync' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Skip remaining non-GET requests (e.g. OPTIONS, HEAD for non-api paths)
  if (request.method !== 'GET') return;

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            // Add header so frontend knows this is stale data
            const headers = new Headers(cached.headers);
            headers.set('X-Concord-Stale', 'true');
            return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
          }
          return new Response(JSON.stringify({ ok: false, error: 'Offline', stale: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Static assets and pages: cache-first with network update
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// ---------------------------------------------------------------------------
// Background Sync — replay queued mutations when connectivity is restored
// ---------------------------------------------------------------------------

// Browser Background Sync API (fired by the browser when it detects connectivity)
self.addEventListener('sync', (event) => {
  if (event.tag === 'concord-mutation-sync') {
    event.waitUntil(replayMutations());
  }
});

// Fallback: listen for an explicit "ONLINE" message from clients.
// This covers browsers that don't support the Background Sync API — the main
// page can post this message when it detects a navigator.onLine change.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE') {
    event.waitUntil(replayMutations());
  }
});
