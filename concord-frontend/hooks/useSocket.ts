/**
 * FE-011: WebSocket hook with proper lifecycle management.
 *
 * - Connects lazily (only when `autoConnect` is true or `connect()` is called)
 * - Disconnects on unmount — no orphaned connections
 * - Tracks active subscriptions to prevent listener leaks
 * - Logs connection state changes for observability
 *
 * FE-WIRING: Universal event forwarder — every socket event goes to:
 *   1. Event bus (for component-level subscriptions)
 *   2. Zustand stores (for DTU, system, and sovereign state)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/realtime/socket';
import { emitEvent } from '@/lib/realtime/event-bus';
import { useLatticeStore } from '@/store/lattice';
import { useSystemStore } from '@/store/system';
import { useSovereignStore } from '@/store/sovereign';
import { useUIStore } from '@/store/ui';
import type { SocketEvent } from '@/lib/realtime/socket';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// ── All events to forward to the event bus ─────────────────────
const FORWARDED_EVENTS: SocketEvent[] = [
  // DTU lifecycle
  'dtu:created', 'dtu:updated', 'dtu:deleted', 'dtu:promoted',
  // Entity lifecycle
  'entity:death', 'body:instantiated', 'body:destroyed',
  // Pain / qualia
  'pain:recorded', 'pain:processed', 'pain:wound_created', 'pain:wound_healed',
  'affect:pain_signal',
  // Repair cortex
  'repair:dtu_logged', 'repair:cycle_complete',
  // Meta-derivation
  'lattice:meta:derived', 'lattice:meta:convergence', 'meta:committed',
  // System
  'system:alert', 'queue:notifications:new',
  // Council
  'council:proposal', 'council:vote',
  // Marketplace
  'market:listing', 'market:trade',
  // Creative Registry & Royalties
  'creative_registry:update', 'marketplace:purchase',
  // Collaboration
  'collab:change', 'collab:lock', 'collab:unlock',
  'collab:session:created', 'collab:user:joined',
  // Cognitive systems
  'attention:allocation', 'forgetting:cycle_complete',
  'dream:captured', 'promotion:approved', 'promotion:rejected',
  'app:published',
  // Music / studio
  'music:toggle',
  // Whiteboard
  'whiteboard:updated',
  // Resonance
  'resonance:update',
  // MEGA SPEC: Chat streaming events
  'chat:status', 'chat:token', 'chat:web_results', 'chat:complete',
  // MEGA SPEC: Artifact & quality lifecycle events
  'artifact:rendered', 'quality:approved', 'quality:rejected',
  // MEGA SPEC: Entity & pipeline events
  'entity:production_mode', 'pipeline:triggered',
  // 12 NEW CAPABILITIES events
  'pipeline:started', 'pipeline:step_started', 'pipeline:step_completed', 'pipeline:completed',
  'prediction:ready', 'agent:insights',
  'collab:invite', 'collab:accepted',
  'teaching:promotion_suggestion',
  'research:started', 'research:completed',
  // Shared Instance Conversation events
  'shared-session:invite', 'shared-session:joined',
  'shared-session:message', 'shared-session:ai-response',
  'shared-session:artifact-produced', 'shared-session:dtu-shared',
  'shared-session:ended',
];

interface UseSocketOptions {
  /** Connect automatically on mount (default: false — opt-in to reduce idle connections) */
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: unknown) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    autoConnect = false, // FE-011: default false to prevent idle connections
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Set<string>>(new Set());

  // Initialize socket — use singleton from lib/realtime/socket.ts to avoid duplicate connections
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = (error: Error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // ── Universal event forwarder ─────────────────────────────
    const eventHandlers: Array<{ event: string; handler: (data: unknown) => void }> = [];
    for (const event of FORWARDED_EVENTS) {
      const handler = (data: unknown) => {
        // 1. Forward to event bus (for component-level subscriptions)
        emitEvent(event, data);
        // 2. Push into Zustand stores for relevant events
        routeToStores(event, data);
      };
      socket.on(event, handler);
      eventHandlers.push({ event, handler });
    }

    socketRef.current = socket;
    if (autoConnect && !socket.connected) socket.connect();
    if (socket.connected) setIsConnected(true);

    // FE-011: Clean up on unmount — remove OUR listeners (don't disconnect shared socket)
    const listeners = listenersRef.current;
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      for (const { event, handler } of eventHandlers) socket.off(event, handler);
      socketRef.current = null;
      listeners.clear();
      setIsConnected(false);
    };
  }, [autoConnect, reconnection, reconnectionAttempts, reconnectionDelay]);

  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      listenersRef.current.add(event);
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
      listenersRef.current.delete(event);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}

// ── Store routing ──────────────────────────────────────────────

function routeToStores(event: SocketEvent, data: unknown) {
  const d = data as Record<string, unknown>;

  switch (event) {
    // DTU → lattice store
    case 'dtu:created':
      if (d && d.id) {
        useLatticeStore.getState().addRecentDTU(d as never);
      }
      break;
    case 'dtu:updated':
      if (d && d.id) {
        useLatticeStore.getState().updateDTU(d.id as string, d.changes as never ?? d);
      }
      break;
    case 'dtu:deleted':
      if (d && d.id) {
        useLatticeStore.getState().removeDTU(d.id as string);
      }
      break;

    // System alerts → UI store toast
    case 'system:alert':
      if (d && d.message) {
        useUIStore.getState().addToast({
          type: (d.type as 'error' | 'warning' | 'info') || 'info',
          message: d.message as string,
          duration: 8000,
        });
        useSystemStore.getState().addSystemAlert(d as never);
      }
      break;

    // Attention → system store
    case 'attention:allocation':
      if (d) {
        if (Array.isArray(d.allocation)) {
          useSystemStore.getState().setAttentionAllocation(d.allocation as never);
        }
        if (d.focusOverride !== undefined) {
          useSystemStore.getState().setFocusOverride(d.focusOverride as never);
        }
      }
      break;

    // Forgetting → system store
    case 'forgetting:cycle_complete':
      // Partial update — components will refetch full stats
      break;

    // Repair → system store
    case 'repair:cycle_complete':
      // Trigger refetch in subscribed components via event bus
      break;

    // Dream → sovereign store
    case 'dream:captured':
      if (d && d.id) {
        useSovereignStore.getState().addDream(d as never);
      }
      break;

    // Promotion → sovereign store
    case 'promotion:approved':
    case 'promotion:rejected':
      if (d && d.id) {
        useSovereignStore.getState().updatePromotion(d.id as string, d as never);
      }
      break;

    // Meta-derivation → sovereign store
    case 'lattice:meta:derived':
    case 'lattice:meta:convergence':
    case 'meta:committed':
      if (d) {
        useSovereignStore.getState().addMetaEvent({
          id: (d.id ?? d.invariantId ?? `meta-${Date.now()}`) as string,
          summary: (d.summary ?? event) as string,
          timestamp: new Date().toISOString(),
          type: event,
        });
      }
      break;
  }
}

// ── Specific socket hooks for different features ───────────────

export function useResonanceSocket() {
  const { isConnected, on, off } = useSocket({ autoConnect: true });
  const [resonanceData, setResonanceData] = useState<unknown>(null);

  useEffect(() => {
    const handleResonance = (data: unknown) => {
      setResonanceData(data);
    };

    on('resonance:update', handleResonance);

    return () => {
      off('resonance:update', handleResonance);
    };
  }, [on, off]);

  return { resonanceData, isConnected };
}

export function useDTUSocket() {
  const { isConnected, on, off, emit } = useSocket({ autoConnect: true });

  const subscribeToDTU = useCallback(
    (dtuId: string) => {
      emit('dtu:subscribe', { dtuId });
    },
    [emit]
  );

  const unsubscribeFromDTU = useCallback(
    (dtuId: string) => {
      emit('dtu:unsubscribe', { dtuId });
    },
    [emit]
  );

  return {
    isConnected,
    subscribeToDTU,
    unsubscribeFromDTU,
    onDTUUpdate: on,
    offDTUUpdate: off,
  };
}
