<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { isAuthenticated } from '$lib/stores/auth';
  import { SUBSCRIPTION_PLANS, gcd, rotate } from '@guilloche/shared';
  import { fade } from 'svelte/transition';
  import Footer from '$lib/components/Footer.svelte';

  // --- STATE ---
  let mounted = false;
  let scrollY = 0;
  let wavePhase = 0;

  // Canvas State
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let symPreview: HTMLCanvasElement;
  let symCtx: CanvasRenderingContext2D | null = null;

  // App State
  let activeTab = 'curve';
  let panelCollapsed = false;
  let isAnimating = false;
  let animationTime = 0;
  let animationFrame: number;

  // View Transform
  let view = { zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 };

  // Parameters
  let p = {
    family: 'hypo',
    R: 240,
    r: 79,
    d: 140,
    k: 13,
    m: 0.22,
    mf: 7,
    phase: 0,
    rot: 0,
    s: 1,
    lw: 0.7,
    steps: 16000,
    symmetry: 1,
    reflectH: false,
    reflectV: false,
    kaleidoscope: false,
    aa: true,
    dashed: false,
    dashRatio: 1,
    useGradient: false,
    startColor: '#1e293b',
    endColor: '#4f46e5',
    bgColor: '#ffffff',
    glow: 0,
    noise: 0,
    vignette: true,
    blendMode: 'normal',
    adaptiveSteps: true,
    duration: 5,
    rotSpeed: 0,
    loopAnim: true,
    morphSymmetry: false,
  };

  const PRESETS = [
    {
      name: 'Classic',
      params: { R: 240, r: 79, d: 140, k: 13, m: 0.22, mf: 7, symmetry: 1, family: 'hypo' },
    },
    {
      name: 'Ocean',
      params: { R: 200, r: 95, d: 120, k: 8, m: 0.3, mf: 5, symmetry: 3, family: 'rose' },
    },
    {
      name: 'Forest',
      params: { R: 180, r: 65, d: 160, k: 7, m: 0.15, mf: 11, symmetry: 5, family: 'epi' },
    },
    {
      name: 'Sunset',
      params: { R: 220, r: 110, d: 90, k: 11, m: 0.25, mf: 4, symmetry: 2, family: 'liss' },
    },
    {
      name: 'Fire',
      params: { R: 260, r: 85, d: 180, k: 17, m: 0.4, mf: 9, symmetry: 4, family: 'hypocycloid' },
    },
    {
      name: 'Royal',
      params: { R: 210, r: 70, d: 130, k: 15, m: 0.18, mf: 6, symmetry: 8, family: 'rose' },
    },
  ];

  // Toast
  let toast = { show: false, message: '', type: 'success' };

  // --- MATH HELPERS ---
  function getTMax(family: string, R: number, r: number, k: number): number {
    if (family === 'rose' || family === 'liss' || family === 'liss3d') return Math.PI * 2;
    if (family === 'spiral' || family === 'fermat') return Math.PI * 2 * k;
    if (
      family === 'hypocycloid' ||
      family === 'hypotrochoid' ||
      family === 'hypo' ||
      family === 'epicycloid' ||
      family === 'epitrochoid' ||
      family === 'epi'
    ) {
      const g = gcd(Math.round(R), Math.round(r));
      return Math.PI * 2 * (Math.round(r) / g);
    }
    return Math.PI * 2 * 10;
  }

  function pointFor(t: number, params: any) {
    const { family, R, r, d, k, m, mf, phase } = params;
    const mod = 1 + m * Math.sin(mf * t + phase);

    if (family === 'hypo' || family === 'hypotrochoid') {
      const a = R - r;
      const b = a / r;
      return [
        (a * Math.cos(t) + d * Math.cos(b * t)) * mod,
        (a * Math.sin(t) - d * Math.sin(b * t)) * mod,
      ];
    }
    if (family === 'epi' || family === 'epitrochoid') {
      const a = R + r;
      const b = a / r;
      return [
        (a * Math.cos(t) - d * Math.cos(b * t)) * mod,
        (a * Math.sin(t) - d * Math.sin(b * t)) * mod,
      ];
    }
    if (family === 'rose') {
      const rr = R * Math.cos(k * t + phase) * mod;
      return [rr * Math.cos(t), rr * Math.sin(t)];
    }
    if (family === 'liss') {
      const A = R,
        B = r,
        a = k,
        b = mf;
      return [A * Math.sin(a * t + phase) * mod, B * Math.sin(b * t) * mod];
    }
    if (family === 'spiral') {
      const radius = R + (r * t) / (2 * Math.PI);
      return [radius * Math.cos(t + phase) * mod, radius * Math.sin(t + phase) * mod];
    }
    if (family === 'hypocycloid') {
      const a = R - r,
        b = a / r;
      return [
        (a * Math.cos(t) + r * Math.cos(b * t)) * mod,
        (a * Math.sin(t) - r * Math.sin(b * t)) * mod,
      ];
    }
    if (family === 'epicycloid') {
      const a = R + r,
        b = a / r;
      return [
        (a * Math.cos(t) - r * Math.cos(b * t)) * mod,
        (a * Math.sin(t) - r * Math.sin(b * t)) * mod,
      ];
    }
    if (family === 'fermat') {
      const radius = R * Math.sqrt(t / (2 * Math.PI * k));
      return [radius * Math.cos(t + phase) * mod, radius * Math.sin(t + phase) * mod];
    }
    if (family === 'liss3d') {
      const A = R,
        B = r,
        C = d,
        a = k,
        b = mf,
        c = 3;
      const x = A * Math.sin(a * t + phase);
      const y = B * Math.sin(b * t);
      const z = C * Math.sin(c * t + phase / 2);
      return [(x + z / 2) * mod, (y + z / 3) * mod];
    }
    return [R * Math.cos(t), R * Math.sin(t)];
  }

  // --- RENDERING ---
  function draw() {
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2,
      cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = p.bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx + view.panX, cy + view.panY);
    ctx.scale(view.zoom, view.zoom);

    ctx.lineWidth = p.lw / view.zoom;
    ctx.strokeStyle = p.startColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (p.dashed) ctx.setLineDash([ctx.lineWidth * 8 * p.dashRatio, ctx.lineWidth * 8]);
    else ctx.setLineDash([]);

    if (p.glow > 0) {
      ctx.shadowColor = p.startColor;
      ctx.shadowBlur = p.glow * 2;
    }

    const tMax = getTMax(p.family, p.R, p.r, p.k);
    const baseSteps = p.adaptiveSteps
      ? Math.min(40000, Math.max(2000, p.steps * Math.sqrt(p.symmetry)))
      : p.steps;
    const dt = tMax / baseSteps;

    ctx.beginPath();
    for (let sym = 0; sym < p.symmetry; sym++) {
      const symAngle = (2 * Math.PI * sym) / p.symmetry;
      for (let i = 0; i <= baseSteps; i++) {
        const t = i * dt;
        let [x, y] = pointFor(t, p);
        [x, y] = rotate(x, y, p.rot);
        [x, y] = rotate(x, y, symAngle);
        if (p.reflectH) x = -x;
        if (p.reflectV) y = -y;
        if (p.kaleidoscope) {
          x = Math.abs(x);
          y = Math.abs(y);
        }
        x *= p.s;
        y *= p.s;
        if (p.noise > 0) {
          x += (Math.random() - 0.5) * p.noise;
          y += (Math.random() - 0.5) * p.noise;
        }

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }

    if (p.useGradient) {
      const grd = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      grd.addColorStop(0, p.startColor);
      grd.addColorStop(1, p.endColor);
      ctx.strokeStyle = grd;
    }
    ctx.stroke();
    ctx.restore();

    if (p.vignette) {
      const g = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(w, h) * 0.2,
        cx,
        cy,
        Math.min(w, h) * 0.85
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    drawSymmetryPreview();
  }

  function drawSymmetryPreview() {
    if (!symCtx || !symPreview) return;
    const dpr = window.devicePixelRatio || 1;
    const w = symPreview.width / dpr;
    const h = symPreview.height / dpr;
    symCtx.clearRect(0, 0, w, h);
    symCtx.fillStyle = '#f8fafc';
    symCtx.fillRect(0, 0, w, h);
    const cx = w / 2,
      cy = h / 2;

    symCtx.strokeStyle = '#cbd5e1';
    symCtx.lineWidth = 1;
    for (let i = 0; i < p.symmetry; i++) {
      const angle = (i / p.symmetry) * Math.PI * 2;
      symCtx.beginPath();
      symCtx.moveTo(cx, cy);
      symCtx.lineTo(cx + Math.cos(angle) * 30, cy + Math.sin(angle) * 30);
      symCtx.stroke();
    }
    symCtx.fillStyle = '#4f46e5';
    symCtx.beginPath();
    symCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    symCtx.fill();
  }

  function animateLoop() {
    if (!isAnimating) return;
    animationTime += 0.016;
    if (p.rotSpeed !== 0) p.rot = (p.rot + p.rotSpeed) % (Math.PI * 2);
    if (p.morphSymmetry) {
      const progress = (Math.sin((animationTime / p.duration) * Math.PI) + 1) / 2;
      p.symmetry = Math.round(1 + 11 * progress);
    }
    draw();
    if (p.loopAnim && animationTime > p.duration) animationTime = 0;
    animationFrame = requestAnimationFrame(animateLoop);
  }

  function startAnim() {
    isAnimating = true;
    animateLoop();
  }
  function stopAnim() {
    isAnimating = false;
    cancelAnimationFrame(animationFrame);
  }

  // Reactive Redraw
  $: if (mounted && p) {
    draw();
  }

  onMount(() => {
    mounted = true;
    const dpr = window.devicePixelRatio || 1;

    const initCanvas = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      symPreview.width = 200 * dpr;
      symPreview.height = 80 * dpr;
      symCtx = symPreview.getContext('2d')!;
      symCtx.scale(dpr, dpr);
      draw();
    };

    initCanvas();
    window.addEventListener('resize', initCanvas);

    return () => {
      window.removeEventListener('resize', initCanvas);
      stopAnim();
    };
  });

  function selectPreset(preset: any) {
    p = { ...p, ...preset.params };
    showToast(`Loaded ${preset.name} Preset`);
  }

  function showToast(message: string) {
    toast = { show: true, message, type: 'success' };
    setTimeout(() => (toast.show = false), 3000);
  }

  function scrollToSection(id: string) {
    if (browser) {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getWavePath(phase: number, offset: number, amplitude: number) {
    const segments = 25;
    const width = 1600;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width;
      const y =
        100 +
        Math.sin(phase * 0.5 + i * 0.4 + offset) * amplitude +
        Math.cos(phase * 0.2 + i * 0.6 + offset) * (amplitude / 1.5);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    return points.join(' ');
  }
</script>

<svelte:window bind:scrollY />

<svelte:head>
  <title>Guilloche Studio | Precision Ornamental Patterns</title>
</svelte:head>

<!-- Header -->
<header
  class="fixed top-0 z-50 w-full transition-all duration-500 {scrollY > 50
    ? 'bg-white/70 backdrop-blur-2xl py-3'
    : 'bg-transparent py-5'}"
>
  <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-8">
    <a href="/" class="flex items-center gap-3 group">
      <div class="relative">
        <img src="/logo.svg" alt="" class="h-8 w-auto" />
        <div
          class="absolute inset-0 bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
        ></div>
      </div>
      <span class="text-xl font-sohne-halbfett tracking-tight text-gray-900">Guilloche Studio</span>
    </a>

    <div class="hidden md:flex items-center gap-12 font-sohne-buch">
      <button
        on:click={() => scrollToSection('capabilities')}
        class="text-[11px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-[0.2em] relative group py-1"
      >
        Capabilities
        <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100/50 overflow-hidden">
          <div
            class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
          ></div>
        </div>
      </button>
      <button
        on:click={() => scrollToSection('standards')}
        class="text-[11px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-[0.2em] relative group py-1"
      >
        Standards
        <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100/50 overflow-hidden">
          <div
            class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
          ></div>
        </div>
      </button>
      <button
        on:click={() => scrollToSection('pricing')}
        class="text-[11px] font-bold text-gray-400 hover:text-black transition-colors uppercase tracking-[0.2em] relative group py-1"
      >
        Licensing
        <div class="absolute bottom-0 left-0 w-full h-px bg-gray-100/50 overflow-hidden">
          <div
            class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
          ></div>
        </div>
      </button>
    </div>

    <div class="flex items-center gap-5 font-sohne-halbfett">
      {#if $isAuthenticated}
        <a href="/studio" class="btn btn-primary px-6 py-2.5 text-[11px]">Studio</a>
      {:else}
        <a
          href="/auth/login"
          class="text-[11px] font-bold text-gray-500 hover:text-black uppercase tracking-widest transition-colors"
          >Log in</a
        >
        <a href="/auth/signup" class="btn btn-primary px-7 py-3 text-[11px]">Get Started</a>
      {/if}
    </div>
  </nav>
</header>

<main class="bg-white text-gray-900 font-kalice">
  <!-- Hero Section -->
  <section class="relative pt-40 pb-20 lg:pt-60 lg:pb-32 overflow-hidden bg-white">
    <div
      class="absolute inset-0 z-0 opacity-[0.05] pointer-events-none"
      style="background-image: linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px); background-size: 60px 60px;"
    ></div>

    <div class="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 text-center">
      <div in:fade={{ duration: 1000 }}>
        <h1
          class="text-7xl font-sohne-halbfett tracking-tighter text-gray-900 sm:text-8xl lg:text-9xl mb-10 leading-[0.85]"
        >
          Precision, <br />
          <span class="text-gray-200">Reimagined.</span>
        </h1>
        <p
          class="text-2xl lg:text-3xl leading-relaxed text-gray-400 max-w-3xl mx-auto font-light mb-12"
        >
          The modern replacement for Guardsoft CERBERUS or Excentro. Uncompromised parametric
          control, powered by WebAssembly.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-8">
          <a
            href="/studio"
            class="btn btn-primary px-12 py-6 text-sm shadow-2xl shadow-black/10 active:scale-95"
          >
            Launch Engine
          </a>
          <button
            on:click={() => scrollToSection('mini-studio')}
            class="text-sm font-bold text-gray-900 uppercase tracking-widest group flex items-center gap-4"
          >
            Try Mini Studio
            <div class="relative w-12 h-px bg-gray-200 overflow-hidden">
              <div
                class="absolute inset-0 bg-black transition-transform duration-500 -translate-x-full group-hover:translate-x-0"
              ></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- Interactive Mini Studio Pro Section -->
  <section
    id="mini-studio"
    class="bg-slate-50 py-24 relative overflow-hidden border-y border-slate-200"
  >
    <div class="mx-auto max-w-[1600px] px-6 lg:px-8">
      <div class="mb-16 text-center">
        <h2 class="text-4xl font-sohne-halbfett font-bold tracking-tight text-slate-900">
          Mini Studio Pro
        </h2>
        <p class="text-slate-500 mt-4 max-w-2xl mx-auto">
          Experience the engine core. Intricate mathematical patterns with real-time parametric
          manipulation.
        </p>
      </div>

      <div
        class="flex flex-col lg:flex-row bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[850px]"
      >
        <!-- SIDE PANEL -->
        <aside
          class="w-full lg:w-[400px] bg-slate-50 border-r border-slate-200 flex flex-col transition-all {panelCollapsed
            ? 'lg:w-[60px]'
            : ''}"
        >
          <div class="flex items-center justify-between p-6 border-b border-slate-200">
            {#if !panelCollapsed}
              <h3
                class="font-sohne-halbfett font-bold uppercase tracking-widest text-[10px] text-slate-400"
              >
                Controls
              </h3>
            {/if}
            <button
              on:click={() => (panelCollapsed = !panelCollapsed)}
              class="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
            >
              {panelCollapsed ? '›' : '‹'}
            </button>
          </div>

          {#if !panelCollapsed}
            <div class="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div class="flex gap-1 mb-8 bg-slate-200/50 p-1 rounded-xl">
                {#each ['curve', 'style', 'animate'] as tab}
                  <button
                    on:click={() => (activeTab = tab)}
                    class="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all
                                 {activeTab === tab
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'}"
                  >
                    {tab}
                  </button>
                {/each}
              </div>

              {#if activeTab === 'curve'}
                <div class="space-y-8" in:fade>
                  <section>
                    <label
                      for="home-curve-family"
                      class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2"
                      >Curve Family</label
                    >
                    <select
                      id="home-curve-family"
                      bind:value={p.family}
                      class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="hypo">Hypotrochoid</option>
                      <option value="epi">Epitrochoid</option>
                      <option value="rose">Rose Curve</option>
                      <option value="liss">Lissajous</option>
                      <option value="spiral">Archimedean Spiral</option>
                      <option value="hypocycloid">Hypocycloid</option>
                      <option value="epicycloid">Epicycloid</option>
                    </select>
                  </section>

                  <section class="grid grid-cols-2 gap-6">
                    <div>
                      <div class="flex justify-between mb-2">
                        <span class="text-[9px] font-bold uppercase text-slate-400">Outer R</span>
                        <span class="text-[10px] font-mono font-bold text-slate-900">{p.R}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="450"
                        bind:value={p.R}
                        class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div class="flex justify-between mb-2">
                        <span class="text-[9px] font-bold uppercase text-slate-400">Inner r</span>
                        <span class="text-[10px] font-mono font-bold text-slate-900">{p.r}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="300"
                        bind:value={p.r}
                        class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div class="flex justify-between mb-2">
                        <span class="text-[9px] font-bold uppercase text-slate-400">Pen Offset</span
                        >
                        <span class="text-[10px] font-mono font-bold text-slate-900">{p.d}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="320"
                        bind:value={p.d}
                        class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                    <div>
                      <div class="flex justify-between mb-2">
                        <span class="text-[9px] font-bold uppercase text-slate-400">Frequency</span>
                        <span class="text-[10px] font-mono font-bold text-slate-900">{p.k}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="80"
                        bind:value={p.k}
                        class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </section>

                  <section class="pt-8 border-t border-slate-200">
                    <div class="flex justify-between mb-4">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >Symmetry</span
                      >
                      <span class="text-[10px] font-bold text-indigo-600">{p.symmetry}x</span>
                    </div>
                    <div
                      class="h-20 bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4"
                    >
                      <canvas bind:this={symPreview} class="w-full h-full" />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="24"
                      bind:value={p.symmetry}
                      class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                  </section>

                  <section class="pt-8 border-t border-slate-200">
                    <span
                      class="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4"
                      >Presets</span
                    >
                    <div class="grid grid-cols-3 gap-2">
                      {#each PRESETS as preset}
                        <button
                          on:click={() => selectPreset(preset)}
                          class="p-2 text-[9px] font-bold bg-white border border-slate-200 rounded-lg hover:border-indigo-500 transition-colors uppercase truncate"
                          >{preset.name}</button
                        >
                      {/each}
                    </div>
                  </section>
                </div>
              {:else if activeTab === 'style'}
                <div class="space-y-8" in:fade>
                  <section>
                    <label
                      for="home-bg-color"
                      class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2"
                      >Background</label
                    >
                    <input
                      id="home-bg-color"
                      type="color"
                      bind:value={p.bgColor}
                      class="w-full h-12 p-1 rounded-xl bg-white border border-slate-200 cursor-pointer"
                    />
                  </section>

                  <section>
                    <div class="flex justify-between mb-2">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >Stroke Width</span
                      >
                      <span class="text-[10px] font-mono font-bold">{p.lw}px</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="8"
                      step="0.1"
                      bind:value={p.lw}
                      class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                  </section>

                  <section class="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        for="home-primary-color"
                        class="block text-[9px] font-bold uppercase text-slate-400 mb-2"
                        >Primary</label
                      >
                      <input
                        id="home-primary-color"
                        type="color"
                        bind:value={p.startColor}
                        class="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label
                        for="home-secondary-color"
                        class="block text-[9px] font-bold uppercase text-slate-400 mb-2"
                        >Secondary</label
                      >
                      <input
                        id="home-secondary-color"
                        type="color"
                        bind:value={p.endColor}
                        class="w-full h-10 p-1 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                  </section>

                  <div
                    class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between"
                  >
                    <span class="text-[10px] font-bold uppercase text-indigo-600">Use Gradient</span
                    >
                    <input
                      type="checkbox"
                      bind:checked={p.useGradient}
                      class="w-4 h-4 accent-indigo-600"
                    />
                  </div>
                </div>
              {:else if activeTab === 'animate'}
                <div class="space-y-8" in:fade>
                  <section class="flex flex-col gap-4">
                    <button
                      on:click={() => (isAnimating ? stopAnim() : startAnim())}
                      class="w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[11px] transition-all
                                   {isAnimating
                        ? 'bg-amber-500 text-white shadow-lg'
                        : 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:scale-105'}"
                    >
                      {isAnimating ? 'Pause Animation' : 'Start Engine'}
                    </button>
                  </section>

                  <section>
                    <div class="flex justify-between mb-2">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >Rotation Speed</span
                      >
                      <span class="text-[10px] font-mono font-bold"
                        >{(p.rotSpeed * 100).toFixed(1)}</span
                      >
                    </div>
                    <input
                      type="range"
                      min="-0.1"
                      max="0.1"
                      step="0.005"
                      bind:value={p.rotSpeed}
                      class="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                  </section>

                  <div class="p-4 bg-white rounded-2xl border border-slate-200 space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold uppercase text-slate-400"
                        >Morph Symmetry</span
                      >
                      <input
                        type="checkbox"
                        bind:checked={p.morphSymmetry}
                        class="w-4 h-4 accent-indigo-600"
                      />
                    </div>
                    <p class="text-[9px] text-slate-400 leading-relaxed">
                      Procedurally cycle symmetry counts for organic growth effects.
                    </p>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </aside>

        <!-- STAGE -->
        <main
          class="flex-1 relative bg-slate-100 flex flex-col items-center justify-center p-12 overflow-hidden"
        >
          <div
            class="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/80 backdrop-blur-xl rounded-full border border-slate-200 shadow-xl z-10 flex gap-8"
          >
            <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400"
              >Zoom: {(view.zoom * 100).toFixed(0)}%</span
            >
            <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400"
              >Steps: {p.steps.toLocaleString()}</span
            >
          </div>

          <div
            class="w-full h-full max-w-4xl aspect-square flex items-center justify-center relative"
          >
            <canvas
              bind:this={canvas}
              class="w-full h-full shadow-2xl rounded-2xl bg-white cursor-grab active:cursor-grabbing"
            />
          </div>

          <div class="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-10">
            <div
              class="bg-indigo-900/90 backdrop-blur-2xl p-4 rounded-2xl flex items-center justify-between text-white shadow-2xl"
            >
              <div class="flex gap-4">
                <button
                  on:click={() => (p.steps = 8000)}
                  class="text-[9px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                  >Draft</button
                >
                <button
                  on:click={() => (p.steps = 32000)}
                  class="text-[9px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                  >Pro</button
                >
              </div>
              <button
                on:click={() => showToast('Exporting high-resolution vector...')}
                class="bg-white text-indigo-900 px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest"
                >Export SVG</button
              >
            </div>
          </div>
        </main>
      </div>
    </div>
  </section>

  <!-- Capabilities Section -->
  <section id="capabilities" class="py-24 bg-[#F5F5F7] overflow-hidden">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="mx-auto max-w-3xl text-center mb-20">
        <h2
          class="text-xs font-sohne-halbfett font-bold uppercase tracking-[0.5em] text-blue-600 mb-6"
        >
          Capabilities
        </h2>
        <p
          class="mt-2 text-6xl font-bold tracking-tight text-gray-900 font-fraunces italic leading-[1.05]"
        >
          Mathematics at the <br /> service of art.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div
          class="md:col-span-8 bg-white rounded-[4rem] p-16 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-700"
        >
          <div class="relative z-10 h-full flex flex-col justify-between">
            <div>
              <h3
                class="text-4xl font-sohne-halbfett font-semibold text-gray-900 mb-6 tracking-tight"
              >
                Vector Perfection
              </h3>
              <p class="text-gray-500 max-w-lg text-xl font-light leading-relaxed">
                Every curve is mathematically perfect, ensuring infinite scalability for
                high-resolution security printing.
              </p>
            </div>
            <div class="mt-16 flex gap-6">
              <span
                class="px-6 py-3 bg-gray-50 rounded-full text-[10px] font-bold font-mono text-gray-400 uppercase tracking-[0.2em]"
                >SVG 1.1</span
              >
              <span
                class="px-6 py-3 bg-gray-50 rounded-full text-[10px] font-bold font-mono text-gray-400 uppercase tracking-[0.2em]"
                >DXF R12</span
              >
            </div>
          </div>
        </div>

        <div
          class="md:col-span-4 bg-white rounded-[4rem] p-16 shadow-sm border border-gray-100 hover:shadow-2xl transition-all duration-700 group"
        >
          <div
            class="h-16 w-16 bg-gray-900 rounded-[1.5rem] flex items-center justify-center mb-12 text-white shadow-2xl"
          >
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              /></svg
            >
          </div>
          <h3 class="text-3xl font-sohne-halbfett font-semibold text-gray-900 mb-6">
            Security Core
          </h3>
          <p class="text-gray-500 font-light text-lg leading-relaxed">
            Advanced modulation algorithms specifically designed for anti-counterfeiting.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Standards Section -->
  <section id="standards" class="py-24 bg-white border-y border-gray-100 relative">
    <div class="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row items-center gap-24">
      <div class="flex-1">
        <h2
          class="text-xs font-sohne-halbfett font-bold uppercase tracking-[0.5em] text-gray-400 mb-8"
        >
          Engineering Standards
        </h2>
        <p
          class="text-6xl font-bold tracking-tight text-gray-900 font-fraunces italic leading-[1] mb-10"
        >
          Compliance at every <br /> coordinate.
        </p>
        <div class="space-y-8 font-kalice text-xl font-light text-gray-500 leading-relaxed">
          <p>
            Our engine adheres to the strictest mathematical protocols used in global security
            printing. Every line segment is checked for continuity.
          </p>
          <ul class="space-y-4">
            <li class="flex items-center gap-6 text-gray-900 font-medium group cursor-default">
              <div
                class="w-2.5 h-2.5 rounded-full bg-blue-600 group-hover:scale-150 transition-transform"
              ></div>
              W3C SVG 1.1/2.0 Compliant
            </li>
            <li class="flex items-center gap-6 text-gray-900 font-medium group cursor-default">
              <div
                class="w-2.5 h-2.5 rounded-full bg-blue-600 group-hover:scale-150 transition-transform"
              ></div>
              ISO 12647 Print Standards
            </li>
          </ul>
        </div>
      </div>
      <div class="flex-1 relative">
        <div
          class="aspect-square w-full max-w-md mx-auto relative flex items-center justify-center group"
        >
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="w-48 h-40 border border-gray-100 rounded-full shadow-2xl bg-white flex items-center justify-center transition-transform duration-700 group-hover:scale-110"
            >
              <img src="/logo.svg" alt="" class="w-24 h-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="pricing" class="py-24 bg-white">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="mx-auto max-w-2xl text-center mb-24">
        <h2
          class="text-5xl font-sohne-halbfett font-bold tracking-tighter text-gray-900 sm:text-6xl"
        >
          Simple licensing.
        </h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
        {#each SUBSCRIPTION_PLANS as plan}
          <div
            class="bg-white rounded-[4rem] p-16 shadow-sm border border-gray-50 flex flex-col transition-all duration-700 hover:shadow-2xl hover:-translate-y-2 {plan.tier ===
            'pro'
              ? 'ring-2 ring-blue-600 relative'
              : ''}"
          >
            {#if plan.tier === 'pro'}
              <span
                class="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full text-[10px] font-sohne-halbfett font-bold tracking-[0.3em] uppercase"
                >Enterprise Standard</span
              >
            {/if}

            <h3
              class="text-sm font-bold text-gray-400 uppercase tracking-[0.3em] font-sohne-halbfett mb-8"
            >
              {plan.name}
            </h3>
            <div class="flex items-baseline gap-1 font-sohne-halbfett mb-12">
              {#if plan.priceMonthly === 0}
                <span class="text-7xl font-bold tracking-tighter text-gray-900">Free</span>
              {:else}
                <span class="text-7xl font-bold tracking-tighter text-gray-900"
                  >${plan.priceMonthly}</span
                >
                <span class="text-gray-300 font-medium text-2xl ml-2">/mo</span>
              {/if}
            </div>

            <ul class="space-y-6 flex-1 text-lg font-light text-gray-500">
              {#each plan.features as feature}
                <li class="flex gap-5">
                  <svg
                    class="h-6 w-6 flex-none text-blue-600 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    ><path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    /></svg
                  >
                  {feature}
                </li>
              {/each}
            </ul>

            <a href="/auth/signup?plan={plan.tier}" class="btn btn-primary mt-16 py-6 text-[10px]">
              {plan.tier === 'free' ? 'Start Base' : 'Acquire License'}
            </a>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="bg-white py-32 relative overflow-hidden border-t border-gray-50">
    <div class="mx-auto max-w-7xl px-6 lg:px-8 text-center">
      <h2
        class="text-7xl font-sohne-halbfett font-bold tracking-tighter text-gray-900 sm:text-9xl mb-12 leading-[0.85]"
      >
        Forge the future.
      </h2>
      <p
        class="mx-auto max-w-2xl text-2xl text-gray-400 font-light leading-relaxed font-kalice mb-16"
      >
        Join the elite circle of designers redefining the boundaries of mathematical art.
      </p>
      <div class="flex items-center justify-center">
        <a
          href="/studio"
          class="btn btn-primary px-16 py-7 text-lg shadow-2xl shadow-black/20 hover:scale-105 active:scale-95"
        >
          Launch Engine
        </a>
      </div>
    </div>

    <div
      class="absolute bottom-[-100px] left-0 w-full h-[300px] opacity-[0.25] pointer-events-none overflow-hidden"
    >
      <svg viewBox="0 0 1600 200" class="w-full h-full preserve-3d" preserveAspectRatio="none">
        {#each Array(8) as _, i}
          <path
            d={getWavePath(wavePhase * 0.05, i * 1.5, 30 + i * 5)}
            fill="none"
            stroke="#000"
            stroke-width={0.5 + i * 0.1}
            opacity={1 - i / 8}
          />
        {/each}
      </svg>
    </div>
  </section>
</main>

<Footer />

{#if toast.show}
  <div
    class="fixed bottom-10 right-10 z-[1000] bg-indigo-900 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold uppercase tracking-widest text-[10px] animate-bounce"
  >
    {toast.message}
  </div>
{/if}

<style>
  :global(body) {
    background-color: #ffffff;
    font-feature-settings: 'cv11', 'ss01', 'ss03';
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    border: 2px solid white;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
