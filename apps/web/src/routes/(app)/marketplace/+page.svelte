<script lang="ts">
  import { onMount } from 'svelte';

  let patterns: Array<{
    id: string;
    name: string;
    description: string | null;
    thumbnail_url: string | null;
    price_cents: number;
    license_type: string;
    view_count: number;
    download_count: number;
    creator: {
      username: string;
      display_name: string | null;
    };
  }> = [];
  let loading = true;
  let searchQuery = '';
  let sortBy = 'popular';
  let filterLicense = 'all';

  onMount(async () => {
    await loadPatterns();
  });

  async function loadPatterns() {
    loading = true;
    try {
      const response = await fetch('/api/marketplace/patterns');
      if (response.ok) {
        const data = await response.json();
        patterns = data.patterns || [];
      }
    } catch (err) {
      console.error('Failed to load marketplace patterns:', err);
    } finally {
      loading = false;
    }
  }

  function formatPrice(cents: number) {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<svelte:head>
  <title>Marketplace - Guilloché Studio</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Pattern Marketplace</h1>
    <p class="text-gray-600">
      Discover and purchase beautiful guilloché patterns from creators around the world
    </p>
  </div>

  <!-- Filters -->
  <div
    class="flex flex-wrap items-center gap-4 mb-8 p-4 bg-white rounded-lg border border-gray-200"
  >
    <div class="flex-1 min-w-[200px]">
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search patterns..."
        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>

    <select
      bind:value={sortBy}
      class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="popular">Most Popular</option>
      <option value="recent">Most Recent</option>
      <option value="price_low">Price: Low to High</option>
      <option value="price_high">Price: High to Low</option>
    </select>

    <select
      bind:value={filterLicense}
      class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="all">All Licenses</option>
      <option value="free">Free</option>
      <option value="personal">Personal Use</option>
      <option value="commercial">Commercial</option>
      <option value="remix">Remix Allowed</option>
    </select>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each Array(8) as _}
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
          <div class="aspect-square bg-gray-200"></div>
          <div class="p-4">
            <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div class="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if patterns.length === 0}
    <div class="text-center py-16">
      <svg
        class="w-16 h-16 mx-auto text-gray-300 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">No patterns available yet</h2>
      <p class="text-gray-600 mb-6">Be the first to list a pattern on the marketplace!</p>
      <a
        href="/studio"
        class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create a Pattern
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each patterns as pattern (pattern.id)}
        <a href="/marketplace/{pattern.id}" class="group">
          <div
            class="bg-white rounded-lg border border-gray-200 overflow-hidden transition-shadow hover:shadow-lg"
          >
            <div class="aspect-square bg-gray-100 relative">
              {#if pattern.thumbnail_url}
                <img
                  src={pattern.thumbnail_url}
                  alt={pattern.name}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-gray-400">
                  <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              {/if}

              <div class="absolute top-2 right-2">
                <span class="px-2 py-1 text-xs font-medium bg-white/90 rounded-full shadow">
                  {formatPrice(pattern.price_cents)}
                </span>
              </div>
            </div>

            <div class="p-4">
              <h3
                class="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate"
              >
                {pattern.name}
              </h3>
              <p class="text-sm text-gray-500 mt-1">
                by {pattern.creator.display_name || pattern.creator.username}
              </p>

              <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  {pattern.view_count}
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {pattern.download_count}
                </span>
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
