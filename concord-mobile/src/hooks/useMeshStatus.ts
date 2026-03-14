// Concord Mobile — Mesh Status Hook
// Provides real-time mesh health information to UI components

import { useMeshStore } from '../store/mesh-store';
import type { MeshHealth, TransportStatus, ConnectionState } from '../utils/types';

interface MeshStatus {
  health: MeshHealth;
  transports: TransportStatus[];
  activeTransports: TransportStatus[];
  peerCount: number;
  connectionState: ConnectionState;
  isConnected: boolean;
  isMeshOnly: boolean;
  isOffline: boolean;
}

export function useMeshStatus(): MeshStatus {
  const meshHealth = useMeshStore(s => s.meshHealth);
  const transports = useMeshStore(s => s.transports);
  const connectionState = useMeshStore(s => s.connectionState);
  const peers = useMeshStore(s => s.peers);

  const activeTransports = transports.filter(t => t.active);

  return {
    health: meshHealth,
    transports,
    activeTransports,
    peerCount: peers.size,
    connectionState,
    isConnected: connectionState === 'online',
    isMeshOnly: connectionState === 'mesh-only',
    isOffline: connectionState === 'offline',
  };
}

export function usePeerCount(): number {
  return useMeshStore(s => s.peers.size);
}

export function useRelayQueueDepth(): number {
  return useMeshStore(s => s.relayQueue.length);
}
