<script lang="ts">
  /**
   * Feature Gate Component
   *
   * Conditionally renders content based on feature flag state.
   * Provides slots for both enabled and disabled states.
   */

  import { flags } from '$lib/stores/feature-flags';
  import type { FeatureFlagName } from '$lib/services/feature-flags';

  /** The feature flag to check */
  export let flag: FeatureFlagName;

  /** If true, shows a placeholder when feature is disabled */
  export let showPlaceholder = false;

  /** Custom placeholder message when feature is disabled */
  export let placeholderMessage = 'This feature is coming soon!';

  /** If true, hide content completely when disabled (no fallback slot) */
  export let hideWhenDisabled = false;

  $: isEnabled = $flags[flag] ?? false;
</script>

{#if isEnabled}
  <slot />
{:else if !hideWhenDisabled}
  <slot name="disabled">
    {#if showPlaceholder}
      <div class="feature-placeholder p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span class="text-sm">{placeholderMessage}</span>
        </div>
      </div>
    {/if}
  </slot>
{/if}
