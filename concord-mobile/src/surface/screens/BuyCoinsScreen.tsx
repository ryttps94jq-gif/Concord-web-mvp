// Concord Mobile — Buy Coins Screen
// External payment flow for purchasing Concord Coins via Stripe.
// Uses Apple's External Purchase Link Entitlement on iOS to bypass the 30% IAP commission.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { openExternalPurchase } from '../../hooks/useExternalPurchase';
import { useWallet } from '../../hooks/useWallet';
import { useIdentityStore } from '../../store/identity-store';
import { COIN_DECIMALS } from '../../utils/constants';

const AMOUNTS = [5, 10, 25, 50, 100, 500];

function formatCoin(amount: number): string {
  return amount.toFixed(COIN_DECIMALS).replace(/\.?0+$/, '') || '0';
}

export function BuyCoinsScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { balance } = useWallet();
  const identity = useIdentityStore(s => s.identity);

  const handlePurchase = async () => {
    if (!selected || !identity) return;

    // Auth token will be provided by the auth system when fully wired.
    // For now, retrieve from secure storage at purchase time.
    const authToken = identity.publicKey; // Placeholder — replace with JWT from auth flow

    setLoading(true);
    try {
      await openExternalPurchase({
        userId: identity.publicKey,
        amount: selected,
        authToken,
      });
      // Balance refresh happens via deep link handler on return
    } catch (error: any) {
      if (error?.code !== 'USER_CANCELLED') {
        Alert.alert('Purchase Error', 'Unable to open checkout. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Concord Coins</Text>
      <Text style={styles.balance}>Balance: {formatCoin(balance.available)} CC</Text>
      <Text style={styles.rate}>1 Coin = $1.00 USD</Text>

      <View style={styles.grid}>
        {AMOUNTS.map(amt => (
          <TouchableOpacity
            key={amt}
            style={[styles.amountBtn, selected === amt && styles.amountSelected]}
            onPress={() => setSelected(amt)}
          >
            <Text style={[styles.amountText, selected === amt && styles.amountTextSelected]}>
              ${amt}
            </Text>
            <Text style={styles.coinText}>{amt} coins</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.buyBtn, (!selected || loading) && styles.buyBtnDisabled]}
        onPress={handlePurchase}
        disabled={!selected || loading}
      >
        <Text style={styles.buyBtnText}>
          {loading ? 'Opening checkout...' : `Buy ${selected ?? '—'} Coins`}
        </Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        You'll be redirected to our secure checkout powered by Stripe.
        This purchase is processed outside the App Store and is not covered
        by App Store purchase protections.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f', padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  balance: { fontSize: 16, color: '#888', marginBottom: 4 },
  rate: { fontSize: 14, color: '#555', marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  amountBtn: {
    width: '30%' as any,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a24',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a34',
  },
  amountSelected: { borderColor: '#6366f1', backgroundColor: '#1a1a2f' },
  amountText: { fontSize: 20, fontWeight: '600', color: '#fff' },
  amountTextSelected: { color: '#6366f1' },
  coinText: { fontSize: 12, color: '#666', marginTop: 4 },
  buyBtn: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  buyBtnDisabled: { backgroundColor: '#333' },
  buyBtnText: { fontSize: 18, fontWeight: '600', color: '#fff' },
  disclaimer: {
    marginTop: 16,
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },
});
