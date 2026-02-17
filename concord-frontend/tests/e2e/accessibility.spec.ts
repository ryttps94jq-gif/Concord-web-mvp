import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Helper to authenticate
async function authenticate(context: any) {
  await context.addCookies([{
    name: 'concord_session',
    value: 'test-session-token',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }]);
}

test.describe('Accessibility (axe-core)', () => {

  test.describe('Public pages', () => {
    test('Landing page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast']) // Dark theme needs manual review
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, `Found ${critical.length} critical/serious violations:\n${
        critical.map(v => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`).join('\n')
      }`).toHaveLength(0);
    });

    test('Login page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/login');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, `Found ${critical.length} critical/serious violations:\n${
        critical.map(v => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`).join('\n')
      }`).toHaveLength(0);
    });

    test('Register page should have no critical accessibility violations', async ({ page }) => {
      await page.goto('/register');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const critical = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );

      expect(critical, `Found ${critical.length} critical/serious violations:\n${
        critical.map(v => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`).join('\n')
      }`).toHaveLength(0);
    });
  });

  test.describe('Authenticated pages', () => {
    test.beforeEach(async ({ context }) => {
      await authenticate(context);
    });

    const lensPages = [
      { name: 'Chat', path: '/lenses/chat' },
      { name: 'Board', path: '/lenses/board' },
      { name: 'Graph', path: '/lenses/graph' },
      { name: 'Code', path: '/lenses/code' },
      { name: 'Studio', path: '/lenses/studio' },
    ];

    for (const lens of lensPages) {
      test(`${lens.name} lens should have no critical accessibility violations`, async ({ page }) => {
        // Mock API responses to prevent 401s
        await page.route('**/api/**', route => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, dtus: [], conversations: [], agents: [] }),
          });
        });

        await page.goto(lens.path);
        await page.waitForLoadState('networkidle').catch(() => {});

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .disableRules(['color-contrast']) // Dark theme
          .analyze();

        const critical = results.violations.filter(v =>
          v.impact === 'critical' || v.impact === 'serious'
        );

        // Log all violations for debugging but only fail on critical/serious
        if (results.violations.length > 0) {
          console.log(`[${lens.name}] ${results.violations.length} total violations (${critical.length} critical/serious):`);
          results.violations.forEach(v => {
            console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
          });
        }

        expect(critical, `${lens.name}: ${critical.length} critical/serious violations`).toHaveLength(0);
      });
    }
  });

  test.describe('Form accessibility', () => {
    test('Login form should have proper labels and ARIA attributes', async ({ page }) => {
      await page.goto('/login');

      // Check form has aria-describedby when error shown
      const form = page.locator('form');
      await expect(form).toBeVisible();

      // Check all inputs have associated labels
      const inputs = page.locator('input[required]');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          expect(await label.count(), `Input #${id} should have an associated label`).toBeGreaterThan(0);
        }
      }
    });

    test('Register form should have proper labels and hint text', async ({ page }) => {
      await page.goto('/register');

      // Username hint should be linked via aria-describedby
      const usernameInput = page.locator('#username');
      const describedBy = await usernameInput.getAttribute('aria-describedby');
      expect(describedBy).toBe('username-hint');

      // Hint element should exist
      const hint = page.locator('#username-hint');
      await expect(hint).toBeVisible();
    });
  });

  test.describe('Keyboard navigation', () => {
    test('Login page should be fully navigable via keyboard', async ({ page }) => {
      await page.goto('/login');

      // Tab through all interactive elements
      await page.keyboard.press('Tab'); // Username
      const focused1 = await page.evaluate(() => document.activeElement?.id);
      expect(focused1).toBe('username');

      await page.keyboard.press('Tab'); // Password
      const focused2 = await page.evaluate(() => document.activeElement?.id);
      expect(focused2).toBe('password');

      await page.keyboard.press('Tab'); // Password toggle
      const focused3 = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
      expect(focused3).toBe('button');

      await page.keyboard.press('Tab'); // Submit button
      const focused4 = await page.evaluate(() => document.activeElement?.getAttribute('type'));
      expect(focused4).toBe('submit');
    });
  });

  test.describe('Landmarks and structure', () => {
    test('Pages should have proper landmark structure', async ({ page, context }) => {
      await authenticate(context);

      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, dtus: [], conversations: [] }),
        });
      });

      await page.goto('/lenses/chat');
      await page.waitForLoadState('domcontentloaded');

      // Should have main content area
      const main = page.locator('#main-content, [role="main"], main');
      expect(await main.count()).toBeGreaterThan(0);

      // Should have navigation
      const nav = page.locator('nav, [role="navigation"]');
      expect(await nav.count()).toBeGreaterThan(0);
    });
  });
});
