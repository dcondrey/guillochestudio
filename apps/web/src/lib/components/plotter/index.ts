/**
 * Plotter Components
 * Export all plotter-related components
 */

export { default as PlotterPanel } from './PlotterPanel.svelte';

// Re-export types and service
export {
  PLOTTER_PRESETS,
  MATERIAL_PRESETS,
  optimizePaths,
  patternToPathSegments,
  generateHPGL,
  PlotterConnection,
  renderPathPreview,
  type PlotterConfig,
  type MaterialPreset,
  type OptimizationResult,
  type PlotterStatus,
  type Point,
  type PathSegment,
} from '$lib/services/plotter';
