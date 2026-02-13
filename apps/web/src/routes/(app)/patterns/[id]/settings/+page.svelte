<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: pattern = data.pattern;

  let name = pattern.name;
  let description = pattern.description || '';
  let price_dollars = (pattern.price_cents / 100).toFixed(2);
  let license_type = pattern.license_type;
  let tags = (pattern.tags || []).join(', ');
  let is_listed = pattern.is_listed;
  let is_public = pattern.is_public;
  let loading = false;
  let showDeleteModal = false;

  function handlePriceInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9.]/g, '');
    price_dollars = value;
  }

  $: price_cents = Math.round(parseFloat(price_dollars || '0') * 100);
</script>

<svelte:head>
  <title>Pattern Settings - Guilloché Studio</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-8">
  <div class="mb-8">
    <a href="/patterns" class="text-sm text-indigo-600 hover:text-indigo-700 mb-2 inline-block">
      &larr; Back to Patterns
    </a>
    <h1 class="text-3xl font-bold text-gray-900">Pattern Settings</h1>
  </div>

  {#if form?.success}
    <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
      Pattern updated successfully!
    </div>
  {/if}

  {#if form?.error}
    <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
      {form.error}
    </div>
  {/if}

  <form
    method="POST"
    action="?/updateListing"
    use:enhance={() => {
      loading = true;
      return async ({ update }) => {
        await update();
        loading = false;
      };
    }}
  >
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <!-- Preview -->
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

      <div class="p-6 space-y-6">
        <!-- Basic Info -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>

          <div class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                Pattern Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                bind:value={name}
                required
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                bind:value={description}
                rows="3"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                placeholder="Describe your pattern..."
              ></textarea>
            </div>

            <div>
              <label for="tags" class="block text-sm font-medium text-gray-700 mb-1"> Tags </label>
              <input
                type="text"
                id="tags"
                name="tags"
                bind:value={tags}
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="geometric, mandala, elegant (comma separated)"
              />
              <p class="text-xs text-gray-500 mt-1">Separate tags with commas</p>
            </div>
          </div>
        </div>

        <!-- Marketplace Settings -->
        <div class="pt-6 border-t border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Marketplace Settings</h2>

          <div class="space-y-4">
            <!-- Visibility -->
            <div class="flex items-start gap-4">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={is_public}
                  class="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span class="font-medium text-gray-900">Public Pattern</span>
                  <p class="text-sm text-gray-500">Allow others to view this pattern</p>
                </div>
              </label>
              <input type="hidden" name="is_public" value={is_public.toString()} />
            </div>

            <!-- List on Marketplace -->
            <div class="flex items-start gap-4">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={is_listed}
                  class="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span class="font-medium text-gray-900">List on Marketplace</span>
                  <p class="text-sm text-gray-500">Make available for purchase or free download</p>
                </div>
              </label>
              <input type="hidden" name="is_listed" value={is_listed.toString()} />
            </div>

            {#if is_listed}
              <div class="ml-8 space-y-4 p-4 bg-gray-50 rounded-lg">
                <!-- Price -->
                <div>
                  <label for="price" class="block text-sm font-medium text-gray-700 mb-1">
                    Base Price (USD)
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      id="price"
                      bind:value={price_dollars}
                      on:input={handlePriceInput}
                      class="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <input type="hidden" name="price_cents" value={price_cents} />
                  <p class="text-xs text-gray-500 mt-1">Set to 0 for free patterns</p>
                </div>

                <!-- License Type -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2"> License Type </label>
                  <div class="space-y-2">
                    <label
                      class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                                 {license_type === 'personal'
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'}"
                    >
                      <input
                        type="radio"
                        name="license_type"
                        value="personal"
                        bind:group={license_type}
                        class="mt-1"
                      />
                      <div>
                        <span class="font-medium text-gray-900">Personal</span>
                        <p class="text-sm text-gray-500">
                          Use in personal, non-commercial projects
                        </p>
                      </div>
                    </label>

                    <label
                      class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                                 {license_type === 'commercial'
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'}"
                    >
                      <input
                        type="radio"
                        name="license_type"
                        value="commercial"
                        bind:group={license_type}
                        class="mt-1"
                      />
                      <div>
                        <span class="font-medium text-gray-900">Commercial</span>
                        <p class="text-sm text-gray-500">
                          Use in commercial products and client work (3x price)
                        </p>
                      </div>
                    </label>

                    <label
                      class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                                 {license_type === 'remix'
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'}"
                    >
                      <input
                        type="radio"
                        name="license_type"
                        value="remix"
                        bind:group={license_type}
                        class="mt-1"
                      />
                      <div>
                        <span class="font-medium text-gray-900">Remix</span>
                        <p class="text-sm text-gray-500">
                          Allow modifications and derivatives (2x price, you earn royalties)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Price Preview -->
                <div class="p-4 bg-white rounded-lg border border-gray-200">
                  <h4 class="text-sm font-medium text-gray-700 mb-2">License Prices Preview</h4>
                  <div class="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p class="text-lg font-semibold text-gray-900">
                        ${(price_cents / 100).toFixed(2)}
                      </p>
                      <p class="text-xs text-gray-500">Personal</p>
                    </div>
                    <div>
                      <p class="text-lg font-semibold text-gray-900">
                        ${((price_cents * 3) / 100).toFixed(2)}
                      </p>
                      <p class="text-xs text-gray-500">Commercial</p>
                    </div>
                    <div>
                      <p class="text-lg font-semibold text-gray-900">
                        ${((price_cents * 2) / 100).toFixed(2)}
                      </p>
                      <p class="text-xs text-gray-500">Remix</p>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Submit -->
        <div class="pt-6 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            on:click={() => (showDeleteModal = true)}
            class="text-red-600 hover:text-red-700 font-medium"
          >
            Delete Pattern
          </button>

          <button
            type="submit"
            disabled={loading}
            class="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  </form>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-xl max-w-md w-full p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Pattern</h3>
      <p class="text-gray-600 mb-6">
        Are you sure you want to delete this pattern? This action cannot be undone.
      </p>
      <div class="flex gap-3 justify-end">
        <button
          on:click={() => (showDeleteModal = false)}
          class="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <form method="POST" action="?/delete">
          <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Delete
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}
