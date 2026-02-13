<script lang="ts">
  import { page } from '$app/stores';
  import { session, user, profile, isAuthenticated } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { _ } from 'svelte-i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

  export let data;

  // Update stores from layout data
  $: if (data.session) {
    session.set(data.session);
  }
  $: if (data.user) {
    user.set(data.user);
  }
  $: if (data.profile) {
    profile.set(data.profile);
  }

  async function handleSignOut() {
    const response = await fetch('/auth/signout', { method: 'POST' });
    if (response.ok) {
      session.set(null);
      user.set(null);
      profile.set(null);
      goto('/');
    }
  }

  function isActive(path: string) {
    return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Navigation -->
  <nav class="bg-white border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-16">
        <!-- Logo & Main Nav -->
        <div class="flex items-center gap-8">
          <a href="/" class="text-xl font-bold text-gray-900">
            {$_('common.appName')}
          </a>

          {#if $isAuthenticated}
            <div class="hidden md:flex items-center gap-1">
              <a
                href="/studio"
                class="px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  {isActive('/studio') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              >
                {$_('nav.studio')}
              </a>
              <a
                href="/patterns"
                class="px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  {isActive('/patterns') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              >
                {$_('nav.patterns')}
              </a>
              <a
                href="/marketplace"
                class="px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  {isActive('/marketplace') ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
              >
                {$_('nav.marketplace')}
              </a>
            </div>
          {/if}
        </div>

        <!-- User Menu -->
        <div class="flex items-center gap-4">
          <LanguageSwitcher />

          {#if $isAuthenticated}
            {#if $profile?.subscription_tier === 'free'}
              <a
                href="/pricing"
                class="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {$_('common.upgrade')}
              </a>
            {:else}
              <span class="hidden sm:inline-flex px-2 py-1 text-xs font-medium rounded-full
                {$profile?.subscription_tier === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
                {$profile?.subscription_tier === 'pro' ? $_('subscription.pro') : $_('subscription.enterprise')}
              </span>
            {/if}

            <div class="relative group">
              <button class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label={$_('accessibility.userMenu')}>
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {($profile?.display_name || $user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown -->
              <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div class="px-4 py-2 border-b border-gray-100">
                  <p class="text-sm font-medium text-gray-900 truncate">
                    {$profile?.display_name || 'User'}
                  </p>
                  <p class="text-xs text-gray-500 truncate">{$user?.email}</p>
                </div>
                <a
                  href="/settings"
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {$_('nav.settings')}
                </a>
                <button
                  on:click={handleSignOut}
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {$_('auth.signOut')}
                </button>
              </div>
            </div>
          {:else}
            <a href="/auth/login" class="text-sm text-gray-600 hover:text-gray-900">
              {$_('auth.logIn')}
            </a>
            <a
              href="/auth/signup"
              class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {$_('auth.signUp')}
            </a>
          {/if}
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main>
    <slot />
  </main>
</div>
