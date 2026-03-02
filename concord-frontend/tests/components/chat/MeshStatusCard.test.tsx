import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MeshStatusCard from '@/components/chat/MeshStatusCard';

// ── Test Data Factories ──────────────────────────────────────────────

const makeMetrics = (overrides = {}) => ({
  initialized: true,
  nodeId: 'node-abc-123',
  activeChannelCount: 3,
  totalChannels: 7,
  peerCount: 5,
  pendingQueueSize: 2,
  activeTransfers: 1,
  uptime: 7200000, // 2h
  stats: {
    totalTransmissions: 150,
    totalReceived: 120,
    totalRelayed: 30,
    totalStoreForward: 10,
    bytesSent: 1048576, // 1 MB
    bytesReceived: 524288, // 512 KB
    failovers: 2,
  },
  ...overrides,
});

const makeChannels = () => [
  {
    layer: 'internet',
    available: true,
    status: 'active',
    lastSeen: new Date().toISOString(),
    latencyMs: 25,
    spec: {
      name: 'Internet',
      protocol: 'TCP/IP',
      range: 'unlimited',
      speed: 'high',
      bandwidth: '100Mbps',
      priority: 1,
      maxPayloadBytes: 1000000,
    },
  },
  {
    layer: 'bluetooth',
    available: false,
    status: 'off',
    lastSeen: null,
    latencyMs: null,
    spec: {
      name: 'Bluetooth',
      protocol: 'BLE',
      range: '10m',
      speed: 'medium',
      bandwidth: '2Mbps',
      priority: 3,
      maxPayloadBytes: 50000,
    },
  },
];

const makePeers = () => [
  {
    nodeId: 'peer-xyz-789',
    channels: ['internet', 'bluetooth'],
    relay: true,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    transmissions: 45,
    discoveredVia: 'mdns',
  },
  {
    nodeId: 'peer-abc-456',
    channels: ['internet'],
    relay: false,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    transmissions: 12,
    discoveredVia: 'manual',
  },
];

const makeTopology = () => ({
  selfNodeId: 'node-self-001',
  nodes: [
    { nodeId: 'peer-1', channels: ['internet', 'lora'], lastSeen: new Date().toISOString(), relay: true },
    { nodeId: 'peer-2', channels: ['bluetooth'], lastSeen: new Date().toISOString(), relay: false },
  ],
  totalNodes: 3,
  activeChannels: ['internet', 'lora'],
});

const makeTransfer = (overrides = {}) => ({
  id: 'transfer-1',
  totalComponents: 20,
  sentComponents: 15,
  verifiedComponents: 12,
  failedComponents: 1,
  status: 'in_progress',
  channels: ['internet', 'wifi_direct'],
  startedAt: new Date().toISOString(),
  completedAt: null,
  ...overrides,
});

const makeTransmissions = () => [
  {
    id: 'tx-1',
    channel: 'internet',
    destinationNodeId: 'peer-xyz-789',
    packetCount: 5,
    totalBytes: 2048,
    fragmented: false,
    sentAt: new Date().toISOString(),
    status: 'sent',
  },
  {
    id: 'tx-2',
    channel: 'bluetooth',
    destinationNodeId: 'peer-abc-456',
    packetCount: 12,
    totalBytes: 65536,
    fragmented: true,
    sentAt: new Date().toISOString(),
    status: 'pending',
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('MeshStatusCard', () => {
  // ── type="status" ──────────────────────────────────────────────

  describe('type="status"', () => {
    it('renders Mesh Status header', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('Mesh Status')).toBeInTheDocument();
    });

    it('returns null when metrics is undefined', () => {
      const { container } = render(<MeshStatusCard type="status" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows Active badge when initialized', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows Offline badge when not initialized', () => {
      render(
        <MeshStatusCard
          type="status"
          metrics={makeMetrics({ initialized: false })}
        />
      );
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows node ID', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('node-abc-123')).toBeInTheDocument();
    });

    it('shows active/total channel count', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('3 / 7')).toBeInTheDocument();
    });

    it('shows peer count', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows uptime formatted', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('2h 0m')).toBeInTheDocument();
    });

    it('shows byte counts', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('Sent: 1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('Received: 512.0 KB')).toBeInTheDocument();
    });

    it('shows failover count when > 0', () => {
      render(<MeshStatusCard type="status" metrics={makeMetrics()} />);
      expect(screen.getByText('Failovers: 2')).toBeInTheDocument();
    });

    it('hides failover count when 0', () => {
      render(
        <MeshStatusCard
          type="status"
          metrics={makeMetrics({
            stats: { ...makeMetrics().stats, failovers: 0 },
          })}
        />
      );
      expect(screen.queryByText(/Failovers:/)).not.toBeInTheDocument();
    });
  });

  // ── type="channels" ────────────────────────────────────────────

  describe('type="channels"', () => {
    it('renders Transport Channels header', () => {
      render(<MeshStatusCard type="channels" channels={makeChannels()} />);
      expect(screen.getByText('Transport Channels')).toBeInTheDocument();
    });

    it('returns null when channels is undefined', () => {
      const { container } = render(<MeshStatusCard type="channels" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows channel labels', () => {
      render(<MeshStatusCard type="channels" channels={makeChannels()} />);
      expect(screen.getByText('Internet')).toBeInTheDocument();
      expect(screen.getByText('Bluetooth')).toBeInTheDocument();
    });

    it('shows Active/Off status per channel', () => {
      render(<MeshStatusCard type="channels" channels={makeChannels()} />);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Off')).toBeInTheDocument();
    });
  });

  // ── type="peers" ───────────────────────────────────────────────

  describe('type="peers"', () => {
    it('renders Mesh Peers header', () => {
      render(<MeshStatusCard type="peers" peers={makePeers()} />);
      expect(screen.getByText('Mesh Peers')).toBeInTheDocument();
    });

    it('returns null when peers is undefined', () => {
      const { container } = render(<MeshStatusCard type="peers" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows "No peers discovered yet" for empty array', () => {
      render(<MeshStatusCard type="peers" peers={[]} />);
      expect(screen.getByText('No peers discovered yet')).toBeInTheDocument();
    });

    it('shows peer node IDs', () => {
      render(<MeshStatusCard type="peers" peers={makePeers()} />);
      expect(screen.getByText('peer-xyz-789')).toBeInTheDocument();
      expect(screen.getByText('peer-abc-456')).toBeInTheDocument();
    });

    it('shows discovered count', () => {
      render(<MeshStatusCard type="peers" peers={makePeers()} />);
      expect(screen.getByText('2 discovered')).toBeInTheDocument();
    });

    it('expands peer details on click', () => {
      render(<MeshStatusCard type="peers" peers={makePeers()} />);

      // Click on the first peer
      fireEvent.click(screen.getByText('peer-xyz-789'));

      expect(screen.getByText(/Discovered via:/)).toBeInTheDocument();
      expect(screen.getByText('mdns')).toBeInTheDocument();
    });
  });

  // ── type="topology" ────────────────────────────────────────────

  describe('type="topology"', () => {
    it('renders Mesh Topology header', () => {
      render(<MeshStatusCard type="topology" topology={makeTopology()} />);
      expect(screen.getByText('Mesh Topology')).toBeInTheDocument();
    });

    it('returns null when topology is undefined', () => {
      const { container } = render(<MeshStatusCard type="topology" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows self node ID', () => {
      render(<MeshStatusCard type="topology" topology={makeTopology()} />);
      expect(screen.getByText('node-self-001')).toBeInTheDocument();
      expect(screen.getByText('(self)')).toBeInTheDocument();
    });

    it('shows total node count', () => {
      render(<MeshStatusCard type="topology" topology={makeTopology()} />);
      expect(screen.getByText('3 nodes')).toBeInTheDocument();
    });
  });

  // ── type="transfer" ────────────────────────────────────────────

  describe('type="transfer"', () => {
    it('renders Consciousness Transfer header', () => {
      render(<MeshStatusCard type="transfer" transfer={makeTransfer()} />);
      expect(screen.getByText('Consciousness Transfer')).toBeInTheDocument();
    });

    it('returns null when transfer is undefined', () => {
      const { container } = render(<MeshStatusCard type="transfer" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows transfer progress', () => {
      render(<MeshStatusCard type="transfer" transfer={makeTransfer()} />);
      expect(screen.getByText('15 / 20 components sent')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('shows verified and failed counts', () => {
      render(<MeshStatusCard type="transfer" transfer={makeTransfer()} />);
      expect(screen.getByText('12')).toBeInTheDocument(); // verified
      expect(screen.getByText('1')).toBeInTheDocument(); // failed
    });

    it('shows status badge', () => {
      render(<MeshStatusCard type="transfer" transfer={makeTransfer()} />);
      expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    });

    it('shows COMPLETED status', () => {
      render(
        <MeshStatusCard
          type="transfer"
          transfer={makeTransfer({ status: 'completed' })}
        />
      );
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });
  });

  // ── type="stats" ───────────────────────────────────────────────

  describe('type="stats"', () => {
    it('renders Recent Transmissions header', () => {
      render(
        <MeshStatusCard type="stats" transmissions={makeTransmissions()} />
      );
      expect(screen.getByText('Recent Transmissions')).toBeInTheDocument();
    });

    it('returns null when transmissions is undefined', () => {
      const { container } = render(<MeshStatusCard type="stats" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows "No recent transmissions" for empty array', () => {
      render(<MeshStatusCard type="stats" transmissions={[]} />);
      expect(
        screen.getByText('No recent transmissions')
      ).toBeInTheDocument();
    });

    it('shows transmission destination node IDs', () => {
      render(
        <MeshStatusCard type="stats" transmissions={makeTransmissions()} />
      );
      expect(screen.getByText('peer-xyz-789')).toBeInTheDocument();
      expect(screen.getByText('peer-abc-456')).toBeInTheDocument();
    });

    it('shows fragmented indicator for fragmented transmissions', () => {
      render(
        <MeshStatusCard type="stats" transmissions={makeTransmissions()} />
      );
      expect(screen.getByText('fragmented')).toBeInTheDocument();
    });
  });

  // ── Unknown type ───────────────────────────────────────────────

  it('returns null for unknown type', () => {
    const { container } = render(
      <MeshStatusCard type={'unknown' as 'status'} />
    );
    expect(container.innerHTML).toBe('');
  });
});
