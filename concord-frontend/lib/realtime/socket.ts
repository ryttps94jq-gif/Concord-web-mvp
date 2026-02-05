import { io, Socket } from 'socket.io-client';

// Socket URL: uses NEXT_PUBLIC_SOCKET_URL in production, falls back to API server port (5050) for local dev
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

let socket: Socket | null = null;

// Get authentication credentials from localStorage
function getAuthCredentials(): { token?: string; apiKey?: string } {
  if (typeof window === 'undefined') return {};

  const token = localStorage.getItem('concord_token');
  const apiKey = localStorage.getItem('concord_api_key');

  return {
    ...(token && { token }),
    ...(apiKey && { apiKey }),
  };
}

export function getSocket(): Socket {
  if (!socket) {
    const auth = getAuthCredentials();

    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      // SECURITY: Pass authentication credentials
      auth,
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      // If authentication failed, the error message will indicate this
      if (error.message === 'Authentication required') {
        console.warn('[Socket] Authentication required - please log in');
      }
    });

    // Handle hello message from server
    socket.on('hello', (data) => {
      console.log('[Socket] Server hello:', data);
    });
  }

  return socket;
}

// Reconnect with fresh credentials (call after login)
export function reconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.auth = getAuthCredentials();
    socket.connect();
  }
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

// Event types
export type SocketEvent =
  | 'resonance:update'
  | 'dtu:created'
  | 'dtu:updated'
  | 'dtu:deleted'
  | 'dtu:promoted'
  | 'council:proposal'
  | 'council:vote'
  | 'market:listing'
  | 'market:trade'
  | 'system:alert';

// Subscribe to events
export function subscribe<T>(event: SocketEvent, callback: (data: T) => void): () => void {
  const s = getSocket();
  s.on(event, callback);

  return () => {
    s.off(event, callback);
  };
}

// Emit events
export function emit(event: string, data?: unknown): void {
  const s = getSocket();
  if (s.connected) {
    s.emit(event, data);
  } else {
    console.warn('[Socket] Cannot emit - not connected');
  }
}

// Room management
export function joinRoom(room: string): void {
  emit('room:join', { room });
}

export function leaveRoom(room: string): void {
  emit('room:leave', { room });
}
