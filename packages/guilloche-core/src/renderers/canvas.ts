import type { PatternParams } from '@guilloche/shared';
import { lerpColor } from '@guilloche/shared';
import type { GeneratedPath, Point } from '../engine.js';

export interface CanvasRenderOptions {
  width: number;
  height: number;
  scale?: number;
  backgroundColor?: string;
  strokeColor?: string;
  gradient?: [string, string];
  glow?: number;
  vignette?: boolean;
  dashed?: boolean;
  dashRatio?: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  /**
   * Clear the canvas with optional background color
   */
  clear(backgroundColor = '#ffffff'): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Render a generated path to the canvas
   */
  render(path: GeneratedPath, options: Partial<CanvasRenderOptions> = {}): void {
    const {
      backgroundColor = '#ffffff',
      strokeColor = '#1e293b',
      gradient,
      glow = 0,
      vignette = true,
      dashed = false,
      dashRatio = 1,
    } = options;

    const params = path.params;
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Clear and fill background
    this.clear(backgroundColor);

    // Save context state
    this.ctx.save();

    // Center the canvas
    this.ctx.translate(cx, cy);

    // Setup stroke style
    this.ctx.lineWidth = params.lw;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    // Setup glow effect
    if (glow > 0) {
      this.ctx.shadowColor = strokeColor;
      this.ctx.shadowBlur = glow * 2;
    }

    // Setup dash pattern
    if (dashed) {
      const dash = params.lw * 8 * dashRatio;
      const gap = params.lw * 8;
      this.ctx.setLineDash([dash, gap]);
    } else {
      this.ctx.setLineDash([]);
    }

    // Create gradient if needed
    if (gradient) {
      const grd = this.ctx.createLinearGradient(-cx, -cy, cx, cy);
      grd.addColorStop(0, gradient[0]);
      grd.addColorStop(1, gradient[1]);
      this.ctx.strokeStyle = grd;
    } else {
      this.ctx.strokeStyle = strokeColor;
    }

    // Draw all path segments
    this.ctx.beginPath();
    for (const segment of path.segments) {
      if (segment.points.length === 0) continue;

      this.ctx.moveTo(segment.points[0].x, segment.points[0].y);
      for (let i = 1; i < segment.points.length; i++) {
        this.ctx.lineTo(segment.points[i].x, segment.points[i].y);
      }
    }
    this.ctx.stroke();

    // Restore context
    this.ctx.restore();

    // Reset shadow
    this.ctx.shadowBlur = 0;

    // Apply vignette effect
    if (vignette) {
      this.applyVignette();
    }
  }

  /**
   * Render path segment by segment for progressive display
   */
  renderSegment(segment: { points: Point[]; strokeWidth?: number }, options: {
    strokeColor?: string;
    gradient?: [string, string];
  } = {}): void {
    const { strokeColor = '#1e293b', gradient } = options;

    if (segment.points.length === 0) return;

    this.ctx.save();
    this.ctx.translate(this.width / 2, this.height / 2);

    this.ctx.lineWidth = segment.strokeWidth || 1;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    if (gradient) {
      const grd = this.ctx.createLinearGradient(-this.width / 2, -this.height / 2, this.width / 2, this.height / 2);
      grd.addColorStop(0, gradient[0]);
      grd.addColorStop(1, gradient[1]);
      this.ctx.strokeStyle = grd;
    } else {
      this.ctx.strokeStyle = strokeColor;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(segment.points[0].x, segment.points[0].y);
    for (let i = 1; i < segment.points.length; i++) {
      this.ctx.lineTo(segment.points[i].x, segment.points[i].y);
    }
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Apply vignette effect to canvas
   */
  private applyVignette(intensity = 0.1): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(this.width, this.height);

    this.ctx.save();
    const gradient = this.ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 0.85);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  /**
   * Export canvas as data URL
   */
  toDataURL(format: 'png' | 'jpeg' = 'png', quality = 0.95): string {
    return this.ctx.canvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * Export canvas as blob
   */
  async toBlob(format: 'png' | 'jpeg' = 'png', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.ctx.canvas.toBlob(resolve, `image/${format}`, quality);
    });
  }

  /**
   * Get the underlying 2D context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
