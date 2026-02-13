<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: earnings = data.earnings;
  $: patterns = data.patterns;
  $: recentSales = data.recentSales;

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
</script>

<svelte:head>
  <title>Earnings Dashboard - Guilloché Studio</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">Creator Earnings</h1>
    <p class="text-gray-600 mt-1">Track your pattern sales and royalties</p>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <p class="text-sm text-gray-500 mb-1">Total Earnings</p>
      <p class="text-3xl font-bold text-gray-900">{formatPrice(earnings.total_earnings_cents)}</p>
      <p class="text-sm text-green-600 mt-2">
        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        All time
      </p>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <p class="text-sm text-gray-500 mb-1">Total Sales</p>
      <p class="text-3xl font-bold text-gray-900">{earnings.total_sales}</p>
      <p class="text-sm text-gray-500 mt-2">Patterns sold</p>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <p class="text-sm text-gray-500 mb-1">Royalties Paid</p>
      <p class="text-3xl font-bold text-amber-600">{formatPrice(earnings.total_royalties_cents)}</p>
      <p class="text-sm text-gray-500 mt-2">To original creators</p>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <p class="text-sm text-gray-500 mb-1">Listed Patterns</p>
      <p class="text-3xl font-bold text-gray-900">{patterns.filter(p => p.is_listed).length}</p>
      <p class="text-sm text-gray-500 mt-2">of {patterns.length} total</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Monthly Earnings Chart -->
    <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Monthly Earnings</h2>

      {#if earnings.monthly_earnings.length === 0}
        <div class="text-center py-12 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No sales data yet</p>
          <p class="text-sm mt-1">List your first pattern to start earning!</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each earnings.monthly_earnings as month}
            {@const maxEarnings = Math.max(...earnings.monthly_earnings.map(m => m.earnings))}
            <div class="flex items-center gap-4">
              <div class="w-20 text-sm text-gray-500">{formatMonth(month.month)}</div>
              <div class="flex-1">
                <div class="bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    class="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full flex items-center justify-end pr-2"
                    style="width: {Math.max((month.earnings / maxEarnings) * 100, 10)}%"
                  >
                    <span class="text-xs text-white font-medium">{formatPrice(month.earnings)}</span>
                  </div>
                </div>
              </div>
              <div class="w-16 text-sm text-gray-500 text-right">{month.sales} sales</div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Recent Sales -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Sales</h2>

      {#if recentSales.length === 0}
        <div class="text-center py-8 text-gray-500">
          <p>No sales yet</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each recentSales.slice(0, 10) as sale}
            <div class="flex items-start justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <div>
                <p class="font-medium text-gray-900 text-sm">{sale.pattern_name}</p>
                <p class="text-xs text-gray-500 capitalize">{sale.license_type} license</p>
                <p class="text-xs text-gray-400 mt-1">{formatDate(sale.created_at)}</p>
              </div>
              <div class="text-right">
                <p class="font-semibold text-green-600">{formatPrice(sale.price_cents - sale.royalty_paid_cents)}</p>
                {#if sale.royalty_paid_cents > 0}
                  <p class="text-xs text-gray-400">-{formatPrice(sale.royalty_paid_cents)} royalty</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Listed Patterns -->
  <div class="mt-8 bg-white rounded-xl border border-gray-200 p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-gray-900">Your Patterns</h2>
      <a href="/studio" class="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        Create New Pattern
      </a>
    </div>

    {#if patterns.length === 0}
      <div class="text-center py-12 text-gray-500">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="text-lg font-medium">No patterns yet</p>
        <p class="text-sm mt-1">Create your first pattern to start selling</p>
        <a href="/studio" class="inline-block mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Open Studio
        </a>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-sm text-gray-500 border-b border-gray-100">
              <th class="pb-3 font-medium">Pattern</th>
              <th class="pb-3 font-medium">Status</th>
              <th class="pb-3 font-medium">Price</th>
              <th class="pb-3 font-medium">Views</th>
              <th class="pb-3 font-medium">Downloads</th>
              <th class="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each patterns as pattern}
              <tr>
                <td class="py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {#if pattern.thumbnail_url}
                        <img src={pattern.thumbnail_url} alt="" class="w-full h-full object-cover" />
                      {:else}
                        <div class="w-full h-full flex items-center justify-center text-gray-400">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      {/if}
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">{pattern.name}</p>
                      <p class="text-sm text-gray-500">{formatDate(pattern.created_at)}</p>
                    </div>
                  </div>
                </td>
                <td class="py-4">
                  {#if pattern.is_listed}
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Listed
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      Draft
                    </span>
                  {/if}
                </td>
                <td class="py-4 font-medium">{formatPrice(pattern.price_cents)}</td>
                <td class="py-4 text-gray-600">{pattern.view_count}</td>
                <td class="py-4 text-gray-600">{pattern.download_count}</td>
                <td class="py-4">
                  <div class="flex items-center gap-2">
                    <a
                      href="/patterns/{pattern.id}/settings"
                      class="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Edit
                    </a>
                    {#if pattern.is_listed}
                      <a
                        href="/marketplace/{pattern.id}"
                        class="text-sm text-gray-600 hover:text-gray-700"
                      >
                        View
                      </a>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
