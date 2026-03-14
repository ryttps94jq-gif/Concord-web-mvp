// Concord Mobile — External Purchase Hook
// Opens external payment checkout via Apple's StoreKit External Purchase Link API (iOS)
// or directly in the browser (Android). Bypasses Apple's 30% IAP commission.

import { NativeModules, Platform, Linking } from 'react-native';

const API_BASE = 'https://concord-os.org';

interface PurchaseParams {
  userId: string;
  amount: number;     // Dollar amount
  authToken: string;  // JWT from login
}

/**
 * Opens the external checkout flow for purchasing Concord Coins.
 *
 * iOS: Uses the ExternalPurchaseLink native module which triggers Apple's
 * required disclosure sheet before opening Safari.
 *
 * Android: Opens the URL directly in the browser (no restrictions).
 *
 * Both platforms redirect to Stripe Checkout, then back to the app via deep link.
 */
export async function openExternalPurchase({ userId, amount, authToken }: PurchaseParams): Promise<void> {
  const url = buildCheckoutURL({ userId, amount, authToken });

  if (Platform.OS !== 'ios') {
    // Android / other: open URL directly in browser
    await Linking.openURL(url);
    return;
  }

  // iOS: Use the native ExternalPurchaseLink module
  // This triggers Apple's mandatory disclosure sheet before opening the URL
  try {
    await NativeModules.ExternalPurchaseLink.open(url);
  } catch (error: any) {
    if (error?.code === 'USER_CANCELLED') {
      // User dismissed the disclosure sheet — not an error
      return;
    }
    console.error('[ExternalPurchase] Error:', error);
    throw error;
  }
}

function buildCheckoutURL({ userId, amount, authToken }: PurchaseParams): string {
  const params = new URLSearchParams({
    source: Platform.OS === 'ios' ? 'ios_app' : 'android_app',
    userId,
    amount: amount.toString(),
    token: authToken,
  });
  return `${API_BASE}/checkout?${params.toString()}`;
}
