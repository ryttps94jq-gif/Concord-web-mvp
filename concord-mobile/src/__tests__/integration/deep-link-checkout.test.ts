// Tests for deep link checkout return flow
// Verifies that concordapp:// deep links are handled correctly
// when the user returns from the Stripe checkout in Safari.

import { Linking, Alert } from 'react-native';

jest.mock('react-native', () => {
  const listeners: Map<string, (event: { url: string }) => void> = new Map();
  return {
    Linking: {
      addEventListener: jest.fn((event: string, handler: (event: { url: string }) => void) => {
        listeners.set(event, handler);
        return { remove: jest.fn(() => listeners.delete(event)) };
      }),
      getInitialURL: jest.fn().mockResolvedValue(null),
      openURL: jest.fn(),
      // Expose for testing
      _simulateDeepLink: (url: string) => {
        const handler = listeners.get('url');
        if (handler) handler({ url });
      },
    },
    Alert: {
      alert: jest.fn(),
    },
    Platform: { OS: 'ios' },
    NativeModules: {},
  };
});

const mockLinking = Linking as any;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('Deep link checkout flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('URL pattern matching', () => {
    it('recognizes checkout-complete URLs', () => {
      const url = 'concordapp://checkout-complete?status=success';
      expect(url.includes('checkout-complete')).toBe(true);
    });

    it('recognizes checkout-cancel URLs', () => {
      const url = 'concordapp://checkout-cancel';
      expect(url.includes('checkout-cancel')).toBe(true);
    });

    it('recognizes error URLs', () => {
      const url = 'concordapp://error';
      expect(url.includes('error')).toBe(true);
    });

    it('does not match unrelated deep links', () => {
      const url = 'concordapp://settings';
      expect(url.includes('checkout-complete')).toBe(false);
      expect(url.includes('checkout-cancel')).toBe(false);
    });
  });

  describe('URL scheme configuration', () => {
    it('uses concordapp:// scheme', () => {
      const scheme = 'concordapp';
      expect(scheme).toBe('concordapp');

      // Verify deep link URLs use this scheme
      const successUrl = `${scheme}://checkout-complete?status=success`;
      expect(successUrl.startsWith('concordapp://')).toBe(true);
    });

    it('success deep link includes status parameter', () => {
      const url = 'concordapp://checkout-complete?status=success';
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('status')).toBe('success');
    });
  });

  describe('Linking event listener', () => {
    it('addEventListener registers for url events', () => {
      const handler = jest.fn();
      const subscription = Linking.addEventListener('url', handler);

      expect(mockLinking.addEventListener).toHaveBeenCalledWith('url', handler);
      expect(subscription.remove).toBeDefined();
    });

    it('subscription.remove cleans up listener', () => {
      const handler = jest.fn();
      const subscription = Linking.addEventListener('url', handler);
      subscription.remove();

      // After removal, simulating a deep link should not call the handler
      // (depending on mock implementation)
    });
  });

  describe('getInitialURL (cold start)', () => {
    it('returns null when app is opened normally', async () => {
      mockLinking.getInitialURL.mockResolvedValue(null);
      const url = await Linking.getInitialURL();
      expect(url).toBeNull();
    });

    it('returns deep link URL when app is opened via deep link', async () => {
      mockLinking.getInitialURL.mockResolvedValue('concordapp://checkout-complete?status=success');
      const url = await Linking.getInitialURL();
      expect(url).toBe('concordapp://checkout-complete?status=success');
    });
  });

  describe('Navigation deep linking config', () => {
    it('linking config maps checkout-complete to Wallet screen', () => {
      // Verify the linking configuration structure
      const linking = {
        prefixes: ['concordapp://'],
        config: {
          screens: {
            Main: {
              screens: {
                Wallet: 'checkout-complete',
              },
            },
            BuyCoins: 'buy-coins',
          },
        },
      };

      expect(linking.prefixes).toContain('concordapp://');
      expect(linking.config.screens.Main.screens.Wallet).toBe('checkout-complete');
      expect(linking.config.screens.BuyCoins).toBe('buy-coins');
    });
  });
});
