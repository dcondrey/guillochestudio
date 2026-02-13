<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    generateAccessibilityReport,
    applyColorBlindSimulation,
    makeAccessible,
    suggestAccessibleAlternative,
    COLOR_BLIND_TYPES,
    type AccessibilityReport,
    type AccessibilityIssue,
    type ColorBlindSimulation,
  } from '$lib/services/accessibility';

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
  export let backgroundColor: string = '#1a1a2e';

  const dispatch = createEventDispatcher<{
    close: void;
    updateSvg: { svg: string };
    updateColors: { colors: Record<string, string> };
  }>();

  let report: AccessibilityReport | null = null;
  let activeTab: 'overview' | 'colors' | 'simulation' | 'fixes' = 'overview';
  let selectedSimulation: ColorBlindSimulation['type'] | null = null;
  let simulatedSvg: string = '';

  // Pattern metadata for making accessible
  let patternTitle = 'Guilloché Pattern';
  let patternDescription = 'A mathematical decorative pattern with intricate curved lines.';

  // Generate report when SVG or background changes
  $: report = generateAccessibilityReport(svgContent, backgroundColor);

  // Update simulation when type changes
  $: simulatedSvg = selectedSimulation
    ? applyColorBlindSimulation(svgContent, selectedSimulation)
    : svgContent;

  function getSeverityColor(severity: AccessibilityIssue['severity']): string {
    switch (severity) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-amber-400';
      case 'info':
        return 'text-blue-400';
    }
  }

  function getSeverityBg(severity: AccessibilityIssue['severity']): string {
    switch (severity) {
      case 'error':
        return 'bg-red-900/30 border-red-700';
      case 'warning':
        return 'bg-amber-900/30 border-amber-700';
      case 'info':
        return 'bg-blue-900/30 border-blue-700';
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-red-400';
  }

  function getLevelBadge(level: string): { color: string; bg: string } {
    switch (level) {
      case 'AAA':
        return { color: 'text-green-400', bg: 'bg-green-900/50' };
      case 'AA':
        return { color: 'text-blue-400', bg: 'bg-blue-900/50' };
      case 'A':
        return { color: 'text-amber-400', bg: 'bg-amber-900/50' };
      default:
        return { color: 'text-red-400', bg: 'bg-red-900/50' };
    }
  }

  function applyAccessibilityFixes(): void {
    const accessibleSvg = makeAccessible(svgContent, patternTitle, patternDescription);
    dispatch('updateSvg', { svg: accessibleSvg });
  }

  function applyColorFix(original: string, suggested: string): void {
    const colorUpdates: Record<string, string> = { [original]: suggested };
    dispatch('updateColors', { colors: colorUpdates });
  }

  // Keyboard navigation for tabs
  const tabOrder: Array<'overview' | 'colors' | 'simulation' | 'fixes'> = [
    'overview',
    'colors',
    'simulation',
    'fixes',
  ];

  function handleTabKeydown(event: KeyboardEvent) {
    const currentIndex = tabOrder.indexOf(activeTab);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeTab = tabOrder[(currentIndex + 1) % tabOrder.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeTab = tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length];
    }
  }
</script>

<div class="accessibility-panel bg-gray-900 rounded-lg overflow-hidden flex flex-col h-full">
  <!-- Header -->
  <div
    class="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between shrink-0"
  >
    <h2 class="text-white font-semibold flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
      Accessibility Checker
    </h2>
    <button
      on:click={() => dispatch('close')}
      class="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
      aria-label="Close accessibility panel"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>

  {#if report}
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Panel -->
      <div class="w-80 border-r border-gray-700 flex flex-col overflow-hidden">
        <!-- Score Card -->
        <div class="p-4 bg-gray-800 border-b border-gray-700 shrink-0">
          <div class="flex items-center justify-between mb-3">
            <span class="text-4xl font-bold {getScoreColor(report.score)}">{report.score}</span>
            <span
              class="px-3 py-1 rounded-full text-sm font-medium {getLevelBadge(report.level)
                .bg} {getLevelBadge(report.level).color}"
            >
              WCAG {report.level}
            </span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2">
            <div
              class="h-2 rounded-full transition-all {report.score >= 90
                ? 'bg-green-500'
                : report.score >= 70
                  ? 'bg-amber-500'
                  : 'bg-red-500'}"
              style="width: {report.score}%"
            ></div>
          </div>
          <div class="mt-3 flex gap-4 text-sm">
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <span class="text-gray-400"
                >{report.issues.filter((i) => i.severity === 'error').length} errors</span
              >
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span class="text-gray-400"
                >{report.issues.filter((i) => i.severity === 'warning').length} warnings</span
              >
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div
          class="flex border-b border-gray-700 shrink-0"
          role="tablist"
          aria-label="Accessibility check categories"
        >
          {#each tabOrder as tab}
            <button
              role="tab"
              id="a11y-tab-{tab}"
              aria-controls="a11y-panel-{tab}"
              aria-selected={activeTab === tab}
              tabindex={activeTab === tab ? 0 : -1}
              class="flex-1 px-2 py-2 text-xs font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
              class:text-indigo-400={activeTab === tab}
              class:bg-gray-800={activeTab === tab}
              class:text-gray-400={activeTab !== tab}
              on:click={() => (activeTab = tab)}
              on:keydown={handleTabKeydown}
            >
              {tab}
            </button>
          {/each}
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {#if activeTab === 'overview'}
            <div role="tabpanel" id="a11y-panel-overview" aria-labelledby="a11y-tab-overview">
              <!-- Issues List -->
              {#if report.issues.length === 0}
                <div class="text-center py-8">
                  <svg
                    class="w-12 h-12 mx-auto text-green-500 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p class="text-green-400 font-medium">All checks passed!</p>
                  <p class="text-gray-500 text-sm mt-1">Your pattern meets WCAG AAA standards.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each report.issues as issue}
                    <div class="p-3 rounded border {getSeverityBg(issue.severity)}">
                      <div class="flex items-start gap-2">
                        <span class={getSeverityColor(issue.severity)}>
                          {#if issue.severity === 'error'}
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          {:else if issue.severity === 'warning'}
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          {:else}
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fill-rule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          {/if}
                        </span>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-white">{issue.title}</p>
                          <p class="text-xs text-gray-400 mt-0.5">{issue.wcagCriteria}</p>
                          <p class="text-xs text-gray-500 mt-1">{issue.description}</p>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Passed Checks -->
              {#if report.passedChecks.length > 0}
                <div class="pt-4 border-t border-gray-700">
                  <h3 class="text-sm font-medium text-gray-300 mb-2">Passed Checks</h3>
                  <div class="space-y-1">
                    {#each report.passedChecks as check}
                      <div class="flex items-center gap-2 text-sm text-green-400">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        {check}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else if activeTab === 'colors'}
            <div role="tabpanel" id="a11y-panel-colors" aria-labelledby="a11y-tab-colors">
              <!-- Color Analysis -->
              <div class="space-y-4">
                <h3 class="text-sm font-medium text-gray-300">Color Palette</h3>

                <div class="space-y-3">
                  {#each report.colorAnalysis.contrastPairs as pair}
                    <div class="p-3 bg-gray-800 rounded-lg">
                      <div class="flex items-center gap-3 mb-2">
                        <div
                          class="w-8 h-8 rounded border border-gray-600"
                          style="background-color: {pair.fg.hex}"
                        ></div>
                        <div class="flex-1">
                          <p class="text-sm text-white font-mono">{pair.fg.hex}</p>
                          <p class="text-xs text-gray-500">
                            L: {pair.fg.hsl.l}% | Luminance: {(pair.fg.luminance * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div class="text-right">
                          <span
                            class="text-lg font-semibold {pair.contrast.level === 'fail'
                              ? 'text-red-400'
                              : pair.contrast.level === 'AAA'
                                ? 'text-green-400'
                                : 'text-amber-400'}"
                          >
                            {pair.contrast.ratio.toFixed(2)}:1
                          </span>
                          <p class="text-xs text-gray-500">{pair.contrast.level}</p>
                        </div>
                      </div>

                      {#if pair.contrast.level === 'fail'}
                        <div class="pt-2 border-t border-gray-700">
                          <p class="text-xs text-gray-400 mb-2">Suggested alternative:</p>
                          <div class="flex items-center gap-2">
                            <div
                              class="w-6 h-6 rounded border border-gray-600"
                              style="background-color: {suggestAccessibleAlternative(
                                pair.fg.hex,
                                backgroundColor
                              )}"
                            ></div>
                            <span class="text-xs font-mono text-green-400">
                              {suggestAccessibleAlternative(pair.fg.hex, backgroundColor)}
                            </span>
                            <button
                              on:click={() =>
                                applyColorFix(
                                  pair.fg.hex,
                                  suggestAccessibleAlternative(pair.fg.hex, backgroundColor)
                                )}
                              class="ml-auto text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>

                <!-- Color Blind Safety -->
                <div
                  class="p-3 rounded {report.colorAnalysis.colorBlindSafe
                    ? 'bg-green-900/30 border border-green-700'
                    : 'bg-amber-900/30 border border-amber-700'}"
                >
                  <div class="flex items-center gap-2">
                    {#if report.colorAnalysis.colorBlindSafe}
                      <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="text-sm text-green-400">Color blind safe</span>
                    {:else}
                      <svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fill-rule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span class="text-sm text-amber-400"
                        >Some colors may be hard to distinguish</span
                      >
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {:else if activeTab === 'simulation'}
            <!-- Color Blind Simulation -->
            <div
              role="tabpanel"
              id="a11y-panel-simulation"
              aria-labelledby="a11y-tab-simulation"
              class="space-y-4"
            >
              <h3 class="text-sm font-medium text-gray-300">Color Vision Simulation</h3>
              <p class="text-xs text-gray-500">
                Preview how your pattern appears to users with different types of color vision
                deficiency.
              </p>

              <div class="space-y-2">
                <button
                  class="w-full p-3 rounded text-left transition-colors {selectedSimulation === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
                  on:click={() => (selectedSimulation = null)}
                >
                  <p class="font-medium">Normal Vision</p>
                  <p class="text-xs opacity-70">Original colors</p>
                </button>

                {#each COLOR_BLIND_TYPES as type}
                  <button
                    class="w-full p-3 rounded text-left transition-colors {selectedSimulation ===
                    type.type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
                    on:click={() => (selectedSimulation = type.type)}
                  >
                    <p class="font-medium">{type.name}</p>
                    <p class="text-xs opacity-70">{type.description} ({type.prevalence})</p>
                  </button>
                {/each}
              </div>
            </div>
          {:else if activeTab === 'fixes'}
            <!-- Auto-fixes -->
            <div
              role="tabpanel"
              id="a11y-panel-fixes"
              aria-labelledby="a11y-tab-fixes"
              class="space-y-4"
            >
              <h3 class="text-sm font-medium text-gray-300">Automatic Fixes</h3>

              <!-- Add accessibility metadata -->
              <div class="p-4 bg-gray-800 rounded-lg space-y-3">
                <h4 class="text-sm font-medium text-white">Add Accessibility Metadata</h4>
                <p class="text-xs text-gray-500">Add title and description for screen readers.</p>

                <div>
                  <label class="text-xs text-gray-400">Title</label>
                  <input
                    type="text"
                    bind:value={patternTitle}
                    class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white mt-1"
                  />
                </div>

                <div>
                  <label class="text-xs text-gray-400">Description</label>
                  <textarea
                    bind:value={patternDescription}
                    rows="3"
                    class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white mt-1"
                  ></textarea>
                </div>

                <button
                  on:click={applyAccessibilityFixes}
                  class="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors text-sm"
                >
                  Apply Metadata
                </button>
              </div>

              <!-- Recommendations -->
              {#if report.recommendations.length > 0}
                <div class="space-y-2">
                  <h4 class="text-sm font-medium text-gray-300">Recommendations</h4>
                  {#each report.recommendations as rec}
                    <div class="p-2 bg-gray-800 rounded text-sm text-gray-400">
                      {rec}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="flex-1 flex items-center justify-center bg-gray-950 p-8">
        <div
          class="preview-container max-w-full max-h-full"
          style="background-color: {backgroundColor}"
        >
          {@html sanitizeSvg(simulatedSvg)}
        </div>
      </div>
    </div>
  {:else}
    <div class="flex-1 flex items-center justify-center text-gray-500">
      Loading accessibility report...
    </div>
  {/if}
</div>

<style>
  .accessibility-panel {
    width: 100%;
    height: 100%;
    min-height: 500px;
  }

  .preview-container :global(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }
</style>
