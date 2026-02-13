<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import '../app.css';
  import { initializeAuth, session, profile, user } from '$lib/stores/auth';
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
</script>

<svelte:head>
  <title>Guilloche Studio Pro</title>
</svelte:head>

{#if $isI18nLoading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
{:else}
  <MaintenanceBanner />
  <slot />
  <FeatureFlagsDebugPanel />
{/if}
