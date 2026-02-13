<script lang="ts">
  /**
   * Beta Badge Component
   *
   * Displays a beta badge when beta features are enabled.
   * Can be used to mark experimental features.
   */

  import { betaFeaturesEnabled } from '$lib/stores/feature-flags';

  /** Override the automatic beta detection */
  export let show: boolean | undefined = undefined;

  /** Badge text */
  export let text = 'BETA';

  /** Badge variant */
  export let variant: 'default' | 'small' | 'inline' = 'default';

  $: shouldShow = show !== undefined ? show : $betaFeaturesEnabled;
</script>

{#if shouldShow}
  {#if variant === 'default'}
    <span
      class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
    >
      {text}
    </span>
  {:else if variant === 'small'}
    <span
      class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold tracking-wide rounded bg-purple-600 text-white"
    >
      {text}
    </span>
  {:else if variant === 'inline'}
    <sup class="ml-1 text-[9px] font-bold text-purple-600 dark:text-purple-400">{text}</sup>
  {/if}
{/if}
