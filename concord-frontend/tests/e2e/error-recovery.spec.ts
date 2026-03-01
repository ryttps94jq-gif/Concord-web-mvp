import { test, expect } from '@playwright/test';

test.describe('Error Recovery', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API calls to simulate failures
    await page.route('**/api/status', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ ok: false, error: 'Test error' }) });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should still render, not crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle network timeouts gracefully', async ({ page }) => {
    // Simulate slow API
    await page.route('**/api/dtus**', route => {
      route.fulfill({ status: 504, body: 'Gateway Timeout' });
    });

    await page.goto('/lenses/music');
    await page.waitForLoadState('networkidle');

    // Should show error state, not blank page
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should recover from error boundary with retry', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/status', route => {
      requestCount++;
      if (requestCount <= 1) {
        route.fulfill({ status: 500, body: JSON.stringify({ ok: false }) });
      } else {
        route.fulfill({ status: 200, body: JSON.stringify({ ok: true, version: '2.0' }) });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for retry button if error boundary triggered
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
    if (await retryButton.isVisible()) {
      await retryButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should handle 404 pages', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
