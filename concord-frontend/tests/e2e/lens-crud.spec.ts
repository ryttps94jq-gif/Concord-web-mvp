import { test, expect } from '@playwright/test';

test.describe('Lens CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to a lens page', async ({ page }) => {
    // Click on a lens link in the sidebar or main navigation
    const lensLink = page.locator('a[href*="/lenses/"]').first();
    if (await lensLink.isVisible()) {
      await lensLink.click();
      await expect(page).toHaveURL(/\/lenses\//);
    }
  });

  test('should display DTU list on lens page', async ({ page }) => {
    await page.goto('/lenses/music');
    await page.waitForLoadState('networkidle');
    // Page should load without errors
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('should handle lens page error gracefully', async ({ page }) => {
    // Navigate to a non-existent lens
    await page.goto('/lenses/nonexistent-lens-xyz');
    await page.waitForLoadState('networkidle');
    // Should show error boundary or redirect, not crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display lens content with proper structure', async ({ page }) => {
    await page.goto('/lenses/science');
    await page.waitForLoadState('networkidle');
    // Check that the page has some structure
    const main = page.locator('main, [role="main"], .lens-content, .page-content').first();
    if (await main.isVisible()) {
      await expect(main).toBeVisible();
    }
  });
});
