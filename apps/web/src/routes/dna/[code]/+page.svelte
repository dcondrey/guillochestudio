<!--
  DNA Share Page

  SSR-rendered page for social sharing. Features:
  - Full OG/Twitter meta tags from server
  - QR code display
  - Copy-to-clipboard with feedback
  - Social sharing buttons
  - Embed code snippet
  - Open in Studio / Remix buttons
-->
<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let canvas: HTMLCanvasElement;
  let loading = true;
  let renderError = '';
  let copied: 'link' | 'embed' | null = null;
  let showEmbed = false;

  // Render pattern on mount
  onMount(() => {
    if (!data.found || !data.pattern?.params) return;

    const renderPattern = async () => {
      try {
        const { GuillocheEngine, CanvasRenderer } = await import('@guilloche/core');

        const engine = new GuillocheEngine(data.pattern!.params);
        const path = engine.computePath();

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        const renderer = new CanvasRenderer(ctx, canvas.width, canvas.height);
        renderer.render(path);

        loading = false;
      } catch (err) {
        console.error('Failed to render pattern:', err);
        renderError = 'Failed to render pattern';
        loading = false;
      }
    };

    renderPattern();
  });

  function openInStudio() {
    goto(`/studio?dna=${data.code}`);
  }

  function remixPattern() {
    goto(`/studio?remix=${data.code}`);
  }

  async function copyToClipboard(type: 'link' | 'embed') {
    if (!browser) return;

    const text = type === 'link' ? data.shareUrl : data.embedCode;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copied = type;
      setTimeout(() => {
        copied = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function shareToTwitter() {
    if (!browser || !data.shareUrl) return;
    const text = encodeURIComponent(`Check out this geometric pattern I found on Guilloché Studio!`);
    const url = encodeURIComponent(data.shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }

  function shareToFacebook() {
    if (!browser || !data.shareUrl) return;
    const url = encodeURIComponent(data.shareUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  }
</script>

<svelte:head>
  <title>{data.meta.title}</title>
  <meta name="description" content={data.meta.description} />

  <!-- Open Graph -->
  <meta property="og:title" content={data.meta.title} />
  <meta property="og:description" content={data.meta.description} />
  <meta property="og:image" content={data.meta.image} />
  <meta property="og:url" content={data.meta.url} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Guilloché Studio" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.meta.title} />
  <meta name="twitter:description" content={data.meta.description} />
  <meta name="twitter:image" content={data.meta.image} />

  <!-- Canonical -->
  <link rel="canonical" href={data.meta.url} />
</svelte:head>

<div class="dna-page">
  <!-- Header -->
  <header class="dna-header">
    <div class="header-content">
      <a href="/" class="logo">
        Guilloché Studio
      </a>
      <nav class="header-actions">
        {#if data.found}
          <button
            on:click={() => copyToClipboard('link')}
            class="btn btn-secondary"
          >
            {copied === 'link' ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            on:click={remixPattern}
            class="btn btn-secondary"
          >
            Remix
          </button>
          <button
            on:click={openInStudio}
            class="btn btn-primary"
          >
            Open in Studio
          </button>
        {/if}
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="dna-main">
    {#if !data.found}
      <!-- Not Found State -->
      <div class="error-state">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1>Pattern Not Found</h1>
        <p>This pattern DNA link may be invalid or the pattern has been deleted.</p>
        <a href="/studio" class="btn btn-primary">
          Create Your Own
        </a>
      </div>
    {:else if renderError}
      <!-- Render Error State -->
      <div class="error-state">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1>Render Error</h1>
        <p>{renderError}</p>
        <button on:click={openInStudio} class="btn btn-primary">
          Try in Studio
        </button>
      </div>
    {:else}
      <!-- Pattern Display -->
      <div class="pattern-container">
        <div class="canvas-wrapper">
          {#if loading}
            <div class="loading-overlay">
              <div class="spinner"></div>
              <p>Loading pattern...</p>
            </div>
          {/if}
          <canvas
            bind:this={canvas}
            width="800"
            height="800"
            class="pattern-canvas"
            class:loading
          ></canvas>
        </div>

        <!-- Pattern Info Sidebar -->
        <aside class="pattern-info">
          <div class="info-section">
            <h1 class="pattern-name">{data.pattern?.name || 'Shared Pattern'}</h1>
            {#if data.creator}
              <p class="creator">
                by <span class="creator-name">{data.creator.displayName || 'Anonymous'}</span>
              </p>
            {/if}
          </div>

          <div class="info-section">
            <h2>DNA Code</h2>
            <div class="dna-code-display">
              <code>{data.code}</code>
              <button
                on:click={() => copyToClipboard('link')}
                class="copy-btn"
                title="Copy share link"
              >
                {#if copied === 'link'}
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                {:else}
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          <!-- Share Buttons -->
          <div class="info-section">
            <h2>Share</h2>
            <div class="share-buttons">
              <button on:click={shareToTwitter} class="share-btn twitter" title="Share on Twitter">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
              <button on:click={shareToFacebook} class="share-btn facebook" title="Share on Facebook">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Embed Code -->
          <div class="info-section">
            <button on:click={() => showEmbed = !showEmbed} class="embed-toggle">
              <h2>Embed Code</h2>
              <svg class="chevron" class:open={showEmbed} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {#if showEmbed && data.embedCode}
              <div class="embed-code">
                <pre><code>{data.embedCode}</code></pre>
                <button
                  on:click={() => copyToClipboard('embed')}
                  class="btn btn-small"
                >
                  {copied === 'embed' ? 'Copied!' : 'Copy Embed'}
                </button>
              </div>
            {/if}
          </div>

          <!-- Pattern Properties -->
          {#if data.pattern?.params}
            <div class="info-section">
              <h2>Properties</h2>
              <dl class="properties">
                <div class="prop">
                  <dt>Family</dt>
                  <dd>{data.pattern.params.family}</dd>
                </div>
                <div class="prop">
                  <dt>Steps</dt>
                  <dd>{data.pattern.params.steps?.toLocaleString()}</dd>
                </div>
                <div class="prop">
                  <dt>Symmetry</dt>
                  <dd>{data.pattern.params.symmetry}x</dd>
                </div>
              </dl>
            </div>
          {/if}
        </aside>
      </div>
    {/if}
  </main>
</div>

<style>
  .dna-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary, #0f172a);
    color: var(--color-text-primary, #f1f5f9);
  }

  /* Header */
  .dna-header {
    background: var(--color-bg-secondary, #1e293b);
    border-bottom: 1px solid var(--color-border, #334155);
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  }

  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary, #f1f5f9);
    text-decoration: none;
  }

  .header-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  /* Buttons */
  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: var(--radius-md, 0.5rem);
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .btn-primary {
    background: var(--color-primary, #3b82f6);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover, #2563eb);
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-text-secondary, #94a3b8);
    border: 1px solid var(--color-border, #334155);
  }

  .btn-secondary:hover {
    color: var(--color-text-primary, #f1f5f9);
    border-color: var(--color-border-hover, #475569);
  }

  .btn-small {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: 0.75rem;
    background: var(--color-bg-tertiary, #334155);
    color: var(--color-text-secondary, #94a3b8);
  }

  /* Main */
  .dna-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6, 1.5rem);
  }

  /* Error State */
  .error-state {
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    width: 4rem;
    height: 4rem;
    color: var(--color-text-muted, #64748b);
    margin-bottom: var(--space-4, 1rem);
  }

  .error-state h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .error-state p {
    color: var(--color-text-secondary, #94a3b8);
    margin-bottom: var(--space-6, 1.5rem);
  }

  /* Pattern Container */
  .pattern-container {
    display: flex;
    gap: var(--space-8, 2rem);
    max-width: 1200px;
    width: 100%;
  }

  .canvas-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .pattern-canvas {
    display: block;
    border-radius: var(--radius-lg, 0.75rem);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    transition: opacity 0.3s ease;
  }

  .pattern-canvas.loading {
    opacity: 0.3;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.8);
    border-radius: var(--radius-lg, 0.75rem);
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid var(--color-border, #334155);
    border-top-color: var(--color-primary, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-overlay p {
    margin-top: var(--space-3, 0.75rem);
    color: var(--color-text-secondary, #94a3b8);
  }

  /* Sidebar */
  .pattern-info {
    flex: 1;
    min-width: 280px;
    max-width: 360px;
  }

  .info-section {
    padding: var(--space-4, 1rem) 0;
    border-bottom: 1px solid var(--color-border, #334155);
  }

  .info-section:last-child {
    border-bottom: none;
  }

  .info-section h2 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #64748b);
    margin-bottom: var(--space-2, 0.5rem);
  }

  .pattern-name {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-1, 0.25rem);
  }

  .creator {
    color: var(--color-text-secondary, #94a3b8);
    font-size: 0.875rem;
  }

  .creator-name {
    color: var(--color-primary, #3b82f6);
  }

  /* DNA Code Display */
  .dna-code-display {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    background: var(--color-bg-tertiary, #1e293b);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
    font-family: var(--font-mono, ui-monospace, monospace);
  }

  .dna-code-display code {
    flex: 1;
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: 0.1em;
  }

  .copy-btn {
    background: none;
    border: none;
    padding: var(--space-1, 0.25rem);
    cursor: pointer;
    color: var(--color-text-muted, #64748b);
    transition: color 0.15s ease;
  }

  .copy-btn:hover {
    color: var(--color-text-primary, #f1f5f9);
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Share Buttons */
  .share-buttons {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .share-btn {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md, 0.5rem);
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .share-btn:hover {
    transform: scale(1.05);
  }

  .share-btn .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .share-btn.twitter {
    background: #1da1f2;
    color: white;
  }

  .share-btn.facebook {
    background: #4267b2;
    color: white;
  }

  /* Embed Code */
  .embed-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .embed-toggle h2 {
    margin: 0;
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-text-muted, #64748b);
    transition: transform 0.2s ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .embed-code {
    margin-top: var(--space-3, 0.75rem);
  }

  .embed-code pre {
    background: var(--color-bg-tertiary, #0f172a);
    padding: var(--space-3, 0.75rem);
    border-radius: var(--radius-md, 0.5rem);
    overflow-x: auto;
    font-size: 0.75rem;
    margin-bottom: var(--space-2, 0.5rem);
  }

  .embed-code code {
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--color-text-secondary, #94a3b8);
  }

  /* Properties */
  .properties {
    display: grid;
    gap: var(--space-2, 0.5rem);
  }

  .prop {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .prop dt {
    color: var(--color-text-muted, #64748b);
  }

  .prop dd {
    font-weight: 500;
    text-transform: capitalize;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .pattern-container {
      flex-direction: column;
      align-items: center;
    }

    .canvas-wrapper {
      width: 100%;
      max-width: 500px;
    }

    .pattern-canvas {
      width: 100%;
      height: auto;
    }

    .pattern-info {
      max-width: 500px;
      width: 100%;
    }
  }

  @media (max-width: 600px) {
    .header-actions {
      flex-wrap: wrap;
    }

    .btn {
      padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
      font-size: 0.8125rem;
    }
  }
</style>
