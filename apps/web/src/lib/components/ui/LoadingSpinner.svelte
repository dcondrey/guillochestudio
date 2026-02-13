<script lang="ts">
  /**
   * Loading Spinner Component
   * Animated guilloché-style loading indicator
   */

  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let color: string = 'currentColor';
  export let text: string = '';

  const sizes = {
    sm: 24,
    md: 40,
    lg: 64,
    xl: 96,
  };

  $: pixelSize = sizes[size];
</script>

<div class="spinner-container" class:with-text={!!text} role="status" aria-live="polite">
  <svg
    width={pixelSize}
    height={pixelSize}
    viewBox="0 0 100 100"
    class="spinner"
    aria-hidden="true"
  >
    <title>Loading indicator</title>
    <defs>
      <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color: {color}; stop-opacity: 1" />
        <stop offset="100%" style="stop-color: {color}; stop-opacity: 0.3" />
      </linearGradient>
    </defs>

    <!-- Outer rotating circle -->
    <g class="outer" fill="none" stroke="url(#spinnerGradient)" stroke-width="2">
      <circle cx="50" cy="50" r="45" stroke-dasharray="70 200" />
    </g>

    <!-- Inner counter-rotating pattern -->
    <g class="inner" fill="none" stroke={color} stroke-width="1" opacity="0.5">
      {#each [0, 45, 90, 135] as angle}
        <ellipse cx="50" cy="50" rx="30" ry="15" transform="rotate({angle} 50 50)" />
      {/each}
    </g>

    <!-- Center dot -->
    <circle cx="50" cy="50" r="4" fill={color} />
  </svg>

  {#if text}
    <span class="spinner-text">{text}</span>
  {:else}
    <span class="sr-only">Loading</span>
  {/if}
</div>

<style>
  .spinner-container {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .spinner-container.with-text {
    flex-direction: column;
    gap: 12px;
  }

  .spinner {
    display: block;
  }

  .spinner .outer {
    animation: spin 1.5s linear infinite;
    transform-origin: center;
  }

  .spinner .inner {
    animation: spin-reverse 3s linear infinite;
    transform-origin: center;
  }

  .spinner-text {
    font-size: 14px;
    color: inherit;
    opacity: 0.8;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-reverse {
    from {
      transform: rotate(360deg);
    }
    to {
      transform: rotate(0deg);
    }
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
