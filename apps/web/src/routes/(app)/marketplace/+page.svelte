<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Footer from '$lib/components/Footer.svelte';

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

  // Hardcoded premium "Library" elements with their engine parameters
  const libraryElements = [
    {
      id: 'lib-01',
      name: 'Imperial Guilloché Frame',
      category: 'Frame',
      description: 'Ultra-high complexity security frame for certificates and bonds.',
      price: '$49',
      image: '/screenshots/studio.png',
      params: {
        family: 'hypo',
        R: 320,
        r: 85,
        d: 160,
        k: 24,
        m: 0.35,
        mf: 12,
        symmetry: 12,
        lw: 0.4,
      },
    },
    {
      id: 'lib-02',
      name: 'Sovereign Rosette Set',
      category: 'Rosette',
      description: 'A collection of 12 nesting rosettes with variable stroke width.',
      price: '$29',
      image: '/screenshots/mobile.png',
      params: { family: 'rose', R: 240, r: 60, d: 0, k: 8, m: 0.15, mf: 4, symmetry: 12, lw: 0.6 },
    },
    {
      id: 'lib-03',
      name: 'Currency Micro-text Band',
      category: 'Band',
      description: 'Continuously repeating band with integrated relief modulation.',
      price: '$39',
      image: '/screenshots/studio.png',
      params: { family: 'epi', R: 280, r: 70, d: 120, k: 11, m: 0.4, mf: 8, symmetry: 1, lw: 0.3 },
    },
  ];

  onMount(async () => {
    await loadPatterns();
  });

  async function loadPatterns() {
    loading = true;
    try {
      const response = await fetch('/api/marketplace/patterns');
      if (response.ok) {
        const res = await response.json();
        patterns = res.data?.patterns || [];
      }
    } catch (err) {
      console.error('Failed to load marketplace patterns:', err);
    } finally {
      loading = false;
    }
  }

  function handleImport(element: any) {
    const p = encodeURIComponent(JSON.stringify(element.params));
    goto(`/studio?params=${p}`);
  }

  function formatPrice(cents: number) {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<svelte:head>
  <title>Library & Marketplace | Guilloche Studio</title>
</svelte:head>

<div class="min-h-screen bg-[#F5F5F7] font-kalice">
  <!-- Hero / Header -->
  <section class="bg-white pt-32 pb-20 border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-8">
      <div class="flex flex-col md:flex-row justify-between items-end gap-12">
        <div class="max-w-2xl">
          <h2
            class="text-xs font-sohne-halbfett font-bold uppercase tracking-[0.5em] text-blue-600 mb-6"
          >
            Asset Store
          </h2>
          <h1
            class="text-6xl font-sohne-halbfett tracking-tighter text-gray-900 leading-[0.9] mb-8"
          >
            The Premium <br />
            <span class="text-gray-200">Library.</span>
          </h1>
          <p class="text-xl text-gray-400 font-light leading-relaxed">
            Predesigned security elements, complex rosettes, and complete banknote frames. Optimized
            for production and ready for Studio import.
          </p>
        </div>
        <div class="flex gap-4 mb-2">
          <a href="/studio" class="btn btn-primary px-8 py-4 text-xs">Open Studio</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Premium Library (Curated) -->
  <section class="py-24 max-w-7xl mx-auto px-8">
    <div class="flex justify-between items-center mb-12">
      <h3 class="text-sm font-bold uppercase tracking-[0.3em] text-gray-400 font-sohne-halbfett">
        Curated Elements
      </h3>
      <div class="h-px flex-1 mx-12 bg-gray-100"></div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      {#each libraryElements as item}
        <div
          class="group bg-white rounded-[3rem] border border-gray-100 p-8 shadow-sm hover:shadow-2xl transition-all duration-700 hover:-translate-y-2"
        >
          <div
            class="aspect-square bg-gray-50 rounded-[2rem] mb-8 overflow-hidden relative border border-gray-50"
          >
            <img
              src={item.image}
              alt={item.name}
              class="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000"
            />
            <div
              class="absolute top-6 left-6 px-4 py-1.5 bg-white/90 backdrop-blur rounded-full text-[9px] font-bold uppercase tracking-widest shadow-xl border border-gray-100"
            >
              {item.category}
            </div>
          </div>
          <h4 class="text-xl font-sohne-halbfett font-bold text-gray-900 mb-3">{item.name}</h4>
          <p class="text-sm text-gray-400 font-light leading-relaxed mb-8">{item.description}</p>
          <div class="flex justify-between items-center">
            <span class="text-lg font-bold font-sohne-halbfett text-gray-900">{item.price}</span>
            <button
              on:click={() => handleImport(item)}
              class="px-6 py-3 bg-gray-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
            >
              Acquire & Import
            </button>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- Community Marketplace -->
  <section class="py-24 bg-white">
    <div class="max-w-7xl mx-auto px-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
        <div>
          <h3
            class="text-sm font-bold uppercase tracking-[0.3em] text-gray-400 font-sohne-halbfett mb-4"
          >
            Community Designs
          </h3>
          <p class="text-gray-400 font-light">
            Explore unique patterns created by our global network of artists.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <input
            type="search"
            bind:value={searchQuery}
            placeholder="Search community..."
            class="px-6 py-3 bg-gray-50 border border-gray-100 rounded-full text-xs font-medium focus:ring-2 focus:ring-black/5 outline-none min-w-[240px]"
          />

          <select
            bind:value={sortBy}
            class="px-6 py-3 bg-gray-50 border border-gray-100 rounded-full text-xs font-medium outline-none"
          >
            <option value="popular">Popular</option>
            <option value="recent">Recent</option>
            <option value="price_low">Price ↑</option>
            <option value="price_high">Price ↓</option>
          </select>
        </div>
      </div>

      {#if loading}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 animate-pulse">
          {#each Array(4) as _}
            <div class="bg-gray-50 aspect-square rounded-[2rem]"></div>
          {/each}
        </div>
      {:else if patterns.length === 0}
        <div class="py-20 text-center border-2 border-dashed border-gray-100 rounded-[4rem]">
          <p class="text-gray-300 font-medium uppercase tracking-[0.2em] text-[10px]">
            No community listings in this category yet
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-10">
          {#each patterns as pattern}
            <a href="/marketplace/{pattern.id}" class="group block">
              <div
                class="aspect-square bg-gray-50 rounded-[2.5rem] mb-6 overflow-hidden border border-gray-50 transition-all duration-500 group-hover:shadow-xl group-hover:scale-[1.02]"
              >
                {#if pattern.thumbnail_url}
                  <img
                    src={pattern.thumbnail_url}
                    alt={pattern.name}
                    class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  />
                {:else}
                  <div class="w-full h-full flex items-center justify-center text-gray-200">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      /></svg
                    >
                  </div>
                {/if}
              </div>
              <h5
                class="font-sohne-halbfett font-bold text-gray-900 group-hover:text-blue-600 transition-colors"
              >
                {pattern.name}
              </h5>
              <div class="flex items-center justify-between mt-2">
                <span class="text-[10px] text-gray-400 uppercase tracking-widest"
                  >{pattern.creator.display_name || pattern.creator.username}</span
                >
                <span class="text-xs font-bold">{formatPrice(pattern.price_cents)}</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>

<Footer />

<style>
  :global(body) {
    background-color: #f5f5f7;
  }
</style>
