// Concord Mobile — Transport Selector
// Automatic transport selection based on DTU size and available transports

import {
  TRANSPORT_LAYERS,
  BLE_MTU_DEFAULT,
  LORA_MAX_PACKET_BYTES,
  NFC_MAX_PAYLOAD_BYTES,
} from '../../utils/constants';
import type { TransportLayer, TransportStatus } from '../../utils/types';

// ── Transport Selector Interface ──────────────────────────────────────────────

export interface TransportSelector {
  selectTransport(
    dtuSize: number,
    availableTransports: TransportStatus[],
  ): TransportLayer;
  getTransportPriority(layer: TransportLayer, dtuSize: number): number;
  shouldUseWiFiDirect(dtuSize: number, peerCount: number): boolean;
}

// ── Size Thresholds ───────────────────────────────────────────────────────────

const WIFI_DIRECT_DTU_COUNT_THRESHOLD = 1000;
const WIFI_DIRECT_SIZE_THRESHOLD = 100 * 1024; // 100KB

// ── Implementation ────────────────────────────────────────────────────────────

export function createTransportSelector(): TransportSelector {
  function getAvailableAndActive(
    transports: TransportStatus[],
  ): TransportStatus[] {
    return transports.filter(t => t.available && t.active);
  }

  return {
    selectTransport(
      dtuSize: number,
      availableTransports: TransportStatus[],
    ): TransportLayer {
      const active = getAvailableAndActive(availableTransports);

      if (active.length === 0) {
        // Fallback: return internet if nothing available, caller handles error
        return TRANSPORT_LAYERS.INTERNET;
      }

      // Build a scored list of transports
      const scored = active.map(t => ({
        layer: t.layer,
        priority: this.getTransportPriority(t.layer, dtuSize),
        status: t,
      }));

      // Sort by priority (lower = better)
      scored.sort((a, b) => a.priority - b.priority);

      return scored[0].layer;
    },

    getTransportPriority(layer: TransportLayer, dtuSize: number): number {
      switch (layer) {
        case TRANSPORT_LAYERS.BLUETOOTH:
          // BLE preferred for small DTUs (<= 512 bytes)
          if (dtuSize <= BLE_MTU_DEFAULT) {
            return 1; // Best for small packets
          }
          // BLE can handle larger via chunking but deprioritized
          return 4;

        case TRANSPORT_LAYERS.WIFI_DIRECT:
          // WiFi Direct preferred for large batches / large DTUs
          if (dtuSize > WIFI_DIRECT_SIZE_THRESHOLD) {
            return 1; // Best for large data
          }
          if (dtuSize > BLE_MTU_DEFAULT) {
            return 2; // Good for medium data
          }
          return 5; // Overkill for small data

        case TRANSPORT_LAYERS.NFC:
          // NFC only for tap-to-share (user-initiated)
          // Always deprioritized for automatic transport
          if (dtuSize <= NFC_MAX_PAYLOAD_BYTES) {
            return 8;
          }
          return 100; // Too large for NFC

        case TRANSPORT_LAYERS.LORA:
          // LoRa: long range, very small packets only (<256 bytes)
          if (dtuSize <= LORA_MAX_PACKET_BYTES) {
            return 3; // Good for small packets at long range
          }
          return 100; // Too large for LoRa

        case TRANSPORT_LAYERS.INTERNET:
          // Internet: when available and DTU needs global propagation
          return 6; // Available but prefer mesh transports

        case TRANSPORT_LAYERS.RF:
          // RF audio encoding: slow, last resort
          if (dtuSize <= 1024) {
            return 7;
          }
          return 100; // Impractical for large data

        case TRANSPORT_LAYERS.TELEPHONE:
          // Telephone modem encoding: slow, last resort
          if (dtuSize <= 2048) {
            return 9;
          }
          return 100; // Impractical for large data

        default:
          return 50; // Unknown transport
      }
    },

    shouldUseWiFiDirect(dtuSize: number, peerCount: number): boolean {
      // WiFi Direct preferred when:
      // 1. Large batch of DTUs (>1000) — indicated by peerCount used as batch proxy
      // 2. Large total size (>100KB)
      // 3. Need to transfer to multiple peers simultaneously
      if (dtuSize > WIFI_DIRECT_SIZE_THRESHOLD) {
        return true;
      }
      if (peerCount >= WIFI_DIRECT_DTU_COUNT_THRESHOLD) {
        return true;
      }
      // Also use WiFi Direct for medium-sized DTUs when many peers
      if (dtuSize > BLE_MTU_DEFAULT && peerCount > 5) {
        return true;
      }
      return false;
    },
  };
}
