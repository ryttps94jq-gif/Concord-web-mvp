// Concord Mobile — Identity Hook
// Provides device identity state to UI

import { useIdentityStore } from '../store/identity-store';
import type { DeviceIdentity, HardwareCapabilities, ConnectionState } from '../utils/types';

interface UseIdentityResult {
  identity: DeviceIdentity | null;
  isInitialized: boolean;
  publicKey: string | null;
  hardware: HardwareCapabilities | null;
  connectionState: ConnectionState;
  linkedDeviceCount: number;
}

export function useIdentity(): UseIdentityResult {
  const identity = useIdentityStore(s => s.identity);
  const isInitialized = useIdentityStore(s => s.isInitialized);
  const hardware = useIdentityStore(s => s.hardware);
  const connectionState = useIdentityStore(s => s.connectionState);

  return {
    identity,
    isInitialized,
    publicKey: identity?.publicKey ?? null,
    hardware,
    connectionState,
    linkedDeviceCount: identity?.linkedDevices.length ?? 0,
  };
}
