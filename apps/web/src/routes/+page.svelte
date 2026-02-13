<script lang="ts">
  import { goto } from '$app/navigation';
  import { isAuthenticated } from '$lib/stores/auth';
  import { SUBSCRIPTION_PLANS } from '@guilloche/shared';

  const features = [
    {
      icon: '🌀',
      title: 'Mathematical Precision',
      description: 'Generate complex curves using hypotrochoids, rose curves, Lissajous figures, and more'
    },
    {
      icon: '✨',
      title: 'Symmetry Engine',
      description: 'Create mesmerizing patterns with rotational symmetry, reflections, and kaleidoscope effects'
    },
    {
      icon: '⚡',
      title: 'WASM Performance',
      description: 'Pro users get 10x faster rendering with our Rust-powered WebAssembly engine'
    },
    {
      icon: '🎨',
      title: 'Pro Export Suite',
      description: 'Export to SVG, PNG, PDF, DXF for CNC/laser cutting, and more'
    },
    {
      icon: '🔗',
      title: 'Pattern DNA',
      description: 'Share patterns with short 8-character codes that encode all parameters'
    },
    {
      icon: '🤖',
      title: 'AI Assistant',
      description: 'Describe your vision in words and let AI suggest the perfect parameters'
    }
  ];
</script>

<svelte:head>
  <title>Guilloché Studio Pro - Create Beautiful Mathematical Patterns</title>
  <meta
    name="description"
    content="Design intricate ornamental patterns for security printing, decorative design, and digital art. Professional-grade tools for mathematical pattern creation."
  />
</svelte:head>

<!-- Hero Section -->
<section class="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-purple-900 text-white">
  <div class="absolute inset-0 opacity-20">
    <div class="absolute inset-0" style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='white' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E&quot;); background-size: 100px 100px;"></div>
  </div>

  <nav class="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
    <div class="flex items-center gap-3">
      <span class="text-2xl">⚙️</span>
      <span class="text-xl font-bold">Guilloché Studio</span>
      <span class="badge badge-pro">PRO</span>
    </div>

    <div class="flex items-center gap-4">
      {#if $isAuthenticated}
        <a href="/studio" class="btn btn-secondary btn-sm">
          Open Studio
        </a>
      {:else}
        <a href="/auth/login" class="btn btn-ghost btn-sm text-white hover:bg-white/10">
          Sign In
        </a>
        <a href="/auth/signup" class="btn btn-primary btn-sm">
          Get Started Free
        </a>
      {/if}
    </div>
  </nav>

  <div class="relative z-10 px-6 py-20 text-center lg:px-12 lg:py-32">
    <h1 class="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight lg:text-6xl">
      Create Stunning
      <span class="text-gradient bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
        Mathematical Patterns
      </span>
    </h1>

    <p class="mx-auto mt-6 max-w-2xl text-lg text-primary-100 lg:text-xl">
      Professional guilloché pattern generator for security printing, decorative design, and digital art.
      Powered by mathematical curves and AI assistance.
    </p>

    <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <a href="/studio" class="btn btn-lg bg-white text-primary-900 hover:bg-gray-100 shadow-xl">
        <span>🎨</span>
        <span>Try the Studio</span>
      </a>
      <a href="#features" class="btn btn-lg border border-white/30 bg-white/10 hover:bg-white/20">
        <span>Learn More</span>
        <span>↓</span>
      </a>
    </div>
  </div>

  <!-- Pattern Preview -->
  <div class="relative z-10 mx-auto max-w-5xl px-6 pb-16 lg:px-12">
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
      <div class="aspect-video bg-gray-900/50 flex items-center justify-center">
        <div class="text-center text-white/50">
          <span class="text-6xl">🌀</span>
          <p class="mt-4">Interactive Pattern Preview</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section id="features" class="bg-white py-20 dark:bg-gray-950">
  <div class="mx-auto max-w-6xl px-6 lg:px-12">
    <div class="text-center">
      <h2 class="text-3xl font-bold lg:text-4xl">
        Everything You Need to Create
      </h2>
      <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
        Professional tools for mathematical pattern design
      </p>
    </div>

    <div class="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {#each features as feature}
        <div class="card">
          <div class="text-4xl">{feature.icon}</div>
          <h3 class="mt-4 text-xl font-semibold">{feature.title}</h3>
          <p class="mt-2 text-gray-600 dark:text-gray-400">{feature.description}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Pricing Section -->
<section class="bg-gray-50 py-20 dark:bg-gray-900">
  <div class="mx-auto max-w-6xl px-6 lg:px-12">
    <div class="text-center">
      <h2 class="text-3xl font-bold lg:text-4xl">Simple, Transparent Pricing</h2>
      <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
        Start free, upgrade when you need more
      </p>
    </div>

    <div class="mt-16 grid gap-8 lg:grid-cols-3">
      {#each SUBSCRIPTION_PLANS as plan}
        <div class="card relative {plan.tier === 'pro' ? 'border-primary-500 ring-2 ring-primary-500' : ''}">
          {#if plan.tier === 'pro'}
            <div class="absolute -top-4 left-1/2 -translate-x-1/2">
              <span class="badge badge-pro px-4 py-1 text-sm">Most Popular</span>
            </div>
          {/if}

          <h3 class="text-xl font-bold">{plan.name}</h3>

          <div class="mt-4">
            {#if plan.priceMonthly === 0}
              <span class="text-4xl font-bold">Free</span>
            {:else}
              <span class="text-4xl font-bold">${plan.priceMonthly}</span>
              <span class="text-gray-500">/month</span>
              <p class="mt-1 text-sm text-gray-500">
                or ${plan.priceYearly}/year (save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%)
              </p>
            {/if}
          </div>

          <ul class="mt-6 space-y-3">
            {#each plan.features as feature}
              <li class="flex items-start gap-2">
                <span class="text-green-500">✓</span>
                <span class="text-sm">{feature}</span>
              </li>
            {/each}
          </ul>

          <div class="mt-8">
            {#if plan.tier === 'free'}
              <a href="/auth/signup" class="btn btn-secondary w-full">
                Get Started
              </a>
            {:else}
              <a href="/auth/signup?plan={plan.tier}" class="btn btn-primary w-full">
                Start Free Trial
              </a>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- CTA Section -->
<section class="bg-primary-600 py-20 text-white">
  <div class="mx-auto max-w-4xl px-6 text-center lg:px-12">
    <h2 class="text-3xl font-bold lg:text-4xl">Ready to Create?</h2>
    <p class="mt-4 text-lg text-primary-100">
      Join thousands of designers, artists, and engineers using Guilloché Studio Pro
    </p>
    <div class="mt-8">
      <a href="/studio" class="btn btn-lg bg-white text-primary-900 hover:bg-gray-100">
        Open the Studio
      </a>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
  <div class="mx-auto max-w-6xl px-6 lg:px-12">
    <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
      <div class="flex items-center gap-2">
        <span>⚙️</span>
        <span class="font-semibold">Guilloché Studio Pro</span>
      </div>
      <div class="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
        <a href="/about" class="hover:text-primary-600">About</a>
        <a href="/docs" class="hover:text-primary-600">Documentation</a>
        <a href="/privacy" class="hover:text-primary-600">Privacy</a>
        <a href="/terms" class="hover:text-primary-600">Terms</a>
      </div>
      <div class="text-sm text-gray-500">
        © {new Date().getFullYear()} Guilloché Studio
      </div>
    </div>
  </div>
</footer>
