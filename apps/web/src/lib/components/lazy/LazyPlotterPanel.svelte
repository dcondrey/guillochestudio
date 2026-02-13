<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { ComponentType } from 'svelte';
  import LoadingSpinner from '../ui/LoadingSpinner.svelte';

  // Forward all props that PlotterPanel accepts
  export let svgContent: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let PlotterPanel: ComponentType | null = null;
  let loading = true;
  let error: Error | null = null;

  onMount(async () => {
    try {
      const module = await import('../plotter/PlotterPanel.svelte');
      PlotterPanel = module.default;
    } catch (e) {
      error = e instanceof Error ? e : new Error('Failed to load Plotter Panel');
      console.error('Failed to load Plotter Panel:', e);
    } finally {
      loading = false;
    }
  });

  function handleClose() {
    dispatch('close');
  }
</script>

{#if loading}
  <div class="flex flex-col items-center justify-center p-12 bg-gray-900 rounded-lg">
    <LoadingSpinner />
    <span class="mt-3 text-sm text-gray-400">Loading Plotter Panel...</span>
    <p class="mt-1 text-xs text-gray-500">Connecting to pen plotter</p>
  </div>
{:else if error}
  <div class="p-6 bg-red-900/30 border border-red-700 rounded-lg">
    <div class="flex items-center gap-3 mb-3">
      <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p class="font-medium text-red-400">Failed to load Plotter Panel</p>
    </div>
    <p class="text-sm text-red-300">{error.message}</p>
    <div class="flex gap-2 mt-4">
      <button
        class="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        on:click={handleClose}
      >
        Close
      </button>
      <button
        class="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
        on:click={() => window.location.reload()}
      >
        Reload Page
      </button>
    </div>
  </div>
{:else if PlotterPanel}
  <svelte:component this={PlotterPanel} {svgContent} on:close={handleClose} />
{/if}
