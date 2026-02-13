/**
 * Server-side hooks
 * Handles authentication, security headers, rate limiting, logging, and monitoring
 */

import { createSupabaseServerClient } from '$lib/services/supabase';
import { dev } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { validateEnv, validateProductionStripeConfig } from '$lib/config/env';
import * as publicEnv from '$env/static/public';
import * as privateEnv from '$env/static/private';
import {
  Logger,
  createRequestLogger,
  extractRequestId,
  generateRequestId,
} from '$lib/utils/logger';
import {
  createPerformanceMonitor,
  type PerformanceMonitor,
} from '$lib/utils/performance';
import { getMetricsCollector, getOperationTracker } from '$lib/utils/metrics';

// =============================================================================
// Environment Validation (runs on server startup)
// =============================================================================

/**
 * Validate all environment variables at startup
 * This ensures the app fails fast with clear errors if misconfigured
 */
const envValidation = (() => {
  try {
    const result = validateEnv(
      publicEnv as unknown as Record<string, string>,
      privateEnv as unknown as Record<string, string>,
      { throwOnError: true }
    );

    // Additional production checks
    validateProductionStripeConfig({
      PUBLIC_APP_URL: result.public.PUBLIC_APP_URL,
      PUBLIC_STRIPE_PUBLISHABLE_KEY: result.public.PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_SECRET_KEY: result.private?.STRIPE_SECRET_KEY,
    });

    if (!dev) {
      console.log('[ENV] Environment validation passed');
    }

    return result;
  } catch (error) {
    // In development, log the error but allow the server to start
    // In production, this will crash the server (fail fast)
    console.error(error);

    if (!dev) {
      // Re-throw in production to prevent server from starting with invalid config
      throw error;
    }

    // In dev, return partial config to allow development to continue
    console.warn('[ENV] Continuing in development mode with partial configuration');
    return null;
  }
})();

// Export validated env for use in other modules (optional)
export const validatedEnv = envValidation;

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (use KV in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS = {
  api: { requests: 100, windowMs: 60_000 }, // 100 req/min for API
  auth: { requests: 10, windowMs: 60_000 }, // 10 req/min for auth
  ai: { requests: 20, windowMs: 60_000 }, // 20 req/min for AI
  export: { requests: 30, windowMs: 60_000 }, // 30 req/min for exports
  default: { requests: 200, windowMs: 60_000 }, // 200 req/min for default
} as const;

function getRateLimitKey(ip: string, path: string): { key: string; limit: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS] } {
  if (path.startsWith('/api/auth') || path.startsWith('/auth')) {
    return { key: `auth:${ip}`, limit: RATE_LIMITS.auth };
  }
  if (path.startsWith('/api/ai')) {
    return { key: `ai:${ip}`, limit: RATE_LIMITS.ai };
  }
  if (path.startsWith('/api/export')) {
    return { key: `export:${ip}`, limit: RATE_LIMITS.export };
  }
  if (path.startsWith('/api')) {
    return { key: `api:${ip}`, limit: RATE_LIMITS.api };
  }
  return { key: `default:${ip}`, limit: RATE_LIMITS.default };
}

function checkRateLimit(key: string, limit: { requests: number; windowMs: number }): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new entry
    const resetAt = now + limit.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit.requests - 1, resetAt };
  }

  if (entry.count >= limit.requests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit.requests - entry.count, resetAt: entry.resetAt };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

// =============================================================================
// Security Headers
// =============================================================================

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Content Security Policy
function getCSP(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://plausible.io https://js.stripe.com ${dev ? "'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind requires inline styles
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://plausible.io",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    dev ? '' : 'upgrade-insecure-requests',
  ].filter(Boolean);

  return directives.join('; ');
}

// =============================================================================
// Main Handle Function
// =============================================================================

const handleSecurity: Handle = async ({ event, resolve }) => {
  const nonce = crypto.randomUUID().replace(/-/g, '');

  // Extract or generate request ID for tracing
  const requestId = extractRequestId(event.request);

  // Store nonce and request ID for use in templates and other handlers
  event.locals.nonce = nonce;
  event.locals.requestId = requestId;

  // Get client IP
  const ip = event.request.headers.get('cf-connecting-ip') ||
             event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             event.getClientAddress();

  // Create request-scoped logger
  const logger = createRequestLogger(event.request, { ip });
  event.locals.logger = logger;

  // Create performance monitor
  const performanceMonitor = createPerformanceMonitor(requestId, logger);
  event.locals.performanceMonitor = performanceMonitor;

  // Start request timing
  performanceMonitor.start('request');

  // Log incoming request
  logger.request(event.request.method, event.url.pathname, {
    query: Object.fromEntries(event.url.searchParams),
  });

  // Check rate limit for API routes
  if (event.url.pathname.startsWith('/api')) {
    const { key, limit } = getRateLimitKey(ip, event.url.pathname);
    const { allowed, remaining, resetAt } = checkRateLimit(key, limit);

    if (!allowed) {
      const duration = performanceMonitor.end('request', false) || 0;
      logger.warn('Rate limit exceeded', {
        type: 'rate_limit',
        ip,
        path: event.url.pathname,
        duration,
      });

      // Record metrics
      const metrics = getMetricsCollector();
      metrics.recordRequest({
        requestId,
        method: event.request.method,
        path: event.url.pathname,
        status: 429,
        totalDuration: duration,
        timings: [],
        databaseQueries: [],
        apiCalls: [],
      });

      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': limit.requests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toString(),
          'X-Request-ID': requestId,
        },
      });
    }

    // Add rate limit headers
    event.locals.rateLimitHeaders = {
      'X-RateLimit-Limit': limit.requests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetAt.toString(),
    };
  }

  // Resolve the request
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      // Inject nonce into script tags
      return html.replace(/%sveltekit.nonce%/g, nonce);
    },
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });

  // End request timing
  const duration = performanceMonitor.end('request', false) || 0;

  // Add security headers
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  // Add CSP header
  response.headers.set('Content-Security-Policy', getCSP(nonce));

  // Add request ID header for tracing
  response.headers.set('X-Request-ID', requestId);

  // Add Server-Timing header for performance insights
  response.headers.set('Server-Timing', performanceMonitor.getServerTimingHeader());

  // Add rate limit headers to response
  if (event.locals.rateLimitHeaders) {
    for (const [header, value] of Object.entries(event.locals.rateLimitHeaders)) {
      response.headers.set(header, value);
    }
  }

  // Log response
  logger.response(
    event.request.method,
    event.url.pathname,
    response.status,
    duration,
    {
      userId: event.locals.user?.id,
      ...performanceMonitor.getSummary(),
    }
  );

  // Record metrics
  const metrics = getMetricsCollector();
  metrics.recordRequest(
    performanceMonitor.getMetrics(
      event.request.method,
      event.url.pathname,
      response.status
    )
  );

  return response;
};

const handleAuth: Handle = async ({ event, resolve }) => {
  const performanceMonitor = event.locals.performanceMonitor;
  const logger = event.locals.logger;

  // Start auth timing
  performanceMonitor?.start('auth');

  // Create Supabase client
  event.locals.supabase = createSupabaseServerClient({
    get: (key: string) => event.cookies.get(key),
    set: (key: string, value: string, options: { path: string }) => {
      event.cookies.set(key, value, {
        ...options,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: !dev,
      });
    },
    delete: (key: string, options: { path: string }) => {
      event.cookies.delete(key, { ...options, path: '/' });
    },
  });

  // Create safe session getter
  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();

    if (!session) {
      return { session: null, user: null };
    }

    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser();

    if (error) {
      logger?.warn('Failed to get user from session', { error: error.message });
      return { session: null, user: null };
    }

    return { session, user };
  };

  // Get session for this request
  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  // Update logger context with user info
  if (user) {
    logger?.setContext({
      userId: user.id,
      sessionId: session?.access_token?.substring(0, 8),
    });
  }

  // End auth timing
  performanceMonitor?.end('auth');

  return resolve(event);
};

// Combine handles in sequence
export const handle: Handle = sequence(handleSecurity, handleAuth);

// =============================================================================
// Error Handler
// =============================================================================

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const errorId = event.locals.requestId || generateRequestId();
  const logger = event.locals.logger || new Logger({ requestId: errorId });

  // Log error with full context
  logger.error(
    `Unhandled error: ${message}`,
    error instanceof Error ? error : new Error(String(error)),
    {
      status,
      url: event.url.href,
      method: event.request.method,
      userId: event.locals.user?.id,
    }
  );

  // Record error in metrics
  const metrics = getMetricsCollector();
  metrics.recordError(error instanceof Error ? error.name : 'UnknownError');

  // Track in operation tracker
  const operationTracker = getOperationTracker();
  operationTracker.record('error_handling', 0, false);

  // In production, report to error tracking service
  if (!dev) {
    // Could send to Sentry server-side, CloudFlare analytics, etc.
    try {
      // Example: Send to logging endpoint (fire and forget)
      const errorPayload = {
        errorId,
        status,
        message,
        url: event.url.href,
        timestamp: new Date().toISOString(),
        userId: event.locals.user?.id,
        requestId: event.locals.requestId,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
        } : String(error),
      };

      // Use platform.context.waitUntil if available for non-blocking logging
      const waitUntil = event.platform?.context?.waitUntil;
      if (waitUntil) {
        waitUntil(
          fetch('https://api.example.com/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorPayload),
          }).catch(() => {})
        );
      }
    } catch {
      // Ignore logging errors
    }
  }

  return {
    message: dev ? message : 'An unexpected error occurred',
    errorId,
  };
};
