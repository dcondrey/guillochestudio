import type {
  SubscriptionPlan,
  CurveFamily,
  PatternMode,
  RosetteConfig,
  BorderConfig,
  GridConfig,
} from './types/index.js';

/**
 * Pattern Modes - how the base curve is arranged
 */
export const PATTERN_MODES: {
  value: PatternMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'curve',
    label: 'Single Curve',
    description: 'Classic guilloche with rotational symmetry',
    icon: '◎',
  },
  {
    value: 'rosette',
    label: 'Rosette',
    description: 'Closed circular security patterns',
    icon: '✿',
  },
  {
    value: 'border',
    label: 'Border',
    description: 'Linear repeating edge patterns',
    icon: '▬',
  },
  {
    value: 'grid',
    label: 'Grid',
    description: 'Tiled background patterns',
    icon: '▦',
  },
];

/**
 * Default configuration for rosette mode
 */
export const DEFAULT_ROSETTE_CONFIG: RosetteConfig = {
  envelope: 'circle',
  innerRadius: 0.15,
  outerRadius: 200,
  fillDensity: 8,
  envelopeSides: 6,
  starPointiness: 0.5,
  radialWave: 0,
  spiralTwist: 0,
};

/**
 * Default configuration for border mode
 */
export const DEFAULT_BORDER_CONFIG: BorderConfig = {
  length: 800,
  width: 100,
  waveAmplitude: 0,
  waveFrequency: 1,
  repeatCount: 4,
  mirrorAlternate: true,
  taper: 0,
};

/**
 * Default configuration for grid mode
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  tileType: 'square',
  tileWidth: 100,
  tileHeight: 100,
  rows: 4,
  cols: 4,
  spacing: 10,
  stagger: 0,
  rotateAlternate: false,
  scaleVariation: 0,
  angle: 0,
};

export const CURVE_FAMILIES: { value: CurveFamily; label: string; description: string }[] = [
  { value: 'hypo', label: 'Hypotrochoid', description: 'Circle rolling inside another circle' },
  { value: 'epi', label: 'Epitrochoid', description: 'Circle rolling outside another circle' },
  { value: 'rose', label: 'Rose Curve', description: 'Mathematical rose/rhodonea curve' },
  { value: 'liss', label: 'Lissajous', description: 'Parametric harmonic curve' },
  { value: 'spiral', label: 'Archimedean Spiral', description: 'Uniform spacing spiral' },
  { value: 'hypocycloid', label: 'Hypocycloid', description: 'Simplified hypotrochoid' },
  { value: 'epicycloid', label: 'Epicycloid', description: 'Simplified epitrochoid' },
  { value: 'fermat', label: 'Fermat Spiral', description: 'Parabolic spiral' },
  { value: 'liss3d', label: 'Lissajous 3D', description: 'Projected 3D Lissajous figure' },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    features: ['Basic patterns', 'PNG export', '3 cloud saves', 'Watermarked SVG'],
    limits: {
      saves: 3,
      exports: ['png'],
      aiRequests: 0,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    priceMonthly: 12,
    priceYearly: 99,
    features: [
      'Unlimited patterns',
      'All exports (SVG, PNG, PDF, DXF)',
      'WASM engine for 10x speed',
      '100 cloud saves',
      'Pattern DNA sharing',
      'AI parameter assistant',
      'Priority support',
    ],
    limits: {
      saves: 100,
      exports: ['svg', 'png', 'pdf', 'dxf'],
      aiRequests: 100,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    priceMonthly: 49,
    priceYearly: 399,
    features: [
      'Everything in Pro',
      'API access',
      'White-label exports',
      'Priority AI processing',
      'Unlimited cloud saves',
      'Team collaboration',
      'CNC/Laser direct integration',
      'GCODE & HPGL export',
      'Custom color profiles',
    ],
    limits: {
      saves: -1, // Unlimited
      exports: ['svg', 'png', 'pdf', 'dxf', 'gcode', 'hpgl'],
      aiRequests: -1, // Unlimited
    },
  },
];

export const EXPORT_SIZES = [
  { value: 1000, label: '1000px (Web)' },
  { value: 2000, label: '2000px (HD)' },
  { value: 4000, label: '4000px (Print)' },
  { value: 8000, label: '8000px (Poster)' },
  { value: 16000, label: '16000px (Ultra)' },
];

export const BLEND_MODES = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
] as const;

export const PRESET_PATTERNS = [
  {
    name: 'Classic',
    params: { R: 240, r: 79, d: 140, k: 13, m: 0.22, mf: 7, symmetry: 1 },
    gradient: ['#8b5cf6', '#ec4899'],
  },
  {
    name: 'Ocean',
    params: { R: 200, r: 95, d: 120, k: 8, m: 0.3, mf: 5, symmetry: 3 },
    gradient: ['#3b82f6', '#8b5cf6'],
  },
  {
    name: 'Forest',
    params: { R: 180, r: 65, d: 160, k: 7, m: 0.15, mf: 11, symmetry: 5 },
    gradient: ['#10b981', '#14b8a6'],
  },
  {
    name: 'Sunset',
    params: { R: 220, r: 110, d: 90, k: 11, m: 0.25, mf: 4, symmetry: 2 },
    gradient: ['#f59e0b', '#ea580c'],
  },
  {
    name: 'Fire',
    params: { R: 260, r: 85, d: 180, k: 17, m: 0.4, mf: 9, symmetry: 4 },
    gradient: ['#ef4444', '#f97316'],
  },
  {
    name: 'Royal',
    params: { R: 210, r: 70, d: 130, k: 15, m: 0.18, mf: 6, symmetry: 8 },
    gradient: ['#6366f1', '#a78bfa'],
  },
];

export const MAX_FREE_SAVES = 3;
export const MAX_PRO_SAVES = 100;

export const PATTERN_LIMITS = {
  free: 3,
  pro: 100,
  enterprise: Infinity,
} as const;

export const DNA_CODE_LENGTH = 8;
export const DNA_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const API_RATE_LIMITS = {
  free: { requests: 100, window: 60 * 60 * 1000 }, // 100/hour
  pro: { requests: 1000, window: 60 * 60 * 1000 }, // 1000/hour
  enterprise: { requests: 10000, window: 60 * 60 * 1000 }, // 10000/hour
};
