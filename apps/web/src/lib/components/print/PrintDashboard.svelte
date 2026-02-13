<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    PAPER_SIZES,
    COLOR_PROFILES,
    DEFAULT_PRINT_SETTINGS,
    DEFAULT_TILE_SETTINGS,
    calculatePrintArea,
    calculateTiles,
    generatePrintJob,
    generatePrintSVG,
    downloadSVG,
    downloadPrintJob,
    simulateCMYKPreview,
    rgbToCmyk,
    hexToRgb,
    type PrintSettings,
    type TileSettings,
    type PaperSize,
    type ColorProfile,
    type PrintJob,
  } from '$lib/services/print';

  // Sanitize SVG to prevent XSS attacks
  function sanitizeSvg(svg: string): string {
    if (!svg) return '';
    // Remove potentially dangerous elements and attributes
    return svg
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-blocked-')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, 'data-blocked:')
      .replace(/<iframe/gi, '<blocked-iframe')
      .replace(/<object/gi, '<blocked-object')
      .replace(/<embed/gi, '<blocked-embed')
      .replace(/<foreignObject/gi, '<blocked-foreignObject');
  }

  export let svgContent: string;
  export let patternWidth: number = 400;
  export let patternHeight: number = 400;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let settings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS };
  let tileSettings: TileSettings = { ...DEFAULT_TILE_SETTINGS };

  let activeTab: 'paper' | 'color' | 'marks' | 'tiling' = 'paper';
  let previewSvg: string = '';
  let printJob: PrintJob | null = null;

  // Type-safe tab setter
  function setActiveTab(tab: 'paper' | 'color' | 'marks' | 'tiling'): void {
    activeTab = tab;
  }
  let showCMYKSimulation = false;
  let currentPreviewPage = 1;

  // Custom paper size
  let customWidth = 200;
  let customHeight = 200;

  $: effectivePaperSize = settings.paperSize.id === 'custom'
    ? { ...settings.paperSize, width: customWidth, height: customHeight }
    : settings.paperSize;

  $: printArea = calculatePrintArea({ ...settings, paperSize: effectivePaperSize });

  $: tiles = calculateTiles(patternWidth, patternHeight, { ...settings, paperSize: effectivePaperSize }, tileSettings);

  $: totalPages = tiles.rows * tiles.cols;

  $: {
    // Update preview when settings change
    updatePreview();
  }

  function updatePreview(): void {
    const settingsWithPaper = { ...settings, paperSize: effectivePaperSize };

    // Generate preview for current page
    if (tileSettings.enabled && totalPages > 1) {
      const row = Math.floor((currentPreviewPage - 1) / tiles.cols);
      const col = (currentPreviewPage - 1) % tiles.cols;
      previewSvg = generatePrintSVG(
        svgContent,
        settingsWithPaper,
        currentPreviewPage,
        totalPages,
        { row, col, tileWidth: tiles.tileWidth, tileHeight: tiles.tileHeight }
      );
    } else {
      previewSvg = generatePrintSVG(svgContent, settingsWithPaper, 1, 1);
    }

    // Apply CMYK simulation if enabled
    if (showCMYKSimulation && settings.colorProfile.type === 'cmyk') {
      previewSvg = simulateCMYKPreview(previewSvg);
    }
  }

  function generateJob(): void {
    const settingsWithPaper = { ...settings, paperSize: effectivePaperSize };
    printJob = generatePrintJob(svgContent, patternWidth, patternHeight, settingsWithPaper, tileSettings);
  }

  function handleDownloadSingle(): void {
    downloadSVG(previewSvg, `guilloche-print-page-${currentPreviewPage}.svg`);
  }

  async function handleDownloadAll(): Promise<void> {
    generateJob();
    if (printJob) {
      await downloadPrintJob(printJob);
    }
  }

  function setPaperSize(size: PaperSize): void {
    settings.paperSize = size;
    settings = settings;
  }

  function setColorProfile(profile: ColorProfile): void {
    settings.colorProfile = profile;
    settings = settings;
  }

  function toggleOrientation(): void {
    settings.orientation = settings.orientation === 'portrait' ? 'landscape' : 'portrait';
    settings = settings;
  }

  function formatMM(mm: number): string {
    return `${mm.toFixed(1)}mm`;
  }

  function formatInches(mm: number): string {
    return `${(mm / 25.4).toFixed(2)}"`;
  }
</script>

<div class="print-dashboard bg-gray-900 rounded-lg overflow-hidden flex flex-col h-full">
  <!-- Header -->
  <div class="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0">
    <h2 class="text-white font-semibold flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      Print Production
    </h2>
    <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-white">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Settings Panel -->
    <div class="w-80 border-r border-gray-700 flex flex-col overflow-hidden">
      <!-- Tabs -->
      <div class="flex border-b border-gray-700 shrink-0">
        <button
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize"
          class:text-indigo-400={activeTab === 'paper'}
          class:bg-gray-800={activeTab === 'paper'}
          class:text-gray-400={activeTab !== 'paper'}
          on:click={() => setActiveTab('paper')}
        >
          paper
        </button>
        <button
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize"
          class:text-indigo-400={activeTab === 'color'}
          class:bg-gray-800={activeTab === 'color'}
          class:text-gray-400={activeTab !== 'color'}
          on:click={() => setActiveTab('color')}
        >
          color
        </button>
        <button
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize"
          class:text-indigo-400={activeTab === 'marks'}
          class:bg-gray-800={activeTab === 'marks'}
          class:text-gray-400={activeTab !== 'marks'}
          on:click={() => setActiveTab('marks')}
        >
          marks
        </button>
        <button
          class="flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize"
          class:text-indigo-400={activeTab === 'tiling'}
          class:bg-gray-800={activeTab === 'tiling'}
          class:text-gray-400={activeTab !== 'tiling'}
          on:click={() => setActiveTab('tiling')}
        >
          tiling
        </button>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#if activeTab === 'paper'}
          <!-- Paper Size -->
          <div class="space-y-3">
            <label class="block text-sm font-medium text-gray-300">Paper Size</label>

            <!-- Size categories -->
            <div class="space-y-2">
              <p class="text-xs text-gray-500 uppercase tracking-wider">Standard</p>
              <div class="grid grid-cols-3 gap-2">
                {#each PAPER_SIZES.filter(p => p.category === 'standard') as size}
                  <button
                    class="px-2 py-1.5 text-xs rounded transition-colors"
                    class:bg-indigo-600={settings.paperSize.id === size.id}
                    class:text-white={settings.paperSize.id === size.id}
                    class:bg-gray-700={settings.paperSize.id !== size.id}
                    class:text-gray-300={settings.paperSize.id !== size.id}
                    on:click={() => setPaperSize(size)}
                  >
                    {size.name}
                  </button>
                {/each}
              </div>

              <p class="text-xs text-gray-500 uppercase tracking-wider mt-3">Photo</p>
              <div class="grid grid-cols-3 gap-2">
                {#each PAPER_SIZES.filter(p => p.category === 'photo') as size}
                  <button
                    class="px-2 py-1.5 text-xs rounded transition-colors"
                    class:bg-indigo-600={settings.paperSize.id === size.id}
                    class:text-white={settings.paperSize.id === size.id}
                    class:bg-gray-700={settings.paperSize.id !== size.id}
                    class:text-gray-300={settings.paperSize.id !== size.id}
                    on:click={() => setPaperSize(size)}
                  >
                    {size.name}
                  </button>
                {/each}
              </div>

              <p class="text-xs text-gray-500 uppercase tracking-wider mt-3">Large Format</p>
              <div class="grid grid-cols-3 gap-2">
                {#each PAPER_SIZES.filter(p => p.category === 'large') as size}
                  <button
                    class="px-2 py-1.5 text-xs rounded transition-colors"
                    class:bg-indigo-600={settings.paperSize.id === size.id}
                    class:text-white={settings.paperSize.id === size.id}
                    class:bg-gray-700={settings.paperSize.id !== size.id}
                    class:text-gray-300={settings.paperSize.id !== size.id}
                    on:click={() => setPaperSize(size)}
                  >
                    {size.name}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Custom size -->
            <div class="pt-2 border-t border-gray-700 space-y-2">
              <button
                class="w-full px-2 py-1.5 text-xs rounded transition-colors"
                class:bg-indigo-600={settings.paperSize.id === 'custom'}
                class:text-white={settings.paperSize.id === 'custom'}
                class:bg-gray-700={settings.paperSize.id !== 'custom'}
                class:text-gray-300={settings.paperSize.id !== 'custom'}
                on:click={() => setPaperSize({ id: 'custom', name: 'Custom', width: customWidth, height: customHeight, category: 'custom' })}
              >
                Custom Size
              </button>
              {#if settings.paperSize.id === 'custom'}
                <div class="flex gap-2">
                  <div class="flex-1">
                    <label class="text-xs text-gray-500">Width (mm)</label>
                    <input
                      type="number"
                      bind:value={customWidth}
                      class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="text-xs text-gray-500">Height (mm)</label>
                    <input
                      type="number"
                      bind:value={customHeight}
                      class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    />
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Orientation -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-300">Orientation</label>
            <div class="flex gap-2">
              <button
                class="flex-1 py-2 rounded flex items-center justify-center gap-2 transition-colors"
                class:bg-indigo-600={settings.orientation === 'portrait'}
                class:text-white={settings.orientation === 'portrait'}
                class:bg-gray-700={settings.orientation !== 'portrait'}
                class:text-gray-300={settings.orientation !== 'portrait'}
                on:click={() => { settings.orientation = 'portrait'; settings = settings; }}
              >
                <svg class="w-4 h-6 border border-current rounded-sm" viewBox="0 0 16 24"></svg>
                Portrait
              </button>
              <button
                class="flex-1 py-2 rounded flex items-center justify-center gap-2 transition-colors"
                class:bg-indigo-600={settings.orientation === 'landscape'}
                class:text-white={settings.orientation === 'landscape'}
                class:bg-gray-700={settings.orientation !== 'landscape'}
                class:text-gray-300={settings.orientation !== 'landscape'}
                on:click={() => { settings.orientation = 'landscape'; settings = settings; }}
              >
                <svg class="w-6 h-4 border border-current rounded-sm" viewBox="0 0 24 16"></svg>
                Landscape
              </button>
            </div>
          </div>

          <!-- Margins -->
          <div class="space-y-3">
            <label class="block text-sm font-medium text-gray-300">Margins & Bleed</label>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500">Margin (mm)</label>
                <input
                  type="number"
                  bind:value={settings.margin}
                  min="0"
                  max="50"
                  step="1"
                  class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
              <div>
                <label class="text-xs text-gray-500">Bleed (mm)</label>
                <input
                  type="number"
                  bind:value={settings.bleed}
                  min="0"
                  max="20"
                  step="0.5"
                  class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
          </div>

          <!-- Scale & Fit -->
          <div class="space-y-3">
            <label class="block text-sm font-medium text-gray-300">Scale & Position</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  bind:checked={settings.fitToPage}
                  class="rounded bg-gray-700 border-gray-600 text-indigo-600"
                />
                Fit to page
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  bind:checked={settings.centerOnPage}
                  class="rounded bg-gray-700 border-gray-600 text-indigo-600"
                />
                Center on page
              </label>
            </div>
            {#if !settings.fitToPage}
              <div>
                <label class="text-xs text-gray-500">Scale (%)</label>
                <input
                  type="range"
                  bind:value={settings.scale}
                  min="0.1"
                  max="3"
                  step="0.1"
                  class="w-full"
                />
                <div class="text-xs text-gray-400 text-right">{(settings.scale * 100).toFixed(0)}%</div>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'color'}
          <!-- Color Profile -->
          <div class="space-y-3">
            <label class="block text-sm font-medium text-gray-300">Color Profile</label>
            <div class="space-y-2">
              <p class="text-xs text-gray-500 uppercase tracking-wider">RGB</p>
              {#each COLOR_PROFILES.filter(p => p.type === 'rgb') as profile}
                <button
                  class="w-full p-3 rounded text-left transition-colors"
                  class:bg-indigo-600={settings.colorProfile.id === profile.id}
                  class:bg-gray-800={settings.colorProfile.id !== profile.id}
                  on:click={() => setColorProfile(profile)}
                >
                  <p class="font-medium text-white text-sm">{profile.name}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{profile.description}</p>
                </button>
              {/each}

              <p class="text-xs text-gray-500 uppercase tracking-wider mt-4">CMYK (Print)</p>
              {#each COLOR_PROFILES.filter(p => p.type === 'cmyk') as profile}
                <button
                  class="w-full p-3 rounded text-left transition-colors"
                  class:bg-indigo-600={settings.colorProfile.id === profile.id}
                  class:bg-gray-800={settings.colorProfile.id !== profile.id}
                  on:click={() => setColorProfile(profile)}
                >
                  <p class="font-medium text-white text-sm">{profile.name}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{profile.description}</p>
                </button>
              {/each}
            </div>
          </div>

          <!-- CMYK Simulation -->
          {#if settings.colorProfile.type === 'cmyk'}
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  bind:checked={showCMYKSimulation}
                  on:change={updatePreview}
                  class="rounded bg-gray-700 border-gray-600 text-indigo-600"
                />
                Simulate CMYK gamut
              </label>
              <p class="text-xs text-gray-500">Preview how colors may appear in print (approximate)</p>
            </div>
          {/if}

          <!-- DPI -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-300">Resolution (DPI)</label>
            <select
              bind:value={settings.dpi}
              class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value={72}>72 DPI (Screen)</option>
              <option value={150}>150 DPI (Draft)</option>
              <option value={300}>300 DPI (Standard Print)</option>
              <option value={600}>600 DPI (High Quality)</option>
              <option value={1200}>1200 DPI (Professional)</option>
            </select>
          </div>

        {:else if activeTab === 'marks'}
          <!-- Print Marks -->
          <div class="space-y-4">
            <label class="block text-sm font-medium text-gray-300">Print Marks</label>

            <label class="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <input
                type="checkbox"
                bind:checked={settings.showCropMarks}
                class="rounded bg-gray-700 border-gray-600 text-indigo-600"
              />
              <div>
                <p class="text-sm text-white">Crop Marks</p>
                <p class="text-xs text-gray-500">Show trim lines at corners</p>
              </div>
            </label>

            <label class="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <input
                type="checkbox"
                bind:checked={settings.showRegistrationMarks}
                class="rounded bg-gray-700 border-gray-600 text-indigo-600"
              />
              <div>
                <p class="text-sm text-white">Registration Marks</p>
                <p class="text-xs text-gray-500">Alignment targets for multi-color printing</p>
              </div>
            </label>

            <label class="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <input
                type="checkbox"
                bind:checked={settings.showColorBars}
                class="rounded bg-gray-700 border-gray-600 text-indigo-600"
              />
              <div>
                <p class="text-sm text-white">Color Bars</p>
                <p class="text-xs text-gray-500">Color calibration reference</p>
              </div>
            </label>

            <label class="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <input
                type="checkbox"
                bind:checked={settings.showPageInfo}
                class="rounded bg-gray-700 border-gray-600 text-indigo-600"
              />
              <div>
                <p class="text-sm text-white">Page Information</p>
                <p class="text-xs text-gray-500">Paper size, profile, and page numbers</p>
              </div>
            </label>
          </div>

        {:else if activeTab === 'tiling'}
          <!-- Tiling Settings -->
          <div class="space-y-4">
            <label class="flex items-center gap-3 p-3 bg-gray-800 rounded">
              <input
                type="checkbox"
                bind:checked={tileSettings.enabled}
                class="rounded bg-gray-700 border-gray-600 text-indigo-600"
              />
              <div>
                <p class="text-sm text-white">Enable Tiling</p>
                <p class="text-xs text-gray-500">Split pattern across multiple pages</p>
              </div>
            </label>

            {#if tileSettings.enabled}
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="text-xs text-gray-500">Rows</label>
                    <input
                      type="number"
                      bind:value={tileSettings.rows}
                      min="1"
                      max="10"
                      class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-gray-500">Columns</label>
                    <input
                      type="number"
                      bind:value={tileSettings.cols}
                      min="1"
                      max="10"
                      class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-xs text-gray-500">Overlap (mm)</label>
                  <input
                    type="number"
                    bind:value={tileSettings.overlap}
                    min="0"
                    max="50"
                    step="1"
                    class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>

                <label class="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    bind:checked={tileSettings.showTileNumbers}
                    class="rounded bg-gray-700 border-gray-600 text-indigo-600"
                  />
                  Show tile numbers
                </label>

                <label class="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    bind:checked={tileSettings.showCutLines}
                    class="rounded bg-gray-700 border-gray-600 text-indigo-600"
                  />
                  Show cut lines
                </label>

                <div class="p-3 bg-gray-800 rounded">
                  <p class="text-sm text-gray-400">
                    Total pages: <span class="text-white font-medium">{totalPages}</span>
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    Each tile: {formatMM(tiles.tileWidth)} × {formatMM(tiles.tileHeight)}
                  </p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Preview Panel -->
    <div class="flex-1 flex flex-col bg-gray-950 overflow-hidden">
      <!-- Preview Header -->
      <div class="px-4 py-2 bg-gray-900 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div class="text-sm text-gray-400">
          {formatMM(effectivePaperSize.width)} × {formatMM(effectivePaperSize.height)}
          ({formatInches(effectivePaperSize.width)} × {formatInches(effectivePaperSize.height)})
        </div>
        {#if tileSettings.enabled && totalPages > 1}
          <div class="flex items-center gap-2">
            <button
              on:click={() => currentPreviewPage = Math.max(1, currentPreviewPage - 1)}
              disabled={currentPreviewPage <= 1}
              class="p-1 text-gray-400 hover:text-white disabled:opacity-50"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm text-gray-400">Page {currentPreviewPage} of {totalPages}</span>
            <button
              on:click={() => currentPreviewPage = Math.min(totalPages, currentPreviewPage + 1)}
              disabled={currentPreviewPage >= totalPages}
              class="p-1 text-gray-400 hover:text-white disabled:opacity-50"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        {/if}
      </div>

      <!-- Preview Canvas -->
      <div class="flex-1 p-8 overflow-auto flex items-center justify-center">
        <div
          class="preview-container bg-white shadow-2xl"
          style="aspect-ratio: {printArea.width / printArea.height}; max-width: 90%; max-height: 90%;"
        >
          {@html sanitizeSvg(previewSvg)}
        </div>
      </div>

      <!-- Print Stats -->
      <div class="px-4 py-3 bg-gray-900 border-t border-gray-700 shrink-0">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-400">
            <span>Print area: {formatMM(printArea.artboardWidth)} × {formatMM(printArea.artboardHeight)}</span>
            <span class="mx-2">•</span>
            <span>Bleed: {formatMM(settings.bleed)}</span>
            <span class="mx-2">•</span>
            <span>{settings.dpi} DPI</span>
          </div>
          <div class="flex gap-2">
            <button
              on:click={handleDownloadSingle}
              class="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
            >
              Download Page
            </button>
            <button
              on:click={handleDownloadAll}
              class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All ({totalPages} {totalPages === 1 ? 'page' : 'pages'})
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .print-dashboard {
    width: 100%;
    height: 100%;
    min-height: 600px;
  }

  .preview-container {
    width: auto;
    height: auto;
  }

  .preview-container :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
