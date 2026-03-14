// Concord Mobile — Peer Manager
// Manages discovered peers across all transports with reputation tracking

import type {
  MeshPeer,
  PeerReputation,
  TransportLayer,
} from '../../utils/types';

// ── Peer Manager Interface ────────────────────────────────────────────────────

export interface PeerManager {
  addPeer(peer: MeshPeer): void;
  removePeer(peerId: string): void;
  getPeer(peerId: string): MeshPeer | undefined;
  getAllPeers(): MeshPeer[];
  getActivePeers(): MeshPeer[];
  updateReputation(peerId: string, validDTU: boolean): void;
  getReputationScore(peerId: string): number;
  pruneStale(maxAgeMs: number): string[];
  selectBestPeers(count: number): MeshPeer[];
  getPeersByTransport(transport: TransportLayer): MeshPeer[];
}

// ── Reputation Calculation ────────────────────────────────────────────────────

/**
 * Calculates reputation score.
 * Formula: validDTUs / (validDTUs + invalidDTUs * 3)
 * Invalid DTUs are penalized 3x.
 * Returns 0.5 if no DTUs have been exchanged (neutral).
 */
export function calculateReputationScore(reputation: PeerReputation): number {
  const { validDTUs, invalidDTUs } = reputation;
  if (validDTUs === 0 && invalidDTUs === 0) {
    return 0.5; // Neutral starting score
  }
  const denominator = validDTUs + invalidDTUs * 3;
  if (denominator === 0) {
    return 0.5;
  }
  return validDTUs / denominator;
}

/**
 * Calculates peer selection score.
 * Combines reputation (0-1) with signal strength normalization.
 * RSSI typically ranges from -100 (weakest) to -30 (strongest).
 * We normalize RSSI to 0-1 range.
 */
export function calculatePeerScore(peer: MeshPeer): number {
  const reputationScore = peer.reputation.score;

  // Normalize RSSI: -100 maps to 0, -30 maps to 1
  const rssiNormalized = Math.max(0, Math.min(1, (peer.rssi + 100) / 70));

  // Weight: reputation 60%, signal 40%
  return reputationScore * 0.6 + rssiNormalized * 0.4;
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createPeerManager(): PeerManager {
  const peers = new Map<string, MeshPeer>();

  return {
    addPeer(peer: MeshPeer): void {
      const existing = peers.get(peer.id);
      if (existing) {
        // Merge: update transport info, rssi, lastSeen, but preserve reputation
        existing.rssi = peer.rssi;
        existing.lastSeen = peer.lastSeen;
        existing.transport = peer.transport;
        existing.authenticated = peer.authenticated || existing.authenticated;
        if (peer.name) {
          existing.name = peer.name;
        }
        if (peer.publicKey) {
          existing.publicKey = peer.publicKey;
        }
        // Merge capabilities
        existing.capabilities = {
          bluetooth: existing.capabilities.bluetooth || peer.capabilities.bluetooth,
          wifiDirect: existing.capabilities.wifiDirect || peer.capabilities.wifiDirect,
          nfc: existing.capabilities.nfc || peer.capabilities.nfc,
          lora: existing.capabilities.lora || peer.capabilities.lora,
          internet: existing.capabilities.internet || peer.capabilities.internet,
        };
      } else {
        peers.set(peer.id, { ...peer });
      }
    },

    removePeer(peerId: string): void {
      peers.delete(peerId);
    },

    getPeer(peerId: string): MeshPeer | undefined {
      return peers.get(peerId);
    },

    getAllPeers(): MeshPeer[] {
      return Array.from(peers.values());
    },

    getActivePeers(): MeshPeer[] {
      const now = Date.now();
      const ACTIVE_THRESHOLD_MS = 60_000; // 1 minute
      return Array.from(peers.values()).filter(
        peer => now - peer.lastSeen < ACTIVE_THRESHOLD_MS,
      );
    },

    updateReputation(peerId: string, validDTU: boolean): void {
      const peer = peers.get(peerId);
      if (!peer) {
        return;
      }

      if (validDTU) {
        peer.reputation.validDTUs++;
        peer.reputation.totalRelays++;
      } else {
        peer.reputation.invalidDTUs++;
      }

      peer.reputation.score = calculateReputationScore(peer.reputation);
    },

    getReputationScore(peerId: string): number {
      const peer = peers.get(peerId);
      if (!peer) {
        return 0;
      }
      return peer.reputation.score;
    },

    pruneStale(maxAgeMs: number): string[] {
      const now = Date.now();
      const pruned: string[] = [];

      for (const [id, peer] of peers) {
        if (now - peer.lastSeen > maxAgeMs) {
          peers.delete(id);
          pruned.push(id);
        }
      }

      return pruned;
    },

    selectBestPeers(count: number): MeshPeer[] {
      const allPeers = Array.from(peers.values());

      // Score and sort peers
      const scored = allPeers.map(peer => ({
        peer,
        score: calculatePeerScore(peer),
      }));

      scored.sort((a, b) => b.score - a.score);

      return scored.slice(0, count).map(s => s.peer);
    },

    getPeersByTransport(transport: TransportLayer): MeshPeer[] {
      return Array.from(peers.values()).filter(
        peer => peer.transport === transport,
      );
    },
  };
}
