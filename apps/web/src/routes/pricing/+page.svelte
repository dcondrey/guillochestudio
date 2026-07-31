<script lang="ts">
  import { profile, isAuthenticated } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';
  import Footer from '$lib/components/Footer.svelte';

  let billingCycle: 'monthly' | 'yearly' = 'yearly';
  let loading: string | null = null;
  let error = '';

  const plans = [
    {
      name: 'Base',
      tier: 'free',
      description: 'Mathematical foundation.',
      price: { monthly: 0, yearly: 0 },
      features: ['Basic patterns', 'PNG export', '3 cloud saves', 'Standard engine'],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      tier: 'pro',
      description: 'Professional precision.',
      price: { monthly: 12, yearly: 99 },
      features: [
        'All vector exports',
        'WASM high-performance engine',
        'AI parameter assistant',
        '100 cloud saves',
        'Pattern DNA sharing',
        'Commercial usage',
      ],
      cta: 'Acquire License',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      tier: 'enterprise',
      description: 'Corporate integration.',
      price: { monthly: 49, yearly: 399 },
      features: [
        'API & Webhook access',
        'White-label exports',
        'Dedicated WASM buffer',
        'CNC direct integration',
        'Team collaboration',
        'Priority support',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ] as const;

  function formatPrice(price: number) {
    return price === 0 ? 'Free' : `$${price}`;
  }

  async function selectPlan(plan: (typeof plans)[number]) {
    if (plan.tier === 'free') {
      goto($isAuthenticated ? '/studio' : '/auth/signup');
      return;
    }

    if (plan.tier === 'enterprise') {
      window.location.href = 'mailto:legal@guillochestudio.com?subject=Enterprise%20Inquiry';
      return;
    }

    if (!$isAuthenticated) {
      goto(`/auth/login?redirect=/pricing&tier=${plan.tier}`);
      return;
    }

    if ($profile?.subscription_tier === plan.tier) return;

    loading = plan.tier;
    error = '';

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: plan.tier, interval: billingCycle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) window.location.href = url;
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
  <title>Licensing | Guilloche Studio</title>
</svelte:head>

<div class="min-h-screen bg-white font-kalice text-gray-900">
  <!-- Header -->
  <header class="fixed top-0 z-50 w-full bg-white/70 backdrop-blur-2xl transition-all duration-500">
    <nav class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 group">
        <img src="/logo.svg" alt="" class="h-6 w-auto" />
        <span class="text-lg font-sohne-halbfett tracking-tight text-gray-900"
          >Guilloche Studio</span
        >
      </a>
      <div
        class="flex items-center gap-8 font-sohne-halbfett uppercase tracking-widest text-[10px]"
      >
        {#if $isAuthenticated}
          <a
            href="/studio"
            class="text-gray-400 hover:text-gray-900 transition-colors relative group py-1"
          >
            Studio
            <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100 overflow-hidden">
              <div
                class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
              ></div>
            </div>
          </a>
          <a
            href="/settings"
            class="text-gray-400 hover:text-gray-900 transition-colors relative group py-1"
          >
            Settings
            <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100 overflow-hidden">
              <div
                class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
              ></div>
            </div>
          </a>
        {:else}
          <a
            href="/auth/login"
            class="text-gray-400 hover:text-gray-900 transition-colors relative group py-1"
          >
            Log in
            <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100 overflow-hidden">
              <div
                class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
              ></div>
            </div>
          </a>
          <a
            href="/auth/signup"
            class="btn btn-primary px-5 py-2.5 text-[10px] shadow-lg shadow-black/10">Get Started</a
          >
        {/if}
      </div>
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-6 pt-48 pb-32">
    <!-- Hero -->
    <div class="text-center mb-24">
      <h1 class="text-5xl font-sohne-halbfett tracking-tighter text-gray-900 mb-6 sm:text-7xl">
        Transparent licensing.
      </h1>
      <p class="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
        Start for free, upgrade to professional precision when your projects demand it.
      </p>
    </div>

    <!-- Billing Toggle -->
    <div
      class="flex items-center justify-center gap-2 mb-20 p-1.5 bg-gray-50 w-fit mx-auto rounded-full border border-gray-100"
    >
      <button
        on:click={() => (billingCycle = 'monthly')}
        class="px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all {billingCycle ===
        'monthly'
          ? 'bg-white shadow-sm text-black'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        Monthly
      </button>
      <button
        on:click={() => (billingCycle = 'yearly')}
        class="px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all {billingCycle ===
        'yearly'
          ? 'bg-white shadow-sm text-black'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        Yearly <span class="text-blue-600 ml-1">Save 20%</span>
      </button>
    </div>

    {#if error}
      <div
        class="max-w-md mx-auto mb-12 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-bold uppercase tracking-widest text-center"
        in:fade
      >
        {error}
      </div>
    {/if}

    <!-- Pricing Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      {#each plans as plan}
        <div
          class="bg-white rounded-[3rem] p-12 shadow-sm border border-gray-50 flex flex-col transition-all duration-700 hover:shadow-xl hover:-translate-y-1 {plan.highlighted
            ? 'ring-2 ring-blue-600 relative'
            : ''}"
        >
          {#if plan.highlighted}
            <div
              class="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-2 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-full"
            >
              Recommended
            </div>
          {/if}

          <h3
            class="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] mb-8 font-sohne-halbfett"
          >
            {plan.name}
          </h3>

          <div class="mb-10 font-sohne-halbfett">
            <span class="text-6xl font-bold tracking-tighter text-gray-900"
              >{formatPrice(plan.price[billingCycle])}</span
            >
            {#if plan.price[billingCycle] > 0}
              <span class="text-gray-300 text-lg ml-2"
                >/ {billingCycle === 'yearly' ? 'yr' : 'mo'}</span
              >
            {/if}
          </div>

          <p class="text-lg text-gray-500 font-light mb-12 leading-relaxed italic font-fraunces">
            {plan.description}
          </p>

          <ul class="space-y-6 flex-1 mb-16 text-[15px] font-light text-gray-500">
            {#each plan.features as feature}
              <li class="flex items-start gap-4">
                <svg
                  class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M5 13l4 4L19 7"
                  /></svg
                >
                {feature}
              </li>
            {/each}
          </ul>

          <button
            on:click={() => selectPlan(plan)}
            disabled={loading !== null || isCurrentPlan(plan.tier)}
            class="btn w-full py-5 text-[10px] shadow-sm
              {plan.highlighted ? 'btn-primary' : 'btn-secondary'}"
          >
            {#if loading === plan.tier}
              Synchronizing...
            {:else if isCurrentPlan(plan.tier)}
              Active Tier
            {:else}
              {plan.cta}
            {/if}
          </button>
        </div>
      {/each}
    </div>

    <!-- FAQ -->
    <div class="mt-48 text-center">
      <h2
        class="text-xs font-bold uppercase tracking-[0.4em] text-gray-300 mb-16 font-sohne-halbfett"
      >
        Security & Compliance
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12 text-left max-w-4xl mx-auto">
        <div class="space-y-4">
          <h3 class="text-sm font-bold text-gray-900 uppercase tracking-widest font-sohne-halbfett">
            Ownership
          </h3>
          <p class="text-gray-500 font-light leading-relaxed">
            All generated patterns are mathematically unique. You retain 100% intellectual property
            rights for your creations.
          </p>
        </div>
        <div class="space-y-4">
          <h3 class="text-sm font-bold text-gray-900 uppercase tracking-widest font-sohne-halbfett">
            Billing
          </h3>
          <p class="text-gray-500 font-light leading-relaxed">
            Secure processing by Stripe. Change plans or cancel at any time with no termination
            fees.
          </p>
        </div>
      </div>
    </div>
  </main>

  <Footer />
</div>
