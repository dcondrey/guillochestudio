/**
 * Marketplace Purchase API Endpoint
 * @module /api/marketplace/purchase
 * @description Handles pattern purchase checkout flow via Stripe. Supports different
 * license types with tiered pricing and calculates royalties for remix patterns.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 * @see {@link PurchaseRequestSchema} Zod validator for purchase requests
 *
 * @example
 * // Purchase a pattern
 * POST /api/marketplace/purchase
 * { "patternId": "123e4567-e89b-12d3-a456-426614174000", "licenseType": "commercial" }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';
import { PurchaseRequestSchema, validate } from '$lib/utils/validation';
import { calculateLicensePrices, calculateRoyalty } from '$lib/services/marketplace';
import {
  SecurityMiddleware,
  createSecurityErrorResponse,
} from '$lib/services/security-middleware';

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
// Constants
// =============================================================================

const MAX_REMIX_CHAIN_DEPTH = 10;

// =============================================================================
// POST /api/marketplace/purchase - Initiate pattern purchase
// =============================================================================

/**
 * Initiate pattern purchase
 * @name POST /api/marketplace/purchase
 * @function
 * @description Initiates a pattern purchase by creating a Stripe checkout session.
 * For free patterns (price_cents = 0), the purchase is completed immediately without
 * redirect. For remix patterns, royalties are calculated and distributed to original
 * creators up to 10 levels deep.
 *
 * @requires Authentication - Supabase session token in cookie
 *
 * @param {Object} context - SvelteKit request context
 * @param {Request} context.request - HTTP request with JSON body
 * @param {App.Locals} context.locals - Request-scoped locals with session data
 * @param {URL} context.url - Request URL for building success/cancel URLs
 *
 * @requestBody {Object} body - Purchase request
 * @requestBody {string} body.patternId - Pattern UUID to purchase
 * @requestBody {('personal'|'commercial'|'remix')} body.licenseType - License type
 *
 * @returns {Response} JSON response with checkout URL or purchase confirmation
 *
 * For paid patterns:
 * @returns {boolean} response.success - Operation success status
 * @returns {string} response.data.checkout_url - Stripe checkout URL
 * @returns {string} response.data.session_id - Stripe session ID
 *
 * For free patterns:
 * @returns {boolean} response.success - Operation success status
 * @returns {boolean} response.data.purchased - Always true
 * @returns {boolean} response.data.free - Always true
 *
 * @throws {400} INVALID_JSON - Request body is not valid JSON
 * @throws {400} VALIDATION_ERROR - Input validation failed
 * @throws {400} INVALID_OPERATION - Cannot purchase own pattern
 * @throws {401} UNAUTHORIZED - Authentication required
 * @throws {404} NOT_FOUND - Pattern not found or not available
 * @throws {409} ALREADY_PURCHASED - Pattern already purchased by user
 * @throws {500} DATABASE_ERROR - Failed to process purchase
 * @throws {500} INTERNAL_ERROR - Unexpected error
 *
 * @see {@link PurchaseRequestSchema} Zod schema for validation rules
 *
 * @example
 * // Request
 * POST /api/marketplace/purchase
 * { "patternId": "123e4567-...", "licenseType": "commercial" }
 *
 * // Response (paid)
 * {
 *   "success": true,
 *   "data": {
 *     "checkout_url": "https://checkout.stripe.com/...",
 *     "session_id": "cs_live_..."
 *   }
 * }
 */
export const POST: RequestHandler = async (event) => {
  const { request, locals, url } = event;

  // Security check with request signing (sensitive payment operation)
  const security = new SecurityMiddleware(locals.supabase);
  const securityResult = await security.check(event, {
    requireSignature: true, // Require signed request for marketplace purchases
    checkAbuse: true, // Check for abuse patterns
  });

  if (!securityResult.allowed) {
    return createSecurityErrorResponse(securityResult);
  }

  const userId = securityResult.context!.userId;

  // Get user details for Stripe
  const { data: userProfile } = await locals.supabase
    .from('profiles')
    .select('email, stripe_customer_id')
    .eq('id', userId)
    .single();

  const user = { id: userId, email: userProfile?.email || '' };

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    errorResponse('INVALID_JSON', 'Request body must be valid JSON', 400);
  }

  const validation = validate(PurchaseRequestSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { patternId, licenseType } = validation.data!;

  try {
    // Get pattern details
    const { data: pattern, error: patternError } = await locals.supabase
      .from('patterns')
      .select(`
        id,
        name,
        price_cents,
        license_type,
        user_id,
        remix_of,
        thumbnail_url,
        profiles!inner (
          id,
          stripe_customer_id,
          display_name,
          username
        )
      `)
      .eq('id', patternId)
      .eq('is_listed', true)
      .single();

    if (patternError || !pattern) {
      errorResponse('NOT_FOUND', 'Pattern not found or not available for purchase', 404);
    }

    // Prevent purchasing own pattern
    if (pattern.user_id === user.id) {
      errorResponse('INVALID_OPERATION', 'You cannot purchase your own pattern', 400);
    }

    // Check if already purchased
    const { data: existingPurchase } = await locals.supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('pattern_id', patternId)
      .single();

    if (existingPurchase) {
      errorResponse('ALREADY_PURCHASED', 'You have already purchased this pattern', 409);
    }

    // Calculate price based on license type
    const licensePrices = calculateLicensePrices(pattern.price_cents);
    const priceCents = licensePrices[licenseType as keyof typeof licensePrices];

    // Handle free patterns
    if (priceCents === 0) {
      const { error: purchaseError } = await locals.supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          pattern_id: patternId,
          license_type: licenseType,
          price_cents: 0,
          royalty_paid_cents: 0,
        });

      if (purchaseError) {
        console.error('Failed to create free purchase:', purchaseError);
        errorResponse('DATABASE_ERROR', 'Failed to process purchase', 500);
      }

      // Increment download count (fire and forget)
      void locals.supabase.rpc('increment_pattern_download', { pattern_uuid: patternId }).then(
        () => {
          // Success, no action needed
        },
        (err: Error) => {
          console.error('Failed to increment download count:', err);
        }
      );

      return successResponse({ purchased: true, free: true });
    }

    // Get or create buyer's Stripe customer
    const { data: buyerProfile } = await locals.supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let stripeCustomerId = buyerProfile?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      await locals.supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    // Calculate royalty for remix patterns
    let royaltyCents = 0;

    if (pattern.remix_of) {
      let remixChainLength = 0;
      let currentId: string | null = pattern.remix_of;

      // Count remix chain depth with safety limit
      while (currentId && remixChainLength < MAX_REMIX_CHAIN_DEPTH) {
        remixChainLength++;
        const { data: parent } = await locals.supabase
          .from('patterns')
          .select('remix_of')
          .eq('id', currentId)
          .single();
        currentId = parent?.remix_of || null;
      }

      royaltyCents = calculateRoyalty(priceCents, remixChainLength);
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pattern.name,
              description: `${licenseType.charAt(0).toUpperCase() + licenseType.slice(1)} License`,
              images: pattern.thumbnail_url ? [pattern.thumbnail_url] : [],
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${url.origin}/marketplace/${patternId}?purchased=true`,
      cancel_url: `${url.origin}/marketplace/${patternId}`,
      metadata: {
        type: 'pattern_purchase',
        pattern_id: patternId,
        license_type: licenseType,
        buyer_id: user.id,
        seller_id: pattern.user_id,
        royalty_cents: royaltyCents.toString(),
      },
    });

    return successResponse({
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.id,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Marketplace purchase error:', err);
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
};
