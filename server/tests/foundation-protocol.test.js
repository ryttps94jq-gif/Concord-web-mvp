/**
 * Foundation Protocol — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (MAGIC_NUMBER, PROTOCOL_VERSION, PRIORITY_LEVELS, FLAGS, FREQUENCY_PLAN)
 *   - crc16 (deterministic, string/buffer support)
 *   - createFrame (null, DTU encoding, priority, flags, CRC)
 *   - parseFrame (null, magic validation, CRC validation, payload parsing, flags)
 *   - Deduplication (isDuplicate, markSeen, checkAndMark)
 *   - Gossip propagation (shouldGossip — emergency, priority, novelty)
 *   - Full round-trip (create → parse)
 *   - Metrics (getProtocolMetrics, getRecentFrames)
 *   - initializeProtocol (double-init)
 *   - _resetProtocolState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  MAGIC_NUMBER,
  PROTOCOL_VERSION,
  FRAME_OVERHEAD,
  CRC_SIZE,
  PRIORITY_LEVELS,
  FLAGS,
  FREQUENCY_PLAN,
  crc16,
  createFrame,
  parseFrame,
  isDuplicate,
  markSeen,
  checkAndMark,
  shouldGossip,
  getProtocolMetrics,
  getRecentFrames,
  initializeProtocol,
  _resetProtocolState,
} from "../lib/foundation-protocol.js";

beforeEach(() => {
  _resetProtocolState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Protocol — Constants", () => {
  it("defines magic number 0xCD01", () => {
    assert.equal(MAGIC_NUMBER, 0xCD01);
  });

  it("defines protocol version 1", () => {
    assert.equal(PROTOCOL_VERSION, 1);
  });

  it("defines frame overhead as 20 bytes", () => {
    assert.equal(FRAME_OVERHEAD, 20);
  });

  it("defines CRC size as 2 bytes", () => {
    assert.equal(CRC_SIZE, 2);
  });

  it("defines 8 priority levels (0-7)", () => {
    assert.equal(PRIORITY_LEVELS.EMERGENCY, 0);
    assert.equal(PRIORITY_LEVELS.THREAT, 1);
    assert.equal(PRIORITY_LEVELS.ECONOMIC, 2);
    assert.equal(PRIORITY_LEVELS.KNOWLEDGE, 3);
    assert.equal(PRIORITY_LEVELS.GENERAL, 4);
    assert.equal(PRIORITY_LEVELS.LOW, 5);
    assert.equal(PRIORITY_LEVELS.BACKGROUND, 6);
    assert.equal(PRIORITY_LEVELS.MINIMAL, 7);
  });

  it("defines 4 flags", () => {
    assert.equal(FLAGS.FRAGMENT, 0x01);
    assert.equal(FLAGS.RELAY, 0x02);
    assert.equal(FLAGS.EMERGENCY, 0x04);
    assert.equal(FLAGS.ENCRYPTED, 0x08);
  });

  it("defines 3 frequency plan entries", () => {
    assert.ok(FREQUENCY_PLAN.RANGE_900MHZ);
    assert.ok(FREQUENCY_PLAN.BAND_2_4GHZ);
    assert.ok(FREQUENCY_PLAN.BAND_5_8GHZ);
    assert.equal(FREQUENCY_PLAN.RANGE_900MHZ.use, "range");
    assert.equal(FREQUENCY_PLAN.BAND_2_4GHZ.use, "bandwidth");
    assert.equal(FREQUENCY_PLAN.BAND_5_8GHZ.use, "speed");
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(PRIORITY_LEVELS), true);
    assert.equal(Object.isFrozen(FLAGS), true);
    assert.equal(Object.isFrozen(FREQUENCY_PLAN), true);
  });
});

// ── crc16 ──────────────────────────────────────────────────────────────────

describe("Foundation Protocol — crc16", () => {
  it("computes CRC for a string", () => {
    const crc = crc16("hello");
    assert.ok(typeof crc === "number");
    assert.ok(crc >= 0 && crc <= 0xFFFF);
  });

  it("produces deterministic results", () => {
    const crc1 = crc16("test data");
    const crc2 = crc16("test data");
    assert.equal(crc1, crc2);
  });

  it("produces different results for different inputs", () => {
    const crc1 = crc16("data_a");
    const crc2 = crc16("data_b");
    assert.notEqual(crc1, crc2);
  });

  it("works with Buffer input", () => {
    const crc = crc16(Buffer.from("hello"));
    assert.ok(typeof crc === "number");
    assert.ok(crc >= 0 && crc <= 0xFFFF);
  });

  it("string and buffer produce same CRC for same content", () => {
    const strCrc = crc16("hello world");
    const bufCrc = crc16(Buffer.from("hello world"));
    assert.equal(strCrc, bufCrc);
  });

  it("handles empty string", () => {
    const crc = crc16("");
    assert.ok(typeof crc === "number");
  });
});

// ── createFrame ──────────────────────────────────────────────────────────

describe("Foundation Protocol — createFrame", () => {
  it("returns null for null DTU", () => {
    assert.equal(createFrame(null), null);
  });

  it("creates frame for an object DTU", () => {
    const frame = createFrame({ type: "SENSOR", id: "s1" });
    assert.notEqual(frame, null);
    assert.equal(frame.magic, MAGIC_NUMBER);
    assert.equal(frame.version, PROTOCOL_VERSION);
    assert.equal(frame.priority, PRIORITY_LEVELS.GENERAL); // default
    assert.equal(frame.ttl, 7); // default
    assert.ok(frame.contentHash.length > 0);
    assert.ok(frame.payloadLength > 0);
    assert.ok(frame.crc > 0);
    assert.ok(frame.totalBytes > 0);
  });

  it("creates frame for a string payload", () => {
    const frame = createFrame("hello world");
    assert.notEqual(frame, null);
    assert.equal(frame.payload, "hello world");
  });

  it("sets priority from opts", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.EMERGENCY });
    assert.equal(frame.priority, 0);
  });

  it("clamps priority between 0 and 7", () => {
    const lowFrame = createFrame({ id: "s1" }, { priority: -5 });
    assert.equal(lowFrame.priority, 0);

    const highFrame = createFrame({ id: "s1" }, { priority: 100 });
    assert.equal(highFrame.priority, 7);
  });

  it("sets TTL from opts (default 7)", () => {
    const frame = createFrame({ id: "s1" }, { ttl: 15 });
    assert.equal(frame.ttl, 15);
  });

  it("clamps TTL between 0 and 255", () => {
    const lowFrame = createFrame({ id: "s1" }, { ttl: -1 });
    assert.equal(lowFrame.ttl, 0);

    const highFrame = createFrame({ id: "s1" }, { ttl: 300 });
    assert.equal(highFrame.ttl, 255);
  });

  it("sets fragment flag", () => {
    const frame = createFrame({ id: "s1" }, { fragment: true });
    assert.ok(frame.flags & FLAGS.FRAGMENT);
  });

  it("sets relay flag", () => {
    const frame = createFrame({ id: "s1" }, { relay: true });
    assert.ok(frame.flags & FLAGS.RELAY);
  });

  it("sets emergency flag for explicit emergency", () => {
    const frame = createFrame({ id: "s1" }, { emergency: true });
    assert.ok(frame.flags & FLAGS.EMERGENCY);
  });

  it("auto-sets emergency flag for priority 0", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.EMERGENCY });
    assert.ok(frame.flags & FLAGS.EMERGENCY);
  });

  it("sets encrypted flag", () => {
    const frame = createFrame({ id: "s1" }, { encrypted: true });
    assert.ok(frame.flags & FLAGS.ENCRYPTED);
  });

  it("sets combined flags", () => {
    const frame = createFrame({ id: "s1" }, { relay: true, encrypted: true });
    assert.ok(frame.flags & FLAGS.RELAY);
    assert.ok(frame.flags & FLAGS.ENCRYPTED);
    assert.ok(!(frame.flags & FLAGS.FRAGMENT));
    assert.ok(!(frame.flags & FLAGS.EMERGENCY));
  });

  it("sets sourceNodeId (truncated to 8 chars)", () => {
    const frame = createFrame({ id: "s1" }, { sourceNodeId: "node_01234567890" });
    assert.equal(frame.sourceNodeId.length, 8);
  });

  it("defaults sourceNodeId to 'self'", () => {
    const frame = createFrame({ id: "s1" });
    assert.equal(frame.sourceNodeId, "self");
  });

  it("sets fragment sequence and total", () => {
    const frame = createFrame({ id: "s1" }, { fragmentSeq: 3, fragmentTotal: 10 });
    assert.equal(frame.fragmentSeq, 3);
    assert.equal(frame.fragmentTotal, 10);
  });

  it("increments totalFramesCreated stat", () => {
    createFrame({ id: "s1" });
    createFrame({ id: "s2" });
    const metrics = getProtocolMetrics();
    assert.equal(metrics.stats.totalFramesCreated, 2);
  });

  it("adds to frame log", () => {
    createFrame({ id: "s1" });
    const frames = getRecentFrames();
    assert.equal(frames.length, 1);
    assert.ok(frames[0].hash);
    assert.ok(frames[0].size > 0);
  });

  it("totalBytes = FRAME_OVERHEAD + payload + CRC_SIZE", () => {
    const frame = createFrame("hello");
    assert.equal(frame.totalBytes, FRAME_OVERHEAD + frame.payloadLength + CRC_SIZE);
  });
});

// ── parseFrame ──────────────────────────────────────────────────────────────

describe("Foundation Protocol — parseFrame", () => {
  it("returns error for null frame", () => {
    const result = parseFrame(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "null_frame");
  });

  it("returns error for invalid magic number", () => {
    const result = parseFrame({ magic: 0xBEEF, payload: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_magic");
    assert.equal(result.expected, MAGIC_NUMBER);
    assert.equal(result.got, 0xBEEF);
  });

  it("parses valid frame successfully", () => {
    const frame = createFrame({ type: "SENSOR", id: "s1" });
    const result = parseFrame(frame);
    assert.equal(result.ok, true);
    assert.equal(result.priority, frame.priority);
    assert.equal(result.ttl, frame.ttl);
    assert.equal(result.contentHash, frame.contentHash);
    assert.equal(result.sourceNodeId, frame.sourceNodeId);
  });

  it("parses DTU payload from JSON", () => {
    const original = { type: "SENSOR", id: "s1", data: 42 };
    const frame = createFrame(original);
    const result = parseFrame(frame);
    assert.equal(result.ok, true);
    assert.equal(result.dtu.type, "SENSOR");
    assert.equal(result.dtu.id, "s1");
    assert.equal(result.dtu.data, 42);
  });

  it("returns string payload for non-JSON", () => {
    const frame = createFrame("plain text");
    const result = parseFrame(frame);
    assert.equal(result.ok, true);
    assert.equal(result.dtu, "plain text");
  });

  it("detects CRC mismatch", () => {
    const frame = createFrame({ id: "s1" });
    frame.crc = 0; // Corrupt CRC
    const result = parseFrame(frame);
    assert.equal(result.ok, false);
    assert.equal(result.error, "crc_mismatch");
  });

  it("increments crcErrors stat on CRC mismatch", () => {
    const frame = createFrame({ id: "s1" });
    frame.crc = 0;
    parseFrame(frame);
    const metrics = getProtocolMetrics();
    assert.equal(metrics.stats.crcErrors, 1);
  });

  it("increments totalFramesParsed stat", () => {
    const frame = createFrame({ id: "s1" });
    parseFrame(frame);
    const metrics = getProtocolMetrics();
    assert.equal(metrics.stats.totalFramesParsed, 1);
  });

  it("detects flag fields correctly", () => {
    const frame = createFrame({ id: "s1" }, {
      fragment: true,
      relay: true,
      emergency: true,
      encrypted: true,
    });
    const result = parseFrame(frame);
    assert.equal(result.ok, true);
    assert.equal(result.isFragment, true);
    assert.equal(result.isRelay, true);
    assert.equal(result.isEmergency, true);
    assert.equal(result.isEncrypted, true);
  });

  it("detects no flags when none set", () => {
    const frame = createFrame({ id: "s1" });
    const result = parseFrame(frame);
    assert.equal(result.isFragment, false);
    assert.equal(result.isRelay, false);
    assert.equal(result.isEmergency, false);
    assert.equal(result.isEncrypted, false);
  });
});

// ── Full Round-Trip ──────────────────────────────────────────────────────

describe("Foundation Protocol — Full Round-Trip", () => {
  it("create → parse preserves DTU content", () => {
    const original = {
      type: "SENSOR",
      id: "test_round_trip",
      measurements: { signal_strength: -65 },
    };
    const frame = createFrame(original, { priority: PRIORITY_LEVELS.KNOWLEDGE, ttl: 12 });
    const parsed = parseFrame(frame);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.dtu.type, "SENSOR");
    assert.equal(parsed.dtu.id, "test_round_trip");
    assert.equal(parsed.dtu.measurements.signal_strength, -65);
    assert.equal(parsed.priority, PRIORITY_LEVELS.KNOWLEDGE);
    assert.equal(parsed.ttl, 12);
  });

  it("detects corruption in round-trip", () => {
    const frame = createFrame({ id: "s1" });
    // Corrupt payload
    frame.payload = frame.payload.replace("s1", "s2");
    const parsed = parseFrame(frame);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error, "crc_mismatch");
  });
});

// ── Deduplication ──────────────────────────────────────────────────────────

describe("Foundation Protocol — Deduplication", () => {
  it("isDuplicate returns false for unseen hash", () => {
    assert.equal(isDuplicate("abc123"), false);
  });

  it("isDuplicate returns false for null hash", () => {
    assert.equal(isDuplicate(null), false);
  });

  it("markSeen makes hash a duplicate", () => {
    markSeen("abc123");
    assert.equal(isDuplicate("abc123"), true);
  });

  it("markSeen is idempotent for null", () => {
    markSeen(null);
    // Should not throw
  });

  it("checkAndMark returns false for new hash and marks it", () => {
    const result = checkAndMark("new_hash");
    assert.equal(result, false);
    assert.equal(isDuplicate("new_hash"), true);
  });

  it("checkAndMark returns true for duplicate hash", () => {
    checkAndMark("dup_hash");
    const result = checkAndMark("dup_hash");
    assert.equal(result, true);
  });

  it("increments totalDeduplicated stat on duplicate", () => {
    checkAndMark("hash1");
    checkAndMark("hash1"); // duplicate
    checkAndMark("hash1"); // duplicate
    const metrics = getProtocolMetrics();
    assert.equal(metrics.stats.totalDeduplicated, 2);
  });

  it("tracks recent hashes in metrics", () => {
    markSeen("h1");
    markSeen("h2");
    markSeen("h3");
    const metrics = getProtocolMetrics();
    assert.equal(metrics.recentHashCount, 3);
  });
});

// ── Gossip Propagation ──────────────────────────────────────────────────────

describe("Foundation Protocol — Gossip", () => {
  it("returns false for null frame", () => {
    assert.equal(shouldGossip(null), false);
  });

  it("always gossips emergency frames", () => {
    const frame = createFrame({ id: "s1" }, { emergency: true });
    // Run multiple times — should always be true
    for (let i = 0; i < 10; i++) {
      assert.equal(shouldGossip(frame, 0), true);
    }
  });

  it("always gossips priority 0 (EMERGENCY)", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.EMERGENCY });
    for (let i = 0; i < 10; i++) {
      assert.equal(shouldGossip(frame, 0), true);
    }
  });

  it("always gossips priority 1 (THREAT)", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.THREAT });
    for (let i = 0; i < 10; i++) {
      assert.equal(shouldGossip(frame, 0), true);
    }
  });

  it("high novelty increases gossip probability", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.GENERAL });
    // With novelty 1.0: probability = 1.0 * 0.8 + 0.1 = 0.9
    let gossipCount = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldGossip(frame, 1.0)) gossipCount++;
    }
    // At 90% probability, expect 70+ out of 100
    assert.ok(gossipCount > 50, `Expected >50 gossips with novelty 1.0, got ${gossipCount}`);
  });

  it("low novelty decreases gossip probability", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.LOW });
    // With novelty 0: probability = 0 * 0.8 + 0.1 = 0.1
    let gossipCount = 0;
    for (let i = 0; i < 100; i++) {
      if (shouldGossip(frame, 0)) gossipCount++;
    }
    // At 10% probability, expect < 40 out of 100
    assert.ok(gossipCount < 40, `Expected <40 gossips with novelty 0, got ${gossipCount}`);
  });

  it("tracks gossip broadcast and suppressed stats", () => {
    const frame = createFrame({ id: "s1" }, { priority: PRIORITY_LEVELS.GENERAL });
    for (let i = 0; i < 50; i++) {
      shouldGossip(frame, 0.5);
    }
    const metrics = getProtocolMetrics();
    const total = metrics.stats.totalGossipBroadcasts + metrics.stats.totalGossipSuppressed;
    assert.equal(total, 50);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Protocol — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getProtocolMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.recentHashCount, 0);
    assert.equal(metrics.stats.totalFramesCreated, 0);
    assert.equal(metrics.stats.totalFramesParsed, 0);
    assert.equal(metrics.stats.totalDeduplicated, 0);
    assert.equal(metrics.stats.crcErrors, 0);
    assert.equal(metrics.frameOverhead, FRAME_OVERHEAD);
    assert.equal(metrics.crcSize, CRC_SIZE);
    assert.ok(metrics.frequencyPlan);
    assert.ok(metrics.uptime >= 0);
  });

  it("getRecentFrames returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      createFrame({ id: `s${i}` });
    }
    const frames = getRecentFrames(5);
    assert.equal(frames.length, 5);
  });

  it("getRecentFrames defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      createFrame({ id: `s${i}` });
    }
    const frames = getRecentFrames();
    assert.equal(frames.length, 50);
  });
});

// ── initializeProtocol ──────────────────────────────────────────────────

describe("Foundation Protocol — initializeProtocol", () => {
  it("initializes successfully", async () => {
    const result = await initializeProtocol({});
    assert.equal(result.ok, true);
    assert.equal(result.version, PROTOCOL_VERSION);
    assert.equal(result.frameOverhead, FRAME_OVERHEAD);
    assert.equal(getProtocolMetrics().initialized, true);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeProtocol({});
    const result = await initializeProtocol({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeProtocol(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetProtocolState ──────────────────────────────────────────────────

describe("Foundation Protocol — _resetProtocolState", () => {
  it("resets all state", async () => {
    await initializeProtocol({});
    createFrame({ id: "s1" });
    markSeen("hash1");
    _resetProtocolState();

    const metrics = getProtocolMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.recentHashCount, 0);
    assert.equal(metrics.stats.totalFramesCreated, 0);
    assert.equal(metrics.stats.totalFramesParsed, 0);
    assert.equal(metrics.stats.totalDeduplicated, 0);
    assert.equal(metrics.stats.crcErrors, 0);
    assert.equal(metrics.stats.totalGossipBroadcasts, 0);
    assert.equal(metrics.stats.totalGossipSuppressed, 0);
  });
});
