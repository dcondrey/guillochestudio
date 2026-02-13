import { test as setup, expect } from '@playwright/test';
import { TEST_USER, STORAGE_STATE_PATH } from './fixtures';

/**
 * Authentication setup test that stores the auth state for reuse in other tests.
 * This runs once before all tests that depend on it.
 */
setup('authenticate', async ({ page }) => {
  // Skip auth setup if no test credentials are provided
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    console.log('Skipping auth setup: TEST_USER_EMAIL and TEST_USER_PASSWORD not set');
    return;
  }

  // Navigate to login page
  await page.goto('/auth/login');

  // Wait for page to load
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);

  // Submit the form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for successful login (redirect to studio or dashboard)
  await page.waitForURL(/\/(studio|patterns|dashboard)/);

  // Verify we're logged in by checking for authenticated UI elements
  await expect(page.getByText(/sign out/i)).toBeVisible();

  // Save the authenticated state to a file
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
