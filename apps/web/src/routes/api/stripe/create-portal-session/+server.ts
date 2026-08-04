/**
 * Stripe Create Portal Session Endpoint
 * Creates a Stripe billing portal session for subscription management
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/server/stripe';

// =============================================================================
// Response Helpers
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

function successResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = { success: true, data };
  return json(response, { status });
}

function errorResponse(code: string, message: string, status: number): never {
  throw error(
    status,
    JSON.stringify({
      success: false,
      error: { code, message },
    })
  );
}

// =============================================================================
// POST /api/stripe/create-portal-session - Create billing portal session
// =============================================================================

export const POST: RequestHandler = async ({ locals, url }) => {
  const { session, user } = await locals.safeGetSession();

  if (!session || !user) {
    errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  try {
    // Get Stripe customer ID
    const { data: profile, error: profileError } = await locals.supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
      errorResponse('DATABASE_ERROR', 'Failed to fetch profile', 500);
    }

    if (!profile?.stripe_customer_id) {
      errorResponse(
        'NO_SUBSCRIPTION',
        'No active subscription found. Please subscribe first.',
        404
      );
    }

    // Create portal session
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${url.origin}/settings`,
    });

    return successResponse({ url: portalSession.url });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Stripe portal error:', err);
    errorResponse('PAYMENT_ERROR', 'Failed to create portal session', 500);
  }
};
