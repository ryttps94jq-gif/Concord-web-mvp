// Concord Mobile — Peer-to-Peer Coin Transfer
// Transfers Concord Coins between devices over mesh network.
// Signed with sender's Ed25519 key, validated by receiver.

import {
  MIN_TRANSFER_AMOUNT,
  MAX_OFFLINE_TRANSFER_AMOUNT,
  TRANSACTION_NONCE_BYTES,
  COIN_DECIMALS,
} from '../../utils/constants';
import { generateId, toHex, randomBytes } from '../../utils/crypto';
import type { Transaction } from '../../utils/types';
import type { LocalLedger } from '../wallet/local-ledger';

// ── Identity Manager Interface ───────────────────────────────────────────────

export interface IdentityManager {
  getPublicKey(): string;
  sign(data: Uint8Array): Promise<Uint8Array>;
  verify(data: Uint8Array, signature: Uint8Array, publicKey: string): Promise<boolean>;
}

// ── Peer Transfer Interface ──────────────────────────────────────────────────

export interface PeerTransfer {
  createTransfer(toKey: string, amount: number): Promise<Transaction>;
  receiveTransfer(tx: Transaction): Promise<{ accepted: boolean; reason?: string }>;
  validateTransfer(tx: Transaction): { valid: boolean; errors: string[] };
  checkDoubleSpend(tx: Transaction, ledger: LocalLedger): Promise<boolean>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundCoin(value: number): number {
  const factor = Math.pow(10, COIN_DECIMALS);
  return Math.round(value * factor) / factor;
}

function encodeTransactionForSigning(tx: {
  id: string;
  type: string;
  amount: number;
  fromKey: string;
  toKey: string;
  timestamp: number;
  nonce: Uint8Array;
  balanceHash: string;
}): Uint8Array {
  const message = `${tx.id}:${tx.type}:${tx.amount}:${tx.fromKey}:${tx.toKey}:${tx.timestamp}:${toHex(tx.nonce)}:${tx.balanceHash}`;
  const encoder = new TextEncoder();
  return encoder.encode(message);
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createPeerTransfer(
  identity: IdentityManager,
  ledger: LocalLedger
): PeerTransfer {

  async function createTransfer(toKey: string, amount: number): Promise<Transaction> {
    // Validate amount
    if (amount < MIN_TRANSFER_AMOUNT) {
      throw new Error(`Transfer amount ${amount} below minimum ${MIN_TRANSFER_AMOUNT}`);
    }
    if (amount > MAX_OFFLINE_TRANSFER_AMOUNT) {
      throw new Error(`Transfer amount ${amount} exceeds offline maximum ${MAX_OFFLINE_TRANSFER_AMOUNT}`);
    }

    amount = roundCoin(amount);

    // Check sufficient funds
    const balance = await ledger.getBalance();
    if (balance.available < amount) {
      throw new Error(
        `Insufficient funds: available ${balance.available}, requested ${amount}`
      );
    }

    const fromKey = identity.getPublicKey();
    if (fromKey === toKey) {
      throw new Error('Cannot transfer to self');
    }

    const nonce = randomBytes(TRANSACTION_NONCE_BYTES);
    const timestamp = Date.now();
    const id = generateId('tx');

    // Balance hash: hash of current balance + nonce for double-spend prevention
    const balanceHashInput = `${balance.available}:${toHex(nonce)}`;
    const encoder = new TextEncoder();
    const balanceHash = toHex(encoder.encode(balanceHashInput).slice(0, 16));

    const txData = {
      id,
      type: 'transfer' as const,
      amount,
      fromKey,
      toKey,
      timestamp,
      nonce,
      balanceHash,
    };

    // Sign the transaction
    const messageBytes = encodeTransactionForSigning(txData);
    const signature = await identity.sign(messageBytes);

    const tx: Transaction = {
      ...txData,
      signature,
      status: 'pending',
      propagated: false,
    };

    // Record in local ledger
    await ledger.recordTransaction(tx);

    return tx;
  }

  async function receiveTransfer(tx: Transaction): Promise<{ accepted: boolean; reason?: string }> {
    // Validate structure
    const validation = validateTransfer(tx);
    if (!validation.valid) {
      return { accepted: false, reason: validation.errors.join('; ') };
    }

    // Verify signature
    const messageBytes = encodeTransactionForSigning(tx);
    const signatureValid = await identity.verify(messageBytes, tx.signature, tx.fromKey);
    if (!signatureValid) {
      return { accepted: false, reason: 'Invalid signature' };
    }

    // Check double-spend
    const isDoubleSpend = await checkDoubleSpend(tx, ledger);
    if (isDoubleSpend) {
      return { accepted: false, reason: 'Double-spend detected' };
    }

    // Record in local ledger (as confirmed for receiver)
    const confirmedTx: Transaction = {
      ...tx,
      status: 'confirmed',
      propagated: false,
    };
    await ledger.recordTransaction(confirmedTx);

    return { accepted: true };
  }

  function validateTransfer(tx: Transaction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tx.id || typeof tx.id !== 'string') {
      errors.push('Missing or invalid transaction ID');
    }

    if (tx.type !== 'transfer' && tx.type !== 'marketplace_purchase') {
      errors.push(`Invalid transaction type for transfer: ${tx.type}`);
    }

    if (typeof tx.amount !== 'number' || isNaN(tx.amount)) {
      errors.push('Amount must be a valid number');
    } else {
      if (tx.amount < MIN_TRANSFER_AMOUNT) {
        errors.push(`Amount ${tx.amount} below minimum ${MIN_TRANSFER_AMOUNT}`);
      }
      if (tx.amount > MAX_OFFLINE_TRANSFER_AMOUNT) {
        errors.push(`Amount ${tx.amount} exceeds offline maximum ${MAX_OFFLINE_TRANSFER_AMOUNT}`);
      }
    }

    if (!tx.fromKey || typeof tx.fromKey !== 'string') {
      errors.push('Missing sender public key');
    }

    if (!tx.toKey || typeof tx.toKey !== 'string') {
      errors.push('Missing recipient public key');
    }

    if (tx.fromKey && tx.toKey && tx.fromKey === tx.toKey) {
      errors.push('Sender and recipient cannot be the same');
    }

    if (typeof tx.timestamp !== 'number' || tx.timestamp <= 0) {
      errors.push('Invalid timestamp');
    } else {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      if (tx.timestamp > now + fiveMinutes) {
        errors.push('Transaction timestamp is too far in the future');
      }
    }

    if (!(tx.nonce instanceof Uint8Array) || tx.nonce.length !== TRANSACTION_NONCE_BYTES) {
      errors.push(`Nonce must be ${TRANSACTION_NONCE_BYTES} bytes`);
    }

    if (!tx.balanceHash || typeof tx.balanceHash !== 'string') {
      errors.push('Missing balance hash');
    }

    if (!(tx.signature instanceof Uint8Array) || tx.signature.length === 0) {
      errors.push('Missing or empty signature');
    }

    return { valid: errors.length === 0, errors };
  }

  async function checkDoubleSpend(tx: Transaction, targetLedger: LocalLedger): Promise<boolean> {
    // Check if we've already seen this transaction ID
    const existing = await targetLedger.getTransaction(tx.id);
    if (existing) {
      return true;
    }

    // Check if there's another transaction with the same nonce from the same sender
    const pending = await targetLedger.getPendingTransactions();
    const confirmed = await targetLedger.getTransactions(undefined, 'transfer');

    const allTxs = [...pending, ...confirmed];
    for (const existingTx of allTxs) {
      if (
        existingTx.fromKey === tx.fromKey &&
        existingTx.id !== tx.id &&
        existingTx.balanceHash === tx.balanceHash
      ) {
        // Same sender, different tx ID, but same balance hash = double-spend attempt
        return true;
      }
    }

    return false;
  }

  return {
    createTransfer,
    receiveTransfer,
    validateTransfer,
    checkDoubleSpend,
  };
}
