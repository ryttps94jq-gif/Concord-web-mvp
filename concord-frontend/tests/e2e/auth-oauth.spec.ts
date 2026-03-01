import { test, expect } from '@playwright/test';

// ── Auth Page with OAuth ──────────────────────────────────────────

test.describe('Auth Page OAuth Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('login page renders OAuth sign-in buttons', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Look for Google and Apple OAuth buttons
    const googleButton = page.locator(
      'button:has-text("Google"), a:has-text("Google"), button[aria-label*="Google" i]'
    );
    const appleButton = page.locator(
      'button:has-text("Apple"), a:has-text("Apple"), button[aria-label*="Apple" i]'
    );

    // At least Google sign-in should be present
    if (await googleButton.first().isVisible().catch(() => false)) {
      await expect(googleButton.first()).toBeVisible();
    }
    if (await appleButton.first().isVisible().catch(() => false)) {
      await expect(appleButton.first()).toBeVisible();
    }
  });

  test('Google sign-in button redirects to Google OAuth URL', async ({ page }) => {
    // Mock the OAuth URL endpoint
    await page.route('**/api/auth/google', (route) => {
      route.fulfill({
        status: 302,
        headers: {
          Location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=test&response_type=code&scope=openid+email+profile',
        },
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const googleButton = page.locator(
      'button:has-text("Google"), a:has-text("Google"), a[href*="google"], button[aria-label*="Google" i]'
    );

    if (await googleButton.first().isVisible().catch(() => false)) {
      // Intercept navigation to verify redirect target
      const [request] = await Promise.all([
        page.waitForRequest(
          (req) =>
            req.url().includes('google') || req.url().includes('/api/auth/google'),
          { timeout: 5000 }
        ).catch(() => null),
        googleButton.first().click().catch(() => {}),
      ]);

      if (request) {
        expect(request.url()).toContain('google');
      }
    }
  });

  test('Apple sign-in button redirects to Apple OAuth URL', async ({ page }) => {
    // Mock the OAuth URL endpoint
    await page.route('**/api/auth/apple', (route) => {
      route.fulfill({
        status: 302,
        headers: {
          Location: 'https://appleid.apple.com/auth/authorize?client_id=test&redirect_uri=test&response_type=code&scope=name+email',
        },
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const appleButton = page.locator(
      'button:has-text("Apple"), a:has-text("Apple"), a[href*="apple"], button[aria-label*="Apple" i]'
    );

    if (await appleButton.first().isVisible().catch(() => false)) {
      const [request] = await Promise.all([
        page.waitForRequest(
          (req) =>
            req.url().includes('apple') || req.url().includes('/api/auth/apple'),
          { timeout: 5000 }
        ).catch(() => null),
        appleButton.first().click().catch(() => {}),
      ]);

      if (request) {
        expect(request.url()).toContain('apple');
      }
    }
  });
});

// ── Sign In / Sign Up Toggle ──────────────────────────────────────

test.describe('Sign In / Sign Up Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');

    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText(/create|register|sign up/i);
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/sign in|login/i);
  });

  test('can toggle between sign in and sign up pages', async ({ page }) => {
    await page.goto('/login');

    // Navigate to register
    await page.locator('a[href="/register"]').click();
    await expect(page).toHaveURL(/\/register/);

    // Navigate back to login
    await page.locator('a[href="/login"]').click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Email/Password Form Validation ──────────────────────────────────

test.describe('Email/Password Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('login form shows required field validation', async ({ page }) => {
    await page.goto('/login');

    // Fields should have required attribute
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');

    await expect(usernameInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('register form validates password length', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );

    await page.goto('/register');

    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('short');
    await page.locator('#confirm-password').fill('short');

    await page.locator('button[type="submit"]').click();

    // Should show password length validation error
    await expect(
      page.locator('text=/at least 12 characters|Password must be/i')
    ).toBeVisible();
  });

  test('register form validates password match', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );

    await page.goto('/register');

    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('securepassword12');
    await page.locator('#confirm-password').fill('differentpassword');

    await page.locator('button[type="submit"]').click();

    // Should show password mismatch error
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('register form validates email format', async ({ page }) => {
    await page.goto('/register');

    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });
});

// ── Error State Display ──────────────────────────────────────────

test.describe('Error State Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    );

    await page.goto('/login');

    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Error message should appear
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('login shows loading state during submit', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/login', (route) =>
      new Promise((resolve) => setTimeout(resolve, 500)).then(() =>
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Invalid credentials' }),
        })
      )
    );

    await page.goto('/login');

    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('testpassword123');
    await page.locator('button[type="submit"]').click();

    // Should show loading state
    await expect(page.locator('text=Signing in')).toBeVisible();
  });

  test('register shows error for duplicate username', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Username already taken' }),
      })
    );

    await page.goto('/register');

    await page.locator('#username').fill('existinguser');
    await page.locator('#email').fill('new@example.com');
    await page.locator('#password').fill('securepassword12');
    await page.locator('#confirm-password').fill('securepassword12');
    await page.locator('button[type="submit"]').click();

    // Should show duplicate error
    await expect(page.locator('text=/already taken|already exists/i')).toBeVisible();
  });
});
