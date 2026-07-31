// Pattern Types
export type CurveFamily =
  | 'hypo'
  | 'hypotrochoid'
  | 'epi'
  | 'epitrochoid'
  | 'rose'
  | 'liss'
  | 'spiral'
  | 'hypocycloid'
  | 'epicycloid'
  | 'fermat'
  | 'liss3d';

export type PatternMode = 'curve' | 'rosette' | 'border' | 'grid';

export type RosetteEnvelope = 'circle' | 'ellipse' | 'polygon' | 'star';

export type BorderCornerStyle = 'miter' | 'round' | 'continue' | 'none';

export type GridTileType = 'square' | 'hex' | 'triangle' | 'diamond';

/**
 * Advanced Modulation types for relief and security effects
 */
export interface ModulationParams {
  depth: number; // Relief depth (displacement)
  frequency: number; // Modulation frequency
  phase: number; // Phase shift
  type: 'sine' | 'saw' | 'noise';
  target: 'radius' | 'width' | 'phase';
}

/**
 * Security ink / element configuration
 */
export interface SecurityConfig {
  uvActive: boolean;
  uvColor?: string;
  holographicActive: boolean;
  rainbowActive: boolean;
  rainbowAngle?: number;
}

export interface RosetteConfig {
  envelope: RosetteEnvelope;
  innerRadius: number;
  outerRadius: number;
  fillDensity: number;
  envelopeSides: number;
  starPointiness: number;
  radialWave: number;
  spiralTwist: number;
}

export interface BorderConfig {
  length: number;
  width: number;
  cornerStyle: BorderCornerStyle;
  waveAmplitude: number;
  waveFrequency: number;
  repeatCount: number;
  mirrorAlternate: boolean;
  taper: number;
}

export interface GridConfig {
  tileType: GridTileType;
  tileWidth: number;
  tileHeight: number;
  rows: number;
  cols: number;
  spacing: number;
  stagger: number;
  rotateAlternate: boolean;
  scaleVariation: number;
  angle: number;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type LicenseType = 'personal' | 'commercial' | 'remix';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'dxf' | 'gcode' | 'hpgl';

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: {
    saves: number;
    exports: ExportFormat[];
    aiRequests: number;
  };
}

export interface PatternParams {
  // Pattern mode
  mode: PatternMode;

  // Curve parameters
  family: CurveFamily;
  R: number;
  r: number;
  d: number;
  k: number;
  m: number;
  mf: number;
  phase: number;
  rot: number;
  s: number;

  // Rendering
  steps: number;
  lw: number;
  adaptiveSteps: boolean;

  // Advanced features
  modulation?: ModulationParams;
  security?: SecurityConfig;
  stepRepeat?: {
    count: number;
    offsetX: number;
    offsetY: number;
    rotateStep: number;
  };

  // Security text integration
  text?: {
    content: string;
    fontSize: number;
    followPath: boolean;
    repeat: boolean;
    active?: boolean;
    color?: string;
    density?: number;
  };

  // Symmetry
  symmetry: number;
  reflectH: boolean;
  reflectV: boolean;
  kaleidoscope: boolean;

  // Style
  aa: boolean;
  dashed: boolean;
  dashRatio: number;
  useGradient: boolean;
  startColor: string;
  endColor: string;
  bgColor: string;
  glow: number;
  noise: number;
  vignette: boolean;
  blendMode: BlendMode;

  // Mode-specific
  rosette?: RosetteConfig;
  border?: BorderConfig;
  grid?: GridConfig;

  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
  };
}

export interface ManualPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number }; // Control point 1
  cp2?: { x: number; y: number }; // Control point 2
  type: 'corner' | 'bezier' | 'smooth';
}

export interface ManualPath {
  segments: {
    points: ManualPoint[];
    closed: boolean;
  }[];
}

export interface PatternLayer {
  id: string;
  name: string;
  type: 'vector' | 'image' | 'path'; // Added 'path' for manual edits
  visible: boolean;
  color: string;
  blendMode: BlendMode;
  params: Partial<PatternParams>;
  opacity: number;
  imageUrl?: string;
  brightness?: number;
  contrast?: number;
  manualPath?: ManualPath; // For 'path' type layers
}

export interface Pattern {
  id: string;
  userId: string;
  name: string;
  description?: string;
  params: PatternParams;
  layers?: PatternLayer[];
  thumbnailUrl?: string;
  isPublic: boolean;
  isListed: boolean;
  licenseType: LicenseType;
  priceCents: number;
  remixOf?: string;
  tags: string[];
  viewCount: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// User Profile
export interface UserProfile {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId?: string;
  createdAt: Date;
}

// Export Types
export interface ExportOptions {
  format: ExportFormat;
  size: number;
  transparent: boolean;
  includeMetadata: boolean;
  colorProfile?: 'srgb' | 'cmyk';
  dpi?: number;
}
