#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 *
 * This script validates environment variables before build time.
 * It can be run standalone or as part of the build process.
 *
 * Usage:
 *   pnpm run validate:env           # Validate current environment
 *   pnpm run validate:env --strict  # Fail on any warning
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Required variables missing or invalid
 */

import { config } from 'dotenv';
import { z } from 'zod';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// =============================================================================
// Schema Definitions (duplicated from env.ts for standalone execution)
// =============================================================================

const publicEnvSchema = z.object({
  PUBLIC_SUPABASE_URL: z
    .string()
    .url('Must be a valid URL')
    .startsWith('https://', 'Must use HTTPS'),
  PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Required').regex(/^eyJ/, 'Must be a valid JWT'),
  PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'Required')
    .regex(/^pk_(test|live)_/, 'Must start with pk_test_ or pk_live_'),
  PUBLIC_APP_URL: z.string().url('Must be a valid URL').optional().default('http://localhost:5173'),
});

const privateEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Required').regex(/^eyJ/, 'Must be a valid JWT'),
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'Required')
    .regex(/^sk_(test|live)_/, 'Must start with sk_test_ or sk_live_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'Required')
    .regex(/^whsec_/, 'Must start with whsec_'),
  STRIPE_PRICE_PRO_MONTHLY: z
    .string()
    .min(1, 'Required')
    .regex(/^price_/, 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_PRO_YEARLY: z
    .string()
    .min(1, 'Required')
    .regex(/^price_/, 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE_MONTHLY: z
    .string()
    .min(1, 'Required')
    .regex(/^price_/, 'Must be a valid Stripe price ID'),
  STRIPE_PRICE_ENTERPRISE_YEARLY: z
    .string()
    .min(1, 'Required')
    .regex(/^price_/, 'Must be a valid Stripe price ID'),
});

// =============================================================================
// Helpers
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function formatErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return `    ${path}: ${err.message}`;
  });
}

// =============================================================================
// Main Validation
// =============================================================================

async function main(): Promise<void> {
  const isStrict = process.argv.includes('--strict');

  log('');
  log('='.repeat(60), colors.blue);
  log('  Environment Variable Validation', colors.bold);
  log('='.repeat(60), colors.blue);
  log('');

  // Load .env file if it exists
  const envPath = resolve(rootDir, '.env');
  const envExists = existsSync(envPath);

  if (envExists) {
    config({ path: envPath });
    log(`  Loaded .env from: ${envPath}`, colors.dim);
  } else {
    log(`  No .env file found at: ${envPath}`, colors.yellow);
    log(`  Using system environment variables only`, colors.dim);
  }

  log('');

  let hasErrors = false;
  let hasWarnings = false;

  // Validate public environment variables
  log('  Checking PUBLIC environment variables...', colors.blue);
  const publicResult = publicEnvSchema.safeParse(process.env);

  if (publicResult.success) {
    log('  [PASS] All public variables valid', colors.green);
    log('');

    // Show parsed values (redacted)
    log('  Parsed values:', colors.dim);
    log(`    PUBLIC_SUPABASE_URL: ${publicResult.data.PUBLIC_SUPABASE_URL}`, colors.dim);
    log(
      `    PUBLIC_SUPABASE_ANON_KEY: ${publicResult.data.PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...`,
      colors.dim
    );
    log(
      `    PUBLIC_STRIPE_PUBLISHABLE_KEY: ${publicResult.data.PUBLIC_STRIPE_PUBLISHABLE_KEY.substring(0, 15)}...`,
      colors.dim
    );
    log(`    PUBLIC_APP_URL: ${publicResult.data.PUBLIC_APP_URL}`, colors.dim);
  } else {
    hasErrors = true;
    log('  [FAIL] Public variables have errors:', colors.red);
    formatErrors(publicResult.error).forEach((err) => log(err, colors.red));
  }

  log('');

  // Validate private environment variables
  log('  Checking PRIVATE environment variables...', colors.blue);
  const privateResult = privateEnvSchema.safeParse(process.env);

  if (privateResult.success) {
    log('  [PASS] All private variables valid', colors.green);
    log('');

    // Show parsed values (heavily redacted)
    log('  Parsed values:', colors.dim);
    log(
      `    SUPABASE_SERVICE_ROLE_KEY: ${privateResult.data.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`,
      colors.dim
    );
    log(
      `    STRIPE_SECRET_KEY: ${privateResult.data.STRIPE_SECRET_KEY.substring(0, 12)}...`,
      colors.dim
    );
    log(
      `    STRIPE_WEBHOOK_SECRET: ${privateResult.data.STRIPE_WEBHOOK_SECRET.substring(0, 12)}...`,
      colors.dim
    );
    log(`    STRIPE_PRICE_PRO_MONTHLY: ${privateResult.data.STRIPE_PRICE_PRO_MONTHLY}`, colors.dim);
    log(`    STRIPE_PRICE_PRO_YEARLY: ${privateResult.data.STRIPE_PRICE_PRO_YEARLY}`, colors.dim);
    log(
      `    STRIPE_PRICE_ENTERPRISE_MONTHLY: ${privateResult.data.STRIPE_PRICE_ENTERPRISE_MONTHLY}`,
      colors.dim
    );
    log(
      `    STRIPE_PRICE_ENTERPRISE_YEARLY: ${privateResult.data.STRIPE_PRICE_ENTERPRISE_YEARLY}`,
      colors.dim
    );
  } else {
    hasErrors = true;
    log('  [FAIL] Private variables have errors:', colors.red);
    formatErrors(privateResult.error).forEach((err) => log(err, colors.red));
  }

  log('');

  // Additional checks
  log('  Running additional checks...', colors.blue);

  // Check for Stripe mode consistency
  if (publicResult.success && privateResult.success) {
    const publicIsLive = publicResult.data.PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_');
    const secretIsLive = privateResult.data.STRIPE_SECRET_KEY.startsWith('sk_live_');

    if (publicIsLive !== secretIsLive) {
      hasWarnings = true;
      log('  [WARN] Stripe key mode mismatch!', colors.yellow);
      log(`    PUBLIC_STRIPE_PUBLISHABLE_KEY is ${publicIsLive ? 'LIVE' : 'TEST'}`, colors.yellow);
      log(`    STRIPE_SECRET_KEY is ${secretIsLive ? 'LIVE' : 'TEST'}`, colors.yellow);
    } else {
      log(`  [PASS] Stripe keys are in ${publicIsLive ? 'LIVE' : 'TEST'} mode`, colors.green);
    }

    // Check for production with test keys
    const appUrl = publicResult.data.PUBLIC_APP_URL || '';
    const isProduction = !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1');

    if (isProduction && !publicIsLive) {
      hasWarnings = true;
      log('  [WARN] Production URL detected with TEST Stripe keys!', colors.yellow);
      log(`    PUBLIC_APP_URL: ${appUrl}`, colors.yellow);
    }
  }

  log('');

  // Summary
  log('='.repeat(60), colors.blue);

  if (hasErrors) {
    log('  VALIDATION FAILED', colors.red);
    log('');
    log('  Please fix the errors above before building.', colors.red);
    log('  See .env.example for required variables.', colors.dim);
    log('');
    log('='.repeat(60), colors.blue);
    log('');
    process.exit(1);
  }

  if (hasWarnings && isStrict) {
    log('  VALIDATION FAILED (strict mode)', colors.yellow);
    log('');
    log('  Warnings treated as errors in strict mode.', colors.yellow);
    log('');
    log('='.repeat(60), colors.blue);
    log('');
    process.exit(1);
  }

  if (hasWarnings) {
    log('  VALIDATION PASSED WITH WARNINGS', colors.yellow);
    log('');
    log('  The build will continue, but please review the warnings.', colors.dim);
    log('  Use --strict to fail on warnings.', colors.dim);
  } else {
    log('  VALIDATION PASSED', colors.green);
    log('');
    log('  All environment variables are valid.', colors.dim);
  }

  log('');
  log('='.repeat(60), colors.blue);
  log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('Validation script error:', err);
  process.exit(1);
});
