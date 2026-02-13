<script lang="ts">
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

  const currentYear = new Date().getFullYear();
</script>

<svelte:head>
  <title>Guilloche Studio - Create Beautiful Mathematical Patterns</title>
  <meta
    name="description"
    content="Design intricate ornamental patterns for security printing, decorative design, and digital art. Professional-grade tools for mathematical pattern creation."
  />

  <!-- Page-specific structured data -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Guilloche Studio - Home",
      "description": "Design intricate ornamental patterns for security printing, decorative design, and digital art.",
      "mainEntity": {
        "@type": "SoftwareApplication",
        "name": "Guilloche Studio",
        "applicationCategory": "DesignApplication"
      }
    }
  </script>
</svelte:head>

<!-- Hero Section -->
<header
  class="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-purple-900 text-white"
>
  <!-- Decorative background pattern -->
  <div class="absolute inset-0 opacity-20" aria-hidden="true">
    <div
      class="absolute inset-0"
      style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='white' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E&quot;); background-size: 100px 100px;"
    ></div>
  </div>

  <!-- Navigation -->
  <nav
    class="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12"
    aria-label="Main navigation"
  >
    <a href="/" class="flex items-center gap-3" aria-label="Guilloche Studio Home">
      <img
        src="/logo.svg"
        alt=""
        class="h-8 w-8"
        width="32"
        height="32"
        aria-hidden="true"
      />
      <span class="text-xl font-bold">Guilloche Studio</span>
      <span
        class="inline-flex items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-xs font-semibold text-white"
        aria-label="Pro version"
      >
        PRO
      </span>
    </a>

    <div class="flex items-center gap-4" role="group" aria-label="User actions">
      {#if $isAuthenticated}
        <a
          href="/studio"
          class="inline-flex items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
        >
          Open Studio
        </a>
      {:else}
        <a
          href="/auth/login"
          class="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
        >
          Sign In
        </a>
        <a
          href="/auth/signup"
          class="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
        >
          Get Started Free
        </a>
      {/if}
    </div>
  </nav>

  <!-- Hero content -->
  <div class="relative z-10 px-6 py-20 text-center lg:px-12 lg:py-32">
    <h1 class="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight lg:text-6xl">
      Create Stunning
      <span class="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
        Mathematical Patterns
      </span>
    </h1>

    <p class="mx-auto mt-6 max-w-2xl text-lg text-primary-100 lg:text-xl">
      Professional guilloche pattern generator for security printing, decorative design, and digital art.
      Powered by mathematical curves and AI assistance.
    </p>

    <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" role="group" aria-label="Get started">
      <a
        href="/studio"
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-lg font-semibold text-primary-900 shadow-xl transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
      >
        <span aria-hidden="true">🎨</span>
        <span>Try the Studio</span>
      </a>
      <a
        href="#features"
        class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-900"
      >
        <span>Learn More</span>
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  </div>

  <!-- Pattern Preview -->
  <figure class="relative z-10 mx-auto max-w-5xl px-6 pb-16 lg:px-12">
    <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
      <div class="aspect-video bg-gray-900/50 flex items-center justify-center">
        <div class="text-center text-white/50">
          <span class="text-6xl" aria-hidden="true">🌀</span>
          <p class="mt-4">Interactive Pattern Preview</p>
        </div>
      </div>
    </div>
    <figcaption class="sr-only">
      Interactive preview of the Guilloche Studio pattern editor
    </figcaption>
  </figure>
</header>

<!-- Main Content -->
<main id="main-content" tabindex="-1">
  <!-- Features Section -->
  <section
    id="features"
    class="bg-white py-20 dark:bg-gray-950"
    aria-labelledby="features-heading"
  >
    <div class="mx-auto max-w-6xl px-6 lg:px-12">
      <header class="text-center">
        <h2 id="features-heading" class="text-3xl font-bold lg:text-4xl">
          Everything You Need to Create
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Professional tools for mathematical pattern design
        </p>
      </header>

      <ul
        class="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Features list"
      >
        {#each features as feature}
          <li>
            <article class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div class="text-4xl" aria-hidden="true">{feature.icon}</div>
              <h3 class="mt-4 text-xl font-semibold">{feature.title}</h3>
              <p class="mt-2 text-gray-600 dark:text-gray-400">{feature.description}</p>
            </article>
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- Pricing Section -->
  <section
    class="bg-gray-50 py-20 dark:bg-gray-900"
    aria-labelledby="pricing-heading"
  >
    <div class="mx-auto max-w-6xl px-6 lg:px-12">
      <header class="text-center">
        <h2 id="pricing-heading" class="text-3xl font-bold lg:text-4xl">
          Simple, Transparent Pricing
        </h2>
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Start free, upgrade when you need more
        </p>
      </header>

      <div
        class="mt-16 grid gap-8 lg:grid-cols-3"
        role="list"
        aria-label="Pricing plans"
      >
        {#each SUBSCRIPTION_PLANS as plan}
          <article
            class="relative rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-800 {plan.tier === 'pro' ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-200 dark:border-gray-700'}"
            aria-labelledby="plan-{plan.tier}-title"
          >
            {#if plan.tier === 'pro'}
              <div class="absolute -top-4 left-1/2 -translate-x-1/2">
                <span class="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-1 text-sm font-semibold text-white">
                  Most Popular
                </span>
              </div>
            {/if}

            <h3 id="plan-{plan.tier}-title" class="text-xl font-bold">
              {plan.name}
            </h3>

            <div class="mt-4">
              {#if plan.priceMonthly === 0}
                <p>
                  <span class="text-4xl font-bold">Free</span>
                </p>
              {:else}
                <p>
                  <span class="text-4xl font-bold">${plan.priceMonthly}</span>
                  <span class="text-gray-500">/month</span>
                </p>
                <p class="mt-1 text-sm text-gray-500">
                  or ${plan.priceYearly}/year (save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%)
                </p>
              {/if}
            </div>

            <ul class="mt-6 space-y-3" role="list" aria-label="Plan features">
              {#each plan.features as feature}
                <li class="flex items-start gap-2">
                  <span class="text-green-500 flex-shrink-0" aria-hidden="true">✓</span>
                  <span class="text-sm">{feature}</span>
                </li>
              {/each}
            </ul>

            <div class="mt-8">
              {#if plan.tier === 'free'}
                <a
                  href="/auth/signup"
                  class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center font-medium text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  aria-describedby="plan-{plan.tier}-title"
                >
                  Get Started
                </a>
              {:else}
                <a
                  href="/auth/signup?plan={plan.tier}"
                  class="block w-full rounded-lg bg-indigo-600 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  aria-describedby="plan-{plan.tier}-title"
                >
                  Start Free Trial
                </a>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section
    class="bg-indigo-600 py-20 text-white"
    aria-labelledby="cta-heading"
  >
    <div class="mx-auto max-w-4xl px-6 text-center lg:px-12">
      <h2 id="cta-heading" class="text-3xl font-bold lg:text-4xl">
        Ready to Create?
      </h2>
      <p class="mt-4 text-lg text-indigo-100">
        Join thousands of designers, artists, and engineers using Guilloche Studio
      </p>
      <div class="mt-8">
        <a
          href="/studio"
          class="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-lg font-semibold text-indigo-900 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
        >
          Open the Studio
        </a>
      </div>
    </div>
  </section>
</main>

<!-- Footer -->
<footer
  class="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950"
  aria-label="Site footer"
>
  <div class="mx-auto max-w-6xl px-6 lg:px-12">
    <div class="flex flex-col items-center justify-between gap-6 md:flex-row">
      <!-- Logo and name -->
      <a href="/" class="flex items-center gap-2" aria-label="Guilloche Studio Home">
        <img
          src="/logo.svg"
          alt=""
          class="h-6 w-6"
          width="24"
          height="24"
          aria-hidden="true"
        />
        <span class="font-semibold">Guilloche Studio</span>
      </a>

      <!-- Footer navigation -->
      <nav aria-label="Footer navigation">
        <ul class="flex flex-wrap justify-center gap-6 text-sm text-gray-600 dark:text-gray-400" role="list">
          <li>
            <a href="/about" class="transition-colors hover:text-indigo-600 focus:outline-none focus:underline">
              About
            </a>
          </li>
          <li>
            <a href="/docs" class="transition-colors hover:text-indigo-600 focus:outline-none focus:underline">
              Documentation
            </a>
          </li>
          <li>
            <a href="/privacy" class="transition-colors hover:text-indigo-600 focus:outline-none focus:underline">
              Privacy Policy
            </a>
          </li>
          <li>
            <a href="/terms" class="transition-colors hover:text-indigo-600 focus:outline-none focus:underline">
              Terms of Service
            </a>
          </li>
        </ul>
      </nav>

      <!-- Copyright -->
      <p class="text-sm text-gray-500">
        <small>© {currentYear} Guilloche Studio. All rights reserved.</small>
      </p>
    </div>
  </div>
</footer>
