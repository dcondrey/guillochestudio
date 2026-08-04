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

/**
 * Hash a canvas screenshot rather than comparing raw buffers. On a mismatch,
 * expect(buffer).toEqual(buffer) serialises two multi-hundred-KB buffers into a
 * diff, which takes minutes; comparing short digests fails fast instead.
 */
async function fingerprint(locator: import('@playwright/test').Locator): Promise<string> {
  const buffer = await locator.screenshot();
  const { createHash } = await import('crypto');
  return createHash('sha1').update(buffer).digest('hex');
}

/**
 * Wait for the canvas to stop changing before capturing a baseline. Rendering
 * settles asynchronously, so a fixed sleep can latch a half-drawn frame and make
 * any later "returns to the original" comparison spuriously fail.
 */
async function settledFingerprint(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator
): Promise<string> {
  let previous = await fingerprint(locator);
  for (let attempt = 0; attempt < 25; attempt++) {
    await page.waitForTimeout(150);
    const current = await fingerprint(locator);
    if (current === previous) return current;
    previous = current;
  }
  throw new Error('Canvas never settled');
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
    const initial = await settledFingerprint(page, canvas);

    const slider = page.locator('input[type="range"]').first();
    await slider.fill('200');

    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(initial);
  });

  test('should expose symmetry and reflection controls', async ({ page }) => {
    await page.getByRole('button', { name: 'geometry', exact: true }).click();
    await page.getByRole('button', { name: /advanced/i }).click();

    await expect(page.getByText(/symmetry/i).first()).toBeVisible();
    await expect(page.getByLabel(/horizontal reflection/i)).toBeVisible();
    await expect(page.getByLabel(/vertical reflection/i)).toBeVisible();
    await expect(page.getByLabel(/kaleidoscope/i)).toBeVisible();
  });

  for (const mode of ['Rosette', 'Border', 'Grid']) {
    test(`should expose ${mode} settings and apply them`, async ({ page }) => {
      const canvas = page.locator('canvas');
      await page.getByRole('button', { name: 'geometry', exact: true }).click();

      const asCurve = await settledFingerprint(page, canvas);
      await page
        .getByRole('button', { name: new RegExp(mode, 'i') })
        .first()
        .click();
      await expect.poll(() => fingerprint(canvas), { timeout: 10000 }).not.toBe(asCurve);

      // Settings only exist because the engine reads them; a mode with no panel
      // would mean the mode is unconfigurable.
      await expect(page.getByText(new RegExp(`${mode} Settings`, 'i'))).toBeVisible();

      const inMode = await settledFingerprint(page, canvas);
      const sliders = page.locator('input[type="range"]');
      await sliders.nth((await sliders.count()) - 1).fill('8');
      await expect.poll(() => fingerprint(canvas), { timeout: 10000 }).not.toBe(inMode);
    });
  }

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
    // Exact names: layer rows also expose a "Select <layer>" button.
    for (const tool of ['Select (V)', 'Pan (H)', 'Direct Edit (A)', 'Measure (M)']) {
      await expect(page.getByRole('button', { name: tool, exact: true })).toBeVisible();
    }
  });

  test('should support canvas zoom with mouse wheel', async ({ page }) => {
    const canvas = page.locator('canvas');
    const beforeZoom = await settledFingerprint(page, canvas);

    await canvas.hover();
    await page.mouse.wheel(0, -100);

    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(beforeZoom);
  });

  test('should support canvas pan with the pan tool', async ({ page }) => {
    const canvas = page.locator('canvas');
    await page.getByRole('button', { name: 'Pan (H)', exact: true }).click();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas has no bounding box');
    const beforePan = await settledFingerprint(page, canvas);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(beforePan);
  });

  test('should restore the view with the reset view control', async ({ page }) => {
    const canvas = page.locator('canvas');
    const initial = await settledFingerprint(page, canvas);

    await canvas.hover();
    await page.mouse.wheel(0, -150);
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(initial);

    await page.getByRole('button', { name: /reset view/i }).click();
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).toBe(initial);
  });

  test('should hide and show a layer', async ({ page }) => {
    const canvas = page.locator('canvas');
    const visible = await settledFingerprint(page, canvas);

    await page
      .getByRole('button', { name: /^hide /i })
      .first()
      .click();
    // The composition recomputes asynchronously, so poll rather than sleeping.
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(visible);

    await page
      .getByRole('button', { name: /^show /i })
      .first()
      .click();
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).toBe(visible);
  });

  test('should reposition a layer by dragging it, and recentre it again', async ({ page }) => {
    const canvas = page.locator('canvas');

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas has no bounding box');
    const centred = await settledFingerprint(page, canvas);

    // Grab the pattern where it is drawn and drag it away from centre.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 90, { steps: 12 });
    await page.mouse.up();

    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(centred);

    // The recentre control only exists while the layer is off-centre.
    const recentre = page.getByRole('button', { name: /recentre/i }).first();
    await expect(recentre).toBeVisible();
    await recentre.click();

    await expect(page.getByRole('button', { name: /recentre/i })).toHaveCount(0);
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).toBe(centred);
  });
});
