import { test, expect } from '@playwright/test';

test.describe('Studio Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio');
  });

  test('should load the studio page successfully', async ({ page }) => {
    // Check the page title
    await expect(page).toHaveTitle(/Studio.*Guilloch[ée]/i);
  });

  test('should render the pattern canvas', async ({ page }) => {
    // Wait for canvas to be present and visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Canvas should have reasonable dimensions
    const boundingBox = await canvas.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(100);
    expect(boundingBox?.height).toBeGreaterThan(100);
  });

  test('should display the control panel with tabs', async ({ page }) => {
    // Check for control tabs
    await expect(page.getByRole('button', { name: /curve/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /style/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ai/i })).toBeVisible();
  });

  test('should show curve family selector', async ({ page }) => {
    // Click on curve tab if not already active
    await page.getByRole('button', { name: /curve/i }).click();

    // Check for curve family dropdown
    const curveSelect = page.locator('select').first();
    await expect(curveSelect).toBeVisible();
  });

  test('should have parameter sliders in curve tab', async ({ page }) => {
    // Click on curve tab
    await page.getByRole('button', { name: /curve/i }).click();

    // Check for parameter sliders
    await expect(page.getByText(/outer radius/i)).toBeVisible();
    await expect(page.getByText(/inner radius/i)).toBeVisible();
    await expect(page.getByText(/pen offset/i)).toBeVisible();
    await expect(page.getByText(/frequency/i)).toBeVisible();
  });

  test('should update pattern when changing parameters', async ({ page }) => {
    // Get the canvas
    const canvas = page.locator('canvas');

    // Take initial screenshot of canvas
    await page.waitForTimeout(500); // Wait for initial render
    const initialScreenshot = await canvas.screenshot();

    // Change a parameter (R - outer radius)
    const slider = page.locator('input[type="range"]').first();
    await slider.fill('200');

    // Wait for re-render
    await page.waitForTimeout(500);

    // Take another screenshot
    const updatedScreenshot = await canvas.screenshot();

    // Screenshots should be different
    expect(initialScreenshot).not.toEqual(updatedScreenshot);
  });

  test('should show symmetry controls', async ({ page }) => {
    // Click on curve tab
    await page.getByRole('button', { name: /curve/i }).click();

    // Check for symmetry section
    await expect(page.getByText(/symmetry/i).first()).toBeVisible();
    await expect(page.getByText(/horizontal reflection/i)).toBeVisible();
    await expect(page.getByText(/vertical reflection/i)).toBeVisible();
    await expect(page.getByText(/kaleidoscope/i)).toBeVisible();
  });

  test('should show style controls when style tab is clicked', async ({ page }) => {
    // Click on style tab
    await page.getByRole('button', { name: /style/i }).click();

    // Check for color controls
    await expect(page.getByText(/background/i)).toBeVisible();
    await expect(page.getByText(/start color/i)).toBeVisible();
    await expect(page.getByText(/end color/i)).toBeVisible();
    await expect(page.getByText(/use gradient/i)).toBeVisible();
  });

  test('should show stroke controls in style tab', async ({ page }) => {
    // Click on style tab
    await page.getByRole('button', { name: /style/i }).click();

    // Check for stroke controls
    await expect(page.getByText(/stroke/i)).toBeVisible();
    await expect(page.getByText(/dashed lines/i)).toBeVisible();
  });

  test('should show export options when export tab is clicked', async ({ page }) => {
    // Click on export tab
    await page.getByRole('button', { name: /export/i }).click();

    // Check for export buttons
    await expect(page.getByRole('button', { name: /svg/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /png/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pdf/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dxf/i })).toBeVisible();
  });

  test('should show presets in curve tab', async ({ page }) => {
    // Click on curve tab
    await page.getByRole('button', { name: /curve/i }).click();

    // Check for presets section
    await expect(page.getByText(/presets/i)).toBeVisible();
  });

  test('should randomize pattern when clicking random button', async ({ page }) => {
    // Get the canvas
    const canvas = page.locator('canvas');

    // Take initial screenshot
    await page.waitForTimeout(500);
    const initialScreenshot = await canvas.screenshot();

    // Click randomize button
    await page.getByRole('button', { name: /random/i }).click();

    // Wait for re-render
    await page.waitForTimeout(500);

    // Take another screenshot
    const randomizedScreenshot = await canvas.screenshot();

    // Pattern should change
    expect(initialScreenshot).not.toEqual(randomizedScreenshot);
  });

  test('should have undo/redo buttons', async ({ page }) => {
    // Check for undo/redo buttons in header
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /redo/i })).toBeVisible();
  });

  test('should have reset button in control panel', async ({ page }) => {
    // Check for reset button
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible();
  });

  test('should show hint bar with controls info', async ({ page }) => {
    // Check for hint bar at bottom of canvas
    await expect(page.getByText(/wheel.*zoom/i)).toBeVisible();
    await expect(page.getByText(/drag.*pan/i)).toBeVisible();
  });

  test('should collapse and expand control panel', async ({ page }) => {
    // Find the collapse button (the < or > character)
    const collapseButton = page.locator('aside button').filter({ hasText: /[<>‹›]/ }).first();

    // Check initial state - panel should be expanded
    const aside = page.locator('aside');
    const initialWidth = await aside.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(initialWidth).toBeGreaterThan(200);

    // Click collapse button
    await collapseButton.click();
    await page.waitForTimeout(300); // Wait for animation

    // Panel should be collapsed (narrower)
    const collapsedWidth = await aside.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(collapsedWidth).toBeLessThan(100);

    // Click to expand again
    await collapseButton.click();
    await page.waitForTimeout(300);

    // Panel should be expanded again
    const expandedWidth = await aside.evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(expandedWidth).toBeGreaterThan(200);
  });

  test('should support canvas zoom with mouse wheel', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });

    // Take screenshot before zoom
    const beforeZoom = await canvas.screenshot();

    // Perform wheel zoom on canvas
    await canvas.hover();
    await page.mouse.wheel(0, -100); // Zoom in

    await page.waitForTimeout(300);

    // Take screenshot after zoom
    const afterZoom = await canvas.screenshot();

    // Visual should have changed (zoomed)
    expect(beforeZoom).not.toEqual(afterZoom);
  });

  test('should support canvas pan with drag', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas has no bounding box');

    // Take screenshot before pan
    const beforePan = await canvas.screenshot();

    // Perform drag on canvas
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Take screenshot after pan
    const afterPan = await canvas.screenshot();

    // Visual should have changed (panned)
    expect(beforePan).not.toEqual(afterPan);
  });

  test('should reset view on double-click', async ({ page }) => {
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });

    // First zoom in
    await canvas.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);

    const zoomedScreenshot = await canvas.screenshot();

    // Double-click to reset
    await canvas.dblclick();
    await page.waitForTimeout(300);

    const resetScreenshot = await canvas.screenshot();

    // View should have changed back
    expect(zoomedScreenshot).not.toEqual(resetScreenshot);
  });
});
