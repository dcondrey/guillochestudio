/**
 * Lazy-loaded component wrappers
 *
 * These components use dynamic imports to split heavy components into separate
 * chunks that are only loaded when needed, reducing initial bundle size.
 *
 * Usage:
 * Instead of: import AIAssistant from '$lib/components/ai/AIAssistant.svelte';
 * Use: import { LazyAIAssistant } from '$lib/components/lazy';
 */

export { default as LazyAIAssistant } from './LazyAIAssistant.svelte';
export { default as LazyCNCExportPanel } from './LazyCNCExportPanel.svelte';
export { default as LazyPrintDashboard } from './LazyPrintDashboard.svelte';
export { default as LazyPlotterPanel } from './LazyPlotterPanel.svelte';

/**
 * Preload hints for lazy components
 *
 * Call these functions to start loading components before they're needed
 * (e.g., on hover or when the user is likely to interact with them)
 */
export const preloadAIAssistant = () => import('../ai/AIAssistant.svelte');
export const preloadCNCExportPanel = () => import('../cnc/CNCExportPanel.svelte');
export const preloadPrintDashboard = () => import('../print/PrintDashboard.svelte');
export const preloadPlotterPanel = () => import('../plotter/PlotterPanel.svelte');

/**
 * Preload all heavy components
 * Useful to call during idle time after initial page load
 */
export function preloadAllHeavyComponents(): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      preloadAIAssistant();
      preloadCNCExportPanel();
      preloadPrintDashboard();
      preloadPlotterPanel();
    });
  }
}
