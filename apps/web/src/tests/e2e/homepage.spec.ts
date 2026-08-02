import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Guilloch[ée] Studio/i);
  });

  test('should display the hero section with main heading', async ({ page }) => {
    // The hero h1 is split across lines ("Precision, / by design."), so assert on
    // the section rather than a single copy string that the next redesign will break.
    const heading = page.locator('main h1').first();
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
  });

  test('should display the navigation bar with logo', async ({ page }) => {
    await expect(page.getByText(/Guilloch[ée] Studio/i).first()).toBeVisible();
  });

  test('should show log in and get started links for unauthenticated users', async ({ page }) => {
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('should display the capabilities section', async ({ page }) => {
    const capabilities = page.locator('#capabilities');
    await capabilities.scrollIntoViewIfNeeded();

    await expect(page.getByRole('heading', { name: /capabilities/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /vector perfection/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /security core/i })).toBeVisible();
  });

  test('should display pricing section with all three plans', async ({ page }) => {
    const pricing = page.locator('#pricing');
    await pricing.scrollIntoViewIfNeeded();

    await expect(page.getByRole('heading', { name: /simple licensing/i })).toBeVisible();

    for (const plan of ['Free', 'Pro', 'Enterprise']) {
      await expect(pricing.getByRole('heading', { name: plan, exact: true })).toBeVisible();
    }
  });

  test('should navigate to studio from the primary call to action', async ({ page }) => {
    // "Launch Engine" appears twice: the hero CTA and the closing CTA.
    await page
      .getByRole('link', { name: /launch engine/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/studio/);
  });

  test('should navigate to login when clicking "Log in"', async ({ page }) => {
    await page.getByRole('link', { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should navigate to signup when clicking "Get Started"', async ({ page }) => {
    await page
      .getByRole('link', { name: /get started/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('should display footer with platform and legal links', async ({ page }) => {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    await expect(footer.getByRole('link', { name: /documentation/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /licensing/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /privacy standards/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /terms of use/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /compliance/i })).toBeVisible();
  });

  test('should have proper meta description', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /guilloch[ée]|pattern|design/i);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByText(/Guilloch[ée] Studio/i).first()).toBeVisible();
  });
});
