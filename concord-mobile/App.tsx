// Concord Mobile — App Entry Point

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AppNavigator } from './src/surface/navigation/AppNavigator';
import { useIdentityStore } from './src/store/identity-store';
import { useMeshStore } from './src/store/mesh-store';
import { detectHardwareCapabilities, getGracefulDegradation } from './src/utils/hardware-detect';
import { createIdentityManager } from './src/identity/identity-manager';
import type { SecureStorage } from './src/identity/identity-manager';

// ── Boot Phase Labels ────────────────────────────────────────────────────────

type BootPhase =
  | 'hardware'
  | 'identity'
  | 'store'
  | 'mesh'
  | 'heartbeat'
  | 'ready';

const BOOT_PHASE_LABELS: Record<BootPhase, string> = {
  hardware: 'Detecting hardware capabilities...',
  identity: 'Initializing device identity...',
  store: 'Loading DTU lattice...',
  mesh: 'Starting mesh network...',
  heartbeat: 'Starting heartbeat engine...',
  ready: 'Ready',
};

// ── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ phase }: { phase: BootPhase }) {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingTitle}>Concord</Text>
      <ActivityIndicator size="large" color="#00d4ff" style={styles.spinner} />
      <Text style={styles.loadingSubtitle}>{BOOT_PHASE_LABELS[phase]}</Text>
    </View>
  );
}

// ── Placeholder Secure Storage ───────────────────────────────────────────────
// In production this wraps iOS Keychain / Android Keystore via a native module.
// Placeholder uses in-memory storage so the boot sequence can run.

const memoryStorage = new Map<string, string>();

const placeholderSecureStorage: SecureStorage = {
  async setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
  async getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  async removeItem(key: string) {
    memoryStorage.delete(key);
  },
  async hasItem(key: string) {
    return memoryStorage.has(key);
  },
};

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [bootPhase, setBootPhase] = useState<BootPhase>('hardware');
  const setIdentity = useIdentityStore(s => s.setIdentity);
  const setHardware = useIdentityStore(s => s.setHardware);
  const setTransportStatus = useMeshStore(s => s.setTransportStatus);

  useEffect(() => {
    async function initialize() {
      // ── Phase 1: Detect hardware capabilities ──────────────────────────
      setBootPhase('hardware');
      try {
        const hardware = await detectHardwareCapabilities();
        setHardware(hardware);

        // Log graceful degradation warnings for missing capabilities
        const degradations = getGracefulDegradation(hardware);
        for (const msg of degradations) {
          console.warn('[boot] degradation:', msg);
        }
      } catch (error) {
        console.error('[boot] Hardware detection failed:', error);
        // Continue — identity and mesh can still operate without full HW info
      }

      // ── Phase 2: Initialize or load identity (Ed25519 keypair) ─────────
      setBootPhase('identity');
      try {
        const identityManager = createIdentityManager(placeholderSecureStorage);
        const identity = await identityManager.initialize();
        setIdentity(identity);
      } catch (error) {
        console.error('[boot] Identity initialization failed:', error);
        // Continue — app can still show UI in read-only / degraded mode
      }

      // ── Phase 3: Initialize DTU store / load genesis seeds ─────────────
      setBootPhase('store');
      try {
        // DTU store and genesis sync require SQLite and network fetch which
        // are wired at the service layer. Mark phase as complete; the DTU
        // store will be initialised lazily on first access.
        // In a full build this calls createDTUStore(db) and syncGenesisDTUs().
      } catch (error) {
        console.error('[boot] DTU store initialization failed:', error);
      }

      // ── Phase 4: Start mesh (BLE advertising + scanning) ──────────────
      setBootPhase('mesh');
      try {
        // Mesh controller requires BLE native modules (advertiser, scanner,
        // transfer) which are injected at the service layer. Update the
        // mesh store transport status to reflect that BLE is available but
        // will be activated once the native modules are ready.
        //
        // In a full build:
        //   const meshController = createMeshController(deps);
        //   await meshController.start();
        setTransportStatus(3 /* BLUETOOTH */, {
          available: true,
          active: false,
          peerCount: 0,
          lastActivity: Date.now(),
        });
      } catch (error) {
        console.error('[boot] Mesh start failed:', error);
      }

      // ── Phase 5: Start heartbeat ──────────────────────────────────────
      setBootPhase('heartbeat');
      try {
        // Heartbeat engine requires mesh controller, foundation capture,
        // relay engine, and ledger deps. These are assembled at the service
        // layer. In a full build:
        //   const heartbeat = createHeartbeatEngine(heartbeatDeps);
        //   heartbeat.start();
      } catch (error) {
        console.error('[boot] Heartbeat start failed:', error);
      }

      // ── Boot complete ─────────────────────────────────────────────────
      setBootPhase('ready');
      setIsReady(true);
    }

    initialize();
  }, []);

  if (!isReady) {
    return <LoadingScreen phase={bootPhase} />;
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
