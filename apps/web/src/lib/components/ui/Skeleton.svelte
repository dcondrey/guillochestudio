<script lang="ts">
  /**
   * Skeleton Loading Component
   * Displays animated placeholder content while loading
   */

  export let variant: 'text' | 'circular' | 'rectangular' | 'rounded' = 'text';
  export let width: string = '100%';
  export let height: string = variant === 'text' ? '1em' : '100px';
  export let lines: number = 1;
  export let animated: boolean = true;
  export let ariaLabel: string = 'Loading content';
</script>

{#if lines > 1}
  <div
    class="skeleton-lines"
    style="width: {width}"
    role="status"
    aria-busy="true"
    aria-label={ariaLabel}
  >
    <span class="sr-only">{ariaLabel}</span>
    {#each Array(lines) as _, i}
      <div
        class="skeleton {variant} {animated ? 'animated' : ''}"
        style="height: {height}; width: {i === lines - 1 ? '80%' : '100%'}"
        aria-hidden="true"
      />
    {/each}
  </div>
{:else}
  <div
    class="skeleton {variant} {animated ? 'animated' : ''}"
    style="width: {width}; height: {height}"
    role="status"
    aria-busy="true"
    aria-label={ariaLabel}
  >
    <span class="sr-only">{ariaLabel}</span>
  </div>
{/if}

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 100%
    );
    background-size: 200% 100%;
  }

  .skeleton.animated {
    animation: shimmer 1.5s infinite;
  }

  .skeleton.text {
    border-radius: 4px;
  }

  .skeleton.circular {
    border-radius: 50%;
  }

  .skeleton.rectangular {
    border-radius: 0;
  }

  .skeleton.rounded {
    border-radius: 8px;
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Dark mode adjustments */
  :global(.dark) .skeleton {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
    background-size: 200% 100%;
  }

  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
