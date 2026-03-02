// Concord Mobile — Core Type Definitions

import { DTU_TYPES, DTU_FLAGS, TRANSPORT_LAYERS, IDENTITY_KEY_ALGORITHM } from './constants';

// ── DTU Types ──────────────────────────────────────────────────────────────────

export type DTUTypeCode = typeof DTU_TYPES[keyof typeof DTU_TYPES];
export type DTUFlagBit = typeof DTU_FLAGS[keyof typeof DTU_FLAGS];
export type TransportLayer = typeof TRANSPORT_LAYERS[keyof typeof TRANSPORT_LAYERS];

export interface DTUHeader {
  version: number;
  flags: number;
  type: DTUTypeCode;
  timestamp: number;
  contentLength: number;
  contentHash: Uint8Array;
}

export interface DTU {
  id: string;
  header: DTUHeader;
  content: Uint8Array;
  signature?: Uint8Array;
  lineage?: DTULineage;
  tags: string[];
  meta: DTUMeta;
}

export interface DTULineage {
  parentId: string | null;
  ancestors: string[];
  depth: number;
}

export interface DTUMeta {
  creatorKey?: string;
  scope: 'local' | 'regional' | 'national' | 'global';
  published: boolean;
  painTagged: boolean;
  crpiScore: number;
  originTransport?: TransportLayer;
  relayCount: number;
  ttl: number;
  receivedAt?: number;
  geoGrid?: GeoGrid;
}

export interface GeoGrid {
  lat: number;  // rounded to ~100m grid
  lon: number;  // rounded to ~100m grid
}

// ── DTU Store Types ────────────────────────────────────────────────────────────

export interface DTUStoreRow {
  id: string;
  version: number;
  flags: number;
  type: number;
  timestamp: number;
  content_length: number;
  content_hash: string;
  content: string; // base64 encoded
  signature: string | null;
  parent_id: string | null;
  tags: string; // JSON array
  scope: string;
  published: number; // SQLite boolean
  pain_tagged: number;
  crpi_score: number;
  relay_count: number;
  ttl: number;
  creator_key: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  received_at: number | null;
  created_at: number;
}

export interface DTUSearchResult {
  id: string;
  type: DTUTypeCode;
  timestamp: number;
  tags: string[];
  score: number;
  snippet: string;
}

export interface DTUStoreStats {
  totalCount: number;
  byType: Record<number, number>;
  totalSizeBytes: number;
  oldestTimestamp: number;
  newestTimestamp: number;
}

// ── Mesh Types ─────────────────────────────────────────────────────────────────

export interface MeshPeer {
  id: string;
  publicKey: string;
  name?: string;
  transport: TransportLayer;
  rssi: number;
  lastSeen: number;
  capabilities: PeerCapabilities;
  reputation: PeerReputation;
  authenticated: boolean;
}

export interface PeerCapabilities {
  bluetooth: boolean;
  wifiDirect: boolean;
  nfc: boolean;
  lora: boolean;
  internet: boolean;
}

export interface PeerReputation {
  validDTUs: number;
  invalidDTUs: number;
  totalRelays: number;
  score: number; // 0.0 - 1.0
}

export interface MeshState {
  peers: Map<string, MeshPeer>;
  activePeers: number;
  transports: TransportStatus[];
  relayQueue: RelayQueueEntry[];
  recentHashes: Set<string>;
  meshHealth: MeshHealth;
}

export interface TransportStatus {
  layer: TransportLayer;
  available: boolean;
  active: boolean;
  peerCount: number;
  lastActivity: number;
}

export interface RelayQueueEntry {
  dtuId: string;
  dtuHash: string;
  priority: number;
  ttl: number;
  enqueuedAt: number;
  excludePeers: string[];
}

export interface MeshHealth {
  connectedPeers: number;
  activeTransports: number;
  relayQueueDepth: number;
  dtusPropagated: number;
  dtusReceived: number;
  uptime: number;
}

// ── BLE Types ──────────────────────────────────────────────────────────────────

export interface BLETransferChunk {
  sequenceNumber: number;
  totalChunks: number;
  dtuId: string;
  data: Uint8Array;
  isHeader: boolean;
}

export interface BLETransferSession {
  dtuId: string;
  peerId: string;
  totalChunks: number;
  receivedChunks: Map<number, Uint8Array>;
  startedAt: number;
  lastChunkAt: number;
}

// ── WiFi Direct Types ──────────────────────────────────────────────────────────

export interface WiFiDirectGroup {
  isOwner: boolean;
  ownerAddress: string;
  members: string[];
  ssid: string;
}

export interface LatticeSyncState {
  localMerkleRoot: string;
  remoteMerkleRoot: string;
  missingLocal: string[];  // DTU IDs we need
  missingRemote: string[]; // DTU IDs they need
  syncProgress: number;    // 0.0 - 1.0
}

// ── NFC Types ──────────────────────────────────────────────────────────────────

export interface NDEFDTURecord {
  type: 'concord/dtu';
  id: string;
  header: Uint8Array;
  content: Uint8Array;
}

// ── LoRa Types ─────────────────────────────────────────────────────────────────

export interface LoRaConfig {
  spreadingFactor: number; // 7-12
  bandwidth: number;       // Hz
  codingRate: number;
  txPower: number;
}

export interface LoRaPacket {
  dtuId: string;
  header: Uint8Array;
  content: Uint8Array;
  hopCount: number;
  sourceNode: string;
}

// ── RF/Telephone Types ─────────────────────────────────────────────────────────

export interface AudioCodecConfig {
  sampleRate: number;
  bitsPerSymbol: number;
  fecRate: number; // forward error correction ratio
  preambleMs: number;
}

export interface AudioEncodedDTU {
  samples: Float32Array;
  durationMs: number;
  dtuId: string;
  fecRedundancy: number;
}

// ── Foundation Sense Types ─────────────────────────────────────────────────────

export type SensorType =
  | 'wifi'
  | 'bluetooth'
  | 'gps'
  | 'barometric'
  | 'magnetometer'
  | 'accelerometer'
  | 'gyroscope'
  | 'ambient_light';

export interface SensorReading {
  sensor: SensorType;
  timestamp: number;
  values: Record<string, number | string | boolean>;
  accuracy?: number;
  geoGrid?: GeoGrid;
}

export interface WiFiScanResult {
  ssidHash: string; // hashed for privacy
  rssi: number;
  frequency: number;
  channel: number;
  security: string;
  estimatedDistance: number;
}

export interface BluetoothEnvironment {
  deviceCount: number;
  aggregateRSSI: number;
  typeDistribution: Record<string, number>;
  // Never includes individual device identifiers
}

export interface GPSMultipath {
  accuracy: number;
  verticalAccuracy: number;
  speed: number;
  bearing: number;
  altitude: number;
  multipathIndicator: number;
}

export interface FoundationDTU extends DTU {
  sensorData: SensorReading;
}

// ── Identity Types ─────────────────────────────────────────────────────────────

export interface DeviceIdentity {
  publicKey: string;
  keyAlgorithm: typeof IDENTITY_KEY_ALGORITHM;
  createdAt: number;
  deviceId: string;
  linkedDevices: string[];
}

export interface IdentityAssertion {
  publicKey: string;
  signature: Uint8Array;
  timestamp: number;
  nonce: Uint8Array;
}

export interface MeshAuthChallenge {
  nonce: Uint8Array;
  timestamp: number;
  senderPublicKey: string;
}

export interface MeshAuthResponse {
  signature: Uint8Array;
  publicKey: string;
  nonce: Uint8Array;
}

// ── Economy Types ──────────────────────────────────────────────────────────────

export interface CoinBalance {
  available: number;
  pending: number;
  total: number;
  lastUpdated: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  fromKey: string;
  toKey: string;
  timestamp: number;
  nonce: Uint8Array;
  balanceHash: string;
  signature: Uint8Array;
  status: 'pending' | 'confirmed' | 'rejected';
  propagated: boolean;
}

export type TransactionType =
  | 'transfer'
  | 'marketplace_purchase'
  | 'royalty'
  | 'reward';

export interface MarketplaceListing {
  id: string;
  dtuId: string;
  title: string;
  description: string;
  price: number;
  creatorKey: string;
  category: string;
  tags: string[];
  createdAt: number;
  active: boolean;
}

// ── Shield Types ───────────────────────────────────────────────────────────────

export interface ThreatSignature {
  id: string;
  version: number;
  pattern: string;
  severity: number; // 1-10
  category: string;
  description: string;
  updatedAt: number;
}

export interface ScanResult {
  dtuId: string;
  clean: boolean;
  threats: ThreatMatch[];
  scannedAt: number;
  scanDurationMs: number;
}

export interface ThreatMatch {
  signatureId: string;
  severity: number;
  category: string;
  matchLocation: number;
  confidence: number;
}

export interface QuarantineEntry {
  dtuId: string;
  reason: string;
  threats: ThreatMatch[];
  quarantinedAt: number;
  sourcePeer?: string;
  released: boolean;
}

// ── Brain Types ────────────────────────────────────────────────────────────────

export interface LocalModel {
  id: string;
  name: string;
  sizeMB: number;
  quantization: string;
  parameters: string; // e.g., "1.5B"
  downloaded: boolean;
  downloadProgress: number;
  filePath?: string;
  hash?: string;
}

export interface InferenceRequest {
  id: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  context?: string[];
}

export interface InferenceResponse {
  id: string;
  text: string;
  tokensGenerated: number;
  durationMs: number;
  model: string;
  routedTo: 'local' | 'server';
}

export interface BrainRoutingDecision {
  target: 'local' | 'server';
  reason: string;
  complexity: number; // 0.0 - 1.0
  localCapable: boolean;
}

// ── Broadcast Types ────────────────────────────────────────────────────────────

export interface BroadcastConfig {
  fmEnabled: boolean;
  dabEnabled: boolean;
  bridgeModeEnabled: boolean;
  internetBridgeEnabled: boolean;
}

export interface BroadcastDTU {
  dtu: DTU;
  source: 'fm' | 'dab' | 'internet';
  receivedAt: number;
  signalStrength: number;
}

// ── Heartbeat Types ────────────────────────────────────────────────────────────

export interface HeartbeatState {
  tickCount: number;
  lastTickAt: number;
  intervalMs: number;
  batteryLevel: number;
  meshHealthSnapshot: MeshHealth;
  foundationReadingsCount: number;
  relayQueueProcessed: number;
}

// ── Hardware Capabilities ──────────────────────────────────────────────────────

export interface HardwareCapabilities {
  bluetooth: boolean;
  bluetoothLE: boolean;
  wifiDirect: boolean;
  nfc: boolean;
  gps: boolean;
  barometer: boolean;
  magnetometer: boolean;
  accelerometer: boolean;
  gyroscope: boolean;
  ambientLight: boolean;
  fmRadio: boolean;
  secureEnclave: boolean;
  totalRAMGB: number;
  availableStorageGB: number;
  cpuCores: number;
  platform: 'ios' | 'android';
  osVersion: string;
}

// ── App State ──────────────────────────────────────────────────────────────────

export type ConnectionState = 'online' | 'mesh-only' | 'offline';

export interface AppState {
  connection: ConnectionState;
  identity: DeviceIdentity | null;
  hardware: HardwareCapabilities | null;
  heartbeat: HeartbeatState;
  mesh: MeshState;
  balance: CoinBalance;
}
