// Concord Mobile — Broadcast Bridge
// Bridges broadcast DTUs to mesh network and optionally to internet.
// Receives broadcast DTUs -> integrity check -> store -> mesh relay -> server forward.
// Duplicate handling: same DTU via broadcast and mesh stored once.

import type { BroadcastConfig, BroadcastDTU, DTU } from '../../utils/types';
import { toHex } from '../../utils/crypto';

// ── Mesh Controller Interface ────────────────────────────────────────────────

export interface MeshController {
  broadcastDTU(dtu: DTU): Promise<boolean>;
  isConnected(): boolean;
  getPeerCount(): number;
}

// ── DTU Store Interface ──────────────────────────────────────────────────────

export interface DTUStore {
  storeDTU(dtu: DTU): Promise<boolean>;
  hasDTU(id: string): Promise<boolean>;
  getDTU(id: string): Promise<DTU | null>;
}

// ── Broadcast Bridge Interface ───────────────────────────────────────────────

export interface BroadcastBridge {
  configure(config: BroadcastConfig): void;
  onBroadcastDTU(dtu: BroadcastDTU): Promise<void>;
  getBridgedCount(): number;
  getConfig(): BroadcastConfig;
}

// ── Integrity Check ──────────────────────────────────────────────────────────

function verifyDTUIntegrity(dtu: DTU): boolean {
  // Check required fields
  if (!dtu.id || typeof dtu.id !== 'string') return false;
  if (!dtu.header) return false;
  if (!dtu.content) return false;

  // Verify content length matches header
  if (dtu.content.length !== dtu.header.contentLength) return false;

  // Verify content hash (simple check - full verification would use sha256)
  if (!dtu.header.contentHash || dtu.header.contentHash.length === 0) return false;

  // Check timestamp is reasonable (not more than 24 hours in the future)
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (dtu.header.timestamp > now + oneDayMs) return false;

  // TTL must be positive
  if (dtu.meta.ttl <= 0) return false;

  return true;
}

// ── Server Forward ───────────────────────────────────────────────────────────

async function forwardToServer(dtu: DTU, _serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${_serverUrl}/v1/bridge/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: dtu.id,
        header: {
          version: dtu.header.version,
          flags: dtu.header.flags,
          type: dtu.header.type,
          timestamp: dtu.header.timestamp,
          contentLength: dtu.header.contentLength,
          contentHash: toHex(dtu.header.contentHash),
        },
        content: toHex(dtu.content),
        tags: dtu.tags,
        meta: dtu.meta,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BroadcastConfig = {
  fmEnabled: false,
  dabEnabled: false,
  bridgeModeEnabled: false,
  internetBridgeEnabled: false,
};

const SERVER_URL = 'https://api.concordcognitive.org';

export function createBroadcastBridge(
  meshController: MeshController,
  store: DTUStore
): BroadcastBridge {
  let config: BroadcastConfig = { ...DEFAULT_CONFIG };
  let bridgedCount = 0;
  // Track recently seen DTU content hashes for dedup across sources
  const recentHashes: Map<string, number> = new Map();
  const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  function configure(newConfig: BroadcastConfig): void {
    config = { ...newConfig };
  }

  function getConfig(): BroadcastConfig {
    return { ...config };
  }

  function cleanupDedupCache(): void {
    const now = Date.now();
    for (const [hash, timestamp] of recentHashes) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentHashes.delete(hash);
      }
    }
  }

  function getContentHashKey(dtu: DTU): string {
    return toHex(dtu.header.contentHash);
  }

  async function onBroadcastDTU(broadcastDTU: BroadcastDTU): Promise<void> {
    if (!config.bridgeModeEnabled) {
      return; // Bridge mode disabled, ignore
    }

    const dtu = broadcastDTU.dtu;

    // Step 1: Integrity check
    if (!verifyDTUIntegrity(dtu)) {
      return; // Failed integrity check, discard
    }

    // Step 2: Dedup check - by ID
    const alreadyStored = await store.hasDTU(dtu.id);
    if (alreadyStored) {
      return; // Already have this exact DTU
    }

    // Step 3: Dedup check - by content hash (same DTU via different source)
    const contentHashKey = getContentHashKey(dtu);
    if (recentHashes.has(contentHashKey)) {
      return; // Already received this content via another source
    }

    // Periodic cleanup of dedup cache
    cleanupDedupCache();

    // Step 4: Store locally
    const stored = await store.storeDTU(dtu);
    if (!stored) {
      return; // Storage failed
    }

    // Mark hash as seen
    recentHashes.set(contentHashKey, Date.now());

    // Step 5: Share to BLE mesh peers
    if (meshController.isConnected() && meshController.getPeerCount() > 0) {
      // Decrement TTL for relay
      const relayDTU: DTU = {
        ...dtu,
        meta: {
          ...dtu.meta,
          relayCount: dtu.meta.relayCount + 1,
          ttl: dtu.meta.ttl - 1,
        },
      };

      if (relayDTU.meta.ttl > 0) {
        await meshController.broadcastDTU(relayDTU);
      }
    }

    // Step 6: Optionally forward to server
    if (config.internetBridgeEnabled) {
      await forwardToServer(dtu, SERVER_URL);
    }

    bridgedCount++;
  }

  function getBridgedCount(): number {
    return bridgedCount;
  }

  return {
    configure,
    onBroadcastDTU,
    getBridgedCount,
    getConfig,
  };
}

// Export for testing
export { verifyDTUIntegrity, DEFAULT_CONFIG };
