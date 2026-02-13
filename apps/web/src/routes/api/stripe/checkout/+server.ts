/**
 * Stripe Checkout Endpoint
 * @module /api/stripe/checkout
 * @description Creates a Stripe checkout session for subscription plans.
 * Supports Pro and Enterprise tiers with monthly/yearly billing intervals.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 *
 * @example
 * // Subscribe to Pro monthly
 * POST /api/stripe/checkout
 * { "tier": "pro", "interval": "monthly" }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { z } from 'zod';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import { STRIPE_PRICES } from '$lib/config/stripe';
import { validate } from '$lib/utils/validation';

// =============================================================================
// Stripe Client
// =============================================================================

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// =============================================================================
// Response Helpers
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

function successResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = { success: true, data };
  return json(response, { status });
}

function errorResponse(code: string, message: string, status: number, details?: Array<{ path: string; message: string }>): never {
  throw error(status, JSON.stringify({
    success: false,
    error: { code, message, details },
  }));
}

// =============================================================================
// Validation Schema
// =============================================================================

const CheckoutSchema = z.object({
  tier: z.enum(['pro', 'enterprise']),
  interval: z.enum(['monthly', 'yearly']),
});

// =============================================================================
// POST /api/stripe/checkout - Create subscription checkout session
// =============================================================================

/**
 * Create subscription checkout session
 * @name POST /api/stripe/checkout
 * @function
 * @description Creates a Stripe checkout session for subscribing to Pro or
 * Enterprise plans. Looks up the appropriate price ID from configuration
 * based on tier and billing interval.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 * @param {URL} context.url - Request URL for building redirect URLs
 *
 * @requestBody {Object} body - Checkout request
 * @requestBody {('pro'|'enterprise')} body.tier - Subscription tier
 * @requestBody {('monthly'|'yearly')} body.interval - Billing interval
 *
 * @returns {Response} JSON response with checkout URL
 * @returns {boolean} response.success - Operation success status
 * @returns {string} response.data.url - Stripe checkout URL
 * @returns {string} response.data.sessionId - Stripe session ID
 *
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Invalid tier or interval
 * @throws {400} INVALID_PRICE - Price configuration error
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {500} PAYMENT_ERROR - Stripe API error
 *
 * @example
 * // Request
 * POST /api/stripe/checkout
 * { "tier": "pro", "interval": "yearly" }
 *
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://checkout.stripe.com/...",
 *     "sessionId": "cs_live_..."
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const validation = validate(CheckoutSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { tier, interval } = validation.data!;

  // Get price ID from configuration
  const priceId = STRIPE_PRICES[tier][interval];

  if (!priceId) {
    errorResponse('INVALID_PRICE', 'Invalid pricing configuration', 400);
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${url.origin}/settings?success=true`,
      cancel_url: `${url.origin}/pricing?canceled=true`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        tier,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier,
        },
      },
    });

    return successResponse({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Checkout session creation failed:', err);
    errorResponse('PAYMENT_ERROR', 'Failed to create checkout session', 500);
  }
};
