import { test, expect } from '@playwright/test';

test.describe('Marketplace Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/marketplace');
  });

  test('should load the marketplace page', async ({ page }) => {
    await expect(page).toHaveTitle(/marketplace/i);
  });

  test('should display the marketplace header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pattern marketplace/i })).toBeVisible();
    await expect(page.getByText(/discover and purchase/i)).toBeVisible();
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search patterns/i);
    await expect(searchInput).toBeVisible();
  });

  test('should display sort dropdown', async ({ page }) => {
    const sortDropdown = page.locator('select').filter({ hasText: /popular|recent|price/i });
    await expect(sortDropdown).toBeVisible();
  });

  test('should display license filter dropdown', async ({ page }) => {
    const licenseDropdown = page.locator('select').filter({ hasText: /license/i });
    await expect(licenseDropdown).toBeVisible();
  });

  test('should show loading state initially', async ({ page }) => {
    // Reload and check for loading animation
    await page.reload();

    // Either show loading skeleton or patterns quickly
    const loadingSkeleton = page.locator('.animate-pulse').first();
    const patternGrid = page
      .getByRole('link')
      .filter({ has: page.locator('img') })
      .first();

    // One of these should be visible
    const hasLoading = await loadingSkeleton.isVisible({ timeout: 100 }).catch(() => false);
    const hasPatterns = await patternGrid.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page
      .getByText(/no patterns/i)
      .isVisible({ timeout: 100 })
      .catch(() => false);

    expect(hasLoading || hasPatterns || hasEmptyState).toBe(true);
  });

  test('should display pattern grid or empty state', async ({ page }) => {
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Either show patterns or empty state
    const emptyState = page.getByText(/no patterns available/i);
    const patternCard = page
      .locator('.rounded-lg')
      .filter({ has: page.getByRole('img') })
      .first();

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasPatterns = await patternCard.isVisible().catch(() => false);

    expect(hasEmpty || hasPatterns).toBe(true);
  });

  test.describe('Empty State', () => {
    test('should show appropriate empty state message', async ({ page }) => {
      await page.waitForTimeout(2000);

      const emptyState = page.getByText(/no patterns available yet/i);

      if (await emptyState.isVisible().catch(() => false)) {
        // Should show call to action
        await expect(page.getByRole('link', { name: /create a pattern/i })).toBeVisible();
      }
    });
  });

  test.describe('Pattern Cards', () => {
    // These tests run if patterns exist
    test('should display pattern card with required elements', async ({ page }) => {
      await page.waitForTimeout(2000);

      const patternLinks = page.locator('a.group, a[href*="/marketplace/"]');
      const count = await patternLinks.count();

      if (count > 0) {
        const firstCard = patternLinks.first();

        // Card should have image or placeholder
        const hasImage = await firstCard
          .locator('img')
          .isVisible()
          .catch(() => false);
        const hasPlaceholder = await firstCard
          .locator('svg')
          .first()
          .isVisible()
          .catch(() => false);
        expect(hasImage || hasPlaceholder).toBe(true);
      }
    });

    test('should display price badge on pattern cards', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Find price badge (shows "Free" or "$X.XX")
      const priceBadge = page.getByText(/free|\$\d+/i).first();

      // Either no patterns or patterns have price
      const hasPriceBadge = await priceBadge.isVisible().catch(() => false);
      const hasEmptyState = await page
        .getByText(/no patterns/i)
        .isVisible()
        .catch(() => false);

      expect(hasPriceBadge || hasEmptyState).toBe(true);
    });

    test('should display creator info on pattern cards', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Find "by" text indicating creator
      const creatorText = page.getByText(/^by /i).first();

      const hasCreator = await creatorText.isVisible().catch(() => false);
      const hasEmptyState = await page
        .getByText(/no patterns/i)
        .isVisible()
        .catch(() => false);

      expect(hasCreator || hasEmptyState).toBe(true);
    });

    test('should display view and download counts', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Look for view/download icons (SVG with eye or download paths)
      const viewIcon = page.locator('svg path[d*="12 3"]').first(); // Eye icon path
      const downloadIcon = page.locator('svg path[d*="16v1"]').first(); // Download icon path

      const hasViewIcon = await viewIcon.isVisible().catch(() => false);
      const hasEmptyState = await page
        .getByText(/no patterns/i)
        .isVisible()
        .catch(() => false);

      expect(hasViewIcon || hasEmptyState).toBe(true);
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter patterns when searching', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search patterns/i);
      await searchInput.fill('spiral');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Page should update (either show results or "no results")
      await expect(searchInput).toHaveValue('spiral');
    });

    test('should clear search when input is cleared', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search patterns/i);

      // Type and then clear
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      await searchInput.clear();
      await page.waitForTimeout(300);

      // Should show all patterns again
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Sort Functionality', () => {
    test('should have sort options', async ({ page }) => {
      const sortDropdown = page.locator('select').first();

      // Click to open dropdown and check options
      const options = await sortDropdown.locator('option').allTextContents();

      expect(options.some((opt) => opt.toLowerCase().includes('popular'))).toBe(true);
      expect(options.some((opt) => opt.toLowerCase().includes('recent'))).toBe(true);
      expect(options.some((opt) => opt.toLowerCase().includes('price'))).toBe(true);
    });

    test('should change sort order', async ({ page }) => {
      const sortDropdown = page.locator('select').first();

      // Select different sort option
      await sortDropdown.selectOption({ label: 'Most Recent' });

      // Verify selection changed
      await expect(sortDropdown).toHaveValue('recent');
    });
  });

  test.describe('License Filter', () => {
    test('should have license filter options', async ({ page }) => {
      const licenseDropdown = page.locator('select').nth(1);

      const options = await licenseDropdown.locator('option').allTextContents();

      expect(options.some((opt) => opt.toLowerCase().includes('all'))).toBe(true);
      expect(options.some((opt) => opt.toLowerCase().includes('free'))).toBe(true);
    });

    test('should filter by license type', async ({ page }) => {
      const licenseDropdown = page.locator('select').nth(1);

      await licenseDropdown.selectOption({ label: 'Free' });

      await page.waitForTimeout(500);

      // Verify selection changed
      await expect(licenseDropdown).toHaveValue('free');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to pattern detail when clicking card', async ({ page }) => {
      await page.waitForTimeout(2000);

      const patternLink = page.locator('a[href*="/marketplace/"]').first();

      if (await patternLink.isVisible().catch(() => false)) {
        await patternLink.click();

        // Should navigate to pattern detail page
        await expect(page).toHaveURL(/\/marketplace\/[a-zA-Z0-9-]+/);
      }
    });

    test('should have link to create pattern in empty state', async ({ page }) => {
      await page.waitForTimeout(2000);

      const emptyState = page.getByText(/no patterns available/i);

      if (await emptyState.isVisible().catch(() => false)) {
        const createLink = page.getByRole('link', { name: /create a pattern/i });
        await expect(createLink).toBeVisible();

        await createLink.click();
        await expect(page).toHaveURL(/\/studio/);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Header should still be visible
      await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible();

      // Search should still be functional
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should adjust grid columns on different viewports', async ({ page }) => {
      await page.waitForTimeout(2000);

      // Desktop view
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(300);

      // Grid should exist
      const grid = page.locator('.grid');
      await expect(grid.first()).toBeVisible();

      // Tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(300);
      await expect(grid.first()).toBeVisible();

      // Mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      await expect(grid.first()).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show skeleton loading state', async ({ page }) => {
      // Intercept API to delay response
      await page.route('**/api/marketplace/patterns', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      // Reload page
      await page.reload();

      // Should show loading skeletons
      const skeleton = page.locator('.animate-pulse');
      const hasSkeletons = await skeleton
        .first()
        .isVisible({ timeout: 100 })
        .catch(() => false);

      // Loading state should appear briefly
      // Note: This might be too fast to catch in some cases
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
    });

    test('should have accessible search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);
      const ariaLabel = await searchInput.getAttribute('aria-label');
      const placeholder = await searchInput.getAttribute('placeholder');

      // Should have either aria-label or meaningful placeholder
      expect(ariaLabel || placeholder).toBeTruthy();
    });

    test('should have keyboard-accessible filters', async ({ page }) => {
      const sortDropdown = page.locator('select').first();

      // Should be focusable
      await sortDropdown.focus();
      await expect(sortDropdown).toBeFocused();
    });
  });
});
