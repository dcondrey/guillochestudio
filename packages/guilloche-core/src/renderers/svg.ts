/**
 * SVG Renderer - Professional Quality SVG Export
 *
 * Features:
 * - Bezier curve fitting for optimized output
 * - Path simplification to reduce file size
 * - Full gradient and filter support
 * - Metadata embedding for parameter recovery
 * - Print-ready output with physical units
 */

import type { PatternParams } from '@guilloche/shared';
import type { GeneratedPath, Point, PathSegment } from '../engine.js';
import { fitCurve, bezierToSVGPath, type BezierSegment } from '../utils/curve-fit.js';
import { simplifyPath, simplifyCombined } from '../utils/simplify.js';

export interface SVGRenderOptions {
  /** Include metadata for parameter recovery */
  includeMetadata?: boolean;
  /** Use bezier curve fitting (smaller files, smoother curves) */
  optimized?: boolean;
  /** Maximum error for curve fitting (lower = more accurate, larger files) */
  fitTolerance?: number;
  /** Simplification epsilon before curve fitting */
  simplifyEpsilon?: number;
  /** Background color */
  backgroundColor?: string;
  /** Stroke color */
  strokeColor?: string;
  /** Gradient colors [start, end] */
  gradient?: [string, string];
  /** Radial gradient instead of linear */
  radialGradient?: boolean;
  /** Glow effect intensity */
  glow?: number;
  /** Dashed stroke */
  dashed?: boolean;
  /** Dash ratio (1 = equal dash/gap) */
  dashRatio?: number;
  /** Coordinate precision (decimal places) */
  precision?: number;
  /** Physical unit for dimensions (px, mm, in, pt) */
  unit?: 'px' | 'mm' | 'in' | 'pt';
  /** DPI for physical units (default 96) */
  dpi?: number;
  /** Include XMP metadata */
  includeXMP?: boolean;
  /** Author/creator name */
  author?: string;
  /** Copyright notice */
  copyright?: string;
}

/** One layer of a composition, as `renderLayers` consumes it. */
export interface SVGLayer {
  path: GeneratedPath;
  color: string;
  opacity: number;
  blendMode?: string;
  /** Per-layer translation in path space, matching the canvas preview. */
  offsetX?: number;
  offsetY?: number;
  glow?: number;
  dashed?: boolean;
  dashRatio?: number;
}

export class SVGRenderer {
  /**
   * Render a generated path to optimized SVG string
   * Uses bezier curve fitting for professional-quality output
   */
  render(path: GeneratedPath, options: SVGRenderOptions = {}): string {
    const {
      includeMetadata = true,
      optimized = true,
      fitTolerance = 1.0,
      simplifyEpsilon = 0.5,
      backgroundColor,
      strokeColor = '#1e293b',
      gradient,
      radialGradient = false,
      glow = 0,
      dashed = false,
      dashRatio = 1,
      precision = 3,
      unit = 'px',
      dpi = 96,
      includeXMP = false,
      author,
      copyright,
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

    // Convert to physical units if needed
    const physicalWidth = this.toPhysicalUnit(width, unit, dpi);
    const physicalHeight = this.toPhysicalUnit(height, unit, dpi);

    // Build path data - use bezier curves if optimized
    const pathData = optimized
      ? this.buildOptimizedPathData(path.segments, fitTolerance, simplifyEpsilon, precision)
      : this.buildPathData(path.segments, precision);

    // Build SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="${viewMinX.toFixed(precision)} ${viewMinY.toFixed(precision)} ${width.toFixed(precision)} ${height.toFixed(precision)}"
     width="${physicalWidth}${unit}"
     height="${physicalHeight}${unit}"
     version="1.1"`;

    if (backgroundColor) {
      svg += `\n     style="background:${backgroundColor}"`;
    }

    svg += `>
  <!-- Generated with Guilloché Studio Pro -->
  <!-- https://guillochestudio.com -->`;

    // Add XMP metadata
    if (includeXMP) {
      svg += this.buildXMPMetadata(params, author, copyright);
    }

    // Add guilloche metadata
    if (includeMetadata) {
      svg += this.buildMetadata(params);
    }

    // Add defs for gradients, filters, and patterns
    const hasDefs = gradient || glow > 0;
    if (hasDefs) {
      svg += '\n  <defs>';

      if (gradient) {
        if (radialGradient) {
          svg += `
    <radialGradient id="strokeGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </radialGradient>`;
        } else {
          svg += `
    <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </linearGradient>`;
        }
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
      svg += `\n        stroke-dasharray="${dash} ${gap}"`;
    }

    if (glow > 0) {
      svg += `\n        filter="url(#glow)"`;
    }

    svg += '/>\n</svg>';

    return svg;
  }

  /**
   * Build optimized SVG path data using bezier curve fitting
   * Significantly reduces file size while maintaining visual fidelity
   */
  private buildOptimizedPathData(
    segments: PathSegment[],
    fitTolerance: number,
    simplifyEpsilon: number,
    precision: number
  ): string {
    let pathData = '';

    for (const segment of segments) {
      if (segment.points.length === 0) continue;

      // Step 1: Simplify the path to remove redundant points
      const simplified = simplifyCombined(segment.points, simplifyEpsilon / 2, simplifyEpsilon);

      // Step 2: Fit bezier curves to the simplified points
      const beziers = fitCurve(simplified, fitTolerance);

      // Step 3: Convert to SVG path commands
      if (beziers.length > 0) {
        pathData += bezierToSVGPath(beziers, precision) + ' ';
      } else if (simplified.length > 0) {
        // Fallback to line commands if curve fitting fails
        pathData += this.buildLinePathData(simplified, precision) + ' ';
      }
    }

    return pathData.trim();
  }

  /**
   * Build SVG path data string from segments using line commands (L)
   * Used as fallback or when optimization is disabled
   */
  private buildPathData(segments: PathSegment[], precision: number = 3): string {
    let pathData = '';

    for (const segment of segments) {
      if (segment.points.length === 0) continue;
      pathData += this.buildLinePathData(segment.points, precision) + ' ';
    }

    return pathData.trim();
  }

  /**
   * Build line-based path data for a single segment
   */
  private buildLinePathData(points: Point[], precision: number): string {
    if (points.length === 0) return '';

    let path = `M ${points[0].x.toFixed(precision)} ${points[0].y.toFixed(precision)}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x.toFixed(precision)} ${points[i].y.toFixed(precision)}`;
    }

    return path;
  }

  /**
   * Convert pixel value to physical unit
   */
  private toPhysicalUnit(px: number, unit: string, dpi: number): string {
    switch (unit) {
      case 'mm':
        return ((px * 25.4) / dpi).toFixed(2);
      case 'in':
        return (px / dpi).toFixed(4);
      case 'pt':
        return ((px * 72) / dpi).toFixed(2);
      default:
        return px.toFixed(0);
    }
  }

  /**
   * Build XMP metadata for professional workflows
   */
  private buildXMPMetadata(params: PatternParams, author?: string, copyright?: string): string {
    const now = new Date().toISOString();
    return `
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
             xmlns:dc="http://purl.org/dc/elements/1.1/"
             xmlns:xmp="http://ns.adobe.com/xap/1.0/"
             xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">
      <rdf:Description>
        <dc:title>Guilloché Pattern - ${params.family}</dc:title>
        <dc:format>image/svg+xml</dc:format>
        ${author ? `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` : ''}
        ${copyright ? `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${copyright}</rdf:li></rdf:Alt></dc:rights>` : ''}
        <xmp:CreatorTool>Guilloché Studio Pro</xmp:CreatorTool>
        <xmp:CreateDate>${now}</xmp:CreateDate>
        <xmp:ModifyDate>${now}</xmp:ModifyDate>
        <xmpMM:DocumentID>guilloche-${Date.now()}</xmpMM:DocumentID>
      </rdf:Description>
    </rdf:RDF>
  </metadata>`;
  }

  /**
   * Build metadata XML for pattern parameter recovery
   */
  private buildMetadata(params: PatternParams): string {
    return `
  <metadata>
    <guilloche xmlns="http://guilloche.studio/schema" version="2.0">
      <mode>${params.mode || 'curve'}</mode>
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
   * Optimize SVG by reducing coordinate precision
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
  renderPathOnly(path: GeneratedPath, optimized = true): string {
    const pathData = optimized
      ? this.buildOptimizedPathData(path.segments, 1.0, 0.5, 3)
      : this.buildPathData(path.segments, 3);

    return `<path d="${pathData}" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  /**
   * Render multiple layers to SVG with groups.
   *
   * Layer offsets are translations in path space: generated paths are centred on
   * the origin, so the canvas preview's per-layer `translate` maps directly onto a
   * group transform here. The offsets have to enter the bounds too, or a moved
   * layer falls outside the viewBox and is clipped out of the export.
   */
  renderLayers(layers: SVGLayer[], options: SVGRenderOptions = {}): string {
    const {
      backgroundColor,
      includeMetadata = true,
      optimized = true,
      precision = 3,
      gradient,
      radialGradient = false,
    } = options;

    // Calculate combined bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const layer of layers) {
      const b = layer.path.bounds;
      const dx = layer.offsetX ?? 0;
      const dy = layer.offsetY ?? 0;
      if (b.minX + dx < minX) minX = b.minX + dx;
      if (b.minY + dy < minY) minY = b.minY + dy;
      if (b.maxX + dx > maxX) maxX = b.maxX + dx;
      if (b.maxY + dy > maxY) maxY = b.maxY + dy;
    }

    // No layers, or layers whose paths are all empty, leave the bounds unset.
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }

    const paddingX = (maxX - minX) * 0.05;
    const paddingY = (maxY - minY) * 0.05;
    const viewMinX = minX - paddingX;
    const viewMinY = minY - paddingY;
    const width = maxX - minX + paddingX * 2;
    const height = maxY - minY + paddingY * 2;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${viewMinX.toFixed(precision)} ${viewMinY.toFixed(precision)} ${width.toFixed(precision)} ${height.toFixed(precision)}"
     width="${width.toFixed(0)}"
     height="${height.toFixed(0)}"`;

    if (backgroundColor) {
      svg += `\n     style="background:${backgroundColor}"`;
    }

    svg += `>
  <!-- Generated with Guilloché Studio Pro -->`;

    if (includeMetadata && layers.length > 0) {
      svg += this.buildMetadata(layers[0].path.params);
    }

    // A single shared gradient, plus one glow filter per layer that asks for one:
    // the filter floods with the layer's own stroke colour, so it cannot be shared.
    const glowLayers = layers
      .map((layer, index) => ({ layer, index }))
      .filter(({ layer }) => (layer.glow ?? 0) > 0);

    if (gradient || glowLayers.length > 0) {
      svg += '\n  <defs>';

      if (gradient) {
        if (radialGradient) {
          svg += `
    <radialGradient id="strokeGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </radialGradient>`;
        } else {
          svg += `
    <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient[0]}"/>
      <stop offset="100%" stop-color="${gradient[1]}"/>
    </linearGradient>`;
        }
      }

      for (const { layer, index } of glowLayers) {
        svg += `
    <filter id="glow-${index}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${layer.glow}" result="blur"/>
      <feFlood flood-color="${layer.color}" result="glowColor"/>
      <feComposite in="glowColor" in2="blur" operator="in" result="softGlow"/>
      <feMerge>
        <feMergeNode in="softGlow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
      }

      svg += '\n  </defs>';
    }

    // Render each layer as a group
    layers.forEach((layer, index) => {
      const pathData = optimized
        ? this.buildOptimizedPathData(layer.path.segments, 1.0, 0.5, precision)
        : this.buildPathData(layer.path.segments, precision);

      const dx = layer.offsetX ?? 0;
      const dy = layer.offsetY ?? 0;
      const transform =
        dx || dy ? ` transform="translate(${dx.toFixed(precision)} ${dy.toFixed(precision)})"` : '';

      svg += `
  <g id="layer-${index}" opacity="${layer.opacity}"${layer.blendMode ? ` style="mix-blend-mode:${layer.blendMode}"` : ''}${transform}>
    <path d="${pathData}"
          stroke="${gradient ? 'url(#strokeGradient)' : layer.color}"
          stroke-width="${layer.path.params.lw}"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"`;

      if (layer.dashed) {
        const stroke = layer.path.params.lw || 1;
        svg += `\n          stroke-dasharray="${stroke * 8 * (layer.dashRatio ?? 1)} ${stroke * 8}"`;
      }

      if ((layer.glow ?? 0) > 0) {
        svg += `\n          filter="url(#glow-${index})"`;
      }

      svg += `/>
  </g>`;
    });

    svg += '\n</svg>';
    return svg;
  }

  /**
   * Calculate file size reduction from optimization
   */
  getOptimizationStats(
    path: GeneratedPath,
    fitTolerance = 1.0
  ): {
    originalPoints: number;
    optimizedCommands: number;
    estimatedSizeReduction: number;
  } {
    let originalPoints = 0;
    let optimizedCommands = 0;

    for (const segment of path.segments) {
      originalPoints += segment.points.length;
      const simplified = simplifyCombined(segment.points, 0.25, 0.5);
      const beziers = fitCurve(simplified, fitTolerance);
      optimizedCommands += beziers.length;
    }

    // Each L command is ~20 chars, each C command is ~60 chars but replaces many L commands
    const originalSize = originalPoints * 20;
    const optimizedSize = optimizedCommands * 60;
    const reduction = originalSize > 0 ? (1 - optimizedSize / originalSize) * 100 : 0;

    return {
      originalPoints,
      optimizedCommands,
      estimatedSizeReduction: Math.max(0, reduction),
    };
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
      'mode',
      'family',
      'R',
      'r',
      'd',
      'k',
      'm',
      'mf',
      'phase',
      'rot',
      's',
      'symmetry',
      'reflectH',
      'reflectV',
      'kaleidoscope',
      'steps',
      'lw',
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
