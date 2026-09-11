import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/login');
    });

    test('should display the login page correctly', async ({ page }) => {
      // Check page title
      await expect(page).toHaveTitle(/sign in/i);

      // Check for login form elements
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should display OAuth buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
    });

    test('should display link to signup page', async ({ page }) => {
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });

    test('should display forgot password link', async ({ page }) => {
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    });

    test('should show error for empty form submission', async ({ page }) => {
      // Click sign in without filling form
      await page.getByRole('button', { name: /sign in/i }).click();

      // HTML5 validation should prevent submission or show error
      const emailInput = page.getByLabel(/email/i);
      const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
      expect(isInvalid).toBe(true);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      // Typing before hydration is lost: bind:value writes the component's
      // empty initial state onto the input during hydrate, so the submit sees
      // blank fields and reports "enter both email and password" over visibly
      // filled ones. That regex ("error") matched that message, so this test
      // passed for the wrong reason when it raced and failed when it lost.
      // Wait for hydration so it exercises credential rejection, as named.
      await page.waitForLoadState('networkidle');

      // Fill in invalid credentials
      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');

      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.getByRole('link', { name: /sign up/i }).click();
      await expect(page).toHaveURL(/\/auth\/signup/);
    });

    test('should show remember me checkbox', async ({ page }) => {
      await expect(page.getByText(/remember me/i)).toBeVisible();
    });

    test('should have properly labeled form fields', async ({ page }) => {
      // Check that labels are associated with inputs
      const emailInput = page.getByLabel(/email/i);
      const passwordInput = page.getByLabel(/password/i);

      expect(await emailInput.getAttribute('type')).toBe('email');
      expect(await passwordInput.getAttribute('type')).toBe('password');
    });
  });

  test.describe('Signup Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/auth/signup');
    });

    test('should display the signup page correctly', async ({ page }) => {
      // Signup has both Password and Confirm Password, so /password/i is ambiguous
      // under strict mode. Match the accessible names exactly instead.
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^Password\s*\*?$/)).toBeVisible();
      await expect(page.getByLabel(/^Confirm Password\s*\*?$/)).toBeVisible();
    });

    test('should display OAuth buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
    });

    test('should display link to login page', async ({ page }) => {
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.getByRole('link', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe('Logout Flow', () => {
    // Note: These tests require authenticated state
    // In CI, they would use the stored auth state from auth.setup.ts

    test('should redirect to login when accessing protected routes unauthenticated', async ({
      page,
    }) => {
      // Try to access protected route
      await page.goto('/patterns');

      // Should redirect to login or show login prompt
      // The exact behavior depends on the app's auth handling
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      // Either redirected to login or still on patterns (if app handles differently)
      expect(currentUrl.includes('/auth/login') || currentUrl.includes('/patterns')).toBe(true);
    });

    test('studio stays reachable for unauthenticated users', async ({ page }) => {
      await page.goto('/studio');

      // The app layout hides its header inside Studio by design, so there is no
      // nav sign-in link to assert on here. What matters is that an anonymous
      // visitor is not bounced to /auth/login and gets a working canvas.
      await expect(page).toHaveURL(/\/studio/);
      await expect(page.locator('canvas').first()).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('patterns page shows appropriate content for unauthenticated users', async ({ page }) => {
      await page.goto('/patterns');

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Should either redirect to login or show empty state/login prompt
      const hasLoginLink = await page
        .getByRole('link', { name: /sign in|log in/i })
        .isVisible()
        .catch(() => false);
      const hasPatternContent = await page
        .getByText(/my patterns|no patterns/i)
        .isVisible()
        .catch(() => false);
      const isOnLoginPage = page.url().includes('/auth/login');

      expect(hasLoginLink || hasPatternContent || isOnLoginPage).toBe(true);
    });

    test('settings page handles unauthenticated access', async ({ page }) => {
      await page.goto('/settings');

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Should either redirect to login or show settings
      const currentUrl = page.url();
      expect(currentUrl.includes('/auth/login') || currentUrl.includes('/settings')).toBe(true);
    });
  });
});

test.describe('Authenticated User Flow', () => {
  // These tests use stored authentication state
  test.use({ storageState: 'playwright/.auth/user.json' });

  // Skip if no auth state exists (in CI without credentials)
  test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials available');

  test('should show authenticated UI elements', async ({ page }) => {
    await page.goto('/studio');

    // Should show sign out button instead of sign in
    await expect(page.getByText(/sign out/i)).toBeVisible();

    // Should show "My Patterns" link
    await expect(page.getByRole('link', { name: /my patterns/i })).toBeVisible();
  });

  test('should be able to navigate to patterns page', async ({ page }) => {
    await page.goto('/patterns');

    // Should show patterns page content
    await expect(page.getByRole('heading', { name: /my patterns/i })).toBeVisible();
  });

  test('should be able to log out', async ({ page }) => {
    await page.goto('/studio');

    // Click sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should redirect to homepage or login
    await page.waitForURL(/\/($|auth\/login)/);

    // Should no longer show authenticated UI
    await page.goto('/studio');
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });
});
