<script lang="ts">
  import { session, user, profile } from '$lib/stores/auth';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { _ } from 'svelte-i18n';
  import LanguageSelect from '$lib/components/LanguageSelect.svelte';

  let displayName = $profile?.display_name || '';
  let username = $profile?.username || '';
  let bio = $profile?.bio || '';
  let saving = false;
  let error = '';
  let success = '';

  let managingBilling = false;

  // Check for successful checkout
  $: if ($page.url.searchParams.get('session_id')) {
    success = $_('settings.subscriptionActivated');
    invalidateAll();
  }

  async function updateProfile() {
    if (!$user) return;
    saving = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          username,
          bio,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || $_('errors.saveFailed'));
      }

      success = $_('settings.profileUpdated');
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : $_('errors.saveFailed');
    } finally {
      saving = false;
    }
  }

  async function manageBilling() {
    managingBilling = true;
    error = '';

    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || $_('errors.generic'));
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      error = err instanceof Error ? err.message : $_('errors.generic');
      managingBilling = false;
    }
  }

  function getTierBadgeClass(tier: string) {
    switch (tier) {
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<svelte:head>
  <title>{$_('settings.title')} - {$_('common.appName')}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-4xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">{$_('settings.title')}</h1>

    {#if error}
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    {#if success}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
        {success}
      </div>
    {/if}

    <!-- Profile Section -->
    <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{$_('settings.profile')}</h2>

      <form on:submit|preventDefault={updateProfile} class="space-y-4">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
            {$_('auth.email')}
          </label>
          <input
            type="email"
            id="email"
            value={$user?.email || ''}
            disabled
            class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
          />
          <p class="mt-1 text-sm text-gray-500">{$_('settings.emailCannotChange')}</p>
        </div>

        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            {$_('settings.username')}
          </label>
          <input
            type="text"
            id="username"
            bind:value={username}
            placeholder="your-username"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p class="mt-1 text-sm text-gray-500">{$_('settings.usernameDescription')}</p>
        </div>

        <div>
          <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">
            {$_('settings.displayName')}
          </label>
          <input
            type="text"
            id="displayName"
            bind:value={displayName}
            placeholder="Your Name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label for="bio" class="block text-sm font-medium text-gray-700 mb-1">
            {$_('settings.bio')}
          </label>
          <textarea
            id="bio"
            bind:value={bio}
            rows="3"
            placeholder={$_('settings.bioPlaceholder')}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={saving}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? $_('settings.saving') : $_('settings.saveChanges')}
        </button>
      </form>
    </section>

    <!-- Language Section -->
    <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{$_('settings.language')}</h2>
      <div class="max-w-xs">
        <LanguageSelect />
      </div>
    </section>

    <!-- Subscription Section -->
    <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{$_('settings.subscription')}</h2>

      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-gray-700">{$_('settings.currentPlan')}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-2xl font-bold text-gray-900 capitalize">
              {$profile?.subscription_tier || $_('subscription.free')}
            </span>
            <span
              class="px-2 py-1 text-xs font-medium rounded-full {getTierBadgeClass(
                $profile?.subscription_tier || 'free'
              )}"
            >
              {$profile?.subscription_tier === 'free'
                ? $_('subscription.free')
                : $_('settings.active')}
            </span>
          </div>
        </div>

        {#if $profile?.subscription_tier === 'free'}
          <a
            href="/pricing"
            class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
          >
            {$_('common.upgrade')}
          </a>
        {:else}
          <button
            on:click={manageBilling}
            disabled={managingBilling}
            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {managingBilling ? $_('settings.openingBilling') : $_('settings.manageBilling')}
          </button>
        {/if}
      </div>

      {#if $profile?.subscription_tier !== 'free'}
        <div class="border-t border-gray-200 pt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">{$_('settings.planIncludes')}</h3>
          <ul class="space-y-1 text-sm text-gray-600">
            {#if $profile?.subscription_tier === 'pro'}
              <li>{$_('settings.proFeatures.unlimitedPatterns')}</li>
              <li>{$_('settings.proFeatures.allExports')}</li>
              <li>{$_('settings.proFeatures.wasmEngine')}</li>
              <li>{$_('settings.proFeatures.cloudSaves100')}</li>
              <li>{$_('settings.proFeatures.patternDna')}</li>
              <li>{$_('settings.proFeatures.aiAssistant')}</li>
            {:else if $profile?.subscription_tier === 'enterprise'}
              <li>{$_('settings.enterpriseFeatures.everythingInPro')}</li>
              <li>{$_('settings.enterpriseFeatures.apiAccess')}</li>
              <li>{$_('settings.enterpriseFeatures.whiteLabel')}</li>
              <li>{$_('settings.enterpriseFeatures.priorityAi')}</li>
              <li>{$_('settings.enterpriseFeatures.unlimitedCloud')}</li>
              <li>{$_('settings.enterpriseFeatures.teamCollab')}</li>
              <li>{$_('settings.enterpriseFeatures.cncIntegration')}</li>
            {/if}
          </ul>
        </div>
      {:else}
        <div class="border-t border-gray-200 pt-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">{$_('settings.freePlanLimits')}</h3>
          <ul class="space-y-1 text-sm text-gray-600">
            <li>{$_('settings.freeFeatures.basicPatterns')}</li>
            <li>{$_('settings.freeFeatures.pngExport')}</li>
            <li>{$_('settings.freeFeatures.cloudSaves3')}</li>
          </ul>
        </div>
      {/if}
    </section>

    <!-- Danger Zone -->
    <section class="bg-white rounded-lg shadow-sm border border-red-200 p-6">
      <h2 class="text-xl font-semibold text-red-600 mb-4">{$_('settings.dangerZone')}</h2>

      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium text-gray-900">{$_('settings.deleteAccount')}</p>
          <p class="text-sm text-gray-500">{$_('settings.deleteAccountDescription')}</p>
        </div>
        <button
          class="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          {$_('settings.deleteAccount')}
        </button>
      </div>
    </section>
  </div>
</div>
