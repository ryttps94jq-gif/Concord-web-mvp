// Concord Mobile — Identity Store (Zustand)
// Manages device identity state (public key only — private key stays in secure enclave)

import { create } from 'zustand';
import type { DeviceIdentity, ConnectionState, HardwareCapabilities } from '../utils/types';

interface IdentityStore {
  // Identity
  identity: DeviceIdentity | null;
  isInitialized: boolean;
  setIdentity: (identity: DeviceIdentity) => void;
  clearIdentity: () => void;

  // Linked devices
  addLinkedDevice: (publicKey: string) => void;
  removeLinkedDevice: (publicKey: string) => void;
  getLinkedDevices: () => string[];

  // Hardware
  hardware: HardwareCapabilities | null;
  setHardware: (capabilities: HardwareCapabilities) => void;

  // Connection
  connectionState: ConnectionState;
  setConnectionState: (state: ConnectionState) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;

  // Battery
  batteryLevel: number;
  isCharging: boolean;
  setBattery: (level: number, charging: boolean) => void;

  reset: () => void;
}

export const useIdentityStore = create<IdentityStore>((set, get) => ({
  identity: null,
  isInitialized: false,
  hardware: null,
  connectionState: 'offline',
  serverUrl: '',
  batteryLevel: 100,
  isCharging: false,

  setIdentity: (identity) => set({ identity, isInitialized: true }),

  clearIdentity: () => set({ identity: null, isInitialized: false }),

  addLinkedDevice: (publicKey) => set(state => {
    if (!state.identity) return state;
    const linked = [...state.identity.linkedDevices];
    if (!linked.includes(publicKey)) {
      linked.push(publicKey);
    }
    return {
      identity: { ...state.identity, linkedDevices: linked },
    };
  }),

  removeLinkedDevice: (publicKey) => set(state => {
    if (!state.identity) return state;
    return {
      identity: {
        ...state.identity,
        linkedDevices: state.identity.linkedDevices.filter(k => k !== publicKey),
      },
    };
  }),

  getLinkedDevices: () => get().identity?.linkedDevices ?? [],

  setHardware: (capabilities) => set({ hardware: capabilities }),

  setConnectionState: (connectionState) => set({ connectionState }),

  setServerUrl: (serverUrl) => set({ serverUrl }),

  setBattery: (level, charging) => set({
    batteryLevel: Math.max(0, Math.min(100, level)),
    isCharging: charging,
  }),

  reset: () => set({
    identity: null,
    isInitialized: false,
    hardware: null,
    connectionState: 'offline',
    serverUrl: '',
    batteryLevel: 100,
    isCharging: false,
  }),
}));
