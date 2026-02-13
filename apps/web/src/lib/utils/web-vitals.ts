/**
 * Client-side Web Vitals tracking
 *
 * Integrates with web-vitals for Core Web Vitals tracking
 * and provides utilities for client-side performance monitoring.
 */

import { browser } from '$app/environment';
import { onCLS, onFID, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

export interface VitalsMetrics {
  CLS?: number; // Cumulative Layout Shift
  FID?: number; // First Input Delay
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

type MetricHandler = (metric: Metric) => void;

// Thresholds based on Google's recommendations
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FID: { good: 100, needsImprovement: 300 },
  FCP: { good: 1800, needsImprovement: 3000 },
  LCP: { good: 2500, needsImprovement: 4000 },
  TTFB: { good: 800, needsImprovement: 1800 },
  INP: { good: 200, needsImprovement: 500 },
};

/**
 * Get rating for a metric value
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Initialize web vitals tracking
 * Call this in your root +layout.svelte onMount
 */
export function initWebVitals(options?: {
  onMetric?: MetricHandler;
  reportToConsole?: boolean;
  reportToAnalytics?: (metric: Metric) => void;
}): void {
  if (!browser) return;

  const handleMetric: MetricHandler = (metric) => {
    const rating = getRating(metric.name, metric.value);

    // Custom handler
    if (options?.onMetric) {
      options.onMetric(metric);
    }

    // Console reporting (dev mode or explicit)
    if (options?.reportToConsole || import.meta.env.DEV) {
      const color =
        rating === 'good' ? '#0cce6b' : rating === 'needs-improvement' ? '#ffa400' : '#ff4e42';

      console.log(
        `%c[Web Vitals] ${metric.name}: ${metric.value.toFixed(
          metric.name === 'CLS' ? 4 : 0
        )} (${rating})`,
        `color: ${color}; font-weight: bold`
      );
    }

    // Analytics reporting
    if (options?.reportToAnalytics) {
      options.reportToAnalytics(metric);
    }
  };

  // Register all metrics
  onCLS(handleMetric);
  onFID(handleMetric);
  onFCP(handleMetric);
  onLCP(handleMetric);
  onTTFB(handleMetric);
  onINP(handleMetric);
}

/**
 * Check if the user has a slow connection
 */
export function isSlowConnection(): boolean {
  if (!browser) return false;

  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;

  if (!connection) return false;

  const slowTypes = ['slow-2g', '2g', '3g'];
  return slowTypes.includes(connection.effectiveType || '') || connection.saveData === true;
}

/**
 * Check if device prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (!browser) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if device is in low power mode (iOS)
 */
export function isLowPowerMode(): boolean {
  if (!browser) return false;
  // There's no direct API, but reduced motion often indicates low power mode
  return prefersReducedMotion();
}

/**
 * Get navigation timing metrics
 */
export function getNavigationTiming(): Record<string, number> | null {
  if (!browser || typeof performance === 'undefined') return null;

  const entries = performance.getEntriesByType('navigation');
  const timing = entries[0] as PerformanceNavigationTiming | undefined;
  if (!timing) return null;

  return {
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    ssl: timing.secureConnectionStart > 0 ? timing.connectEnd - timing.secureConnectionStart : 0,
    ttfb: timing.responseStart - timing.requestStart,
    download: timing.responseEnd - timing.responseStart,
    domParsing: timing.domInteractive - timing.responseEnd,
    domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
    load: timing.loadEventEnd - timing.loadEventStart,
    total: timing.loadEventEnd - timing.startTime,
  };
}

/**
 * Defer non-critical initialization to idle time
 */
export function deferToIdle(fn: () => void, timeout = 5000): void {
  if (!browser) return;

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => fn(), { timeout });
  } else {
    setTimeout(fn, 100);
  }
}

/**
 * Preload a module during idle time
 */
export function preloadModule(importFn: () => Promise<unknown>): void {
  deferToIdle(() => {
    importFn().catch(() => {
      // Silently fail - this is just a preload optimization
    });
  });
}

/**
 * Observer for long tasks (tasks > 50ms that block the main thread)
 */
export function observeLongTasks(
  callback?: (entry: PerformanceEntry) => void
): (() => void) | undefined {
  if (!browser || typeof PerformanceObserver === 'undefined') return undefined;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (callback) {
          callback(entry);
        } else if (import.meta.env.DEV) {
          console.warn(`[Long Task] Duration: ${entry.duration.toFixed(2)}ms`, entry);
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    return () => observer.disconnect();
  } catch {
    return undefined;
  }
}

/**
 * Observer for layout shifts
 */
export function observeLayoutShifts(
  callback: (shift: { value: number; sources: unknown[] }) => void
): (() => void) | undefined {
  if (!browser || typeof PerformanceObserver === 'undefined') return undefined;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & {
          value: number;
          sources: unknown[];
          hadRecentInput: boolean;
        };

        // Ignore shifts caused by user input
        if (!layoutShift.hadRecentInput) {
          callback({
            value: layoutShift.value,
            sources: layoutShift.sources || [],
          });
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    return () => observer.disconnect();
  } catch {
    return undefined;
  }
}

/**
 * Simple component render tracker
 * Usage:
 * <script>
 *   import { trackRender } from '$lib/utils/web-vitals';
 *   trackRender('ComponentName');
 * </script>
 */
const renderMarks = new Map<string, number>();

export function trackRender(componentName: string): void {
  if (!browser) return;

  const now = performance.now();
  const startTime = renderMarks.get(componentName);

  if (startTime) {
    const duration = now - startTime;
    renderMarks.delete(componentName);

    if (import.meta.env.DEV && duration > 16) {
      // Longer than one frame
      console.log(`[Render] ${componentName}: ${duration.toFixed(2)}ms`);
    }
  } else {
    renderMarks.set(componentName, now);
  }
}
