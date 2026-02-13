<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import {
    PLOTTER_PRESETS,
    MATERIAL_PRESETS,
    optimizePaths,
    patternToPathSegments,
    generateHPGL,
    PlotterConnection,
    renderPathPreview,
    type PlotterConfig,
    type MaterialPreset,
    type OptimizationResult,
    type PlotterStatus,
  } from '$lib/services/plotter';

  export let svgContent: string;
  export let width: number = 297; // Default A4
  export let height: number = 210;

  const dispatch = createEventDispatcher<{
    export: { format: 'hpgl' | 'svg'; content: string };
    close: void;
  }>();

  let selectedPlotter = 'axidraw-v3';
  let selectedMaterial = 'standard-paper';
  let customConfig: PlotterConfig | null = null;
  let showCustomSettings = false;

  let optimizationResult: OptimizationResult | null = null;
  let isOptimizing = false;
  let previewCanvas: HTMLCanvasElement;
  let showTravelPaths = true;

  let plotterConnection: PlotterConnection | null = null;
  let plotterStatus: PlotterStatus | null = null;
  let isConnecting = false;

  $: currentConfig = customConfig ?? PLOTTER_PRESETS[selectedPlotter];
  $: currentMaterial =
    MATERIAL_PRESETS.find((m) => m.id === selectedMaterial) ?? MATERIAL_PRESETS[0];

  onMount(() => {
    optimize();
  });

  onDestroy(() => {
    plotterConnection?.disconnect();
  });

  async function optimize(): Promise<void> {
    isOptimizing = true;

    try {
      // Parse SVG to path segments
      const scale = Math.min(currentConfig.maxWidth / width, currentConfig.maxHeight / height);
      const paths = patternToPathSegments(svgContent, scale);

      // Optimize paths
      optimizationResult = optimizePaths(paths, currentConfig, {
        groupByColor: true,
        useReversal: true,
        use2Opt: true,
      });

      // Render preview
      requestAnimationFrame(() => {
        if (previewCanvas && optimizationResult) {
          previewCanvas.width = currentConfig.maxWidth;
          previewCanvas.height = currentConfig.maxHeight;
          renderPathPreview(previewCanvas, optimizationResult, {
            showDrawPaths: true,
            showTravelPaths,
            travelColor: '#ff6b6b',
            backgroundColor: '#1a1a2e',
            scale: 1,
          });
        }
      });
    } finally {
      isOptimizing = false;
    }
  }

  function handleStatusChange(status: PlotterStatus): void {
    plotterStatus = status;
  }

  async function connectPlotter(): Promise<void> {
    isConnecting = true;

    try {
      plotterConnection = new PlotterConnection(handleStatusChange);
      await plotterConnection.connect();
    } finally {
      isConnecting = false;
    }
  }

  async function disconnectPlotter(): Promise<void> {
    await plotterConnection?.disconnect();
    plotterConnection = null;
    plotterStatus = null;
  }

  async function startPlotting(): Promise<void> {
    if (!plotterConnection || !optimizationResult) return;

    await plotterConnection.plot(optimizationResult.paths, currentConfig, currentMaterial);
  }

  function pausePlotting(): void {
    plotterConnection?.pause();
  }

  function resumePlotting(): void {
    plotterConnection?.resume();
  }

  function abortPlotting(): void {
    plotterConnection?.abort();
  }

  function exportHPGL(): void {
    if (!optimizationResult) return;

    const hpgl = generateHPGL(optimizationResult.paths, currentConfig, currentMaterial);
    dispatch('export', { format: 'hpgl', content: hpgl });
  }

  function downloadHPGL(): void {
    if (!optimizationResult) return;

    const hpgl = generateHPGL(optimizationResult.paths, currentConfig, currentMaterial);
    const blob = new Blob([hpgl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guilloche-pattern.hpgl';
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDistance(mm: number): string {
    if (mm > 1000) {
      return `${(mm / 1000).toFixed(2)} m`;
    }
    return `${mm.toFixed(1)} mm`;
  }
</script>

<div class="plotter-panel bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
  <!-- Header -->
  <div class="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
    <h2 class="text-white font-semibold flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
        />
      </svg>
      Pen Plotter
    </h2>
    <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-white">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  <div class="p-4 space-y-6">
    <!-- Plotter Selection -->
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-300">Plotter Model</label>
      <select
        bind:value={selectedPlotter}
        on:change={optimize}
        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
      >
        {#each Object.entries(PLOTTER_PRESETS) as [key, config]}
          <option value={key}>{config.name}</option>
        {/each}
      </select>

      {#if selectedPlotter === 'custom'}
        <button
          on:click={() => (showCustomSettings = !showCustomSettings)}
          class="text-sm text-indigo-400 hover:text-indigo-300"
        >
          {showCustomSettings ? 'Hide' : 'Show'} custom settings
        </button>
      {/if}
    </div>

    <!-- Material Selection -->
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-300">Material</label>
      <select
        bind:value={selectedMaterial}
        class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
      >
        {#each MATERIAL_PRESETS as preset}
          <option value={preset.id}>{preset.name}</option>
        {/each}
      </select>
      <p class="text-xs text-gray-500">{currentMaterial.description}</p>
      <div class="flex gap-4 text-xs text-gray-400">
        <span>Speed: {currentMaterial.speed}%</span>
        <span>Passes: {currentMaterial.passes}</span>
      </div>
    </div>

    <!-- Preview Canvas -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-300">Path Preview</label>
        <label class="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            bind:checked={showTravelPaths}
            on:change={optimize}
            class="rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
          />
          Show travel
        </label>
      </div>
      <div class="border border-gray-700 rounded overflow-hidden bg-gray-950">
        <canvas bind:this={previewCanvas} class="w-full" style="max-height: 300px;"></canvas>
      </div>
    </div>

    <!-- Optimization Stats -->
    {#if optimizationResult && !isOptimizing}
      <div class="grid grid-cols-2 gap-4 p-4 bg-gray-800 rounded-lg">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Original Travel</p>
          <p class="text-lg font-semibold text-gray-300">
            {formatDistance(optimizationResult.originalDistance)}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Optimized Travel</p>
          <p class="text-lg font-semibold text-green-400">
            {formatDistance(optimizationResult.optimizedDistance)}
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Savings</p>
          <p class="text-lg font-semibold text-indigo-400">
            {optimizationResult.savings.toFixed(1)}%
          </p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Est. Time</p>
          <p class="text-lg font-semibold text-gray-300">
            {formatTime(optimizationResult.estimatedTime)}
          </p>
        </div>
      </div>
    {:else if isOptimizing}
      <div class="flex items-center justify-center p-8">
        <div
          class="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
        ></div>
        <span class="ml-3 text-gray-400">Optimizing paths...</span>
      </div>
    {/if}

    <!-- Connection Section -->
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-300">Direct Connection</label>

      {#if !plotterStatus?.connected}
        <button
          on:click={connectPlotter}
          disabled={isConnecting}
          class="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {#if isConnecting}
            <div
              class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"
            ></div>
            Connecting...
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Connect Plotter
          {/if}
        </button>
        <p class="text-xs text-gray-500 text-center">
          Uses Web Serial API. Supported in Chrome and Edge.
        </p>
      {:else}
        <!-- Connected State -->
        <div class="p-4 bg-gray-800 rounded-lg space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <span class="text-sm text-white">Connected</span>
            </div>
            <button on:click={disconnectPlotter} class="text-sm text-red-400 hover:text-red-300">
              Disconnect
            </button>
          </div>

          {#if plotterStatus?.plotting}
            <!-- Plotting Progress -->
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-gray-400">
                  Path {plotterStatus.currentPath}/{plotterStatus.totalPaths}
                </span>
                <span class="text-white">{plotterStatus.progress.toFixed(1)}%</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div
                  class="bg-indigo-500 h-2 rounded-full transition-all"
                  style="width: {plotterStatus.progress}%"
                ></div>
              </div>
              <div class="flex gap-2">
                {#if plotterStatus.paused}
                  <button
                    on:click={resumePlotting}
                    class="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Resume
                  </button>
                {:else}
                  <button
                    on:click={pausePlotting}
                    class="flex-1 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  >
                    Pause
                  </button>
                {/if}
                <button
                  on:click={abortPlotting}
                  class="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          {:else}
            <!-- Start Plotting -->
            <button
              on:click={startPlotting}
              disabled={!optimizationResult}
              class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-lg font-medium"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Start Plotting
            </button>
          {/if}

          {#if plotterStatus?.error}
            <div class="p-2 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
              {plotterStatus.error}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Export Buttons -->
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-300">Export</label>
      <div class="grid grid-cols-2 gap-3">
        <button
          on:click={downloadHPGL}
          disabled={!optimizationResult}
          class="py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          HPGL
        </button>
        <button
          on:click={() => dispatch('export', { format: 'svg', content: svgContent })}
          class="py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          SVG
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .plotter-panel {
    width: 400px;
    max-height: 90vh;
    overflow-y: auto;
  }
</style>
