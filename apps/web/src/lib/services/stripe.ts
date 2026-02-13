import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';
import type { SubscriptionTier } from '@guilloche/shared';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export interface PriceInfo {
  priceId: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
}

export const STRIPE_PRICES: Record<SubscriptionTier, { monthly?: PriceInfo; yearly?: PriceInfo }> = {
  free: {},
  pro: {
    monthly: {
      priceId: 'price_pro_monthly', // Replace with actual Stripe price ID
      amount: 1200,
      currency: 'usd',
      interval: 'month'
    },
    yearly: {
      priceId: 'price_pro_yearly', // Replace with actual Stripe price ID
      amount: 9900,
      currency: 'usd',
      interval: 'year'
    }
  },
  enterprise: {
    monthly: {
      priceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
      amount: 4900,
      currency: 'usd',
      interval: 'month'
    },
    yearly: {
      priceId: 'price_enterprise_yearly', // Replace with actual Stripe price ID
      amount: 39900,
      currency: 'usd',
      interval: 'year'
    }
  }
};

export async function createCheckoutSession(
  tier: Exclude<SubscriptionTier, 'free'>,
  interval: 'month' | 'year'
): Promise<{ sessionId: string } | { error: string }> {
  const price = interval === 'month' ? STRIPE_PRICES[tier].monthly : STRIPE_PRICES[tier].yearly;

  if (!price) {
    return { error: 'Invalid price configuration' };
  }

  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: price.priceId,
        tier
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || 'Failed to create checkout session' };
    }

    return await response.json();
  } catch (err) {
    return { error: 'Failed to create checkout session' };
  }
}

export async function redirectToCheckout(sessionId: string): Promise<void> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) {
    throw error;
  }
}

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || 'Failed to create portal session' };
    }

    return await response.json();
  } catch (err) {
    return { error: 'Failed to create portal session' };
  }
}

export function formatPrice(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);
}
