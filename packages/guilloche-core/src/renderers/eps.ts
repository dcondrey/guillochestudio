/**
 * EPS (Encapsulated PostScript) Renderer
 *
 * Generates EPS files for professional print workflows.
 * Compatible with Adobe Illustrator, CorelDRAW, and print RIPs.
 *
 * Features:
 * - Vector path output
 * - Bezier curve support
 * - CMYK and RGB color
 * - Metadata embedding
 * - Print-ready output
 */

import type { PatternParams } from '@guilloche/shared';
import type { GeneratedPath, Point, PathSegment } from '../engine.js';
import { fitCurve, type BezierSegment } from '../utils/curve-fit.js';
import { simplifyCombined } from '../utils/simplify.js';

export interface EPSRenderOptions {
  /** Document title */
  title?: string;
  /** Document creator */
  creator?: string;
  /** Use bezier curves for smoother paths */
  optimized?: boolean;
  /** Maximum error for curve fitting */
  fitTolerance?: number;
  /** Simplification epsilon */
  simplifyEpsilon?: number;
  /** Stroke color (hex) */
  strokeColor?: string;
  /** Use CMYK color mode */
  cmyk?: boolean;
  /** Line width in points */
  lineWidth?: number;
  /** Scale factor */
  scale?: number;
  /** Include metadata comments */
  includeMetadata?: boolean;
  /** Coordinate precision */
  precision?: number;
}

/**
 * Convert hex color to RGB values (0-1 range)
 */
function hexToRgbNormalized(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  }
  return [0, 0, 0];
}

/**
 * Convert RGB to CMYK values (0-1 range)
 */
function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 1];

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  return [c, m, y, k];
}

/**
 * EPS Renderer class
 */
export class EPSRenderer {
  /**
   * Render a generated path to EPS format
   */
  render(path: GeneratedPath, options: EPSRenderOptions = {}): string {
    const {
      title = 'Guilloché Pattern',
      creator = 'Guilloché Studio Pro',
      optimized = true,
      fitTolerance = 1.0,
      simplifyEpsilon = 0.5,
      strokeColor = '#1e293b',
      cmyk = false,
      lineWidth = 0.5,
      scale = 1.0,
      includeMetadata = true,
      precision = 4,
    } = options;

    const params = path.params;
    const { minX, minY, maxX, maxY } = path.bounds;

    // Add padding
    const padding = 10;
    const llx = minX * scale - padding;
    const lly = minY * scale - padding;
    const urx = maxX * scale + padding;
    const ury = maxY * scale + padding;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Build EPS header
    let eps = `%!PS-Adobe-3.0 EPSF-3.0
%%Title: ${title}
%%Creator: ${creator}
%%CreationDate: ${dateStr}
%%BoundingBox: ${Math.floor(llx)} ${Math.floor(lly)} ${Math.ceil(urx)} ${Math.ceil(ury)}
%%HiResBoundingBox: ${llx.toFixed(precision)} ${lly.toFixed(precision)} ${urx.toFixed(precision)} ${ury.toFixed(precision)}
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
`;

    // Add metadata
    if (includeMetadata) {
      eps += this.buildMetadataComments(params);
    }

    eps += `
%%BeginProlog
/M { moveto } bind def
/L { lineto } bind def
/C { curveto } bind def
/S { stroke } bind def
/N { newpath } bind def
/CP { closepath } bind def
%%EndProlog

%%Page: 1 1
`;

    // Set graphics state
    eps += `gsave
${lineWidth.toFixed(precision)} setlinewidth
1 setlinecap
1 setlinejoin
`;

    // Set color
    const [r, g, b] = hexToRgbNormalized(strokeColor);
    if (cmyk) {
      const [c, m, y, k] = rgbToCmyk(r, g, b);
      eps += `${c.toFixed(precision)} ${m.toFixed(precision)} ${y.toFixed(precision)} ${k.toFixed(precision)} setcmykcolor
`;
    } else {
      eps += `${r.toFixed(precision)} ${g.toFixed(precision)} ${b.toFixed(precision)} setrgbcolor
`;
    }

    // Draw paths
    for (const segment of path.segments) {
      if (segment.points.length < 2) continue;

      eps += 'N\n';

      if (optimized) {
        // Simplify and fit bezier curves
        const simplified = simplifyCombined(segment.points, simplifyEpsilon / 2, simplifyEpsilon);
        const beziers = fitCurve(simplified, fitTolerance);

        if (beziers.length > 0) {
          eps += this.buildBezierPath(beziers, scale, precision);
        } else {
          eps += this.buildLinePath(simplified, scale, precision);
        }
      } else {
        eps += this.buildLinePath(segment.points, scale, precision);
      }

      eps += 'S\n';
    }

    eps += `grestore
showpage
%%EOF
`;

    return eps;
  }

  /**
   * Build PostScript path commands from bezier segments
   */
  private buildBezierPath(beziers: BezierSegment[], scale: number, precision: number): string {
    if (beziers.length === 0) return '';

    const fmt = (n: number) => (n * scale).toFixed(precision);
    let path = '';

    // Move to start
    path += `${fmt(beziers[0].p0.x)} ${fmt(beziers[0].p0.y)} M\n`;

    // Draw bezier curves
    for (const bez of beziers) {
      path += `${fmt(bez.p1.x)} ${fmt(bez.p1.y)} ${fmt(bez.p2.x)} ${fmt(bez.p2.y)} ${fmt(bez.p3.x)} ${fmt(bez.p3.y)} C\n`;
    }

    return path;
  }

  /**
   * Build PostScript path commands from line segments
   */
  private buildLinePath(points: Point[], scale: number, precision: number): string {
    if (points.length === 0) return '';

    const fmt = (n: number) => (n * scale).toFixed(precision);
    let path = '';

    // Move to start
    path += `${fmt(points[0].x)} ${fmt(points[0].y)} M\n`;

    // Draw lines
    for (let i = 1; i < points.length; i++) {
      path += `${fmt(points[i].x)} ${fmt(points[i].y)} L\n`;
    }

    return path;
  }

  /**
   * Build metadata comments
   */
  private buildMetadataComments(params: PatternParams): string {
    return `
%%BeginData:
% Guilloché Pattern Metadata
% Mode: ${params.mode || 'curve'}
% Family: ${params.family}
% R: ${params.R}
% r: ${params.r}
% d: ${params.d}
% k: ${params.k}
% m: ${params.m}
% mf: ${params.mf}
% phase: ${params.phase}
% rot: ${params.rot}
% scale: ${params.s}
% symmetry: ${params.symmetry}
% steps: ${params.steps}
% lineWidth: ${params.lw}
%%EndData:
`;
  }

  /**
   * Render multiple layers to EPS
   */
  renderLayers(
    layers: { path: GeneratedPath; color: string; opacity: number }[],
    options: EPSRenderOptions = {}
  ): string {
    const {
      title = 'Guilloché Pattern',
      creator = 'Guilloché Studio Pro',
      optimized = true,
      fitTolerance = 1.0,
      simplifyEpsilon = 0.5,
      cmyk = false,
      lineWidth = 0.5,
      scale = 1.0,
      precision = 4,
    } = options;

    // Calculate combined bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const layer of layers) {
      const b = layer.path.bounds;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    const padding = 10;
    const llx = minX * scale - padding;
    const lly = minY * scale - padding;
    const urx = maxX * scale + padding;
    const ury = maxY * scale + padding;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    let eps = `%!PS-Adobe-3.0 EPSF-3.0
%%Title: ${title}
%%Creator: ${creator}
%%CreationDate: ${dateStr}
%%BoundingBox: ${Math.floor(llx)} ${Math.floor(lly)} ${Math.ceil(urx)} ${Math.ceil(ury)}
%%HiResBoundingBox: ${llx.toFixed(precision)} ${lly.toFixed(precision)} ${urx.toFixed(precision)} ${ury.toFixed(precision)}
%%DocumentData: Clean7Bit
%%LanguageLevel: 2
%%Pages: 1
%%EndComments

%%BeginProlog
/M { moveto } bind def
/L { lineto } bind def
/C { curveto } bind def
/S { stroke } bind def
/N { newpath } bind def
%%EndProlog

%%Page: 1 1
gsave
${lineWidth.toFixed(precision)} setlinewidth
1 setlinecap
1 setlinejoin
`;

    // Draw each layer
    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx];

      eps += `\n% Layer ${layerIdx + 1}\n`;

      // Set color
      const [r, g, b] = hexToRgbNormalized(layer.color);
      if (cmyk) {
        const [c, m, y, k] = rgbToCmyk(r, g, b);
        eps += `${c.toFixed(precision)} ${m.toFixed(precision)} ${y.toFixed(precision)} ${k.toFixed(precision)} setcmykcolor\n`;
      } else {
        eps += `${r.toFixed(precision)} ${g.toFixed(precision)} ${b.toFixed(precision)} setrgbcolor\n`;
      }

      // Draw paths
      for (const segment of layer.path.segments) {
        if (segment.points.length < 2) continue;

        eps += 'N\n';

        if (optimized) {
          const simplified = simplifyCombined(segment.points, simplifyEpsilon / 2, simplifyEpsilon);
          const beziers = fitCurve(simplified, fitTolerance);

          if (beziers.length > 0) {
            eps += this.buildBezierPath(beziers, scale, precision);
          } else {
            eps += this.buildLinePath(simplified, scale, precision);
          }
        } else {
          eps += this.buildLinePath(segment.points, scale, precision);
        }

        eps += 'S\n';
      }
    }

    eps += `grestore
showpage
%%EOF
`;

    return eps;
  }

  /**
   * Parse EPS metadata to extract pattern parameters
   */
  static parseMetadata(eps: string): Partial<PatternParams> | null {
    const params: Record<string, string | number | boolean> = {};

    const patterns = [
      { tag: 'Mode', key: 'mode' },
      { tag: 'Family', key: 'family' },
      { tag: 'R', key: 'R', numeric: true },
      { tag: 'r', key: 'r', numeric: true },
      { tag: 'd', key: 'd', numeric: true },
      { tag: 'k', key: 'k', numeric: true },
      { tag: 'm', key: 'm', numeric: true },
      { tag: 'mf', key: 'mf', numeric: true },
      { tag: 'phase', key: 'phase', numeric: true },
      { tag: 'rot', key: 'rot', numeric: true },
      { tag: 'scale', key: 's', numeric: true },
      { tag: 'symmetry', key: 'symmetry', numeric: true },
      { tag: 'steps', key: 'steps', numeric: true },
      { tag: 'lineWidth', key: 'lw', numeric: true },
    ];

    for (const { tag, key, numeric } of patterns) {
      const regex = new RegExp(`% ${tag}:\\s*(.+)`);
      const match = eps.match(regex);
      if (match) {
        const value = match[1].trim();
        params[key] = numeric ? Number(value) : value;
      }
    }

    return Object.keys(params).length > 0 ? (params as Partial<PatternParams>) : null;
  }
}
