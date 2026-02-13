import type { PatternParams } from '@guilloche/shared';
import { getDefaultParams, deepClone } from '@guilloche/shared';

export interface RandomizationOptions {
  family?: boolean;
  geometry?: boolean;
  modulation?: boolean;
  symmetry?: boolean;
  colors?: boolean;
}

// Presets for smart randomization based on curve family
const FAMILY_RANGES: Record<string, {
  R: [number, number];
  r: [number, number];
  d: [number, number];
  k: [number, number];
  m: [number, number];
  mf: [number, number];
  symmetry: [number, number];
}> = {
  rose: { R: [180, 260], r: [40, 100], d: [120, 200], k: [5, 25], m: [0.1, 0.4], mf: [3, 12], symmetry: [1, 8] },
  hypo: { R: [200, 350], r: [50, 150], d: [80, 220], k: [3, 15], m: [0.05, 0.3], mf: [2, 10], symmetry: [1, 6] },
  epi: { R: [180, 300], r: [40, 120], d: [60, 180], k: [4, 12], m: [0.1, 0.35], mf: [3, 9], symmetry: [1, 5] },
  spiral: { R: [20, 80], r: [30, 100], d: [0, 0], k: [3, 12], m: [0.2, 0.6], mf: [5, 20], symmetry: [1, 1] },
  liss: { R: [150, 250], r: [100, 200], d: [50, 150], k: [1, 7], m: [0, 0.2], mf: [1, 7], symmetry: [1, 4] },
  fermat: { R: [150, 250], r: [50, 100], d: [0, 0], k: [2, 8], m: [0.1, 0.3], mf: [3, 10], symmetry: [1, 3] },
  liss3d: { R: [120, 200], r: [80, 160], d: [60, 140], k: [2, 6], m: [0.1, 0.25], mf: [2, 6], symmetry: [1, 4] },
  hypocycloid: { R: [200, 300], r: [50, 100], d: [50, 100], k: [3, 12], m: [0.1, 0.3], mf: [3, 8], symmetry: [1, 6] },
  epicycloid: { R: [180, 280], r: [40, 90], d: [40, 90], k: [4, 10], m: [0.1, 0.3], mf: [3, 8], symmetry: [1, 5] },
};

const HARMONIOUS_COLORS = [
  // Blues
  ['#1e3a5f', '#3b82f6'],
  ['#1e40af', '#60a5fa'],
  // Purples
  ['#4c1d95', '#8b5cf6'],
  ['#581c87', '#a78bfa'],
  // Greens
  ['#064e3b', '#10b981'],
  ['#065f46', '#34d399'],
  // Reds/Oranges
  ['#7c2d12', '#f97316'],
  ['#991b1b', '#ef4444'],
  // Teals
  ['#134e4a', '#14b8a6'],
  ['#0f766e', '#2dd4bf'],
  // Pinks
  ['#831843', '#ec4899'],
  ['#9d174d', '#f472b6'],
  // Gold
  ['#78350f', '#f59e0b'],
  ['#92400e', '#fbbf24'],
];

/**
 * Generate random value within range
 */
function randomInRange(min: number, max: number, step = 1): number {
  const range = max - min;
  const value = min + Math.random() * range;
  return Math.round(value / step) * step;
}

/**
 * Pick random item from array
 */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate random hex color
 */
function randomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * Generate harmonious color pair
 */
function randomHarmoniousColors(): [string, string] {
  return randomPick(HARMONIOUS_COLORS) as [string, string];
}

/**
 * Generate randomized pattern parameters
 */
export function randomizeParams(
  baseParams?: Partial<PatternParams>,
  options: RandomizationOptions = {}
): PatternParams {
  const defaults = getDefaultParams();
  const base = { ...defaults, ...baseParams };
  const result = deepClone(base);

  // Randomize family
  if (options.family !== false) {
    const families = Object.keys(FAMILY_RANGES);
    result.family = randomPick(families) as PatternParams['family'];
  }

  // Get ranges for the selected family
  const ranges = FAMILY_RANGES[result.family] || FAMILY_RANGES.hypo;

  // Randomize geometry
  if (options.geometry !== false) {
    result.R = randomInRange(ranges.R[0], ranges.R[1]);
    result.r = randomInRange(ranges.r[0], ranges.r[1]);
    result.d = randomInRange(ranges.d[0], ranges.d[1]);
    result.k = randomInRange(ranges.k[0], ranges.k[1]);
  }

  // Randomize modulation
  if (options.modulation !== false) {
    result.m = randomInRange(ranges.m[0], ranges.m[1], 0.01);
    result.mf = randomInRange(ranges.mf[0], ranges.mf[1]);
    result.phase = randomInRange(0, Math.PI * 2, 0.01);
    result.rot = randomInRange(0, Math.PI * 2, 0.001);
  }

  // Randomize symmetry
  if (options.symmetry !== false) {
    result.symmetry = randomInRange(ranges.symmetry[0], ranges.symmetry[1]);
    result.reflectH = Math.random() > 0.7;
    result.reflectV = Math.random() > 0.7;
    result.kaleidoscope = Math.random() > 0.9;
  }

  // Randomize colors
  if (options.colors !== false) {
    if (Math.random() > 0.6) {
      result.useGradient = true;
      const [start, end] = randomHarmoniousColors();
      result.startColor = start;
      result.endColor = end;
    } else {
      result.useGradient = false;
      result.startColor = randomPick(HARMONIOUS_COLORS.flat());
    }
  }

  return result;
}

/**
 * Generate a series of related patterns (variations)
 */
export function generateVariations(
  baseParams: PatternParams,
  count: number,
  variance = 0.2
): PatternParams[] {
  const variations: PatternParams[] = [];

  for (let i = 0; i < count; i++) {
    const variation = deepClone(baseParams);

    // Apply small random variations to numeric parameters
    const numericParams: (keyof PatternParams)[] = ['R', 'r', 'd', 'k', 'm', 'mf', 'phase', 'rot'];

    for (const param of numericParams) {
      const value = baseParams[param] as number;
      const delta = value * variance * (Math.random() * 2 - 1);
      (variation as unknown as Record<string, number>)[param] = Math.max(0, value + delta);
    }

    // Occasionally vary symmetry
    if (Math.random() > 0.7) {
      variation.symmetry = Math.max(1, Math.min(24, baseParams.symmetry + Math.floor(Math.random() * 3) - 1));
    }

    variations.push(variation);
  }

  return variations;
}

/**
 * Interpolate between two parameter sets
 */
export function interpolateParams(
  from: PatternParams,
  to: PatternParams,
  t: number
): PatternParams {
  const result = deepClone(from);

  // Interpolate numeric values
  const numericParams: (keyof PatternParams)[] = [
    'R', 'r', 'd', 'k', 'm', 'mf', 'phase', 'rot', 's', 'lw', 'glow', 'noise'
  ];

  for (const param of numericParams) {
    const fromVal = from[param] as number;
    const toVal = to[param] as number;
    (result as unknown as Record<string, number>)[param] = fromVal + (toVal - fromVal) * t;
  }

  // Integer values need rounding
  result.symmetry = Math.round(from.symmetry + (to.symmetry - from.symmetry) * t);
  result.steps = Math.round(from.steps + (to.steps - from.steps) * t);

  // Boolean values switch at midpoint
  if (t >= 0.5) {
    result.reflectH = to.reflectH;
    result.reflectV = to.reflectV;
    result.kaleidoscope = to.kaleidoscope;
    result.useGradient = to.useGradient;
    result.dashed = to.dashed;
    result.vignette = to.vignette;
  }

  // Family switches at midpoint
  if (t >= 0.5) {
    result.family = to.family;
  }

  return result;
}

/**
 * Calculate similarity score between two parameter sets (0-1)
 */
export function calculateSimilarity(a: PatternParams, b: PatternParams): number {
  let score = 0;
  let total = 0;

  // Compare numeric parameters with weighted importance
  const weights: Record<string, number> = {
    R: 1, r: 1, d: 1, k: 2, m: 0.5, mf: 1, symmetry: 2
  };

  for (const [param, weight] of Object.entries(weights)) {
    const aVal = (a as unknown as Record<string, number>)[param];
    const bVal = (b as unknown as Record<string, number>)[param];
    const maxVal = Math.max(aVal, bVal, 1);
    const similarity = 1 - Math.abs(aVal - bVal) / maxVal;
    score += similarity * weight;
    total += weight;
  }

  // Compare family (exact match)
  if (a.family === b.family) {
    score += 3;
  }
  total += 3;

  // Compare boolean parameters
  const boolParams: (keyof PatternParams)[] = ['reflectH', 'reflectV', 'kaleidoscope'];
  for (const param of boolParams) {
    if (a[param] === b[param]) {
      score += 0.5;
    }
    total += 0.5;
  }

  return score / total;
}
