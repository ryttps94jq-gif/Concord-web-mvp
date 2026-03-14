// Concord Mobile — Wallet Screen
// Balance display, transaction history, send/receive

import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useWallet } from '../../hooks/useWallet';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { useIdentityStore } from '../../store/identity-store';
import type { Transaction } from '../../utils/types';
import { COIN_DECIMALS } from '../../utils/constants';

function formatCoin(amount: number): string {
  return amount.toFixed(COIN_DECIMALS).replace(/\.?0+$/, '') || '0';
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncoming = tx.amount > 0;
  return (
    <View style={styles.txRow}>
      <View style={styles.txInfo}>
        <Text style={styles.txType}>{tx.type.replace(/_/g, ' ')}</Text>
        <Text style={styles.txTime}>
          {new Date(tx.timestamp).toLocaleDateString()}
          {!tx.propagated && ' · Pending sync'}
        </Text>
      </View>
      <Text style={[styles.txAmount, isIncoming ? styles.txPositive : styles.txNegative]}>
        {isIncoming ? '+' : ''}{formatCoin(tx.amount)}
      </Text>
    </View>
  );
}

type Tab = 'balance' | 'send' | 'receive';

export function WalletScreen() {
  const { balance, transactions, unpropagatedCount } = useWallet();
  const connectionState = useIdentityStore(s => s.connectionState);
  const [activeTab, setActiveTab] = useState<Tab>('balance');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
        <ConnectionIndicator state={connectionState} />
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{formatCoin(balance.available)} CC</Text>
        {balance.pending > 0 && (
          <Text style={styles.pendingText}>
            {formatCoin(balance.pending)} CC pending
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['balance', 'send', 'receive'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction History */}
      {activeTab === 'balance' && (
        <FlatList
          data={transactions}
          renderItem={({ item }) => <TransactionRow tx={item} />}
          keyExtractor={item => item.id}
          style={styles.txList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No transactions yet</Text>
          }
          ListHeaderComponent={
            unpropagatedCount > 0 ? (
              <View style={styles.syncBanner}>
                <Text style={styles.syncText}>
                  {unpropagatedCount} transaction{unpropagatedCount > 1 ? 's' : ''} awaiting sync
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {activeTab === 'send' && (
        <View style={styles.sendContainer}>
          <Text style={styles.formLabel}>Recipient Public Key</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Enter peer public key..."
            placeholderTextColor="#666"
            autoCapitalize="none"
          />
          <Text style={styles.formLabel}>Amount (CC)</Text>
          <TextInput
            style={styles.formInput}
            placeholder="0.00"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
          />
          <TouchableOpacity style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'receive' && (
        <View style={styles.receiveContainer}>
          <Text style={styles.receiveLabel}>Your Public Key</Text>
          <View style={styles.keyBox}>
            <Text style={styles.keyText} selectable>
              {useIdentityStore.getState().identity?.publicKey ?? 'Not initialized'}
            </Text>
          </View>
          <Text style={styles.receiveHint}>
            Share this key with the sender, or tap phones together (NFC)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  headerTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  balanceCard: {
    margin: 16, padding: 24, backgroundColor: '#14141f',
    borderRadius: 16, borderWidth: 1, borderColor: '#1a3a5c', alignItems: 'center',
  },
  balanceLabel: { color: '#888', fontSize: 14 },
  balanceValue: { color: '#00d4ff', fontSize: 36, fontWeight: '700', marginTop: 8 },
  pendingText: { color: '#ffaa00', fontSize: 12, marginTop: 8 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#00d4ff' },
  tabText: { color: '#888', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#00d4ff' },
  txList: { flex: 1, paddingHorizontal: 16 },
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#14141f',
  },
  txInfo: { flex: 1 },
  txType: { color: '#e0e0e0', fontSize: 14, textTransform: 'capitalize' },
  txTime: { color: '#666', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '600' },
  txPositive: { color: '#00ff88' },
  txNegative: { color: '#ff4444' },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  syncBanner: {
    backgroundColor: '#2a2a1a', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  syncText: { color: '#ffaa00', fontSize: 12, textAlign: 'center' },
  sendContainer: { padding: 16 },
  formLabel: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  formInput: {
    backgroundColor: '#14141f', color: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  sendButton: {
    backgroundColor: '#00d4ff', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 24,
  },
  sendButtonText: { color: '#0a0a0f', fontSize: 16, fontWeight: '700' },
  receiveContainer: { padding: 16, alignItems: 'center' },
  receiveLabel: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  keyBox: {
    backgroundColor: '#14141f', borderRadius: 12, padding: 16, width: '100%',
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  keyText: { color: '#00d4ff', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' },
  receiveHint: { color: '#666', fontSize: 12, marginTop: 16, textAlign: 'center' },
});
