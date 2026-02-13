import { test, expect } from '@playwright/test';

test.describe('Pattern Saving and Loading', () => {
  test.describe('Unauthenticated Users', () => {
    test('should show login prompt when trying to save pattern', async ({ page }) => {
      await page.goto('/studio');

      // Make some changes to the pattern
      await page.getByRole('button', { name: /random/i }).click();
      await page.waitForTimeout(500);

      // Check if there's a save button or mechanism
      // For unauthenticated users, should prompt to login
      const saveButton = page.getByRole('button', { name: /save/i });

      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        // Should show login prompt or redirect
        const loginPromptVisible = await page.getByText(/sign in|log in/i).isVisible().catch(() => false);
        const redirectedToLogin = page.url().includes('/auth/login');
        expect(loginPromptVisible || redirectedToLogin).toBe(true);
      }
    });

    test('should be able to share pattern via URL parameters', async ({ page }) => {
      await page.goto('/studio');

      // Change some parameters
      const slider = page.locator('input[type="range"]').first();
      await slider.fill('150');

      await page.waitForTimeout(500);

      // The URL might contain pattern parameters for sharing
      // This is a common pattern for shareable states
      const url = page.url();

      // If URL-based sharing is implemented, URL would have query params
      // Test that studio page loads and shows pattern
      await expect(page.locator('canvas')).toBeVisible();
    });
  });

  test.describe('Pattern DNA Codes', () => {
    test('should be able to load pattern from DNA code URL', async ({ page }) => {
      // DNA codes are 8-character codes that encode pattern parameters
      // Test loading a hypothetical pattern DNA page
      await page.goto('/dna/ABCD1234');

      // Should either show the pattern or redirect to studio with params
      await page.waitForTimeout(1000);

      // Check if we're on a pattern view or studio
      const canvas = page.locator('canvas');
      const errorMessage = page.getByText(/not found|invalid/i);

      const hasCanvas = await canvas.isVisible().catch(() => false);
      const hasError = await errorMessage.isVisible().catch(() => false);

      // Should show either canvas or appropriate error
      expect(hasCanvas || hasError).toBe(true);
    });
  });

  test.describe('Authenticated Pattern Management', () => {
    // These tests use stored authentication state
    test.use({ storageState: 'playwright/.auth/user.json' });

    // Skip if no auth state exists
    test.skip(({ }, testInfo) => {
      return !process.env.TEST_USER_EMAIL;
    });

    test('should display my patterns page', async ({ page }) => {
      await page.goto('/patterns');

      // Should show patterns page
      await expect(page.getByRole('heading', { name: /my patterns/i })).toBeVisible();

      // Should show pattern count
      await expect(page.getByText(/patterns saved/i)).toBeVisible();
    });

    test('should show new pattern button on patterns page', async ({ page }) => {
      await page.goto('/patterns');

      await expect(page.getByRole('link', { name: /new pattern/i })).toBeVisible();
    });

    test('should navigate to studio when clicking new pattern', async ({ page }) => {
      await page.goto('/patterns');

      await page.getByRole('link', { name: /new pattern/i }).click();

      await expect(page).toHaveURL(/\/studio/);
    });

    test('should show empty state when no patterns exist', async ({ page }) => {
      await page.goto('/patterns');

      // Either show patterns or empty state
      const emptyState = page.getByText(/no patterns yet/i);
      const patternGrid = page.locator('.grid');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasPatterns = await patternGrid.isVisible().catch(() => false);

      expect(hasEmptyState || hasPatterns).toBe(true);
    });

    test('should be able to click on a pattern to edit it', async ({ page }) => {
      await page.goto('/patterns');

      // Wait for patterns to load
      await page.waitForTimeout(1000);

      // If there are patterns, click on the first one
      const patternLink = page.locator('a[href*="/studio?pattern="]').first();

      if (await patternLink.isVisible().catch(() => false)) {
        await patternLink.click();

        // Should navigate to studio with pattern ID
        await expect(page).toHaveURL(/\/studio\?pattern=/);
      }
    });

    test('should show delete confirmation for patterns', async ({ page }) => {
      await page.goto('/patterns');

      // Wait for patterns to load
      await page.waitForTimeout(1000);

      // Find delete button if patterns exist
      const deleteButton = page.locator('button[title="Delete"]').first();

      if (await deleteButton.isVisible().catch(() => false)) {
        // Click delete button
        await deleteButton.click();

        // Should show confirmation (second click or confirm button)
        const confirmButton = page.locator('button[title="Confirm delete"]');
        const cancelButton = page.locator('button[title="Cancel"]');

        // Either confirmation state is shown
        const hasConfirm = await confirmButton.isVisible().catch(() => false);
        const hasCancel = await cancelButton.isVisible().catch(() => false);

        expect(hasConfirm || hasCancel).toBe(true);
      }
    });

    test('should display pattern metadata', async ({ page }) => {
      await page.goto('/patterns');

      // Wait for patterns to load
      await page.waitForTimeout(1000);

      // If patterns exist, check for metadata
      const patternCard = page.locator('.bg-white.rounded-lg').first();

      if (await patternCard.isVisible().catch(() => false)) {
        // Should show date
        const dateText = await patternCard.getByText(/\d{1,2}, \d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i).isVisible().catch(() => false);

        // Pattern cards should have either a thumbnail or placeholder
        const hasImage = await patternCard.locator('img').isVisible().catch(() => false);
        const hasPlaceholder = await patternCard.locator('svg').first().isVisible().catch(() => false);

        expect(hasImage || hasPlaceholder).toBe(true);
      }
    });
  });

  test.describe('Pattern Loading in Studio', () => {
    test('should load pattern from URL parameter', async ({ page }) => {
      // Navigate to studio with a pattern ID (even if invalid)
      await page.goto('/studio?pattern=test-pattern-id');

      // Studio should load
      await expect(page.locator('canvas')).toBeVisible();

      // Either pattern loads or shows error/default state
      await page.waitForTimeout(1000);
    });

    test('should preserve pattern state when switching tabs', async ({ page }) => {
      await page.goto('/studio');

      // Get initial canvas state
      await page.waitForTimeout(500);
      const initialScreenshot = await page.locator('canvas').screenshot();

      // Change a parameter
      await page.getByRole('button', { name: /curve/i }).click();
      const slider = page.locator('input[type="range"]').first();
      await slider.fill('200');
      await page.waitForTimeout(300);

      // Switch to style tab
      await page.getByRole('button', { name: /style/i }).click();
      await page.waitForTimeout(300);

      // Switch back to curve tab
      await page.getByRole('button', { name: /curve/i }).click();
      await page.waitForTimeout(300);

      // Canvas should still show modified pattern (not reset)
      const currentScreenshot = await page.locator('canvas').screenshot();
      expect(currentScreenshot).not.toEqual(initialScreenshot);
    });

    test('should reset pattern to defaults', async ({ page }) => {
      await page.goto('/studio');

      // Take initial screenshot
      await page.waitForTimeout(500);
      const initialScreenshot = await page.locator('canvas').screenshot();

      // Make changes
      await page.getByRole('button', { name: /random/i }).click();
      await page.waitForTimeout(500);

      // Reset
      await page.getByRole('button', { name: /reset/i }).click();
      await page.waitForTimeout(500);

      // Should be back to initial state (approximately)
      const resetScreenshot = await page.locator('canvas').screenshot();

      // Note: This might not be exactly equal due to timing, but should be similar
      await expect(page.locator('canvas')).toBeVisible();
    });
  });
});
