// Stripe configuration
// Price IDs are loaded from environment variables

import {
  STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_YEARLY,
  STRIPE_PRICE_ENTERPRISE_MONTHLY,
  STRIPE_PRICE_ENTERPRISE_YEARLY
} from '$env/static/private';

export const STRIPE_PRICES = {
  pro: {
    monthly: STRIPE_PRICE_PRO_MONTHLY,
    yearly: STRIPE_PRICE_PRO_YEARLY
  },
  enterprise: {
    monthly: STRIPE_PRICE_ENTERPRISE_MONTHLY,
    yearly: STRIPE_PRICE_ENTERPRISE_YEARLY
  }
} as const;

export function getTierFromPriceId(priceId: string): 'pro' | 'enterprise' | 'free' {
  if (priceId === STRIPE_PRICES.pro.monthly || priceId === STRIPE_PRICES.pro.yearly) {
    return 'pro';
  }
  if (priceId === STRIPE_PRICES.enterprise.monthly || priceId === STRIPE_PRICES.enterprise.yearly) {
    return 'enterprise';
  }
  return 'free';
}
