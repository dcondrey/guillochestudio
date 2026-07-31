<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { importComposition, addImageLayer } from '$lib/stores/pattern';

  const dispatch = createEventDispatcher();

  let activeTab: 'file' | 'url' = 'file';
  let urlInput = '';

  function handleFileImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (file.type === 'application/json') {
          const data = JSON.parse(content);
          importComposition(data);
          dispatch('close');
        } else if (file.type.startsWith('image/')) {
          addImageLayer(content, file.name);
          dispatch('close');
        }
      } catch (err) {
        alert('Invalid file format');
      }
    };

    if (file.type === 'application/json') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  }

  function handleUrlImport() {
    if (!urlInput) return;
    if (urlInput.endsWith('.json')) {
      fetch(urlInput)
        .then((r) => r.json())
        .then((data) => {
          importComposition(data);
          dispatch('close');
        });
    } else {
      addImageLayer(urlInput, 'Remote Image');
      dispatch('close');
    }
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<div
  class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
  role="presentation"
  on:click|self={() => dispatch('close')}
  on:keydown|self={(e) => e.key === 'Escape' && dispatch('close')}
>
  <div class="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden p-10 relative">
    <button
      class="absolute top-8 right-8 text-2xl text-gray-300 hover:text-black"
      on:click={() => dispatch('close')}>×</button
    >

    <h2 class="text-3xl font-sohne-halbfett font-bold text-gray-900 mb-8">Import Design</h2>

    <div class="flex gap-6 border-b border-gray-100 mb-8">
      <button
        class="pb-4 text-[10px] font-bold uppercase tracking-widest {activeTab === 'file'
          ? 'text-black border-b-2 border-black'
          : 'text-gray-300'}"
        on:click={() => (activeTab = 'file')}>Local File</button
      >
      <button
        class="pb-4 text-[10px] font-bold uppercase tracking-widest {activeTab === 'url'
          ? 'text-black border-b-2 border-black'
          : 'text-gray-300'}"
        on:click={() => (activeTab = 'url')}>Remote URL</button
      >
    </div>

    {#if activeTab === 'file'}
      <label
        class="block w-full border-2 border-dashed border-gray-100 rounded-[2rem] p-12 text-center cursor-pointer hover:border-blue-400 transition-all"
      >
        <input type="file" class="hidden" accept=".json,image/*" on:change={handleFileImport} />
        <div class="text-4xl mb-4">📂</div>
        <div class="text-sm font-bold text-gray-900 mb-1">Click to browse</div>
        <div class="text-[10px] text-gray-400 uppercase tracking-widest">
          Supports JSON or Images
        </div>
      </label>
    {:else}
      <div class="space-y-4">
        <input
          type="url"
          bind:value={urlInput}
          placeholder="https://..."
          class="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-black/5"
        />
        <button on:click={handleUrlImport} class="btn btn-primary w-full py-4 text-[10px]"
          >Import from URL</button
        >
      </div>
    {/if}
  </div>
</div>
