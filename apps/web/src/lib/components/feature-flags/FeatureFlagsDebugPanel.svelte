<script lang="ts">
  /**
   * Feature Flags Debug Panel
   *
   * Development tool for viewing and overriding feature flags.
   * Only visible in development mode.
   */

  import { browser } from '$app/environment';
  import {
    flags,
    evaluatedFlags,
    featureFlagContext,
    featureFlagOverrides,
    enableFlagOverride,
    disableFlagOverride,
    clearFlagOverride,
    clearAllFlagOverrides,
    getAllFlagDefinitions,
    debugFlags,
  } from '$lib/stores/feature-flags';
  import type { FeatureFlagName } from '$lib/services/feature-flags';

  let isOpen = false;
  let filterText = '';

  const allDefinitions = getAllFlagDefinitions();

  $: filteredFlags = Object.entries(allDefinitions).filter(
    ([name, def]) =>
      name.toLowerCase().includes(filterText.toLowerCase()) ||
      def.description.toLowerCase().includes(filterText.toLowerCase())
  );

  function toggleFlag(name: FeatureFlagName) {
    const currentValue = $flags[name];
    const hasOverride = $featureFlagOverrides[name];

    if (hasOverride) {
      // Clear override to use natural evaluation
      clearFlagOverride(name);
    } else if (currentValue) {
      // Disable via override
      disableFlagOverride(name, { reason: 'Debug panel' });
    } else {
      // Enable via override
      enableFlagOverride(name, { reason: 'Debug panel' });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Toggle with Ctrl/Cmd + Shift + F
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      isOpen = !isOpen;
    }
    // Close with Escape
    if (event.key === 'Escape' && isOpen) {
      isOpen = false;
    }
  }

  // Only show in development
  const isDev = import.meta.env.DEV;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isDev && browser}
  <!-- Toggle Button -->
  <button
    on:click={() => (isOpen = !isOpen)}
    class="fixed bottom-4 right-4 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
    title="Feature Flags Debug Panel (Ctrl+Shift+F)"
    aria-label="Toggle feature flags debug panel"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  </button>

  <!-- Panel -->
  {#if isOpen}
    <div
      class="fixed inset-y-0 right-0 z-50 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-label="Feature Flags Debug Panel"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h2 class="text-lg font-semibold text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          Feature Flags
        </h2>
        <button
          on:click={() => (isOpen = false)}
          class="p-1 text-gray-400 hover:text-white transition-colors"
          aria-label="Close panel"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Context Info -->
      <div class="px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-400">
        <div class="flex items-center justify-between">
          <span>Env: <strong class="text-gray-300">{$featureFlagContext.environment}</strong></span>
          <span>User: <strong class="text-gray-300">{$featureFlagContext.userId?.slice(0, 8) || 'Anonymous'}</strong></span>
          <span>Tier: <strong class="text-gray-300">{$featureFlagContext.subscriptionTier || 'free'}</strong></span>
        </div>
      </div>

      <!-- Search -->
      <div class="px-4 py-2 border-b border-gray-700">
        <input
          type="text"
          bind:value={filterText}
          placeholder="Filter flags..."
          class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <!-- Flags List -->
      <div class="flex-1 overflow-y-auto">
        {#each filteredFlags as [name, definition]}
          {@const isEnabled = $flags[name]}
          {@const evaluation = $evaluatedFlags[name]}
          {@const hasOverride = !!$featureFlagOverrides[name]}

          <div class="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm text-white">{name}</span>
                  {#if hasOverride}
                    <span class="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-600 text-white rounded">
                      OVERRIDE
                    </span>
                  {/if}
                </div>
                <p class="text-xs text-gray-500 mt-1 truncate">{definition.description}</p>
                <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
                  <span>Source: {evaluation?.source}</span>
                  {#if evaluation?.matchedRule}
                    <span>| {evaluation.matchedRule}</span>
                  {/if}
                </div>
              </div>

              <button
                on:click={() => toggleFlag(flagName)}
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                class:bg-indigo-600={isEnabled}
                class:bg-gray-600={!isEnabled}
                role="switch"
                aria-checked={isEnabled}
                aria-label="Toggle {name}"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  class:translate-x-5={isEnabled}
                  class:translate-x-0={!isEnabled}
                />
              </button>
            </div>

            {#if definition.metadata?.tags}
              <div class="flex gap-1 mt-2">
                {#each definition.metadata.tags as tag}
                  <span class="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-400 rounded">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Footer Actions -->
      <div class="px-4 py-3 bg-gray-800 border-t border-gray-700 flex gap-2">
        <button
          on:click={() => clearAllFlagOverrides()}
          class="flex-1 px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
        >
          Clear All Overrides
        </button>
        <button
          on:click={() => debugFlags()}
          class="px-3 py-2 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          title="Log debug info to console"
        >
          Debug
        </button>
      </div>
    </div>

    <!-- Backdrop -->
    <button
      on:click={() => (isOpen = false)}
      class="fixed inset-0 z-40 bg-black/50"
      aria-label="Close panel"
    />
  {/if}
{/if}
