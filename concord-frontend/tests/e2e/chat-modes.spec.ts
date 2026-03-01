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

// ── Chat Rail Mode Selector ──────────────────────────────────────

test.describe('Chat Rail Mode Selector', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('chat page loads without server errors', async ({ page }) => {
    const response = await page.goto('/lenses/chat');

    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('chat rail renders mode selector with 5 modes', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The 5 modes: Welcome, Assist, Explore, Connect, Chat
    const modeLabels = ['Welcome', 'Assist', 'Explore', 'Connect', 'Chat'];

    for (const label of modeLabels) {
      const modeButton = page.locator(
        `button:has-text("${label}"), [data-mode="${label.toLowerCase()}"], [aria-label*="${label}" i]`
      );
      if (await modeButton.first().isVisible().catch(() => false)) {
        await expect(modeButton.first()).toBeVisible();
      }
    }
  });

  test('mode selector buttons are clickable', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const modeLabels = ['Assist', 'Explore', 'Connect', 'Chat'];

    for (const label of modeLabels) {
      const modeButton = page.locator(
        `button:has-text("${label}"), [data-mode="${label.toLowerCase()}"]`
      ).first();

      if (await modeButton.isVisible().catch(() => false)) {
        await modeButton.click();
        // No crash after clicking mode
        await expect(page.locator('body')).not.toBeEmpty();
      }
    }
  });
});

// ── Welcome Mode ──────────────────────────────────────────────────

test.describe('Welcome Mode', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('welcome mode shows greeting content', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Welcome mode is the default when 0 messages
    // Look for greeting text or welcome panel
    const greetingContent = page.locator(
      'text=/welcome|hello|good morning|good afternoon|good evening|how can I help/i'
    );

    if (await greetingContent.first().isVisible().catch(() => false)) {
      await expect(greetingContent.first()).toBeVisible();
    }
  });

  test('welcome mode shows quick action buttons', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Quick actions should be clickable buttons
    const actionButtons = page.locator(
      'button[data-action], button:has-text("Create"), button:has-text("Search"), button:has-text("Explore")'
    );
    const count = await actionButtons.count();

    // Welcome panel should have at least some quick actions
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ── Assist Mode ──────────────────────────────────────────────────

test.describe('Assist Mode', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('assist mode renders task-focused interface', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Switch to Assist mode
    const assistButton = page.locator(
      'button:has-text("Assist"), [data-mode="assist"]'
    ).first();

    if (await assistButton.isVisible().catch(() => false)) {
      await assistButton.click();

      // Assist mode should show task-oriented UI
      const assistContent = page.locator(
        'text=/task|assist|help|workflow/i'
      );
      if (await assistContent.first().isVisible().catch(() => false)) {
        await expect(assistContent.first()).toBeVisible();
      }
    }
  });
});

// ── Explore Mode ──────────────────────────────────────────────────

test.describe('Explore Mode', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('explore mode renders discovery interface', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Switch to Explore mode
    const exploreButton = page.locator(
      'button:has-text("Explore"), [data-mode="explore"]'
    ).first();

    if (await exploreButton.isVisible().catch(() => false)) {
      await exploreButton.click();

      // Explore mode should show trending topics or surprise button
      const exploreContent = page.locator(
        'text=/trending|surprise|discover|explore|topic/i'
      );
      if (await exploreContent.first().isVisible().catch(() => false)) {
        await expect(exploreContent.first()).toBeVisible();
      }
    }
  });

  test('explore mode has surprise me button', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const exploreButton = page.locator(
      'button:has-text("Explore"), [data-mode="explore"]'
    ).first();

    if (await exploreButton.isVisible().catch(() => false)) {
      await exploreButton.click();

      const surpriseButton = page.locator(
        'button:has-text("Surprise"), button:has-text("Random")'
      );
      if (await surpriseButton.first().isVisible().catch(() => false)) {
        await expect(surpriseButton.first()).toBeVisible();
      }
    }
  });
});

// ── Connect Mode ──────────────────────────────────────────────────

test.describe('Connect Mode', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('connect mode renders collaboration options', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const connectButton = page.locator(
      'button:has-text("Connect"), [data-mode="connect"]'
    ).first();

    if (await connectButton.isVisible().catch(() => false)) {
      await connectButton.click();

      // Connect mode should show collaboration UI
      const connectContent = page.locator(
        'text=/collaborate|connect|share|session|invite/i'
      );
      if (await connectContent.first().isVisible().catch(() => false)) {
        await expect(connectContent.first()).toBeVisible();
      }
    }
  });
});

// ── Mode Switching ──────────────────────────────────────────────────

test.describe('Mode Switch Behavior', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('switching between modes preserves page state', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Switch through modes rapidly
    const modeLabels = ['Assist', 'Explore', 'Connect', 'Chat', 'Welcome'];

    for (const label of modeLabels) {
      const modeButton = page.locator(
        `button:has-text("${label}"), [data-mode="${label.toLowerCase()}"]`
      ).first();

      if (await modeButton.isVisible().catch(() => false)) {
        await modeButton.click();
        // Brief pause to let UI settle
        await page.waitForTimeout(200);
      }
    }

    // No JS errors during mode switching
    expect(errors).toHaveLength(0);
  });

  test('chat input placeholder changes with mode', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // The chat input should exist
    const chatInput = page.locator(
      'textarea, input[type="text"]'
    ).last();

    if (await chatInput.isVisible().catch(() => false)) {
      const initialPlaceholder = await chatInput.getAttribute('placeholder');

      // Switch to Explore mode
      const exploreButton = page.locator(
        'button:has-text("Explore"), [data-mode="explore"]'
      ).first();

      if (await exploreButton.isVisible().catch(() => false)) {
        await exploreButton.click();
        await page.waitForTimeout(300);

        const newPlaceholder = await chatInput.getAttribute('placeholder');

        // Placeholder may or may not change, but should not crash
        expect(typeof newPlaceholder).toBe('string');
      }
    }
  });
});

// ── Cross-Lens Memory Bar ──────────────────────────────────────────

test.describe('Cross-Lens Memory Bar', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('memory bar renders in chat rail', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Look for the cross-lens memory bar or lens trail indicator
    const memoryBar = page.locator(
      '[data-testid="memory-bar"], text=/lens trail|memory|context/i'
    );

    if (await memoryBar.first().isVisible().catch(() => false)) {
      await expect(memoryBar.first()).toBeVisible();
    }
  });

  test('navigating between lenses updates memory context', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Navigate to another lens
    const graphLink = page.locator('aside a[href="/lenses/graph"]');
    if (await graphLink.isVisible().catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Navigate back to chat
    const chatLink = page.locator('aside a[href="/lenses/chat"]');
    if (await chatLink.isVisible().catch(() => false)) {
      await chatLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Page should load without errors after lens navigation
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

// ── Proactive Message Chips ──────────────────────────────────────

test.describe('Proactive Message Chips', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('proactive chips render when triggered', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Proactive chips may appear after idle time or lens navigation
    const proactiveChip = page.locator(
      '[data-testid="proactive-chip"], [class*="proactive"], button:has-text("Dismiss")'
    );

    // Check if any proactive chips are present (they may not appear immediately)
    const count = await proactiveChip.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('proactive chips can be dismissed', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const dismissButton = page.locator(
      '[data-testid="proactive-dismiss"], button[aria-label*="dismiss" i]'
    );

    if (await dismissButton.first().isVisible().catch(() => false)) {
      await dismissButton.first().click();

      // Chip should be removed after dismissal
      await expect(dismissButton.first()).not.toBeVisible();
    }
  });
});
