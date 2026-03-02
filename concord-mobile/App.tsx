// Concord Mobile — App Entry Point

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AppNavigator } from './src/surface/navigation/AppNavigator';
import { useIdentityStore } from './src/store/identity-store';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingTitle}>Concord</Text>
      <ActivityIndicator size="large" color="#00d4ff" style={styles.spinner} />
      <Text style={styles.loadingSubtitle}>Initializing device identity...</Text>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const setIdentity = useIdentityStore(s => s.setIdentity);
  const setHardware = useIdentityStore(s => s.setHardware);

  useEffect(() => {
    async function initialize() {
      try {
        // Phase 1: Detect hardware capabilities
        // Phase 2: Initialize or load identity (Ed25519 keypair)
        // Phase 3: Initialize DTU store, load genesis seeds
        // Phase 4: Start mesh (BLE advertising + scanning)
        // Phase 5: Start heartbeat

        // For now, mark ready after a brief initialization
        setIsReady(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        setIsReady(true); // Launch anyway with degraded functionality
      }
    }

    initialize();
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#00d4ff',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingSubtitle: {
    color: '#888',
    fontSize: 14,
  },
});
