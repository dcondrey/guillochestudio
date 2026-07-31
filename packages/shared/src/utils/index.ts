import type { PatternParams } from '../types/index.js';

/** Minimum value for radius parameters to avoid division by zero */
const MIN_RADIUS = 0.001;

/**
 * Greatest common divisor using Euclidean algorithm
 * @param a - First number
 * @param b - Second number
 * @returns The GCD of the absolute values, or 1 if both are 0
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/**
 * Calculate the maximum t value for a complete curve based on family type
 * @param family - Curve family type
 * @param R - Outer radius (will be clamped to MIN_RADIUS if too small)
 * @param r - Inner radius (will be clamped to MIN_RADIUS if too small)
 * @param k - Frequency parameter
 * @param mf - Modulation frequency
 * @returns Maximum t value for one complete curve cycle
 */
export function getTMax(family: string, R: number, r: number, k: number, mf: number): number {
  // Ensure valid radius values to prevent division by zero
  const safeR = Math.max(Math.abs(R), MIN_RADIUS);
  const safeR2 = Math.max(Math.abs(r), MIN_RADIUS);
  const safeK = Math.max(Math.abs(k), MIN_RADIUS);

  if (family === 'rose' || family === 'liss' || family === 'liss3d') {
    return Math.PI * 2;
  }
  if (family === 'spiral' || family === 'fermat') {
    return Math.PI * 2 * safeK;
  }
  if (
    family === 'hypocycloid' ||
    family === 'hypotrochoid' ||
    family === 'hypo' ||
    family === 'epicycloid' ||
    family === 'epitrochoid' ||
    family === 'epi'
  ) {
    const g = gcd(Math.round(safeR), Math.round(safeR2));
    return Math.PI * 2 * (safeR2 / g);
  }
  return Math.PI * 2 * 10; // Default
}

/**
 * Rotate a point by angle a
 */
export function rotate(x: number, y: number, a: number): [number, number] {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [x * ca - y * sa, x * sa + y * ca];
}

/**
 * Calculate point on curve at parameter t
 * @param t - Parameter value along the curve
 * @param p - Pattern parameters including family, radii, and modulation settings
 * @returns [x, y] coordinates of the point on the curve
 */
export function pointFor(
  t: number,
  p: Pick<PatternParams, 'family' | 'R' | 'r' | 'd' | 'k' | 'm' | 'mf' | 'phase'>
): [number, number] {
  const { family, R, d, k, m, mf, phase } = p;
  // Ensure r is never zero to prevent division by zero in trochoid calculations
  const r = Math.max(Math.abs(p.r), MIN_RADIUS) * (p.r >= 0 ? 1 : -1) || MIN_RADIUS;
  const safeK = Math.max(Math.abs(k), MIN_RADIUS);
  const mod = 1 + m * Math.sin(mf * t + phase);

  // Hypotrochoid (rolling inside)
  if (family === 'hypo' || family === 'hypotrochoid') {
    const a = R - r;
    const b = a / r;
    return [
      (a * Math.cos(t) + d * Math.cos(b * t)) * mod,
      (a * Math.sin(t) - d * Math.sin(b * t)) * mod,
    ];
  }

  // Epitrochoid (rolling outside)
  if (family === 'epi' || family === 'epitrochoid') {
    const a = R + r;
    const b = a / r;
    return [
      (a * Math.cos(t) - d * Math.cos(b * t)) * mod,
      (a * Math.sin(t) - d * Math.sin(b * t)) * mod,
    ];
  }

  // Rose curve
  if (family === 'rose') {
    const rr = R * Math.cos(safeK * t + phase) * mod;
    return [rr * Math.cos(t), rr * Math.sin(t)];
  }

  // Lissajous
  if (family === 'liss') {
    const A = R;
    const B = r;
    const a = safeK;
    const b = Math.max(Math.abs(mf), MIN_RADIUS);
    return [A * Math.sin(a * t + phase) * mod, B * Math.sin(b * t) * mod];
  }

  // Archimedean Spiral
  if (family === 'spiral') {
    const radius = R + (r * t) / (2 * Math.PI);
    return [radius * Math.cos(t + phase) * mod, radius * Math.sin(t + phase) * mod];
  }

  // Hypocycloid (special case: d = r)
  if (family === 'hypocycloid') {
    const a = R - r;
    const b = a / r;
    return [
      (a * Math.cos(t) + r * Math.cos(b * t)) * mod,
      (a * Math.sin(t) - r * Math.sin(b * t)) * mod,
    ];
  }

  // Epicycloid (special case: d = r)
  if (family === 'epicycloid') {
    const a = R + r;
    const b = a / r;
    return [
      (a * Math.cos(t) - r * Math.cos(b * t)) * mod,
      (a * Math.sin(t) - r * Math.sin(b * t)) * mod,
    ];
  }

  // Fermat Spiral
  if (family === 'fermat') {
    const radius = R * Math.sqrt(Math.max(0, t) / (2 * Math.PI * safeK));
    return [radius * Math.cos(t + phase) * mod, radius * Math.sin(t + phase) * mod];
  }

  // Lissajous 3D (projected)
  if (family === 'liss3d') {
    const A = R;
    const B = r;
    const C = d;
    const a = safeK;
    const b = Math.max(Math.abs(mf), MIN_RADIUS);
    const c = 3;
    const x = A * Math.sin(a * t + phase);
    const y = B * Math.sin(b * t);
    const z = C * Math.sin(c * t + phase / 2);
    return [(x + z / 2) * mod, (y + z / 3) * mod];
  }

  // Default to circle
  return [R * Math.cos(t), R * Math.sin(t)];
}

/**
 * Generate default pattern parameters
 */
export function getDefaultParams(): PatternParams {
  return {
    mode: 'curve',
    family: 'hypo',
    R: 240,
    r: 79,
    d: 140,
    k: 13,
    m: 0.22,
    mf: 7,
    phase: 0,
    rot: 0,
    s: 1,
    steps: 16000,
    lw: 0.7,
    adaptiveSteps: true,
    symmetry: 1,
    reflectH: false,
    reflectV: false,
    kaleidoscope: false,
    aa: true,
    dashed: false,
    dashRatio: 1,
    useGradient: false,
    startColor: '#1e293b',
    endColor: '#4f46e5',
    bgColor: '#ffffff',
    glow: 0,
    noise: 0,
    vignette: true,
    blendMode: 'normal',
  };
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Convert hex color string to RGB values
 * @param hex - Hex color string (supports #RGB, #RRGGBB, #RRGGBBAA formats)
 * @returns Object with r, g, b (0-255) and a (0-1) values, or null if invalid
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  if (!hex || typeof hex !== 'string') return null;

  // Remove leading # if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle 3-character shorthand (e.g., #FFF -> #FFFFFF)
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r, g, b, a: 1 };
  }

  // Handle 4-character shorthand with alpha (e.g., #FFFA)
  if (cleanHex.length === 4) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    const a = parseInt(cleanHex[3] + cleanHex[3], 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null;
    return { r, g, b, a };
  }

  // Handle 6-character hex (standard)
  const result6 = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
  if (result6) {
    return {
      r: parseInt(result6[1], 16),
      g: parseInt(result6[2], 16),
      b: parseInt(result6[3], 16),
      a: 1,
    };
  }

  // Handle 8-character hex with alpha
  const result8 = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
  if (result8) {
    return {
      r: parseInt(result8[1], 16),
      g: parseInt(result8[2], 16),
      b: parseInt(result8[3], 16),
      a: parseInt(result8[4], 16) / 255,
    };
  }

  return null;
}

/**
 * RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number, a = 1): string {
  const hex = [r, g, b]
    .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0'))
    .join('');
  if (a >= 1) return '#' + hex;
  const alphaHex = clamp(Math.round(a * 255), 0, 255)
    .toString(16)
    .padStart(2, '0');
  return '#' + hex + alphaHex;
}

/**
 * RGB to CMYK conversion
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  let c = 1 - r / 255;
  let m = 1 - g / 255;
  let y = 1 - b / 255;
  let k = Math.min(c, Math.min(m, y));

  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };

  c = Math.round(((c - k) / (1 - k)) * 100);
  m = Math.round(((m - k) / (1 - k)) * 100);
  y = Math.round(((y - k) / (1 - k)) * 100);
  k = Math.round(k * 100);

  return { c, m, y, k };
}

/**
 * CMYK to RGB conversion
 */
export function cmykToRgb(
  c: number,
  m: number,
  y: number,
  k: number
): { r: number; g: number; b: number } {
  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;

  const r = Math.round(255 * (1 - c) * (1 - k));
  const g = Math.round(255 * (1 - m) * (1 - k));
  const b = Math.round(255 * (1 - y) * (1 - k));

  return { r, g, b };
}

/**
 * Interpolate between two colors
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;

  return rgbToHex(
    lerp(c1.r, c2.r, t),
    lerp(c1.g, c2.g, t),
    lerp(c1.b, c2.b, t),
    lerp(c1.a, c2.a, t)
  );
}

/**
 * Calculate point on a cubic bezier curve at t [0, 1]
 */
export function getCubicBezierPoint(
  t: number,
  p0: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  p1: { x: number; y: number }
) {
  const cx = 3 * (cp1.x - p0.x);
  const bx = 3 * (cp2.x - cp1.x) - cx;
  const ax = p1.x - p0.x - cx - bx;
  const cy = 3 * (cp1.y - p0.y);
  const by = 3 * (cp2.y - cp1.y) - cy;
  const ay = p1.y - p0.y - cy - by;
  const x = ax * t ** 3 + bx * t ** 2 + cx * t + p0.x;
  const y = ay * t ** 3 + by * t ** 2 + cy * t + p0.y;
  return { x, y };
}

/**
 * Get angle of cubic bezier curve at t [0, 1]
 */
export function getBezierAngle(
  t: number,
  p0: { x: number; y: number },
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  p1: { x: number; y: number }
) {
  const dx =
    3 * (1 - t) ** 2 * (cp1.x - p0.x) +
    6 * (1 - t) * t * (cp2.x - cp1.x) +
    3 * t ** 2 * (p1.x - cp2.x);
  const dy =
    3 * (1 - t) ** 2 * (cp1.y - p0.y) +
    6 * (1 - t) * t * (cp2.y - cp1.y) +
    3 * t ** 2 * (p1.y - cp2.y);
  return Math.atan2(dy, dx);
}

/**
 * Calculate total length of a path made of line segments
 */
export function getPathLength(points: { x: number; y: number }[]) {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}
