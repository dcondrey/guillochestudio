/**
 * Zod Schemas for API Edge Validation
 *
 * All API inputs are validated here. These schemas define the contract
 * between client and server.
 */

import { z } from 'zod';

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// =============================================================================
// PATTERN SCHEMAS
// =============================================================================

export const curveFamilySchema = z.enum([
  'hypo',
  'hypotrochoid',
  'epi',
  'epitrochoid',
  'rose',
  'liss',
  'spiral',
  'hypocycloid',
  'epicycloid',
  'fermat',
  'liss3d',
]);

export const blendModeSchema = z.enum([
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
]);

export const patternParamsSchema = z.object({
  // Curve parameters
  family: curveFamilySchema,
  R: z.number().min(10).max(450),
  r: z.number().min(5).max(300),
  d: z.number().min(0).max(320),
  k: z.number().int().min(1).max(80),
  m: z.number().min(0).max(1),
  mf: z.number().int().min(1).max(80),
  phase: z.number().min(0).max(6.283),
  rot: z.number().min(0).max(6.283),
  s: z.number().min(0.2).max(3),

  // Rendering
  steps: z.number().int().min(100).max(100000),
  lw: z.number().min(0.1).max(8),
  adaptiveSteps: z.boolean(),

  // Symmetry
  symmetry: z.number().int().min(1).max(24),
  reflectH: z.boolean(),
  reflectV: z.boolean(),
  kaleidoscope: z.boolean(),

  // Style
  aa: z.boolean(),
  dashed: z.boolean(),
  dashRatio: z.number().min(0).max(1),
  useGradient: z.boolean(),
  startColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  endColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  glow: z.number().min(0).max(50),
  noise: z.number().min(0).max(1),
  vignette: z.boolean(),
  blendMode: blendModeSchema,
});

export type PatternParams = z.infer<typeof patternParamsSchema>;

// Partial params for updates (all fields optional)
export const partialPatternParamsSchema = patternParamsSchema.partial();

// =============================================================================
// SAVE PATTERN SCHEMAS
// =============================================================================

export const savePatternRequestSchema = z.object({
  // Pattern metadata
  patternId: uuidSchema.optional(), // undefined = new pattern
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),

  // Version control
  baseVersionId: uuidSchema.optional(), // For conflict detection
  isAutosave: z.boolean().default(false),

  // Pattern data
  params: patternParamsSchema,

  // Visibility
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
});

export type SavePatternRequest = z.infer<typeof savePatternRequestSchema>;

export const savePatternResponseSchema = z.object({
  success: z.boolean(),
  patternId: uuidSchema,
  versionId: uuidSchema,
  dnaCode: z.string().length(8).optional(),
  conflict: z.boolean().default(false),
  currentVersionId: uuidSchema.optional(), // If conflict, this is the latest
});

export type SavePatternResponse = z.infer<typeof savePatternResponseSchema>;

// =============================================================================
// LOAD PATTERN SCHEMAS
// =============================================================================

export const loadPatternRequestSchema = z.object({
  patternId: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
  dnaCode: z.string().length(8).optional(),
}).refine(
  (data) => data.patternId || data.versionId || data.dnaCode,
  { message: 'One of patternId, versionId, or dnaCode is required' }
);

export type LoadPatternRequest = z.infer<typeof loadPatternRequestSchema>;

export const loadPatternResponseSchema = z.object({
  pattern: z.object({
    id: uuidSchema,
    name: z.string(),
    description: z.string().nullable(),
    currentVersionId: uuidSchema.nullable(),
    thumbnailUrl: z.string().nullable(),
    visibility: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }).nullable(),
  version: z.object({
    id: uuidSchema,
    params: patternParamsSchema,
    dnaCode: z.string().nullable(),
    createdAt: z.string(),
    parentVersionId: uuidSchema.nullable(),
  }).nullable(),
  creator: z.object({
    id: uuidSchema,
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }).nullable(),
  canEdit: z.boolean(),
  hasLocalDraft: z.boolean().default(false),
});

export type LoadPatternResponse = z.infer<typeof loadPatternResponseSchema>;

// =============================================================================
// EXPORT SCHEMAS
// =============================================================================

export const exportFormatSchema = z.enum(['svg', 'png', 'pdf', 'dxf', 'gcode', 'hpgl']);

export const exportRequestSchema = z.object({
  patternId: uuidSchema,
  versionId: uuidSchema.optional(), // Defaults to current version
  format: exportFormatSchema,
  settings: z.object({
    size: z.number().int().min(100).max(8000).default(2000),
    transparent: z.boolean().default(false),
    includeMetadata: z.boolean().default(true),
    colorProfile: z.enum(['srgb', 'cmyk']).optional(),
    dpi: z.number().int().min(72).max(600).optional(),
  }).default({}),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const exportResponseSchema = z.object({
  exportId: uuidSchema,
  status: z.enum(['queued', 'processing', 'done', 'failed']),
  downloadUrl: z.string().optional(),
  estimatedWaitSeconds: z.number().optional(),
});

export type ExportResponse = z.infer<typeof exportResponseSchema>;

export const exportStatusRequestSchema = z.object({
  exportId: uuidSchema,
});

export const exportStatusResponseSchema = z.object({
  exportId: uuidSchema,
  status: z.enum(['queued', 'processing', 'done', 'failed']),
  progress: z.number().min(0).max(100).optional(),
  downloadUrl: z.string().optional(),
  expiresAt: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type ExportStatusResponse = z.infer<typeof exportStatusResponseSchema>;

// =============================================================================
// PUBLISH/LISTING SCHEMAS
// =============================================================================

export const licenseTypeSchema = z.enum(['personal', 'commercial', 'remix']);

export const publishRequestSchema = z.object({
  patternId: uuidSchema,
  versionId: uuidSchema.optional(), // Defaults to current version
  visibility: z.enum(['public', 'listed']),
  // Marketplace listing (if visibility = 'listed')
  listing: z.object({
    priceCents: z.number().int().min(0).max(100000),
    licenseType: licenseTypeSchema,
    tags: z.array(z.string().max(30)).max(10).optional(),
  }).optional(),
});

export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const publishResponseSchema = z.object({
  success: z.boolean(),
  patternId: uuidSchema,
  dnaCode: z.string().length(8),
  shareUrl: z.string(),
  listingId: uuidSchema.optional(),
});

export type PublishResponse = z.infer<typeof publishResponseSchema>;

// =============================================================================
// DNA RESOLVE SCHEMAS
// =============================================================================

export const dnaResolveRequestSchema = z.object({
  code: z.string().length(8).regex(/^[A-Za-z0-9]+$/),
});

export type DNAResolveRequest = z.infer<typeof dnaResolveRequestSchema>;

export const dnaResolveResponseSchema = z.object({
  found: z.boolean(),
  pattern: z.object({
    id: uuidSchema.nullable(),
    name: z.string(),
    thumbnailUrl: z.string().nullable(),
    params: patternParamsSchema,
  }).optional(),
  creator: z.object({
    id: uuidSchema,
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }).nullable().optional(),
  canRemix: z.boolean().default(true),
  shareUrl: z.string(),
  embedCode: z.string().optional(),
});

export type DNAResolveResponse = z.infer<typeof dnaResolveResponseSchema>;

// =============================================================================
// MARKETPLACE SCHEMAS
// =============================================================================

export const marketplaceQuerySchema = z.object({
  search: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  licenseType: licenseTypeSchema.optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().optional(),
  sortBy: z.enum(['popular', 'recent', 'price', 'trending']).default('recent'),
  sortOrder: sortOrderSchema,
  ...paginationSchema.shape,
});

export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;

export const marketplaceListingSchema = z.object({
  id: uuidSchema,
  patternId: uuidSchema,
  name: z.string(),
  thumbnailUrl: z.string().nullable(),
  priceCents: z.number(),
  licenseType: licenseTypeSchema,
  tags: z.array(z.string()),
  viewCount: z.number(),
  salesCount: z.number(),
  createdAt: z.string(),
  creator: z.object({
    id: uuidSchema,
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
});

export type MarketplaceListing = z.infer<typeof marketplaceListingSchema>;

export const marketplaceResponseSchema = z.object({
  listings: z.array(marketplaceListingSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export type MarketplaceResponse = z.infer<typeof marketplaceResponseSchema>;

// =============================================================================
// VERSION HISTORY SCHEMAS
// =============================================================================

export const versionHistoryRequestSchema = z.object({
  patternId: uuidSchema,
  ...paginationSchema.shape,
});

export type VersionHistoryRequest = z.infer<typeof versionHistoryRequestSchema>;

export const versionSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  dnaCode: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.object({
    id: uuidSchema,
    displayName: z.string().nullable(),
  }),
  isAutosave: z.boolean(),
  isCurrent: z.boolean(),
});

export type VersionSummary = z.infer<typeof versionSummarySchema>;

export const versionHistoryResponseSchema = z.object({
  patternId: uuidSchema,
  versions: z.array(versionSummarySchema),
  total: z.number(),
});

export type VersionHistoryResponse = z.infer<typeof versionHistoryResponseSchema>;

// =============================================================================
// LOCAL DRAFT SCHEMAS
// =============================================================================

export const saveDraftRequestSchema = z.object({
  patternId: uuidSchema.optional(),
  baseVersionId: uuidSchema.optional(),
  params: patternParamsSchema,
});

export type SaveDraftRequest = z.infer<typeof saveDraftRequestSchema>;

export const loadDraftResponseSchema = z.object({
  hasDraft: z.boolean(),
  draft: z.object({
    patternId: uuidSchema.nullable(),
    baseVersionId: uuidSchema.nullable(),
    params: patternParamsSchema,
    lastModifiedAt: z.string(),
  }).nullable(),
});

export type LoadDraftResponse = z.infer<typeof loadDraftResponseSchema>;

// =============================================================================
// ERROR SCHEMAS
// =============================================================================

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type APIError = z.infer<typeof apiErrorSchema>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validate request body and return typed result or throw
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}

/**
 * Validation error with Zod details
 */
export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly details: z.ZodError;

  constructor(zodError: z.ZodError) {
    const message = zodError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    super(`Validation failed: ${message}`);
    this.name = 'ValidationError';
    this.details = zodError;
  }

  toJSON(): APIError {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: {
          issues: this.details.errors.map((e) => ({
            path: e.path,
            message: e.message,
            code: e.code,
          })),
        },
      },
    };
  }
}
