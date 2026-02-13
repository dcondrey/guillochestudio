/**
 * Stripe Webhook Endpoint
 * Handles Stripe webhook events for subscription management
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

// =============================================================================
// Stripe & Supabase Clients
// =============================================================================

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Use service role key for webhook operations (bypasses RLS)
const supabaseTyped = createClient<Database>(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Untyped client for operations where type inference fails
const supabase = supabaseTyped as SupabaseClient;

// =============================================================================
// Response Helpers
// =============================================================================

function errorResponse(code: string, message: string, status: number): never {
  throw error(status, JSON.stringify({
    success: false,
    error: { code, message },
  }));
}

// =============================================================================
// POST /api/stripe/webhook - Handle Stripe webhook events
// =============================================================================

export const POST: RequestHandler = async ({ request }) => {
  // Webhooks must use raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    errorResponse('MISSING_SIGNATURE', 'Missing stripe-signature header', 400);
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    errorResponse('INVALID_SIGNATURE', 'Webhook signature verification failed', 400);
  }

  try {
    switch (event.type) {
      // =======================================================================
      // Checkout Session Completed
      // =======================================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const tier = session.metadata?.tier as 'pro' | 'enterprise' | undefined;
        const customerId = session.customer as string;

        if (!userId) {
          console.warn('Checkout session completed without user_id metadata');
          break;
        }

        if (tier) {
          // Update user's subscription tier and store Stripe customer ID
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              stripe_customer_id: customerId,
            })
            .eq('id', userId);

          if (updateError) {
            console.error('Failed to update profile tier:', updateError);
          }

          // Record subscription details
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
              );

              const { error: upsertError } = await supabase.from('subscriptions').upsert({
                user_id: userId,
                stripe_subscription_id: subscription.id,
                stripe_price_id: subscription.items.data[0].price.id,
                status: subscription.status,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
              });

              if (upsertError) {
                console.error('Failed to upsert subscription:', upsertError);
              }
            } catch (stripeErr) {
              console.error('Failed to retrieve subscription from Stripe:', stripeErr);
            }
          }
        }
        break;
      }

      // =======================================================================
      // Subscription Updated
      // =======================================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single() as { data: { id: string } | null; error: unknown };

        if (profileError || !profile) {
          console.warn(`No profile found for Stripe customer ${customerId}`);
          break;
        }

        // Update subscription record
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status,
            stripe_price_id: subscription.items.data[0].price.id,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id);

        if (updateError) {
          console.error('Failed to update subscription:', updateError);
        }

        // Downgrade tier if subscription is no longer active
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          const { error: downgradeError } = await supabase
            .from('profiles')
            .update({ subscription_tier: 'free' })
            .eq('id', profile.id);

          if (downgradeError) {
            console.error('Failed to downgrade profile tier:', downgradeError);
          }
        }
        break;
      }

      // =======================================================================
      // Subscription Deleted
      // =======================================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user and downgrade to free
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single() as { data: { id: string } | null; error: unknown };

        if (profileError || !profile) {
          console.warn(`No profile found for Stripe customer ${customerId}`);
          break;
        }

        // Downgrade to free tier
        const { error: downgradeError } = await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', profile.id);

        if (downgradeError) {
          console.error('Failed to downgrade profile tier:', downgradeError);
        }

        // Mark subscription as canceled
        const { error: cancelError } = await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', subscription.id);

        if (cancelError) {
          console.error('Failed to update subscription status:', cancelError);
        }
        break;
      }

      // =======================================================================
      // Payment Failed
      // =======================================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const attemptCount = invoice.attempt_count;

        console.warn(`Payment failed for customer ${customerId} (attempt ${attemptCount})`);
        // TODO: Send email notification to user about failed payment
        break;
      }

      // =======================================================================
      // Unhandled Events
      // =======================================================================
      default:
        // Log but don't error on unhandled event types
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return json({ success: true, received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 500 so Stripe will retry
    errorResponse('WEBHOOK_ERROR', 'Webhook handler failed', 500);
  }
};
