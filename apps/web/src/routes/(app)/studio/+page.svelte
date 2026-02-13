<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { CanvasRenderer, SVGRenderer } from '@guilloche/core';
  import { CURVE_FAMILIES, PRESET_PATTERNS } from '@guilloche/shared';
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
  import { isAuthenticated, isPro } from '$lib/stores/auth';
  import {
    aiSuggestionsEnabled,
    advancedExportEnabled,
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

  // Announcements for screen readers
  let announcement = '';

  function announce(message: string) {
    announcement = '';
    requestAnimationFrame(() => {
      announcement = message;
    });
  }

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
    announce('Pattern randomized');
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
    announce(`Applied preset: ${preset.name}`);
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
    announce('SVG file downloaded');
  }

  // Export PNG
  async function exportPNG() {
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `guilloche_${$params.family}_${Date.now()}.png`;
    a.click();
    announce('PNG file downloaded');
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
    announce('View reset to default');
  }

  // Handle curve family change
  function handleFamilyChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    updateParam('family', target.value as CurveFamily);
    announce(`Curve family changed to ${target.value}`);
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        announce('Undo');
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
        announce('Redo');
      } else if (e.key === 's') {
        e.preventDefault();
        announce('Pattern saved');
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

  const tabs = [
    { id: 'curve', label: 'Curve' },
    { id: 'style', label: 'Style' },
    { id: 'ai', label: 'AI' },
    { id: 'layers', label: 'Layers' },
    { id: 'export', label: 'Export' }
  ];

  // AI handlers
  function handleAIApply(event: CustomEvent<Partial<PatternParams>>) {
    updateParams(event.detail);
    saveToHistory('Applied AI suggestion');
    announce('AI suggestion applied');
  }

  function handleAIApplyFull(event: CustomEvent<PatternParams>) {
    setParams(event.detail);
    saveToHistory('Applied AI-generated pattern');
    announce('AI-generated pattern applied');
  }
</script>

<svelte:head>
  <title>Studio - Guilloche Studio Pro</title>
  <meta name="description" content="Create and edit guilloche patterns with the Guilloche Studio pattern editor." />
</svelte:head>

<!-- Screen reader announcements -->
<div
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
  role="status"
>
  {announcement}
</div>

<div class="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
  <!-- Header -->
  <header
    class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950"
  >
    <div class="flex items-center gap-3">
      <a
        href="/"
        class="flex items-center gap-2 text-xl font-bold"
        aria-label="Guilloche Studio Home"
      >
        <img
          src="/logo.svg"
          alt=""
          class="h-6 w-6"
          width="24"
          height="24"
          aria-hidden="true"
        />
        <span class="hidden sm:inline">Guilloche Studio</span>
      </a>
      {#if $isPro}
        <span class="badge badge-pro" aria-label="Pro subscription active">PRO</span>
      {/if}
    </div>

    <nav class="flex items-center gap-2" aria-label="Studio actions">
      <button
        class="btn btn-ghost btn-sm"
        on:click={undo}
        disabled={!$canUndo}
        aria-label="Undo last action"
        title="Undo (⌘Z)"
      >
        <span aria-hidden="true">↶</span>
      </button>
      <button
        class="btn btn-ghost btn-sm"
        on:click={redo}
        disabled={!$canRedo}
        aria-label="Redo last action"
        title="Redo (⌘⇧Z)"
      >
        <span aria-hidden="true">↷</span>
      </button>
      <button
        class="btn btn-secondary btn-sm"
        on:click={handleRandomize}
        aria-label="Generate random pattern"
      >
        <span aria-hidden="true">🎲</span>
        <span>Random</span>
      </button>
      {#if $isAuthenticated}
        <a href="/patterns" class="btn btn-secondary btn-sm">My Patterns</a>
        <form action="/auth/logout" method="post">
          <button type="submit" class="btn btn-ghost btn-sm">Sign Out</button>
        </form>
      {:else}
        <a href="/auth/login" class="btn btn-primary btn-sm">Sign In</a>
      {/if}
    </nav>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- Side Panel -->
    <aside
      class="flex flex-col border-r border-gray-200 bg-white transition-all dark:border-gray-800 dark:bg-gray-950
             {panelCollapsed ? 'w-14' : 'w-80 lg:w-96'}"
      aria-label="Pattern controls"
    >
      <div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
        {#if !panelCollapsed}
          <h2 class="text-lg font-semibold" id="controls-heading">Controls</h2>
        {/if}
        <button
          class="btn btn-ghost btn-sm"
          on:click={() => (panelCollapsed = !panelCollapsed)}
          aria-expanded={!panelCollapsed}
          aria-controls="controls-panel"
          aria-label={panelCollapsed ? 'Expand controls panel' : 'Collapse controls panel'}
        >
          <span aria-hidden="true">{panelCollapsed ? '›' : '‹'}</span>
        </button>
      </div>

      {#if !panelCollapsed}
        <div id="controls-panel" aria-labelledby="controls-heading">
          <!-- Tabs -->
          <div
            class="flex border-b border-gray-200 dark:border-gray-800"
            role="tablist"
            aria-label="Control categories"
          >
            {#each tabs as tab}
              <button
                role="tab"
                id="tab-{tab.id}"
                aria-selected={activeTab === tab.id}
                aria-controls="panel-{tab.id}"
                class="flex-1 px-3 py-2 text-sm font-medium capitalize transition-colors
                       {activeTab === tab.id
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'}"
                on:click={() => (activeTab = tab.id)}
              >
                {tab.label}
              </button>
            {/each}
          </div>

          <div class="flex-1 overflow-y-auto p-4 scrollbar-thin">
            <!-- Curve Tab -->
            <div
              id="panel-curve"
              role="tabpanel"
              aria-labelledby="tab-curve"
              hidden={activeTab !== 'curve'}
            >
              {#if activeTab === 'curve'}
                <div class="space-y-6">
                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Curve Family</legend>
                    <label for="curve-family" class="sr-only">Select curve family</label>
                    <select
                      id="curve-family"
                      class="input"
                      value={$params.family}
                      on:change={handleFamilyChange}
                    >
                      {#each CURVE_FAMILIES as family}
                        <option value={family.value}>{family.label}</option>
                      {/each}
                    </select>
                  </fieldset>

                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Parameters</legend>
                    <div class="space-y-3">
                      <div>
                        <label for="param-R" class="block text-xs text-gray-500">
                          R (Outer Radius): {$params.R}
                        </label>
                        <input
                          id="param-R"
                          type="range"
                          class="w-full"
                          min="10"
                          max="450"
                          value={$params.R}
                          on:input={(e) => updateParam('R', +e.currentTarget.value)}
                          aria-valuemin="10"
                          aria-valuemax="450"
                          aria-valuenow={$params.R}
                        />
                      </div>
                      <div>
                        <label for="param-r" class="block text-xs text-gray-500">
                          r (Inner Radius): {$params.r}
                        </label>
                        <input
                          id="param-r"
                          type="range"
                          class="w-full"
                          min="5"
                          max="300"
                          value={$params.r}
                          on:input={(e) => updateParam('r', +e.currentTarget.value)}
                          aria-valuemin="5"
                          aria-valuemax="300"
                          aria-valuenow={$params.r}
                        />
                      </div>
                      <div>
                        <label for="param-d" class="block text-xs text-gray-500">
                          d (Pen Offset): {$params.d}
                        </label>
                        <input
                          id="param-d"
                          type="range"
                          class="w-full"
                          min="0"
                          max="320"
                          value={$params.d}
                          on:input={(e) => updateParam('d', +e.currentTarget.value)}
                          aria-valuemin="0"
                          aria-valuemax="320"
                          aria-valuenow={$params.d}
                        />
                      </div>
                      <div>
                        <label for="param-k" class="block text-xs text-gray-500">
                          k (Frequency): {$params.k}
                        </label>
                        <input
                          id="param-k"
                          type="range"
                          class="w-full"
                          min="1"
                          max="80"
                          value={$params.k}
                          on:input={(e) => updateParam('k', +e.currentTarget.value)}
                          aria-valuemin="1"
                          aria-valuemax="80"
                          aria-valuenow={$params.k}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Symmetry</legend>
                    <div>
                      <label for="param-symmetry" class="block text-xs text-gray-500">
                        Rotational: {$params.symmetry}
                      </label>
                      <input
                        id="param-symmetry"
                        type="range"
                        class="w-full"
                        min="1"
                        max="24"
                        value={$params.symmetry}
                        on:input={(e) => updateParam('symmetry', +e.currentTarget.value)}
                        aria-valuemin="1"
                        aria-valuemax="24"
                        aria-valuenow={$params.symmetry}
                      />
                    </div>
                    <div class="mt-3 space-y-2">
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={$params.reflectH}
                          on:change={(e) => updateParam('reflectH', e.currentTarget.checked)}
                        />
                        <span>Horizontal Reflection</span>
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={$params.reflectV}
                          on:change={(e) => updateParam('reflectV', e.currentTarget.checked)}
                        />
                        <span>Vertical Reflection</span>
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={$params.kaleidoscope}
                          on:change={(e) => updateParam('kaleidoscope', e.currentTarget.checked)}
                        />
                        <span>Kaleidoscope Mode</span>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Presets</legend>
                    <div class="grid grid-cols-3 gap-2" role="group" aria-label="Pattern presets">
                      {#each PRESET_PATTERNS as preset}
                        <button
                          class="aspect-square rounded-lg p-2 text-xs font-medium text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                          style="background: linear-gradient(135deg, {preset.gradient[0]}, {preset.gradient[1]})"
                          on:click={() => handlePreset(preset)}
                          aria-label="Apply {preset.name} preset"
                        >
                          {preset.name}
                        </button>
                      {/each}
                    </div>
                  </fieldset>
                </div>
              {/if}
            </div>

            <!-- Style Tab -->
            <div
              id="panel-style"
              role="tabpanel"
              aria-labelledby="tab-style"
              hidden={activeTab !== 'style'}
            >
              {#if activeTab === 'style'}
                <div class="space-y-6">
                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Colors</legend>
                    <div class="space-y-3">
                      <div>
                        <label for="color-bg" class="block text-xs text-gray-500">Background</label>
                        <input
                          id="color-bg"
                          type="color"
                          class="mt-1 h-10 w-full rounded-lg"
                          value={$params.bgColor}
                          on:input={(e) => updateParam('bgColor', e.currentTarget.value)}
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label for="color-start" class="block text-xs text-gray-500">Start Color</label>
                          <input
                            id="color-start"
                            type="color"
                            class="mt-1 h-10 w-full rounded-lg"
                            value={$params.startColor}
                            on:input={(e) => updateParam('startColor', e.currentTarget.value)}
                          />
                        </div>
                        <div>
                          <label for="color-end" class="block text-xs text-gray-500">End Color</label>
                          <input
                            id="color-end"
                            type="color"
                            class="mt-1 h-10 w-full rounded-lg"
                            value={$params.endColor}
                            on:input={(e) => updateParam('endColor', e.currentTarget.value)}
                          />
                        </div>
                      </div>
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={$params.useGradient}
                          on:change={(e) => updateParam('useGradient', e.currentTarget.checked)}
                        />
                        <span>Use Gradient</span>
                      </label>
                    </div>
                  </fieldset>

                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Stroke</legend>
                    <div>
                      <label for="stroke-width" class="block text-xs text-gray-500">
                        Width: {$params.lw.toFixed(1)}
                      </label>
                      <input
                        id="stroke-width"
                        type="range"
                        class="w-full"
                        min="0.1"
                        max="8"
                        step="0.1"
                        value={$params.lw}
                        on:input={(e) => updateParam('lw', +e.currentTarget.value)}
                        aria-valuemin="0.1"
                        aria-valuemax="8"
                        aria-valuenow={$params.lw}
                      />
                    </div>
                    <label class="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={$params.dashed}
                        on:change={(e) => updateParam('dashed', e.currentTarget.checked)}
                      />
                      <span>Dashed Lines</span>
                    </label>
                  </fieldset>

                  <fieldset class="panel">
                    <legend class="mb-3 text-sm font-semibold">Effects</legend>
                    <div>
                      <label for="effect-glow" class="block text-xs text-gray-500">
                        Glow: {$params.glow}
                      </label>
                      <input
                        id="effect-glow"
                        type="range"
                        class="w-full"
                        min="0"
                        max="20"
                        value={$params.glow}
                        on:input={(e) => updateParam('glow', +e.currentTarget.value)}
                        aria-valuemin="0"
                        aria-valuemax="20"
                        aria-valuenow={$params.glow}
                      />
                    </div>
                    <label class="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={$params.vignette}
                        on:change={(e) => updateParam('vignette', e.currentTarget.checked)}
                      />
                      <span>Paper Vignette</span>
                    </label>
                  </fieldset>
                </div>
              {/if}
            </div>

            <!-- Export Tab -->
            <div
              id="panel-export"
              role="tabpanel"
              aria-labelledby="tab-export"
              hidden={activeTab !== 'export'}
            >
              {#if activeTab === 'export'}
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-3" role="group" aria-label="Export formats">
                    <button
                      class="btn btn-primary flex-col gap-1 py-4"
                      on:click={exportSVG}
                      aria-label="Export as SVG vector file"
                    >
                      <span class="text-xl" aria-hidden="true">🖼️</span>
                      <span>SVG</span>
                      <span class="text-xs opacity-75">Vector</span>
                    </button>
                    <button
                      class="btn btn-secondary flex-col gap-1 py-4"
                      on:click={exportPNG}
                      aria-label="Export as PNG image"
                    >
                      <span class="text-xl" aria-hidden="true">📸</span>
                      <span>PNG</span>
                      <span class="text-xs opacity-75">Raster</span>
                    </button>
                    <button
                      class="btn btn-secondary flex-col gap-1 py-4 {!$advancedExportEnabled ? 'opacity-50' : ''}"
                      disabled={!$advancedExportEnabled}
                      aria-label="Export as PDF{!$advancedExportEnabled ? ' (Pro feature)' : ''}"
                      aria-disabled={!$advancedExportEnabled}
                    >
                      <span class="text-xl" aria-hidden="true">📄</span>
                      <span>PDF</span>
                      <span class="text-xs opacity-75">{$advancedExportEnabled ? 'Print Ready' : 'Pro Only'}</span>
                    </button>
                    <button
                      class="btn btn-secondary flex-col gap-1 py-4 {!$advancedExportEnabled ? 'opacity-50' : ''}"
                      disabled={!$advancedExportEnabled}
                      aria-label="Export as DXF for CNC/Laser{!$advancedExportEnabled ? ' (Pro feature)' : ''}"
                      aria-disabled={!$advancedExportEnabled}
                    >
                      <span class="text-xl" aria-hidden="true">✏️</span>
                      <span>DXF</span>
                      <span class="text-xs opacity-75">{$advancedExportEnabled ? 'CNC/Laser' : 'Pro Only'}</span>
                    </button>
                  </div>

                  {#if !$advancedExportEnabled}
                    <div
                      class="rounded-xl bg-primary-50 p-4 dark:bg-primary-900/20"
                      role="region"
                      aria-label="Upgrade promotion"
                    >
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
              {/if}
            </div>

            <!-- AI Tab -->
            <div
              id="panel-ai"
              role="tabpanel"
              aria-labelledby="tab-ai"
              hidden={activeTab !== 'ai'}
            >
              {#if activeTab === 'ai'}
                <div class="space-y-4">
                  {#if $aiSuggestionsEnabled}
                    <AIAssistant
                      on:apply={handleAIApply}
                      on:applyFull={handleAIApplyFull}
                    />
                  {:else}
                    <div
                      class="rounded-xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 p-6 border border-indigo-700/50"
                      role="region"
                      aria-label="AI Assistant upgrade promotion"
                    >
                      <div class="flex items-center gap-3 mb-4">
                        <div class="p-2 rounded-full bg-indigo-600/30" aria-hidden="true">
                          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white">AI Assistant</h3>
                      </div>
                      <p class="text-gray-300 text-sm mb-4">
                        Unlock powerful AI features to enhance your creative workflow:
                      </p>
                      <ul class="space-y-2 text-sm text-gray-400 mb-6" aria-label="AI features">
                        <li class="flex items-center gap-2">
                          <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Style Keywords - Generate patterns from descriptive words</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Image Analysis - Upload photos to extract parameters</span>
                        </li>
                        <li class="flex items-center gap-2">
                          <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Text Prompts - Describe your vision in natural language</span>
                        </li>
                      </ul>
                      <a
                        href="/pricing"
                        class="block w-full py-2 bg-indigo-600 text-white text-center rounded-lg font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Upgrade to Pro
                      </a>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Layers Tab -->
            <div
              id="panel-layers"
              role="tabpanel"
              aria-labelledby="tab-layers"
              hidden={activeTab !== 'layers'}
            >
              {#if activeTab === 'layers'}
                <div class="space-y-4">
                  <p class="text-sm text-gray-500">
                    Multi-layer support coming soon! Create complex patterns with multiple overlapping curves.
                  </p>
                </div>
              {/if}
            </div>
          </div>

          <!-- Reset Button -->
          <div class="border-t border-gray-200 p-4 dark:border-gray-800">
            <button
              class="btn btn-secondary w-full"
              on:click={resetParams}
              aria-label="Reset all parameters to default values"
            >
              <span aria-hidden="true">↺</span>
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>
      {/if}
    </aside>

    <!-- Canvas Stage -->
    <main
      id="main-content"
      class="relative flex-1 bg-gray-200 dark:bg-gray-800"
      aria-label="Pattern canvas"
    >
      <canvas
        bind:this={canvas}
        class="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        on:wheel={handleWheel}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        on:dblclick={handleDoubleClick}
        aria-label="Interactive guilloche pattern preview. Use mouse wheel to zoom, drag to pan, double-click to reset view."
        tabindex="0"
      />

      <!-- Hint Bar -->
      <div
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white/90 px-6 py-2 text-sm text-gray-600 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-400"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">Canvas controls: </span>
        <span aria-hidden="true">🖱️</span> Wheel: Zoom | Drag: Pan | Double-click: Reset | ⌘Z: Undo
      </div>
    </main>
  </div>
</div>
