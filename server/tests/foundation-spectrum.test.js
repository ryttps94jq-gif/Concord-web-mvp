/**
 * Foundation Spectrum — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (LEGAL_STATUS, ISM_BANDS)
 *   - createSpectrumDTU (frequency range, channels, legal status)
 *   - recordSpectrumScan (null, channel discovery, occupancy map, STATE)
 *   - getAvailableChannels / getSpectrumMap
 *   - Metrics (getSpectrumMetrics)
 *   - initializeSpectrum (indexing, double-init)
 *   - _resetSpectrumState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  LEGAL_STATUS,
  ISM_BANDS,
  createSpectrumDTU,
  recordSpectrumScan,
  getAvailableChannels,
  getSpectrumMap,
  getSpectrumMetrics,
  initializeSpectrum,
  _resetSpectrumState,
} from "../lib/foundation-spectrum.js";

beforeEach(() => {
  _resetSpectrumState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Spectrum — Constants", () => {
  it("defines 4 legal statuses", () => {
    assert.equal(LEGAL_STATUS.UNLICENSED, "unlicensed");
    assert.equal(LEGAL_STATUS.LICENSED_UNUSED, "licensed_unused");
    assert.equal(LEGAL_STATUS.SHARED, "shared");
    assert.equal(LEGAL_STATUS.UNKNOWN, "unknown");
  });

  it("defines 3 ISM bands", () => {
    assert.equal(ISM_BANDS.length, 3);
    assert.equal(ISM_BANDS[0].name, "900MHz ISM");
    assert.equal(ISM_BANDS[1].name, "2.4GHz ISM");
    assert.equal(ISM_BANDS[2].name, "5.8GHz ISM");
    assert.equal(ISM_BANDS[0].legal, LEGAL_STATUS.UNLICENSED);
  });

  it("ISM band frequency ranges are valid", () => {
    for (const band of ISM_BANDS) {
      assert.ok(band.start < band.end, `${band.name} start < end`);
      assert.ok(band.start > 0, `${band.name} start > 0`);
    }
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(LEGAL_STATUS), true);
    assert.equal(Object.isFrozen(ISM_BANDS), true);
  });
});

// ── createSpectrumDTU ──────────────────────────────────────────────────────

describe("Foundation Spectrum — createSpectrumDTU", () => {
  it("creates DTU with basic fields", () => {
    const dtu = createSpectrumDTU({
      startFreq: 900e6,
      endFreq: 928e6,
    });
    assert.match(dtu.id, /^spectrum_/);
    assert.equal(dtu.type, "SPECTRUM");
    assert.equal(dtu.source, "foundation-spectrum");
    assert.equal(dtu.frequency_range.start, 900e6);
    assert.equal(dtu.frequency_range.end, 928e6);
    assert.ok(dtu.tags.includes("foundation"));
    assert.ok(dtu.tags.includes("spectrum"));
    assert.equal(dtu.scope, "local");
    assert.equal(dtu.crpiScore, 0.2);
  });

  it("defaults frequency range to 0 when not provided", () => {
    const dtu = createSpectrumDTU({});
    assert.equal(dtu.frequency_range.start, 0);
    assert.equal(dtu.frequency_range.end, 0);
  });

  it("processes available_channels with clamped values", () => {
    const dtu = createSpectrumDTU({
      available_channels: [
        { center_frequency: 915e6, bandwidth: 500e3, noise_level: -95, availability_score: 0.9, legal_status: "unlicensed" },
        { center_frequency: 920e6, bandwidth: 200e3, availability_score: 1.5, legal_status: "invalid" },
      ],
    });
    assert.equal(dtu.available_channels.length, 2);
    assert.equal(dtu.available_channels[0].center_frequency, 915e6);
    assert.equal(dtu.available_channels[0].noise_level, -95);
    assert.equal(dtu.available_channels[0].availability_score, 0.9);
    assert.equal(dtu.available_channels[0].legal_status, "unlicensed");

    // Clamped and defaulted
    assert.equal(dtu.available_channels[1].availability_score, 1); // clamped from 1.5
    assert.equal(dtu.available_channels[1].legal_status, "unknown"); // invalid → unknown
  });

  it("defaults noise_level to -90", () => {
    const dtu = createSpectrumDTU({
      available_channels: [{ center_frequency: 915e6, bandwidth: 500e3 }],
    });
    assert.equal(dtu.available_channels[0].noise_level, -90);
  });

  it("sets location and time_of_day", () => {
    const dtu = createSpectrumDTU({
      location: { lat: 52.37, lng: 4.90 },
      time_of_day: "14:30",
    });
    assert.deepEqual(dtu.location, { lat: 52.37, lng: 4.90 });
    assert.equal(dtu.time_of_day, "14:30");
  });

  it("defaults empty arrays for occupancy and noise_floor", () => {
    const dtu = createSpectrumDTU({});
    assert.deepEqual(dtu.occupancy, []);
    assert.deepEqual(dtu.noise_floor, []);
    assert.deepEqual(dtu.available_channels, []);
  });
});

// ── recordSpectrumScan ──────────────────────────────────────────────────────

describe("Foundation Spectrum — recordSpectrumScan", () => {
  it("returns null for null input", () => {
    assert.equal(recordSpectrumScan(null), null);
  });

  it("records a scan and increments stats", () => {
    const scan = recordSpectrumScan({ startFreq: 900e6, endFreq: 928e6 });
    assert.notEqual(scan, null);
    const metrics = getSpectrumMetrics();
    assert.equal(metrics.stats.totalScans, 1);
    assert.notEqual(metrics.stats.lastScanAt, null);
  });

  it("discovers channels with availability_score > 0.7", () => {
    recordSpectrumScan({
      available_channels: [
        { center_frequency: 915e6, bandwidth: 500e3, availability_score: 0.9 },
        { center_frequency: 920e6, bandwidth: 500e3, availability_score: 0.5 }, // Below threshold
      ],
    });
    const channels = getAvailableChannels();
    assert.equal(channels.length, 1);
    assert.equal(channels[0].center_frequency, 915e6);
    const metrics = getSpectrumMetrics();
    assert.equal(metrics.stats.channelsDiscovered, 1);
  });

  it("does not duplicate existing discovered channels", () => {
    const scan = {
      available_channels: [
        { center_frequency: 915e6, bandwidth: 500e3, availability_score: 0.9 },
      ],
    };
    recordSpectrumScan(scan);
    recordSpectrumScan(scan);
    const channels = getAvailableChannels();
    assert.equal(channels.length, 1);
    assert.equal(getSpectrumMetrics().stats.channelsDiscovered, 1);
  });

  it("updates occupancy map with location data", () => {
    recordSpectrumScan({ location: { lat: 52.37, lng: 4.90 } });
    const map = getSpectrumMap();
    assert.equal(map.length, 1);
    assert.deepEqual(map[0].location, { lat: 52.37, lng: 4.90 });
  });

  it("does not update occupancy map without location", () => {
    recordSpectrumScan({ startFreq: 900e6 });
    const map = getSpectrumMap();
    assert.equal(map.length, 0);
  });

  it("stores in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const scan = recordSpectrumScan({ startFreq: 900e6 }, STATE);
    assert.ok(STATE.dtus.has(scan.id));
  });

  it("trims scans at 500 (keeps 400)", () => {
    for (let i = 0; i < 510; i++) {
      recordSpectrumScan({ startFreq: 900e6 + i });
    }
    const metrics = getSpectrumMetrics();
    assert.ok(metrics.scanCount <= 400);
  });

  it("trims available channels at 200 (keeps 150)", () => {
    for (let i = 0; i < 210; i++) {
      recordSpectrumScan({
        available_channels: [
          { center_frequency: i * 1e6, bandwidth: 100e3, availability_score: 0.9 },
        ],
      });
    }
    const channels = getAvailableChannels(300);
    assert.ok(channels.length <= 150);
  });
});

// ── Query Functions ──────────────────────────────────────────────────────

describe("Foundation Spectrum — Query Functions", () => {
  it("getAvailableChannels returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      recordSpectrumScan({
        available_channels: [
          { center_frequency: i * 10e6, bandwidth: 100e3, availability_score: 0.9 },
        ],
      });
    }
    const channels = getAvailableChannels(5);
    assert.equal(channels.length, 5);
  });

  it("getAvailableChannels defaults to 50", () => {
    assert.ok(Array.isArray(getAvailableChannels()));
  });

  it("getSpectrumMap returns empty initially", () => {
    assert.deepEqual(getSpectrumMap(), []);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Spectrum — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getSpectrumMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.scanCount, 0);
    assert.equal(metrics.availableChannelCount, 0);
    assert.equal(metrics.occupancyMapSize, 0);
    assert.equal(metrics.stats.totalScans, 0);
    assert.equal(metrics.stats.channelsDiscovered, 0);
    assert.equal(metrics.stats.lastScanAt, null);
    assert.ok(metrics.uptime >= 0);
  });
});

// ── initializeSpectrum ──────────────────────────────────────────────────

describe("Foundation Spectrum — initializeSpectrum", () => {
  it("initializes successfully", async () => {
    const result = await initializeSpectrum({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    const metrics = getSpectrumMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("indexes SPECTRUM DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["s1", { type: "SPECTRUM", id: "s1" }],
        ["s2", { type: "SPECTRUM", id: "s2" }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeSpectrum(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeSpectrum({});
    const result = await initializeSpectrum({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeSpectrum(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetSpectrumState ──────────────────────────────────────────────────

describe("Foundation Spectrum — _resetSpectrumState", () => {
  it("resets all state", async () => {
    await initializeSpectrum({});
    recordSpectrumScan({
      location: { lat: 52.37, lng: 4.90 },
      available_channels: [{ center_frequency: 915e6, bandwidth: 500e3, availability_score: 0.9 }],
    });
    _resetSpectrumState();

    const metrics = getSpectrumMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.scanCount, 0);
    assert.equal(metrics.availableChannelCount, 0);
    assert.equal(metrics.occupancyMapSize, 0);
    assert.equal(metrics.stats.totalScans, 0);
    assert.equal(metrics.stats.channelsDiscovered, 0);
  });
});
