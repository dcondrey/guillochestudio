<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  export let data: PageData;

  $: pattern = data.pattern;
  $: licensePrices = data.licensePrices;
  $: purchaseStatus = data.purchaseStatus;
  $: isOwner = data.isOwner;
  $: similarPatterns = data.similarPatterns;
  $: creatorPatterns = data.creatorPatterns;
  $: isAuthenticated = data.isAuthenticated;

  let selectedLicense: 'personal' | 'commercial' | 'remix' = 'personal';
  let purchaseLoading = false;

  function formatPrice(cents: number): string {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getLicenseDescription(license: string): string {
    switch (license) {
      case 'personal':
        return 'Use in personal, non-commercial projects';
      case 'commercial':
        return 'Use in commercial products and client work';
      case 'remix':
        return 'Modify and create derivative works, list on marketplace';
      default:
        return '';
    }
  }

  function getLicensePrice(license: string): number {
    if (license === 'personal' || license === 'commercial' || license === 'remix') {
      return licensePrices[license];
    }
    return 0;
  }

  async function handlePurchase() {
    if (!isAuthenticated) {
      goto('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    purchaseLoading = true;

    try {
      const response = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern_id: pattern.id,
          license_type: selectedLicense,
        }),
      });

      const result = await response.json();

      if (result.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = result.checkout_url;
      } else if (result.success) {
        // Free pattern - reload page
        window.location.reload();
      } else {
        alert(result.error || 'Purchase failed');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      alert('Failed to process purchase');
    } finally {
      purchaseLoading = false;
    }
  }

  async function handleDownload() {
    try {
      const response = await fetch(`/api/patterns/${pattern.id}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pattern.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download pattern');
    }
  }

  function handleOpenInStudio() {
    // Encode parameters and open in studio
    const params = encodeURIComponent(JSON.stringify(pattern.parameters));
    goto(`/studio?params=${params}`);
  }
</script>

<svelte:head>
  <title>{pattern.name} - Guilloché Marketplace</title>
  <meta
    name="description"
    content={pattern.description ||
      `Beautiful guilloché pattern by ${pattern.creator.display_name || pattern.creator.username}`}
  />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="mb-6">
    <ol class="flex items-center gap-2 text-sm text-gray-500">
      <li><a href="/marketplace" class="hover:text-indigo-600">Marketplace</a></li>
      <li>/</li>
      <li class="text-gray-900 font-medium truncate max-w-xs">{pattern.name}</li>
    </ol>
  </nav>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-8">
      <!-- Pattern Preview -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="aspect-video bg-gray-900 relative">
          {#if pattern.thumbnail_url}
            <img
              src={pattern.thumbnail_url}
              alt={pattern.name}
              class="w-full h-full object-contain"
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center text-gray-600">
              <svg class="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          {/if}
        </div>

        <div class="p-6">
          <h1 class="text-2xl font-bold text-gray-900 mb-2">{pattern.name}</h1>

          {#if pattern.description}
            <p class="text-gray-600 mb-4">{pattern.description}</p>
          {/if}

          <!-- Tags -->
          {#if pattern.tags.length > 0}
            <div class="flex flex-wrap gap-2 mb-4">
              {#each pattern.tags as tag}
                <a
                  href="/marketplace?tag={encodeURIComponent(tag)}"
                  class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {tag}
                </a>
              {/each}
            </div>
          {/if}

          <!-- Stats -->
          <div class="flex items-center gap-6 text-sm text-gray-500">
            <span class="flex items-center gap-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {pattern.view_count} views
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {pattern.download_count} downloads
            </span>
          </div>
        </div>
      </div>

      <!-- Remix Attribution -->
      {#if pattern.remix_chain && pattern.remix_chain.length > 0}
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 class="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Remix Attribution
          </h3>
          <p class="text-sm text-amber-700 mb-3">
            This pattern is a remix. Original creators receive royalties from sales.
          </p>
          <div class="flex items-center gap-2 overflow-x-auto">
            {#each pattern.remix_chain as item, i}
              <a
                href="/marketplace/{item.id}"
                class="flex-shrink-0 px-3 py-2 bg-white rounded-lg text-sm hover:bg-amber-100 transition-colors"
              >
                {item.name}
                <span class="text-amber-600">by {item.creator_username || 'Unknown'}</span>
              </a>
              {#if i < pattern.remix_chain.length - 1}
                <svg
                  class="w-4 h-4 text-amber-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Creator Section -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-start gap-4">
          {#if pattern.creator.avatar_url}
            <img
              src={pattern.creator.avatar_url}
              alt={pattern.creator.display_name || pattern.creator.username || 'Creator'}
              class="w-16 h-16 rounded-full object-cover"
            />
          {:else}
            <div
              class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold"
            >
              {(pattern.creator.display_name || pattern.creator.username || '?')[0].toUpperCase()}
            </div>
          {/if}

          <div class="flex-1">
            <h3 class="font-semibold text-gray-900">
              {pattern.creator.display_name || pattern.creator.username || 'Anonymous'}
            </h3>
            {#if pattern.creator.username}
              <p class="text-sm text-gray-500">@{pattern.creator.username}</p>
            {/if}
            <a
              href="/creators/{pattern.creator.username || pattern.creator.id}"
              class="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:text-indigo-700"
            >
              View profile
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>
        </div>

        <!-- More from this creator -->
        {#if creatorPatterns.length > 0}
          <div class="mt-6 pt-6 border-t border-gray-100">
            <h4 class="font-medium text-gray-900 mb-4">More from this creator</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              {#each creatorPatterns as p}
                <a href="/marketplace/{p.id}" class="group">
                  <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {#if p.thumbnail_url}
                      <img
                        src={p.thumbnail_url}
                        alt={p.name}
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center text-gray-400">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    {/if}
                  </div>
                  <p
                    class="mt-2 text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600"
                  >
                    {p.name}
                  </p>
                  <p class="text-sm text-gray-500">{formatPrice(p.price_cents)}</p>
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Sidebar - Purchase Panel -->
    <div class="lg:col-span-1">
      <div class="sticky top-6">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <!-- Price Header -->
          <div class="p-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
            <p class="text-sm opacity-80">Starting at</p>
            <p class="text-4xl font-bold mt-1">{formatPrice(pattern.price_cents)}</p>
          </div>

          <div class="p-6 space-y-6">
            {#if isOwner}
              <!-- Owner Actions -->
              <div class="space-y-3">
                <button
                  on:click={handleOpenInStudio}
                  class="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Edit in Studio
                </button>
                <a
                  href="/patterns/{pattern.id}/settings"
                  class="block w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium text-center hover:bg-gray-200 transition-colors"
                >
                  Listing Settings
                </a>
              </div>
            {:else if purchaseStatus.purchased}
              <!-- Already Purchased -->
              <div class="text-center">
                <div
                  class="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full mb-4"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Purchased ({purchaseStatus.license} license)
                </div>
                <div class="space-y-3">
                  <button
                    on:click={handleDownload}
                    class="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Download Pattern
                  </button>
                  <button
                    on:click={handleOpenInStudio}
                    class="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Open in Studio
                  </button>
                </div>
              </div>
            {:else}
              <!-- License Selection -->
              <div>
                <h4 class="font-medium text-gray-900 mb-3">Select License</h4>
                <div class="space-y-2">
                  {#each ['personal', 'commercial', 'remix'] as license (license)}
                    <label
                      class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                             {selectedLicense === license
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'}"
                    >
                      <input
                        type="radio"
                        bind:group={selectedLicense}
                        value={license}
                        class="mt-1"
                      />
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <span class="font-medium capitalize">{license}</span>
                          <span class="font-semibold text-indigo-600">
                            {formatPrice(getLicensePrice(license))}
                          </span>
                        </div>
                        <p class="text-sm text-gray-500 mt-0.5">
                          {getLicenseDescription(license)}
                        </p>
                      </div>
                    </label>
                  {/each}
                </div>
              </div>

              <!-- Purchase Button -->
              <button
                on:click={handlePurchase}
                disabled={purchaseLoading}
                class="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {#if purchaseLoading}
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                {:else if pattern.price_cents === 0}
                  Get Free Pattern
                {:else}
                  Purchase for {formatPrice(licensePrices[selectedLicense])}
                {/if}
              </button>

              {#if !isAuthenticated}
                <p class="text-sm text-gray-500 text-center">
                  <a href="/auth/login" class="text-indigo-600 hover:underline">Sign in</a> to purchase
                </p>
              {/if}
            {/if}

            <!-- License Info -->
            <div class="pt-4 border-t border-gray-100">
              <h5 class="text-sm font-medium text-gray-700 mb-2">License includes:</h5>
              <ul class="space-y-2 text-sm text-gray-600">
                <li class="flex items-center gap-2">
                  <svg
                    class="w-4 h-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Full parameter access
                </li>
                <li class="flex items-center gap-2">
                  <svg
                    class="w-4 h-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  SVG & PNG exports
                </li>
                <li class="flex items-center gap-2">
                  <svg
                    class="w-4 h-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Lifetime access
                </li>
                {#if selectedLicense === 'commercial' || selectedLicense === 'remix'}
                  <li class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Commercial usage rights
                  </li>
                {/if}
                {#if selectedLicense === 'remix'}
                  <li class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Create & sell derivatives
                  </li>
                {/if}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Similar Patterns -->
  {#if similarPatterns.length > 0}
    <section class="mt-16">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Similar Patterns</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {#each similarPatterns as p}
          <a href="/marketplace/{p.id}" class="group">
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {#if p.thumbnail_url}
                <img
                  src={p.thumbnail_url}
                  alt={p.name}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              {/if}
            </div>
            <p class="mt-2 font-medium text-gray-900 truncate group-hover:text-indigo-600">
              {p.name}
            </p>
            <p class="text-sm text-gray-500">
              {formatPrice(p.price_cents)}
              {#if p.creator_username}
                <span class="mx-1">by</span>
                <span class="text-gray-700">{p.creator_username}</span>
              {/if}
            </p>
          </a>
        {/each}
      </div>
    </section>
  {/if}
</div>
