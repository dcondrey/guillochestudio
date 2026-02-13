<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import '../app.css';
  import { initializeAuth } from '$lib/stores/auth';
  import { initializeFeatureFlags } from '$lib/stores/feature-flags';
  import { MaintenanceBanner, FeatureFlagsDebugPanel } from '$lib/components/feature-flags';
  import { isLoading as isI18nLoading } from 'svelte-i18n';
  import type { LayoutData } from './$types';

  export let data: LayoutData;

  // Initialize auth state from server
  $: {
    initializeAuth({
      session: data.session,
      user: data.user
    });
  }

  // Initialize feature flags
  onMount(() => {
    initializeFeatureFlags({
      environment: import.meta.env.MODE === 'production'
        ? 'production'
        : import.meta.env.MODE === 'staging'
          ? 'staging'
          : 'development',
    });

    // Listen for auth state changes
    const {
      data: { subscription }
    } = data.supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });

    return () => subscription.unsubscribe();
  });

  // Handle announcements for screen readers
  let announcement = '';
  $: if ($page.url.pathname) {
    // Announce page changes to screen readers
    const pageName = getPageName($page.url.pathname);
    announcement = `Navigated to ${pageName}`;
  }

  function getPageName(pathname: string): string {
    const routes: Record<string, string> = {
      '/': 'Home',
      '/studio': 'Pattern Studio',
      '/patterns': 'My Patterns',
      '/marketplace': 'Marketplace',
      '/settings': 'Settings',
      '/auth/login': 'Sign In',
      '/auth/signup': 'Sign Up',
      '/pricing': 'Pricing',
    };
    return routes[pathname] || 'Page';
  }
</script>

<svelte:head>
  <title>Guilloche Studio - Create Intricate Mathematical Patterns</title>
  <meta property="og:url" content={$page.url.href} />
  <link rel="canonical" href={$page.url.href} />
</svelte:head>

<!-- Live region for screen reader announcements -->
<div
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
  role="status"
>
  {announcement}
</div>

{#if $isI18nLoading}
  <div
    class="flex items-center justify-center min-h-screen"
    role="status"
    aria-label="Loading application"
  >
    <div class="text-center">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"
        aria-hidden="true"
      ></div>
      <span class="sr-only">Loading Guilloche Studio...</span>
      <p class="mt-4 text-gray-600 dark:text-gray-400" aria-hidden="true">Loading...</p>
    </div>
  </div>
{:else}
  <MaintenanceBanner />
  <slot />
  <FeatureFlagsDebugPanel />
{/if}
