import type {
  PatternParams,
  PatternMode,
  RosetteConfig,
  BorderConfig,
  GridConfig,
} from '@guilloche/shared';
import {
  getDefaultParams,
  deepClone,
  DEFAULT_ROSETTE_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_GRID_CONFIG,
} from '@guilloche/shared';

export interface RandomizationOptions {
  family?: boolean;
  geometry?: boolean;
  modulation?: boolean;
  symmetry?: boolean;
  colors?: boolean;
  mode?: boolean;
  modeConfig?: boolean;
}

// Presets for smart randomization based on curve family
const FAMILY_RANGES: Record<
  string,
  {
    R: [number, number];
    r: [number, number];
    d: [number, number];
    k: [number, number];
    m: [number, number];
    mf: [number, number];
    symmetry: [number, number];
  }
> = {
  rose: {
    R: [180, 260],
    r: [40, 100],
    d: [120, 200],
    k: [5, 25],
    m: [0.1, 0.4],
    mf: [3, 12],
    symmetry: [1, 8],
  },
  hypo: {
    R: [200, 350],
    r: [50, 150],
    d: [80, 220],
    k: [3, 15],
    m: [0.05, 0.3],
    mf: [2, 10],
    symmetry: [1, 6],
  },
  epi: {
    R: [180, 300],
    r: [40, 120],
    d: [60, 180],
    k: [4, 12],
    m: [0.1, 0.35],
    mf: [3, 9],
    symmetry: [1, 5],
  },
  spiral: {
    R: [20, 80],
    r: [30, 100],
    d: [0, 0],
    k: [3, 12],
    m: [0.2, 0.6],
    mf: [5, 20],
    symmetry: [1, 1],
  },
  liss: {
    R: [150, 250],
    r: [100, 200],
    d: [50, 150],
    k: [1, 7],
    m: [0, 0.2],
    mf: [1, 7],
    symmetry: [1, 4],
  },
  fermat: {
    R: [150, 250],
    r: [50, 100],
    d: [0, 0],
    k: [2, 8],
    m: [0.1, 0.3],
    mf: [3, 10],
    symmetry: [1, 3],
  },
  liss3d: {
    R: [120, 200],
    r: [80, 160],
    d: [60, 140],
    k: [2, 6],
    m: [0.1, 0.25],
    mf: [2, 6],
    symmetry: [1, 4],
  },
  hypocycloid: {
    R: [200, 300],
    r: [50, 100],
    d: [50, 100],
    k: [3, 12],
    m: [0.1, 0.3],
    mf: [3, 8],
    symmetry: [1, 6],
  },
  epicycloid: {
    R: [180, 280],
    r: [40, 90],
    d: [40, 90],
    k: [4, 10],
    m: [0.1, 0.3],
    mf: [3, 8],
    symmetry: [1, 5],
  },
};

// Mode-specific configuration ranges
const MODE_RANGES = {
  rosette: {
    innerRadius: [0.05, 0.4] as [number, number],
    outerRadius: [150, 300] as [number, number],
    fillDensity: [4, 15] as [number, number],
    envelopeSides: [3, 12] as [number, number],
    starPointiness: [0.2, 0.8] as [number, number],
    radialWave: [0, 0.5] as [number, number],
    spiralTwist: [0, 45] as [number, number],
  },
  border: {
    length: [400, 1200] as [number, number],
    width: [50, 200] as [number, number],
    waveAmplitude: [0, 30] as [number, number],
    waveFrequency: [1, 10] as [number, number],
    repeatCount: [2, 8] as [number, number],
    taper: [0, 0.3] as [number, number],
  },
  grid: {
    tileWidth: [60, 150] as [number, number],
    tileHeight: [60, 150] as [number, number],
    rows: [2, 6] as [number, number],
    cols: [2, 6] as [number, number],
    spacing: [5, 30] as [number, number],
    stagger: [0, 0.5] as [number, number],
    scaleVariation: [0, 0.2] as [number, number],
    angle: [0, 45] as [number, number],
  },
};

// Pattern modes available for randomization
const PATTERN_MODES: PatternMode[] = ['curve', 'rosette', 'border', 'grid'];

// Envelope types for rosette
const ROSETTE_ENVELOPES: RosetteConfig['envelope'][] = ['circle', 'ellipse', 'polygon', 'star'];

// Tile types for grid
const GRID_TILE_TYPES: GridConfig['tileType'][] = ['square', 'hex', 'triangle', 'diamond'];

// Corner styles for border
const BORDER_CORNER_STYLES: BorderConfig['cornerStyle'][] = ['miter', 'round', 'continue', 'none'];

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
  return (
    '#' +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')
  );
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

  // Randomize mode
  if (options.mode !== false) {
    result.mode = randomPick(PATTERN_MODES);
  }

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

  // Randomize mode-specific configuration
  if (options.modeConfig !== false) {
    result.rosette = randomizeRosetteConfig(result.rosette);
    result.border = randomizeBorderConfig(result.border);
    result.grid = randomizeGridConfig(result.grid);
  }

  return result;
}

/**
 * Randomize rosette configuration
 */
function randomizeRosetteConfig(base?: RosetteConfig): RosetteConfig {
  const ranges = MODE_RANGES.rosette;
  return {
    envelope: randomPick(ROSETTE_ENVELOPES),
    innerRadius: randomInRange(ranges.innerRadius[0], ranges.innerRadius[1], 0.01),
    outerRadius: randomInRange(ranges.outerRadius[0], ranges.outerRadius[1]),
    fillDensity: randomInRange(ranges.fillDensity[0], ranges.fillDensity[1]),
    envelopeSides: randomInRange(ranges.envelopeSides[0], ranges.envelopeSides[1]),
    starPointiness: randomInRange(ranges.starPointiness[0], ranges.starPointiness[1], 0.01),
    radialWave: randomInRange(ranges.radialWave[0], ranges.radialWave[1], 0.01),
    spiralTwist: randomInRange(ranges.spiralTwist[0], ranges.spiralTwist[1]),
    ...base,
  };
}

/**
 * Randomize border configuration
 */
function randomizeBorderConfig(base?: BorderConfig): BorderConfig {
  const ranges = MODE_RANGES.border;
  return {
    length: randomInRange(ranges.length[0], ranges.length[1]),
    width: randomInRange(ranges.width[0], ranges.width[1]),
    cornerStyle: randomPick(BORDER_CORNER_STYLES),
    waveAmplitude: randomInRange(ranges.waveAmplitude[0], ranges.waveAmplitude[1]),
    waveFrequency: randomInRange(ranges.waveFrequency[0], ranges.waveFrequency[1]),
    repeatCount: randomInRange(ranges.repeatCount[0], ranges.repeatCount[1]),
    mirrorAlternate: Math.random() > 0.5,
    taper: randomInRange(ranges.taper[0], ranges.taper[1], 0.01),
    ...base,
  };
}

/**
 * Randomize grid configuration
 */
function randomizeGridConfig(base?: GridConfig): GridConfig {
  const ranges = MODE_RANGES.grid;
  return {
    tileType: randomPick(GRID_TILE_TYPES),
    tileWidth: randomInRange(ranges.tileWidth[0], ranges.tileWidth[1]),
    tileHeight: randomInRange(ranges.tileHeight[0], ranges.tileHeight[1]),
    rows: randomInRange(ranges.rows[0], ranges.rows[1]),
    cols: randomInRange(ranges.cols[0], ranges.cols[1]),
    spacing: randomInRange(ranges.spacing[0], ranges.spacing[1]),
    stagger: randomInRange(ranges.stagger[0], ranges.stagger[1], 0.01),
    rotateAlternate: Math.random() > 0.7,
    scaleVariation: randomInRange(ranges.scaleVariation[0], ranges.scaleVariation[1], 0.01),
    angle: randomInRange(ranges.angle[0], ranges.angle[1]),
    ...base,
  };
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
      variation.symmetry = Math.max(
        1,
        Math.min(24, baseParams.symmetry + Math.floor(Math.random() * 3) - 1)
      );
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
    'R',
    'r',
    'd',
    'k',
    'm',
    'mf',
    'phase',
    'rot',
    's',
    'lw',
    'glow',
    'noise',
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

  // Family and mode switch at midpoint
  if (t >= 0.5) {
    result.family = to.family;
    result.mode = to.mode;
  }

  // Interpolate mode-specific configurations
  if (from.rosette && to.rosette) {
    result.rosette = interpolateRosetteConfig(from.rosette, to.rosette, t);
  }
  if (from.border && to.border) {
    result.border = interpolateBorderConfig(from.border, to.border, t);
  }
  if (from.grid && to.grid) {
    result.grid = interpolateGridConfig(from.grid, to.grid, t);
  }

  return result;
}

/**
 * Interpolate rosette configuration
 */
function interpolateRosetteConfig(
  from: RosetteConfig,
  to: RosetteConfig,
  t: number
): RosetteConfig {
  return {
    envelope: t >= 0.5 ? to.envelope : from.envelope,
    innerRadius: from.innerRadius + (to.innerRadius - from.innerRadius) * t,
    outerRadius: from.outerRadius + (to.outerRadius - from.outerRadius) * t,
    fillDensity: Math.round(from.fillDensity + (to.fillDensity - from.fillDensity) * t),
    envelopeSides: Math.round(from.envelopeSides + (to.envelopeSides - from.envelopeSides) * t),
    starPointiness: from.starPointiness + (to.starPointiness - from.starPointiness) * t,
    radialWave: from.radialWave + (to.radialWave - from.radialWave) * t,
    spiralTwist: from.spiralTwist + (to.spiralTwist - from.spiralTwist) * t,
  };
}

/**
 * Interpolate border configuration
 */
function interpolateBorderConfig(from: BorderConfig, to: BorderConfig, t: number): BorderConfig {
  return {
    length: from.length + (to.length - from.length) * t,
    width: from.width + (to.width - from.width) * t,
    cornerStyle: t >= 0.5 ? to.cornerStyle : from.cornerStyle,
    waveAmplitude: from.waveAmplitude + (to.waveAmplitude - from.waveAmplitude) * t,
    waveFrequency: from.waveFrequency + (to.waveFrequency - from.waveFrequency) * t,
    repeatCount: Math.round(from.repeatCount + (to.repeatCount - from.repeatCount) * t),
    mirrorAlternate: t >= 0.5 ? to.mirrorAlternate : from.mirrorAlternate,
    taper: from.taper + (to.taper - from.taper) * t,
  };
}

/**
 * Interpolate grid configuration
 */
function interpolateGridConfig(from: GridConfig, to: GridConfig, t: number): GridConfig {
  return {
    tileType: t >= 0.5 ? to.tileType : from.tileType,
    tileWidth: from.tileWidth + (to.tileWidth - from.tileWidth) * t,
    tileHeight: from.tileHeight + (to.tileHeight - from.tileHeight) * t,
    rows: Math.round(from.rows + (to.rows - from.rows) * t),
    cols: Math.round(from.cols + (to.cols - from.cols) * t),
    spacing: from.spacing + (to.spacing - from.spacing) * t,
    stagger: from.stagger + (to.stagger - from.stagger) * t,
    rotateAlternate: t >= 0.5 ? to.rotateAlternate : from.rotateAlternate,
    scaleVariation: from.scaleVariation + (to.scaleVariation - from.scaleVariation) * t,
    angle: from.angle + (to.angle - from.angle) * t,
  };
}

/**
 * Calculate similarity score between two parameter sets (0-1)
 */
export function calculateSimilarity(a: PatternParams, b: PatternParams): number {
  let score = 0;
  let total = 0;

  // Compare numeric parameters with weighted importance
  const weights: Record<string, number> = {
    R: 1,
    r: 1,
    d: 1,
    k: 2,
    m: 0.5,
    mf: 1,
    symmetry: 2,
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

  // Compare mode (exact match, high weight for security patterns)
  if (a.mode === b.mode) {
    score += 4;
  }
  total += 4;

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
