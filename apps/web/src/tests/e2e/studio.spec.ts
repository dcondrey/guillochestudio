import { test, expect } from '@playwright/test';

/**
 * The studio is server-rendered before it hydrates, so clicks dispatched too
 * early land on markup with no handlers attached and are silently lost. The
 * canvas backing store is only resized by the client renderer, which makes it a
 * reliable hydration signal.
 */
async function waitForStudioReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      return !!canvas && (canvas.width !== 300 || canvas.height !== 150);
    },
    null,
    { timeout: 15000 }
  );
}

test.describe('Studio Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
    await waitForStudioReady(page);
  });

  test('should render the pattern canvas', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const boundingBox = await canvas.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(100);
    expect(boundingBox?.height).toBeGreaterThan(100);
  });

  test('should draw the pattern rather than leaving the canvas blank', async ({ page }) => {
    // Regression guard: a CSP that blocked hydration left this canvas at its
    // default 300x150 backing store with nothing painted.
    const painted = await page.locator('canvas').evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) opaque++;
      return opaque;
    });
    expect(painted).toBeGreaterThan(0);
  });

  test('should display the inspector tabs', async ({ page }) => {
    for (const tab of ['geometry', 'style', 'effects', 'security']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('should show curve family selector', async ({ page }) => {
    await page.getByRole('button', { name: 'geometry', exact: true }).click();
    await expect(page.getByLabel(/curve family/i)).toBeVisible();
  });

  test('should have parameter sliders in the geometry tab', async ({ page }) => {
    await page.getByRole('button', { name: 'geometry', exact: true }).click();

    await expect(page.getByText(/outer radius/i)).toBeVisible();
    await expect(page.getByText(/inner radius/i)).toBeVisible();
    await expect(page.getByText(/pen distance/i)).toBeVisible();
  });

  test('should update pattern when changing parameters', async ({ page }) => {
    const canvas = page.locator('canvas');
    await page.waitForTimeout(500);
    const initialScreenshot = await canvas.screenshot();

    const slider = page.locator('input[type="range"]').first();
    await slider.fill('200');
    await page.waitForTimeout(500);

    expect(await canvas.screenshot()).not.toEqual(initialScreenshot);
  });

  test('should expose symmetry and reflection controls', async ({ page }) => {
    await page.getByRole('button', { name: 'geometry', exact: true }).click();
    await page.getByRole('button', { name: /advanced/i }).click();

    await expect(page.getByText(/symmetry/i).first()).toBeVisible();
    await expect(page.getByLabel(/horizontal reflection/i)).toBeVisible();
    await expect(page.getByLabel(/vertical reflection/i)).toBeVisible();
    await expect(page.getByLabel(/kaleidoscope/i)).toBeVisible();
  });

  test('should show stroke and colour controls in the style tab', async ({ page }) => {
    await page.getByRole('button', { name: 'style', exact: true }).click();

    await expect(page.getByText(/stroke & color/i)).toBeVisible();
    await expect(page.getByLabel(/blend mode/i)).toBeVisible();
    await expect(page.getByText(/dashed line/i)).toBeVisible();
  });

  test('should show background and gradient controls in the effects tab', async ({ page }) => {
    await page.getByRole('button', { name: 'effects', exact: true }).click();
    await expect(page.getByText(/background/i).first()).toBeVisible();
  });

  test('should offer export formats from the export panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();

    await expect(page.getByRole('heading', { name: /export pattern/i })).toBeVisible();
    for (const format of ['PNG', 'SVG', 'PDF']) {
      await expect(page.getByRole('button', { name: format, exact: false }).first()).toBeVisible();
    }
  });

  test('should have undo, redo and reset view controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^undo$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^redo$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reset view/i })).toBeVisible();
  });

  test('should expose the drawing tools', async ({ page }) => {
    for (const tool of [/select/i, /pan/i, /measure/i]) {
      await expect(page.getByRole('button', { name: tool })).toBeVisible();
    }
  });

  test('should support canvas zoom with mouse wheel', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    const beforeZoom = await canvas.screenshot();
    await canvas.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);

    expect(await canvas.screenshot()).not.toEqual(beforeZoom);
  });

  test('should support canvas pan with the pan tool', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /pan/i }).click();
    await page.waitForTimeout(500);

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas has no bounding box');

    const beforePan = await canvas.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    expect(await canvas.screenshot()).not.toEqual(beforePan);
  });

  test('should restore the view with the reset view control', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    const initial = await canvas.screenshot();

    await canvas.hover();
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(300);
    expect(await canvas.screenshot()).not.toEqual(initial);

    await page.getByRole('button', { name: /reset view/i }).click();
    await page.waitForTimeout(400);
    expect(await canvas.screenshot()).toEqual(initial);
  });
});
