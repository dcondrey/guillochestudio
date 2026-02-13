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
