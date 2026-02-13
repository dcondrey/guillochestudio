<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PatternParams } from '@guilloche/shared';
  import { suggestParameters, recognizePattern, textToPattern, type ParameterSuggestion, type PatternRecognitionResult, type TextToPatternResult } from '$lib/services/ai';

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

  // Error state for user feedback
  let keywordsError: string | null = null;
  let imageError: string | null = null;
  let textError: string | null = null;

  // Predefined style keywords for quick selection
  const styleCategories = {
    'Style': ['elegant', 'modern', 'classic', 'intricate', 'minimalist', 'organic'],
    'Mood': ['calm', 'dynamic', 'luxurious', 'playful', 'mysterious', 'bold'],
    'Use Case': ['security', 'certificate', 'currency', 'decorative', 'brand', 'art'],
    'Visual': ['geometric', 'spiral', 'mandala', 'floral', 'radial', 'symmetric'],
    'Color': ['gold', 'silver', 'neon', 'monochrome', 'rainbow', 'dark'],
  };

  function toggleKeyword(keyword: string) {
    if (selectedKeywords.includes(keyword)) {
      selectedKeywords = selectedKeywords.filter(k => k !== keyword);
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

  function handleKeywordKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomKeyword();
    }
  }

  async function generateFromKeywords() {
    if (selectedKeywords.length === 0) return;

    keywordsLoading = true;
    keywordsError = null;
    try {
      suggestions = await suggestParameters(selectedKeywords);
      if (suggestions.length === 0) {
        keywordsError = 'No suggestions found. Try different keywords.';
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      keywordsError = 'Failed to generate suggestions. Please try again.';
    } finally {
      keywordsLoading = false;
    }
  }

  function applySuggestion(suggestion: ParameterSuggestion) {
    dispatch('apply', suggestion.params);
  }

  // Image handling
  function handleImageDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  }

  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      processImage(file);
    }
  }

  function processImage(file: File) {
    imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!imageFile) return;

    imageLoading = true;
    imageError = null;
    try {
      recognitionResult = await recognizePattern(imageFile);
      if (!recognitionResult) {
        imageError = 'Could not recognize pattern in image. Try a clearer image.';
      }
    } catch (error) {
      console.error('Failed to analyze image:', error);
      imageError = 'Failed to analyze image. Please try again.';
    } finally {
      imageLoading = false;
    }
  }

  function applyRecognizedPattern() {
    if (recognitionResult) {
      dispatch('applyFull', recognitionResult.params);
    }
  }

  function clearImage() {
    imageFile = null;
    imagePreview = null;
    recognitionResult = null;
  }

  // Text-to-pattern handling
  async function generateFromText() {
    if (!textPrompt.trim()) return;

    textLoading = true;
    textError = null;
    try {
      textResult = await textToPattern(textPrompt);
      if (!textResult) {
        textError = 'Could not generate pattern from description. Try being more specific.';
      }
    } catch (error) {
      console.error('Failed to generate from text:', error);
      textError = 'Failed to generate pattern. Please try again.';
    } finally {
      textLoading = false;
    }
  }

  function applyTextResult() {
    if (textResult) {
      dispatch('applyFull', textResult.params);
    }
  }

  function applyVariation(variation: PatternParams) {
    dispatch('applyFull', variation);
  }

  // Keyboard navigation for tabs
  function handleTabKeydown(event: KeyboardEvent) {
    const tabs = ['keywords', 'image', 'text'] as const;
    const currentIndex = tabs.indexOf(activeTab);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activeTab = tabs[(currentIndex + 1) % tabs.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activeTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    }
  }
</script>

<div class="ai-assistant bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
  <!-- Header -->
  <div class="px-4 py-3 bg-gray-800 border-b border-gray-700">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <h3 class="text-white font-medium">AI Assistant</h3>
      <span class="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Pro</span>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex border-b border-gray-700" role="tablist" aria-label="AI Assistant input methods">
    <button
      role="tab"
      id="tab-keywords"
      aria-controls="panel-keywords"
      aria-selected={activeTab === 'keywords'}
      tabindex={activeTab === 'keywords' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'keywords'}
      class:bg-gray-800={activeTab === 'keywords'}
      class:text-gray-400={activeTab !== 'keywords'}
      class:hover:text-gray-300={activeTab !== 'keywords'}
      on:click={() => activeTab = 'keywords'}
      on:keydown={handleTabKeydown}
    >
      Style Keywords
    </button>
    <button
      role="tab"
      id="tab-image"
      aria-controls="panel-image"
      aria-selected={activeTab === 'image'}
      tabindex={activeTab === 'image' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'image'}
      class:bg-gray-800={activeTab === 'image'}
      class:text-gray-400={activeTab !== 'image'}
      class:hover:text-gray-300={activeTab !== 'image'}
      on:click={() => activeTab = 'image'}
      on:keydown={handleTabKeydown}
    >
      Image Analysis
    </button>
    <button
      role="tab"
      id="tab-text"
      aria-controls="panel-text"
      aria-selected={activeTab === 'text'}
      tabindex={activeTab === 'text' ? 0 : -1}
      class="flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
      class:text-indigo-400={activeTab === 'text'}
      class:bg-gray-800={activeTab === 'text'}
      class:text-gray-400={activeTab !== 'text'}
      class:hover:text-gray-300={activeTab !== 'text'}
      on:click={() => activeTab = 'text'}
      on:keydown={handleTabKeydown}
    >
      Text Prompt
    </button>
  </div>

  <!-- Tab Content -->
  <div class="p-4">
    <!-- Keywords Tab -->
    {#if activeTab === 'keywords'}
      <div class="space-y-4" role="tabpanel" id="panel-keywords" aria-labelledby="tab-keywords">
        <!-- Custom keyword input -->
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={keywordInput}
            on:keydown={handleKeywordKeydown}
            placeholder="Add custom keyword..."
            class="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            on:click={addCustomKeyword}
            class="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            Add
          </button>
        </div>

        <!-- Selected keywords -->
        {#if selectedKeywords.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each selectedKeywords as keyword}
              <span class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-sm rounded-full">
                {keyword}
                <button
                  on:click={() => toggleKeyword(keyword)}
                  class="hover:text-indigo-200"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            {/each}
          </div>
        {/if}

        <!-- Style categories -->
        <div class="space-y-3 max-h-48 overflow-y-auto">
          {#each Object.entries(styleCategories) as [category, keywords]}
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">{category}</p>
              <div class="flex flex-wrap gap-1">
                {#each keywords as keyword}
                  <button
                    on:click={() => toggleKeyword(keyword)}
                    class="px-2 py-1 text-xs rounded transition-colors"
                    class:bg-indigo-600={selectedKeywords.includes(keyword)}
                    class:text-white={selectedKeywords.includes(keyword)}
                    class:bg-gray-700={!selectedKeywords.includes(keyword)}
                    class:text-gray-300={!selectedKeywords.includes(keyword)}
                    class:hover:bg-gray-600={!selectedKeywords.includes(keyword)}
                  >
                    {keyword}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <!-- Generate button -->
        <button
          on:click={generateFromKeywords}
          disabled={selectedKeywords.length === 0 || keywordsLoading}
          class="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if keywordsLoading}
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          {:else}
            Generate Suggestions
          {/if}
        </button>

        <!-- Error message -->
        {#if keywordsError}
          <div class="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            {keywordsError}
          </div>
        {/if}

        <!-- Suggestions -->
        {#if suggestions.length > 0}
          <div class="space-y-2">
            <p class="text-sm text-gray-400">Suggestions:</p>
            {#each suggestions as suggestion}
              <div class="p-3 bg-gray-800 rounded-lg border border-gray-700">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    <p class="text-sm text-white">{suggestion.description}</p>
                    <p class="text-xs text-gray-500 mt-1">
                      Confidence: {Math.round(suggestion.confidence * 100)}%
                    </p>
                  </div>
                  <button
                    on:click={() => applySuggestion(suggestion)}
                    class="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- Image Tab -->
    {:else if activeTab === 'image'}
      <div class="space-y-4" role="tabpanel" id="panel-image" aria-labelledby="tab-image">
        {#if !imagePreview}
          <!-- Upload area -->
          <div
            class="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            on:dragover|preventDefault
            on:drop={handleImageDrop}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('image-upload')?.click();
              }
            }}
            role="button"
            tabindex="0"
            aria-label="Upload an image for pattern analysis. Drop an image or press Enter to browse files."
          >
            <input
              type="file"
              accept="image/*"
              on:change={handleImageSelect}
              class="hidden"
              id="image-upload"
            />
            <label for="image-upload" class="cursor-pointer">
              <svg class="w-12 h-12 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="text-gray-400 mb-1">Drop an image or click to upload</p>
              <p class="text-xs text-gray-500">Upload a guilloche pattern to reverse-engineer its parameters</p>
            </label>
          </div>
        {:else}
          <!-- Image preview -->
          <div class="relative">
            <img src={imagePreview} alt="Preview" class="w-full h-48 object-contain bg-gray-800 rounded-lg" />
            <button
              on:click={clearImage}
              class="absolute top-2 right-2 p-1 bg-gray-900/80 text-white rounded hover:bg-gray-900 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Analyze button -->
          <button
            on:click={analyzeImage}
            disabled={imageLoading}
            class="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {#if imageLoading}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </span>
            {:else}
              Analyze Pattern
            {/if}
          </button>
        {/if}

        <!-- Error message -->
        {#if imageError}
          <div class="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            {imageError}
          </div>
        {/if}

        <!-- Recognition result -->
        {#if recognitionResult}
          <div class="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div class="flex items-start justify-between mb-3">
              <div>
                <p class="text-white font-medium">Pattern Recognized</p>
                <p class="text-sm text-gray-400">
                  Confidence: {Math.round(recognitionResult.confidence * 100)}%
                </p>
              </div>
              <button
                on:click={applyRecognizedPattern}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Apply Parameters
              </button>
            </div>

            {#if recognitionResult.suggestions.length > 0}
              <div class="mt-3 pt-3 border-t border-gray-700">
                <p class="text-xs text-gray-500 mb-2">Suggestions for improvement:</p>
                <ul class="text-sm text-gray-400 space-y-1">
                  {#each recognitionResult.suggestions as suggestion}
                    <li class="flex items-start gap-2">
                      <svg class="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {suggestion}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- Text Tab -->
    {:else if activeTab === 'text'}
      <div class="space-y-4" role="tabpanel" id="panel-text" aria-labelledby="tab-text">
        <div>
          <textarea
            bind:value={textPrompt}
            placeholder="Describe the pattern you want to create...&#10;&#10;Example: Create an elegant sunburst pattern with 8-fold symmetry, gold gradient on dark background, suitable for a luxury certificate"
            rows="4"
            class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          ></textarea>
        </div>

        <button
          on:click={generateFromText}
          disabled={!textPrompt.trim() || textLoading}
          class="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {#if textLoading}
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </span>
          {:else}
            Generate Pattern
          {/if}
        </button>

        <!-- Error message -->
        {#if textError}
          <div class="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            {textError}
          </div>
        {/if}

        <!-- Text result -->
        {#if textResult}
          <div class="space-y-3">
            <!-- Main result -->
            <div class="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <p class="text-white font-medium">Generated Pattern</p>
                  <p class="text-sm text-gray-400">{textResult.interpretation}</p>
                </div>
                <button
                  on:click={applyTextResult}
                  class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <!-- Variations -->
            {#if textResult.variations.length > 0}
              <div>
                <p class="text-sm text-gray-400 mb-2">Variations:</p>
                <div class="grid grid-cols-2 gap-2">
                  {#each textResult.variations as variation, i}
                    <button
                      on:click={() => applyVariation(variation)}
                      class="p-3 bg-gray-800 rounded border border-gray-700 hover:border-indigo-500 transition-colors text-left"
                    >
                      <p class="text-sm text-white">Variation {i + 1}</p>
                      <p class="text-xs text-gray-500">
                        {variation.family} • k={variation.k}
                      </p>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Example prompts -->
        <div class="pt-2">
          <p class="text-xs text-gray-500 mb-2">Try these examples:</p>
          <div class="space-y-1">
            {#each [
              'Create a spiral pattern like a nautilus shell with ocean blue colors',
              'Design a complex mandala with 12-fold symmetry in gold and purple',
              'Generate a modern minimalist pattern with clean lines and subtle gradients',
              'Make a security-style guilloche pattern for a certificate'
            ] as example}
              <button
                on:click={() => textPrompt = example}
                class="block w-full text-left px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                "{example}"
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .ai-assistant {
    max-height: 600px;
    overflow-y: auto;
  }
</style>
