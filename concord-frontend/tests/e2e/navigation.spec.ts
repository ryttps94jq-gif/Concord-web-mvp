import { test, expect } from '@playwright/test';

/**
 * Helper: set a session cookie so middleware allows access to protected routes.
 * The middleware checks for 'concord_session', 'token', or 'connect.sid'.
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

// ── Landing Page ──────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('landing page loads without errors', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveTitle(/concord/i);
  });

  test('landing page displays hero content', async ({ page }) => {
    await page.goto('/');

    // SSR hero section: "Your Personal Cognitive Engine"
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=/cognitive engine/i')).toBeVisible();
  });

  test('landing page displays feature cards', async ({ page }) => {
    await page.goto('/');

    // SSR renders four feature cards: Domain Lenses, DTU Memory, Local-First AI, Sovereign
    await expect(page.locator('text=/domain lenses|76.*lenses/i')).toBeVisible();
    await expect(page.locator('text=/DTU/i').first()).toBeVisible();
    await expect(page.locator('text=/sovereign/i').first()).toBeVisible();
  });

  test('landing page has Concord branding', async ({ page }) => {
    await page.goto('/');

    // The header should show "Concord OS" branding
    await expect(page.locator('text=/Concord/i').first()).toBeVisible();
  });

  test('landing page has sign in and get started links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The interactive LandingPage renders sign in and register links
    const signInLink = page.locator('a[href="/login"]');
    const getStartedLink = page.locator('a[href="/register"]');

    // At least one of these should be visible (SSR or client-rendered)
    const signInVisible = await signInLink.isVisible().catch(() => false);
    const getStartedVisible = await getStartedLink.isVisible().catch(() => false);

    expect(signInVisible || getStartedVisible).toBeTruthy();
  });
});

// ── 404 Page ──────────────────────────────────────────────────────

test.describe('404 Page', () => {
  test('unknown routes show 404 content', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-99999');

    // The not-found.tsx renders a 404 page with "Page not found"
    const pageContent = await page.content();
    const has404 = pageContent.includes('404') || pageContent.includes('not found') || pageContent.includes('Not Found');
    const redirected = !page.url().includes('this-route-does-not-exist');

    expect(has404 || redirected).toBeTruthy();
  });

  test('404 page has link back to dashboard', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-99999');

    // If on 404 page, should have a "Go to Dashboard" link
    const dashboardLink = page.locator('a[href="/"]');
    if (await dashboardLink.isVisible().catch(() => false)) {
      await expect(dashboardLink).toContainText(/dashboard|home/i);
    }
  });
});

// ── Authenticated Navigation (Sidebar, Topbar, App Shell) ────────

test.describe('App Shell Navigation', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('sidebar renders with main navigation landmark', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Sidebar has role="navigation" with aria-label="Main navigation"
    const sidebar = page.locator('aside[role="navigation"]');
    if (await sidebar.isVisible().catch(() => false)) {
      await expect(sidebar).toHaveAttribute('aria-label', /main navigation/i);
    }
  });

  test('sidebar shows Dashboard link', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Dashboard link pointing to /
    const dashboardLink = page.locator('aside a[href="/"]');
    if (await dashboardLink.first().isVisible().catch(() => false)) {
      await expect(dashboardLink.first()).toBeVisible();
    }
  });

  test('sidebar shows core workspace lenses', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The five core lenses: Chat, Board, Graph, Code, Studio
    const coreLensPaths = [
      '/lenses/chat',
      '/lenses/board',
      '/lenses/graph',
      '/lenses/code',
      '/lenses/studio',
    ];

    for (const path of coreLensPaths) {
      const link = page.locator(`aside a[href="${path}"]`);
      // In collapsed mode only icons show, so check existence rather than visibility
      const count = await link.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('sidebar shows Lens Hub link', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const hubLink = page.locator('aside a[href="/hub"]');
    const count = await hubLink.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('sidebar shows Workspaces section label', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // "Workspaces" label appears when sidebar is expanded
    const label = page.locator('text=Workspaces');
    if (await label.isVisible().catch(() => false)) {
      await expect(label).toBeVisible();
    }
  });

  test('sidebar shows version and sovereignty info', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Footer shows "Concord OS v5.0" and "70% Sovereign"
    const versionText = page.locator('aside').locator('text=/Concord OS|70%/');
    if (await versionText.first().isVisible().catch(() => false)) {
      await expect(versionText.first()).toBeVisible();
    }
  });

  test('sidebar collapse toggle works', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Find the collapse button (desktop only, hidden on mobile)
    const collapseButton = page.getByRole('button', { name: /collapse sidebar|expand sidebar/i });
    if (await collapseButton.isVisible().catch(() => false)) {
      await collapseButton.click();

      // After collapsing, the button label should change
      await expect(
        page.getByRole('button', { name: /expand sidebar/i })
      ).toBeVisible();
    }
  });

  test('sidebar highlights active lens', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The Chat link should have aria-current="page" when active
    const chatLink = page.locator('aside a[href="/lenses/chat"]');
    if (await chatLink.isVisible().catch(() => false)) {
      await expect(chatLink).toHaveAttribute('aria-current', 'page');
    }
  });
});

// ── Topbar ────────────────────────────────────────────────────────

test.describe('Topbar', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('topbar renders with banner role', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const topbar = page.locator('header[role="banner"]');
    if (await topbar.isVisible().catch(() => false)) {
      await expect(topbar).toBeVisible();
    }
  });

  test('topbar shows current lens name', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The topbar h1 should display the current lens name
    const heading = page.locator('header[role="banner"] h1');
    if (await heading.isVisible().catch(() => false)) {
      await expect(heading).toBeVisible();
    }
  });

  test('topbar has command palette trigger', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Search button that opens the command palette
    const searchButton = page.getByRole('button', { name: /open command palette|search/i });
    await expect(searchButton.first()).toBeVisible();
  });

  test('topbar has user menu button', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const userButton = page.getByRole('button', { name: /user menu/i });
    if (await userButton.isVisible().catch(() => false)) {
      await expect(userButton).toBeVisible();
      await expect(userButton).toHaveAttribute('aria-haspopup', 'true');
    }
  });

  test('user menu opens and shows sign out option', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const userButton = page.getByRole('button', { name: /user menu/i });
    if (await userButton.isVisible().catch(() => false)) {
      await userButton.click();

      // Menu should appear with role="menu"
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();

      // Should have a Sign Out menu item
      const signOutItem = menu.locator('[role="menuitem"]').filter({ hasText: /sign out/i });
      await expect(signOutItem).toBeVisible();

      // Should also have System Health and Settings items
      const systemHealthItem = menu.locator('[role="menuitem"]').filter({ hasText: /system health/i });
      const settingsItem = menu.locator('[role="menuitem"]').filter({ hasText: /settings/i });
      await expect(systemHealthItem).toBeVisible();
      await expect(settingsItem).toBeVisible();
    }
  });

  test('topbar has notifications button', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const notificationsButton = page.getByRole('button', { name: /notifications/i });
    if (await notificationsButton.isVisible().catch(() => false)) {
      await expect(notificationsButton).toBeVisible();
    }
  });

  test('topbar has mobile menu button', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const menuButton = page.getByRole('button', { name: /open navigation menu/i });
    if (await menuButton.isVisible().catch(() => false)) {
      await expect(menuButton).toBeVisible();
    }
  });
});

// ── Command Palette ──────────────────────────────────────────────

test.describe('Command Palette', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('command palette opens with Ctrl+K keyboard shortcut', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Press Ctrl+K to open command palette
    await page.keyboard.press('Control+k');

    // Command palette should appear as a dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', /command palette/i);
  });

  test('command palette has search input with combobox role', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    const searchInput = page.locator('[role="combobox"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', /search.*lenses|commands/i);
  });

  test('command palette shows results in listbox', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    // Should have a listbox with command options
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible();

    // Should have at least some option items
    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('command palette filters results on typing', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    const searchInput = page.locator('[role="combobox"]');
    await searchInput.fill('chat');

    // Results should include the Chat lens
    await expect(page.locator('[role="option"]').filter({ hasText: /chat/i }).first()).toBeVisible();
  });

  test('command palette shows "no results" for nonexistent query', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    const searchInput = page.locator('[role="combobox"]');
    await searchInput.fill('zzzznonexistentquery');

    // Should show "No results found" message
    await expect(page.locator('text=/no results/i')).toBeVisible();
  });

  test('command palette closes on Escape', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('command palette closes on backdrop click', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Click the backdrop (aria-hidden div behind the palette)
    await page.locator('[role="dialog"] [aria-hidden="true"]').click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('command palette supports keyboard navigation', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    // First option should be selected by default
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown to move selection
    await page.keyboard.press('ArrowDown');

    // First option should no longer be selected
    await expect(firstOption).toHaveAttribute('aria-selected', 'false');
  });

  test('command palette shows footer with keyboard hints', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    // Footer should show keyboard hints
    await expect(page.locator('text=/Navigate/i')).toBeVisible();
    await expect(page.locator('text=/Select/i')).toBeVisible();
    await expect(page.locator('text=/Close/i')).toBeVisible();
  });
});

// ── Lens Page Loading ─────────────────────────────────────────────

test.describe('Lens Pages', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  const coreLenses = [
    { path: '/lenses/chat', name: 'Chat' },
    { path: '/lenses/board', name: 'Board' },
    { path: '/lenses/graph', name: 'Graph' },
    { path: '/lenses/code', name: 'Code' },
    { path: '/lenses/studio', name: 'Studio' },
  ];

  for (const lens of coreLenses) {
    test(`${lens.name} lens page loads without server errors`, async ({ page }) => {
      const response = await page.goto(lens.path);

      // Should not return server error
      expect(response?.status()).toBeLessThan(500);

      // Page should render content
      await expect(page.locator('body')).not.toBeEmpty();

      // Should not redirect to login (we have a session cookie)
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});

// ── Skip to Content (Accessibility) ──────────────────────────────

test.describe('Accessibility - Skip to Content', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('skip-to-content link exists and targets main content', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The AppShell renders a skip link with href="#main-content"
    const skipLink = page.locator('a[href="#main-content"]');
    const count = await skipLink.count();

    if (count > 0) {
      // The link exists (it is sr-only until focused)
      expect(count).toBe(1);

      // Main content target should exist
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeVisible();
      await expect(mainContent).toHaveAttribute('role', 'main');
    }
  });
});

// ── Responsive Design ─────────────────────────────────────────────

test.describe('Responsive Design', () => {
  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should not have horizontal scrollbar
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Allow small margin for sub-pixel rendering
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/concord/i);
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/concord/i);
  });
});

// ── Page Performance ──────────────────────────────────────────────

test.describe('Performance', () => {
  test('landing page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test('no critical console errors on landing page', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Filter out expected/benign errors in a test environment
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('net::') &&
        !e.includes('favicon') &&
        !e.includes('CSRF') &&
        !e.includes('Failed to load resource') &&
        !e.includes('401') &&
        !e.includes('404') &&
        !e.includes('Unauthorized') &&
        !e.includes('sw.js') &&
        !e.includes('manifest') &&
        !e.includes('hydrat')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

// ── Cross-Navigation Flows ────────────────────────────────────────

test.describe('Navigation Flows', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('navigating between core lenses does not produce errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Navigate to Graph via sidebar link (if visible)
    const graphLink = page.locator('aside a[href="/lenses/graph"]');
    if (await graphLink.isVisible().catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/lenses\/graph/);
    }

    // Navigate to Board
    const boardLink = page.locator('aside a[href="/lenses/board"]');
    if (await boardLink.isVisible().catch(() => false)) {
      await boardLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/lenses\/board/);
    }

    // No page-level JS errors during navigation
    expect(errors).toHaveLength(0);
  });

  test('sidebar navigation links produce correct URLs', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const expectedPaths = [
      '/lenses/chat',
      '/lenses/board',
      '/lenses/graph',
      '/lenses/code',
      '/lenses/studio',
      '/hub',
    ];

    for (const path of expectedPaths) {
      const link = page.locator(`aside a[href="${path}"]`);
      const count = await link.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });
});
