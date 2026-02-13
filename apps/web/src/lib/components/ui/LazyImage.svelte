<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let src: string;
  export let alt: string;
  export let width: number | undefined = undefined;
  export let height: number | undefined = undefined;
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let decoding: 'async' | 'auto' | 'sync' = 'async';
  export let placeholder: string | undefined = undefined;
  export let threshold: number = 0.1; // Intersection observer threshold
  export let rootMargin: string = '50px'; // Start loading before visible

  let imgElement: HTMLImageElement;
  let loaded = false;
  let error = false;
  let inView = false;

  // Use a tiny transparent placeholder by default
  const defaultPlaceholder =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const placeholderSrc = placeholder || defaultPlaceholder;

  $: actualSrc = loading === 'eager' || inView ? src : placeholderSrc;

  onMount(() => {
    if (!browser || loading === 'eager') {
      inView = true;
      return;
    }

    // Use native lazy loading if available and simple lazy behavior
    if ('loading' in HTMLImageElement.prototype && !placeholder) {
      inView = true;
      return;
    }

    // Fallback to Intersection Observer for custom behavior
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              inView = true;
              observer.disconnect();
            }
          });
        },
        {
          rootMargin,
          threshold,
        }
      );

      observer.observe(imgElement);

      return () => {
        observer.disconnect();
      };
    } else {
      // Fallback for browsers without IntersectionObserver
      inView = true;
    }
  });

  function handleLoad() {
    loaded = true;
    error = false;
  }

  function handleError() {
    error = true;
    loaded = false;
  }
</script>

<img
  bind:this={imgElement}
  src={actualSrc}
  {alt}
  {width}
  {height}
  loading={loading === 'eager' ? 'eager' : 'lazy'}
  {decoding}
  class="lazy-image {$$props.class || ''}"
  class:lazy-image--loading={!loaded && inView && actualSrc === src}
  class:lazy-image--loaded={loaded}
  class:lazy-image--error={error}
  on:load={handleLoad}
  on:error={handleError}
  {...$$restProps}
/>

<style>
  .lazy-image {
    transition: opacity 0.3s ease-in-out;
  }

  .lazy-image--loading {
    opacity: 0.5;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .lazy-image--loaded {
    opacity: 1;
  }

  .lazy-image--error {
    opacity: 0.3;
    filter: grayscale(100%);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Dark mode support */
  :global(.dark) .lazy-image--loading {
    background: linear-gradient(90deg, #2d2d2d 25%, #3d3d3d 50%, #2d2d2d 75%);
    background-size: 200% 100%;
  }
</style>
