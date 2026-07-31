<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PatternParams } from '@guilloche/shared';
  import {
    suggestParameters,
    recognizePattern,
    textToPattern,
    type ParameterSuggestion,
    type PatternRecognitionResult,
    type TextToPatternResult,
  } from '$lib/services/ai';

  const dispatch = createEventDispatcher<{
    apply: Partial<PatternParams>;
    applyFull: PatternParams;
  }>();

  // Active tab
  let activeTab: 'keywords' | 'image' | 'text' = 'keywords';

  // Keywords tab state
  let keywordInput = '';
  let selectedKeywords: string[] = [];
  let suggestions: ParameterSuggestion[] = [];
  let keywordsLoading = false;

  // Image tab state
  let imageFile: File | null = null;
  let imagePreview: string | null = null;
  let recognitionResult: PatternRecognitionResult | null = null;
  let imageLoading = false;

  // Text tab state
  let textPrompt = '';
  let textResult: TextToPatternResult | null = null;
  let textLoading = false;

  // Error state
  let keywordsError: string | null = null;
  let imageError: string | null = null;
  let textError: string | null = null;

  const styleCategories = {
    Style: ['elegant', 'modern', 'classic', 'intricate', 'minimalist', 'organic'],
    Mood: ['calm', 'dynamic', 'luxurious', 'playful', 'mysterious', 'bold'],
    Visual: ['geometric', 'spiral', 'mandala', 'floral', 'radial', 'symmetric'],
  };

  function toggleKeyword(keyword: string) {
    if (selectedKeywords.includes(keyword)) {
      selectedKeywords = selectedKeywords.filter((k) => k !== keyword);
    } else {
      selectedKeywords = [...selectedKeywords, keyword];
    }
  }

  function addCustomKeyword() {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !selectedKeywords.includes(keyword)) {
      selectedKeywords = [...selectedKeywords, keyword];
      keywordInput = '';
    }
  }

  async function generateFromKeywords() {
    if (selectedKeywords.length === 0) return;
    keywordsLoading = true;
    keywordsError = null;
    try {
      suggestions = await suggestParameters(selectedKeywords);
    } catch (error) {
      keywordsError = 'AI engine unreachable. Check connection.';
    } finally {
      keywordsLoading = false;
    }
  }

  function applySuggestion(suggestion: ParameterSuggestion) {
    dispatch('apply', suggestion.params);
  }

  function handleImageDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) processImage(file);
  }

  function handleImageSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) processImage(file);
  }

  function processImage(file: File) {
    imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => (imagePreview = e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!imageFile) return;
    imageLoading = true;
    imageError = null;
    try {
      recognitionResult = await recognizePattern(imageFile);
    } catch (error) {
      imageError = 'Failed to analyze image.';
    } finally {
      imageLoading = false;
    }
  }

  async function generateFromText() {
    if (!textPrompt.trim()) return;
    textLoading = true;
    textError = null;
    try {
      textResult = await textToPattern(textPrompt);
    } catch (error) {
      textError = 'Failed to generate pattern.';
    } finally {
      textLoading = false;
    }
  }
  function selectTab(tab: string) {
    activeTab = tab as any;
  }
</script>

<div
  class="ai-assistant bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden font-kalice"
>
  <!-- Header: Apple style with subtle pattern -->
  <div class="relative px-6 py-5 bg-[#FBFBFD] border-b border-gray-50 overflow-hidden">
    <div class="absolute inset-0 opacity-[0.03] pointer-events-none">
      <svg viewBox="0 0 100 100" class="w-full h-full"
        ><circle cx="50" cy="50" r="40" fill="none" stroke="#000" stroke-width="0.5" /></svg
      >
    </div>
    <div class="relative z-10 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-blue-600">✨</span>
        <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-gray-900 font-sohne-halbfett">
          Intelligence
        </h3>
      </div>
      <span
        class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 font-sohne-halbfett"
        >PRO</span
      >
    </div>
  </div>

  <!-- Tabs -->
  <div
    class="flex p-1 bg-gray-50/50 m-4 rounded-xl border border-gray-100 font-sohne-halbfett"
    role="tablist"
  >
    {#each ['keywords', 'image', 'text'] as tab}
      <button
        class="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all
               {activeTab === tab
          ? 'bg-white shadow-sm text-black'
          : 'text-gray-400 hover:text-gray-600'}"
        on:click={() => selectTab(tab)}
      >
        {tab}
      </button>
    {/each}
  </div>

  <div class="p-6 pt-2">
    {#if activeTab === 'keywords'}
      <div class="space-y-6">
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={keywordInput}
            placeholder="Describe style..."
            class="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 font-kalice"
          />
          <button on:click={addCustomKeyword} class="btn btn-primary px-4 py-2 text-[10px]"
            >Add</button
          >
        </div>

        {#if selectedKeywords.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each selectedKeywords as keyword}
              <button
                on:click={() => toggleKeyword(keyword)}
                class="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100 hover:bg-blue-100 transition-colors font-sohne-halbfett"
              >
                {keyword} ✕
              </button>
            {/each}
          </div>
        {/if}

        <div class="space-y-4">
          {#each Object.entries(styleCategories) as [category, keywords]}
            <div>
              <p
                class="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2 font-sohne-halbfett"
              >
                {category}
              </p>
              <div class="flex flex-wrap gap-1.5">
                {#each keywords as keyword}
                  <button
                    on:click={() => toggleKeyword(keyword)}
                    class="px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all font-sohne-buch
                           {selectedKeywords.includes(keyword)
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
                  >
                    {keyword}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <button
          on:click={generateFromKeywords}
          disabled={selectedKeywords.length === 0 || keywordsLoading}
          class="btn btn-primary w-full py-4 text-xs bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        >
          {keywordsLoading ? 'Processing...' : 'Generate Parameters'}
        </button>

        {#if keywordsError}
          <p class="text-[10px] font-medium text-red-600 text-center" role="alert">
            {keywordsError}
          </p>
        {/if}

        {#if suggestions.length > 0}
          <div class="space-y-2 pt-4 border-t border-gray-50">
            {#each suggestions as s}
              <button
                on:click={() => applySuggestion(s)}
                class="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left hover:border-blue-200 transition-all group font-kalice"
              >
                <div class="flex justify-between items-center">
                  <span class="text-xs font-medium text-gray-700">{s.description}</span>
                  <span
                    class="text-[9px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity font-sohne-halbfett"
                    >APPLY →</span
                  >
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'image'}
      <div class="space-y-6">
        {#if !imagePreview}
          <div
            class="border-2 border-dashed border-gray-100 rounded-3xl p-12 text-center hover:border-blue-400 transition-all cursor-pointer bg-gray-50/30"
            role="button"
            tabindex="0"
            aria-label="Drop a reference image or press Enter to browse"
            on:dragover|preventDefault
            on:drop={handleImageDrop}
            on:click={() => document.getElementById('image-upload')?.click()}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('image-upload')?.click();
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              on:change={handleImageSelect}
              class="hidden"
              id="image-upload"
            />
            <div class="text-3xl mb-4">📸</div>
            <p
              class="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sohne-halbfett"
            >
              Drop Reference
            </p>
          </div>
        {:else}
          <div class="relative rounded-2xl overflow-hidden border border-gray-100">
            <img src={imagePreview} alt="Preview" class="w-full h-40 object-cover" />
            <button
              on:click={() => (imagePreview = null)}
              class="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur rounded-full text-white text-xs"
              >✕</button
            >
          </div>
          <button
            on:click={analyzeImage}
            disabled={imageLoading}
            class="btn btn-primary w-full py-4 text-xs"
          >
            {imageLoading ? 'Analyzing...' : 'Reverse Engineer'}
          </button>
        {/if}

        {#if imageError}
          <p class="text-[10px] font-medium text-red-600 text-center" role="alert">{imageError}</p>
        {/if}

        {#if recognitionResult}
          {@const recognition = recognitionResult}
          <div class="space-y-3 pt-4 border-t border-gray-50">
            <p
              class="text-[9px] font-bold text-gray-300 uppercase tracking-widest font-sohne-halbfett"
            >
              Match {Math.round(recognitionResult.confidence * 100)}%
            </p>

            {#if recognitionResult.similar_keywords.length > 0}
              <div class="flex flex-wrap gap-1.5">
                {#each recognitionResult.similar_keywords as keyword}
                  <span
                    class="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100 font-sohne-halbfett"
                  >
                    {keyword}
                  </span>
                {/each}
              </div>
            {/if}

            {#each recognitionResult.suggestions as suggestion}
              <p class="text-xs text-gray-500">{suggestion}</p>
            {/each}

            <button
              on:click={() => dispatch('apply', recognition.params)}
              class="btn btn-primary w-full py-4 text-xs bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            >
              Apply Parameters
            </button>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'text'}
      <div class="space-y-6">
        <textarea
          bind:value={textPrompt}
          placeholder="Describe the aesthetic..."
          rows="4"
          class="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 resize-none font-kalice"
        ></textarea>
        <button
          on:click={generateFromText}
          disabled={!textPrompt.trim() || textLoading}
          class="btn btn-primary w-full py-4 text-xs"
        >
          {textLoading ? 'Consulting AI...' : 'Forge Pattern'}
        </button>

        {#if textError}
          <p class="text-[10px] font-medium text-red-600 text-center" role="alert">{textError}</p>
        {/if}

        {#if textResult}
          {@const text = textResult}
          <div class="space-y-3 pt-4 border-t border-gray-50">
            <p class="text-xs text-gray-500">{textResult.interpretation}</p>

            <button
              on:click={() => dispatch('apply', text.params)}
              class="btn btn-primary w-full py-4 text-xs bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
            >
              Apply Pattern
            </button>

            {#if textResult.variations.length > 0}
              <p
                class="text-[9px] font-bold text-gray-300 uppercase tracking-widest font-sohne-halbfett"
              >
                Variations
              </p>
              <div class="grid grid-cols-3 gap-2">
                {#each textResult.variations as variation, i}
                  <button
                    on:click={() => dispatch('apply', variation)}
                    class="px-3 py-2 bg-gray-50 text-gray-500 text-[10px] font-medium rounded-lg hover:bg-gray-100 transition-all font-sohne-buch"
                  >
                    {i + 1}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-assistant {
    max-height: 70vh;
    scrollbar-width: none;
  }
  .ai-assistant::-webkit-scrollbar {
    display: none;
  }
</style>
