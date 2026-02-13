<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { PatternParams } from '@guilloche/shared';
  import {
    createDNALink,
    createEmbedCode,
    shareToSocial,
    copyToClipboard,
    nativeShare,
    generateQRCode,
    downloadQRCode,
  } from '$lib/services/sharing';

  const dispatch = createEventDispatcher<{ close: void }>();

  export let params: PatternParams;
  export let patternName = 'Guilloché Pattern';

  let dna = '';
  let shareUrl = '';
  let qrCodeUrl = '';
  let embedCode = '';
  let activeTab: 'link' | 'embed' | 'qr' = 'link';
  let copied = false;
  let embedWidth = 400;
  let embedHeight = 400;
  let embedTheme: 'light' | 'dark' = 'dark';

  onMount(async () => {
    const result = createDNALink(params);
    dna = result.dna;
    shareUrl = result.url;

    // Generate QR code
    qrCodeUrl = await generateQRCode(shareUrl, 200);

    // Generate embed code
    updateEmbedCode();
  });

  function updateEmbedCode() {
    embedCode = createEmbedCode(dna, {
      width: embedWidth,
      height: embedHeight,
      theme: embedTheme,
    });
  }

  $: if (embedWidth || embedHeight || embedTheme) {
    updateEmbedCode();
  }

  async function handleCopy(text: string) {
    const success = await copyToClipboard(text);
    if (success) {
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  async function handleNativeShare() {
    await nativeShare({
      title: patternName,
      description: 'Check out this guilloché pattern I created!',
      url: shareUrl,
    });
  }

  function handleSocialShare(platform: 'twitter' | 'facebook' | 'linkedin' | 'pinterest' | 'reddit') {
    shareToSocial(platform, shareUrl, {
      title: patternName,
      description: 'Check out this guilloché pattern I created!',
    });
  }

  async function handleDownloadQR() {
    await downloadQRCode(shareUrl, `${patternName.replace(/\s+/g, '-')}-qr.png`);
  }

  // Handle Escape key to close modal
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
    }
  }

  // Keyboard navigation for tabs
  function handleTabKeydown(event: KeyboardEvent) {
    const tabs = ['link', 'embed', 'qr'] as const;
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

<svelte:window on:keydown={handleKeydown} />

<div
  class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
  on:click|self={() => dispatch('close')}
  role="presentation"
>
  <div
    class="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
    role="dialog"
    aria-modal="true"
    aria-labelledby="share-modal-title"
  >
    <!-- Header -->
    <div class="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
      <div class="flex items-center justify-between">
        <h2 id="share-modal-title" class="text-xl font-semibold">Share Pattern</h2>
        <button
          on:click={() => dispatch('close')}
          class="p-1 hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close share modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p class="text-sm text-white/80 mt-1">Share your pattern with a unique DNA code</p>
    </div>

    <!-- DNA Code Display -->
    <div class="px-6 py-4 bg-gray-50 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">Pattern DNA</p>
          <p class="text-2xl font-mono font-bold text-gray-900 tracking-wider">{dna}</p>
        </div>
        <button
          on:click={() => handleCopy(dna)}
          class="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          {#if copied}
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-gray-200" role="tablist" aria-label="Sharing options">
      <button
        role="tab"
        id="share-tab-link"
        aria-controls="share-panel-link"
        aria-selected={activeTab === 'link'}
        tabindex={activeTab === 'link' ? 0 : -1}
        class="flex-1 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        class:text-indigo-600={activeTab === 'link'}
        class:border-b-2={activeTab === 'link'}
        class:border-indigo-600={activeTab === 'link'}
        class:text-gray-500={activeTab !== 'link'}
        on:click={() => activeTab = 'link'}
        on:keydown={handleTabKeydown}
      >
        Share Link
      </button>
      <button
        role="tab"
        id="share-tab-embed"
        aria-controls="share-panel-embed"
        aria-selected={activeTab === 'embed'}
        tabindex={activeTab === 'embed' ? 0 : -1}
        class="flex-1 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        class:text-indigo-600={activeTab === 'embed'}
        class:border-b-2={activeTab === 'embed'}
        class:border-indigo-600={activeTab === 'embed'}
        class:text-gray-500={activeTab !== 'embed'}
        on:click={() => activeTab = 'embed'}
        on:keydown={handleTabKeydown}
      >
        Embed
      </button>
      <button
        role="tab"
        id="share-tab-qr"
        aria-controls="share-panel-qr"
        aria-selected={activeTab === 'qr'}
        tabindex={activeTab === 'qr' ? 0 : -1}
        class="flex-1 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
        class:text-indigo-600={activeTab === 'qr'}
        class:border-b-2={activeTab === 'qr'}
        class:border-indigo-600={activeTab === 'qr'}
        class:text-gray-500={activeTab !== 'qr'}
        on:click={() => activeTab = 'qr'}
        on:keydown={handleTabKeydown}
      >
        QR Code
      </button>
    </div>

    <!-- Tab Content -->
    <div class="p-6">
      {#if activeTab === 'link'}
        <!-- Share Link -->
        <div class="space-y-4" role="tabpanel" id="share-panel-link" aria-labelledby="share-tab-link">
          <!-- URL Input -->
          <div>
            <label for="share-url-input" class="block text-sm font-medium text-gray-700 mb-2">Share URL</label>
            <div class="flex gap-2">
              <input
                id="share-url-input"
                type="text"
                value={shareUrl}
                readonly
                class="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono"
                aria-describedby="share-url-description"
              />
              <button
                on:click={() => handleCopy(shareUrl)}
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Copy share URL to clipboard"
              >
                Copy
              </button>
            </div>
            <span id="share-url-description" class="sr-only">Shareable link to this pattern</span>
          </div>

          <!-- Native Share Button -->
          {#if typeof navigator !== 'undefined' && 'share' in navigator}
            <button
              on:click={handleNativeShare}
              class="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share
            </button>
          {/if}

          <!-- Social Buttons -->
          <div class="grid grid-cols-5 gap-2">
            <button
              on:click={() => handleSocialShare('twitter')}
              class="p-3 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Share on Twitter"
            >
              <svg class="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </button>
            <button
              on:click={() => handleSocialShare('facebook')}
              class="p-3 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Share on Facebook"
            >
              <svg class="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
            <button
              on:click={() => handleSocialShare('linkedin')}
              class="p-3 bg-[#0A66C2] text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Share on LinkedIn"
            >
              <svg class="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </button>
            <button
              on:click={() => handleSocialShare('pinterest')}
              class="p-3 bg-[#BD081C] text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Share on Pinterest"
            >
              <svg class="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
              </svg>
            </button>
            <button
              on:click={() => handleSocialShare('reddit')}
              class="p-3 bg-[#FF4500] text-white rounded-lg hover:opacity-90 transition-opacity"
              title="Share on Reddit"
            >
              <svg class="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
            </button>
          </div>
        </div>

      {:else if activeTab === 'embed'}
        <!-- Embed Code -->
        <div class="space-y-4" role="tabpanel" id="share-panel-embed" aria-labelledby="share-tab-embed">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label for="embed-width" class="block text-xs text-gray-500 mb-1">Width</label>
              <input
                id="embed-width"
                type="number"
                bind:value={embedWidth}
                min="200"
                max="1200"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label for="embed-height" class="block text-xs text-gray-500 mb-1">Height</label>
              <input
                id="embed-height"
                type="number"
                bind:value={embedHeight}
                min="200"
                max="1200"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label for="embed-theme" class="block text-xs text-gray-500 mb-1">Theme</label>
              <select
                id="embed-theme"
                bind:value={embedTheme}
                class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>

          <div>
            <label for="embed-code" class="block text-sm font-medium text-gray-700 mb-2">Embed Code</label>
            <div class="relative">
              <textarea
                id="embed-code"
                value={embedCode}
                readonly
                rows="4"
                class="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 resize-none"
              ></textarea>
              <button
                on:click={() => handleCopy(embedCode)}
                class="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
              >
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      {:else if activeTab === 'qr'}
        <!-- QR Code -->
        <div class="text-center space-y-4" role="tabpanel" id="share-panel-qr" aria-labelledby="share-tab-qr">
          {#if qrCodeUrl}
            <div class="inline-block p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <img src={qrCodeUrl} alt="QR Code" class="w-48 h-48" />
            </div>
          {:else}
            <div class="w-48 h-48 mx-auto bg-gray-100 rounded-lg animate-pulse"></div>
          {/if}

          <p class="text-sm text-gray-500">Scan to view the pattern</p>

          <button
            on:click={handleDownloadQR}
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR Code
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
