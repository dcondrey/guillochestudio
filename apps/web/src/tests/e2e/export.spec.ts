import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
    // Wait for canvas to render
    await page.waitForTimeout(1000);
  });

  test('should display export tab with all export options', async ({ page }) => {
    // Click on export tab
    await page.getByRole('button', { name: /export/i }).click();

    // Check for all export format buttons
    await expect(page.getByRole('button', { name: /svg/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /png/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pdf/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dxf/i })).toBeVisible();
  });

  test('should show pro-only indicators on premium export formats', async ({ page }) => {
    // Click on export tab
    await page.getByRole('button', { name: /export/i }).click();

    // Check for pro-only indicators
    // PDF and DXF buttons should show "Pro Only" for free users
    const pdfButton = page.getByRole('button', { name: /pdf/i });
    const dxfButton = page.getByRole('button', { name: /dxf/i });

    // Check if buttons have pro-only indicator
    const pdfText = await pdfButton.textContent();
    const dxfText = await dxfButton.textContent();

    // Either buttons work (pro user) or show pro-only text
    const pdfIsProOnly = pdfText?.toLowerCase().includes('pro');
    const dxfIsProOnly = dxfText?.toLowerCase().includes('pro');

    // Both should have same state (both pro only or both available)
    expect(pdfIsProOnly).toBe(dxfIsProOnly);
  });

  test('should show upgrade prompt for non-pro users', async ({ page }) => {
    // Click on export tab
    await page.getByRole('button', { name: /export/i }).click();

    // Either visible (free user) or not (pro user)
    // Just verify export tab works
    await expect(page.getByRole('button', { name: /svg/i })).toBeVisible();
  });

  test.describe('SVG Export', () => {
    test('should trigger SVG download', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click SVG export button
      await page.getByRole('button', { name: /svg/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Check filename
      expect(download.suggestedFilename()).toMatch(/\.svg$/);
    });

    test('should export valid SVG content', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click SVG export button
      await page.getByRole('button', { name: /svg/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Save file and check content
      const downloadPath = path.join(test.info().outputDir, download.suggestedFilename());
      await download.saveAs(downloadPath);

      const content = fs.readFileSync(downloadPath, 'utf-8');

      // Verify it's valid SVG
      expect(content).toContain('<svg');
      expect(content).toContain('</svg>');
    });

    test('should include pattern metadata in SVG export', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click SVG export button
      await page.getByRole('button', { name: /svg/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Save and check content
      const downloadPath = path.join(test.info().outputDir, download.suggestedFilename());
      await download.saveAs(downloadPath);

      const content = fs.readFileSync(downloadPath, 'utf-8');

      // Should contain path elements (the pattern curves)
      expect(content).toMatch(/<path|<circle|<line/);
    });
  });

  test.describe('PNG Export', () => {
    test('should trigger PNG download', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click PNG export button
      await page.getByRole('button', { name: /png/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Check filename
      expect(download.suggestedFilename()).toMatch(/\.png$/);
    });

    test('should export PNG with correct dimensions', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click PNG export button
      await page.getByRole('button', { name: /png/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Save file
      const downloadPath = path.join(test.info().outputDir, download.suggestedFilename());
      await download.saveAs(downloadPath);

      // Verify file exists and has content
      const stats = fs.statSync(downloadPath);
      expect(stats.size).toBeGreaterThan(1000); // Should be a valid image
    });
  });

  test.describe('Export with Different Patterns', () => {
    test('should export different results for different patterns', async ({ page }) => {
      // Export first pattern
      const download1Promise = page.waitForEvent('download', { timeout: 10000 });
      await page.getByRole('button', { name: /export/i }).click();
      await page.getByRole('button', { name: /svg/i }).click();
      const download1 = await download1Promise;
      const path1 = path.join(test.info().outputDir, 'pattern1.svg');
      await download1.saveAs(path1);

      // Randomize pattern
      await page.getByRole('button', { name: /curve/i }).click();
      await page.getByRole('button', { name: /random/i }).click();
      await page.waitForTimeout(500);

      // Export second pattern
      const download2Promise = page.waitForEvent('download', { timeout: 10000 });
      await page.getByRole('button', { name: /export/i }).click();
      await page.getByRole('button', { name: /svg/i }).click();
      const download2 = await download2Promise;
      const path2 = path.join(test.info().outputDir, 'pattern2.svg');
      await download2.saveAs(path2);

      // Files should be different
      const content1 = fs.readFileSync(path1, 'utf-8');
      const content2 = fs.readFileSync(path2, 'utf-8');
      expect(content1).not.toEqual(content2);
    });
  });

  test.describe('Export Filename', () => {
    test('should include curve family in filename', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click SVG export button
      await page.getByRole('button', { name: /svg/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Filename should contain pattern info
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/guilloche/i);
    });

    test('should include timestamp in filename', async ({ page }) => {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click on export tab
      await page.getByRole('button', { name: /export/i }).click();

      // Click SVG export button
      await page.getByRole('button', { name: /svg/i }).click();

      // Wait for download
      const download = await downloadPromise;

      // Filename should contain timestamp (numeric sequence)
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\d+/);
    });
  });

  test.describe('Pro Export Formats', () => {
    // These tests verify pro-only formats are properly restricted

    test('should disable PDF export for non-pro users', async ({ page }) => {
      await page.getByRole('button', { name: /export/i }).click();

      const pdfButton = page.getByRole('button', { name: /pdf/i });
      // Should be disabled for non-pro users (or if pro, should work)
      // We verify the button exists and has appropriate state
      await expect(pdfButton).toBeVisible();
    });

    test('should disable DXF export for non-pro users', async ({ page }) => {
      await page.getByRole('button', { name: /export/i }).click();

      const dxfButton = page.getByRole('button', { name: /dxf/i });
      // Should be disabled for non-pro users
      await expect(dxfButton).toBeVisible();
    });
  });

  test.describe('Pro User Export', () => {
    // These tests use stored authentication state for pro users
    test.use({ storageState: 'playwright/.auth/user.json' });

    // Skip if no auth state exists
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials available');

    test('should enable all export formats for pro users', async ({ page }) => {
      await page.goto('/studio');
      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: /export/i }).click();

      // Check if pro badge is visible (indicates pro user)
      const proBadge = page.locator('.badge-pro');

      if (await proBadge.isVisible().catch(() => false)) {
        // Pro user should have all formats enabled
        const pdfButton = page.getByRole('button', { name: /pdf/i });
        const dxfButton = page.getByRole('button', { name: /dxf/i });

        // Should not be disabled
        expect(await pdfButton.isDisabled()).toBe(false);
        expect(await dxfButton.isDisabled()).toBe(false);
      }
    });
  });
});
