/**
 * Unified Security Middleware
 *
 * Combines all security checks into a single middleware that can be applied to API routes.
 * This is the main entry point for server-side security enforcement.
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubscriptionTier } from '@guilloche/shared';
import {
  SubscriptionEnforcement,
  type EnforcementResult,
  FEATURE_REQUIREMENTS,
} from './subscription-enforcement';
import {
  DeviceFingerprintService,
  type FingerprintComponents,
  type AbuseCheckResult,
} from './device-fingerprint';
import {
  RequestSigningService,
  extractSignatureFromRequest,
  requiresSignature,
} from './request-signing';
import { API_RATE_LIMITS } from '@guilloche/shared';

// =============================================================================
// Types
// =============================================================================

export interface SecurityContext {
  userId: string;
  tier: SubscriptionTier;
  ipAddress: string;
  userAgent: string;
  isVerified: boolean;
  trustScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityCheckResult {
  allowed: boolean;
  statusCode: number;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  context?: SecurityContext;
  warnings?: string[];
}

export interface MiddlewareOptions {
  /** Feature required for this operation */
  feature?: string;
  /** Usage action to track */
  action?: 'pattern_save' | 'ai_request' | 'export';
  /** Minimum tier required (overrides feature-based check) */
  minTier?: SubscriptionTier;
  /** Whether request signature is required */
  requireSignature?: boolean;
  /** Whether to check for abuse patterns */
  checkAbuse?: boolean;
  /** Whether email verification is required */
  requireVerification?: boolean;
  /** Custom rate limit (requests per hour) */
  rateLimit?: number;
  /** Skip authentication check (for public endpoints) */
  skipAuth?: boolean;
}

// =============================================================================
// Per-User Rate Limiting
// =============================================================================

interface UserRateLimitEntry {
  count: number;
  windowStart: number;
  windowEnd: number;
  violations: number;
  penaltyMultiplier: number;
}

// In-memory rate limit store (per-user)
const userRateLimits = new Map<string, UserRateLimitEntry>();

function checkUserRateLimit(
  userId: string,
  tier: SubscriptionTier,
  customLimit?: number
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 3600_000; // 1 hour
  const baseLimit = customLimit || API_RATE_LIMITS[tier].requests;

  const key = `user:${userId}`;
  let entry = userRateLimits.get(key);

  // Create or reset window
  if (!entry || entry.windowEnd < now) {
    entry = {
      count: 0,
      windowStart: now,
      windowEnd: now + windowMs,
      violations: entry?.violations || 0,
      penaltyMultiplier: entry?.penaltyMultiplier || 1,
    };
    userRateLimits.set(key, entry);
  }

  // Apply penalty multiplier (reduces limit for repeat offenders)
  const effectiveLimit = Math.floor(baseLimit / entry.penaltyMultiplier);

  if (entry.count >= effectiveLimit) {
    // Record violation
    entry.violations++;
    if (entry.violations >= 3) {
      // Increase penalty after 3 violations
      entry.penaltyMultiplier = Math.min(entry.penaltyMultiplier * 1.5, 10);
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowEnd,
      retryAfter: Math.ceil((entry.windowEnd - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: effectiveLimit - entry.count,
    resetAt: entry.windowEnd,
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userRateLimits) {
    // Remove entries that have been inactive for over 2 hours
    if (entry.windowEnd < now - 3600_000) {
      userRateLimits.delete(key);
    }
  }
}, 300_000); // Every 5 minutes

// =============================================================================
// Security Middleware Class
// =============================================================================

export class SecurityMiddleware {
  private supabase: SupabaseClient;
  private enforcement: SubscriptionEnforcement;
  private fingerprint: DeviceFingerprintService;
  private signing: RequestSigningService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.enforcement = new SubscriptionEnforcement(supabase);
    this.fingerprint = new DeviceFingerprintService(supabase);
    this.signing = new RequestSigningService(supabase);
  }

  /**
   * Main security check method - call this from API routes
   */
  async check(event: RequestEvent, options: MiddlewareOptions = {}): Promise<SecurityCheckResult> {
    const warnings: string[] = [];
    const { request, locals } = event;

    // Extract common info
    const ipAddress =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      event.getClientAddress();
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // =================================================================
    // 1. Authentication Check
    // =================================================================

    if (!options.skipAuth) {
      const { session, user } = await locals.safeGetSession();

      if (!session || !user) {
        return {
          allowed: false,
          statusCode: 401,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        };
      }

      // Get user profile
      const profile = await this.enforcement.getUserProfile(user.id);
      if (!profile) {
        return {
          allowed: false,
          statusCode: 403,
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User profile not found',
          },
        };
      }

      // =================================================================
      // 2. Account Status Check
      // =================================================================

      const accountCheck = await this.enforcement.checkAccountStatus(user.id);
      if (!accountCheck.allowed) {
        return {
          allowed: false,
          statusCode: 403,
          error: {
            code: accountCheck.code || 'ACCOUNT_ISSUE',
            message: accountCheck.reason || 'Account access denied',
          },
        };
      }

      // =================================================================
      // 3. Request Signature Verification (for sensitive operations)
      // =================================================================

      const shouldCheckSignature =
        options.requireSignature || requiresSignature(request.method, event.url.pathname);

      if (shouldCheckSignature) {
        const signatureData = extractSignatureFromRequest(request);

        if (!signatureData) {
          return {
            allowed: false,
            statusCode: 400,
            error: {
              code: 'SIGNATURE_REQUIRED',
              message: 'Request signature required for this operation',
            },
          };
        }

        // Get request body for signature verification
        let body: unknown;
        try {
          const clonedRequest = request.clone();
          body = await clonedRequest.json();
        } catch {
          body = undefined;
        }

        const signatureResult = await this.signing.validateSignature(
          {
            method: request.method,
            path: event.url.pathname,
            body,
            userId: user.id,
            timestamp: signatureData.timestamp,
            nonce: signatureData.nonce,
          },
          signatureData.signature,
          ipAddress
        );

        if (!signatureResult.valid) {
          // Log security event
          await this.enforcement.logSecurityEvent(
            user.id,
            'invalid_signature',
            signatureResult.code === 'REPLAY_DETECTED' ? 'high' : 'medium',
            signatureResult.reason || 'Invalid request signature',
            { path: event.url.pathname, code: signatureResult.code },
            ipAddress
          );

          return {
            allowed: false,
            statusCode: signatureResult.code === 'REPLAY_DETECTED' ? 409 : 400,
            error: {
              code: signatureResult.code || 'INVALID_SIGNATURE',
              message: signatureResult.reason || 'Invalid request signature',
            },
          };
        }
      }

      // =================================================================
      // 4. Per-User Rate Limiting
      // =================================================================

      const rateCheck = checkUserRateLimit(user.id, profile.subscription_tier, options.rateLimit);

      if (!rateCheck.allowed) {
        // Log rate limit event
        await this.enforcement.logSecurityEvent(
          user.id,
          'rate_limit_exceeded',
          'medium',
          'User rate limit exceeded',
          { path: event.url.pathname, tier: profile.subscription_tier },
          ipAddress
        );

        return {
          allowed: false,
          statusCode: 429,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please slow down.',
            details: {
              resetAt: rateCheck.resetAt,
              retryAfter: rateCheck.retryAfter,
            },
          },
        };
      }

      // =================================================================
      // 5. Feature Access Check
      // =================================================================

      if (options.feature) {
        const featureCheck = await this.enforcement.checkFeatureAccess(user.id, options.feature, {
          skipVerificationCheck: !options.requireVerification,
        });

        if (!featureCheck.allowed) {
          return {
            allowed: false,
            statusCode: 403,
            error: {
              code: featureCheck.code || 'FEATURE_DENIED',
              message: featureCheck.reason || 'Feature not available',
              details: featureCheck.upgradeRequired
                ? { requiredTier: featureCheck.requiredTier }
                : undefined,
            },
          };
        }
      }

      // =================================================================
      // 6. Usage Limit Check
      // =================================================================

      if (options.action) {
        const usageCheck = await this.enforcement.checkUsageLimit(user.id, options.action);

        if (!usageCheck.allowed) {
          return {
            allowed: false,
            statusCode: 403,
            error: {
              code: usageCheck.code || 'USAGE_LIMIT',
              message: usageCheck.reason || 'Usage limit reached',
              details: {
                remaining: usageCheck.remaining,
                limit: usageCheck.limit,
                requiredTier: usageCheck.requiredTier,
              },
            },
          };
        }
      }

      // =================================================================
      // 7. Abuse Detection (optional, for sensitive operations)
      // =================================================================

      if (options.checkAbuse) {
        // Get fingerprint from header (sent by client)
        const fingerprintHash = request.headers.get('X-Device-Fingerprint');

        if (fingerprintHash) {
          const abuseCheck = await this.fingerprint.checkForAbuse(
            fingerprintHash,
            user.id,
            ipAddress
          );

          if (abuseCheck.isAbusive) {
            // Log abuse detection
            await this.enforcement.logSecurityEvent(
              user.id,
              'abuse_detected',
              abuseCheck.riskLevel,
              abuseCheck.reasons.join('; '),
              {
                linkedAccounts: abuseCheck.linkedAccounts,
                recommendation: abuseCheck.recommendation,
              },
              ipAddress
            );

            if (abuseCheck.recommendation === 'block') {
              return {
                allowed: false,
                statusCode: 403,
                error: {
                  code: 'ABUSE_DETECTED',
                  message: 'Suspicious activity detected. Please contact support.',
                },
              };
            }

            if (abuseCheck.recommendation === 'review') {
              warnings.push('Account flagged for review due to suspicious activity');
            }
          }
        }
      }

      // =================================================================
      // 8. Email Verification Check (for premium features)
      // =================================================================

      if (
        options.requireVerification &&
        !profile.email_verified &&
        profile.subscription_tier !== 'free'
      ) {
        return {
          allowed: false,
          statusCode: 403,
          error: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Please verify your email to use premium features',
          },
        };
      }

      // Build security context
      const context: SecurityContext = {
        userId: user.id,
        tier: profile.subscription_tier,
        ipAddress,
        userAgent,
        isVerified: profile.email_verified,
        trustScore: profile.trust_score,
        riskLevel:
          profile.trust_score >= 70
            ? 'low'
            : profile.trust_score >= 40
              ? 'medium'
              : profile.trust_score >= 20
                ? 'high'
                : 'critical',
      };

      return {
        allowed: true,
        statusCode: 200,
        context,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Unauthenticated endpoint
    return {
      allowed: true,
      statusCode: 200,
    };
  }

  /**
   * Record successful operation usage
   */
  async recordUsage(userId: string, action: string, amount: number = 1): Promise<void> {
    await this.enforcement.recordUsage(userId, action, amount);
  }

  /**
   * Log security event
   */
  async logEvent(
    userId: string | null,
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.enforcement.logSecurityEvent(
      userId,
      eventType,
      severity,
      description,
      metadata || {},
      ipAddress
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create security middleware instance
 */
export function createSecurityMiddleware(supabase: SupabaseClient): SecurityMiddleware {
  return new SecurityMiddleware(supabase);
}

/**
 * Quick security check for simple routes
 */
export async function quickSecurityCheck(
  event: RequestEvent,
  options: MiddlewareOptions = {}
): Promise<SecurityCheckResult> {
  const middleware = new SecurityMiddleware(event.locals.supabase);
  return middleware.check(event, options);
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create error response from security check
 */
export function createSecurityErrorResponse(result: SecurityCheckResult): Response {
  return new Response(
    JSON.stringify({
      error: result.error?.code || 'SECURITY_ERROR',
      message: result.error?.message || 'Security check failed',
      details: result.error?.details,
    }),
    {
      status: result.statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Wrapper to apply security check to an API handler
 */
export function withSecurity<T>(
  options: MiddlewareOptions,
  handler: (event: RequestEvent, context: SecurityContext) => Promise<Response>
): (event: RequestEvent) => Promise<Response> {
  return async (event: RequestEvent): Promise<Response> => {
    const middleware = new SecurityMiddleware(event.locals.supabase);
    const result = await middleware.check(event, options);

    if (!result.allowed) {
      return createSecurityErrorResponse(result);
    }

    if (!result.context) {
      return new Response(
        JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Missing security context' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      return await handler(event, result.context);
    } catch (error) {
      // Log unexpected errors
      await middleware.logEvent(
        result.context.userId,
        'handler_error',
        'medium',
        error instanceof Error ? error.message : 'Unknown error',
        { path: event.url.pathname },
        result.context.ipAddress
      );
      throw error;
    }
  };
}
