// Tests for WiFi Direct Manager
// Tests group formation, data transfer, battery-based owner selection, and connection lifecycle

import {
  createWiFiDirectManager,
  encodeDataForTransport,
  decodeDataFromTransport,
} from '../../mesh/wifi-direct/wifi-direct-manager';
import type {
  WiFiP2PModule,
  WiFiP2PPeer,
  WiFiP2PInfo,
  WiFiP2PGroupInfo,
  BatteryInfo,
} from '../../mesh/wifi-direct/wifi-direct-manager';
import { WIFI_DIRECT_GROUP_TIMEOUT_MS } from '../../utils/constants';

// ── Mock WiFi P2P Module ─────────────────────────────────────────────────────

function createMockWiFiP2P(options?: {
  peers?: WiFiP2PPeer[];
  connectionInfo?: WiFiP2PInfo;
  groupInfo?: WiFiP2PGroupInfo | null;
  failConnect?: boolean;
  failSend?: boolean;
  receiveMessages?: string[];
}): WiFiP2PModule {
  const opts = options ?? {};
  const peers: WiFiP2PPeer[] = opts.peers ?? [
    { deviceName: 'Peer-A', deviceAddress: 'AA:BB:CC:DD:EE:01', isGroupOwner: false, status: 3 },
    { deviceName: 'Peer-B', deviceAddress: 'AA:BB:CC:DD:EE:02', isGroupOwner: false, status: 3 },
  ];

  const connInfo: WiFiP2PInfo = opts.connectionInfo ?? {
    groupFormed: true,
    isGroupOwner: false,
    groupOwnerAddress: '192.168.49.1',
  };

  const groupInfo: WiFiP2PGroupInfo | null = opts.groupInfo ?? {
    networkName: 'DIRECT-concord',
    isGroupOwner: false,
    ownerAddress: '192.168.49.1',
    clients: ['AA:BB:CC:DD:EE:01'],
  };

  let receiveIdx = 0;
  const sentMessages: string[] = [];

  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    startDiscoveringPeers: jest.fn().mockResolvedValue('started'),
    stopDiscoveringPeers: jest.fn().mockResolvedValue(undefined),
    getAvailablePeers: jest.fn().mockResolvedValue(peers),
    connect: jest.fn().mockImplementation(async () => {
      if (opts.failConnect) throw new Error('Connection failed');
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionInfo: jest.fn().mockResolvedValue(connInfo),
    sendMessage: jest.fn().mockImplementation(async (msg: string) => {
      if (opts.failSend) throw new Error('Send failed');
      sentMessages.push(msg);
    }),
    sendFile: jest.fn().mockResolvedValue(undefined),
    receiveMessage: jest.fn().mockImplementation(async () => {
      const msgs = opts.receiveMessages ?? [];
      if (receiveIdx < msgs.length) {
        return msgs[receiveIdx++];
      }
      throw new Error('No data');
    }),
    getGroupInfo: jest.fn().mockResolvedValue(groupInfo),
  };
}

// ── encodeDataForTransport / decodeDataFromTransport ─────────────────────────

describe('encodeDataForTransport', () => {
  it('encodes data with CONCORD prefix and hex payload', () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const encoded = encodeDataForTransport(data);
    expect(encoded).toBe('CONCORD:5:48656c6c6f');
  });

  it('handles empty data', () => {
    const data = new Uint8Array(0);
    const encoded = encodeDataForTransport(data);
    expect(encoded).toBe('CONCORD:0:');
  });

  it('handles single byte', () => {
    const data = new Uint8Array([0xff]);
    const encoded = encodeDataForTransport(data);
    expect(encoded).toBe('CONCORD:1:ff');
  });

  it('pads single-digit hex values with zero', () => {
    const data = new Uint8Array([0x01, 0x0a, 0x00]);
    const encoded = encodeDataForTransport(data);
    expect(encoded).toBe('CONCORD:3:010a00');
  });
});

describe('decodeDataFromTransport', () => {
  it('decodes valid CONCORD-prefixed message', () => {
    const decoded = decodeDataFromTransport('CONCORD:5:48656c6c6f');
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded!)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
  });

  it('returns null for non-CONCORD messages', () => {
    expect(decodeDataFromTransport('HELLO:5:48656c6c6f')).toBeNull();
    expect(decodeDataFromTransport('random data')).toBeNull();
    expect(decodeDataFromTransport('')).toBeNull();
  });

  it('returns null for malformed messages', () => {
    expect(decodeDataFromTransport('CONCORD:abc:48656c6c6f')).toBeNull();
    expect(decodeDataFromTransport('CONCORD:-1:ff')).toBeNull();
    expect(decodeDataFromTransport('CONCORD:5:48')).toBeNull(); // length mismatch
  });

  it('returns null for wrong number of parts', () => {
    expect(decodeDataFromTransport('CONCORD:5')).toBeNull();
    expect(decodeDataFromTransport('CONCORD:5:aa:bb')).toBeNull();
  });

  it('round-trips encode/decode', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const encoded = encodeDataForTransport(original);
    const decoded = decodeDataFromTransport(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips large data', () => {
    const original = new Uint8Array(1000);
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256;
    }
    const encoded = encodeDataForTransport(original);
    const decoded = decodeDataFromTransport(encoded);
    expect(decoded).toEqual(original);
  });
});

// ── createWiFiDirectManager ──────────────────────────────────────────────────

describe('createWiFiDirectManager', () => {
  // ── discoverPeers ──

  describe('discoverPeers', () => {
    it('initializes, starts discovery, and returns peer addresses', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      const peers = await manager.discoverPeers();

      expect(mockP2P.initialize).toHaveBeenCalled();
      expect(mockP2P.startDiscoveringPeers).toHaveBeenCalled();
      expect(mockP2P.stopDiscoveringPeers).toHaveBeenCalled();
      expect(peers).toEqual(['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02']);
    });

    it('returns empty array when no peers found', async () => {
      const mockP2P = createMockWiFiP2P({ peers: [] });
      // Override to always return empty peers quickly
      (mockP2P.getAvailablePeers as jest.Mock).mockResolvedValue([]);
      const manager = createWiFiDirectManager(mockP2P);

      // This will time out but should eventually return empty
      // Mock setTimeout to be instant
      jest.useFakeTimers();
      const peersPromise = manager.discoverPeers();
      jest.advanceTimersByTime(WIFI_DIRECT_GROUP_TIMEOUT_MS + 1000);
      jest.useRealTimers();

      const peers = await peersPromise;
      expect(peers).toEqual([]);
    });
  });

  // ── connect ──

  describe('connect', () => {
    it('connects to a peer and returns WiFiDirectGroup', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      const group = await manager.connect('AA:BB:CC:DD:EE:01');

      expect(mockP2P.connect).toHaveBeenCalledWith('AA:BB:CC:DD:EE:01');
      expect(group.ownerAddress).toBe('192.168.49.1');
      expect(group.isOwner).toBe(false);
      expect(group.ssid).toBe('DIRECT-concord');
      expect(group.members).toEqual(['AA:BB:CC:DD:EE:01']);
    });

    it('sets connected state to true after successful connection', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      expect(manager.isConnected()).toBe(false);
      await manager.connect('AA:BB:CC:DD:EE:01');
      expect(manager.isConnected()).toBe(true);
    });

    it('throws when already connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      await expect(manager.connect('AA:BB:CC:DD:EE:02')).rejects.toThrow(
        'Already connected',
      );
    });

    it('throws when connection fails', async () => {
      const mockP2P = createMockWiFiP2P({ failConnect: true });
      const manager = createWiFiDirectManager(mockP2P);

      await expect(manager.connect('AA:BB:CC:DD:EE:01')).rejects.toThrow(
        'Connection failed',
      );
      expect(manager.isConnected()).toBe(false);
    });

    it('throws when group formation fails', async () => {
      const mockP2P = createMockWiFiP2P({
        connectionInfo: {
          groupFormed: false,
          isGroupOwner: false,
          groupOwnerAddress: '',
        },
      });
      const manager = createWiFiDirectManager(mockP2P);

      await expect(manager.connect('AA:BB:CC:DD:EE:01')).rejects.toThrow(
        'group formation failed',
      );
    });

    it('rejects low-battery device as group owner', async () => {
      const mockP2P = createMockWiFiP2P({
        connectionInfo: {
          groupFormed: true,
          isGroupOwner: true,
          groupOwnerAddress: '192.168.49.1',
        },
      });
      const getBattery = (): BatteryInfo => ({ level: 0.1 }); // 10% battery
      const manager = createWiFiDirectManager(mockP2P, getBattery);

      await expect(manager.connect('AA:BB:CC:DD:EE:01')).rejects.toThrow(
        'Low battery device cannot be group owner',
      );
    });

    it('allows adequate-battery device as group owner', async () => {
      const mockP2P = createMockWiFiP2P({
        connectionInfo: {
          groupFormed: true,
          isGroupOwner: true,
          groupOwnerAddress: '192.168.49.1',
        },
      });
      const getBattery = (): BatteryInfo => ({ level: 0.8 });
      const manager = createWiFiDirectManager(mockP2P, getBattery);

      const group = await manager.connect('AA:BB:CC:DD:EE:01');
      expect(group.isOwner).toBe(true);
    });

    it('uses peer address as fallback member when groupInfo has no clients', async () => {
      const mockP2P = createMockWiFiP2P({ groupInfo: null });
      (mockP2P.getGroupInfo as jest.Mock).mockResolvedValue(null);
      const manager = createWiFiDirectManager(mockP2P);

      const group = await manager.connect('AA:BB:CC:DD:EE:01');
      expect(group.members).toEqual(['AA:BB:CC:DD:EE:01']);
    });
  });

  // ── disconnect ──

  describe('disconnect', () => {
    it('disconnects and resets state', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      expect(manager.isConnected()).toBe(true);

      await manager.disconnect();

      expect(manager.isConnected()).toBe(false);
      expect(manager.getGroup()).toBeNull();
      expect(manager.getConnectionInfo()).toBeNull();
      expect(mockP2P.disconnect).toHaveBeenCalled();
    });

    it('is safe to call when not connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await expect(manager.disconnect()).resolves.not.toThrow();
    });

    it('resets state even if underlying disconnect fails', async () => {
      const mockP2P = createMockWiFiP2P();
      (mockP2P.disconnect as jest.Mock).mockRejectedValue(new Error('Disconnect error'));
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      await expect(manager.disconnect()).rejects.toThrow('Disconnect error');

      // State should still be reset via finally block
      expect(manager.isConnected()).toBe(false);
    });
  });

  // ── getGroup ──

  describe('getGroup', () => {
    it('returns null when not connected', () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);
      expect(manager.getGroup()).toBeNull();
    });

    it('returns current group when connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      const group = manager.getGroup();

      expect(group).not.toBeNull();
      expect(group!.ownerAddress).toBe('192.168.49.1');
    });
  });

  // ── getConnectionInfo ──

  describe('getConnectionInfo', () => {
    it('returns null when not connected', () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);
      expect(manager.getConnectionInfo()).toBeNull();
    });

    it('returns connection info when connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      const info = manager.getConnectionInfo();

      expect(info).not.toBeNull();
      expect(info!.isOwner).toBe(false);
      expect(info!.ownerAddress).toBe('192.168.49.1');
    });
  });

  // ── sendData ──

  describe('sendData', () => {
    it('sends data when connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const bytesSent = await manager.sendData(data);

      expect(bytesSent).toBe(5);
      expect(mockP2P.sendMessage).toHaveBeenCalled();
    });

    it('throws when not connected', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await expect(manager.sendData(new Uint8Array([1]))).rejects.toThrow(
        'Not connected',
      );
    });

    it('sends data encoded in CONCORD transport format', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      await manager.sendData(new Uint8Array([0xAB, 0xCD]));

      const sentArg = (mockP2P.sendMessage as jest.Mock).mock.calls[0][0];
      expect(sentArg).toBe('CONCORD:2:abcd');
    });

    it('handles sending large data', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      const largeData = new Uint8Array(10000);
      const bytesSent = await manager.sendData(largeData);

      expect(bytesSent).toBe(10000);
    });
  });

  // ── onDataReceived ──

  describe('onDataReceived', () => {
    it('registers a callback', () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      const callback = jest.fn();
      manager.onDataReceived(callback);
      // Callback is registered but not called yet (no data received)
      expect(callback).not.toHaveBeenCalled();
    });

    it('allows multiple callbacks', () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      const cb1 = jest.fn();
      const cb2 = jest.fn();
      manager.onDataReceived(cb1);
      manager.onDataReceived(cb2);
      // Both registered successfully — no throws
    });
  });

  // ── isConnected ──

  describe('isConnected', () => {
    it('returns false initially', () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);
      expect(manager.isConnected()).toBe(false);
    });

    it('returns true after connect', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      expect(manager.isConnected()).toBe(true);
    });

    it('returns false after disconnect', async () => {
      const mockP2P = createMockWiFiP2P();
      const manager = createWiFiDirectManager(mockP2P);

      await manager.connect('AA:BB:CC:DD:EE:01');
      await manager.disconnect();
      expect(manager.isConnected()).toBe(false);
    });
  });
});
