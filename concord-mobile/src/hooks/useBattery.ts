// Concord Mobile — Battery Status Hook

import { useIdentityStore } from '../store/identity-store';
import {
  HEARTBEAT_DORMANT_BATTERY_THRESHOLD,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_LOW_BATTERY_INTERVAL_MS,
  HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS,
} from '../utils/constants';

interface BatteryStatus {
  level: number;
  isCharging: boolean;
  isLow: boolean;
  isCritical: boolean;
  isDormant: boolean;
  heartbeatInterval: number;
}

export function useBattery(): BatteryStatus {
  const level = useIdentityStore(s => s.batteryLevel);
  const isCharging = useIdentityStore(s => s.isCharging);

  const isLow = level < 30 && !isCharging;
  const isCritical = level < 15 && !isCharging;
  const isDormant = level < HEARTBEAT_DORMANT_BATTERY_THRESHOLD && !isCharging;

  let heartbeatInterval = HEARTBEAT_INTERVAL_MS;
  if (isDormant) {
    heartbeatInterval = Infinity; // dormant
  } else if (isCritical) {
    heartbeatInterval = HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS;
  } else if (isLow) {
    heartbeatInterval = HEARTBEAT_LOW_BATTERY_INTERVAL_MS;
  }

  return {
    level,
    isCharging,
    isLow,
    isCritical,
    isDormant,
    heartbeatInterval,
  };
}
