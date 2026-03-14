// Tests for BuyCoinsScreen component

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

// Mock dependencies before importing the component
jest.mock('../../hooks/useExternalPurchase', () => ({
  openExternalPurchase: jest.fn(),
}));

jest.mock('../../hooks/useWallet', () => ({
  useWallet: jest.fn(),
}));

jest.mock('../../store/identity-store', () => ({
  useIdentityStore: jest.fn(),
}));

jest.mock('../../utils/constants', () => ({
  COIN_DECIMALS: 2,
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

import { BuyCoinsScreen } from '../../surface/screens/BuyCoinsScreen';
import { openExternalPurchase } from '../../hooks/useExternalPurchase';
import { useWallet } from '../../hooks/useWallet';
import { useIdentityStore } from '../../store/identity-store';
import { Alert } from 'react-native';

const mockOpenExternalPurchase = openExternalPurchase as jest.MockedFunction<typeof openExternalPurchase>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseIdentityStore = useIdentityStore as unknown as jest.MockedFunction<any>;

function setupMocks(overrides: {
  balance?: number;
  identity?: { publicKey: string } | null;
} = {}) {
  const walletState = {
    balance: {
      available: overrides.balance ?? 100,
      pending: 0,
      total: overrides.balance ?? 100,
      lastUpdated: Date.now(),
    },
    transactions: [],
    pendingCount: 0,
    unpropagatedCount: 0,
    getTransactionsByType: jest.fn(() => []),
  };
  mockUseWallet.mockReturnValue(walletState);

  const identity = overrides.identity !== undefined
    ? overrides.identity
    : { publicKey: 'pk_test_user_123', linkedDevices: [] };

  mockUseIdentityStore.mockImplementation((selector: (s: any) => any) => {
    return selector({ identity });
  });

  mockOpenExternalPurchase.mockResolvedValue(undefined);
}

describe('BuyCoinsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders the title', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    expect(getByText('Buy Concord Coins')).toBeTruthy();
  });

  it('displays current balance', () => {
    setupMocks({ balance: 42.5 });
    const { getByText } = render(<BuyCoinsScreen />);
    expect(getByText(/42\.5 CC/)).toBeTruthy();
  });

  it('displays exchange rate', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    expect(getByText('1 Coin = $1.00 USD')).toBeTruthy();
  });

  it('renders all amount options', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    expect(getByText('$5')).toBeTruthy();
    expect(getByText('$10')).toBeTruthy();
    expect(getByText('$25')).toBeTruthy();
    expect(getByText('$50')).toBeTruthy();
    expect(getByText('$100')).toBeTruthy();
    expect(getByText('$500')).toBeTruthy();
  });

  it('displays App Store disclosure text', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    expect(getByText(/processed outside the App Store/)).toBeTruthy();
  });

  it('buy button shows dash when no amount selected', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    // Default text shows em-dash when no amount selected
    expect(getByText('Buy \u2014 Coins')).toBeTruthy();
  });

  it('selecting an amount enables the buy button', () => {
    const { getByText } = render(<BuyCoinsScreen />);
    fireEvent.press(getByText('$25'));
    expect(getByText('Buy 25 Coins')).toBeTruthy();
  });

  it('calls openExternalPurchase when buy button is pressed', async () => {
    const { getByText } = render(<BuyCoinsScreen />);
    fireEvent.press(getByText('$50'));
    fireEvent.press(getByText('Buy 50 Coins'));

    await waitFor(() => {
      expect(mockOpenExternalPurchase).toHaveBeenCalledWith({
        userId: 'pk_test_user_123',
        amount: 50,
        authToken: 'pk_test_user_123',
      });
    });
  });

  it('shows alert on purchase error', async () => {
    const error = new Error('Network error');
    (error as any).code = 'NETWORK_ERROR';
    mockOpenExternalPurchase.mockRejectedValue(error);

    const { getByText } = render(<BuyCoinsScreen />);
    fireEvent.press(getByText('$10'));
    fireEvent.press(getByText('Buy 10 Coins'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Purchase Error',
        'Unable to open checkout. Please try again.'
      );
    });
  });

  it('does not show alert when user cancels', async () => {
    const cancelError = new Error('Cancelled');
    (cancelError as any).code = 'USER_CANCELLED';
    mockOpenExternalPurchase.mockRejectedValue(cancelError);

    const { getByText } = render(<BuyCoinsScreen />);
    fireEvent.press(getByText('$10'));
    fireEvent.press(getByText('Buy 10 Coins'));

    await waitFor(() => {
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  it('shows loading text while purchase is in progress', async () => {
    // Make the purchase take time
    mockOpenExternalPurchase.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    const { getByText } = render(<BuyCoinsScreen />);
    fireEvent.press(getByText('$25'));
    fireEvent.press(getByText('Buy 25 Coins'));

    expect(getByText('Opening checkout...')).toBeTruthy();
  });

  it('renders coin amounts under price buttons', () => {
    const { getAllByText } = render(<BuyCoinsScreen />);
    const coinLabels = getAllByText(/\d+ coins/);
    expect(coinLabels.length).toBe(6); // One for each amount option
  });
});
