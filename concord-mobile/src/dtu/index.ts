// Concord Mobile — DTU Module Barrel Export

// creation/dtu-header
export {
  encodeHeader,
  decodeHeader,
  validateHeader,
} from './creation/dtu-header';

// creation/dtu-forge
export {
  createDTU,
  createFoundationDTU,
  createTransactionDTU,
  createThreatDTU,
} from './creation/dtu-forge';
export type { CreateDTUOptions } from './creation/dtu-forge';

// integrity/dtu-integrity
export {
  generateIntegrity,
  verifyIntegrity,
  verifyHeader,
  verifyContentHash,
  verifySignature,
} from './integrity/dtu-integrity';
export type {
  DTUIntegrityEnvelope,
  VerificationResult,
} from './integrity/dtu-integrity';

// compression/dtu-compression
export {
  COMPRESSION_ALGORITHMS,
  setCompressionProvider,
  getCompressionProvider,
  selectAlgorithm,
  compress,
  decompress,
} from './compression/dtu-compression';
export type {
  CompressionAlgorithm,
  CompressedContent,
  AlgorithmSelection,
  CompressionProvider,
} from './compression/dtu-compression';

// store/dtu-store
export {
  createDTUStore,
} from './store/dtu-store';
export type {
  SQLiteDatabase,
  DTUStore,
} from './store/dtu-store';

// search/dtu-search
export {
  tokenize,
  buildSearchIndex,
  computeRelevance,
  searchDTUs,
} from './search/dtu-search';
export type {
  SearchOptions,
  SearchIndex,
} from './search/dtu-search';

// genesis/genesis-sync
export {
  setFetchFunction,
  syncGenesisDTUs,
  verifyGenesisSet,
  isGenesisComplete,
} from './genesis/genesis-sync';
export type {
  GenesisSyncResult,
  GenesisVerification,
  FetchFunction,
} from './genesis/genesis-sync';
