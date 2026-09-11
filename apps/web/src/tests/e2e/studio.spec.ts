import { test, expect } from '@playwright/test';

/**
 * The studio is server-rendered before it hydrates, so clicks dispatched too
 * early land on markup with no handlers attached and are silently lost.
 *
 * Resizing the backing store is not enough of a signal: the renderer sizes the
 * canvas first and paints on a later frame, once the composition store resolves.
 * Waiting for actual pixels is what makes the first assertion of a test reliable.
 */
async function waitForStudioReady(page: import('@playwright/test').Page) {
  // First paint is not readiness: studio remounts its canvas during init, so a
  // test that starts at first paint can sample a detached, unsized or repainting
  // element. Require the SAME canvas, at the same size, painted, across several
  // consecutive polls before handing control back.
  await page.waitForFunction(
    () => {
      type Seen = { el: HTMLCanvasElement; w: number; h: number; hits: number };
      const store = window as unknown as { __studioSettled?: Seen };
      const canvas = document.querySelector('canvas');
      if (!canvas || (canvas.width === 300 && canvas.height === 150)) {
        store.__studioSettled = undefined;
        return false;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        store.__studioSettled = undefined;
        return false;
      }
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let painted = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
          painted = true;
          break;
        }
      }
      if (!painted) {
        store.__studioSettled = undefined;
        return false;
      }
      const seen = store.__studioSettled;
      if (seen && seen.el === canvas && seen.w === canvas.width && seen.h === canvas.height) {
        seen.hits += 1;
        return seen.hits >= 3;
      }
      store.__studioSettled = { el: canvas, w: canvas.width, h: canvas.height, hits: 1 };
      return false;
    },
    null,
    { timeout: 20000, polling: 100 }
  );
}

/**
 * Hash a canvas screenshot rather than comparing raw buffers. On a mismatch,
 * expect(buffer).toEqual(buffer) serialises two multi-hundred-KB buffers into a
 * diff, which takes minutes; comparing short digests fails fast instead.
 */
async function fingerprint(locator: import('@playwright/test').Locator): Promise<string> {
  // Studio remounts its canvas while initialising, so a screenshot can land on
  // an element that has just been replaced ("not attached to the DOM"). Retry:
  // the next attempt resolves whatever element is current.
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const buffer = await locator.screenshot();
      const { createHash } = await import('crypto');
      return createHash('sha1').update(buffer).digest('hex');
    } catch (error) {
      lastError = error;
      await locator.page().waitForTimeout(100);
    }
  }
  throw lastError;
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

    // The canvas can remount just after it first paints, so a single sample can
    // catch it unsized. Poll instead of sampling once.
    await expect
      .poll(async () => (await canvas.boundingBox())?.width ?? 0, { timeout: 8000 })
      .toBeGreaterThan(100);
    await expect
      .poll(async () => (await canvas.boundingBox())?.height ?? 0, { timeout: 8000 })
      .toBeGreaterThan(100);
  });

  test('should draw the pattern rather than leaving the canvas blank', async ({ page }) => {
    // Regression guard: a CSP that blocked hydration left this canvas unpainted.
    // Counting opaque pixels would not catch it — the background fill is opaque
    // on its own — so count pixels that differ from the background instead.
    const strokePixels = await page.locator('canvas').evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const [bgR, bgG, bgB] = [data[0], data[1], data[2]];
      let differing = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== bgR || data[i + 1] !== bgG || data[i + 2] !== bgB) differing++;
      }
      return differing;
    });
    expect(strokePixels).toBeGreaterThan(1000);
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

  test('should crop the pattern to a region and restore it', async ({ page }) => {
    const canvas = page.locator('canvas');
    await page.getByRole('button', { name: 'effects', exact: true }).click();

    const uncropped = await settledFingerprint(page, canvas);
    const crop = page.getByText(/crop to region/i);
    await crop.click();

    // The numeric bounds only exist while the crop is on.
    await expect(page.getByLabel('Width', { exact: true })).toBeVisible();
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).not.toBe(uncropped);

    await crop.click();
    await expect(page.getByLabel('Width', { exact: true })).toHaveCount(0);
    await expect.poll(() => fingerprint(canvas), { timeout: 8000 }).toBe(uncropped);
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
