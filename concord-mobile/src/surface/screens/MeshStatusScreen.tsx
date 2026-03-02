// Concord Mobile — Mesh Status Screen
// Displays connected peers, transport layers, signal strength, mesh health

import React from 'react';
import { View, Text, FlatList, StyleSheet, ScrollView, Platform } from 'react-native';
import { useMeshStatus } from '../../hooks/useMeshStatus';
import { useMeshStore } from '../../store/mesh-store';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { TRANSPORT_LAYERS } from '../../utils/constants';
import type { MeshPeer, TransportStatus } from '../../utils/types';

const TRANSPORT_NAMES: Record<number, string> = {
  [TRANSPORT_LAYERS.INTERNET]: 'Internet',
  [TRANSPORT_LAYERS.WIFI_DIRECT]: 'WiFi Direct',
  [TRANSPORT_LAYERS.BLUETOOTH]: 'Bluetooth',
  [TRANSPORT_LAYERS.LORA]: 'LoRa',
  [TRANSPORT_LAYERS.RF]: 'RF',
  [TRANSPORT_LAYERS.TELEPHONE]: 'Telephone',
  [TRANSPORT_LAYERS.NFC]: 'NFC',
};

function TransportRow({ transport }: { transport: TransportStatus }) {
  return (
    <View style={styles.transportRow}>
      <View style={[styles.statusDot, transport.active ? styles.dotActive : styles.dotInactive]} />
      <Text style={styles.transportName}>{TRANSPORT_NAMES[transport.layer] || 'Unknown'}</Text>
      <Text style={styles.transportDetail}>
        {transport.active ? `${transport.peerCount} peers` : transport.available ? 'Ready' : 'Unavailable'}
      </Text>
    </View>
  );
}

function PeerRow({ peer }: { peer: MeshPeer }) {
  const rssiColor = peer.rssi > -60 ? '#00ff88' : peer.rssi > -80 ? '#ffaa00' : '#ff4444';
  return (
    <View style={styles.peerRow}>
      <View style={styles.peerInfo}>
        <Text style={styles.peerId} numberOfLines={1}>
          {peer.publicKey.substring(0, 16)}...
        </Text>
        <Text style={styles.peerDetail}>
          {TRANSPORT_NAMES[peer.transport] || 'Unknown'} · Rep: {(peer.reputation.score * 100).toFixed(0)}%
        </Text>
      </View>
      <View style={styles.peerSignal}>
        <Text style={[styles.rssi, { color: rssiColor }]}>{peer.rssi} dBm</Text>
        <View style={[styles.authBadge, peer.authenticated ? styles.authYes : styles.authNo]}>
          <Text style={styles.authText}>{peer.authenticated ? 'Auth' : 'Unauth'}</Text>
        </View>
      </View>
    </View>
  );
}

export function MeshStatusScreen() {
  const { health, transports, connectionState, peerCount } = useMeshStatus();
  const peers = useMeshStore(s => s.peers);
  const peerList = Array.from(peers.values()).sort((a, b) => b.reputation.score - a.reputation.score);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesh Status</Text>
        <ConnectionIndicator state={connectionState} />
      </View>

      {/* Health Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{health.connectedPeers}</Text>
            <Text style={styles.statLabel}>Peers</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{health.activeTransports}</Text>
            <Text style={styles.statLabel}>Transports</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{health.relayQueueDepth}</Text>
            <Text style={styles.statLabel}>Relay Queue</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{health.dtusPropagated}</Text>
            <Text style={styles.statLabel}>Propagated</Text>
          </View>
        </View>
      </View>

      {/* Transport Layers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transport Layers</Text>
        {transports.map(t => (
          <TransportRow key={t.layer} transport={t} />
        ))}
      </View>

      {/* Connected Peers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Peers ({peerCount})</Text>
        {peerList.length === 0 ? (
          <Text style={styles.emptyText}>No peers discovered</Text>
        ) : (
          peerList.map(peer => <PeerRow key={peer.id} peer={peer} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  sectionTitle: { color: '#e0e0e0', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: {
    flex: 1,
    backgroundColor: '#14141f',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: { color: '#00d4ff', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#14141f',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  dotActive: { backgroundColor: '#00ff88' },
  dotInactive: { backgroundColor: '#444' },
  transportName: { color: '#e0e0e0', fontSize: 14, flex: 1 },
  transportDetail: { color: '#888', fontSize: 12 },
  peerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#14141f',
  },
  peerInfo: { flex: 1 },
  peerId: { color: '#e0e0e0', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  peerDetail: { color: '#888', fontSize: 11, marginTop: 2 },
  peerSignal: { alignItems: 'flex-end' },
  rssi: { fontSize: 14, fontWeight: '600' },
  authBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  authYes: { backgroundColor: '#1a3a2a' },
  authNo: { backgroundColor: '#3a1a1a' },
  authText: { color: '#e0e0e0', fontSize: 10 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
});

