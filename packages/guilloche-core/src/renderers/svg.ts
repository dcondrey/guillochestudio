import type { PatternParams } from '@guilloche/shared';
import type { GeneratedPath, Point } from '../engine.js';

export interface SVGRenderOptions {
  includeMetadata?: boolean;
  optimized?: boolean;
  backgroundColor?: string;
  strokeColor?: string;
  gradient?: [string, string];
  glow?: number;
  dashed?: boolean;
  dashRatio?: number;
}

export class SVGRenderer {
  /**
   * Render a generated path to SVG string
   */
  render(path: GeneratedPath, options: SVGRenderOptions = {}): string {
    const {
      includeMetadata = true,
      backgroundColor,
      strokeColor = '#1e293b',
      gradient,
      glow = 0,
      dashed = false,
      dashRatio = 1,
    } = options;

    const params = path.params;
    const { minX, minY, maxX, maxY } = path.bounds;

    // Add padding
    const paddingX = (maxX - minX) * 0.05;
    const paddingY = (maxY - minY) * 0.05;
    const viewMinX = minX - paddingX;
    const viewMinY = minY - paddingY;
    const width = maxX - minX + paddingX * 2;
    const height = maxY - minY + paddingY * 2;

    // Build path data
    const pathData = this.buildPathData(path.segments);

    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${viewMinX.toFixed(2)} ${viewMinY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}"
     width="${width.toFixed(0)}"
     height="${height.toFixed(0)}"`;

    if (backgroundColor) {
      svg += ` style="background:${backgroundColor}"`;
    }

    svg += `>
  <!-- Generated with Guilloché Studio Pro -->
  <!-- Family: ${params.family}, Symmetry: ${params.symmetry} -->`;

    // Add metadata
    if (includeMetadata) {
      svg += this.buildMetadata(params);
    }

    // Add defs for gradient and glow
    if (gradient || glow > 0) {
      svg += '\n  <defs>';

      if (gradient) {
        svg += `
    <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </linearGradient>`;
      }

      if (glow > 0) {
        svg += `
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${glow}" result="blur"/>
      <feFlood flood-color="${strokeColor}" result="glowColor"/>
      <feComposite in="glowColor" in2="blur" operator="in" result="softGlow"/>
      <feMerge>
        <feMergeNode in="softGlow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
      }

      svg += '\n  </defs>';
    }

    // Build path element
    svg += `
  <path d="${pathData}"
        stroke="${gradient ? 'url(#strokeGradient)' : strokeColor}"
        stroke-width="${params.lw}"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"`;

    if (dashed) {
      const dash = params.lw * 8 * dashRatio;
      const gap = params.lw * 8;
      svg += ` stroke-dasharray="${dash} ${gap}"`;
    }

    if (glow > 0) {
      svg += ` filter="url(#glow)"`;
    }

    svg += '/>\n</svg>';

    return svg;
  }

  /**
   * Build SVG path data string from segments
   */
  private buildPathData(segments: { points: Point[] }[]): string {
    let pathData = '';

    for (const segment of segments) {
      if (segment.points.length === 0) continue;

      pathData += `M ${segment.points[0].x.toFixed(3)} ${segment.points[0].y.toFixed(3)}`;

      for (let i = 1; i < segment.points.length; i++) {
        pathData += ` L ${segment.points[i].x.toFixed(3)} ${segment.points[i].y.toFixed(3)}`;
      }
    }

    return pathData;
  }

  /**
   * Build metadata XML for SVG
   */
  private buildMetadata(params: PatternParams): string {
    return `
  <metadata>
    <guilloche xmlns="http://guilloche.studio/schema">
      <family>${params.family}</family>
      <R>${params.R}</R>
      <r>${params.r}</r>
      <d>${params.d}</d>
      <k>${params.k}</k>
      <m>${params.m}</m>
      <mf>${params.mf}</mf>
      <phase>${params.phase}</phase>
      <rot>${params.rot}</rot>
      <s>${params.s}</s>
      <symmetry>${params.symmetry}</symmetry>
      <reflectH>${params.reflectH}</reflectH>
      <reflectV>${params.reflectV}</reflectV>
      <kaleidoscope>${params.kaleidoscope}</kaleidoscope>
      <steps>${params.steps}</steps>
      <lw>${params.lw}</lw>
      <timestamp>${new Date().toISOString()}</timestamp>
    </guilloche>
  </metadata>`;
  }

  /**
   * Optimize SVG by reducing path precision
   */
  optimizeSVG(svg: string, precision = 2): string {
    // Reduce coordinate precision
    return svg.replace(/(\d+\.\d{3,})/g, (match) => {
      return parseFloat(match).toFixed(precision);
    });
  }

  /**
   * Create a minimal SVG with just the path (for embedding)
   */
  renderPathOnly(path: GeneratedPath): string {
    const pathData = this.buildPathData(path.segments);
    return `<path d="${pathData}" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  /**
   * Parse SVG metadata to extract pattern parameters
   */
  static parseMetadata(svg: string): Partial<PatternParams> | null {
    const guillochMatch = svg.match(/<guilloche[^>]*>([\s\S]*?)<\/guilloche>/);
    if (!guillochMatch) return null;

    const metadata = guillochMatch[1];
    const params: Record<string, string | number | boolean> = {};

    const tags = [
      'family', 'R', 'r', 'd', 'k', 'm', 'mf', 'phase', 'rot', 's',
      'symmetry', 'reflectH', 'reflectV', 'kaleidoscope', 'steps', 'lw'
    ];

    for (const tag of tags) {
      const match = metadata.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
      if (match) {
        const value = match[1];
        if (value === 'true' || value === 'false') {
          params[tag] = value === 'true';
        } else if (!isNaN(Number(value))) {
          params[tag] = Number(value);
        } else {
          params[tag] = value;
        }
      }
    }

    return params as Partial<PatternParams>;
  }
}
