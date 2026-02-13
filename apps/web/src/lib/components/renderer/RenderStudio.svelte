<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import ProgressiveCanvas from './ProgressiveCanvas.svelte';
  import RenderController from './RenderController.svelte';
  import {
    ProgressiveRenderer,
    createProgressiveRenderer,
    type RenderConfig,
    type RenderState,
    type RenderResult,
    DEFAULT_RENDER_CONFIG,
  } from '$lib/services/progressive-renderer';
  import type { PatternParams } from '@guilloche/shared';

  // Props
  export let params: PatternParams | null = null;
  export let width = 600;
  export let height = 600;
  export let initialConfig: Partial<RenderConfig> = {};
  export let autoRender = false;
  export let showController = true;
  export let showStats = true;
  export let layout: 'horizontal' | 'vertical' | 'overlay' = 'vertical';

  // Internal state
  let canvas: ProgressiveCanvas;
  let config: Partial<RenderConfig> = { ...DEFAULT_RENDER_CONFIG, ...initialConfig };
  let state: RenderState | null = null;
  let result: RenderResult | null = null;

  const dispatch = createEventDispatcher<{
    renderStart: void;
    renderComplete: RenderResult;
    renderError: Error;
    configChange: Partial<RenderConfig>;
  }>();

  // Handle config changes
  function handleConfigChange(event: CustomEvent<Partial<RenderConfig>>) {
    config = event.detail;
    dispatch('configChange', config);
  }

  // Handle render events
  function handleRenderStart() {
    dispatch('renderStart');
  }

  function handleRenderComplete(event: CustomEvent<RenderResult>) {
    result = event.detail;
    dispatch('renderComplete', result);
  }

  function handleRenderError(event: CustomEvent<Error>) {
    dispatch('renderError', event.detail);
  }

  // Actions
  function startRender() {
    canvas?.render();
  }

  function abortRender() {
    canvas?.abort();
  }

  function pauseRender() {
    canvas?.pause();
  }

  function resumeRender() {
    canvas?.resume();
  }

  // Export public methods
  export function render(): Promise<RenderResult | null> {
    return canvas?.render() ?? Promise.resolve(null);
  }

  export function abort(): void {
    canvas?.abort();
  }

  export function getResult(): RenderResult | null {
    return result;
  }

  export function getSVG(): string | null {
    return result?.svgPath ?? null;
  }

  export function getOptimizedSVG(): string | null {
    return result?.optimizedSvgPath ?? null;
  }
</script>

<div
  class="render-studio"
  class:horizontal={layout === 'horizontal'}
  class:vertical={layout === 'vertical'}
  class:overlay={layout === 'overlay'}
>
  <div class="canvas-container">
    <ProgressiveCanvas
      bind:this={canvas}
      {params}
      {width}
      {height}
      {config}
      {autoRender}
      showStats={showStats && layout !== 'overlay'}
      showProgress={true}
      on:renderStart={handleRenderStart}
      on:renderComplete={handleRenderComplete}
      on:renderError={handleRenderError}
      bind:state
    />
  </div>

  {#if showController}
    <div class="controller-container" class:overlay-position={layout === 'overlay'}>
      <RenderController
        {state}
        {config}
        on:configChange={handleConfigChange}
        on:render={startRender}
        on:abort={abortRender}
        on:pause={pauseRender}
        on:resume={resumeRender}
      />
    </div>
  {/if}

  {#if result && showStats && layout === 'overlay'}
    <div class="floating-stats">
      <div class="stat-item">
        <span class="stat-label">Engine</span>
        <span class="stat-value">{result.stats.engineType.toUpperCase()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Time</span>
        <span class="stat-value">{(result.stats.totalTime / 1000).toFixed(2)}s</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Points</span>
        <span class="stat-value">{result.pointCount.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Avg FPS</span>
        <span class="stat-value">{result.stats.averageFps}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .render-studio {
    display: flex;
    gap: 16px;
    position: relative;
  }

  .render-studio.horizontal {
    flex-direction: row;
    align-items: flex-start;
  }

  .render-studio.vertical {
    flex-direction: column;
  }

  .render-studio.overlay {
    flex-direction: column;
  }

  .canvas-container {
    flex-shrink: 0;
  }

  .controller-container {
    flex: 1;
    min-width: 280px;
  }

  .controller-container.overlay-position {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .floating-stats {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    border-radius: 6px;
    color: white;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .stat-value {
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
  }

  @media (max-width: 768px) {
    .render-studio.horizontal {
      flex-direction: column;
    }

    .controller-container {
      min-width: 100%;
    }
  }
</style>
