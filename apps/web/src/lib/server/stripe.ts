import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

const API_VERSION = '2023-10-16';

let client: Stripe | null = null;

/**
 * Server-only Stripe client, built on first use.
 *
 * The key is read through $env/dynamic/private rather than $env/static/private:
 * the static form is inlined at compile time, which baked the live key into the
 * build output (and therefore into any published CI artifact) and made rotation
 * require a rebuild. Reading it at runtime keeps secrets out of the bundle.
 */
export function getStripe(): Stripe {
  if (!client) {
    const secretKey = env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    client = new Stripe(secretKey, { apiVersion: API_VERSION });
  }
  return client;
}

/** Price IDs, read per call so a rotated value takes effect without a rebuild. */
export function getStripePrices() {
  return {
    pro: {
      monthly: env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: env.STRIPE_PRICE_PRO_YEARLY,
    },
    enterprise: {
      monthly: env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    },
  } as const;
}
