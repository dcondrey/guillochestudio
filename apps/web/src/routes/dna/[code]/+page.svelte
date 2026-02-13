<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  let canvas: HTMLCanvasElement;
  let loading = true;
  let error = '';

  onMount(async () => {
    if (!data.pattern) {
      error = 'Pattern not found';
      loading = false;
      return;
    }

    try {
      // Dynamically import the engine to render the pattern
      const { GuillocheEngine } = await import('@guilloche/core');
      const { CanvasRenderer } = await import('@guilloche/core');

      const engine = new GuillocheEngine(data.pattern.parameters);
      const path = engine.computePath();

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const renderer = new CanvasRenderer(ctx, canvas.width, canvas.height);
      renderer.render(path);

      loading = false;
    } catch (err) {
      console.error('Failed to render pattern:', err);
      error = 'Failed to render pattern';
      loading = false;
    }
  });

  function openInStudio() {
    goto(`/studio?dna=${data.code}`);
  }

  function copyDNA() {
    navigator.clipboard.writeText(window.location.href);
  }
</script>

<svelte:head>
  <title>{data.pattern?.name || 'Pattern'} - Guilloché Studio</title>
  <meta name="description" content="View and remix this guilloché pattern" />
  <!-- Open Graph for social sharing -->
  <meta property="og:title" content="{data.pattern?.name || 'Guilloché Pattern'}" />
  <meta property="og:description" content="Created with Guilloché Studio" />
  <meta property="og:type" content="website" />
  {#if data.pattern?.thumbnail_url}
    <meta property="og:image" content={data.pattern.thumbnail_url} />
  {/if}
</svelte:head>

<div class="min-h-screen bg-gray-900 flex flex-col">
  <!-- Header -->
  <header class="bg-gray-800 border-b border-gray-700">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-xl font-bold text-white">
        Guilloché Studio
      </a>
      <div class="flex items-center gap-3">
        <button
          on:click={copyDNA}
          class="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
        >
          Copy Link
        </button>
        <button
          on:click={openInStudio}
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open in Studio
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 flex items-center justify-center p-4">
    {#if error}
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 class="text-2xl font-bold text-white mb-2">Pattern Not Found</h1>
        <p class="text-gray-400 mb-6">This pattern DNA link may be invalid or expired.</p>
        <a
          href="/studio"
          class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Your Own
        </a>
      </div>
    {:else}
      <div class="relative">
        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
            <div class="text-center">
              <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-400">Loading pattern...</p>
            </div>
          </div>
        {/if}

        <canvas
          bind:this={canvas}
          width="800"
          height="800"
          class="rounded-lg shadow-2xl {loading ? 'opacity-0' : 'opacity-100'} transition-opacity"
        ></canvas>
      </div>
    {/if}
  </main>

  <!-- Pattern Info -->
  {#if data.pattern && !error}
    <footer class="bg-gray-800 border-t border-gray-700">
      <div class="max-w-6xl mx-auto px-4 py-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-white">
              {data.pattern.name || 'Untitled Pattern'}
            </h2>
            <p class="text-sm text-gray-400">
              DNA: {data.code}
            </p>
          </div>

          <div class="flex items-center gap-2 text-sm text-gray-400">
            <span class="px-2 py-1 bg-gray-700 rounded">
              {data.pattern.parameters.family || 'hypotrochoid'}
            </span>
            <span class="px-2 py-1 bg-gray-700 rounded">
              {data.pattern.parameters.steps?.toLocaleString() || '10,000'} steps
            </span>
          </div>
        </div>
      </div>
    </footer>
  {/if}
</div>
