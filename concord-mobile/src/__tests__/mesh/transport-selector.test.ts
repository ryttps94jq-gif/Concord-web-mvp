// Tests for Transport Selector
import { createTransportSelector } from '../../mesh/transport/transport-selector';
import type { TransportSelector } from '../../mesh/transport/transport-selector';
import type { TransportStatus, TransportLayer } from '../../utils/types';
import {
  TRANSPORT_LAYERS,
  BLE_MTU_DEFAULT,
  LORA_MAX_PACKET_BYTES,
  NFC_MAX_PAYLOAD_BYTES,
} from '../../utils/constants';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function createTransportStatus(
  layer: TransportLayer,
  available: boolean = true,
  active: boolean = true,
): TransportStatus {
  return {
    layer,
    available,
    active,
    peerCount: 1,
    lastActivity: Date.now(),
  };
}

function createAllTransports(): TransportStatus[] {
  return [
    createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH),
    createTransportStatus(TRANSPORT_LAYERS.WIFI_DIRECT),
    createTransportStatus(TRANSPORT_LAYERS.NFC),
    createTransportStatus(TRANSPORT_LAYERS.LORA),
    createTransportStatus(TRANSPORT_LAYERS.INTERNET),
    createTransportStatus(TRANSPORT_LAYERS.RF),
    createTransportStatus(TRANSPORT_LAYERS.TELEPHONE),
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Transport Selector', () => {
  let selector: TransportSelector;

  beforeEach(() => {
    selector = createTransportSelector();
  });

  describe('createTransportSelector', () => {
    it('should create a selector instance', () => {
      expect(selector).toBeDefined();
      expect(selector.selectTransport).toBeInstanceOf(Function);
      expect(selector.getTransportPriority).toBeInstanceOf(Function);
      expect(selector.shouldUseWiFiDirect).toBeInstanceOf(Function);
    });
  });

  describe('selectTransport', () => {
    describe('small DTUs (<= 512 bytes)', () => {
      it('should prefer BLE for small DTUs', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(256, transports);

        expect(result).toBe(TRANSPORT_LAYERS.BLUETOOTH);
      });

      it('should prefer BLE for exactly 512 bytes', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(BLE_MTU_DEFAULT, transports);

        expect(result).toBe(TRANSPORT_LAYERS.BLUETOOTH);
      });

      it('should prefer BLE for very small DTUs', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(10, transports);

        expect(result).toBe(TRANSPORT_LAYERS.BLUETOOTH);
      });
    });

    describe('large DTUs (> 100KB)', () => {
      it('should prefer WiFi Direct for large DTUs', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(200 * 1024, transports);

        expect(result).toBe(TRANSPORT_LAYERS.WIFI_DIRECT);
      });

      it('should prefer WiFi Direct for exactly 100KB threshold', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(100 * 1024 + 1, transports);

        expect(result).toBe(TRANSPORT_LAYERS.WIFI_DIRECT);
      });
    });

    describe('medium DTUs (512 < size <= 100KB)', () => {
      it('should prefer WiFi Direct for medium DTUs', () => {
        const transports = createAllTransports();
        const result = selector.selectTransport(5000, transports);

        expect(result).toBe(TRANSPORT_LAYERS.WIFI_DIRECT);
      });
    });

    describe('transport availability', () => {
      it('should select from available transports only', () => {
        const transports = [
          createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, false, false),
          createTransportStatus(TRANSPORT_LAYERS.WIFI_DIRECT, true, true),
        ];

        const result = selector.selectTransport(100, transports);
        expect(result).toBe(TRANSPORT_LAYERS.WIFI_DIRECT);
      });

      it('should select from active transports only', () => {
        const transports = [
          createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, true, false),
          createTransportStatus(TRANSPORT_LAYERS.INTERNET, true, true),
        ];

        const result = selector.selectTransport(100, transports);
        expect(result).toBe(TRANSPORT_LAYERS.INTERNET);
      });

      it('should fallback to INTERNET when no transports available', () => {
        const result = selector.selectTransport(100, []);
        expect(result).toBe(TRANSPORT_LAYERS.INTERNET);
      });

      it('should fallback to INTERNET when all transports inactive', () => {
        const transports = [
          createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, true, false),
          createTransportStatus(TRANSPORT_LAYERS.WIFI_DIRECT, true, false),
        ];

        const result = selector.selectTransport(100, transports);
        expect(result).toBe(TRANSPORT_LAYERS.INTERNET);
      });

      it('should select BLE when only BLE available for small DTU', () => {
        const transports = [
          createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH),
        ];

        const result = selector.selectTransport(256, transports);
        expect(result).toBe(TRANSPORT_LAYERS.BLUETOOTH);
      });

      it('should select LoRa when only LoRa available for small packet', () => {
        const transports = [
          createTransportStatus(TRANSPORT_LAYERS.LORA),
        ];

        const result = selector.selectTransport(100, transports);
        expect(result).toBe(TRANSPORT_LAYERS.LORA);
      });
    });
  });

  describe('getTransportPriority', () => {
    describe('BLE priorities', () => {
      it('should give BLE highest priority (1) for small DTUs', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.BLUETOOTH,
          256,
        );
        expect(priority).toBe(1);
      });

      it('should deprioritize BLE for large DTUs', () => {
        const small = selector.getTransportPriority(
          TRANSPORT_LAYERS.BLUETOOTH,
          256,
        );
        const large = selector.getTransportPriority(
          TRANSPORT_LAYERS.BLUETOOTH,
          2000,
        );
        expect(large).toBeGreaterThan(small);
      });
    });

    describe('WiFi Direct priorities', () => {
      it('should give WiFi Direct highest priority for large DTUs', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.WIFI_DIRECT,
          200 * 1024,
        );
        expect(priority).toBe(1);
      });

      it('should give WiFi Direct good priority for medium DTUs', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.WIFI_DIRECT,
          1024,
        );
        expect(priority).toBe(2);
      });

      it('should deprioritize WiFi Direct for tiny DTUs', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.WIFI_DIRECT,
          100,
        );
        expect(priority).toBe(5);
      });
    });

    describe('NFC priorities', () => {
      it('should always deprioritize NFC for automatic selection', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.NFC,
          1000,
        );
        expect(priority).toBe(8);
      });

      it('should give NFC very low priority for oversized data', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.NFC,
          NFC_MAX_PAYLOAD_BYTES + 1,
        );
        expect(priority).toBe(100);
      });
    });

    describe('LoRa priorities', () => {
      it('should give LoRa good priority for very small packets', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.LORA,
          100,
        );
        expect(priority).toBe(3);
      });

      it('should give LoRa max priority for packets exceeding limit', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.LORA,
          LORA_MAX_PACKET_BYTES + 1,
        );
        expect(priority).toBe(100);
      });

      it('should accept LoRa for exactly max packet size', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.LORA,
          LORA_MAX_PACKET_BYTES,
        );
        expect(priority).toBe(3);
      });
    });

    describe('Internet priorities', () => {
      it('should give Internet moderate priority', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.INTERNET,
          1000,
        );
        expect(priority).toBe(6);
      });
    });

    describe('RF priorities', () => {
      it('should give RF low priority for small data', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.RF,
          500,
        );
        expect(priority).toBe(7);
      });

      it('should give RF max priority for large data', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.RF,
          5000,
        );
        expect(priority).toBe(100);
      });
    });

    describe('Telephone priorities', () => {
      it('should give telephone low priority for small data', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.TELEPHONE,
          1000,
        );
        expect(priority).toBe(9);
      });

      it('should give telephone max priority for large data', () => {
        const priority = selector.getTransportPriority(
          TRANSPORT_LAYERS.TELEPHONE,
          10000,
        );
        expect(priority).toBe(100);
      });
    });

    describe('unknown transport', () => {
      it('should give moderate priority for unknown transport', () => {
        const priority = selector.getTransportPriority(99 as TransportLayer, 1000);
        expect(priority).toBe(50);
      });
    });
  });

  describe('shouldUseWiFiDirect', () => {
    it('should return true for large DTU size (>100KB)', () => {
      expect(selector.shouldUseWiFiDirect(200 * 1024, 1)).toBe(true);
    });

    it('should return true for exactly threshold + 1', () => {
      expect(selector.shouldUseWiFiDirect(100 * 1024 + 1, 1)).toBe(true);
    });

    it('should return true for high peer count (>=1000)', () => {
      expect(selector.shouldUseWiFiDirect(100, 1000)).toBe(true);
    });

    it('should return true for medium DTU with many peers', () => {
      expect(selector.shouldUseWiFiDirect(BLE_MTU_DEFAULT + 1, 6)).toBe(true);
    });

    it('should return false for small DTU with few peers', () => {
      expect(selector.shouldUseWiFiDirect(256, 3)).toBe(false);
    });

    it('should return false for BLE-sized DTU with moderate peers', () => {
      expect(selector.shouldUseWiFiDirect(BLE_MTU_DEFAULT, 5)).toBe(false);
    });

    it('should return false for exactly BLE MTU with exactly 5 peers', () => {
      // 512 is not > BLE_MTU_DEFAULT, and 5 is not > 5
      expect(selector.shouldUseWiFiDirect(BLE_MTU_DEFAULT, 5)).toBe(false);
    });

    it('should return true for 1 byte over BLE MTU with 6 peers', () => {
      expect(selector.shouldUseWiFiDirect(BLE_MTU_DEFAULT + 1, 6)).toBe(true);
    });

    it('should return false for zero-size DTU', () => {
      expect(selector.shouldUseWiFiDirect(0, 0)).toBe(false);
    });

    it('should return true for extremely large DTU', () => {
      expect(selector.shouldUseWiFiDirect(10 * 1024 * 1024, 1)).toBe(true);
    });
  });

  describe('transport selection with realistic scenarios', () => {
    it('should select BLE for a small text DTU', () => {
      const transports = [
        createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH),
        createTransportStatus(TRANSPORT_LAYERS.INTERNET),
      ];

      expect(selector.selectTransport(200, transports)).toBe(
        TRANSPORT_LAYERS.BLUETOOTH,
      );
    });

    it('should select WiFi Direct for bulk sync', () => {
      const transports = [
        createTransportStatus(TRANSPORT_LAYERS.BLUETOOTH),
        createTransportStatus(TRANSPORT_LAYERS.WIFI_DIRECT),
      ];

      expect(selector.selectTransport(500 * 1024, transports)).toBe(
        TRANSPORT_LAYERS.WIFI_DIRECT,
      );
    });

    it('should select Internet when only Internet available', () => {
      const transports = [
        createTransportStatus(TRANSPORT_LAYERS.INTERNET),
      ];

      expect(selector.selectTransport(1000, transports)).toBe(
        TRANSPORT_LAYERS.INTERNET,
      );
    });

    it('should select LoRa for tiny packet when BLE unavailable', () => {
      const transports = [
        createTransportStatus(TRANSPORT_LAYERS.LORA),
        createTransportStatus(TRANSPORT_LAYERS.INTERNET),
      ];

      expect(selector.selectTransport(100, transports)).toBe(
        TRANSPORT_LAYERS.LORA,
      );
    });
  });
});
