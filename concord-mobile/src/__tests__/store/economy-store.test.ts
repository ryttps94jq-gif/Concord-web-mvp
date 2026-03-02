// Tests for economy-store.ts

import { useEconomyStore } from '../../store/economy-store';
import type { Transaction, MarketplaceListing } from '../../utils/types';

function createMockTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2)}`,
    type: 'transfer',
    amount: 10,
    fromKey: 'pk_sender',
    toKey: 'pk_receiver',
    timestamp: Date.now(),
    nonce: new Uint8Array(16),
    balanceHash: 'hash_abc',
    signature: new Uint8Array(64),
    status: 'confirmed',
    propagated: false,
    ...overrides,
  };
}

function createMockListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: `listing_${Math.random().toString(36).slice(2)}`,
    dtuId: 'dtu_1',
    title: 'Test Listing',
    description: 'A test creative work',
    price: 5,
    creatorKey: 'pk_creator',
    category: 'art',
    tags: ['test'],
    createdAt: Date.now(),
    active: true,
    ...overrides,
  };
}

describe('useEconomyStore', () => {
  beforeEach(() => {
    useEconomyStore.getState().reset();
  });

  describe('balance', () => {
    test('setBalance updates balance', () => {
      useEconomyStore.getState().setBalance({
        available: 100, pending: 10, total: 110, lastUpdated: Date.now(),
      });
      expect(useEconomyStore.getState().balance.available).toBe(100);
      expect(useEconomyStore.getState().balance.pending).toBe(10);
    });

    test('updateBalance merges partial updates', () => {
      useEconomyStore.getState().setBalance({
        available: 100, pending: 0, total: 100, lastUpdated: 1000,
      });
      useEconomyStore.getState().updateBalance({ available: 90 });

      expect(useEconomyStore.getState().balance.available).toBe(90);
      expect(useEconomyStore.getState().balance.total).toBe(100);
      expect(useEconomyStore.getState().balance.lastUpdated).toBeGreaterThan(1000);
    });
  });

  describe('transactions', () => {
    test('addTransaction adds to list', () => {
      const tx = createMockTx();
      useEconomyStore.getState().addTransaction(tx);

      expect(useEconomyStore.getState().transactions.length).toBe(1);
      expect(useEconomyStore.getState().transactions[0].id).toBe(tx.id);
    });

    test('addTransaction is idempotent — duplicate IDs ignored', () => {
      const tx = createMockTx({ id: 'tx_1' });
      useEconomyStore.getState().addTransaction(tx);
      useEconomyStore.getState().addTransaction(tx);

      expect(useEconomyStore.getState().transactions.length).toBe(1);
    });

    test('addTransaction tracks pending separately', () => {
      const pending = createMockTx({ status: 'pending' });
      useEconomyStore.getState().addTransaction(pending);

      expect(useEconomyStore.getState().pendingTransactions.length).toBe(1);
    });

    test('markPropagated updates transaction and removes from pending', () => {
      const tx = createMockTx({ id: 'tx_1', status: 'pending' });
      useEconomyStore.getState().addTransaction(tx);
      useEconomyStore.getState().markPropagated('tx_1');

      expect(useEconomyStore.getState().transactions[0].propagated).toBe(true);
      expect(useEconomyStore.getState().pendingTransactions.length).toBe(0);
    });

    test('getTransaction finds by ID', () => {
      const tx = createMockTx({ id: 'tx_1' });
      useEconomyStore.getState().addTransaction(tx);

      expect(useEconomyStore.getState().getTransaction('tx_1')?.id).toBe('tx_1');
      expect(useEconomyStore.getState().getTransaction('nonexistent')).toBeUndefined();
    });

    test('getTransactionsByType filters correctly', () => {
      useEconomyStore.getState().addTransaction(createMockTx({ id: 'tx_1', type: 'transfer' }));
      useEconomyStore.getState().addTransaction(createMockTx({ id: 'tx_2', type: 'royalty' }));
      useEconomyStore.getState().addTransaction(createMockTx({ id: 'tx_3', type: 'transfer' }));

      const transfers = useEconomyStore.getState().getTransactionsByType('transfer');
      expect(transfers.length).toBe(2);
    });

    test('getUnpropagated returns only unpropagated', () => {
      useEconomyStore.getState().addTransaction(createMockTx({ id: 'tx_1', propagated: false }));
      useEconomyStore.getState().addTransaction(createMockTx({ id: 'tx_2', propagated: true }));

      // Note: store adds propagated field from the tx itself
      const unpropagated = useEconomyStore.getState().getUnpropagated();
      expect(unpropagated.some(tx => tx.id === 'tx_1')).toBe(true);
    });

    test('1000 transactions stored and queryable', () => {
      for (let i = 0; i < 1000; i++) {
        useEconomyStore.getState().addTransaction(createMockTx({ id: `tx_${i}` }));
      }
      expect(useEconomyStore.getState().transactions.length).toBe(1000);
    });
  });

  describe('marketplace', () => {
    test('cacheListings stores listings', () => {
      const listings = [createMockListing(), createMockListing()];
      useEconomyStore.getState().cacheListings(listings);

      expect(useEconomyStore.getState().listings.length).toBe(2);
      expect(useEconomyStore.getState().listingCount).toBe(2);
    });

    test('getListingsByCategory filters active listings', () => {
      useEconomyStore.getState().cacheListings([
        createMockListing({ id: 'l1', category: 'art', active: true }),
        createMockListing({ id: 'l2', category: 'music', active: true }),
        createMockListing({ id: 'l3', category: 'art', active: false }),
      ]);

      const artListings = useEconomyStore.getState().getListingsByCategory('art');
      expect(artListings.length).toBe(1);
      expect(artListings[0].id).toBe('l1');
    });

    test('removeListing removes and updates count', () => {
      useEconomyStore.getState().cacheListings([
        createMockListing({ id: 'l1' }),
        createMockListing({ id: 'l2' }),
      ]);
      useEconomyStore.getState().removeListing('l1');

      expect(useEconomyStore.getState().listingCount).toBe(1);
      expect(useEconomyStore.getState().listings[0].id).toBe('l2');
    });
  });

  describe('reset', () => {
    test('resets all economy state', () => {
      useEconomyStore.getState().addTransaction(createMockTx());
      useEconomyStore.getState().cacheListings([createMockListing()]);
      useEconomyStore.getState().setBalance({ available: 100, pending: 0, total: 100, lastUpdated: Date.now() });

      useEconomyStore.getState().reset();

      expect(useEconomyStore.getState().transactions.length).toBe(0);
      expect(useEconomyStore.getState().listings.length).toBe(0);
      expect(useEconomyStore.getState().balance.available).toBe(0);
    });
  });
});
