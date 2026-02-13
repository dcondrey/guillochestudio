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

/**
 * Pattern Mode - determines how the base curve is arranged
 * - 'curve': Single curve with symmetry (default, current behavior)
 * - 'rosette': Closed circular patterns with envelope
 * - 'border': Linear repeating patterns for edges/frames
 * - 'grid': 2D repeating background patterns
 */
export type PatternMode = 'curve' | 'rosette' | 'border' | 'grid';

/**
 * Rosette envelope shape for rosette mode
 */
export type RosetteEnvelope = 'circle' | 'ellipse' | 'polygon' | 'star';

/**
 * Border corner handling for border mode
 */
export type BorderCornerStyle = 'miter' | 'round' | 'continue' | 'none';

/**
 * Grid tile type for grid mode
 */
export type GridTileType = 'square' | 'hex' | 'triangle' | 'diamond';

/**
 * Rosette-specific configuration
 */
export interface RosetteConfig {
  envelope: RosetteEnvelope;
  innerRadius: number; // 0-1, percentage of outer radius
  outerRadius: number; // Actual radius in canvas units
  fillDensity: number; // 1-20, number of concentric rings
  envelopeSides: number; // For polygon/star: 3-12 sides
  starPointiness: number; // For star: 0-1, how pointy
  radialWave: number; // 0-1, waviness of radial lines
  spiralTwist: number; // Degrees of spiral twist per ring
}

/**
 * Border-specific configuration
 */
export interface BorderConfig {
  length: number; // Total border length
  width: number; // Border width/height
  cornerStyle: BorderCornerStyle;
  waveAmplitude: number; // 0-50, baseline wave height
  waveFrequency: number; // 1-20, waves per unit length
  repeatCount: number; // Number of pattern repeats
  mirrorAlternate: boolean; // Mirror every other repeat
  taper: number; // 0-1, taper at ends
}

/**
 * Grid-specific configuration
 */
export interface GridConfig {
  tileType: GridTileType;
  tileWidth: number; // Width of each tile
  tileHeight: number; // Height of each tile
  rows: number; // Number of rows
  cols: number; // Number of columns
  spacing: number; // Gap between tiles
  stagger: number; // 0-1, horizontal stagger for brick-like patterns
  rotateAlternate: boolean; // Rotate every other tile
  scaleVariation: number; // 0-0.5, random scale variation
  angle: number; // Overall grid rotation
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten';

export type LicenseType = 'personal' | 'commercial' | 'remix';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'dxf' | 'gcode' | 'hpgl';

export interface PatternParams {
  // Pattern mode (determines arrangement)
  mode: PatternMode;

  // Curve parameters
  family: CurveFamily;
  R: number; // Outer radius
  r: number; // Inner radius
  d: number; // Pen offset
  k: number; // Frequency
  m: number; // Modulation depth
  mf: number; // Modulation frequency
  phase: number; // Phase shift
  rot: number; // Rotation
  s: number; // Scale

  // Rendering
  steps: number;
  lw: number; // Line width
  adaptiveSteps: boolean;

  // Symmetry
  symmetry: number;
  reflectH: boolean;
  reflectV: boolean;
  kaleidoscope: boolean;

  // Style
  aa: boolean; // Anti-aliasing / engraving alpha
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

  // Mode-specific configurations
  rosette?: RosetteConfig;
  border?: BorderConfig;
  grid?: GridConfig;
}

export interface PatternLayer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  blendMode: BlendMode;
  params: Partial<PatternParams>;
  opacity: number;
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

// User Types
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

export interface Purchase {
  id: string;
  userId: string;
  patternId: string;
  licenseType: LicenseType;
  priceCents: number;
  stripePaymentId?: string;
  royaltyPaidCents: number;
  createdAt: Date;
}

// Pattern DNA Types
export interface PatternDNA {
  shortCode: string;
  patternId?: string;
  params: PatternParams;
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

// Animation Types
export interface AnimationKeyframe {
  time: number;
  params: Partial<PatternParams>;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface AnimationConfig {
  duration: number;
  loop: boolean;
  keyframes: AnimationKeyframe[];
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Subscription Types
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

// Marketplace Types
export interface MarketplaceFilter {
  search?: string;
  tags?: string[];
  licenseType?: LicenseType;
  priceMin?: number;
  priceMax?: number;
  sortBy?: 'popular' | 'recent' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface MarketplaceListing {
  pattern: Pattern;
  creator: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  remixCount: number;
  purchaseCount: number;
}
