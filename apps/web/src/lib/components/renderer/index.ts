/**
 * Progressive Rendering Components
 * Export all renderer components and utilities
 */

export { default as ProgressiveCanvas } from './ProgressiveCanvas.svelte';
export { default as RenderController } from './RenderController.svelte';
export { default as RenderStudio } from './RenderStudio.svelte';
export { default as PerformanceDashboard } from './PerformanceDashboard.svelte';

// Re-export types and utilities from service
export {
  ProgressiveRenderer,
  createProgressiveRenderer,
  createCanvasRenderer,
  createRenderStore,
  DEFAULT_RENDER_CONFIG,
  type RenderConfig,
  type RenderState,
  type RenderResult,
  type RenderFrame,
} from '$lib/services/progressive-renderer';
