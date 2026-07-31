<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  $: status = $page.status;
  $: message = $page.error?.message || 'Something went wrong';

  const errorMessages: Record<number, { title: string; description: string; action: string }> = {
    404: {
      title: 'Not Found',
      description: 'The requested coordinate does not exist in our design space.',
      action: 'Verify the URL or return to home.',
    },
    500: {
      title: 'Engine Failure',
      description: 'The mathematical processor encountered an unexpected state.',
      action: 'Our engineers have been notified.',
    },
  };

  $: error = errorMessages[status] || {
    title: 'Error',
    description: message,
    action: 'Please try again.',
  };

  function goBack() {
    if (browser) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        goto('/');
      }
    }
  }
</script>

<svelte:head>
  <title>{status} | Guilloche Studio</title>
</svelte:head>

<main
  class="min-h-screen bg-white flex items-center justify-center px-6 font-kalice text-gray-900 overflow-hidden"
>
  <!-- Engineering Background -->
  <div
    class="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
    style="background-image: linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px); background-size: 40px 40px;"
  ></div>

  <div class="max-w-xl w-full text-center relative z-10">
    <!-- Sophisticated Layered Animation (The one user likes) -->
    <figure class="relative w-64 h-64 mx-auto mb-12" aria-hidden="true">
      <svg
        viewBox="0 0 200 200"
        class="w-full h-full animate-spin-slow opacity-80 mix-blend-multiply"
      >
        <defs>
          <linearGradient id="errorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e3a8a" />
            <stop offset="100%" style="stop-color:#3b82f6" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#errorGradient)" stroke-width="0.3">
          {#each Array(24) as _, i}
            <ellipse
              cx="100"
              cy="100"
              rx={90 - i * 3}
              ry={45 - i * 1.5}
              transform="rotate({i * 7.5} 100 100)"
            />
          {/each}
        </g>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-7xl font-bold font-sohne-halbfett tracking-tighter text-gray-900"
          >{status}</span
        >
      </div>
    </figure>

    <h1 class="text-3xl font-sohne-halbfett uppercase tracking-[0.2em] mb-4 text-gray-900">
      {error.title}
    </h1>

    <p class="text-xl text-gray-400 font-light mb-12 leading-relaxed italic font-fraunces">
      {error.description}
    </p>

    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <button on:click={goBack} class="btn btn-secondary px-8 py-4 text-[10px]"> ← Back </button>
      <a href="/" class="btn btn-primary px-8 py-4 text-[10px]"> System Home </a>
    </div>
  </div>
</main>

<style>
  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .animate-spin-slow {
    animation: spin-slow 60s linear infinite;
  }
</style>
