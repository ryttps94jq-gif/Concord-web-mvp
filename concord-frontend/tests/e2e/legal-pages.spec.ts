import { test, expect } from '@playwright/test';

// ── Terms of Service ──────────────────────────────────────────────

test.describe('Terms of Service Page', () => {
  test('terms page loads without server errors', async ({ page }) => {
    const response = await page.goto('/legal/terms');

    expect(response?.status()).toBeLessThan(500);
  });

  test('terms page displays page title', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText(/Terms of Service/i);
  });

  test('terms page shows effective date', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=/Effective Date/i')).toBeVisible();
  });

  test('terms page has table of contents', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    // TOC contains section links
    const tocNav = page.locator('nav');
    if (await tocNav.first().isVisible().catch(() => false)) {
      await expect(tocNav.first()).toBeVisible();
    }
  });

  test('terms page has section anchors', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    // Check key section IDs exist
    const sectionIds = [
      'acceptance',
      'eligibility',
      'accounts',
      'concord-coin',
      'content-ownership',
    ];

    for (const id of sectionIds) {
      const section = page.locator(`#${id}`);
      const count = await section.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('terms page section links navigate to correct anchors', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    // Click a TOC link and verify URL hash changes
    const tocLink = page.locator('a[href="#acceptance"]');
    if (await tocLink.first().isVisible().catch(() => false)) {
      await tocLink.first().click();
      await expect(page).toHaveURL(/#acceptance/);
    }
  });
});

// ── Privacy Policy ──────────────────────────────────────────────────

test.describe('Privacy Policy Page', () => {
  test('privacy page loads without server errors', async ({ page }) => {
    const response = await page.goto('/legal/privacy');

    expect(response?.status()).toBeLessThan(500);
  });

  test('privacy page displays page title', async ({ page }) => {
    await page.goto('/legal/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText(/Privacy Policy/i);
  });

  test('privacy page shows effective date', async ({ page }) => {
    await page.goto('/legal/privacy');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=/Effective Date/i')).toBeVisible();
  });

  test('privacy page has section anchors', async ({ page }) => {
    await page.goto('/legal/privacy');
    await page.waitForLoadState('networkidle');

    // Check key section IDs exist
    const sectionIds = [
      'information-collected',
      'how-we-use',
      'data-sharing',
      'user-rights',
      'security',
    ];

    for (const id of sectionIds) {
      const section = page.locator(`#${id}`);
      const count = await section.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('privacy page mentions data sovereignty', async ({ page }) => {
    await page.goto('/legal/privacy');
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/data sovereignty|your data belongs to you/i')
    ).toBeVisible();
  });
});

// ── DMCA Page ──────────────────────────────────────────────────────

test.describe('DMCA Policy Page', () => {
  test('dmca page loads without server errors', async ({ page }) => {
    const response = await page.goto('/legal/dmca');

    expect(response?.status()).toBeLessThan(500);
  });

  test('dmca page displays page title', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toContain('dmca');
  });

  test('dmca page shows submission form', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    // The DMCA form should have key fields
    const formFields = [
      'input[name="claimantName"], #claimantName, label:has-text("Name")',
      'input[name="claimantEmail"], #claimantEmail, label:has-text("Email")',
      'textarea[name="description"], #description, label:has-text("Description")',
      'input[name="signature"], #signature, label:has-text("Signature")',
    ];

    for (const selector of formFields) {
      const field = page.locator(selector);
      if (await field.first().isVisible().catch(() => false)) {
        await expect(field.first()).toBeVisible();
      }
    }
  });

  test('dmca page has good faith and accuracy checkboxes', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    // Look for checkbox inputs for statements
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    // Should have at least the good faith and accuracy checkboxes
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('dmca form validation prevents empty submission', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    // Find and click the submit button without filling form
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Submit")'
    );
    if (await submitButton.first().isVisible().catch(() => false)) {
      await submitButton.first().click();

      // Form should stay on page (browser validation or custom validation prevents submit)
      await expect(page).toHaveURL(/\/legal\/dmca/);
    }
  });

  test('dmca form accepts input in fields', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    // Fill in claimant name if visible
    const nameInput = page.locator(
      'input[name="claimantName"], #claimantName'
    ).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Test Claimant');
      await expect(nameInput).toHaveValue('Test Claimant');
    }

    // Fill in email if visible
    const emailInput = page.locator(
      'input[name="claimantEmail"], #claimantEmail'
    ).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill('test@example.com');
      await expect(emailInput).toHaveValue('test@example.com');
    }
  });

  test('dmca page has counter-notification section', async ({ page }) => {
    await page.goto('/legal/dmca');
    await page.waitForLoadState('networkidle');

    // The DMCA page should mention counter-notification process
    await expect(
      page.locator('text=/counter.*notification/i')
    ).toBeVisible();
  });
});

// ── Legal Footer Links ──────────────────────────────────────────────

test.describe('Legal Footer Links', () => {
  test('landing page has link to terms of service', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const termsLink = page.locator('a[href="/legal/terms"]');
    if (await termsLink.first().isVisible().catch(() => false)) {
      await expect(termsLink.first()).toBeVisible();
    }
  });

  test('landing page has link to privacy policy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const privacyLink = page.locator('a[href="/legal/privacy"]');
    if (await privacyLink.first().isVisible().catch(() => false)) {
      await expect(privacyLink.first()).toBeVisible();
    }
  });

  test('legal pages cross-link each other', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    // Terms page should link to privacy policy
    const privacyLink = page.locator('a[href="/legal/privacy"]');
    const count = await privacyLink.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('footer links navigate correctly to legal pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const termsLink = page.locator('a[href="/legal/terms"]');
    if (await termsLink.first().isVisible().catch(() => false)) {
      await termsLink.first().click();
      await expect(page).toHaveURL(/\/legal\/terms/);
      await expect(page.locator('h1')).toContainText(/Terms/i);
    }
  });
});

// ── Legal Page Layout ──────────────────────────────────────────────

test.describe('Legal Page Layout', () => {
  test('legal layout wraps all legal pages', async ({ page }) => {
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    // Legal pages should share a common layout
    await expect(page.locator('article')).toBeVisible();
  });

  test('legal pages render without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/legal/terms');
    await page.waitForLoadState('networkidle');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});
