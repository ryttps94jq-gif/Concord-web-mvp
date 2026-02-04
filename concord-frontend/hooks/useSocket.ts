import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket URL: uses NEXT_PUBLIC_SOCKET_URL in production, falls back to API server port (5050) for local dev
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

interface UseSocketOptions {
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
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        autoConnect,
        reconnection,
        reconnectionAttempts,
        reconnectionDelay,
        transports: ['websocket', 'polling'],
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
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
    }
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
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
  const { socket, isConnected, on, off } = useSocket();
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
  const { socket, isConnected, on, off, emit } = useSocket();

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
