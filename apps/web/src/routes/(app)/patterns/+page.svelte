<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { session, profile } from '$lib/stores/auth';
  import type { PageData } from './$types';

  export let data: PageData;

  let patterns = data.patterns || [];
  let loading = false;
  let error = '';
  let deleteConfirm: string | null = null;

  async function deletePattern(id: string) {
    if (deleteConfirm !== id) {
      deleteConfirm = id;
      return;
    }

    try {
      const response = await fetch(`/api/patterns/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete pattern');
      }

      patterns = patterns.filter((p) => p.id !== id);
      deleteConfirm = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete pattern';
    }
  }

  function cancelDelete() {
    deleteConfirm = null;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getPatternLimit() {
    const tier = $profile?.subscription_tier || 'free';
    switch (tier) {
      case 'enterprise':
        return Infinity;
      case 'pro':
        return 100;
      default:
        return 3;
    }
  }
</script>

<svelte:head>
  <title>My Patterns - Guilloché Studio</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">My Patterns</h1>
        <p class="text-gray-600 mt-1">
          {patterns.length} / {getPatternLimit() === Infinity ? '∞' : getPatternLimit()} patterns saved
        </p>
      </div>

      <a
        href="/studio"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        New Pattern
      </a>
    </div>

    {#if error}
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    {/if}

    {#if patterns.length === 0}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
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
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">No patterns yet</h2>
        <p class="text-gray-600 mb-6">Create your first guilloché pattern in the studio</p>
        <a
          href="/studio"
          class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Pattern
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each patterns as pattern (pattern.id)}
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group">
            <a href="/studio?pattern={pattern.id}" class="block">
              <div class="aspect-square bg-gray-100 relative">
                {#if pattern.thumbnail_url}
                  <img
                    src={pattern.thumbnail_url}
                    alt={pattern.name}
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <div class="w-full h-full flex items-center justify-center text-gray-400">
                    <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                {/if}

                <div
                  class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"
                />
              </div>
            </a>

            <div class="p-4">
              <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-gray-900 truncate flex-1">
                  {pattern.name}
                </h3>
                <div class="flex items-center gap-1 ml-2">
                  {#if pattern.is_public}
                    <span class="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                      Public
                    </span>
                  {/if}
                </div>
              </div>

              {#if pattern.description}
                <p class="text-sm text-gray-600 line-clamp-2 mb-3">
                  {pattern.description}
                </p>
              {/if}

              <div class="flex items-center justify-between text-sm text-gray-500">
                <span>{formatDate(pattern.created_at)}</span>

                <div class="flex items-center gap-2">
                  <a
                    href="/studio?pattern={pattern.id}"
                    class="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Edit"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </a>

                  {#if deleteConfirm === pattern.id}
                    <button
                      on:click={() => deletePattern(pattern.id)}
                      class="p-1.5 bg-red-100 text-red-600 rounded transition-colors"
                      title="Confirm delete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      on:click={cancelDelete}
                      class="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  {:else}
                    <button
                      on:click={() => deletePattern(pattern.id)}
                      class="p-1.5 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                      title="Delete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
