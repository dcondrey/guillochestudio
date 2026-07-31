/**
 * Vector PDF Export Service
 *
 * Generates true vector PDF files (not rasterized) using jsPDF.
 * Supports:
 * - Vector path export with bezier curves
 * - sRGB output (jsPDF cannot embed an ICC profile, so CMYK is unsupported)
 * - Physical dimensions and DPI settings
 * - Metadata embedding
 * - Multi-layer compositions
 */

import { jsPDF } from 'jspdf';
import type { GeneratedPath, Point, BezierSegment } from '@guilloche/core';
import { fitCurve } from '@guilloche/core';
import type { PatternParams } from '@guilloche/shared';

export interface PDFExportOptions {
  /** Paper size or custom dimensions [width, height] in mm */
  pageSize: 'a4' | 'a3' | 'letter' | 'legal' | [number, number];
  /** Page orientation */
  orientation: 'portrait' | 'landscape';
  /** Margin in mm */
  margin: number;
  /** DPI for any rasterized elements */
  dpi?: number;
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Keywords for metadata */
  keywords?: string[];
  /** Stroke color (hex) */
  strokeColor?: string;
  /** Line width in points */
  lineWidth?: number;
  /** Use bezier curve fitting for smoother paths */
  optimized?: boolean;
  /** Maximum error for curve fitting */
  fitTolerance?: number;
  /** Include pattern metadata */
  includeMetadata?: boolean;
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [0, 0, 0];
}

/**
 * Get page dimensions in mm
 */
function getPageDimensions(
  pageSize: PDFExportOptions['pageSize'],
  orientation: PDFExportOptions['orientation']
): { width: number; height: number } {
  let width: number, height: number;

  if (Array.isArray(pageSize)) {
    [width, height] = pageSize;
  } else {
    const sizes: Record<string, [number, number]> = {
      a4: [210, 297],
      a3: [297, 420],
      letter: [215.9, 279.4],
      legal: [215.9, 355.6],
    };
    [width, height] = sizes[pageSize] || sizes['a4'];
  }

  if (orientation === 'landscape') {
    [width, height] = [height, width];
  }

  return { width, height };
}

/**
 * Export a generated path to vector PDF
 */
export function exportPDF(path: GeneratedPath, options: PDFExportOptions): Blob {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    margin = 10,
    title = 'Guilloché Pattern',
    author = 'Guilloché Studio Pro',
    subject = 'Vector pattern export',
    keywords = ['guilloche', 'pattern', 'vector'],
    strokeColor = '#1e293b',
    lineWidth = 0.5,
    optimized = true,
    fitTolerance = 1.0,
    includeMetadata = true,
  } = options;

  // Get page dimensions
  const { width: pageWidth, height: pageHeight } = getPageDimensions(pageSize, orientation);
  const drawableWidth = pageWidth - 2 * margin;
  const drawableHeight = pageHeight - 2 * margin;

  // Create PDF document
  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format: Array.isArray(pageSize) ? pageSize : pageSize,
  });

  // Set document properties
  doc.setProperties({
    title,
    author,
    subject,
    keywords: keywords.join(', '),
    creator: 'Guilloché Studio Pro',
  });

  // Calculate scale to fit pattern in drawable area
  const { minX, minY, maxX, maxY } = path.bounds;
  const patternWidth = maxX - minX;
  const patternHeight = maxY - minY;
  const scale = Math.min(drawableWidth / patternWidth, drawableHeight / patternHeight) * 0.95; // 5% margin for safety

  // Calculate offset to center the pattern
  const offsetX = margin + (drawableWidth - patternWidth * scale) / 2 - minX * scale;
  const offsetY = margin + (drawableHeight - patternHeight * scale) / 2 - minY * scale;

  const [r, g, b] = hexToRgb(strokeColor);
  doc.setDrawColor(r, g, b);

  doc.setLineWidth(lineWidth / 2.835); // Convert points to mm

  // Draw paths
  for (const segment of path.segments) {
    if (segment.points.length < 2) continue;

    if (optimized) {
      // Fit bezier curves for smoother output
      const beziers = fitCurve(segment.points, fitTolerance);
      drawBezierSegments(doc, beziers, scale, offsetX, offsetY);
    } else {
      // Draw as polyline
      drawPolyline(doc, segment.points, scale, offsetX, offsetY);
    }
  }

  // Add metadata as custom PDF info
  if (includeMetadata) {
    addPatternMetadata(doc, path.params);
  }

  // Return as blob
  return doc.output('blob');
}

/**
 * Draw bezier curve segments to PDF
 */
function drawBezierSegments(
  doc: jsPDF,
  beziers: BezierSegment[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  if (beziers.length === 0) return;

  // Start path
  const first = beziers[0];
  const startX = first.p0.x * scale + offsetX;
  const startY = first.p0.y * scale + offsetY;

  // Build path using internal path operations
  // jsPDF doesn't have a direct bezier API, so we use lines() with curves option
  const pathData: number[][] = [];

  for (const bez of beziers) {
    // jsPDF uses absolute coordinates
    pathData.push([
      bez.p1.x * scale + offsetX,
      bez.p1.y * scale + offsetY,
      bez.p2.x * scale + offsetX,
      bez.p2.y * scale + offsetY,
      bez.p3.x * scale + offsetX,
      bez.p3.y * scale + offsetY,
    ]);
  }

  // Use internal path API
  const ctx = doc.context2d;
  if (ctx) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    for (const [cp1x, cp1y, cp2x, cp2y, x, y] of pathData) {
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
    }
    ctx.stroke();
  } else {
    // Fallback: draw as small line segments
    for (const bez of beziers) {
      const points = flattenBezier(bez, 10);
      drawPolyline(doc, points, 1, 0, 0); // Already scaled
    }
  }
}

/**
 * Draw a polyline to PDF
 */
function drawPolyline(
  doc: jsPDF,
  points: Point[],
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  if (points.length < 2) return;

  const lines: [number, number][] = points
    .slice(1)
    .map((p) => [p.x * scale + offsetX, p.y * scale + offsetY]);

  doc.lines(
    lines,
    points[0].x * scale + offsetX,
    points[0].y * scale + offsetY,
    [1, 1],
    'S' // Stroke only
  );
}

/**
 * Flatten a bezier curve to points
 */
function flattenBezier(bez: BezierSegment, steps: number): Point[] {
  const points: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    points.push({
      x: mt3 * bez.p0.x + 3 * mt2 * t * bez.p1.x + 3 * mt * t2 * bez.p2.x + t3 * bez.p3.x,
      y: mt3 * bez.p0.y + 3 * mt2 * t * bez.p1.y + 3 * mt * t2 * bez.p2.y + t3 * bez.p3.y,
    });
  }

  return points;
}

/**
 * Add pattern metadata to PDF
 */
function addPatternMetadata(doc: jsPDF, params: PatternParams): void {
  // jsPDF exposes no custom info dictionary, so the generating parameters are
  // flattened into `subject` — the only free-form field it will embed.
  const metadata: Record<string, string> = {
    'Guilloche.Family': params.family,
    'Guilloche.Mode': params.mode || 'curve',
    'Guilloche.R': String(params.R),
    'Guilloche.r': String(params.r),
    'Guilloche.d': String(params.d),
    'Guilloche.Symmetry': String(params.symmetry),
    'Guilloche.Steps': String(params.steps),
  };

  doc.setProperties({
    subject: Object.entries(metadata)
      .map(([key, value]) => `${key}=${value}`)
      .join('; '),
    keywords: `guilloche,${params.family},symmetry-${params.symmetry}`,
  });
}

/**
 * Export multiple layers to a single PDF
 */
export function exportLayersPDF(
  layers: { path: GeneratedPath; color: string; opacity: number }[],
  options: PDFExportOptions
): Blob {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    margin = 10,
    title = 'Guilloché Pattern',
    author = 'Guilloché Studio Pro',
    lineWidth = 0.5,
    optimized = true,
    fitTolerance = 1.0,
  } = options;

  // Get page dimensions
  const { width: pageWidth, height: pageHeight } = getPageDimensions(pageSize, orientation);
  const drawableWidth = pageWidth - 2 * margin;
  const drawableHeight = pageHeight - 2 * margin;

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

  const patternWidth = maxX - minX;
  const patternHeight = maxY - minY;
  const scale = Math.min(drawableWidth / patternWidth, drawableHeight / patternHeight) * 0.95;

  const offsetX = margin + (drawableWidth - patternWidth * scale) / 2 - minX * scale;
  const offsetY = margin + (drawableHeight - patternHeight * scale) / 2 - minY * scale;

  // Create PDF document
  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format: Array.isArray(pageSize) ? pageSize : pageSize,
  });

  doc.setProperties({ title, author, creator: 'Guilloché Studio Pro' });
  doc.setLineWidth(lineWidth / 2.835);

  // Draw each layer
  for (const layer of layers) {
    const [r, g, b] = hexToRgb(layer.color);
    doc.setDrawColor(r, g, b);
    // Note: jsPDF doesn't support opacity for strokes directly

    for (const segment of layer.path.segments) {
      if (segment.points.length < 2) continue;

      if (optimized) {
        const beziers = fitCurve(segment.points, fitTolerance);
        for (const bez of beziers) {
          const points = flattenBezier(bez, 10);
          drawPolyline(doc, points, scale, offsetX, offsetY);
        }
      } else {
        drawPolyline(doc, segment.points, scale, offsetX, offsetY);
      }
    }
  }

  return doc.output('blob');
}

/**
 * Download PDF to user's device
 */
export function downloadPDF(blob: Blob, filename: string = 'guilloche-pattern.pdf'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
