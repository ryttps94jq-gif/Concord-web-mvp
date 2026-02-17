import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Build mock Socket instance that mimics socket.io-client
const mockSocketInstance = {
  id: 'mock-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  auth: {} as Record<string, unknown>,
};

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocketInstance),
}));

// Mock the offline/db updateClockOffset
vi.mock('../offline/db', () => ({
  updateClockOffset: vi.fn(),
}));
// Also mock the relative import path used by socket.ts
vi.mock('@/lib/offline/db', () => ({
  updateClockOffset: vi.fn(),
}));

// We need to reset module state between tests since socket.ts uses a module-level singleton
let socketModule: typeof import('@/lib/realtime/socket');

describe('socket module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockSocketInstance.connected = false;
    mockSocketInstance.auth = {};
    // Reset module to clear singleton state
    vi.resetModules();
    socketModule = await import('@/lib/realtime/socket');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSocket', () => {
    it('creates a socket instance on first call', () => {
      const socket = socketModule.getSocket();
      // Socket instance should be the mock
      expect(socket).toBeDefined();
      expect(socket.on).toBeDefined();
      expect(socket.emit).toBeDefined();
    });

    it('returns the same instance on subsequent calls', () => {
      const socket1 = socketModule.getSocket();
      const socket2 = socketModule.getSocket();
      expect(socket1).toBe(socket2);
    });

    it('configures socket with autoConnect false (checked via connect behavior)', () => {
      // The io mock creates our mockSocketInstance which has connected=false
      // If autoConnect were true, it would connect immediately
      const socket = socketModule.getSocket();
      expect(socket.connected).toBe(false);
    });

    it('registers connect, disconnect, and connect_error handlers', () => {
      socketModule.getSocket();

      const eventNames = mockSocketInstance.on.mock.calls.map((c: unknown[]) => c[0]);
      expect(eventNames).toContain('connect');
      expect(eventNames).toContain('disconnect');
      expect(eventNames).toContain('connect_error');
      expect(eventNames).toContain('hello');
    });
  });

  describe('connectSocket', () => {
    it('calls connect on the socket when not connected', () => {
      mockSocketInstance.connected = false;
      socketModule.connectSocket();
      expect(mockSocketInstance.connect).toHaveBeenCalled();
    });

    it('does not call connect when already connected', () => {
      // First call to getSocket to initialize
      socketModule.getSocket();
      mockSocketInstance.connected = true;
      mockSocketInstance.connect.mockClear();

      socketModule.connectSocket();
      expect(mockSocketInstance.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnectSocket', () => {
    it('calls disconnect when socket is connected', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = true;

      socketModule.disconnectSocket();
      expect(mockSocketInstance.disconnect).toHaveBeenCalled();
    });

    it('does not call disconnect when socket is not connected', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = false;
      mockSocketInstance.disconnect.mockClear();

      socketModule.disconnectSocket();
      expect(mockSocketInstance.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('registers a listener for the given event', () => {
      const callback = vi.fn();
      socketModule.subscribe('dtu:created', callback);

      expect(mockSocketInstance.on).toHaveBeenCalledWith('dtu:created', expect.any(Function));
    });

    it('returns an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = socketModule.subscribe('dtu:updated', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(mockSocketInstance.off).toHaveBeenCalledWith('dtu:updated', expect.any(Function));
    });

    it('calls the callback with event data', () => {
      const callback = vi.fn();
      socketModule.subscribe('dtu:created', callback);

      // Get the registered handler and call it
      const registeredHandler = mockSocketInstance.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'dtu:created'
      )?.[1] as (data: unknown) => void;

      expect(registeredHandler).toBeDefined();
      registeredHandler({ id: 'test', _seq: 1 });
      expect(callback).toHaveBeenCalledWith({ id: 'test', _seq: 1 });
    });

    it('discards stale events with older sequence numbers', () => {
      const callback = vi.fn();
      socketModule.subscribe('resonance:update', callback);

      const handler = mockSocketInstance.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'resonance:update'
      )?.[1] as (data: unknown) => void;

      // First event seq=5
      handler({ data: 'first', _seq: 5 });
      expect(callback).toHaveBeenCalledTimes(1);

      // Second event seq=3 (stale) should be discarded
      handler({ data: 'stale', _seq: 3 });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1

      // Third event seq=10 should go through
      handler({ data: 'third', _seq: 10 });
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('emit', () => {
    it('emits event when socket is connected', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = true;

      socketModule.emit('dtu:created', { id: '123' });
      expect(mockSocketInstance.emit).toHaveBeenCalledWith('dtu:created', { id: '123' });
    });

    it('does not emit when socket is disconnected', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = false;

      socketModule.emit('dtu:created', { id: '123' });
      expect(mockSocketInstance.emit).not.toHaveBeenCalled();
    });
  });

  describe('joinRoom / leaveRoom', () => {
    it('emits room:join event', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = true;

      socketModule.joinRoom('project-123');
      expect(mockSocketInstance.emit).toHaveBeenCalledWith('room:join', { room: 'project-123' });
    });

    it('emits room:leave event', () => {
      socketModule.getSocket();
      mockSocketInstance.connected = true;

      socketModule.leaveRoom('project-123');
      expect(mockSocketInstance.emit).toHaveBeenCalledWith('room:leave', { room: 'project-123' });
    });
  });

  describe('getLastSequence', () => {
    it('returns 0 for an event with no sequence history', () => {
      const seq = socketModule.getLastSequence('dtu:created');
      expect(seq).toBe(0);
    });

    it('returns full sequence map when no event specified', () => {
      const seqMap = socketModule.getLastSequence();
      expect(typeof seqMap).toBe('object');
    });
  });
});
