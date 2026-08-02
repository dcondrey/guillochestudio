/**
 * Server-side hooks
 */

import { createSupabaseServerClient } from '$lib/services/supabase';
import { dev } from '$app/environment';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { validateEnv, validateProductionStripeConfig } from '$lib/config/env';
import * as publicEnv from '$env/static/public';
import * as privateEnv from '$env/static/private';
import {
  Logger,
  createRequestLogger,
  extractRequestId,
  generateRequestId,
} from '$lib/utils/logger';
import { createPerformanceMonitor } from '$lib/utils/performance';

// =============================================================================
// Environment Validation
// =============================================================================

const envValidation = (() => {
  try {
    const result = validateEnv(
      publicEnv as unknown as Record<string, string>,
      privateEnv as unknown as Record<string, string>,
      { throwOnError: true }
    );

    validateProductionStripeConfig({
      PUBLIC_APP_URL: result.public.PUBLIC_APP_URL,
      PUBLIC_STRIPE_PUBLISHABLE_KEY: result.public.PUBLIC_STRIPE_PUBLISHABLE_KEY,
      STRIPE_SECRET_KEY: result.private?.STRIPE_SECRET_KEY,
    });

    return result;
  } catch (error) {
    console.error(error);
    if (!dev) throw error;
    return null;
  }
})();

export const validatedEnv = envValidation;

// =============================================================================
// Main Handler
// =============================================================================

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Context
  const requestId = extractRequestId(event.request);
  const ip = event.request.headers.get('cf-connecting-ip') || event.getClientAddress();
  const logger = createRequestLogger(event.request, { ip });

  event.locals.requestId = requestId;
  event.locals.logger = logger;

  const performanceMonitor = createPerformanceMonitor(requestId, logger);
  event.locals.performanceMonitor = performanceMonitor;
  performanceMonitor.start('request');

  // 2. Supabase
  event.locals.supabase = createSupabaseServerClient({
    get: (key) => event.cookies.get(key),
    set: (key, value, options) => {
      event.cookies.set(key, value, {
        ...options,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: !dev,
      });
    },
    delete: (key, options) => {
      event.cookies.delete(key, { ...options, path: '/' });
    },
  });

  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };
    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;

  // 3. Resolve
  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version',
  });

  // 4. Finalize Headers
  // Content-Security-Policy is emitted by SvelteKit from kit.csp in svelte.config.js,
  // so that its inline hydration script carries a matching nonce.
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Request-ID', requestId);

  const duration = performanceMonitor.end('request', false) || 0;
  logger.response(event.request.method, event.url.pathname, response.status, duration);

  return response;
};

// =============================================================================
// Error Handler
// =============================================================================

export const handleError: HandleServerError = async ({ error, event, message }) => {
  const errorId = event.locals.requestId || generateRequestId();
  const logger = event.locals.logger || new Logger({ requestId: errorId });
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`Unhandled error: ${message}`, err);

  if (!dev && (privateEnv as Record<string, string | undefined>)['SENTRY_DSN']) {
    try {
      const Sentry = await import('@sentry/sveltekit');
      Sentry.captureException(err, { extra: { errorId, message, url: event.url.href } });
    } catch {
      // Sentry unavailable — error already logged above
    }
  }

  return { message: dev ? message : 'An unexpected error occurred', errorId };
};
