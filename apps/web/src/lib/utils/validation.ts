/**
 * Input Validation Utilities
 * Using Zod for runtime type checking and validation
 */

import { z } from 'zod';

// =============================================================================
// Pattern Parameter Schemas
// =============================================================================

export const CurveFamilySchema = z.enum([
  'hypotrochoid',
  'epitrochoid',
  'rose',
  'lissajous',
  'spirograph',
  'maurer',
]);

export const PatternParamsSchema = z.object({
  // Curve type
  family: CurveFamilySchema.default('hypotrochoid'),

  // Geometric parameters
  R: z.number().min(10).max(500).default(200),
  r: z.number().min(5).max(400).default(80),
  d: z.number().min(0).max(400).default(120),
  k: z.number().min(1).max(100).default(7),

  // Lissajous parameters
  a: z.number().min(1).max(20).optional(),
  b: z.number().min(1).max(20).optional(),
  delta: z.number().min(0).max(Math.PI * 2).optional(),

  // Rendering parameters
  steps: z.number().min(100).max(100000).default(10000),
  lw: z.number().min(0.1).max(10).default(1),

  // Symmetry
  symmetry: z.number().min(1).max(24).default(1),
  reflectH: z.boolean().default(false),
  reflectV: z.boolean().default(false),
  kaleidoscope: z.boolean().default(false),
  rotation: z.number().min(0).max(360).default(0),

  // Colors
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#0f172a'),
  startColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  endColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#8B5CF6'),
  useGradient: z.boolean().default(true),

  // Effects
  glow: z.number().min(0).max(50).default(0),
  vignette: z.boolean().default(false),
  dashed: z.boolean().default(false),
  dashRatio: z.number().min(0.1).max(0.9).default(0.5),
});

export type PatternParams = z.infer<typeof PatternParamsSchema>;

// =============================================================================
// API Request Schemas
// =============================================================================

export const CreatePatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  parameters: PatternParamsSchema,
  isPublic: z.boolean().default(false),
  isListed: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const UpdatePatternSchema = CreatePatternSchema.partial().extend({
  id: z.string().uuid(),
});

export const AIRequestSchema = z.object({
  keywords: z.array(z.string().min(1).max(50)).min(1).max(10),
  style: z.enum(['geometric', 'organic', 'classic', 'modern']).optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
});

export const ExportRequestSchema = z.object({
  format: z.enum(['svg', 'png', 'pdf', 'dxf', 'gcode', 'hpgl']),
  parameters: PatternParamsSchema,
  options: z.object({
    width: z.number().min(100).max(16000).default(1920),
    height: z.number().min(100).max(16000).default(1080),
    dpi: z.number().min(72).max(600).default(300),
    background: z.boolean().default(true),
    optimizePath: z.boolean().default(true),
    tolerance: z.number().min(0.01).max(10).default(0.5),
  }).optional(),
});

export const PurchaseRequestSchema = z.object({
  patternId: z.string().uuid(),
  licenseType: z.enum(['personal', 'commercial', 'remix']),
});

export const DNASchema = z.object({
  code: z.string().regex(/^[0-9A-Za-z]{6,12}$/),
});

// =============================================================================
// User Input Schemas
// =============================================================================

export const ProfileUpdateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

export const FeedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'question', 'other']),
  subject: z.string().min(5).max(200),
  message: z.string().min(20).max(5000),
  email: z.string().email().optional(),
});

// =============================================================================
// Validation Helpers
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    })),
  };
}

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// =============================================================================
// Sanitization
// =============================================================================

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS vectors
    .slice(0, 10000); // Limit length
}

export function sanitizeParams(params: unknown): Partial<PatternParams> {
  if (typeof params !== 'object' || params === null) {
    return {};
  }

  const result = PatternParamsSchema.safeParse(params);
  return result.success ? result.data : {};
}

// =============================================================================
// Request Validation Middleware Helper
// =============================================================================

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<{ valid: true; data: T } | { valid: false; error: string }> => {
    const result = schema.safeParse(data);

    if (result.success) {
      return { valid: true, data: result.data };
    }

    const errorMessage = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');

    return { valid: false, error: errorMessage };
  };
}
