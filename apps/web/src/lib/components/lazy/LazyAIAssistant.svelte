<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { ComponentType } from 'svelte';
  import type { PatternParams } from '@guilloche/shared';
  import LoadingSpinner from '../ui/LoadingSpinner.svelte';

  const dispatch = createEventDispatcher<{
    apply: Partial<PatternParams>;
    applyFull: PatternParams;
  }>();

  let AIAssistant: ComponentType | null = null;
  let loading = true;
  let error: Error | null = null;

  onMount(async () => {
    try {
      const module = await import('../ai/AIAssistant.svelte');
      AIAssistant = module.default;
    } catch (e) {
      error = e instanceof Error ? e : new Error('Failed to load AI Assistant');
      console.error('Failed to load AI Assistant:', e);
    } finally {
      loading = false;
    }
  });

  function handleApply(event: CustomEvent<Partial<PatternParams>>) {
    dispatch('apply', event.detail);
  }

  function handleApplyFull(event: CustomEvent<PatternParams>) {
    dispatch('applyFull', event.detail);
  }
</script>

{#if loading}
  <div class="flex items-center justify-center p-8">
    <LoadingSpinner />
    <span class="ml-2 text-sm text-gray-400">Loading AI Assistant...</span>
  </div>
{:else if error}
  <div class="p-4 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
    <p class="font-medium">Failed to load AI Assistant</p>
    <p class="text-xs mt-1">{error.message}</p>
    <button
      class="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
      on:click={() => window.location.reload()}
    >
      Reload Page
    </button>
  </div>
{:else if AIAssistant}
  <svelte:component
    this={AIAssistant}
    on:apply={handleApply}
    on:applyFull={handleApplyFull}
  />
{/if}
