import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['iPhone 13'] });

  test('should render main page on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have accessible navigation on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for hamburger menu or mobile nav
    const mobileNav = page.locator(
      'button[aria-label*="menu" i], button[aria-label*="navigation" i], [data-testid="mobile-menu"]'
    ).first();

    // Either mobile nav exists or sidebar is visible
    const sidebar = page.locator('nav, [role="navigation"], aside').first();
    const hasMobileNav = await mobileNav.isVisible().catch(() => false);
    const hasSidebar = await sidebar.isVisible().catch(() => false);
    expect(hasMobileNav || hasSidebar).toBeTruthy();
  });

  test('should not have horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    // Allow small tolerance (2px) for scrollbar
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('should render lens page on mobile', async ({ page }) => {
    await page.goto('/lenses/music');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
    await expect(body).not.toContainText('Application error');
  });
});
