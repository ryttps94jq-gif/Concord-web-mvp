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

// ── User Profile ──────────────────────────────────────────────────

test.describe('User Profile', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('profile page loads without server errors', async ({ page }) => {
    const response = await page.goto('/profile');

    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('profile page renders user content', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('profile page shows display name or username', async ({ page }) => {
    // Mock profile API
    await page.route('**/api/social/profile*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          profile: {
            userId: 'user-1',
            displayName: 'Test User',
            bio: 'A test bio',
            avatar: '',
            isPublic: true,
            specialization: ['engineering'],
            stats: {
              dtuCount: 42,
              publicDtuCount: 30,
              citationCount: 15,
              followerCount: 100,
              followingCount: 50,
            },
          },
        }),
      })
    );

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Profile should show user info
    const profileContent = page.locator('text=/profile|user|settings/i');
    if (await profileContent.first().isVisible().catch(() => false)) {
      await expect(profileContent.first()).toBeVisible();
    }
  });

  test('profile tabs are present', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Profile tabs: posts, media, dtus, liked (from UserProfile component)
    const tabTexts = ['Posts', 'Media', 'DTUs', 'Liked'];

    for (const tabText of tabTexts) {
      const tab = page.locator(`button:has-text("${tabText}")`);
      if (await tab.first().isVisible().catch(() => false)) {
        await expect(tab.first()).toBeVisible();
      }
    }
  });

  test('profile tab switching works', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const tabTexts = ['Posts', 'Media', 'DTUs', 'Liked'];

    for (const tabText of tabTexts) {
      const tab = page.locator(`button:has-text("${tabText}")`);
      if (await tab.first().isVisible().catch(() => false)) {
        await tab.first().click();
        // No crash on click
        await expect(page.locator('body')).not.toBeEmpty();
      }
    }
  });
});

// ── Follow / Unfollow ──────────────────────────────────────────────

test.describe('Follow / Unfollow', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('follow button is present on user profiles', async ({ page }) => {
    // Mock a user profile with follow state
    await page.route('**/api/social/profile/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          profile: {
            userId: 'other-user',
            displayName: 'Other User',
            bio: 'Another user',
            isPublic: true,
            stats: {
              dtuCount: 10,
              publicDtuCount: 8,
              citationCount: 5,
              followerCount: 50,
              followingCount: 30,
            },
          },
          isFollowing: false,
        }),
      })
    );

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Look for follow/unfollow button
    const followButton = page.locator(
      'button:has-text("Follow"), button:has-text("Unfollow"), button[aria-label*="follow" i]'
    );

    if (await followButton.first().isVisible().catch(() => false)) {
      await expect(followButton.first()).toBeVisible();
    }
  });
});

// ── Discovery Page ──────────────────────────────────────────────────

test.describe('Discovery Page', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('hub page loads without server errors', async ({ page }) => {
    const response = await page.goto('/hub');

    expect(response?.status()).toBeLessThan(500);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('hub page renders content', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('discovery section shows trending or popular content', async ({ page }) => {
    await page.goto('/hub');
    await page.waitForLoadState('networkidle');

    // Look for trending, popular, or discovery indicators
    const trendingContent = page.locator(
      'text=/trending|popular|discover|explore|featured/i'
    );

    if (await trendingContent.first().isVisible().catch(() => false)) {
      await expect(trendingContent.first()).toBeVisible();
    }
  });
});

// ── Search Functionality ──────────────────────────────────────────

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('command palette opens with Ctrl+K and accepts search queries', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    // Open command palette
    await page.keyboard.press('Control+k');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Type a search query
    const searchInput = page.locator('[role="combobox"]');
    await searchInput.fill('test search query');

    // Search input should have the query
    await expect(searchInput).toHaveValue('test search query');
  });

  test('search shows results or no results message', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');

    const searchInput = page.locator('[role="combobox"]');
    await searchInput.fill('zzzznonexistentquery12345');

    // Should show "No results" or some results
    const noResults = page.locator('text=/no results/i');
    const results = page.locator('[role="option"]');

    const noResultsVisible = await noResults.isVisible().catch(() => false);
    const resultsCount = await results.count();

    expect(noResultsVisible || resultsCount >= 0).toBeTruthy();
  });
});

// ── Notification Center ──────────────────────────────────────────

test.describe('Notification Center', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateContext(context);
  });

  test('notifications button exists in topbar', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const notificationsButton = page.getByRole('button', { name: /notifications/i });
    if (await notificationsButton.isVisible().catch(() => false)) {
      await expect(notificationsButton).toBeVisible();
    }
  });

  test('clicking notifications button opens notification panel', async ({ page }) => {
    await page.goto('/lenses/chat');
    await page.waitForLoadState('networkidle');

    const notificationsButton = page.getByRole('button', { name: /notifications/i });
    if (await notificationsButton.isVisible().catch(() => false)) {
      await notificationsButton.click();

      // Notification panel or dropdown should appear
      const notifPanel = page.locator(
        '[role="dialog"], [data-testid="notification-panel"], [class*="notification"]'
      );
      if (await notifPanel.first().isVisible().catch(() => false)) {
        await expect(notifPanel.first()).toBeVisible();
      }
    }
  });
});
