/**
 * Environment Variable Validation
 *
 * This module provides type-safe access to environment variables with runtime validation.
 * It uses Zod schemas to validate all required variables at startup and provides
 * clear error messages for missing or invalid configuration.
 */

import { z } from 'zod';

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Public environment variables (exposed to the browser)
 * These must be prefixed with PUBLIC_ in SvelteKit
 */
export const publicEnvSchema = z.object({
  // Supabase
  PUBLIC_SUPABASE_URL: z
    .string()
    .url('PUBLIC_SUPABASE_URL must be a valid URL')
    .startsWith('https://', 'PUBLIC_SUPABASE_URL must use HTTPS'),
  PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'PUBLIC_SUPABASE_ANON_KEY is required')
    .regex(/^eyJ/, 'PUBLIC_SUPABASE_ANON_KEY must be a valid JWT'),

  // Stripe
  PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'PUBLIC_STRIPE_PUBLISHABLE_KEY is required')
    .regex(
      /^pk_(test|live)_/,
      'PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_'
    ),

  // App Configuration
  PUBLIC_APP_URL: z
    .string()
    .url('PUBLIC_APP_URL must be a valid URL')
    .optional()
    .default('http://localhost:5173'),
});

/**
 * Private/Server-only environment variables
 * These are never exposed to the browser
 */
export const privateEnvSchema = z.object({
  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required')
    .regex(/^eyJ/, 'SUPABASE_SERVICE_ROLE_KEY must be a valid JWT'),

  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY is required')
    .regex(/^sk_(test|live)_/, 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required')
    .regex(/^whsec_/, 'STRIPE_WEBHOOK_SECRET must start with whsec_'),

  // Stripe Price IDs
  STRIPE_PRICE_PRO_MONTHLY: z
    .string()
    .min(1, 'STRIPE_PRICE_PRO_MONTHLY is required')
    .regex(/^price_/, 'STRIPE_PRICE_PRO_MONTHLY must be a valid Stripe price ID'),
  STRIPE_PRICE_PRO_YEARLY: z
    .string()
    .min(1, 'STRIPE_PRICE_PRO_YEARLY is required')
    .regex(/^price_/, 'STRIPE_PRICE_PRO_YEARLY must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z
    .string()
    .min(1, 'STRIPE_PRICE_ENTERPRISE_MONTHLY is required')
    .regex(/^price_/, 'STRIPE_PRICE_ENTERPRISE_MONTHLY must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z
    .string()
    .min(1, 'STRIPE_PRICE_ENTERPRISE_YEARLY is required')
    .regex(/^price_/, 'STRIPE_PRICE_ENTERPRISE_YEARLY must be a valid Stripe price ID'),
});

/**
 * Optional environment variables with sensible defaults
 */
export const optionalEnvSchema = z.object({
  // Logging & Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),

  // Feature flags
  ENABLE_AI_FEATURES: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional()
    .prefault('false'),

  // Rate limiting
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .optional()
    .prefault('true'),

  // Sentry DSN for error tracking
  SENTRY_DSN: z.string().url().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type PrivateEnv = z.infer<typeof privateEnvSchema>;
export type OptionalEnv = z.infer<typeof optionalEnvSchema>;
export type AllEnv = PublicEnv & PrivateEnv & OptionalEnv;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validation result containing either the parsed env or error details
 */
export interface EnvValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Format Zod errors into human-readable messages
 */
function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((err) => {
    const path = err.path.join('.');
    return `  - ${path}: ${err.message}`;
  });
}

/**
 * Validate public environment variables
 */
export function validatePublicEnv(
  env: Record<string, string | undefined>
): EnvValidationResult<PublicEnv> {
  const result = publicEnvSchema.safeParse(env);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validate private environment variables
 */
export function validatePrivateEnv(
  env: Record<string, string | undefined>
): EnvValidationResult<PrivateEnv> {
  const result = privateEnvSchema.safeParse(env);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validate optional environment variables
 */
export function validateOptionalEnv(
  env: Record<string, string | undefined>
): EnvValidationResult<OptionalEnv> {
  const result = optionalEnvSchema.safeParse(env);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

// =============================================================================
// Environment Validation Entry Point
// =============================================================================

export interface ValidationOptions {
  /** Throw error on validation failure (default: true) */
  throwOnError?: boolean;
  /** Skip private env validation (useful for client-side) */
  skipPrivate?: boolean;
}

/**
 * Validate all environment variables
 *
 * @param publicEnv - Public environment variables (from $env/static/public)
 * @param privateEnv - Private environment variables (from $env/static/private)
 * @param options - Validation options
 * @throws Error if validation fails and throwOnError is true
 */
export function validateEnv(
  publicEnv: Record<string, string | undefined>,
  privateEnv: Record<string, string | undefined> = {},
  options: ValidationOptions = {}
): { public: PublicEnv; private?: PrivateEnv; optional: OptionalEnv } {
  const { throwOnError = true, skipPrivate = false } = options;

  const errors: string[] = [];

  // Validate public env
  const publicResult = validatePublicEnv(publicEnv);
  if (!publicResult.success) {
    errors.push('Public environment variables:', ...publicResult.errors!);
  }

  // Validate private env (only on server)
  let privateResult: EnvValidationResult<PrivateEnv> | undefined;
  if (!skipPrivate) {
    privateResult = validatePrivateEnv(privateEnv);
    if (!privateResult.success) {
      errors.push('Private environment variables:', ...privateResult.errors!);
    }
  }

  // Validate optional env (merge both sources)
  const optionalResult = validateOptionalEnv({ ...publicEnv, ...privateEnv });
  if (!optionalResult.success) {
    errors.push('Optional environment variables:', ...optionalResult.errors!);
  }

  // Handle errors
  if (errors.length > 0) {
    const errorMessage = [
      '',
      '='.repeat(60),
      'ENVIRONMENT CONFIGURATION ERROR',
      '='.repeat(60),
      '',
      'The following environment variables are missing or invalid:',
      '',
      ...errors,
      '',
      'Please check your .env file or environment configuration.',
      'See .env.example for required variables.',
      '',
      '='.repeat(60),
      '',
    ].join('\n');

    if (throwOnError) {
      throw new Error(errorMessage);
    }

    console.error(errorMessage);
  }

  return {
    public: publicResult.data!,
    private: privateResult?.data,
    optional: optionalResult.data!,
  };
}

// =============================================================================
// Environment Mode Detection
// =============================================================================

/**
 * Check if running in production mode
 */
export function isProduction(env: { PUBLIC_APP_URL?: string }): boolean {
  const url = env.PUBLIC_APP_URL || '';
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}

/**
 * Check if Stripe is in live mode
 */
export function isStripeLiveMode(env: { PUBLIC_STRIPE_PUBLISHABLE_KEY?: string }): boolean {
  return env.PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_') ?? false;
}

/**
 * Validate that production uses live Stripe keys
 */
export function validateProductionStripeConfig(env: {
  PUBLIC_APP_URL?: string;
  PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
}): void {
  if (isProduction(env)) {
    if (!env.PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_')) {
      console.warn('[WARNING] Production environment using Stripe test keys!');
    }
    if (!env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
      console.warn('[WARNING] Production environment using Stripe test secret key!');
    }
  }
}
