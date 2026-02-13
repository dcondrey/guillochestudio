<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { RenderConfig, RenderState, RenderResult } from '$lib/services/progressive-renderer';
  import { detectCapabilities, type EngineCapabilities } from '$lib/services/wasm-engine';
  import { onMount } from 'svelte';

  // Props
  export let state: RenderState | null = null;
  export let config: Partial<RenderConfig> = {};
  export let disabled = false;

  // State
  let capabilities: EngineCapabilities | null = null;
  let showAdvanced = false;

  const dispatch = createEventDispatcher<{
    configChange: Partial<RenderConfig>;
    render: void;
    abort: void;
    pause: void;
    resume: void;
  }>();

  onMount(async () => {
    capabilities = await detectCapabilities();
  });

  // Config values with defaults
  $: quality = config.quality ?? 'normal';
  $: preferWasm = config.preferWasm ?? true;
  $: chunkSize = config.chunkSize ?? 2000;
  $: targetFPS = config.targetFPS ?? 60;
  $: antiAlias = config.antiAlias ?? true;
  $: lineWidthScale = config.lineWidthScale ?? 1;
  $: showProgressOverlay = config.showProgress ?? true;

  // Update config
  function updateConfig(changes: Partial<RenderConfig>) {
    config = { ...config, ...changes };
    dispatch('configChange', config);
  }

  // Quality presets
  const qualityPresets = [
    { value: 'draft', label: 'Draft', description: 'Fast preview' },
    { value: 'normal', label: 'Normal', description: 'Balanced' },
    { value: 'high', label: 'High', description: 'More detail' },
    { value: 'ultra', label: 'Ultra', description: 'Maximum quality' },
  ] as const;

  // Format time
  function formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<div class="render-controller" class:disabled>
  <!-- Status Bar -->
  {#if state}
    <div class="status-bar" class:rendering={state.status === 'rendering'}>
      <div
        class="status-indicator"
        class:idle={state.status === 'idle'}
        class:rendering={state.status === 'rendering'}
        class:completed={state.status === 'completed'}
        class:error={state.status === 'error'}
      />
      <span class="status-text">
        {#if state.status === 'idle'}
          Ready
        {:else if state.status === 'initializing'}
          Initializing...
        {:else if state.status === 'rendering'}
          Rendering {Math.round(state.progress)}%
        {:else if state.status === 'paused'}
          Paused
        {:else if state.status === 'completed'}
          Complete
        {:else if state.status === 'error'}
          Error
        {/if}
      </span>
      {#if state.status === 'rendering'}
        <span class="status-meta">
          {state.fps} FPS | {state.pointsPerSecond.toLocaleString()} pts/s
        </span>
      {/if}
      {#if state.usingWasm && state.status !== 'idle'}
        <span class="engine-badge wasm">WASM</span>
      {:else if state.status !== 'idle'}
        <span class="engine-badge js">JS</span>
      {/if}
    </div>
  {/if}

  <!-- Controls -->
  <div class="controls">
    <div class="control-row">
      <div class="control-group">
        <label class="control-label">Quality</label>
        <div class="quality-selector">
          {#each qualityPresets as preset}
            <button
              class="quality-button"
              class:active={quality === preset.value}
              on:click={() => updateConfig({ quality: preset.value })}
              title={preset.description}
              {disabled}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="control-group">
        <label class="control-label">Engine</label>
        <div class="engine-selector">
          <button
            class="engine-button"
            class:active={preferWasm}
            on:click={() => updateConfig({ preferWasm: true })}
            disabled={disabled || !capabilities?.wasm}
            title={capabilities?.wasm
              ? 'Use WebAssembly engine (faster)'
              : 'WebAssembly not available'}
          >
            WASM
            {#if capabilities?.simd}
              <span class="feature-badge">SIMD</span>
            {/if}
          </button>
          <button
            class="engine-button"
            class:active={!preferWasm}
            on:click={() => updateConfig({ preferWasm: false })}
            {disabled}
            title="Use JavaScript engine"
          >
            JS
          </button>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      {#if state?.status === 'rendering'}
        <button class="action-button pause" on:click={() => dispatch('pause')} {disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          Pause
        </button>
        <button class="action-button abort" on:click={() => dispatch('abort')} {disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
            />
          </svg>
          Cancel
        </button>
      {:else if state?.status === 'paused'}
        <button class="action-button resume" on:click={() => dispatch('resume')} {disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Resume
        </button>
        <button class="action-button abort" on:click={() => dispatch('abort')} {disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
            />
          </svg>
          Cancel
        </button>
      {:else}
        <button class="action-button render" on:click={() => dispatch('render')} {disabled}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Render
        </button>
      {/if}
    </div>

    <!-- Advanced Settings Toggle -->
    <button class="advanced-toggle" on:click={() => (showAdvanced = !showAdvanced)} {disabled}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        style="transform: rotate({showAdvanced ? 180 : 0}deg); transition: transform 0.2s"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      Advanced Settings
    </button>

    <!-- Advanced Settings Panel -->
    {#if showAdvanced}
      <div class="advanced-settings">
        <div class="setting-row">
          <label for="chunkSize">Chunk Size</label>
          <input
            id="chunkSize"
            type="range"
            min="500"
            max="10000"
            step="500"
            value={chunkSize}
            on:input={(e) => updateConfig({ chunkSize: parseInt(e.currentTarget.value) })}
            {disabled}
          />
          <span class="setting-value">{chunkSize.toLocaleString()}</span>
        </div>

        <div class="setting-row">
          <label for="targetFPS">Target FPS</label>
          <input
            id="targetFPS"
            type="range"
            min="15"
            max="120"
            step="5"
            value={targetFPS}
            on:input={(e) => updateConfig({ targetFPS: parseInt(e.currentTarget.value) })}
            {disabled}
          />
          <span class="setting-value">{targetFPS}</span>
        </div>

        <div class="setting-row">
          <label for="lineWidthScale">Line Width</label>
          <input
            id="lineWidthScale"
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            value={lineWidthScale}
            on:input={(e) => updateConfig({ lineWidthScale: parseFloat(e.currentTarget.value) })}
            {disabled}
          />
          <span class="setting-value">{lineWidthScale}x</span>
        </div>

        <div class="setting-row checkbox">
          <label>
            <input
              type="checkbox"
              checked={antiAlias}
              on:change={(e) => updateConfig({ antiAlias: e.currentTarget.checked })}
              {disabled}
            />
            Anti-aliasing
          </label>
        </div>

        <div class="setting-row checkbox">
          <label>
            <input
              type="checkbox"
              checked={showProgressOverlay}
              on:change={(e) => updateConfig({ showProgress: e.currentTarget.checked })}
              {disabled}
            />
            Show Progress Overlay
          </label>
        </div>
      </div>
    {/if}
  </div>

  <!-- Capabilities Info -->
  {#if capabilities}
    <div class="capabilities">
      <span class="capability" class:supported={capabilities.wasm}>
        <span class="capability-icon">{capabilities.wasm ? '✓' : '×'}</span>
        WASM
      </span>
      <span class="capability" class:supported={capabilities.simd}>
        <span class="capability-icon">{capabilities.simd ? '✓' : '×'}</span>
        SIMD
      </span>
      <span class="capability" class:supported={capabilities.threads}>
        <span class="capability-icon">{capabilities.threads ? '✓' : '×'}</span>
        Threads
      </span>
    </div>
  {/if}
</div>

<style>
  .render-controller {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--panel-bg, #f8fafc);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .render-controller.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: white;
    border-radius: 6px;
    font-size: 13px;
  }

  .status-bar.rendering {
    background: linear-gradient(90deg, #eef2ff, #e0e7ff);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
  }

  .status-indicator.idle {
    background: #94a3b8;
  }
  .status-indicator.rendering {
    background: #4f46e5;
    animation: blink 1s ease-in-out infinite;
  }
  .status-indicator.completed {
    background: #22c55e;
  }
  .status-indicator.error {
    background: #ef4444;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .status-text {
    font-weight: 500;
  }

  .status-meta {
    color: #64748b;
    font-size: 12px;
    margin-left: auto;
  }

  .engine-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .engine-badge.wasm {
    background: #dcfce7;
    color: #166534;
  }

  .engine-badge.js {
    background: #fef3c7;
    color: #92400e;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .control-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.05em;
  }

  .quality-selector,
  .engine-selector {
    display: flex;
    gap: 4px;
  }

  .quality-button,
  .engine-button {
    padding: 6px 12px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quality-button:hover,
  .engine-button:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  .quality-button.active,
  .engine-button.active {
    background: #4f46e5;
    border-color: #4f46e5;
    color: white;
  }

  .quality-button:disabled,
  .engine-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feature-badge {
    margin-left: 4px;
    padding: 1px 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    font-size: 9px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-button.render {
    background: #4f46e5;
    color: white;
  }

  .action-button.render:hover {
    background: #4338ca;
  }

  .action-button.pause {
    background: #f59e0b;
    color: white;
  }

  .action-button.pause:hover {
    background: #d97706;
  }

  .action-button.resume {
    background: #22c55e;
    color: white;
  }

  .action-button.resume:hover {
    background: #16a34a;
  }

  .action-button.abort {
    background: #ef4444;
    color: white;
  }

  .action-button.abort:hover {
    background: #dc2626;
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .advanced-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: none;
    border: none;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .advanced-toggle:hover {
    color: #475569;
  }

  .advanced-settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-row label {
    min-width: 100px;
    font-size: 12px;
    color: #475569;
  }

  .setting-row input[type='range'] {
    flex: 1;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    appearance: none;
  }

  .setting-row input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
  }

  .setting-value {
    min-width: 60px;
    text-align: right;
    font-size: 12px;
    font-family: monospace;
    color: #64748b;
  }

  .setting-row.checkbox {
    gap: 8px;
  }

  .setting-row.checkbox label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: auto;
    cursor: pointer;
  }

  .setting-row.checkbox input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: #4f46e5;
  }

  .capabilities {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
  }

  .capability {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #94a3b8;
  }

  .capability.supported {
    color: #22c55e;
  }

  .capability-icon {
    font-size: 10px;
  }
</style>
