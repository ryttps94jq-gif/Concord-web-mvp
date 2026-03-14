// Tests for useExternalPurchase hook

import { Platform, NativeModules, Linking } from 'react-native';
import { openExternalPurchase } from '../../hooks/useExternalPurchase';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: {
    ExternalPurchaseLink: {
      open: jest.fn(),
    },
  },
  Linking: {
    openURL: jest.fn(),
  },
}));

const mockExternalPurchaseLink = NativeModules.ExternalPurchaseLink as {
  open: jest.MockedFunction<(url: string) => Promise<boolean>>;
};

const mockLinking = Linking as unknown as {
  openURL: jest.MockedFunction<(url: string) => Promise<void>>;
};

// ── Test Data ────────────────────────────────────────────────────────────────

const validParams = {
  userId: 'user_123',
  amount: 25,
  authToken: 'jwt_test_token_abc',
};

describe('openExternalPurchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExternalPurchaseLink.open.mockResolvedValue(true);
    mockLinking.openURL.mockResolvedValue(undefined);
  });

  describe('iOS flow', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('calls ExternalPurchaseLink.open on iOS', async () => {
      await openExternalPurchase(validParams);

      expect(mockExternalPurchaseLink.open).toHaveBeenCalledTimes(1);
      expect(mockLinking.openURL).not.toHaveBeenCalled();
    });

    it('builds correct checkout URL with all params', async () => {
      await openExternalPurchase(validParams);

      const calledUrl = mockExternalPurchaseLink.open.mock.calls[0][0];
      expect(calledUrl).toContain('https://concord-os.org/checkout?');
      expect(calledUrl).toContain('source=ios_app');
      expect(calledUrl).toContain('userId=user_123');
      expect(calledUrl).toContain('amount=25');
      expect(calledUrl).toContain('token=jwt_test_token_abc');
    });

    it('silently returns when user cancels disclosure sheet', async () => {
      const cancelError = new Error('User cancelled');
      (cancelError as any).code = 'USER_CANCELLED';
      mockExternalPurchaseLink.open.mockRejectedValue(cancelError);

      // Should not throw
      await openExternalPurchase(validParams);
    });

    it('throws on non-cancel errors', async () => {
      const otherError = new Error('Network failed');
      (otherError as any).code = 'NETWORK_ERROR';
      mockExternalPurchaseLink.open.mockRejectedValue(otherError);

      await expect(openExternalPurchase(validParams)).rejects.toThrow('Network failed');
    });

    it('includes decimal amounts correctly', async () => {
      await openExternalPurchase({ ...validParams, amount: 9.99 });

      const calledUrl = mockExternalPurchaseLink.open.mock.calls[0][0];
      expect(calledUrl).toContain('amount=9.99');
    });
  });

  describe('Android flow', () => {
    beforeEach(() => {
      (Platform as any).OS = 'android';
    });

    it('uses Linking.openURL on Android', async () => {
      await openExternalPurchase(validParams);

      expect(mockLinking.openURL).toHaveBeenCalledTimes(1);
      expect(mockExternalPurchaseLink.open).not.toHaveBeenCalled();
    });

    it('builds correct checkout URL with android_app source', async () => {
      await openExternalPurchase(validParams);

      const calledUrl = mockLinking.openURL.mock.calls[0][0];
      expect(calledUrl).toContain('source=android_app');
      expect(calledUrl).toContain('userId=user_123');
      expect(calledUrl).toContain('amount=25');
    });
  });

  describe('URL construction', () => {
    beforeEach(() => {
      (Platform as any).OS = 'ios';
    });

    it('encodes special characters in userId', async () => {
      await openExternalPurchase({
        ...validParams,
        userId: 'user+special&chars=bad',
      });

      const calledUrl = mockExternalPurchaseLink.open.mock.calls[0][0];
      // URLSearchParams should encode special chars
      expect(calledUrl).not.toContain('&chars=');
      expect(calledUrl).toContain('userId=user');
    });

    it('uses concord-os.org as base URL', async () => {
      await openExternalPurchase(validParams);

      const calledUrl = mockExternalPurchaseLink.open.mock.calls[0][0];
      expect(calledUrl.startsWith('https://concord-os.org/checkout?')).toBe(true);
    });
  });
});
