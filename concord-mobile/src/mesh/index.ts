// Concord Mobile — Mesh Module Barrel Export

// bluetooth/mesh-controller
export {
  createMeshController,
} from './bluetooth/mesh-controller';
export type {
  MeshControllerDeps,
  MeshController,
} from './bluetooth/mesh-controller';

// bluetooth/ble-advertiser
export {
  createBLEAdvertiser,
} from './bluetooth/ble-advertiser';
export type {
  BLEManager,
  BLEDevice,
  BLECharacteristic,
  BLECharacteristicConfig,
  BLEAdvertiser,
} from './bluetooth/ble-advertiser';

// bluetooth/ble-scanner
export {
  createBLEScanner,
} from './bluetooth/ble-scanner';
export type {
  ScanOptions,
  BLEScanner,
} from './bluetooth/ble-scanner';

// bluetooth/ble-transfer
export {
  serializeDTU,
  deserializeDTU,
  chunkData,
  reassembleChunks,
  serializeChunk,
  deserializeChunk,
  createBLETransfer,
} from './bluetooth/ble-transfer';
export type {
  TransferResult,
  BLETransfer,
} from './bluetooth/ble-transfer';

// wifi-direct/wifi-direct-manager
export {
  encodeDataForTransport,
  decodeDataFromTransport,
  createWiFiDirectManager,
} from './wifi-direct/wifi-direct-manager';
export type {
  WiFiP2PModule,
  WiFiP2PPeer,
  WiFiP2PInfo,
  WiFiP2PGroupInfo,
  BatteryInfo,
  WiFiDirectManager,
} from './wifi-direct/wifi-direct-manager';

// wifi-direct/lattice-sync
export {
  buildMerkleRoot,
  serializeSyncMessage,
  deserializeSyncMessage,
  serializeDTUForSync,
  deserializeDTUFromSync,
  createLatticeSync,
} from './wifi-direct/lattice-sync';
export type {
  LatticeSyncResult,
  LatticeSync,
} from './wifi-direct/lattice-sync';

// nfc/nfc-transfer
export {
  serializeDTUForNFC,
  deserializeDTUFromNFC,
  createNFCTransfer,
} from './nfc/nfc-transfer';
export type {
  NFCManagerModule,
  NFCTag,
  NFCNdefRecord,
  NFCTransfer,
} from './nfc/nfc-transfer';

// lora/lora-bridge
export {
  LORA_PRIORITY,
  compressDTUForLoRa,
  getCompressedSize,
  getDTUPriority,
  createLoRaBridge,
} from './lora/lora-bridge';
export type {
  LoRaBridge,
} from './lora/lora-bridge';

// rf/audio-codec
export {
  applyFEC,
  decodeFEC,
  encodeAFSK,
  decodeAFSK,
  createAudioCodec,
} from './rf/audio-codec';
export type {
  AudioCodec,
} from './rf/audio-codec';

// rf/rf-layer
export {
  serializeDTUForRF,
  deserializeDTUFromRF,
  createRFLayer,
} from './rf/rf-layer';
export type {
  RFLayer,
} from './rf/rf-layer';

// telephone/telephone-layer
export {
  serializeDTUForPhone,
  deserializeDTUFromPhone,
  createTelephoneLayer,
} from './telephone/telephone-layer';
export type {
  TelephoneLayer,
} from './telephone/telephone-layer';

// transport/relay
export {
  RELAY_PRIORITY,
  createRelayEngine,
} from './transport/relay';
export type {
  RelayResult,
  RelayQueueStats,
  RelayOptions,
  RelayEngine,
} from './transport/relay';

// transport/peer-manager
export {
  calculateReputationScore,
  calculatePeerScore,
  createPeerManager,
} from './transport/peer-manager';
export type {
  PeerManager,
} from './transport/peer-manager';

// transport/transport-selector
export {
  createTransportSelector,
} from './transport/transport-selector';
export type {
  TransportSelector,
} from './transport/transport-selector';
