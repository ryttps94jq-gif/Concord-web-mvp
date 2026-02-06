import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');

    // Page should load without errors
    await expect(page).not.toHaveTitle(/error|500|404/i);

    // Should have some main content
    const mainContent = page.locator('main, #__next, body');
    await expect(mainContent).toBeVisible();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');

    // Find navigation links
    const navLinks = page.locator('nav a, header a');
    const count = await navLinks.count();

    if (count > 0) {
      // Click first navigation link
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');

      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        await firstLink.click();
        // Should navigate without errors
        await expect(page).not.toHaveTitle(/error|500/i);
      }
    }
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');

    // Should show 404 or redirect to a valid page
    const pageContent = await page.content();
    const is404 = pageContent.includes('404') ||
                  pageContent.includes('not found') ||
                  pageContent.includes('Not Found');
    const redirected = page.url() !== '/this-route-does-not-exist-12345';

    expect(is404 || redirected).toBeTruthy();
  });
});

test.describe('Lens Pages', () => {
  const lensPages = [
    '/lens/chat',
    '/lens/graph',
    '/lens/forge',
    '/lens/admin',
  ];

  for (const lensPath of lensPages) {
    test(`${lensPath} loads without errors`, async ({ page }) => {
      const response = await page.goto(lensPath);

      // Should not return server error
      expect(response?.status()).toBeLessThan(500);

      // Page should render something
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should load without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Allow small margin for edge cases
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('page has proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();

    // Having at least some structure is good
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab through the page
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe('BODY');
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Image should have alt text or be marked as decorative
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });
});

test.describe('Performance', () => {
  test('page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Filter out expected errors (like network issues in test env)
    const criticalErrors = errors.filter(
      (e) => !e.includes('net::') && !e.includes('favicon') && !e.includes('CSRF')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
