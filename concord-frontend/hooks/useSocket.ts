/**
 * FE-011: WebSocket hook with proper lifecycle management.
 *
 * - Connects lazily (only when `autoConnect` is true or `connect()` is called)
 * - Disconnects on unmount — no orphaned connections
 * - Tracks active subscriptions to prevent listener leaks
 * - Logs connection state changes for observability
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

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

  // Initialize socket
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      autoConnect,
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    socketRef.current = socket;

    // FE-011: Clean up on unmount — disconnect and remove all listeners
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      listenersRef.current.clear();
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

// Specific socket hooks for different features
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
