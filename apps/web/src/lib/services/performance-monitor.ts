/**
 * Performance Monitoring Service
 * Tracks and analyzes render performance metrics
 */

import { writable, derived, type Readable } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetric {
  timestamp: number;
  type: 'render' | 'frame' | 'memory' | 'gc';
  value: number;
  metadata?: Record<string, unknown>;
}

export interface RenderMetrics {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  pointCount: number;
  engineType: 'js' | 'wasm';
  quality: string;
  averageFps: number;
  peakFps: number;
  minFps: number;
  frameCount: number;
  pointsPerSecond: number;
  memoryUsed?: number;
  success: boolean;
  error?: string;
}

export interface PerformanceReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  totalRenders: number;
  successfulRenders: number;
  failedRenders: number;
  averageRenderTime: number;
  medianRenderTime: number;
  p95RenderTime: number;
  p99RenderTime: number;
  totalPointsRendered: number;
  averageFps: number;
  wasmUsagePercent: number;
  jsUsagePercent: number;
  memoryStats?: {
    averageUsed: number;
    peakUsed: number;
    averageLimit: number;
  };
  qualityBreakdown: Record<string, number>;
}

export interface FrameTimings {
  frame: number;
  timestamp: number;
  duration: number;
  pointsRendered: number;
}

// ============================================================================
// Performance Monitor Class
// ============================================================================

export class PerformanceMonitor {
  private sessionId: string;
  private startTime: number;
  private metrics: PerformanceMetric[] = [];
  private renderHistory: RenderMetrics[] = [];
  private frameTimings: FrameTimings[] = [];
  private memoryObserver: PerformanceObserver | null = null;
  private isRecording = false;
  private maxHistorySize = 100;

  // Stores
  private _currentMetrics = writable<RenderMetrics | null>(null);
  private _history = writable<RenderMetrics[]>([]);
  private _isRecording = writable(false);

  public readonly currentMetrics: Readable<RenderMetrics | null> = this._currentMetrics;
  public readonly history: Readable<RenderMetrics[]> = this._history;
  public readonly isRecordingStore: Readable<boolean> = this._isRecording;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = performance.now();
    this.setupMemoryObserver();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Setup memory performance observer
   */
  private setupMemoryObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.memoryObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.recordMetric({
              timestamp: performance.now(),
              type: 'memory',
              value: (entry as PerformanceMeasure).duration,
              metadata: { name: entry.name },
            });
          }
        }
      });

      this.memoryObserver.observe({ entryTypes: ['measure'] });
    } catch {
      // Performance observer not supported for this entry type
    }
  }

  /**
   * Start recording a render
   */
  startRender(params: { engineType: 'js' | 'wasm'; quality: string; pointCount: number }): string {
    const id = `render_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.isRecording = true;
    this._isRecording.set(true);
    this.frameTimings = [];

    const metrics: RenderMetrics = {
      id,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      pointCount: params.pointCount,
      engineType: params.engineType,
      quality: params.quality,
      averageFps: 0,
      peakFps: 0,
      minFps: Infinity,
      frameCount: 0,
      pointsPerSecond: 0,
      success: false,
    };

    this._currentMetrics.set(metrics);
    return id;
  }

  /**
   * Record a frame timing
   */
  recordFrame(frame: number, pointsRendered: number): void {
    const now = performance.now();
    const lastFrame = this.frameTimings[this.frameTimings.length - 1];
    const duration = lastFrame ? now - lastFrame.timestamp : 0;

    this.frameTimings.push({
      frame,
      timestamp: now,
      duration,
      pointsRendered,
    });
  }

  /**
   * Complete a render recording
   */
  completeRender(id: string, success: boolean, error?: string): void {
    const endTime = performance.now();

    this._currentMetrics.update((metrics) => {
      if (!metrics || metrics.id !== id) return metrics;

      const duration = endTime - metrics.startTime;
      const frameTimings = this.frameTimings.filter((f) => f.duration > 0);

      // Calculate FPS stats
      const fpsList = frameTimings.map((f) => (f.duration > 0 ? 1000 / f.duration : 0));
      const averageFps =
        fpsList.length > 0 ? fpsList.reduce((a, b) => a + b, 0) / fpsList.length : 0;
      const peakFps = Math.max(...fpsList, 0);
      const minFps = fpsList.length > 0 ? Math.min(...fpsList) : 0;

      // Get memory usage if available
      let memoryUsed: number | undefined;
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        memoryUsed = mem?.usedJSHeapSize;
      }

      const updatedMetrics: RenderMetrics = {
        ...metrics,
        endTime,
        duration,
        averageFps: Math.round(averageFps),
        peakFps: Math.round(peakFps),
        minFps: Math.round(minFps),
        frameCount: frameTimings.length,
        pointsPerSecond: Math.round(metrics.pointCount / (duration / 1000)),
        memoryUsed,
        success,
        error,
      };

      // Add to history
      this.renderHistory.push(updatedMetrics);
      if (this.renderHistory.length > this.maxHistorySize) {
        this.renderHistory.shift();
      }
      this._history.set([...this.renderHistory]);

      return updatedMetrics;
    });

    this.isRecording = false;
    this._isRecording.set(false);
  }

  /**
   * Record a generic metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep metrics bounded
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const endTime = performance.now();
    const successful = this.renderHistory.filter((r) => r.success);
    const failed = this.renderHistory.filter((r) => !r.success);

    // Calculate render time percentiles
    const durations = successful.map((r) => r.duration).sort((a, b) => a - b);
    const p50 = this.percentile(durations, 0.5);
    const p95 = this.percentile(durations, 0.95);
    const p99 = this.percentile(durations, 0.99);

    // Calculate engine usage
    const wasmRenders = successful.filter((r) => r.engineType === 'wasm').length;
    const jsRenders = successful.filter((r) => r.engineType === 'js').length;
    const totalSuccessful = successful.length || 1;

    // Quality breakdown
    const qualityBreakdown: Record<string, number> = {};
    for (const render of successful) {
      qualityBreakdown[render.quality] = (qualityBreakdown[render.quality] || 0) + 1;
    }

    // Memory stats
    const memoryValues = successful
      .filter((r) => r.memoryUsed !== undefined)
      .map((r) => r.memoryUsed!);

    const memoryStats =
      memoryValues.length > 0
        ? {
            averageUsed: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
            peakUsed: Math.max(...memoryValues),
            averageLimit: 0, // Would need JSHeapSizeLimit
          }
        : undefined;

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      totalRenders: this.renderHistory.length,
      successfulRenders: successful.length,
      failedRenders: failed.length,
      averageRenderTime:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      medianRenderTime: p50,
      p95RenderTime: p95,
      p99RenderTime: p99,
      totalPointsRendered: successful.reduce((sum, r) => sum + r.pointCount, 0),
      averageFps:
        successful.length > 0
          ? successful.reduce((sum, r) => sum + r.averageFps, 0) / successful.length
          : 0,
      wasmUsagePercent: (wasmRenders / totalSuccessful) * 100,
      jsUsagePercent: (jsRenders / totalSuccessful) * 100,
      memoryStats,
      qualityBreakdown,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Get recent render history
   */
  getHistory(limit?: number): RenderMetrics[] {
    const history = [...this.renderHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.renderHistory = [];
    this.frameTimings = [];
    this._currentMetrics.set(null);
    this._history.set([]);
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        report: this.generateReport(),
        renders: this.renderHistory,
        metrics: this.metrics,
      },
      null,
      2
    );
  }

  /**
   * Export metrics as CSV
   */
  exportCSV(): string {
    const headers = [
      'id',
      'startTime',
      'duration',
      'pointCount',
      'engineType',
      'quality',
      'averageFps',
      'peakFps',
      'minFps',
      'frameCount',
      'pointsPerSecond',
      'memoryUsed',
      'success',
    ];

    const rows = this.renderHistory.map((r) =>
      [
        r.id,
        r.startTime,
        r.duration,
        r.pointCount,
        r.engineType,
        r.quality,
        r.averageFps,
        r.peakFps,
        r.minFps,
        r.frameCount,
        r.pointsPerSecond,
        r.memoryUsed ?? '',
        r.success,
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.memoryObserver?.disconnect();
    this.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!instance) {
    instance = new PerformanceMonitor();
  }
  return instance;
}

export function resetPerformanceMonitor(): void {
  instance?.dispose();
  instance = null;
}

// ============================================================================
// Benchmarking Utilities
// ============================================================================

export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  params: Record<string, unknown>;
  engines: ('js' | 'wasm')[];
  qualities: string[];
}

export interface BenchmarkResult {
  engine: 'js' | 'wasm';
  quality: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  medianTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  pointsPerSecond: number;
}

/**
 * Run performance benchmark
 */
export async function runBenchmark(
  renderFn: (engine: 'js' | 'wasm', quality: string) => Promise<number>,
  config: Partial<BenchmarkConfig> = {}
): Promise<BenchmarkResult[]> {
  const {
    iterations = 10,
    warmupIterations = 2,
    engines = ['js', 'wasm'],
    qualities = ['normal'],
  } = config;

  const results: BenchmarkResult[] = [];

  for (const engine of engines) {
    for (const quality of qualities) {
      // Warmup
      for (let i = 0; i < warmupIterations; i++) {
        await renderFn(engine, quality);
      }

      // Actual benchmark
      const times: number[] = [];
      let totalPoints = 0;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const points = await renderFn(engine, quality);
        const duration = performance.now() - start;
        times.push(duration);
        totalPoints += points;
      }

      // Calculate stats
      const sorted = [...times].sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;
      const variance = times.reduce((acc, t) => acc + (t - avg) ** 2, 0) / times.length;

      results.push({
        engine,
        quality,
        iterations,
        totalTime: sum,
        averageTime: avg,
        medianTime: sorted[Math.floor(sorted.length / 2)],
        minTime: sorted[0],
        maxTime: sorted[sorted.length - 1],
        standardDeviation: Math.sqrt(variance),
        pointsPerSecond: (totalPoints / sum) * 1000,
      });
    }
  }

  return results;
}

/**
 * Format benchmark results as table
 */
export function formatBenchmarkTable(results: BenchmarkResult[]): string {
  const headers = [
    'Engine',
    'Quality',
    'Avg (ms)',
    'Med (ms)',
    'Min (ms)',
    'Max (ms)',
    'StdDev',
    'Points/s',
  ];
  const widths = [8, 10, 10, 10, 10, 10, 10, 12];

  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');

  const rows = results.map((r) =>
    [
      r.engine.toUpperCase().padEnd(widths[0]),
      r.quality.padEnd(widths[1]),
      r.averageTime.toFixed(2).padStart(widths[2]),
      r.medianTime.toFixed(2).padStart(widths[3]),
      r.minTime.toFixed(2).padStart(widths[4]),
      r.maxTime.toFixed(2).padStart(widths[5]),
      r.standardDeviation.toFixed(2).padStart(widths[6]),
      Math.round(r.pointsPerSecond).toLocaleString().padStart(widths[7]),
    ].join(' | ')
  );

  return [headerRow, separator, ...rows].join('\n');
}
