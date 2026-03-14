// Concord Mobile — Foundation Capture
// Packages sensor readings into Foundation DTUs.
// Each sensor reading -> one DTU. Max 10,000 per day. Each DTU < 500 bytes compressed.

import {
  DTU,
  DTUHeader,
  DTUMeta,
  SensorReading,
} from '../../utils/types';
import {
  DTU_VERSION,
  DTU_TYPES,
  DTU_FLAGS,
  FOUNDATION_MAX_DTUS_PER_DAY,
  FOUNDATION_SENSOR_MAX_DTU_BYTES,
} from '../../utils/constants';
import { generateId } from '../../utils/crypto';
import { SensorManager } from '../sensors/sensor-manager';

// ── DTU Forge Interface ──────────────────────────────────────────────────────
// Minimal interface for the DTU creation module (dependency injection)

export interface DTUForge {
  createContentHash(content: Uint8Array): Uint8Array;
  compress(data: Uint8Array): Uint8Array;
}

// ── Foundation Capture Interface ─────────────────────────────────────────────

export interface FoundationCapture {
  captureAndPackage(): Promise<DTU[]>;
  getReadingsCount(): number;
  getDailyCount(): number;
  resetDailyCount(): void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createFoundationCapture(
  sensorManager: SensorManager,
  dtuForge: DTUForge
): FoundationCapture {
  let _totalReadingsCount = 0;
  let _dailyCount = 0;
  let _dailyResetDate = getTodayDateString();

  function getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function checkDailyReset(): void {
    const today = getTodayDateString();
    if (today !== _dailyResetDate) {
      _dailyCount = 0;
      _dailyResetDate = today;
    }
  }

  function sensorReadingToContent(reading: SensorReading): Uint8Array {
    const json = JSON.stringify({
      sensor: reading.sensor,
      ts: reading.timestamp,
      v: reading.values,
      acc: reading.accuracy,
      g: reading.geoGrid,
    });
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  function createDTUFromReading(reading: SensorReading): DTU | null {
    const rawContent = sensorReadingToContent(reading);
    const compressed = dtuForge.compress(rawContent);

    // Enforce max DTU size
    if (compressed.length > FOUNDATION_SENSOR_MAX_DTU_BYTES) {
      return null;
    }

    const contentHash = dtuForge.createContentHash(compressed);
    const timestamp = reading.timestamp || Date.now();

    const header: DTUHeader = {
      version: DTU_VERSION,
      flags: DTU_FLAGS.COMPRESSED,
      type: DTU_TYPES.SENSOR_READING,
      timestamp,
      contentLength: compressed.length,
      contentHash,
    };

    const meta: DTUMeta = {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 1,
      geoGrid: reading.geoGrid,
    };

    return {
      id: generateId('fnd'),
      header,
      content: compressed,
      tags: ['foundation', 'sense', reading.sensor],
      meta,
    };
  }

  async function captureAndPackage(): Promise<DTU[]> {
    checkDailyReset();

    // Enforce daily limit
    if (_dailyCount >= FOUNDATION_MAX_DTUS_PER_DAY) {
      return [];
    }

    const readings = await sensorManager.captureAll();
    const dtus: DTU[] = [];

    for (const reading of readings) {
      // Re-check daily limit per reading
      if (_dailyCount >= FOUNDATION_MAX_DTUS_PER_DAY) {
        break;
      }

      const dtu = createDTUFromReading(reading);
      if (dtu) {
        dtus.push(dtu);
        _dailyCount++;
        _totalReadingsCount++;
      }
    }

    return dtus;
  }

  return {
    captureAndPackage,
    getReadingsCount: () => _totalReadingsCount,
    getDailyCount: () => {
      checkDailyReset();
      return _dailyCount;
    },
    resetDailyCount: () => {
      _dailyCount = 0;
      _dailyResetDate = getTodayDateString();
    },
  };
}
