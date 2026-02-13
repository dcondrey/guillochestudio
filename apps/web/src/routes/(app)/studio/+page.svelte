<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { GuillocheEngine, CanvasRenderer, SVGRenderer } from '@guilloche/core';
  import { CURVE_FAMILIES, PRESET_PATTERNS, getDefaultParams } from '@guilloche/shared';
  import type { PatternParams, CurveFamily } from '@guilloche/shared';
  import {
    params,
    updateParam,
    updateParams,
    setParams,
    resetParams,
    saveToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    currentPath
  } from '$lib/stores/pattern';
  import { isAuthenticated, isPro, subscriptionTier } from '$lib/stores/auth';
  import {
    aiSuggestionsEnabled,
    advancedExportEnabled,
    wasmEngineEnabled,
    betaFeaturesEnabled,
    experimentalCurvesEnabled,
    maintenanceModeEnabled
  } from '$lib/stores/feature-flags';
  import { randomizeParams } from '@guilloche/core';
  import AIAssistant from '$lib/components/ai/AIAssistant.svelte';

  let canvas: HTMLCanvasElement;
  let renderer: CanvasRenderer | null = null;
  let panelCollapsed = false;
  let activeTab = 'curve';

  // View state
  let view = { zoom: 1, panX: 0, panY: 0 };
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };

  // Initialize renderer
  function initRenderer() {
    if (!canvas || !browser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    renderer = new CanvasRenderer(ctx, rect.width, rect.height);
  }

  // Render pattern
  function render() {
    if (!renderer || !$currentPath) return;

    renderer.render($currentPath, {
      backgroundColor: $params.bgColor,
      strokeColor: $params.useGradient ? undefined : $params.startColor,
      gradient: $params.useGradient ? [$params.startColor, $params.endColor] : undefined,
      glow: $params.glow,
      vignette: $params.vignette,
      dashed: $params.dashed,
      dashRatio: $params.dashRatio
    });
  }

  // Handle randomize
  function handleRandomize() {
    const newParams = randomizeParams($params, {
      family: true,
      geometry: true,
      modulation: true,
      symmetry: true,
      colors: true
    });
    setParams(newParams);
    saveToHistory('Randomized pattern');
  }

  // Handle preset
  function handlePreset(preset: (typeof PRESET_PATTERNS)[0]) {
    updateParams(preset.params);
    if (preset.gradient) {
      updateParams({
        useGradient: true,
        startColor: preset.gradient[0],
        endColor: preset.gradient[1]
      });
    }
    saveToHistory(`Applied preset: ${preset.name}`);
  }

  // Export SVG
  async function exportSVG() {
    if (!$currentPath) return;

    const svgRenderer = new SVGRenderer();
    const svg = svgRenderer.render($currentPath, {
      includeMetadata: true,
      backgroundColor: $params.bgColor,
      strokeColor: $params.useGradient ? undefined : $params.startColor,
      gradient: $params.useGradient ? [$params.startColor, $params.endColor] : undefined,
      glow: $params.glow,
      dashed: $params.dashed,
      dashRatio: $params.dashRatio
    });

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guilloche_${$params.family}_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Export PNG
  async function exportPNG() {
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `guilloche_${$params.family}_${Date.now()}.png`;
    a.click();
  }

  // Canvas interactions
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = Math.exp(-e.deltaY * 0.001);
    view.zoom = Math.min(10, Math.max(0.1, view.zoom * zoomFactor));
    render();
  }

  function handleMouseDown(e: MouseEvent) {
    dragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging) return;
    view.panX += e.clientX - lastMouse.x;
    view.panY += e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };
    render();
  }

  function handleMouseUp() {
    dragging = false;
  }

  function handleDoubleClick() {
    view = { zoom: 1, panX: 0, panY: 0 };
    render();
  }

  // Handle curve family change
  function handleFamilyChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    updateParam('family', target.value as CurveFamily);
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's') {
        e.preventDefault();
        // TODO: Save pattern
      }
    }
  }

  // Reactive render
  $: if (browser && renderer && $currentPath) {
    render();
  }

  onMount(() => {
    initRenderer();
    window.addEventListener('resize', initRenderer);
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('resize', initRenderer);
      window.removeEventListener('keydown', handleKeydown);
    }
  });

  const tabs = ['curve', 'style', 'ai', 'layers', 'export'];

  // AI handlers
  function handleAIApply(event: CustomEvent<Partial<PatternParams>>) {
    updateParams(event.detail);
    saveToHistory('Applied AI suggestion');
  }

  function handleAIApplyFull(event: CustomEvent<PatternParams>) {
    setParams(event.detail);
    saveToHistory('Applied AI-generated pattern');
  }
</script>

<svelte:head>
  <title>Studio - Guilloché Studio Pro</title>
</svelte:head>

<div class="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
  <!-- Header -->
  <header class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
    <div class="flex items-center gap-3">
      <a href="/" class="flex items-center gap-2 text-xl font-bold">
        <span>⚙️</span>
        <span class="hidden sm:inline">Guilloché Studio</span>
      </a>
      {#if $isPro}
        <span class="badge badge-pro">PRO</span>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <button class="btn btn-ghost btn-sm" on:click={undo} disabled={!$canUndo} title="Undo (⌘Z)">
        ↶
      </button>
      <button class="btn btn-ghost btn-sm" on:click={redo} disabled={!$canRedo} title="Redo (⌘⇧Z)">
        ↷
      </button>
      <button class="btn btn-secondary btn-sm" on:click={handleRandomize}>
        🎲 Random
      </button>
      {#if $isAuthenticated}
        <a href="/patterns" class="btn btn-secondary btn-sm">My Patterns</a>
        <form action="/auth/logout" method="post">
          <button type="submit" class="btn btn-ghost btn-sm">Sign Out</button>
        </form>
      {:else}
        <a href="/auth/login" class="btn btn-primary btn-sm">Sign In</a>
      {/if}
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- Side Panel -->
    <aside
      class="flex flex-col border-r border-gray-200 bg-white transition-all dark:border-gray-800 dark:bg-gray-950
             {panelCollapsed ? 'w-14' : 'w-80 lg:w-96'}"
    >
      <div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
        {#if !panelCollapsed}
          <h2 class="text-lg font-semibold">Controls</h2>
        {/if}
        <button class="btn btn-ghost btn-sm" on:click={() => (panelCollapsed = !panelCollapsed)}>
          {panelCollapsed ? '›' : '‹'}
        </button>
      </div>

      {#if !panelCollapsed}
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 dark:border-gray-800">
          {#each tabs as tab}
            <button
              class="flex-1 px-3 py-2 text-sm font-medium capitalize transition-colors
                     {activeTab === tab
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'}"
              on:click={() => (activeTab = tab)}
            >
              {tab}
            </button>
          {/each}
        </div>

        <div class="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {#if activeTab === 'curve'}
            <!-- Curve Tab -->
            <div class="space-y-6">
              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Curve Family</h3>
                <select
                  class="input"
                  value={$params.family}
                  on:change={handleFamilyChange}
                >
                  {#each CURVE_FAMILIES as family}
                    <option value={family.value}>{family.label}</option>
                  {/each}
                </select>
              </div>

              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Parameters</h3>
                <div class="space-y-3">
                  <label class="block">
                    <span class="text-xs text-gray-500">R (Outer Radius): {$params.R}</span>
                    <input
                      type="range"
                      class="w-full"
                      min="10"
                      max="450"
                      value={$params.R}
                      on:input={(e) => updateParam('R', +e.currentTarget.value)}
                    />
                  </label>
                  <label class="block">
                    <span class="text-xs text-gray-500">r (Inner Radius): {$params.r}</span>
                    <input
                      type="range"
                      class="w-full"
                      min="5"
                      max="300"
                      value={$params.r}
                      on:input={(e) => updateParam('r', +e.currentTarget.value)}
                    />
                  </label>
                  <label class="block">
                    <span class="text-xs text-gray-500">d (Pen Offset): {$params.d}</span>
                    <input
                      type="range"
                      class="w-full"
                      min="0"
                      max="320"
                      value={$params.d}
                      on:input={(e) => updateParam('d', +e.currentTarget.value)}
                    />
                  </label>
                  <label class="block">
                    <span class="text-xs text-gray-500">k (Frequency): {$params.k}</span>
                    <input
                      type="range"
                      class="w-full"
                      min="1"
                      max="80"
                      value={$params.k}
                      on:input={(e) => updateParam('k', +e.currentTarget.value)}
                    />
                  </label>
                </div>
              </div>

              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Symmetry</h3>
                <label class="block">
                  <span class="text-xs text-gray-500">Rotational: {$params.symmetry}</span>
                  <input
                    type="range"
                    class="w-full"
                    min="1"
                    max="24"
                    value={$params.symmetry}
                    on:input={(e) => updateParam('symmetry', +e.currentTarget.value)}
                  />
                </label>
                <div class="mt-3 space-y-2">
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={$params.reflectH}
                      on:change={(e) => updateParam('reflectH', e.currentTarget.checked)}
                    />
                    Horizontal Reflection
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={$params.reflectV}
                      on:change={(e) => updateParam('reflectV', e.currentTarget.checked)}
                    />
                    Vertical Reflection
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={$params.kaleidoscope}
                      on:change={(e) => updateParam('kaleidoscope', e.currentTarget.checked)}
                    />
                    Kaleidoscope Mode
                  </label>
                </div>
              </div>

              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Presets</h3>
                <div class="grid grid-cols-3 gap-2">
                  {#each PRESET_PATTERNS as preset}
                    <button
                      class="aspect-square rounded-lg p-2 text-xs font-medium text-white transition-transform hover:scale-105"
                      style="background: linear-gradient(135deg, {preset.gradient[0]}, {preset.gradient[1]})"
                      on:click={() => handlePreset(preset)}
                    >
                      {preset.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          {:else if activeTab === 'style'}
            <!-- Style Tab -->
            <div class="space-y-6">
              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Colors</h3>
                <div class="space-y-3">
                  <label class="block">
                    <span class="text-xs text-gray-500">Background</span>
                    <input
                      type="color"
                      class="mt-1 h-10 w-full rounded-lg"
                      value={$params.bgColor}
                      on:input={(e) => updateParam('bgColor', e.currentTarget.value)}
                    />
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="block">
                      <span class="text-xs text-gray-500">Start Color</span>
                      <input
                        type="color"
                        class="mt-1 h-10 w-full rounded-lg"
                        value={$params.startColor}
                        on:input={(e) => updateParam('startColor', e.currentTarget.value)}
                      />
                    </label>
                    <label class="block">
                      <span class="text-xs text-gray-500">End Color</span>
                      <input
                        type="color"
                        class="mt-1 h-10 w-full rounded-lg"
                        value={$params.endColor}
                        on:input={(e) => updateParam('endColor', e.currentTarget.value)}
                      />
                    </label>
                  </div>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={$params.useGradient}
                      on:change={(e) => updateParam('useGradient', e.currentTarget.checked)}
                    />
                    Use Gradient
                  </label>
                </div>
              </div>

              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Stroke</h3>
                <label class="block">
                  <span class="text-xs text-gray-500">Width: {$params.lw.toFixed(1)}</span>
                  <input
                    type="range"
                    class="w-full"
                    min="0.1"
                    max="8"
                    step="0.1"
                    value={$params.lw}
                    on:input={(e) => updateParam('lw', +e.currentTarget.value)}
                  />
                </label>
                <label class="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={$params.dashed}
                    on:change={(e) => updateParam('dashed', e.currentTarget.checked)}
                  />
                  Dashed Lines
                </label>
              </div>

              <div class="panel">
                <h3 class="mb-3 text-sm font-semibold">Effects</h3>
                <label class="block">
                  <span class="text-xs text-gray-500">Glow: {$params.glow}</span>
                  <input
                    type="range"
                    class="w-full"
                    min="0"
                    max="20"
                    value={$params.glow}
                    on:input={(e) => updateParam('glow', +e.currentTarget.value)}
                  />
                </label>
                <label class="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={$params.vignette}
                    on:change={(e) => updateParam('vignette', e.currentTarget.checked)}
                  />
                  Paper Vignette
                </label>
              </div>
            </div>
          {:else if activeTab === 'export'}
            <!-- Export Tab -->
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-3">
                <button class="btn btn-primary flex-col gap-1 py-4" on:click={exportSVG}>
                  <span class="text-xl">🖼️</span>
                  <span>SVG</span>
                  <span class="text-xs opacity-75">Vector</span>
                </button>
                <button class="btn btn-secondary flex-col gap-1 py-4" on:click={exportPNG}>
                  <span class="text-xl">📸</span>
                  <span>PNG</span>
                  <span class="text-xs opacity-75">Raster</span>
                </button>
                <button
                  class="btn btn-secondary flex-col gap-1 py-4 {!$advancedExportEnabled ? 'opacity-50' : ''}"
                  disabled={!$advancedExportEnabled}
                >
                  <span class="text-xl">📄</span>
                  <span>PDF</span>
                  <span class="text-xs opacity-75">{$advancedExportEnabled ? 'Print Ready' : 'Pro Only'}</span>
                </button>
                <button
                  class="btn btn-secondary flex-col gap-1 py-4 {!$advancedExportEnabled ? 'opacity-50' : ''}"
                  disabled={!$advancedExportEnabled}
                >
                  <span class="text-xl">✏️</span>
                  <span>DXF</span>
                  <span class="text-xs opacity-75">{$advancedExportEnabled ? 'CNC/Laser' : 'Pro Only'}</span>
                </button>
              </div>

              {#if !$advancedExportEnabled}
                <div class="rounded-xl bg-primary-50 p-4 dark:bg-primary-900/20">
                  <h4 class="font-semibold text-primary-800 dark:text-primary-300">
                    Upgrade to Pro
                  </h4>
                  <p class="mt-1 text-sm text-primary-700 dark:text-primary-400">
                    Get PDF, DXF, GCODE exports, AI assistant, and more.
                  </p>
                  <a href="/pricing" class="btn btn-primary btn-sm mt-3">
                    View Plans
                  </a>
                </div>
              {/if}
            </div>
          {:else if activeTab === 'ai'}
            <!-- AI Tab -->
            <div class="space-y-4">
              {#if $aiSuggestionsEnabled}
                <AIAssistant
                  on:apply={handleAIApply}
                  on:applyFull={handleAIApplyFull}
                />
              {:else}
                <div class="rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 border border-indigo-700/50">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 rounded-full bg-indigo-600/30">
                      <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-white">AI Assistant</h3>
                  </div>
                  <p class="text-gray-300 text-sm mb-4">
                    Unlock powerful AI features to enhance your creative workflow:
                  </p>
                  <ul class="space-y-2 text-sm text-gray-400 mb-6">
                    <li class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Style Keywords - Generate patterns from descriptive words
                    </li>
                    <li class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Image Analysis - Upload photos to extract parameters
                    </li>
                    <li class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Text Prompts - Describe your vision in natural language
                    </li>
                  </ul>
                  <a href="/pricing" class="block w-full py-2 bg-indigo-600 text-white text-center rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    Upgrade to Pro
                  </a>
                </div>
              {/if}
            </div>
          {:else if activeTab === 'layers'}
            <!-- Layers Tab -->
            <div class="space-y-4">
              <p class="text-sm text-gray-500">
                Multi-layer support coming soon! Create complex patterns with multiple overlapping curves.
              </p>
            </div>
          {/if}
        </div>

        <!-- Reset Button -->
        <div class="border-t border-gray-200 p-4 dark:border-gray-800">
          <button class="btn btn-secondary w-full" on:click={resetParams}>
            ↺ Reset to Defaults
          </button>
        </div>
      {/if}
    </aside>

    <!-- Canvas Stage -->
    <main class="relative flex-1 bg-gray-200 dark:bg-gray-800">
      <canvas
        bind:this={canvas}
        class="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        on:wheel={handleWheel}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:dblclick={handleDoubleClick}
      />

      <!-- Hint Bar -->
      <div
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-6 py-2 text-sm text-gray-600 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-400"
      >
        🖱️ Wheel: Zoom | Drag: Pan | Double-click: Reset | ⌘Z: Undo
      </div>
    </main>
  </div>
</div>
