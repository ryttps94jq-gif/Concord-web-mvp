// Concord Mobile — Mesh Controller
// Orchestrates BLE mesh: advertising + scanning + transfer + relay

import { TRANSPORT_LAYERS } from '../../utils/constants';
import { toHex } from '../../utils/crypto';
import type {
  DTU,
  MeshState,
  MeshHealth,
  MeshPeer,
  TransportStatus,
  RelayQueueEntry,
} from '../../utils/types';
import type { BLEAdvertiser } from './ble-advertiser';
import type { BLEScanner } from './ble-scanner';
import type { BLETransfer, TransferResult } from './ble-transfer';
import type { RelayEngine } from '../transport/relay';
import type { PeerManager } from '../transport/peer-manager';

// ── Mesh Controller Types ─────────────────────────────────────────────────────

export interface MeshControllerDeps {
  advertiser: BLEAdvertiser;
  scanner: BLEScanner;
  transfer: BLETransfer;
  relay: RelayEngine;
  peerManager: PeerManager;
}

export interface MeshController {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getMeshState(): MeshState;
  getMeshHealth(): MeshHealth;
  sendDTU(dtu: DTU): Promise<void>;
  onDTUReceived(callback: (dtu: DTU, peerId: string) => void): void;
  tick(): Promise<void>;
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createMeshController(deps: MeshControllerDeps): MeshController {
  const { advertiser, scanner, transfer, relay, peerManager } = deps;

  let running = false;
  let startedAt = 0;
  let dtusPropagated = 0;
  let dtusReceived = 0;
  const receiveCallbacks: Array<(dtu: DTU, peerId: string) => void> = [];

  // Handle incoming DTUs from BLE transfer
  transfer.onDTUReceived((dtu: DTU, peerId: string) => {
    dtusReceived++;

    // Compute content hash for dedup
    const dtuHash = toHex(dtu.header.contentHash);

    // Check for duplicate
    if (relay.isDuplicate(dtuHash)) {
      return;
    }

    // Mark as seen
    relay.markSeen(dtuHash);

    // Update peer reputation (valid DTU received)
    peerManager.updateReputation(peerId, true);

    // Notify listeners
    for (const cb of receiveCallbacks) {
      cb(dtu, peerId);
    }

    // Enqueue for relay to other peers (exclude sender)
    if (dtu.meta.ttl > 0) {
      relay.enqueue(dtu, [peerId]);
    }
  });

  // Send a DTU to a specific peer via BLE transfer
  async function sendToPeer(peerId: string, dtu: DTU): Promise<boolean> {
    try {
      const result: TransferResult = await transfer.sendDTU(peerId, dtu);
      if (result.success) {
        dtusPropagated++;
        peerManager.updateReputation(peerId, true);
      }
      return result.success;
    } catch (_e) {
      return false;
    }
  }

  return {
    async start(): Promise<void> {
      if (running) {
        return;
      }

      // Start advertising our presence
      await advertiser.start();

      // Start scanning for peers
      await scanner.startScan((peer: MeshPeer) => {
        peerManager.addPeer(peer);
      });

      running = true;
      startedAt = Date.now();
    },

    async stop(): Promise<void> {
      if (!running) {
        return;
      }

      await scanner.stopScan();
      await advertiser.stop();

      running = false;
    },

    isRunning(): boolean {
      return running;
    },

    getMeshState(): MeshState {
      const allPeers = peerManager.getAllPeers();
      const activePeers = peerManager.getActivePeers();
      const stats = relay.getQueueStats();

      const peersMap = new Map<string, MeshPeer>();
      for (const peer of allPeers) {
        peersMap.set(peer.id, peer);
      }

      // Build relay queue entries from stats
      const relayQueue: RelayQueueEntry[] = [];
      // We report queue depth, not full queue contents for efficiency

      const bluetoothTransport: TransportStatus = {
        layer: TRANSPORT_LAYERS.BLUETOOTH,
        available: true,
        active: running,
        peerCount: allPeers.filter(
          p => p.transport === TRANSPORT_LAYERS.BLUETOOTH,
        ).length,
        lastActivity: Date.now(),
      };

      return {
        peers: peersMap,
        activePeers: activePeers.length,
        transports: [bluetoothTransport],
        relayQueue,
        recentHashes: new Set(),
        meshHealth: this.getMeshHealth(),
      };
    },

    getMeshHealth(): MeshHealth {
      const activePeers = peerManager.getActivePeers();
      const activeTransports = advertiser.isAdvertising() ? 1 : 0;

      return {
        connectedPeers: activePeers.length,
        activeTransports,
        relayQueueDepth: relay.getQueueDepth(),
        dtusPropagated,
        dtusReceived,
        uptime: running ? Date.now() - startedAt : 0,
      };
    },

    async sendDTU(dtu: DTU): Promise<void> {
      // Mark as seen so we don't relay back to ourselves
      const dtuHash = toHex(dtu.header.contentHash);
      relay.markSeen(dtuHash);

      // Send to all active peers
      const activePeers = peerManager.getActivePeers();

      const sendPromises = activePeers.map(peer =>
        sendToPeer(peer.id, dtu).catch(() => false),
      );

      await Promise.all(sendPromises);

      // Also enqueue in relay for future peers
      if (dtu.meta.ttl > 0) {
        relay.enqueue(dtu, activePeers.map(p => p.id));
      }
    },

    onDTUReceived(callback: (dtu: DTU, peerId: string) => void): void {
      receiveCallbacks.push(callback);
    },

    async tick(): Promise<void> {
      if (!running) {
        return;
      }

      // 1. Prune stale peers (inactive for > 2 minutes)
      const STALE_THRESHOLD_MS = 120_000;
      peerManager.pruneStale(STALE_THRESHOLD_MS);

      // 2. Clear expired relay entries
      relay.clearExpired();

      // 3. Process relay queue
      const activePeers = peerManager.getActivePeers();
      const peerIds = activePeers.map(p => p.id);

      if (peerIds.length > 0) {
        await relay.processQueue(sendToPeer, peerIds);
      }
    },
  };
}
