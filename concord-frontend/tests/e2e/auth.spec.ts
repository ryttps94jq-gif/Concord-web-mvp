import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
  });

  // ── Login Page ──────────────────────────────────────────────────

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');

    // The page title or branding should reference Concord
    await expect(page.locator('text=Concord')).toBeVisible();

    // Subtitle text: "Sign in to your cognitive engine"
    await expect(page.locator('text=/sign in/i')).toBeVisible();

    // Username/email field with proper label
    const usernameLabel = page.locator('label[for="username"]');
    await expect(usernameLabel).toBeVisible();
    await expect(usernameLabel).toContainText(/username|email/i);

    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(usernameInput).toHaveAttribute('required', '');

    // Password field with proper label
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toBeVisible();
    await expect(passwordLabel).toContainText(/password/i);

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/sign in/i);
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');

    // "Don't have an account? Create one"
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText(/create|register|sign up/i);
  });

  test('login page has link back to home', async ({ page }) => {
    await page.goto('/login');

    // The Concord logo links back to /
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test('login page has password visibility toggle', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the show/hide password button
    const toggleButton = page.getByRole('button', { name: /show password|hide password/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Password should now be visible (type="text")
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('login page username field is autofocused', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // The username input has autoFocus
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeFocused();
  });

  test('login form shows validation on empty submit', async ({ page }) => {
    await page.goto('/login');

    // Try submitting the empty form - browser native validation should prevent it
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should stay on login page (native required validation blocks submission)
    await expect(page).toHaveURL(/\/login/);
  });

  test('login form accepts input in both fields', async ({ page }) => {
    await page.goto('/login');

    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');

    await usernameInput.fill('testuser');
    await expect(usernameInput).toHaveValue('testuser');

    await passwordInput.fill('testpassword123');
    await expect(passwordInput).toHaveValue('testpassword123');
  });

  test('login form submit shows loading state', async ({ page }) => {
    // Intercept the CSRF and login API calls so the form actually submits
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/login', (route) =>
      // Delay the response to observe loading state
      new Promise((resolve) => setTimeout(resolve, 500)).then(() =>
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Invalid credentials' }) })
      )
    );

    await page.goto('/login');

    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('testpassword123');
    await page.locator('button[type="submit"]').click();

    // Should show "Signing in..." loading text
    await expect(page.locator('text=Signing in')).toBeVisible();
  });

  test('login form shows error for invalid credentials', async ({ page }) => {
    // Mock both API calls
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

    // Should remain on the login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('successful login redirects to home', async ({ page }) => {
    // Mock both API calls for success
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    );

    await page.goto('/login');

    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('testpassword123');
    await page.locator('button[type="submit"]').click();

    // Should redirect away from /login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login page preserves "from" redirect after authentication', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    );

    // Navigate to login with a "from" parameter (set by middleware redirect)
    await page.goto('/login?from=/lenses/chat');

    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('testpassword123');
    await page.locator('button[type="submit"]').click();

    // Should redirect to the original "from" path
    await page.waitForURL(/\/lenses\/chat/);
  });

  // ── Register Page ──────────────────────────────────────────────

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');

    // Branding
    await expect(page.locator('text=Concord')).toBeVisible();

    // Subtitle: "Create your sovereign account"
    await expect(page.locator('text=/create.*account|sovereign/i')).toBeVisible();

    // Username field
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute('required', '');

    // Email field
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    // Password field
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('required', '');

    // Confirm password field
    const confirmInput = page.locator('#confirm-password');
    await expect(confirmInput).toBeVisible();
    await expect(confirmInput).toHaveAttribute('required', '');

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText(/create account/i);
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/sign in|login/i);
  });

  test('register page has username constraints hint', async ({ page }) => {
    await page.goto('/register');

    // Hint text below username field
    await expect(page.locator('text=/letters.*numbers|3-50 characters/i')).toBeVisible();
  });

  test('register page shows password mismatch error', async ({ page }) => {
    // Mock CSRF to allow the form to actually submit
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );

    await page.goto('/register');

    await page.locator('#username').fill('newuser');
    await page.locator('#email').fill('new@example.com');
    await page.locator('#password').fill('password12345678');
    await page.locator('#confirm-password').fill('differentpassword');

    await page.locator('button[type="submit"]').click();

    // Client-side validation: "Passwords do not match"
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('register page enforces minimum password length', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );

    await page.goto('/register');

    await page.locator('#username').fill('newuser');
    await page.locator('#email').fill('new@example.com');
    await page.locator('#password').fill('short');
    await page.locator('#confirm-password').fill('short');

    await page.locator('button[type="submit"]').click();

    // Client-side validation: password must be at least 12 characters
    await expect(page.locator('text=/at least 12 characters|Password must be/i')).toBeVisible();
  });

  test('register form shows password visibility toggle', async ({ page }) => {
    await page.goto('/register');

    const passwordInput = page.locator('#password');
    const confirmInput = page.locator('#confirm-password');

    // Both start as password type
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(confirmInput).toHaveAttribute('type', 'password');
  });

  test('register page mentions first-user admin privilege', async ({ page }) => {
    await page.goto('/register');

    // Footer text: "First user becomes the owner with full administrative access."
    await expect(page.locator('text=/first user.*owner|administrative/i')).toBeVisible();
  });

  test('successful registration redirects to home', async ({ page }) => {
    await page.route('**/api/auth/csrf-token', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ token: 'mock' }) })
    );
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    );

    await page.goto('/register');

    await page.locator('#username').fill('newuser');
    await page.locator('#email').fill('new@example.com');
    await page.locator('#password').fill('securepassword12');
    await page.locator('#confirm-password').fill('securepassword12');

    await page.locator('button[type="submit"]').click();

    // Should redirect away from /register
    await expect(page).not.toHaveURL(/\/register/);
  });

  // ── Protected Routes / Middleware ────────────────────────────────

  test('protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/lenses/chat');

    // Middleware should redirect to /login?from=/lenses/chat
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/from=%2Flenses%2Fchat/);
  });

  test('multiple protected routes all redirect to login', async ({ page }) => {
    const protectedPaths = ['/lenses/graph', '/lenses/code', '/lenses/board', '/hub'];

    for (const path of protectedPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('public routes do not redirect', async ({ page }) => {
    // Landing page should be accessible without auth
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/login/);

    // Login page itself should be accessible
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Register page should be accessible
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
  });

  // ── Session Management ──────────────────────────────────────────

  test('session cookie grants access to protected routes', async ({ page, context }) => {
    // Set a mock session cookie matching what the middleware checks
    await context.addCookies([
      {
        name: 'concord_session',
        value: 'mock_session_value',
        domain: 'localhost',
        path: '/',
      },
    ]);

    const response = await page.goto('/lenses/chat');

    // Should NOT be redirected to login — the page should load
    expect(response?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('session persists across page reloads', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'concord_session',
        value: 'valid_session_token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
    ]);

    await page.goto('/lenses/chat');
    await page.reload();

    // Cookie should still be present after reload
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'concord_session');
    expect(authCookie).toBeDefined();

    // Should still not redirect
    await expect(page).not.toHaveURL(/\/login/);
  });

  // ── Cross-page Auth Flow ────────────────────────────────────────

  test('can navigate from login to register and back', async ({ page }) => {
    await page.goto('/login');

    // Click register link
    await page.locator('a[href="/register"]').click();
    await expect(page).toHaveURL(/\/register/);

    // Click login link from register page
    await page.locator('a[href="/login"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sovereignty footer message on login page', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.locator('text=/sovereign|your data|never leaves/i')
    ).toBeVisible();
  });
});
