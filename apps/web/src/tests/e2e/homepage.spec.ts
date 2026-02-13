import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the homepage successfully', async ({ page }) => {
    // Check the page title
    await expect(page).toHaveTitle(/Guilloch[ée] Studio/i);
  });

  test('should display the hero section with main heading', async ({ page }) => {
    // Check for hero section content
    const heading = page.locator('h1');
    await expect(heading).toContainText(/create|mathematical|patterns/i);
  });

  test('should display the navigation bar with logo', async ({ page }) => {
    // Check for logo/brand
    await expect(page.getByText(/Guilloch[ée] Studio/i).first()).toBeVisible();
  });

  test('should show sign in and get started buttons for unauthenticated users', async ({
    page,
  }) => {
    // Check for auth buttons
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    // Scroll to features section
    const featuresSection = page.locator('#features');
    await featuresSection.scrollIntoViewIfNeeded();

    // Check for features heading
    await expect(page.getByRole('heading', { name: /everything you need/i })).toBeVisible();

    // Check for specific feature cards
    await expect(page.getByText(/mathematical precision/i)).toBeVisible();
    await expect(page.getByText(/symmetry engine/i)).toBeVisible();
    await expect(page.getByText(/wasm performance/i)).toBeVisible();
  });

  test('should display pricing section with plans', async ({ page }) => {
    // Scroll to pricing section
    await page.getByRole('heading', { name: /pricing/i }).scrollIntoViewIfNeeded();

    // Check for pricing heading
    await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible();

    // Check for pricing plans
    await expect(page.getByText(/free/i).first()).toBeVisible();
  });

  test('should navigate to studio when clicking "Try the Studio"', async ({ page }) => {
    // Click the try studio button
    await page.getByRole('link', { name: /try the studio/i }).click();

    // Should navigate to studio
    await expect(page).toHaveURL(/\/studio/);
  });

  test('should navigate to login when clicking "Sign In"', async ({ page }) => {
    // Click sign in
    await page.getByRole('link', { name: /sign in/i }).click();

    // Should navigate to login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should navigate to signup when clicking "Get Started Free"', async ({ page }) => {
    // Click get started
    await page
      .getByRole('link', { name: /get started/i })
      .first()
      .click();

    // Should navigate to signup page
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test('should display footer with links', async ({ page }) => {
    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded();

    // Check for footer links
    await expect(page.getByRole('link', { name: /about/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /documentation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /privacy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /terms/i })).toBeVisible();
  });

  test('should have proper meta description', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /guilloch[ée]|pattern|design/i);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Hero section should still be visible
    await expect(page.locator('h1')).toBeVisible();

    // Navigation should be visible (may be condensed on mobile)
    await expect(page.getByText(/Guilloch[ée] Studio/i).first()).toBeVisible();
  });
});
