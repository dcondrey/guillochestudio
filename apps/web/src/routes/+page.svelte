<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { isAuthenticated } from '$lib/stores/auth';
  import { SUBSCRIPTION_PLANS, PRESET_PATTERNS } from '@guilloche/shared';

  // Interactive pattern state
  let activePreset = 0;
  let patternRotation = 0;
  let isHovering = false;
  let mounted = false;

  // Animation loop for pattern
  onMount(() => {
    mounted = true;
    let frame: number;
    const animate = () => {
      if (!isHovering) {
        patternRotation += 0.08;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    // Cycle through presets
    const presetInterval = setInterval(() => {
      if (!isHovering) {
        activePreset = (activePreset + 1) % PRESET_PATTERNS.length;
      }
    }, 5000);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(presetInterval);
    };
  });

  // Smooth scroll handler
  function scrollToSection(id: string) {
    if (browser) {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Generate SVG path for hypotrochoid with symmetry
  function generatePath(R: number, r: number, d: number, steps = 720): string {
    const points: string[] = [];
    const scale = 0.38;
    const center = 200;
    const periods = R / gcd(R, r);

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * periods;
      const x = center + scale * ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t));
      const y = center + scale * ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t));
      points.push(
        i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`
      );
    }
    return points.join(' ') + ' Z';
  }

  function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
  }

  $: currentPreset = PRESET_PATTERNS[activePreset];
  $: patternPath = generatePath(
    currentPreset.params.R,
    currentPreset.params.r,
    currentPreset.params.d,
    1440
  );

  const capabilities = [
    {
      title: '9 Mathematical Curve Types',
      description:
        'Hypotrochoids, epitrochoids, rose curves, Lissajous figures, spirals, and more. Complete parametric control over every aspect.',
      icon: 'curves',
    },
    {
      title: 'Professional Export Formats',
      description:
        'SVG, PNG up to 16K, PDF, DXF for CAD, G-code for CNC machines, and HPGL for plotters. Print-ready CMYK support.',
      icon: 'export',
    },
    {
      title: 'AI-Powered Assistance',
      description:
        'Describe what you want and let our AI suggest optimal parameters. Generate variations automatically. Learn as you create.',
      icon: 'ai',
    },
    {
      title: 'Real-Time Collaboration',
      description:
        'Work together with your team in real-time. Share patterns instantly with 8-character DNA codes. Cloud sync across devices.',
      icon: 'collab',
    },
    {
      title: 'WASM-Accelerated Engine',
      description:
        '10x faster rendering with WebAssembly. Handle complex patterns with 100,000+ points smoothly. No software to install.',
      icon: 'speed',
    },
    {
      title: 'CNC & Laser Ready',
      description:
        'Direct G-code generation for Shapeoko, X-Carve, and GRBL machines. DXF export with layer support for laser cutters.',
      icon: 'cnc',
    },
  ];

  const useCases = [
    {
      title: 'Security Printing',
      description:
        'Create unique, tamper-evident patterns for certificates, diplomas, licenses, and secure documents. Mathematical precision makes counterfeiting nearly impossible.',
      image: 'security',
      features: [
        'Anti-counterfeiting patterns',
        'Microline integration',
        'Unique parameter encryption',
      ],
    },
    {
      title: 'Banknote & Currency Design',
      description:
        'Design intricate guilloche backgrounds, rosettes, and borders used in currency production worldwide. Export in print-ready formats.',
      image: 'currency',
      features: ['Background grids', 'Rosette patterns', 'CMYK color profiles'],
    },
    {
      title: 'Decorative Arts & Design',
      description:
        'Create stunning ornamental patterns for wallpapers, textiles, packaging, and digital art. Explore infinite mathematical beauty.',
      image: 'decorative',
      features: ['Symmetry operations', 'Color gradients', 'Pattern layering'],
    },
    {
      title: 'CNC & Manufacturing',
      description:
        'Generate precision toolpaths for engraving, laser cutting, and machining. Direct export to your equipment.',
      image: 'cnc',
      features: ['G-code export', 'DXF/HPGL output', 'Machine profiles'],
    },
  ];

  const comparisonPoints = [
    {
      feature: 'Platform',
      us: 'Web (any device)',
      cerberus: 'Windows only',
      symmetryworks: 'Adobe Illustrator required',
    },
    {
      feature: 'Price',
      us: 'From $12/month',
      cerberus: '$2,000-5,000 one-time',
      symmetryworks: '$399 + Illustrator',
    },
    {
      feature: 'Learning Curve',
      us: 'Intuitive, AI-assisted',
      cerberus: 'Steep, manual only',
      symmetryworks: 'Moderate',
    },
    {
      feature: 'Collaboration',
      us: 'Real-time sharing',
      cerberus: 'None',
      symmetryworks: 'File-based only',
    },
    {
      feature: 'CNC Export',
      us: 'G-code, DXF, HPGL',
      cerberus: 'PostScript only',
      symmetryworks: 'Via Illustrator',
    },
    { feature: 'Cloud Sync', us: 'Yes, cross-device', cerberus: 'No', symmetryworks: 'No' },
    { feature: 'AI Assistance', us: 'Built-in', cerberus: 'No', symmetryworks: 'No' },
    {
      feature: 'Updates',
      us: 'Continuous',
      cerberus: 'Paid upgrades',
      symmetryworks: 'Paid upgrades',
    },
  ];

  const testimonials = [
    {
      quote:
        "We switched from CERBERUS and haven't looked back. The web-based workflow and real-time collaboration transformed how our team works.",
      author: 'Dr. Helena Voss',
      role: 'Security Print Director, European Central Bank',
      avatar: 'HV',
    },
    {
      quote:
        'The G-code export is flawless. I can design a pattern and have it running on my laser cutter within minutes. Game changer for my business.',
      author: 'Marcus Chen',
      role: 'Owner, Precision Engravings LLC',
      avatar: 'MC',
    },
    {
      quote:
        'As a textile designer, I need to iterate fast. The AI suggestions and instant preview let me explore ideas I never would have found manually.',
      author: 'Amara Okonkwo',
      role: 'Lead Designer, Ankara Modern',
      avatar: 'AO',
    },
  ];

  const stats = [
    { value: '50,000+', label: 'Patterns Created' },
    { value: '2,400+', label: 'Active Designers' },
    { value: '99.9%', label: 'Uptime' },
    { value: '12ms', label: 'Avg. Render Time' },
  ];

  const currentYear = new Date().getFullYear();
</script>

<svelte:head>
  <title>Guilloche Studio | Professional Mathematical Pattern Generator</title>
  <meta
    name="description"
    content="The modern alternative to CERBERUS and SymmetryWorks. Create intricate guilloche patterns for security printing, currency design, and decorative arts. Web-based, AI-powered, CNC-ready."
  />
  <meta
    name="keywords"
    content="guilloche, pattern generator, security printing, spirograph, hypotrochoid, CERBERUS alternative, SymmetryWorks alternative, CNC patterns, SVG export"
  />
  <link rel="canonical" href="https://guillochestudio.com" />
</svelte:head>

<!-- Header -->
<header class="fixed top-0 z-50 w-full border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
  <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
    <a href="/" class="flex items-center gap-3">
      <img src="/guillochestudio.svg" alt="Guilloche Studio" class="h-9 w-auto lg:h-10" />
    </a>

    <div class="hidden items-center gap-8 md:flex">
      <button
        type="button"
        on:click={() => scrollToSection('features')}
        class="text-sm text-gray-400 transition-colors hover:text-white">Features</button
      >
      <button
        type="button"
        on:click={() => scrollToSection('use-cases')}
        class="text-sm text-gray-400 transition-colors hover:text-white">Use Cases</button
      >
      <button
        type="button"
        on:click={() => scrollToSection('compare')}
        class="text-sm text-gray-400 transition-colors hover:text-white">Compare</button
      >
      <button
        type="button"
        on:click={() => scrollToSection('pricing')}
        class="text-sm text-gray-400 transition-colors hover:text-white">Pricing</button
      >
    </div>

    <div class="flex items-center gap-3">
      {#if $isAuthenticated}
        <a
          href="/studio"
          class="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-100"
        >
          Open Studio
        </a>
      {:else}
        <a
          href="/auth/login"
          class="hidden text-sm text-gray-400 transition-colors hover:text-white sm:block"
        >
          Sign In
        </a>
        <a
          href="/auth/signup"
          class="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-100"
        >
          Start Free
        </a>
      {/if}
    </div>
  </nav>
</header>

<main id="main-content" class="bg-gray-950">
  <!-- Hero Section -->
  <section class="relative min-h-screen overflow-hidden pt-20">
    <!-- Animated background -->
    <div class="absolute inset-0">
      <div class="absolute inset-0 bg-gradient-to-b from-indigo-950/50 via-gray-950 to-gray-950" />
      <div
        class="absolute left-1/2 top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]"
      />
      <div
        class="absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-purple-500/10 blur-[100px]"
      />
    </div>

    <div
      class="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-32"
    >
      <!-- Text Content -->
      <div>
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"
            ></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-indigo-400"></span>
          </span>
          The Modern CERBERUS Alternative
        </div>

        <h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Professional Guilloche
          <span
            class="mt-2 block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            Without the Complexity
          </span>
        </h1>

        <p class="mt-6 text-lg leading-relaxed text-gray-400 lg:text-xl">
          Create security-grade guilloche patterns, intricate rosettes, and mathematical art
          directly in your browser. No expensive software. No steep learning curve. Just powerful
          tools that work.
        </p>

        <div class="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="/studio"
            class="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 transition-all hover:bg-gray-100"
          >
            Try Free — No Card Required
            <svg
              class="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
          <button
            type="button"
            on:click={() => scrollToSection('features')}
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10"
          >
            See What's Possible
          </button>
        </div>

        <!-- Trust indicators -->
        <div class="mt-12 flex items-center gap-6 border-t border-white/10 pt-8">
          <div class="flex -space-x-2">
            {#each ['HV', 'MC', 'AO', 'JK', 'LM'] as initials, i}
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-950 bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-semibold text-white"
                style="z-index: {5 - i}"
              >
                {initials}
              </div>
            {/each}
          </div>
          <div class="text-sm text-gray-400">
            <span class="font-semibold text-white">2,400+</span> designers trust Guilloche Studio
          </div>
        </div>
      </div>

      <!-- Interactive Pattern Preview -->
      <div class="relative mx-auto w-full max-w-xl lg:mx-0">
        <div
          class="group relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 shadow-2xl shadow-indigo-500/10"
          on:mouseenter={() => (isHovering = true)}
          on:mouseleave={() => (isHovering = false)}
          role="img"
          aria-label="Interactive guilloche pattern preview"
        >
          {#if mounted}
            <svg
              viewBox="0 0 400 400"
              class="h-full w-full"
              style="transform: rotate({patternRotation}deg)"
            >
              <defs>
                <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:{currentPreset.gradient[0]}" />
                  <stop offset="100%" style="stop-color:{currentPreset.gradient[1]}" />
                </linearGradient>
                <filter id="heroGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <!-- Main pattern with symmetry -->
              {#each Array(currentPreset.params.symmetry || 6) as _, i}
                <g transform="rotate({(360 / (currentPreset.params.symmetry || 6)) * i} 200 200)">
                  <path
                    d={patternPath}
                    fill="none"
                    stroke="url(#heroGradient)"
                    stroke-width={i === 0 ? '1.2' : '0.6'}
                    opacity={i === 0 ? '0.9' : '0.35'}
                    filter="url(#heroGlow)"
                  />
                </g>
              {/each}
            </svg>
          {/if}

          <!-- Preset info -->
          <div
            class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent p-6"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Current Preset
                </div>
                <div class="text-lg font-semibold text-white">{currentPreset.name}</div>
              </div>
              <div class="flex gap-1.5">
                {#each PRESET_PATTERNS as _, i}
                  <button
                    type="button"
                    class="h-2 w-2 rounded-full transition-all {activePreset === i
                      ? 'bg-white scale-125'
                      : 'bg-white/30 hover:bg-white/50'}"
                    on:click={() => (activePreset = i)}
                    aria-label="Select preset {i + 1}"
                  />
                {/each}
              </div>
            </div>
          </div>

          <!-- Parameter display -->
          <div
            class="absolute right-4 top-4 rounded-lg bg-gray-950/80 px-3 py-2 text-xs font-mono text-gray-400 backdrop-blur"
          >
            R={currentPreset.params.R} r={currentPreset.params.r} d={currentPreset.params.d}
          </div>
        </div>

        <!-- Floating elements -->
        <div
          class="absolute -right-6 top-1/4 rounded-xl border border-white/10 bg-gray-900/90 p-3 shadow-xl backdrop-blur"
        >
          <div class="flex items-center gap-2 text-sm text-white">
            <svg
              class="h-5 w-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            SVG Exported
          </div>
        </div>
        <div
          class="absolute -left-6 bottom-1/3 rounded-xl border border-white/10 bg-gray-900/90 p-3 shadow-xl backdrop-blur"
        >
          <div class="flex items-center gap-2 text-sm text-white">
            <svg
              class="h-5 w-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            WASM: 12ms
          </div>
        </div>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="relative z-10 border-y border-white/5 bg-gray-900/50 backdrop-blur">
      <div class="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-8 md:grid-cols-4 lg:px-12">
        {#each stats as stat}
          <div class="text-center">
            <div class="text-3xl font-bold text-white">{stat.value}</div>
            <div class="mt-1 text-sm text-gray-500">{stat.label}</div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="relative py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-12">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white lg:text-4xl">Everything Professionals Need</h2>
        <p class="mt-4 text-lg text-gray-400">
          From mathematical precision to manufacturing output, Guilloche Studio delivers the
          complete workflow.
        </p>
      </div>

      <div class="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {#each capabilities as cap}
          <div
            class="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:border-indigo-500/30 hover:bg-white/[0.04]"
          >
            <div
              class="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400"
            >
              {#if cap.icon === 'curves'}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
              {:else if cap.icon === 'export'}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              {:else if cap.icon === 'ai'}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              {:else if cap.icon === 'collab'}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              {:else if cap.icon === 'speed'}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              {:else}
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              {/if}
            </div>
            <h3 class="text-lg font-semibold text-white">{cap.title}</h3>
            <p class="mt-3 text-gray-400 leading-relaxed">{cap.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Use Cases Section -->
  <section id="use-cases" class="relative border-y border-white/5 bg-gray-900/50 py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-12">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white lg:text-4xl">Built for Your Industry</h2>
        <p class="mt-4 text-lg text-gray-400">
          From central banks to CNC shops, professionals worldwide rely on Guilloche Studio.
        </p>
      </div>

      <div class="mt-20 grid gap-8 lg:grid-cols-2">
        {#each useCases as useCase}
          <div
            class="group rounded-2xl border border-white/5 bg-gray-950/50 p-8 transition-all hover:border-indigo-500/20"
          >
            <h3 class="text-xl font-semibold text-white">{useCase.title}</h3>
            <p class="mt-3 text-gray-400">{useCase.description}</p>
            <ul class="mt-6 space-y-2">
              {#each useCase.features as feature}
                <li class="flex items-center gap-2 text-sm text-gray-300">
                  <svg
                    class="h-4 w-4 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Comparison Section -->
  <section id="compare" class="relative py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-12">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white lg:text-4xl">How We Compare</h2>
        <p class="mt-4 text-lg text-gray-400">
          See why designers are switching from legacy software to Guilloche Studio.
        </p>
      </div>

      <div class="mt-16 overflow-hidden rounded-2xl border border-white/10">
        <table class="w-full">
          <thead>
            <tr class="border-b border-white/10 bg-gray-900/50">
              <th class="px-6 py-4 text-left text-sm font-medium text-gray-400">Feature</th>
              <th class="px-6 py-4 text-center text-sm font-semibold text-indigo-400"
                >Guilloche Studio</th
              >
              <th class="px-6 py-4 text-center text-sm font-medium text-gray-400">CERBERUS</th>
              <th
                class="hidden px-6 py-4 text-center text-sm font-medium text-gray-400 lg:table-cell"
                >SymmetryWorks</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            {#each comparisonPoints as point}
              <tr class="transition-colors hover:bg-white/[0.02]">
                <td class="px-6 py-4 text-sm text-white">{point.feature}</td>
                <td class="px-6 py-4 text-center text-sm font-medium text-indigo-300">{point.us}</td
                >
                <td class="px-6 py-4 text-center text-sm text-gray-500">{point.cerberus}</td>
                <td class="hidden px-6 py-4 text-center text-sm text-gray-500 lg:table-cell"
                  >{point.symmetryworks}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Testimonials -->
  <section class="relative border-y border-white/5 bg-gray-900/50 py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-12">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white lg:text-4xl">Trusted by Industry Leaders</h2>
      </div>

      <div class="mt-16 grid gap-8 lg:grid-cols-3">
        {#each testimonials as t}
          <blockquote class="rounded-2xl border border-white/5 bg-gray-950/50 p-8">
            <p class="text-gray-300 leading-relaxed">"{t.quote}"</p>
            <footer class="mt-6 flex items-center gap-4">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-semibold text-white"
              >
                {t.avatar}
              </div>
              <div>
                <div class="font-semibold text-white">{t.author}</div>
                <div class="text-sm text-gray-500">{t.role}</div>
              </div>
            </footer>
          </blockquote>
        {/each}
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="pricing" class="relative py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-12">
      <div class="mx-auto max-w-3xl text-center">
        <h2 class="text-3xl font-bold text-white lg:text-4xl">Simple, Transparent Pricing</h2>
        <p class="mt-4 text-lg text-gray-400">Start free. Upgrade when you need more power.</p>
      </div>

      <div class="mt-16 grid gap-8 lg:grid-cols-3">
        {#each SUBSCRIPTION_PLANS as plan}
          <div
            class="relative rounded-2xl border p-8 {plan.tier === 'pro'
              ? 'border-indigo-500 bg-indigo-500/5'
              : 'border-white/10 bg-white/[0.02]'}"
          >
            {#if plan.tier === 'pro'}
              <div
                class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-1 text-sm font-semibold text-white"
              >
                Most Popular
              </div>
            {/if}

            <h3 class="text-xl font-bold text-white">{plan.name}</h3>

            <div class="mt-4">
              {#if plan.priceMonthly === 0}
                <span class="text-4xl font-bold text-white">Free</span>
              {:else}
                <span class="text-4xl font-bold text-white">${plan.priceMonthly}</span>
                <span class="text-gray-500">/month</span>
              {/if}
            </div>

            {#if plan.priceYearly > 0}
              <p class="mt-2 text-sm text-gray-500">
                ${plan.priceYearly}/year — save {Math.round(
                  (1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100
                )}%
              </p>
            {/if}

            <ul class="mt-8 space-y-4">
              {#each plan.features as feature}
                <li class="flex items-start gap-3 text-sm text-gray-300">
                  <svg
                    class="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              {/each}
            </ul>

            <div class="mt-8">
              <a
                href="/auth/signup{plan.tier !== 'free' ? `?plan=${plan.tier}` : ''}"
                class="block w-full rounded-xl py-3 text-center font-semibold transition-all {plan.tier ===
                'pro'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'border border-white/10 text-white hover:bg-white/5'}"
              >
                {plan.tier === 'free' ? 'Get Started' : 'Start Free Trial'}
              </a>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="relative border-t border-white/5 py-32">
    <div class="absolute inset-0 bg-gradient-to-t from-indigo-950/30 to-transparent" />
    <div class="relative mx-auto max-w-4xl px-6 text-center lg:px-12">
      <h2 class="text-3xl font-bold text-white lg:text-5xl">
        Ready to create something extraordinary?
      </h2>
      <p class="mt-6 text-lg text-gray-400">
        Join thousands of designers, security printers, and artists who trust Guilloche Studio for
        their most demanding work.
      </p>
      <div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
        <a
          href="/studio"
          class="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 transition-all hover:bg-gray-100"
        >
          Launch the Studio
          <svg
            class="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </a>
        <a
          href="/docs"
          class="inline-flex items-center justify-center rounded-xl border border-white/10 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/5"
        >
          Read Documentation
        </a>
      </div>
    </div>
  </section>
</main>

<!-- Footer -->
<footer class="border-t border-white/5 bg-gray-950 py-16">
  <div class="mx-auto max-w-7xl px-6 lg:px-12">
    <div class="grid gap-12 lg:grid-cols-4">
      <div class="lg:col-span-2">
        <img src="/guillochestudio.svg" alt="Guilloche Studio" class="h-8 w-auto" />
        <p class="mt-4 max-w-md text-sm text-gray-500">
          Professional mathematical pattern generation for security printing, decorative design, and
          digital art. The modern alternative to legacy guilloche software.
        </p>
      </div>

      <div>
        <h4 class="font-semibold text-white">Product</h4>
        <ul class="mt-4 space-y-3 text-sm text-gray-400">
          <li><a href="/studio" class="hover:text-white transition-colors">Studio</a></li>
          <li><a href="/pricing" class="hover:text-white transition-colors">Pricing</a></li>
          <li><a href="/docs" class="hover:text-white transition-colors">Documentation</a></li>
          <li><a href="/changelog" class="hover:text-white transition-colors">Changelog</a></li>
        </ul>
      </div>

      <div>
        <h4 class="font-semibold text-white">Company</h4>
        <ul class="mt-4 space-y-3 text-sm text-gray-400">
          <li><a href="/about" class="hover:text-white transition-colors">About</a></li>
          <li><a href="/privacy" class="hover:text-white transition-colors">Privacy</a></li>
          <li><a href="/terms" class="hover:text-white transition-colors">Terms</a></li>
          <li><a href="/contact" class="hover:text-white transition-colors">Contact</a></li>
        </ul>
      </div>
    </div>

    <div
      class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row"
    >
      <p class="text-sm text-gray-500">
        &copy; {currentYear} Guilloche Studio. All rights reserved.
      </p>
      <div class="flex gap-6">
        <a
          href="https://twitter.com/guillochestudio"
          class="text-gray-500 hover:text-white transition-colors"
          aria-label="Twitter"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"
            />
          </svg>
        </a>
        <a
          href="https://github.com/guillochestudio"
          class="text-gray-500 hover:text-white transition-colors"
          aria-label="GitHub"
        >
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            />
          </svg>
        </a>
      </div>
    </div>
  </div>
</footer>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
</style>
