import type { PatternParams } from '../types/index.js';

/**
 * Greatest common divisor using Euclidean algorithm
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/**
 * Calculate the maximum t value for a complete curve based on family type
 */
export function getTMax(family: string, R: number, r: number, k: number, mf: number): number {
  if (family === 'rose' || family === 'liss' || family === 'liss3d') {
    return Math.PI * 2;
  }
  if (family === 'spiral' || family === 'fermat') {
    return Math.PI * 2 * k;
  }
  if (
    family === 'hypocycloid' ||
    family === 'hypotrochoid' ||
    family === 'hypo' ||
    family === 'epicycloid' ||
    family === 'epitrochoid' ||
    family === 'epi'
  ) {
    const g = gcd(R, r);
    return Math.PI * 2 * (r / g);
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
 */
export function pointFor(
  t: number,
  p: Pick<PatternParams, 'family' | 'R' | 'r' | 'd' | 'k' | 'm' | 'mf' | 'phase'>
): [number, number] {
  const { family, R, r, d, k, m, mf, phase } = p;
  const mod = 1 + m * Math.sin(mf * t + phase);

  // Hypotrochoid (rolling inside)
  if (family === 'hypo' || family === 'hypotrochoid') {
    const a = R - r;
    const b = a / r;
    return [(a * Math.cos(t) + d * Math.cos(b * t)) * mod, (a * Math.sin(t) - d * Math.sin(b * t)) * mod];
  }

  // Epitrochoid (rolling outside)
  if (family === 'epi' || family === 'epitrochoid') {
    const a = R + r;
    const b = a / r;
    return [(a * Math.cos(t) - d * Math.cos(b * t)) * mod, (a * Math.sin(t) - d * Math.sin(b * t)) * mod];
  }

  // Rose curve
  if (family === 'rose') {
    const rr = R * Math.cos(k * t + phase) * mod;
    return [rr * Math.cos(t), rr * Math.sin(t)];
  }

  // Lissajous
  if (family === 'liss') {
    const A = R;
    const B = r;
    const a = k;
    const b = mf;
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
    return [(a * Math.cos(t) + r * Math.cos(b * t)) * mod, (a * Math.sin(t) - r * Math.sin(b * t)) * mod];
  }

  // Epicycloid (special case: d = r)
  if (family === 'epicycloid') {
    const a = R + r;
    const b = a / r;
    return [(a * Math.cos(t) - r * Math.cos(b * t)) * mod, (a * Math.sin(t) - r * Math.sin(b * t)) * mod];
  }

  // Fermat Spiral
  if (family === 'fermat') {
    const radius = R * Math.sqrt(t / (2 * Math.PI * k));
    return [radius * Math.cos(t + phase) * mod, radius * Math.sin(t + phase) * mod];
  }

  // Lissajous 3D (projected)
  if (family === 'liss3d') {
    const A = R;
    const B = r;
    const C = d;
    const a = k;
    const b = mf;
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
 * Validate pattern parameters
 */
export function validateParams(params: Partial<PatternParams>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.R !== undefined && (params.R < 10 || params.R > 450)) {
    errors.push('R must be between 10 and 450');
  }
  if (params.r !== undefined && (params.r < 5 || params.r > 300)) {
    errors.push('r must be between 5 and 300');
  }
  if (params.d !== undefined && (params.d < 0 || params.d > 320)) {
    errors.push('d must be between 0 and 320');
  }
  if (params.k !== undefined && (params.k < 1 || params.k > 80)) {
    errors.push('k must be between 1 and 80');
  }
  if (params.symmetry !== undefined && (params.symmetry < 1 || params.symmetry > 24)) {
    errors.push('symmetry must be between 1 and 24');
  }
  if (params.steps !== undefined && (params.steps < 800 || params.steps > 120000)) {
    errors.push('steps must be between 800 and 120000');
  }

  return { valid: errors.length === 0, errors };
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
 * Hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Interpolate between two colors
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;

  return rgbToHex(lerp(c1.r, c2.r, t), lerp(c1.g, c2.g, t), lerp(c1.b, c2.b, t));
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
  return JSON.parse(JSON.stringify(obj));
}
