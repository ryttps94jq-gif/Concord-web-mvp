import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Create mock socket instance
const mockSocketInstance = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
  connected: false,
};

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocketInstance),
}));

import { useSocket, useResonanceSocket, useDTUSocket } from '@/hooks/useSocket';
import { io } from 'socket.io-client';

const mockedIo = vi.mocked(io);

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstance.connected = false;
    mockSocketInstance.on.mockReset();
    mockSocketInstance.off.mockReset();
    mockSocketInstance.emit.mockReset();
    mockSocketInstance.connect.mockReset();
    mockSocketInstance.disconnect.mockReset();
    mockSocketInstance.removeAllListeners.mockReset();
  });

  it('initializes a socket with default options', () => {
    renderHook(() => useSocket());

    expect(mockedIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
        withCredentials: true,
      })
    );
  });

  it('initializes with custom options', () => {
    renderHook(() =>
      useSocket({
        autoConnect: true,
        reconnection: false,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
      })
    );

    expect(mockedIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autoConnect: true,
        reconnection: false,
        reconnectionAttempts: 3,
        reconnectionDelay: 500,
      })
    );
  });

  it('starts disconnected', () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current.isConnected).toBe(false);
  });

  it('registers connect, disconnect, and connect_error handlers', () => {
    renderHook(() => useSocket());

    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      'connect',
      expect.any(Function)
    );
    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      'connect_error',
      expect.any(Function)
    );
  });

  it('sets isConnected=true on connect event', () => {
    const { result } = renderHook(() => useSocket());

    // Find the connect handler and call it
    const connectCall = mockSocketInstance.on.mock.calls.find(
      (call) => call[0] === 'connect'
    );
    expect(connectCall).toBeTruthy();

    act(() => {
      connectCall![1]();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected=false on disconnect event', () => {
    const { result } = renderHook(() => useSocket());

    // Simulate connect
    const connectCall = mockSocketInstance.on.mock.calls.find(
      (call) => call[0] === 'connect'
    );
    act(() => {
      connectCall![1]();
    });
    expect(result.current.isConnected).toBe(true);

    // Simulate disconnect
    const disconnectCall = mockSocketInstance.on.mock.calls.find(
      (call) => call[0] === 'disconnect'
    );
    act(() => {
      disconnectCall![1]();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('sets isConnected=false on connect_error event', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSocket());

    // Simulate connect first
    const connectCall = mockSocketInstance.on.mock.calls.find(
      (call) => call[0] === 'connect'
    );
    act(() => {
      connectCall![1]();
    });

    // Simulate connect_error
    const errorCall = mockSocketInstance.on.mock.calls.find(
      (call) => call[0] === 'connect_error'
    );
    act(() => {
      errorCall![1]({ message: 'Connection refused' });
    });

    expect(result.current.isConnected).toBe(false);
    errorSpy.mockRestore();
  });

  it('connect() calls socket.connect when not connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = false;

    act(() => {
      result.current.connect();
    });

    expect(mockSocketInstance.connect).toHaveBeenCalled();
  });

  it('connect() does not call socket.connect when already connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = true;

    act(() => {
      result.current.connect();
    });

    expect(mockSocketInstance.connect).not.toHaveBeenCalled();
  });

  it('disconnect() calls socket.disconnect when connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = true;

    act(() => {
      result.current.disconnect();
    });

    expect(mockSocketInstance.disconnect).toHaveBeenCalled();
  });

  it('disconnect() does not call socket.disconnect when not connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = false;

    act(() => {
      result.current.disconnect();
    });

    expect(mockSocketInstance.disconnect).not.toHaveBeenCalled();
  });

  it('emit() calls socket.emit when connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = true;

    act(() => {
      result.current.emit('test-event', { foo: 'bar' });
    });

    expect(mockSocketInstance.emit).toHaveBeenCalledWith('test-event', {
      foo: 'bar',
    });
  });

  it('emit() does not call socket.emit when not connected', () => {
    const { result } = renderHook(() => useSocket());
    mockSocketInstance.connected = false;

    act(() => {
      result.current.emit('test-event', { foo: 'bar' });
    });

    expect(mockSocketInstance.emit).not.toHaveBeenCalled();
  });

  it('on() registers a listener on the socket', () => {
    const { result } = renderHook(() => useSocket());
    const callback = vi.fn();

    act(() => {
      result.current.on('custom-event', callback);
    });

    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      'custom-event',
      callback
    );
  });

  it('off() unregisters a listener with callback from the socket', () => {
    const { result } = renderHook(() => useSocket());
    const callback = vi.fn();

    act(() => {
      result.current.off('custom-event', callback);
    });

    expect(mockSocketInstance.off).toHaveBeenCalledWith(
      'custom-event',
      callback
    );
  });

  it('off() unregisters a listener without callback from the socket', () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.off('custom-event');
    });

    expect(mockSocketInstance.off).toHaveBeenCalledWith('custom-event');
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useSocket());

    unmount();

    expect(mockSocketInstance.removeAllListeners).toHaveBeenCalled();
    expect(mockSocketInstance.disconnect).toHaveBeenCalled();
  });
});

describe('useResonanceSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstance.connected = false;
    mockSocketInstance.on.mockReset();
    mockSocketInstance.off.mockReset();
  });

  it('returns initial state with null resonanceData', () => {
    const { result } = renderHook(() => useResonanceSocket());

    expect(result.current.resonanceData).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('subscribes to resonance:update event', () => {
    renderHook(() => useResonanceSocket());

    // The hook calls on('resonance:update', handler) via useSocket's on()
    // Since useSocket's on() delegates to socket.on(), we check that
    expect(mockSocketInstance.on).toHaveBeenCalledWith(
      'resonance:update',
      expect.any(Function)
    );
  });

  it('cleans up on unmount via removeAllListeners', () => {
    const { unmount } = renderHook(() => useResonanceSocket());

    unmount();

    // useSocket cleanup calls removeAllListeners + disconnect on unmount,
    // which handles all listener cleanup including the resonance:update handler
    expect(mockSocketInstance.removeAllListeners).toHaveBeenCalled();
    expect(mockSocketInstance.disconnect).toHaveBeenCalled();
  });
});

describe('useDTUSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstance.connected = false;
    mockSocketInstance.emit.mockReset();
  });

  it('returns expected interface', () => {
    const { result } = renderHook(() => useDTUSocket());

    expect(result.current.isConnected).toBe(false);
    expect(typeof result.current.subscribeToDTU).toBe('function');
    expect(typeof result.current.unsubscribeFromDTU).toBe('function');
    expect(typeof result.current.onDTUUpdate).toBe('function');
    expect(typeof result.current.offDTUUpdate).toBe('function');
  });

  it('subscribeToDTU emits dtu:subscribe', () => {
    const { result } = renderHook(() => useDTUSocket());
    mockSocketInstance.connected = true;

    act(() => {
      result.current.subscribeToDTU('dtu-123');
    });

    expect(mockSocketInstance.emit).toHaveBeenCalledWith('dtu:subscribe', {
      dtuId: 'dtu-123',
    });
  });

  it('unsubscribeFromDTU emits dtu:unsubscribe', () => {
    const { result } = renderHook(() => useDTUSocket());
    mockSocketInstance.connected = true;

    act(() => {
      result.current.unsubscribeFromDTU('dtu-456');
    });

    expect(mockSocketInstance.emit).toHaveBeenCalledWith('dtu:unsubscribe', {
      dtuId: 'dtu-456',
    });
  });
});
