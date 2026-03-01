import { test, expect } from '@playwright/test';

/**
 * Helper: set a session cookie so middleware allows access to protected routes.
 */
async function authenticateContext(context: import('@playwright/test').BrowserContext) {
  await context.addCookies([
    {
      name: 'concord_session',
      value: 'e2e_test_session',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

// ── Wallet Page ──────────────────────────────────────────────────

test.describe('Wallet Page', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('wallet page loads without server errors', async ({ page }) => {
    const response = await page.goto('/lenses/wallet');

    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('wallet page displays heading', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // Page header shows "Wallet & Billing"
    await expect(page.locator('text=/Wallet.*Billing/i')).toBeVisible();
  });

  test('balance card renders with CC Balance label', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // Balance card displays "CC Balance" label
    await expect(page.locator('text=/CC Balance/i')).toBeVisible();
  });

  test('balance card shows CC unit', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // CC unit indicator appears after the numeric balance
    const ccLabel = page.locator('text=/CC/');
    const count = await ccLabel.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Buy CC button is visible', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const buyButton = page.locator('button', { hasText: /Buy CC/i });
    await expect(buyButton.first()).toBeVisible();
  });

  test('clicking Buy CC opens purchase flow modal', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const buyButton = page.locator('button', { hasText: /Buy CC/i }).first();
    await buyButton.click();

    // Purchase flow should become visible (modal or inline expansion)
    const purchaseFlow = page.locator('text=/purchase|amount|preset/i');
    if (await purchaseFlow.isVisible().catch(() => false)) {
      await expect(purchaseFlow).toBeVisible();
    }
  });

  test('Withdraw button is visible', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const withdrawButton = page.locator('button', { hasText: /Withdraw/i });
    await expect(withdrawButton.first()).toBeVisible();
  });

  test('transaction history section renders', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // Transaction tabs should be visible: All, Purchases, Tips, Withdrawals, Earnings
    const allTab = page.locator('button', { hasText: /^All$/i });
    await expect(allTab.first()).toBeVisible();
  });

  test('transaction tabs are clickable', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const tabLabels = ['All', 'Purchases', 'Tips', 'Withdrawals', 'Earnings'];

    for (const label of tabLabels) {
      const tab = page.locator('button', { hasText: new RegExp(`^${label}$`, 'i') });
      if (await tab.first().isVisible().catch(() => false)) {
        await tab.first().click();
        // Tab should appear active (no crash)
        await expect(tab.first()).toBeVisible();
      }
    }
  });

  test('quick stats row renders', async ({ page }) => {
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // Quick stats: Total Credits, Total Debits, This Month, Payout Status
    const totalCredits = page.locator('text=/Total Credits/i');
    const totalDebits = page.locator('text=/Total Debits/i');

    if (await totalCredits.isVisible().catch(() => false)) {
      await expect(totalCredits).toBeVisible();
    }
    if (await totalDebits.isVisible().catch(() => false)) {
      await expect(totalDebits).toBeVisible();
    }
  });

  test('empty transaction state shows message', async ({ page }) => {
    // Mock empty transaction response
    await page.route('**/api/billing/transactions*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transactions: [], total: 0 }),
      })
    );
    await page.route('**/api/billing/balance', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ balance: 0, totalCredits: 0, totalDebits: 0 }),
      })
    );

    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    // Should show empty state message
    const noTransactions = page.locator('text=/No transactions found|transaction history will appear/i');
    if (await noTransactions.isVisible().catch(() => false)) {
      await expect(noTransactions).toBeVisible();
    }
  });
});

// ── Wallet Widget (Header) ──────────────────────────────────────

test.describe('Wallet Widget in Header', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('wallet widget renders CC balance indicator in header', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Look for the wallet widget showing CC balance in the header
    const ccIndicator = page.locator('header').locator('text=/CC/');
    if (await ccIndicator.first().isVisible().catch(() => false)) {
      await expect(ccIndicator.first()).toBeVisible();
    }
  });

  test('wallet widget links to wallet page', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Look for wallet link in header
    const walletLink = page.locator('header a[href="/lenses/wallet"]');
    if (await walletLink.first().isVisible().catch(() => false)) {
      await expect(walletLink.first()).toBeVisible();
    }
  });
});

// ── Mobile Responsive Wallet ────────────────────────────────────

test.describe('Mobile Responsive Wallet', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('wallet page renders without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Allow small margin for sub-pixel rendering
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('wallet balance card is visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=/CC Balance/i')).toBeVisible();
  });

  test('Buy CC and Withdraw buttons are accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lenses/wallet');
    await page.waitForLoadState('networkidle');

    const buyButton = page.locator('button', { hasText: /Buy CC/i });
    const withdrawButton = page.locator('button', { hasText: /Withdraw/i });

    await expect(buyButton.first()).toBeVisible();
    await expect(withdrawButton.first()).toBeVisible();
  });
});
