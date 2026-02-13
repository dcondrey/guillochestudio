<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $: status = $page.status;
  $: message = $page.error?.message || 'Something went wrong';

  const errorMessages: Record<number, { title: string; description: string; action: string }> = {
    400: {
      title: 'Bad Request',
      description: 'The request was malformed or invalid.',
      action: 'Check your input and try again.'
    },
    401: {
      title: 'Unauthorized',
      description: 'You need to sign in to access this page.',
      action: 'Please sign in to continue.'
    },
    403: {
      title: 'Forbidden',
      description: "You don't have permission to access this resource.",
      action: 'Contact support if you believe this is an error.'
    },
    404: {
      title: 'Page Not Found',
      description: "The page you're looking for doesn't exist or has been moved.",
      action: 'Check the URL or navigate back home.'
    },
    429: {
      title: 'Too Many Requests',
      description: "You've made too many requests. Please slow down.",
      action: 'Wait a moment before trying again.'
    },
    500: {
      title: 'Server Error',
      description: 'Something went wrong on our end.',
      action: "We've been notified and are working on it."
    },
    502: {
      title: 'Bad Gateway',
      description: 'Our servers are temporarily unavailable.',
      action: 'Please try again in a few moments.'
    },
    503: {
      title: 'Service Unavailable',
      description: "We're performing maintenance or experiencing high load.",
      action: 'Please check back shortly.'
    }
  };

  $: error = errorMessages[status] || {
    title: 'Error',
    description: message,
    action: 'Please try again or contact support.'
  };

  function goBack() {
    if (browser) {
      window.history.back();
    }
  }

  function reportError() {
    if (browser && 'Sentry' in window) {
      // @ts-expect-error Sentry may not be available on window
      window.Sentry.captureMessage(`User reported error: ${status} - ${message}`);
    }
  }
</script>

<svelte:head>
  <title>{status} - {error.title} | Guilloche Studio</title>
  <meta name="description" content="{error.title}: {error.description}" />
  <meta name="robots" content="noindex" />
</svelte:head>

<main
  id="main-content"
  class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4"
  aria-labelledby="error-heading"
>
  <div class="max-w-lg w-full text-center">
    <!-- Animated Guilloché Pattern -->
    <figure class="relative w-48 h-48 mx-auto mb-8" aria-hidden="true">
      <svg
        viewBox="0 0 200 200"
        class="w-full h-full animate-spin-slow"
        role="presentation"
      >
        <defs>
          <linearGradient id="errorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ef4444" />
            <stop offset="50%" style="stop-color:#f97316" />
            <stop offset="100%" style="stop-color:#eab308" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#errorGradient)" stroke-width="0.5" opacity="0.8">
          {#each Array(12) as _, i}
            <ellipse
              cx="100"
              cy="100"
              rx={80 - i * 5}
              ry={40 - i * 2}
              transform="rotate({i * 15} 100 100)"
            />
          {/each}
        </g>
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-6xl font-bold text-white" aria-hidden="true">{status}</span>
      </div>
    </figure>

    <!-- Error Content -->
    <header>
      <p class="sr-only">Error {status}</p>
      <h1 id="error-heading" class="text-3xl font-bold text-white mb-2">
        {error.title}
      </h1>
    </header>

    <p class="text-gray-400 mb-2">{error.description}</p>
    <p class="text-gray-500 text-sm mb-8">{error.action}</p>

    <!-- Actions -->
    <nav
      class="flex flex-col sm:flex-row gap-3 justify-center"
      aria-label="Error recovery options"
    >
      <button
        on:click={goBack}
        type="button"
        class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        aria-label="Go back to previous page"
      >
        <span aria-hidden="true">←</span>
        Go Back
      </button>
      <a
        href="/"
        class="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        <span aria-hidden="true">🏠</span>
        Go Home
      </a>
      <a
        href="/studio"
        class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        <span aria-hidden="true">🎨</span>
        Open Studio
      </a>
    </nav>

    <!-- Report Link -->
    {#if status >= 500}
      <div class="mt-6">
        <button
          on:click={reportError}
          type="button"
          class="text-sm text-gray-500 hover:text-gray-400 underline focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded"
          aria-describedby="report-description"
        >
          Report this issue
        </button>
        <p id="report-description" class="sr-only">
          Send an error report to our support team
        </p>
      </div>
    {/if}

    <!-- Technical Details (collapsible) -->
    {#if browser && status >= 500}
      <details class="mt-8 text-left">
        <summary class="text-gray-500 cursor-pointer hover:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 rounded">
          Technical Details
        </summary>
        <div
          class="mt-2 p-4 bg-gray-800 rounded-lg text-xs text-gray-400 overflow-x-auto"
          role="region"
          aria-label="Technical error details"
        >
          <dl class="space-y-1">
            <div class="flex gap-2">
              <dt class="font-medium">Status:</dt>
              <dd>{status}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-medium">Message:</dt>
              <dd>{message}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-medium">URL:</dt>
              <dd>{$page.url.pathname}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="font-medium">Time:</dt>
              <dd><time datetime={new Date().toISOString()}>{new Date().toISOString()}</time></dd>
            </div>
          </dl>
        </div>
      </details>
    {/if}

    <!-- Back to safety link for screen readers -->
    <p class="sr-only">
      <a href="/">Return to Guilloche Studio homepage</a>
    </p>
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
    animation: spin-slow 20s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-spin-slow {
      animation: none;
    }
  }
</style>
