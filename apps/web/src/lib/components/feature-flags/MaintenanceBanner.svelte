<script lang="ts">
  /**
   * Maintenance Banner Component
   *
   * Displays a banner when maintenance mode is enabled.
   * Can be dismissed but will reappear on page reload.
   */

  import { maintenanceModeEnabled } from '$lib/stores/feature-flags';

  let dismissed = false;

  export let message = 'We are currently performing scheduled maintenance. Some features may be temporarily unavailable.';
  export let dismissable = true;

  function dismiss() {
    if (dismissable) {
      dismissed = true;
    }
  }
</script>

{#if $maintenanceModeEnabled && !dismissed}
  <div
    class="maintenance-banner bg-amber-500 text-amber-950 px-4 py-3 relative"
    role="alert"
    aria-live="polite"
  >
    <div class="container mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg
          class="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-sm font-medium">{message}</p>
      </div>

      {#if dismissable}
        <button
          on:click={dismiss}
          class="p-1 hover:bg-amber-600/20 rounded transition-colors"
          aria-label="Dismiss maintenance notice"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}
