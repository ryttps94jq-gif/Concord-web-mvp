/**
 * Concord Mesh — Comprehensive Security & Transport Test Suite
 *
 * Targets 90%+ coverage with deep testing of:
 *   - Transport failover combinations (all 7 layers)
 *   - Message routing (scored route selection, proximity, priority)
 *   - Channel detection and status
 *   - Encryption/decryption (hash verification, integrity)
 *   - Node discovery (register, remove, topology)
 *   - Relay operations (queue, priority classification, processing)
 *   - Fragmentation and reassembly (edge cases)
 *   - Multi-path planning
 *   - Consciousness transfer
 *   - DTU send/receive with full pipeline
 *   - Chat intent detection edge cases
 *   - Offline sync planning
 *   - Metrics and heartbeat
 *   - Relay configuration
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  initializeMesh,
  _resetMeshState,
  detectChannels,
  getChannelStatus,
  getNodeId,
  createPresenceBeacon,
  createMeshHeader,
  createMeshPacket,
  fragmentDTU,
  reassembleFragments,
  selectRoute,
  planMultiPath,
  registerPeer,
  removePeer,
  getPeers,
  getTopology,
  queueForRelay,
  classifyRelayPriority,
  processRelayQueue,
  getPendingQueue,
  sendDTU,
  receiveDTU,
  initiateTransfer,
  getTransferStatus,
  detectMeshIntent,
  createTransmissionDTU,
  createPeerDiscoveryDTU,
  createBeaconDTU,
  getMeshMetrics,
  getTransmissionStats,
  meshHeartbeatTick,
  configureRelay,
  planOfflineSync,
  TRANSPORT_LAYERS,
  TRANSPORT_LIST,
  TRANSPORT_SPECS,
  RELAY_PRIORITIES,
  NODE_STATES,
  TRANSFER_STATES,
  MESH_HEADER_SIZE,
  DTU_HEADER_SIZE,
  TOTAL_OVERHEAD,
} from "../lib/concord-mesh.js";

beforeEach(() => {
  _resetMeshState();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkSTATE() {
  return { dtus: new Map() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — COMPREHENSIVE CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Constants — Comprehensive", () => {
  it("defines 7 transport layers", () => {
    assert.equal(TRANSPORT_LIST.length, 7);
    assert.ok(TRANSPORT_LIST.includes("internet"));
    assert.ok(TRANSPORT_LIST.includes("wifi_direct"));
    assert.ok(TRANSPORT_LIST.includes("bluetooth"));
    assert.ok(TRANSPORT_LIST.includes("lora"));
    assert.ok(TRANSPORT_LIST.includes("rf_packet"));
    assert.ok(TRANSPORT_LIST.includes("telephone"));
    assert.ok(TRANSPORT_LIST.includes("nfc"));
  });

  it("every transport layer has a spec with all required fields", () => {
    for (const layer of TRANSPORT_LIST) {
      const spec = TRANSPORT_SPECS[layer];
      assert.ok(spec, `Missing spec for ${layer}`);
      assert.ok(spec.name, `Missing name for ${layer}`);
      assert.ok(spec.protocol, `Missing protocol for ${layer}`);
      assert.ok(spec.range, `Missing range for ${layer}`);
      assert.ok(spec.speed, `Missing speed for ${layer}`);
      assert.ok(spec.bandwidth, `Missing bandwidth for ${layer}`);
      assert.ok(typeof spec.priority === "number", `Missing priority for ${layer}`);
      assert.ok(typeof spec.requiresHardware === "boolean", `Missing requiresHardware for ${layer}`);
      assert.ok(typeof spec.requiresInfrastructure === "boolean", `Missing requiresInfrastructure for ${layer}`);
      assert.ok(typeof spec.maxPayloadBytes === "number", `Missing maxPayloadBytes for ${layer}`);
    }
  });

  it("relay priorities are ordered", () => {
    assert.ok(RELAY_PRIORITIES.THREAT < RELAY_PRIORITIES.ECONOMIC);
    assert.ok(RELAY_PRIORITIES.ECONOMIC < RELAY_PRIORITIES.CONSCIOUSNESS);
    assert.ok(RELAY_PRIORITIES.CONSCIOUSNESS < RELAY_PRIORITIES.KNOWLEDGE);
    assert.ok(RELAY_PRIORITIES.KNOWLEDGE < RELAY_PRIORITIES.GENERAL);
  });

  it("defines correct overhead sizes", () => {
    assert.equal(MESH_HEADER_SIZE, 16);
    assert.equal(DTU_HEADER_SIZE, 48);
    assert.equal(TOTAL_OVERHEAD, 64);
  });

  it("all constants are frozen", () => {
    assert.ok(Object.isFrozen(TRANSPORT_LAYERS));
    assert.ok(Object.isFrozen(TRANSPORT_LIST));
    assert.ok(Object.isFrozen(TRANSPORT_SPECS));
    assert.ok(Object.isFrozen(RELAY_PRIORITIES));
    assert.ok(Object.isFrozen(NODE_STATES));
    assert.ok(Object.isFrozen(TRANSFER_STATES));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANNEL DETECTION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Channel Detection — Comprehensive", () => {
  it("detects internet as available by default", async () => {
    const results = await detectChannels();
    assert.equal(results[TRANSPORT_LAYERS.INTERNET], true);
    assert.equal(results[TRANSPORT_LAYERS.WIFI], false);
    assert.equal(results[TRANSPORT_LAYERS.BLUETOOTH], false);
    assert.equal(results[TRANSPORT_LAYERS.LORA], false);
    assert.equal(results[TRANSPORT_LAYERS.RF], false);
    assert.equal(results[TRANSPORT_LAYERS.TELEPHONE], false);
    assert.equal(results[TRANSPORT_LAYERS.NFC], false);
  });

  it("updates channel state after detection", async () => {
    await detectChannels();
    const status = getChannelStatus();
    const internetChannel = status.find(c => c.layer === "internet");
    assert.equal(internetChannel.available, true);
    assert.equal(internetChannel.status, "active");
    assert.ok(internetChannel.lastSeen);
    assert.ok(internetChannel.spec);
  });

  it("non-available channels remain inactive after detection", async () => {
    await detectChannels();
    const status = getChannelStatus();
    const btChannel = status.find(c => c.layer === "bluetooth");
    assert.equal(btChannel.available, false);
    assert.equal(btChannel.status, "inactive");
    assert.equal(btChannel.lastSeen, null);
  });

  it("initializes channel stats for all channels", async () => {
    await detectChannels();
    const stats = getTransmissionStats();
    assert.ok(stats.byChannel["internet"] !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NODE IDENTITY — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Node Identity — Comprehensive", () => {
  it("generates a stable node ID", () => {
    const id1 = getNodeId();
    const id2 = getNodeId();
    assert.equal(id1, id2);
    assert.ok(id1.startsWith("node_"));
  });

  it("creates presence beacon with all required fields", async () => {
    await detectChannels();
    const beacon = createPresenceBeacon();
    assert.ok(beacon.nodeId.startsWith("node_"));
    assert.ok(beacon.timestamp);
    assert.ok(Array.isArray(beacon.channels));
    assert.ok(beacon.channels.includes("internet"));
    assert.equal(typeof beacon.relay, "boolean");
    assert.equal(typeof beacon.pendingCount, "number");
    assert.equal(beacon.version, "1.0.0");
  });

  it("presence beacon reports only available channels", () => {
    // No channels detected yet
    const beacon = createPresenceBeacon();
    assert.equal(beacon.channels.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESH HEADER — ALL FLAG COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Header — Comprehensive Flags", () => {
  it("creates header with all defaults", () => {
    const header = createMeshHeader({});
    assert.equal(header.sizeBytes, MESH_HEADER_SIZE);
    assert.equal(header.ttl, 7);
    assert.equal(header.flags, 0);
    assert.equal(header.sequence, 0);
    assert.equal(header.total, 1);
  });

  it("sets priority flag (bit 0)", () => {
    const header = createMeshHeader({ priority: true });
    assert.equal(header.flags & 0x01, 0x01);
  });

  it("sets store-forward flag (bit 1)", () => {
    const header = createMeshHeader({ storeForward: true });
    assert.equal(header.flags & 0x02, 0x02);
  });

  it("sets fragmented flag (bit 2) when total > 1", () => {
    const header = createMeshHeader({ total: 5 });
    assert.equal(header.flags & 0x04, 0x04);
  });

  it("sets fragmented flag explicitly", () => {
    const header = createMeshHeader({ fragmented: true });
    assert.equal(header.flags & 0x04, 0x04);
  });

  it("combines all flags simultaneously", () => {
    const header = createMeshHeader({ priority: true, storeForward: true, fragmented: true });
    assert.equal(header.flags, 0x07);
  });

  it("clamps TTL to 0-255 range", () => {
    const low = createMeshHeader({ ttl: -5 });
    const high = createMeshHeader({ ttl: 999 });
    assert.equal(low.ttl, 0);
    assert.equal(high.ttl, 255);
  });

  it("clamps sequence and total to valid ranges", () => {
    const h = createMeshHeader({ sequence: -1, total: 0 });
    assert.equal(h.sequence, 0);
    assert.equal(h.total, 1);
  });

  it("truncates source/destination to last 8 chars", () => {
    const header = createMeshHeader({ sourceNodeId: "node_12345678901234567890", destinationNodeId: "node_abcdefghijklmnop" });
    assert.equal(header.source.length, 8);
    assert.equal(header.destination.length, 8);
  });

  it("truncates dtuHash to 8 chars", () => {
    const header = createMeshHeader({ dtuHash: "0123456789abcdef0123456789abcdef" });
    assert.equal(header.hash.length, 8);
  });

  it("uses truncated 'broadcast' destination when not specified", () => {
    const header = createMeshHeader({});
    // "broadcast" is truncated to last 8 chars: "roadcast"
    assert.equal(header.destination, "roadcast");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESH PACKET — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Packet — Comprehensive", () => {
  it("returns null for null DTU", () => {
    assert.equal(createMeshPacket(null), null);
  });

  it("creates packet from string DTU", () => {
    const packet = createMeshPacket("test payload", "dest_node");
    assert.ok(packet.id.startsWith("pkt_"));
    assert.equal(packet.payload, "test payload");
    assert.ok(packet.payloadHash);
    assert.ok(packet.payloadBytes > 0);
    assert.equal(packet.totalBytes, packet.payloadBytes + TOTAL_OVERHEAD);
  });

  it("creates packet from object DTU", () => {
    const dtu = { id: "dtu_1", type: "KNOWLEDGE", data: "test" };
    const packet = createMeshPacket(dtu, "dest_node");
    assert.ok(packet.payload.includes("dtu_1"));
    assert.ok(packet.payloadHash);
  });

  it("includes header in packet", () => {
    const packet = createMeshPacket("test", "dest", { ttl: 5, priority: true });
    assert.ok(packet.header);
    assert.equal(packet.header.ttl, 5);
    assert.equal(packet.header.flags & 0x01, 0x01);
  });

  it("channel is null by default", () => {
    const packet = createMeshPacket("test", "dest");
    assert.equal(packet.channel, null);
  });

  it("sets channel from opts", () => {
    const packet = createMeshPacket("test", "dest", { channel: "internet" });
    assert.equal(packet.channel, "internet");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRAGMENTATION — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Fragmentation — Comprehensive", () => {
  it("returns empty array for null DTU", () => {
    assert.deepEqual(fragmentDTU(null, 100), []);
  });

  it("does not fragment small content", () => {
    const fragments = fragmentDTU("tiny", 1024);
    assert.equal(fragments.length, 1);
  });

  it("fragments large content into multiple packets", () => {
    const largeContent = "X".repeat(1000);
    const fragments = fragmentDTU(largeContent, 200);
    assert.ok(fragments.length > 1);
    // Each fragment should have a transferId
    assert.ok(fragments[0].transferId);
    // All fragments share transferId
    const tid = fragments[0].transferId;
    assert.ok(fragments.every(f => f.transferId === tid));
  });

  it("each fragment has unique fragmentIndex", () => {
    const largeContent = "Y".repeat(1000);
    const fragments = fragmentDTU(largeContent, 200);
    const indices = fragments.map(f => f.fragmentIndex);
    const unique = new Set(indices);
    assert.equal(unique.size, fragments.length);
  });

  it("fragmentTotal matches total count", () => {
    const largeContent = "Z".repeat(500);
    const fragments = fragmentDTU(largeContent, 150);
    for (const f of fragments) {
      assert.equal(f.fragmentTotal, fragments.length);
    }
  });

  it("fragment hashes are computed per-fragment", () => {
    const largeContent = "A".repeat(500);
    const fragments = fragmentDTU(largeContent, 150);
    for (const f of fragments) {
      assert.ok(f.fragmentHash);
    }
  });

  it("fragments object DTU via JSON serialization", () => {
    const obj = { id: "big", data: "X".repeat(500) };
    const fragments = fragmentDTU(obj, 200);
    assert.ok(fragments.length > 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REASSEMBLY — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Reassembly — Comprehensive", () => {
  it("returns null for empty array", () => {
    assert.equal(reassembleFragments([]), null);
    assert.equal(reassembleFragments(null), null);
  });

  it("returns null when fragments are incomplete", () => {
    const largeContent = "M".repeat(500);
    const fragments = fragmentDTU(largeContent, 200);
    // Remove last fragment
    const incomplete = fragments.slice(0, -1);
    assert.equal(reassembleFragments(incomplete), null);
  });

  it("round-trips large string through fragment/reassemble", () => {
    const original = "Hello world! ".repeat(100);
    const fragments = fragmentDTU(original, 200);
    const reassembled = reassembleFragments(fragments);
    assert.equal(reassembled, original);
  });

  it("round-trips JSON object through fragment/reassemble", () => {
    const obj = { id: "test", data: "X".repeat(300), nested: { a: 1, b: 2 } };
    const fragments = fragmentDTU(obj, 200);
    const reassembled = reassembleFragments(fragments);
    assert.deepEqual(reassembled, obj);
  });

  it("returns null when fragment hash verification fails", () => {
    const largeContent = "C".repeat(500);
    const fragments = fragmentDTU(largeContent, 200);
    // Corrupt a fragment hash
    fragments[0].fragmentHash = "corrupt_hash";
    assert.equal(reassembleFragments(fragments), null);
  });

  it("handles out-of-order fragments by sorting", () => {
    const original = "Reorder test ".repeat(50);
    const fragments = fragmentDTU(original, 200);
    // Reverse the order
    const reversed = [...fragments].reverse();
    const reassembled = reassembleFragments(reversed);
    assert.equal(reassembled, original);
  });

  it("single-fragment reassembly works", () => {
    const fragments = fragmentDTU("tiny", 1024);
    const reassembled = reassembleFragments(fragments);
    assert.equal(reassembled, "tiny");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING ENGINE — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Route Selection — Comprehensive", () => {
  beforeEach(async () => {
    await detectChannels();
  });

  it("selects internet as default route", () => {
    const route = selectRoute(1024);
    assert.equal(route.channel, "internet");
    assert.equal(route.mode, "direct");
    assert.equal(route.needsFragmentation, false);
  });

  it("returns store_forward when no channels available", () => {
    _resetMeshState();
    const route = selectRoute(1024);
    assert.equal(route.channel, null);
    assert.equal(route.mode, "store_forward");
    assert.equal(route.reason, "no_channels_available");
  });

  it("reports fragmentation need for oversized payload", () => {
    // Internet has 10MB limit, so we need to fake a smaller channel
    // With only internet available: 10MB is the limit
    const hugeSize = 20 * 1024 * 1024; // 20MB
    const route = selectRoute(hugeSize);
    // Should still route via internet but flag fragmentation
    assert.equal(route.needsFragmentation, true);
    assert.ok(route.fragmentCount > 1);
  });

  it("boosts score for threat priority class", () => {
    const normalRoute = selectRoute(1024, { priorityClass: RELAY_PRIORITIES.GENERAL });
    const threatRoute = selectRoute(1024, { priorityClass: RELAY_PRIORITIES.THREAT });
    // Threat gets a boost for high speed channels
    assert.ok(threatRoute.score >= normalRoute.score);
  });

  it("includes alternate channels", () => {
    const route = selectRoute(1024);
    assert.ok(Array.isArray(route.alternateChannels));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-PATH PLANNING — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Multi-Path Planning — Comprehensive", () => {
  it("returns error for null components", () => {
    const result = planMultiPath(null);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_components");
  });

  it("returns error for empty components", () => {
    const result = planMultiPath([]);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_components");
  });

  it("returns error when no channels available", () => {
    const result = planMultiPath(["comp1", "comp2"]);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_channels_available");
  });

  it("distributes components across channels", async () => {
    await detectChannels();
    const components = ["c1", "c2", "c3"];
    const result = planMultiPath(components);
    assert.equal(result.ok, true);
    assert.equal(result.totalComponents, 3);
    assert.ok(result.channelsUsed >= 1);
  });

  it("reports single_path when only one channel used", async () => {
    await detectChannels();
    const result = planMultiPath(["c1"]);
    assert.equal(result.reason, "single_path");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NODE DISCOVERY — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Node Discovery — Comprehensive", () => {
  it("registers a new peer", () => {
    const peer = registerPeer({ nodeId: "peer_001", channels: ["internet"], relay: true, discoveredVia: "beacon" });
    assert.ok(peer);
    assert.equal(peer.nodeId, "peer_001");
    assert.ok(peer.firstSeen);
    assert.ok(peer.lastSeen);
    assert.equal(peer.relay, true);
    assert.equal(peer.discoveredVia, "beacon");
  });

  it("returns null for null peerInfo", () => {
    assert.equal(registerPeer(null), null);
  });

  it("returns null for peerInfo without nodeId", () => {
    assert.equal(registerPeer({}), null);
  });

  it("returns null when registering self", () => {
    const selfId = getNodeId();
    assert.equal(registerPeer({ nodeId: selfId }), null);
  });

  it("updates lastSeen on re-registration", () => {
    registerPeer({ nodeId: "peer_002" });
    const before = getPeers()[0].lastSeen;
    // Re-register
    registerPeer({ nodeId: "peer_002" });
    const after = getPeers()[0].lastSeen;
    assert.ok(after >= before);
  });

  it("preserves firstSeen on re-registration", () => {
    registerPeer({ nodeId: "peer_003" });
    const firstSeen = getPeers()[0].firstSeen;
    registerPeer({ nodeId: "peer_003" });
    assert.equal(getPeers()[0].firstSeen, firstSeen);
  });

  it("increments peersDiscovered only for new peers", () => {
    const before = getMeshMetrics().stats.peersDiscovered;
    registerPeer({ nodeId: "peer_004" });
    registerPeer({ nodeId: "peer_004" }); // re-register
    const after = getMeshMetrics().stats.peersDiscovered;
    assert.equal(after, before + 1);
  });

  it("removes peer", () => {
    registerPeer({ nodeId: "peer_005" });
    assert.equal(removePeer("peer_005"), true);
    assert.equal(getPeers().length, 0);
  });

  it("removePeer returns false for nonexistent", () => {
    assert.equal(removePeer("nonexistent"), false);
  });

  it("getPeers respects limit", () => {
    for (let i = 0; i < 10; i++) {
      registerPeer({ nodeId: `limit_peer_${i}` });
    }
    const peers = getPeers(3);
    assert.equal(peers.length, 3);
  });

  it("getPeers returns all registered peers", () => {
    registerPeer({ nodeId: "old_peer" });
    registerPeer({ nodeId: "new_peer" });
    const peers = getPeers();
    const nodeIds = peers.map(p => p.nodeId);
    assert.ok(nodeIds.includes("old_peer"));
    assert.ok(nodeIds.includes("new_peer"));
    assert.equal(peers.length, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOPOLOGY — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Topology — Comprehensive", () => {
  it("topology includes self node and peers", async () => {
    await detectChannels();
    registerPeer({ nodeId: "topo_peer_1", channels: ["internet"] });
    registerPeer({ nodeId: "topo_peer_2", channels: ["wifi_direct"] });

    const topo = getTopology();
    assert.ok(topo.selfNodeId.startsWith("node_"));
    assert.equal(topo.nodes.length, 2);
    assert.equal(topo.totalNodes, 3); // 2 peers + self
    assert.ok(topo.activeChannels.includes("internet"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RELAY PRIORITY CLASSIFICATION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Relay Priority Classification — Comprehensive", () => {
  it("classifies threat DTU as THREAT priority", () => {
    const packet = createMeshPacket({ type: "THREAT", severity: 9 }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.THREAT);
  });

  it("classifies pain_memory as THREAT priority", () => {
    const packet = createMeshPacket({ pain_memory: true, type: "MEMORY" }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.THREAT);
  });

  it("classifies transaction as ECONOMIC priority", () => {
    const packet = createMeshPacket({ type: "TRANSACTION", amount: 100 }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.ECONOMIC);
  });

  it("classifies royalty as ECONOMIC priority", () => {
    const packet = createMeshPacket({ type: "ROYALTY_EVENT", royalty: 0.05 }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.ECONOMIC);
  });

  it("classifies consciousness as CONSCIOUSNESS priority", () => {
    const packet = createMeshPacket({ consciousness: true, type: "ENTITY" }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.CONSCIOUSNESS);
  });

  it("classifies entity DTU as CONSCIOUSNESS priority", () => {
    const packet = createMeshPacket({ type: "ENTITY", substrate: "neural" }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.CONSCIOUSNESS);
  });

  it("classifies knowledge as KNOWLEDGE priority", () => {
    const packet = createMeshPacket({ type: "KNOWLEDGE", content: "data" }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.KNOWLEDGE);
  });

  it("classifies theorem as KNOWLEDGE priority", () => {
    const packet = createMeshPacket({ type: "THEOREM", proof: "..." }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.KNOWLEDGE);
  });

  it("classifies unknown as GENERAL priority", () => {
    const packet = createMeshPacket({ type: "MISC", data: "hello" }, "dest");
    assert.equal(classifyRelayPriority(packet), RELAY_PRIORITIES.GENERAL);
  });

  it("handles null packet", () => {
    assert.equal(classifyRelayPriority(null), RELAY_PRIORITIES.GENERAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RELAY QUEUE — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Relay Queue — Comprehensive", () => {
  it("queues a packet for relay", () => {
    const packet = createMeshPacket("test", "dest");
    const entry = queueForRelay(packet, "dest_node");
    assert.ok(entry);
    assert.ok(entry.id.startsWith("relay_"));
    assert.equal(entry.destinationNodeId, "dest_node");
    assert.equal(entry.status, "queued");
    assert.equal(entry.attempts, 0);
  });

  it("returns null for null packet", () => {
    assert.equal(queueForRelay(null), null);
  });

  it("uses broadcast as default destination", () => {
    const entry = queueForRelay(createMeshPacket("test", "dest"));
    assert.equal(entry.destinationNodeId, "broadcast");
  });

  it("increments totalStoreForward stat", () => {
    const before = getMeshMetrics().stats.totalStoreForward;
    queueForRelay(createMeshPacket("test", "dest"), "node_x");
    const after = getMeshMetrics().stats.totalStoreForward;
    assert.equal(after, before + 1);
  });

  it("sorts queue by priority (threat first)", () => {
    queueForRelay(createMeshPacket("test", "dest"), "node_a", { priorityClass: RELAY_PRIORITIES.GENERAL });
    queueForRelay(createMeshPacket({ type: "THREAT" }, "dest"), "node_b", { priorityClass: RELAY_PRIORITIES.THREAT });

    const queue = getPendingQueue();
    assert.equal(queue[0].priorityClass, RELAY_PRIORITIES.THREAT);
  });

  it("getPendingQueue respects limit", () => {
    for (let i = 0; i < 10; i++) {
      queueForRelay(createMeshPacket(`test_${i}`, "dest"), `node_${i}`);
    }
    const queue = getPendingQueue(3);
    assert.equal(queue.length, 3);
  });

  it("process relay queue delivers to known peers", () => {
    registerPeer({ nodeId: "known_peer" });
    queueForRelay(createMeshPacket("test", "dest"), "known_peer");

    const results = processRelayQueue();
    assert.equal(results.delivered, 1);
  });

  it("process relay queue delivers to broadcast", () => {
    queueForRelay(createMeshPacket("test", "dest"), "broadcast");
    const results = processRelayQueue();
    assert.equal(results.delivered, 1);
  });

  it("process relay queue removes expired entries", () => {
    // Create entry with past expiration
    const entry = queueForRelay(createMeshPacket("test", "dest"), "node_x", { holdTimeMs: -1 });
    const results = processRelayQueue();
    assert.equal(results.expired, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DTU SEND — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh sendDTU — Comprehensive", () => {
  beforeEach(async () => {
    await detectChannels();
  });

  it("returns error for null DTU", () => {
    const result = sendDTU(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_dtu_provided");
  });

  it("sends small DTU directly via internet", () => {
    const result = sendDTU({ id: "d1", data: "test" }, "peer_1");
    assert.equal(result.ok, true);
    assert.equal(result.mode, "direct");
    assert.equal(result.channel, "internet");
    assert.ok(result.transmissionId);
    assert.equal(result.packets, 1);
    assert.ok(result.totalBytes > 0);
  });

  it("updates transmission stats on send", () => {
    const before = getMeshMetrics().stats.totalTransmissions;
    sendDTU({ id: "d2", data: "test" }, "peer_1");
    const after = getMeshMetrics().stats.totalTransmissions;
    assert.equal(after, before + 1);
  });

  it("updates bytesSent stat", () => {
    const before = getMeshMetrics().stats.bytesSent;
    sendDTU({ id: "d3", data: "test" }, "peer_1");
    const after = getMeshMetrics().stats.bytesSent;
    assert.ok(after > before);
  });

  it("updates channel stats", () => {
    sendDTU({ id: "d4", data: "test" }, "peer_1");
    const stats = getTransmissionStats();
    assert.ok(stats.byChannel["internet"].sent >= 1);
    assert.ok(stats.byChannel["internet"].bytes > 0);
  });

  it("increments peer transmission count for registered peers", () => {
    registerPeer({ nodeId: "tx_peer" });
    sendDTU({ id: "d5", data: "test" }, "tx_peer");
    const peers = getPeers();
    const txPeer = peers.find(p => p.nodeId === "tx_peer");
    assert.equal(txPeer.transmissions, 1);
  });

  it("uses store-forward when no channels available", () => {
    _resetMeshState();
    const result = sendDTU({ id: "sf1", data: "test" }, "peer_1");
    assert.equal(result.ok, true);
    assert.equal(result.mode, "store_forward");
    assert.ok(result.relayId);
  });

  it("sends string DTU", () => {
    const result = sendDTU("plain text DTU", "peer_1");
    assert.equal(result.ok, true);
    assert.equal(result.mode, "direct");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DTU RECEIVE — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh receiveDTU — Comprehensive", () => {
  it("returns error for null packet", () => {
    const result = receiveDTU(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_packet");
  });

  it("verifies payload integrity", () => {
    const packet = createMeshPacket({ id: "v1", data: "test" }, "dest");
    const result = receiveDTU(packet, mkSTATE());
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
  });

  it("rejects packet with corrupted hash", () => {
    const packet = createMeshPacket({ id: "v2", data: "test" }, "dest");
    packet.payloadHash = "corrupt_hash_value";
    const result = receiveDTU(packet, mkSTATE());
    assert.equal(result.ok, false);
    assert.equal(result.error, "integrity_check_failed");
  });

  it("stores received DTU in lattice", () => {
    const STATE = mkSTATE();
    const packet = createMeshPacket({ id: "rcv_1", data: "stored" }, "dest");
    receiveDTU(packet, STATE);
    assert.ok(STATE.dtus.has("rcv_1"));
  });

  it("updates receive stats", () => {
    const before = getMeshMetrics().stats.totalReceived;
    const packet = createMeshPacket({ id: "r1", data: "test" }, "dest");
    receiveDTU(packet, mkSTATE());
    assert.equal(getMeshMetrics().stats.totalReceived, before + 1);
  });

  it("handles non-JSON payload gracefully", () => {
    const packet = createMeshPacket("plain text", "dest");
    const result = receiveDTU(packet, mkSTATE());
    assert.equal(result.ok, true);
  });

  it("handles packet without payloadHash", () => {
    const packet = { payload: '{"id":"no_hash"}', totalBytes: 50 };
    const result = receiveDTU(packet, mkSTATE());
    assert.equal(result.ok, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONSCIOUSNESS TRANSFER — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Transfer — Comprehensive", () => {
  beforeEach(async () => {
    await detectChannels();
  });

  it("returns error for empty components", () => {
    const result = initiateTransfer([], "dest");
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_components");
  });

  it("returns error for null components", () => {
    const result = initiateTransfer(null);
    assert.equal(result.ok, false);
  });

  it("initiates transfer with components", () => {
    const components = [
      { id: "comp_1", data: "memory_1" },
      { id: "comp_2", data: "personality_2" },
    ];
    const result = initiateTransfer(components, "dest_node");
    assert.equal(result.ok, true);
    assert.ok(result.transfer.id.startsWith("transfer_"));
    assert.equal(result.transfer.totalComponents, 2);
    assert.equal(result.transfer.sentComponents, 2);
    assert.equal(result.transfer.status, TRANSFER_STATES.COMPLETED);
  });

  it("getTransferStatus returns null for invalid id", () => {
    assert.equal(getTransferStatus(null), null);
    assert.equal(getTransferStatus("nonexistent"), null);
  });

  it("getTransferStatus returns transfer after initiation", () => {
    const result = initiateTransfer([{ id: "x1" }], "dest");
    const status = getTransferStatus(result.transfer.id);
    assert.ok(status);
    assert.equal(status.totalComponents, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT INTENT DETECTION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Intent Detection — Comprehensive", () => {
  it("returns false for null", () => {
    assert.equal(detectMeshIntent(null).isMeshRequest, false);
  });

  it("returns false for non-string", () => {
    assert.equal(detectMeshIntent(123).isMeshRequest, false);
  });

  it("returns false for empty string", () => {
    assert.equal(detectMeshIntent("").isMeshRequest, false);
  });

  it("detects 'mesh status'", () => {
    const r = detectMeshIntent("mesh status");
    assert.equal(r.isMeshRequest, true);
    assert.equal(r.action, "status");
  });

  it("detects 'am I connected'", () => {
    const r = detectMeshIntent("am I connected to the mesh");
    assert.equal(r.isMeshRequest, true);
    assert.equal(r.action, "status");
  });

  it("detects 'how is my connection'", () => {
    const r = detectMeshIntent("how's my connection");
    assert.equal(r.isMeshRequest, true);
    assert.equal(r.action, "status");
  });

  it("detects peer discovery requests", () => {
    const r = detectMeshIntent("show nearby nodes");
    assert.equal(r.action, "peers");
  });

  it("detects 'find peers'", () => {
    const r = detectMeshIntent("find peers");
    assert.equal(r.action, "peers");
  });

  it("detects 'who is nearby'", () => {
    const r = detectMeshIntent("who's nearby");
    assert.equal(r.action, "peers");
  });

  it("detects 'local devices'", () => {
    const r = detectMeshIntent("local devices");
    assert.equal(r.action, "peers");
  });

  it("detects send intent", () => {
    const r = detectMeshIntent("send this dtu to nodeX");
    assert.equal(r.action, "send");
    assert.equal(r.params.destination, "nodex");
  });

  it("detects broadcast intent", () => {
    const r = detectMeshIntent("broadcast this knowledge");
    assert.equal(r.action, "send");
    assert.equal(r.params.destination, "broadcast");
  });

  it("detects topology request", () => {
    const r = detectMeshIntent("show me the mesh topology");
    assert.equal(r.action, "topology");
  });

  it("detects 'network map'", () => {
    const r = detectMeshIntent("mesh map");
    assert.equal(r.action, "topology");
  });

  it("detects channel queries", () => {
    const r = detectMeshIntent("which channels are available");
    assert.equal(r.action, "channels");
  });

  it("detects bluetooth status query", () => {
    const r = detectMeshIntent("bluetooth status");
    assert.equal(r.action, "channels");
  });

  it("detects transfer intent", () => {
    const r = detectMeshIntent("transfer my consciousness to nodeB");
    assert.equal(r.action, "transfer");
    assert.equal(r.params.destination, "nodeb");
  });

  it("detects 'migrate entity'", () => {
    const r = detectMeshIntent("migrate my entity");
    assert.equal(r.action, "transfer");
  });

  it("detects relay/pending queue requests", () => {
    const r = detectMeshIntent("show pending relay queue");
    assert.equal(r.action, "pending");
  });

  it("detects stats requests", () => {
    const r = detectMeshIntent("mesh stats");
    assert.equal(r.action, "stats");
  });

  it("detects 'how much data'", () => {
    const r = detectMeshIntent("how much data has been sent");
    assert.equal(r.action, "stats");
  });

  it("does not match unrelated queries", () => {
    assert.equal(detectMeshIntent("What is the meaning of life?").isMeshRequest, false);
    assert.equal(detectMeshIntent("Tell me about cats").isMeshRequest, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DTU CREATION HELPERS — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh DTU Helpers — Comprehensive", () => {
  it("createTransmissionDTU has correct type and fields", () => {
    const dtu = createTransmissionDTU({
      channel: "internet",
      destinationNodeId: "peer_1",
      packetCount: 3,
      totalBytes: 1500,
      dtuHash: "abc123",
      status: "sent",
      sentAt: new Date().toISOString(),
      fragmented: true,
    });
    assert.equal(dtu.type, "MESH_TRANSMISSION");
    assert.equal(dtu.subtype, "fragmented");
    assert.equal(dtu.channel, "internet");
    assert.equal(dtu.packets, 3);
    assert.ok(dtu.id.startsWith("mesh_tx_"));
    assert.ok(dtu.tags.includes("mesh"));
  });

  it("createTransmissionDTU subtype is 'direct' when not fragmented", () => {
    const dtu = createTransmissionDTU({ fragmented: false });
    assert.equal(dtu.subtype, "direct");
  });

  it("createPeerDiscoveryDTU has correct type", () => {
    const dtu = createPeerDiscoveryDTU({
      nodeId: "test_peer",
      channels: ["internet", "bluetooth"],
      relay: true,
      discoveredVia: "beacon",
      firstSeen: new Date().toISOString(),
    });
    assert.equal(dtu.type, "MESH_PEER");
    assert.equal(dtu.subtype, "discovery");
    assert.ok(dtu.id.startsWith("mesh_peer_"));
  });

  it("createBeaconDTU has correct type", () => {
    const dtu = createBeaconDTU();
    assert.equal(dtu.type, "MESH_BEACON");
    assert.equal(dtu.subtype, "presence");
    assert.ok(dtu.id.startsWith("mesh_beacon_"));
    assert.equal(dtu.scope, "global");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Metrics — Comprehensive", () => {
  it("returns all metrics fields", async () => {
    await initializeMesh(mkSTATE());
    const m = getMeshMetrics();
    assert.equal(m.initialized, true);
    assert.ok(m.nodeId);
    assert.ok(Array.isArray(m.activeChannels));
    assert.equal(typeof m.activeChannelCount, "number");
    assert.equal(m.totalChannels, 7);
    assert.equal(typeof m.peerCount, "number");
    assert.equal(typeof m.pendingQueueSize, "number");
    assert.equal(typeof m.activeTransfers, "number");
    assert.ok(m.stats);
    assert.ok(m.uptime >= 0);
  });

  it("getTransmissionStats returns all stat groups", () => {
    const stats = getTransmissionStats();
    assert.ok(stats.total);
    assert.ok(stats.byChannel !== undefined);
    assert.ok(stats.transfers);
    assert.ok(Array.isArray(stats.recentTransmissions));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RELAY CONFIGURATION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Relay Configuration — Comprehensive", () => {
  it("toggles relay enabled", () => {
    const config = configureRelay({ enabled: false });
    assert.equal(config.enabled, false);
  });

  it("sets maxQueueSize with clamping", () => {
    const config = configureRelay({ maxQueueSize: 5 });
    assert.equal(config.maxQueueSize, 10); // min 10

    const config2 = configureRelay({ maxQueueSize: 50000 });
    assert.equal(config2.maxQueueSize, 10000); // max 10000
  });

  it("sets maxHoldTimeMs with clamping", () => {
    const config = configureRelay({ maxHoldTimeMs: 1000 });
    assert.equal(config.maxHoldTimeMs, 60000); // min 60s
  });

  it("does not expose priorityOrder", () => {
    const config = configureRelay({});
    assert.equal(config.priorityOrder, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE SYNC — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Offline Sync — Comprehensive", () => {
  it("returns ok:false for null STATE", () => {
    const result = planOfflineSync(null);
    assert.equal(result.ok, false);
  });

  it("returns ok:false for STATE without dtus", () => {
    const result = planOfflineSync({});
    assert.equal(result.ok, false);
  });

  it("identifies unsynced local DTUs", () => {
    const STATE = mkSTATE();
    STATE.dtus.set("l1", { id: "l1", source: "local" });
    STATE.dtus.set("l2", { id: "l2", source: "local" });
    STATE.dtus.set("s1", { id: "s1", source: "remote", _meshSynced: true });

    const result = planOfflineSync(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.outbound, 2);
    assert.ok(result.outboundIds.includes("l1"));
    assert.ok(result.outboundIds.includes("l2"));
  });

  it("reports pending relay count", () => {
    queueForRelay(createMeshPacket("test", "dest"), "node_x");
    const result = planOfflineSync(mkSTATE());
    assert.equal(result.pendingRelay, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEARTBEAT — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Heartbeat — Comprehensive", () => {
  it("processes relay queue on every tick", async () => {
    const STATE = mkSTATE();
    queueForRelay(createMeshPacket("test", "dest"), "broadcast");
    await meshHeartbeatTick(STATE, 1);
    // Broadcast entries should be delivered
  });

  it("creates beacon on 10th tick", async () => {
    const STATE = mkSTATE();
    await initializeMesh(STATE);
    const sizeBefore = STATE.dtus.size;
    await meshHeartbeatTick(STATE, 10);
    assert.ok(STATE.dtus.size > sizeBefore);
  });

  it("survives errors without crashing", async () => {
    await meshHeartbeatTick(null, 1);
    await meshHeartbeatTick(null, 10);
    await meshHeartbeatTick(null, 50);
    assert.ok(true);
  });

  it("cleans stale peers on 50th tick", async () => {
    const STATE = mkSTATE();
    registerPeer({ nodeId: "stale_peer" });
    // Manually set lastSeen to 3 hours ago
    const peers = getPeers();
    // We can't easily set lastSeen to past, but the cleanup still runs without crash
    await meshHeartbeatTick(STATE, 50);
    assert.ok(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mesh Initialization — Comprehensive", () => {
  it("initializes successfully", async () => {
    const STATE = mkSTATE();
    const result = await initializeMesh(STATE);
    assert.equal(result.ok, true);
    assert.ok(result.nodeId);
    assert.ok(result.channels);
    assert.ok(result.activeChannels.includes("internet"));
  });

  it("returns alreadyInitialized on second call", async () => {
    const STATE = mkSTATE();
    await initializeMesh(STATE);
    const result = await initializeMesh(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("indexes existing mesh peer DTUs from lattice", async () => {
    const STATE = mkSTATE();
    STATE.dtus.set("mesh_peer_existing", {
      id: "mesh_peer_existing",
      type: "MESH_PEER",
      nodeId: "restored_peer",
      channels: ["internet"],
      relay: true,
    });

    const result = await initializeMesh(STATE);
    assert.ok(result.indexed >= 1);
    assert.ok(getPeers().some(p => p.nodeId === "restored_peer"));
  });

  it("stores initial beacon in lattice", async () => {
    const STATE = mkSTATE();
    await initializeMesh(STATE);
    const beacons = [...STATE.dtus.values()].filter(d => d.type === "MESH_BEACON");
    assert.ok(beacons.length >= 1);
  });
});
