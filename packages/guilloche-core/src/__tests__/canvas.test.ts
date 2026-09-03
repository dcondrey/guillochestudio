import { describe, it, expect } from 'vitest';
import { CanvasRenderer } from '../renderers/canvas.js';

/**
 * Minimal CanvasRenderingContext2D mock. `clear()` resets the transform to
 * identity before clearing/filling, so the backing-store pixel dimensions
 * (ctx.canvas.width/height) — not the CSS-logical width/height passed to the
 * constructor — must bound the cleared region on a DPR-scaled canvas.
 */
function createMockContext(backingWidth: number, backingHeight: number) {
  const calls: { clearRect?: number[]; fillRect?: number[] } = {};
  return {
    ctx: {
      canvas: { width: backingWidth, height: backingHeight },
      save() {},
      restore() {},
      setTransform() {},
      clearRect(x: number, y: number, w: number, h: number) {
        calls.clearRect = [x, y, w, h];
      },
      fillRect(x: number, y: number, w: number, h: number) {
        calls.fillRect = [x, y, w, h];
      },
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

describe('CanvasRenderer.clear', () => {
  it('clears the full backing-store area on a DPR-scaled canvas', () => {
    // CSS-logical size 800x600, but a DPR of 2 means the real backing store is 1600x1200.
    const { ctx, calls } = createMockContext(1600, 1200);
    const renderer = new CanvasRenderer(ctx, 800, 600);

    renderer.clear('#ffffff');

    expect(calls.clearRect).toEqual([0, 0, 1600, 1200]);
    expect(calls.fillRect).toEqual([0, 0, 1600, 1200]);
  });
});
