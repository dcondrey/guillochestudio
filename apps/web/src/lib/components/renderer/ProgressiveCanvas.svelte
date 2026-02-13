<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    ProgressiveRenderer,
    createProgressiveRenderer,
    type RenderConfig,
    type RenderState,
    type RenderResult,
  } from '$lib/services/progressive-renderer';
  import type { PatternParams } from '@guilloche/shared';

  // Props
  export let params: PatternParams | null = null;
  export let width = 800;
  export let height = 800;
  export let config: Partial<RenderConfig> = {};
  export let autoRender = true;
  export let showStats = false;
  export let showProgress = true;

  // Bindable state (exported for parent components)
  export let state: RenderState | null = null;

  // Internal state
  let canvas: HTMLCanvasElement;
  let renderer: ProgressiveRenderer | null = null;
  let result: RenderResult | null = null;
  let unsubscribeState: (() => void) | null = null;
  let unsubscribeResult: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    renderStart: void;
    renderComplete: RenderResult;
    renderError: Error;
    renderAbort: void;
  }>();

  // Initialize renderer
  onMount(() => {
    renderer = createProgressiveRenderer(config);
    renderer.attach(canvas);

    // Subscribe to state changes
    unsubscribeState = renderer.state.subscribe((s) => {
      state = s;

      if (s.status === 'rendering' && s.progress === 0) {
        dispatch('renderStart');
      }

      if (s.status === 'error' && s.error) {
        dispatch('renderError', new Error(s.error));
      }
    });

    unsubscribeResult = renderer.result.subscribe((r) => {
      if (r) {
        result = r;
        dispatch('renderComplete', r);
      }
    });

    // Auto-render if params provided
    if (autoRender && params) {
      render();
    }
  });

  // Cleanup
  onDestroy(() => {
    unsubscribeState?.();
    unsubscribeResult?.();
    renderer?.dispose();
  });

  // Watch for param changes
  $: if (autoRender && params && renderer) {
    render();
  }

  // Watch for config changes
  $: if (renderer && config) {
    renderer.configure(config);
  }

  // Public methods
  export async function render(): Promise<RenderResult | null> {
    if (!renderer || !params) return null;
    return renderer.render(params);
  }

  export function abort(): void {
    renderer?.abort();
    dispatch('renderAbort');
  }

  export function pause(): void {
    renderer?.pause();
  }

  export function resume(): void {
    renderer?.resume();
  }

  export function getResult(): RenderResult | null {
    return result;
  }

  // Format time
  function formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  // Format number with commas
  function formatNumber(n: number): string {
    return n.toLocaleString();
  }
</script>

<div class="progressive-canvas" style="width: {width}px; height: {height}px;">
  <canvas
    bind:this={canvas}
    {width}
    {height}
    class="render-canvas"
    class:rendering={state?.status === 'rendering'}
  />

  {#if showProgress && state && ['initializing', 'rendering'].includes(state.status)}
    <div class="progress-overlay">
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {state.progress}%"
        />
      </div>
      <div class="progress-text">
        {Math.round(state.progress)}%
      </div>
      <div class="progress-details">
        <span>{formatNumber(state.renderedPoints)} / {formatNumber(state.totalPoints)} points</span>
        <span class="separator">|</span>
        <span>{formatTime(state.elapsedTime)} elapsed</span>
        {#if state.estimatedTimeRemaining > 0}
          <span class="separator">|</span>
          <span>~{formatTime(state.estimatedTimeRemaining)} remaining</span>
        {/if}
      </div>
      <button class="abort-button" on:click={abort}>
        Cancel
      </button>
    </div>
  {/if}

  {#if showStats && state?.status === 'completed' && result}
    <div class="stats-panel">
      <div class="stat">
        <span class="stat-label">Engine:</span>
        <span class="stat-value">{result.stats.engineType.toUpperCase()}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Total Time:</span>
        <span class="stat-value">{formatTime(result.stats.totalTime)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Points:</span>
        <span class="stat-value">{formatNumber(result.pointCount)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Avg FPS:</span>
        <span class="stat-value">{result.stats.averageFps}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Peak FPS:</span>
        <span class="stat-value">{result.stats.peakFps}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Path Length:</span>
        <span class="stat-value">{result.pathLength.toFixed(1)} units</span>
      </div>
    </div>
  {/if}

  {#if state?.status === 'error'}
    <div class="error-overlay">
      <div class="error-icon">!</div>
      <div class="error-message">{state.error}</div>
      <button class="retry-button" on:click={render}>
        Retry
      </button>
    </div>
  {/if}

  {#if state?.status === 'paused'}
    <div class="paused-overlay">
      <div class="paused-text">Paused</div>
      <button class="resume-button" on:click={resume}>
        Resume
      </button>
    </div>
  {/if}
</div>

<style>
  .progressive-canvas {
    position: relative;
    display: inline-block;
    background: var(--canvas-bg, #ffffff);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .render-canvas {
    display: block;
    transition: opacity 0.2s ease;
  }

  .render-canvas.rendering {
    opacity: 0.95;
  }

  .progress-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4));
    color: white;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #7c3aed);
    border-radius: 2px;
    transition: width 0.1s ease;
  }

  .progress-text {
    font-size: 24px;
    font-weight: 600;
    text-align: center;
  }

  .progress-details {
    font-size: 12px;
    text-align: center;
    opacity: 0.8;
  }

  .separator {
    margin: 0 8px;
    opacity: 0.5;
  }

  .abort-button {
    align-self: center;
    padding: 6px 16px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .abort-button:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .stats-panel {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 6px;
    color: white;
    font-size: 11px;
    display: grid;
    gap: 4px;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .stat-label {
    opacity: 0.7;
  }

  .stat-value {
    font-weight: 500;
    font-family: monospace;
  }

  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    gap: 12px;
  }

  .error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 3px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
  }

  .error-message {
    font-size: 14px;
    max-width: 80%;
    text-align: center;
  }

  .retry-button {
    padding: 8px 20px;
    background: white;
    border: none;
    border-radius: 4px;
    color: #ef4444;
    font-weight: 500;
    cursor: pointer;
  }

  .paused-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    gap: 16px;
  }

  .paused-text {
    font-size: 24px;
    font-weight: 600;
  }

  .resume-button {
    padding: 10px 24px;
    background: #4f46e5;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .resume-button:hover {
    background: #4338ca;
  }
</style>
