/**
 * Stripe Create Checkout Session Endpoint
 * Creates a Stripe checkout session for subscription
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getStripe } from '$lib/server/stripe';
import { validate } from '$lib/utils/validation';

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

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Array<{ path: string; message: string }>
): never {
  throw error(
    status,
    JSON.stringify({
      success: false,
      error: { code, message, details },
    })
  );
}

// =============================================================================
// Validation Schema
// =============================================================================

const CheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  tier: z.enum(['pro', 'enterprise']),
});

// =============================================================================
// POST /api/stripe/create-checkout-session - Create subscription checkout
// =============================================================================

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

  const validation = validate(CheckoutSessionSchema, body);
  if (!validation.success) {
    errorResponse('VALIDATION_ERROR', 'Invalid input data', 400, validation.errors);
  }

  const { priceId, tier } = validation.data!;

  try {
    // Get or create Stripe customer
    const { data: profile } = await locals.supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      const { error: updateError } = await locals.supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to save Stripe customer ID:', updateError);
      }
    }

    // Create checkout session
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${url.origin}/settings?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${url.origin}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
        tier,
      },
    });

    return successResponse({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Stripe checkout error:', err);
    errorResponse('PAYMENT_ERROR', 'Failed to create checkout session', 500);
  }
};
