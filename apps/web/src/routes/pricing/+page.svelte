<script lang="ts">
  import { profile, isAuthenticated } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let billingCycle: 'monthly' | 'yearly' = 'yearly';
  let loading: string | null = null;
  let error = '';

  const plans = [
    {
      name: 'Free',
      tier: 'free',
      description: 'Perfect for trying out Guilloché Studio',
      price: { monthly: 0, yearly: 0 },
      features: [
        'Basic patterns',
        'PNG export',
        '3 cloud saves',
        'Watermarked SVG export'
      ],
      limitations: [
        'Limited curve families',
        'No WASM engine',
        'No API access'
      ],
      cta: 'Get Started',
      highlighted: false
    },
    {
      name: 'Pro',
      tier: 'pro',
      description: 'For designers and creative professionals',
      price: { monthly: 12, yearly: 99 },
      features: [
        'Unlimited patterns',
        'All exports (SVG, PNG, PDF, DXF)',
        'WASM high-performance engine',
        '100 cloud saves',
        'Pattern DNA sharing',
        'AI parameter assistant',
        'No watermarks'
      ],
      limitations: [],
      cta: 'Start Pro Trial',
      highlighted: true
    },
    {
      name: 'Enterprise',
      tier: 'enterprise',
      description: 'For teams and commercial use',
      price: { monthly: 49, yearly: 399 },
      features: [
        'Everything in Pro',
        'API access',
        'White-label exports',
        'Priority AI processing',
        'Unlimited cloud saves',
        'Team collaboration',
        'CNC/Laser direct integration',
        'Dedicated support'
      ],
      limitations: [],
      cta: 'Contact Sales',
      highlighted: false
    }
  ] as const;

  function formatPrice(price: number) {
    return price === 0 ? 'Free' : `$${price}`;
  }

  function getSavings(monthly: number, yearly: number) {
    if (monthly === 0) return null;
    const monthlyTotal = monthly * 12;
    const savings = monthlyTotal - yearly;
    const percent = Math.round((savings / monthlyTotal) * 100);
    return { amount: savings, percent };
  }

  async function selectPlan(plan: typeof plans[number]) {
    if (plan.tier === 'free') {
      if ($isAuthenticated) {
        goto('/studio');
      } else {
        goto('/auth/signup');
      }
      return;
    }

    if (plan.tier === 'enterprise') {
      window.location.href = 'mailto:enterprise@guilloche.studio?subject=Enterprise%20Inquiry';
      return;
    }

    if (!$isAuthenticated) {
      goto(`/auth/login?redirect=/pricing&tier=${plan.tier}`);
      return;
    }

    if ($profile?.subscription_tier === plan.tier) {
      return;
    }

    loading = plan.tier;
    error = '';

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan.tier, interval: billingCycle })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start checkout';
    } finally {
      loading = null;
    }
  }

  function isCurrentPlan(tier: string) {
    return $profile?.subscription_tier === tier;
  }
</script>

<svelte:head>
  <title>Pricing - Guilloché Studio</title>
  <meta name="description" content="Choose the perfect plan for your guilloché pattern design needs. Free, Pro, and Enterprise options available." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <!-- Header -->
  <header class="border-b border-gray-200 bg-white">
    <nav class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-gray-900">
        Guilloché Studio
      </a>
      <div class="flex items-center gap-4">
        {#if $isAuthenticated}
          <a href="/studio" class="text-gray-600 hover:text-gray-900">Studio</a>
          <a href="/settings" class="text-gray-600 hover:text-gray-900">Settings</a>
        {:else}
          <a href="/auth/login" class="text-gray-600 hover:text-gray-900">Log in</a>
          <a href="/auth/signup" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Sign up
          </a>
        {/if}
      </div>
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-16">
    <!-- Hero -->
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        Simple, transparent pricing
      </h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        Start free, upgrade when you need more power. All plans include a 14-day free trial.
      </p>
    </div>

    <!-- Billing Toggle -->
    <div class="flex items-center justify-center gap-4 mb-12">
      <button
        on:click={() => billingCycle = 'monthly'}
        class="px-4 py-2 rounded-lg transition-colors {billingCycle === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}"
      >
        Monthly
      </button>
      <button
        on:click={() => billingCycle = 'yearly'}
        class="px-4 py-2 rounded-lg transition-colors {billingCycle === 'yearly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}"
      >
        Yearly
        <span class="ml-1 text-xs text-green-500 font-medium">Save up to 30%</span>
      </button>
    </div>

    {#if error}
      <div class="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
        {error}
      </div>
    {/if}

    <!-- Pricing Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      {#each plans as plan}
        {@const savings = getSavings(plan.price.monthly, plan.price.yearly)}
        <div class="relative bg-white rounded-2xl shadow-sm border {plan.highlighted ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'}">
          {#if plan.highlighted}
            <div class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
              Most Popular
            </div>
          {/if}

          <div class="p-8">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
            <p class="text-gray-600 mb-6">{plan.description}</p>

            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900">
                {formatPrice(plan.price[billingCycle])}
              </span>
              {#if plan.price[billingCycle] > 0}
                <span class="text-gray-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
              {/if}

              {#if billingCycle === 'yearly' && savings}
                <div class="mt-2 text-sm text-green-600">
                  Save ${savings.amount}/year ({savings.percent}% off)
                </div>
              {/if}
            </div>

            <button
              on:click={() => selectPlan(plan)}
              disabled={loading !== null || isCurrentPlan(plan.tier)}
              class="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                {plan.highlighted
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}"
            >
              {#if loading === plan.tier}
                Loading...
              {:else if isCurrentPlan(plan.tier)}
                Current Plan
              {:else}
                {plan.cta}
              {/if}
            </button>
          </div>

          <div class="px-8 pb-8">
            <div class="border-t border-gray-200 pt-6">
              <h4 class="text-sm font-medium text-gray-900 mb-4">What's included:</h4>
              <ul class="space-y-3">
                {#each plan.features as feature}
                  <li class="flex items-start gap-3 text-sm text-gray-600">
                    <svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                {/each}
                {#each plan.limitations as limitation}
                  <li class="flex items-start gap-3 text-sm text-gray-400">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {limitation}
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- FAQ Section -->
    <div class="mt-24">
      <h2 class="text-2xl font-bold text-gray-900 text-center mb-12">
        Frequently Asked Questions
      </h2>

      <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
          <p class="text-gray-600">Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
        </div>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="font-semibold text-gray-900 mb-2">What happens to my patterns if I downgrade?</h3>
          <p class="text-gray-600">Your patterns are safe. If you exceed the free tier limit, you'll still be able to view and export them, but you won't be able to create new patterns until you're under the limit.</p>
        </div>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="font-semibold text-gray-900 mb-2">Do you offer refunds?</h3>
          <p class="text-gray-600">Yes, we offer a 14-day money-back guarantee. If you're not satisfied, contact us for a full refund.</p>
        </div>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
          <p class="text-gray-600">We accept all major credit cards (Visa, Mastercard, American Express) through Stripe. Enterprise customers can also pay by invoice.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-200 mt-24 py-8">
    <div class="max-w-7xl mx-auto px-4 text-center text-gray-500">
      <p>© 2024 Guilloché Studio. All rights reserved.</p>
    </div>
  </footer>
</div>
