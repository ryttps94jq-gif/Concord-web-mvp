// Concord Mobile — Broadcast Module Barrel Export

// bridge/broadcast-bridge
export {
  createBroadcastBridge,
  verifyDTUIntegrity,
  DEFAULT_CONFIG,
} from './bridge/broadcast-bridge';
export type {
  MeshController as BroadcastMeshController,
  DTUStore as BroadcastDTUStore,
  BroadcastBridge,
} from './bridge/broadcast-bridge';

// fm/fm-receiver
export {
  createFMReceiver,
  SUBCARRIER_FREQUENCY,
  SAMPLE_RATE,
  PREAMBLE_SEQUENCE,
  SYMBOL_RATE,
  SAMPLES_PER_SYMBOL,
  MIN_SIGNAL_THRESHOLD,
  crc16,
  bitsToBytes,
  findPreamble,
  demodulateDBPSK,
} from './fm/fm-receiver';
export type {
  FMRadioModule,
  FMReceiver,
} from './fm/fm-receiver';
