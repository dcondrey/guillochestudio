import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export is a modal, not a tab: the header "Export" button opens a dialog, the
 * format buttons inside it only *select* a format, and a single submit button
 * performs the download. Selectors are scoped to the dialog because the header
 * button and the submit button share the word "Export".
 */
function dialog(page: Page) {
  return page.getByRole('dialog');
}

async function openExportPanel(page: Page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

async function chooseFormat(page: Page, format: RegExp) {
  await dialog(page).getByRole('button', { name: format }).click();
}

/** Click the submit button and return the resulting download. */
async function submitExport(page: Page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await dialog(page)
    .getByRole('button', { name: /^export /i })
    .click();
  return downloadPromise;
}

async function exportAs(page: Page, format: RegExp) {
  await openExportPanel(page);
  await chooseFormat(page, format);
  return submitExport(page);
}

async function saveDownload(page: Page, format: RegExp, filename: string) {
  const download = await exportAs(page, format);
  const target = path.join(test.info().outputDir, filename);
  await download.saveAs(target);
  return { download, target };
}

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
    // The export reads the rendered composition, so wait for the first paint.
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(1000);
  });

  test('should offer every supported export format', async ({ page }) => {
    await openExportPanel(page);

    await expect(dialog(page).getByRole('button', { name: /svg/i })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: /png/i })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: /pdf/i })).toBeVisible();
  });

  test('should mark the selected format for assistive technology', async ({ page }) => {
    await openExportPanel(page);

    // PNG is the default selection.
    await expect(dialog(page).getByRole('button', { name: /png/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await chooseFormat(page, /svg/i);
    await expect(dialog(page).getByRole('button', { name: /svg/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(dialog(page).getByRole('button', { name: /png/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  test('should close the export panel after a successful export', async ({ page }) => {
    await exportAs(page, /svg/i);
    await expect(dialog(page)).toBeHidden();
  });

  test.describe('SVG Export', () => {
    test('should trigger SVG download', async ({ page }) => {
      const download = await exportAs(page, /svg/i);
      expect(download.suggestedFilename()).toMatch(/\.svg$/);
    });

    test('should export valid SVG content', async ({ page }) => {
      const { target } = await saveDownload(page, /svg/i, 'pattern.svg');
      const content = fs.readFileSync(target, 'utf-8');

      expect(content).toContain('<svg');
      expect(content).toContain('</svg>');
    });

    test('should include pattern geometry in SVG export', async ({ page }) => {
      const { target } = await saveDownload(page, /svg/i, 'geometry.svg');
      const content = fs.readFileSync(target, 'utf-8');

      expect(content).toMatch(/<path|<circle|<line/);
      // Geometry, not just an empty path element.
      expect(content).toMatch(/d="M[^"]{20,}/);
    });

    test('should export a group per visible layer', async ({ page }) => {
      const { target: single } = await saveDownload(page, /svg/i, 'one-layer.svg');
      expect(fs.readFileSync(single, 'utf-8').match(/<g id="layer-/g)).toHaveLength(1);

      // Add a second layer; the export must contain both, not just the active one.
      await page.getByRole('button', { name: 'Add layer' }).click();
      await page.waitForTimeout(500);

      const { target: both } = await saveDownload(page, /svg/i, 'two-layers.svg');
      expect(fs.readFileSync(both, 'utf-8').match(/<g id="layer-/g)).toHaveLength(2);
    });
  });

  test.describe('PNG Export', () => {
    test('should trigger PNG download', async ({ page }) => {
      const download = await exportAs(page, /png/i);
      expect(download.suggestedFilename()).toMatch(/\.png$/);
    });

    test('should export a non-trivial PNG', async ({ page }) => {
      const { target } = await saveDownload(page, /png/i, 'pattern.png');
      expect(fs.statSync(target).size).toBeGreaterThan(1000);
    });
  });

  test.describe('PDF Export', () => {
    test('should trigger PDF download', async ({ page }) => {
      const download = await exportAs(page, /pdf/i);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test('should export a valid PDF', async ({ page }) => {
      const { target } = await saveDownload(page, /pdf/i, 'pattern.pdf');
      const buffer = fs.readFileSync(target);

      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      // NaN coordinates from degenerate bounds would land in the content stream.
      expect(buffer.toString('latin1')).not.toContain('NaN');
    });
  });

  test.describe('Export Filename', () => {
    test('should name the file after the pattern', async ({ page }) => {
      const download = await exportAs(page, /svg/i);
      expect(download.suggestedFilename()).toMatch(/^guilloche-/i);
    });

    test('should make each export filename unique', async ({ page }) => {
      const first = await exportAs(page, /svg/i);
      // The timestamp has second resolution, so two exports inside one second
      // would legitimately collide.
      await page.waitForTimeout(1100);
      const second = await exportAs(page, /svg/i);

      expect(first.suggestedFilename()).toMatch(/\d/);
      expect(second.suggestedFilename()).not.toEqual(first.suggestedFilename());
    });
  });

  test.describe('Export with Different Patterns', () => {
    test('should export different results for different patterns', async ({ page }) => {
      const { target: first } = await saveDownload(page, /svg/i, 'pattern1.svg');

      // Nudge a geometry slider; the exported path must follow the parameter.
      const slider = page.locator('input[type="range"]').first();
      await slider.focus();
      for (let i = 0; i < 8; i++) await slider.press('ArrowRight');
      await page.waitForTimeout(800);

      const { target: second } = await saveDownload(page, /svg/i, 'pattern2.svg');

      expect(fs.readFileSync(first, 'utf-8')).not.toEqual(fs.readFileSync(second, 'utf-8'));
    });
  });
});
