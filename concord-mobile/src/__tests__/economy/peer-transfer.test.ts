// Tests for Peer Transfer — signed P2P coin transfers

import { createPeerTransfer } from '../../economy/coin/peer-transfer';
import type { PeerTransfer, IdentityManager } from '../../economy/coin/peer-transfer';
import type { LocalLedger } from '../../economy/wallet/local-ledger';
import type { Transaction, TransactionType, CoinBalance } from '../../utils/types';
import {
  MIN_TRANSFER_AMOUNT,
  MAX_OFFLINE_TRANSFER_AMOUNT,
  TRANSACTION_NONCE_BYTES,
} from '../../utils/constants';

// ── Mock Identity Manager ────────────────────────────────────────────────────

function createMockIdentity(publicKey: string = 'sender_pub_key'): IdentityManager {
  return {
    getPublicKey: jest.fn(() => publicKey),
    sign: jest.fn(async (data: Uint8Array) => {
      // Mock signature: hash of data
      const sig = new Uint8Array(64);
      for (let i = 0; i < Math.min(data.length, 64); i++) {
        sig[i] = data[i] ^ 0xAA;
      }
      return sig;
    }),
    verify: jest.fn(async (_data: Uint8Array, _signature: Uint8Array, _publicKey: string) => {
      return true; // Default: signatures valid
    }),
  };
}

// ── Mock Ledger ──────────────────────────────────────────────────────────────

function createMockLedger(balance: Partial<CoinBalance> = {}): LocalLedger {
  const transactions: Transaction[] = [];

  const defaultBalance: CoinBalance = {
    available: 100,
    pending: 0,
    total: 100,
    lastUpdated: Date.now(),
    ...balance,
  };

  return {
    recordTransaction: jest.fn(async (tx: Transaction) => {
      transactions.push(tx);
    }),
    getBalance: jest.fn(async () => defaultBalance),
    getTransactions: jest.fn(async (_limit?: number, _type?: TransactionType) => {
      return transactions;
    }),
    getTransaction: jest.fn(async (id: string) => {
      return transactions.find(tx => tx.id === id);
    }),
    getPendingTransactions: jest.fn(async () => {
      return transactions.filter(tx => tx.status === 'pending');
    }),
    markPropagated: jest.fn(async () => {}),
    getUnpropagated: jest.fn(async () => []),
    verifyBalance: jest.fn(async () => ({ valid: true, computed: 100, stored: 100 })),
  };
}

// ── Helper ───────────────────────────────────────────────────────────────────

function makeValidTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_valid',
    type: 'transfer',
    amount: 10,
    fromKey: 'sender_pub_key',
    toKey: 'receiver_pub_key',
    timestamp: Date.now(),
    nonce: new Uint8Array(TRANSACTION_NONCE_BYTES).fill(0x01),
    balanceHash: 'balance_hash_001',
    signature: new Uint8Array(64).fill(0x02),
    status: 'pending',
    propagated: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PeerTransfer', () => {
  let identity: IdentityManager;
  let ledger: LocalLedger;
  let transfer: PeerTransfer;

  beforeEach(() => {
    identity = createMockIdentity();
    ledger = createMockLedger();
    transfer = createPeerTransfer(identity, ledger);
  });

  // ── createTransfer ──────────────────────────────────────────────────────

  describe('createTransfer', () => {
    it('creates a valid transfer transaction', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(tx).toBeDefined();
      expect(tx.type).toBe('transfer');
      expect(tx.amount).toBe(10);
      expect(tx.toKey).toBe('receiver_key');
      expect(tx.fromKey).toBe('sender_pub_key');
    });

    it('sets status to pending', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(tx.status).toBe('pending');
    });

    it('sets propagated to false', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(tx.propagated).toBe(false);
    });

    it('generates a unique transaction ID', async () => {
      const tx1 = await transfer.createTransfer('receiver_key', 10);
      const tx2 = await transfer.createTransfer('receiver_key', 10);
      expect(tx1.id).not.toBe(tx2.id);
    });

    it('generates a nonce of TRANSACTION_NONCE_BYTES length', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(tx.nonce).toBeInstanceOf(Uint8Array);
      expect(tx.nonce.length).toBe(TRANSACTION_NONCE_BYTES);
    });

    it('signs the transaction with identity key', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(identity.sign).toHaveBeenCalled();
      expect(tx.signature).toBeInstanceOf(Uint8Array);
      expect(tx.signature.length).toBe(64);
    });

    it('records the transaction in the ledger', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(ledger.recordTransaction).toHaveBeenCalledWith(tx);
    });

    it('generates a balance hash', async () => {
      const tx = await transfer.createTransfer('receiver_key', 10);
      expect(tx.balanceHash).toBeDefined();
      expect(typeof tx.balanceHash).toBe('string');
      expect(tx.balanceHash.length).toBeGreaterThan(0);
    });

    it('sets timestamp to current time', async () => {
      const before = Date.now();
      const tx = await transfer.createTransfer('receiver_key', 10);
      const after = Date.now();
      expect(tx.timestamp).toBeGreaterThanOrEqual(before);
      expect(tx.timestamp).toBeLessThanOrEqual(after);
    });

    // Rejection cases

    it('rejects amount below MIN_TRANSFER_AMOUNT', async () => {
      await expect(
        transfer.createTransfer('receiver_key', MIN_TRANSFER_AMOUNT / 10)
      ).rejects.toThrow(/below minimum/);
    });

    it('rejects amount above MAX_OFFLINE_TRANSFER_AMOUNT', async () => {
      await expect(
        transfer.createTransfer('receiver_key', MAX_OFFLINE_TRANSFER_AMOUNT + 1)
      ).rejects.toThrow(/exceeds offline maximum/);
    });

    it('rejects insufficient funds', async () => {
      ledger = createMockLedger({ available: 5 });
      transfer = createPeerTransfer(identity, ledger);
      await expect(
        transfer.createTransfer('receiver_key', 10)
      ).rejects.toThrow(/Insufficient funds/);
    });

    it('rejects transfer to self', async () => {
      await expect(
        transfer.createTransfer('sender_pub_key', 10)
      ).rejects.toThrow(/Cannot transfer to self/);
    });

    it('rounds amount to COIN_DECIMALS precision', async () => {
      const tx = await transfer.createTransfer('receiver_key', 1.123456789123);
      // Should be rounded to 8 decimal places
      expect(tx.amount).toBe(1.12345679);
    });

    it('accepts exactly MIN_TRANSFER_AMOUNT', async () => {
      const tx = await transfer.createTransfer('receiver_key', MIN_TRANSFER_AMOUNT);
      expect(tx.amount).toBe(MIN_TRANSFER_AMOUNT);
    });

    it('accepts exactly MAX_OFFLINE_TRANSFER_AMOUNT', async () => {
      const tx = await transfer.createTransfer('receiver_key', MAX_OFFLINE_TRANSFER_AMOUNT);
      expect(tx.amount).toBe(MAX_OFFLINE_TRANSFER_AMOUNT);
    });
  });

  // ── receiveTransfer ─────────────────────────────────────────────────────

  describe('receiveTransfer', () => {
    it('accepts a valid transfer', async () => {
      const result = await transfer.receiveTransfer(makeValidTx());
      expect(result.accepted).toBe(true);
    });

    it('records confirmed transaction in ledger', async () => {
      await transfer.receiveTransfer(makeValidTx());
      expect(ledger.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'confirmed' })
      );
    });

    it('rejects invalid signature', async () => {
      (identity.verify as jest.Mock).mockResolvedValueOnce(false);
      const result = await transfer.receiveTransfer(makeValidTx());
      expect(result.accepted).toBe(false);
      expect(result.reason).toContain('Invalid signature');
    });

    it('rejects structurally invalid transaction', async () => {
      const invalidTx = makeValidTx({ amount: -1 });
      const result = await transfer.receiveTransfer(invalidTx);
      expect(result.accepted).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('rejects double-spend (duplicate ID)', async () => {
      // First receive
      await transfer.receiveTransfer(makeValidTx({ id: 'dup_tx' }));
      // Second receive with same ID
      const result = await transfer.receiveTransfer(makeValidTx({ id: 'dup_tx' }));
      expect(result.accepted).toBe(false);
      expect(result.reason).toContain('Double-spend');
    });

    it('verifies signature using sender public key', async () => {
      await transfer.receiveTransfer(makeValidTx({ fromKey: 'specific_key' }));
      expect(identity.verify).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        expect.any(Uint8Array),
        'specific_key'
      );
    });
  });

  // ── validateTransfer ────────────────────────────────────────────────────

  describe('validateTransfer', () => {
    it('validates a correct transfer', () => {
      const result = transfer.validateTransfer(makeValidTx());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing transaction ID', () => {
      const result = transfer.validateTransfer(makeValidTx({ id: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Missing or invalid transaction ID/),
      ]));
    });

    it('rejects invalid transaction type', () => {
      const result = transfer.validateTransfer(makeValidTx({ type: 'reward' as TransactionType }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Invalid transaction type/),
      ]));
    });

    it('accepts marketplace_purchase type', () => {
      const result = transfer.validateTransfer(makeValidTx({ type: 'marketplace_purchase' }));
      expect(result.valid).toBe(true);
    });

    it('rejects NaN amount', () => {
      const result = transfer.validateTransfer(makeValidTx({ amount: NaN }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/valid number/),
      ]));
    });

    it('rejects amount below minimum', () => {
      const result = transfer.validateTransfer(makeValidTx({ amount: 0 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/below minimum/),
      ]));
    });

    it('rejects amount above maximum', () => {
      const result = transfer.validateTransfer(
        makeValidTx({ amount: MAX_OFFLINE_TRANSFER_AMOUNT + 1 })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/exceeds offline maximum/),
      ]));
    });

    it('rejects missing sender key', () => {
      const result = transfer.validateTransfer(makeValidTx({ fromKey: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Missing sender/),
      ]));
    });

    it('rejects missing recipient key', () => {
      const result = transfer.validateTransfer(makeValidTx({ toKey: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Missing recipient/),
      ]));
    });

    it('rejects sender equals recipient', () => {
      const result = transfer.validateTransfer(
        makeValidTx({ fromKey: 'same', toKey: 'same' })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/cannot be the same/),
      ]));
    });

    it('rejects invalid timestamp', () => {
      const result = transfer.validateTransfer(makeValidTx({ timestamp: -1 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Invalid timestamp/),
      ]));
    });

    it('rejects future timestamp beyond 5 minutes', () => {
      const futureTs = Date.now() + 10 * 60 * 1000; // 10 minutes ahead
      const result = transfer.validateTransfer(makeValidTx({ timestamp: futureTs }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/too far in the future/),
      ]));
    });

    it('rejects wrong nonce length', () => {
      const result = transfer.validateTransfer(
        makeValidTx({ nonce: new Uint8Array(8) })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Nonce must be/),
      ]));
    });

    it('rejects missing balance hash', () => {
      const result = transfer.validateTransfer(makeValidTx({ balanceHash: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Missing balance hash/),
      ]));
    });

    it('rejects empty signature', () => {
      const result = transfer.validateTransfer(makeValidTx({ signature: new Uint8Array(0) }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringMatching(/Missing or empty signature/),
      ]));
    });

    it('collects multiple errors', () => {
      const result = transfer.validateTransfer(makeValidTx({
        id: '',
        amount: -1,
        fromKey: '',
        toKey: '',
        timestamp: -1,
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  // ── checkDoubleSpend ────────────────────────────────────────────────────

  describe('checkDoubleSpend', () => {
    it('detects duplicate transaction ID', async () => {
      // Record a transaction first
      await ledger.recordTransaction(makeValidTx({ id: 'dup_id' }));
      const isDouble = await transfer.checkDoubleSpend(
        makeValidTx({ id: 'dup_id' }),
        ledger
      );
      expect(isDouble).toBe(true);
    });

    it('detects same balance hash from same sender (different ID)', async () => {
      await ledger.recordTransaction(makeValidTx({
        id: 'tx_a',
        fromKey: 'sender_key',
        balanceHash: 'shared_hash',
      }));
      const isDouble = await transfer.checkDoubleSpend(
        makeValidTx({
          id: 'tx_b',
          fromKey: 'sender_key',
          balanceHash: 'shared_hash',
        }),
        ledger
      );
      expect(isDouble).toBe(true);
    });

    it('returns false for legitimate new transaction', async () => {
      const isDouble = await transfer.checkDoubleSpend(
        makeValidTx({ id: 'brand_new', balanceHash: 'unique_hash' }),
        ledger
      );
      expect(isDouble).toBe(false);
    });

    it('allows same balance hash from different senders', async () => {
      await ledger.recordTransaction(makeValidTx({
        id: 'tx_c',
        fromKey: 'sender_a',
        balanceHash: 'hash_x',
      }));
      const isDouble = await transfer.checkDoubleSpend(
        makeValidTx({
          id: 'tx_d',
          fromKey: 'sender_b',
          balanceHash: 'hash_x',
        }),
        ledger
      );
      expect(isDouble).toBe(false);
    });
  });
});
