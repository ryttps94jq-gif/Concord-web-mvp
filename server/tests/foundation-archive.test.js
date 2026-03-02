/**
 * Foundation Archive — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (ARCHIVE_SUBTYPES, KNOWN_LEGACY_PROTOCOLS)
 *   - createArchiveDTU (subtypes, SCADA security escalation, confidence)
 *   - recordFossil (null, legacy system tracking, STATE)
 *   - recordDecoded (null, stats tracking)
 *   - Query functions (getFossils, getDecoded, getLegacySystems)
 *   - Metrics (getArchiveMetrics)
 *   - initializeArchive (indexing, double-init)
 *   - _resetArchiveState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  ARCHIVE_SUBTYPES,
  KNOWN_LEGACY_PROTOCOLS,
  createArchiveDTU,
  recordFossil,
  recordDecoded,
  getFossils,
  getDecoded,
  getLegacySystems,
  getArchiveMetrics,
  initializeArchive,
  _resetArchiveState,
} from "../lib/foundation-archive.js";

beforeEach(() => {
  _resetArchiveState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Archive — Constants", () => {
  it("defines 4 archive subtypes", () => {
    assert.equal(ARCHIVE_SUBTYPES.length, 4);
    assert.ok(ARCHIVE_SUBTYPES.includes("residual"));
    assert.ok(ARCHIVE_SUBTYPES.includes("fossil"));
    assert.ok(ARCHIVE_SUBTYPES.includes("legacy_system"));
    assert.ok(ARCHIVE_SUBTYPES.includes("signal_echo"));
  });

  it("defines 12 known legacy protocols", () => {
    assert.equal(KNOWN_LEGACY_PROTOCOLS.length, 12);
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("v92_modem"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("scada_modbus"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("scada_dnp3"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("adsb"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("ais_marine"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("pager_pocsag"));
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(ARCHIVE_SUBTYPES), true);
    assert.equal(Object.isFrozen(KNOWN_LEGACY_PROTOCOLS), true);
  });
});

// ── createArchiveDTU ──────────────────────────────────────────────────────

describe("Foundation Archive — createArchiveDTU", () => {
  it("creates DTU with valid subtype", () => {
    const dtu = createArchiveDTU({ subtype: "residual" });
    assert.match(dtu.id, /^archive_/);
    assert.equal(dtu.type, "ARCHIVE");
    assert.equal(dtu.subtype, "residual");
    assert.equal(dtu.source, "foundation-archive");
    assert.ok(dtu.tags.includes("archive"));
    assert.ok(dtu.tags.includes("residual"));
    assert.equal(dtu.scope, "local");
  });

  it("defaults to fossil subtype for invalid input", () => {
    const dtu = createArchiveDTU({ subtype: "invalid" });
    assert.equal(dtu.subtype, "fossil");
  });

  it("sets content fields from opts", () => {
    const dtu = createArchiveDTU({
      raw_signal: "010110101",
      decoded: "Hello World",
      confidence: 0.85,
      estimated_age: "1990s",
      origin_system: "BBS",
      source_channel: "phone_line",
      frequency: 2400,
      protocol_detected: "v92_modem",
      historical_context: "Early internet era modem",
    });
    assert.equal(dtu.content.raw_signal, "010110101");
    assert.equal(dtu.content.decoded, "Hello World");
    assert.equal(dtu.content.confidence, 0.85);
    assert.equal(dtu.content.estimated_age, "1990s");
    assert.equal(dtu.content.origin_system, "BBS");
    assert.equal(dtu.source_channel, "phone_line");
    assert.equal(dtu.frequency, 2400);
    assert.equal(dtu.protocol_detected, "v92_modem");
    assert.equal(dtu.historical_context, "Early internet era modem");
  });

  it("defaults content fields to unknown/null", () => {
    const dtu = createArchiveDTU({});
    assert.equal(dtu.content.raw_signal, null);
    assert.equal(dtu.content.decoded, null);
    assert.equal(dtu.content.confidence, 0);
    assert.equal(dtu.content.estimated_age, "unknown");
    assert.equal(dtu.content.origin_system, "unknown");
    assert.equal(dtu.source_channel, "unknown");
    assert.equal(dtu.protocol_detected, "unknown");
  });

  it("clamps confidence between 0 and 1", () => {
    const lowDtu = createArchiveDTU({ confidence: -1 });
    assert.equal(lowDtu.content.confidence, 0);

    const highDtu = createArchiveDTU({ confidence: 5 });
    assert.equal(highDtu.content.confidence, 1);
  });

  it("high confidence (>0.8) increases crpiScore to 0.5", () => {
    const dtu = createArchiveDTU({ confidence: 0.9 });
    assert.equal(dtu.crpiScore, 0.5);
  });

  it("low confidence gets crpiScore 0.2", () => {
    const dtu = createArchiveDTU({ confidence: 0.5 });
    assert.equal(dtu.crpiScore, 0.2);
  });

  it("SCADA/modbus protocols get security tags and global scope", () => {
    const dtu = createArchiveDTU({ protocol_detected: "scada_modbus" });
    assert.ok(dtu.tags.includes("security_concern"));
    assert.ok(dtu.tags.includes("infrastructure"));
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.crpiScore, 0.7);
  });

  it("SCADA/dnp3 protocols get security tags", () => {
    const dtu = createArchiveDTU({ protocol_detected: "scada_dnp3" });
    assert.ok(dtu.tags.includes("security_concern"));
    assert.equal(dtu.scope, "global");
  });

  it("modbus protocol detected in name gets security tags", () => {
    const dtu = createArchiveDTU({ protocol_detected: "modbus_rtu" });
    assert.ok(dtu.tags.includes("security_concern"));
    assert.equal(dtu.scope, "global");
  });

  it("non-SCADA protocols stay local scope", () => {
    const dtu = createArchiveDTU({ protocol_detected: "v92_modem" });
    assert.ok(!dtu.tags.includes("security_concern"));
    assert.equal(dtu.scope, "local");
  });
});

// ── recordFossil ──────────────────────────────────────────────────────────

describe("Foundation Archive — recordFossil", () => {
  it("returns null for null input", () => {
    assert.equal(recordFossil(null), null);
  });

  it("records a fossil and increments stats", () => {
    const fossil = recordFossil({ protocol_detected: "adsb" });
    assert.notEqual(fossil, null);
    const metrics = getArchiveMetrics();
    assert.equal(metrics.stats.totalFossils, 1);
    assert.notEqual(metrics.stats.lastDiscoveryAt, null);
  });

  it("tracks legacy systems by protocol", () => {
    recordFossil({ protocol_detected: "v92_modem" });
    recordFossil({ protocol_detected: "v92_modem" });
    recordFossil({ protocol_detected: "adsb" });

    const systems = getLegacySystems();
    assert.equal(systems.length, 2);
    const modem = systems.find(s => s.protocol === "v92_modem");
    assert.equal(modem.detections, 2);
    const adsb = systems.find(s => s.protocol === "adsb");
    assert.equal(adsb.detections, 1);
  });

  it("does not track unknown protocol", () => {
    recordFossil({ protocol_detected: "unknown" });
    const systems = getLegacySystems();
    assert.equal(systems.length, 0);
  });

  it("increments legacySystemsFound only for new protocols", () => {
    recordFossil({ protocol_detected: "adsb" });
    recordFossil({ protocol_detected: "adsb" });
    const metrics = getArchiveMetrics();
    assert.equal(metrics.stats.legacySystemsFound, 1);
  });

  it("stores in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const fossil = recordFossil({ protocol_detected: "ais_marine" }, STATE);
    assert.ok(STATE.dtus.has(fossil.id));
  });

  it("trims fossils at 500 (keeps 400)", () => {
    for (let i = 0; i < 510; i++) {
      recordFossil({ protocol_detected: "adsb" });
    }
    const metrics = getArchiveMetrics();
    assert.ok(metrics.fossilCount <= 400);
  });

  it("preserves location in legacy system tracking", () => {
    recordFossil({ protocol_detected: "adsb", location: { lat: 52.37, lng: 4.90 } });
    const systems = getLegacySystems();
    assert.deepEqual(systems[0].location, { lat: 52.37, lng: 4.90 });
  });
});

// ── recordDecoded ──────────────────────────────────────────────────────────

describe("Foundation Archive — recordDecoded", () => {
  it("returns null for null input", () => {
    assert.equal(recordDecoded(null), null);
  });

  it("records decoded data and increments stats", () => {
    const decoded = recordDecoded({ decoded: "Hello", confidence: 0.7 });
    assert.notEqual(decoded, null);
    assert.equal(decoded.subtype, "fossil");
    const metrics = getArchiveMetrics();
    assert.equal(metrics.stats.totalDecoded, 1);
  });

  it("stores in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const decoded = recordDecoded({ decoded: "data" }, STATE);
    assert.ok(STATE.dtus.has(decoded.id));
  });

  it("defaults confidence to 0.5", () => {
    const decoded = recordDecoded({ decoded: "test" });
    assert.equal(decoded.content.confidence, 0.5);
  });

  it("trims decoded at 500 (keeps 400)", () => {
    for (let i = 0; i < 510; i++) {
      recordDecoded({ decoded: `data_${i}` });
    }
    const metrics = getArchiveMetrics();
    assert.ok(metrics.decodedCount <= 400);
  });
});

// ── Query Functions ──────────────────────────────────────────────────────

describe("Foundation Archive — Query Functions", () => {
  it("getFossils returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      recordFossil({ protocol_detected: "adsb" });
    }
    const fossils = getFossils(5);
    assert.equal(fossils.length, 5);
  });

  it("getFossils defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      recordFossil({ protocol_detected: "adsb" });
    }
    const fossils = getFossils();
    assert.equal(fossils.length, 50);
  });

  it("getDecoded returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      recordDecoded({ decoded: `data_${i}` });
    }
    const decoded = getDecoded(5);
    assert.equal(decoded.length, 5);
  });

  it("getLegacySystems returns all tracked systems", () => {
    recordFossil({ protocol_detected: "adsb" });
    recordFossil({ protocol_detected: "ais_marine" });
    recordFossil({ protocol_detected: "pager_pocsag" });
    const systems = getLegacySystems();
    assert.equal(systems.length, 3);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Archive — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getArchiveMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.fossilCount, 0);
    assert.equal(metrics.decodedCount, 0);
    assert.equal(metrics.legacySystemCount, 0);
    assert.equal(metrics.stats.totalFossils, 0);
    assert.equal(metrics.stats.totalDecoded, 0);
    assert.equal(metrics.stats.legacySystemsFound, 0);
    assert.equal(metrics.stats.lastDiscoveryAt, null);
    assert.ok(metrics.uptime >= 0);
  });
});

// ── initializeArchive ──────────────────────────────────────────────────

describe("Foundation Archive — initializeArchive", () => {
  it("initializes successfully", async () => {
    const result = await initializeArchive({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    assert.equal(getArchiveMetrics().initialized, true);
  });

  it("indexes ARCHIVE DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["a1", { type: "ARCHIVE", id: "a1" }],
        ["a2", { type: "ARCHIVE", id: "a2" }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeArchive(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeArchive({});
    const result = await initializeArchive({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeArchive(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetArchiveState ──────────────────────────────────────────────────

describe("Foundation Archive — _resetArchiveState", () => {
  it("resets all state", async () => {
    await initializeArchive({});
    recordFossil({ protocol_detected: "adsb" });
    recordDecoded({ decoded: "data" });
    _resetArchiveState();

    const metrics = getArchiveMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.fossilCount, 0);
    assert.equal(metrics.decodedCount, 0);
    assert.equal(metrics.legacySystemCount, 0);
    assert.equal(metrics.stats.totalFossils, 0);
    assert.equal(metrics.stats.totalDecoded, 0);
    assert.equal(metrics.stats.legacySystemsFound, 0);
  });
});
