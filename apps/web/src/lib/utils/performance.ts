/**
 * Performance Monitoring Utilities
 * Server timing, database query tracking, and API response monitoring
 */

import { dev } from '$app/environment';
import type { Logger, ServerTimingEntry } from './logger';
import { buildServerTimingHeader } from './logger';

// =============================================================================
// Types
// =============================================================================

export interface TimingMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface DatabaseMetrics {
  operation: string;
  table: string;
  duration: number;
  rowCount?: number;
  cached?: boolean;
}

export interface ApiCallMetrics {
  service: string;
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  retries?: number;
}

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  status: number;
  totalDuration: number;
  timings: TimingMetric[];
  databaseQueries: DatabaseMetrics[];
  apiCalls: ApiCallMetrics[];
}

// =============================================================================
// Performance Monitor Class
// =============================================================================

export class PerformanceMonitor {
  private requestId: string;
  private startTime: number;
  private timings: Map<string, TimingMetric>;
  private databaseQueries: DatabaseMetrics[];
  private apiCalls: ApiCallMetrics[];
  private serverTimings: ServerTimingEntry[];
  private logger?: Logger;

  constructor(requestId: string, logger?: Logger) {
    this.requestId = requestId;
    this.startTime = performance.now();
    this.timings = new Map();
    this.databaseQueries = [];
    this.apiCalls = [];
    this.serverTimings = [];
    this.logger = logger;
  }

  // ---------------------------------------------------------------------------
  // Timing Methods
  // ---------------------------------------------------------------------------

  /**
   * Start a named timing measurement
   */
  start(name: string, metadata?: Record<string, unknown>): void {
    this.timings.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * End a named timing measurement
   */
  end(name: string, addToServerTiming = true): number | undefined {
    const timing = this.timings.get(name);
    if (!timing) {
      this.logger?.warn(`Timing "${name}" not found`);
      return undefined;
    }

    timing.endTime = performance.now();
    timing.duration = Math.round((timing.endTime - timing.startTime) * 100) / 100;

    if (addToServerTiming) {
      this.serverTimings.push({
        name: this.sanitizeTimingName(name),
        duration: timing.duration,
      });
    }

    this.logger?.debug(`Timing: ${name}`, { duration: timing.duration, ...timing.metadata });

    return timing.duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    options?: { addToServerTiming?: boolean; metadata?: Record<string, unknown> }
  ): Promise<T> {
    this.start(name, options?.metadata);
    try {
      const result = await operation();
      this.end(name, options?.addToServerTiming ?? true);
      return result;
    } catch (error) {
      this.end(name, options?.addToServerTiming ?? true);
      throw error;
    }
  }

  /**
   * Measure a sync operation
   */
  measureSync<T>(
    name: string,
    operation: () => T,
    options?: { addToServerTiming?: boolean; metadata?: Record<string, unknown> }
  ): T {
    this.start(name, options?.metadata);
    try {
      const result = operation();
      this.end(name, options?.addToServerTiming ?? true);
      return result;
    } catch (error) {
      this.end(name, options?.addToServerTiming ?? true);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Database Query Tracking
  // ---------------------------------------------------------------------------

  /**
   * Track a database query
   */
  trackQuery(metrics: DatabaseMetrics): void {
    this.databaseQueries.push(metrics);

    // Add to server timing
    this.serverTimings.push({
      name: `db-${this.sanitizeTimingName(metrics.operation)}`,
      duration: metrics.duration,
      description: metrics.table,
    });

    // Log slow queries
    if (metrics.duration > 100) {
      this.logger?.warn(`Slow query: ${metrics.operation} on ${metrics.table}`, metrics as unknown as Record<string, unknown>);
    } else {
      this.logger?.debug(`Query: ${metrics.operation} on ${metrics.table}`, metrics as unknown as Record<string, unknown>);
    }
  }

  /**
   * Wrap a database operation with timing
   */
  async trackDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = Math.round((performance.now() - startTime) * 100) / 100;
      this.trackQuery({
        operation,
        table,
        duration,
        ...metadata,
      });
      return result;
    } catch (error) {
      const duration = Math.round((performance.now() - startTime) * 100) / 100;
      this.trackQuery({
        operation,
        table,
        duration,
        ...metadata,
      });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // External API Call Tracking
  // ---------------------------------------------------------------------------

  /**
   * Track an external API call
   */
  trackApiCall(metrics: ApiCallMetrics): void {
    this.apiCalls.push(metrics);

    // Add to server timing
    this.serverTimings.push({
      name: `api-${this.sanitizeTimingName(metrics.service)}`,
      duration: metrics.duration,
      description: metrics.endpoint,
    });

    // Log based on status
    if (metrics.status >= 500) {
      this.logger?.error(`External API error: ${metrics.service} ${metrics.endpoint}`, undefined, {
        ...metrics,
      });
    } else if (metrics.status >= 400) {
      this.logger?.warn(`External API client error: ${metrics.service} ${metrics.endpoint}`, {
        ...metrics,
      });
    } else if (metrics.duration > 1000) {
      this.logger?.warn(`Slow API call: ${metrics.service} ${metrics.endpoint}`, {
        ...metrics,
      });
    } else {
      this.logger?.debug(`API call: ${metrics.service} ${metrics.endpoint}`, {
        ...metrics,
      });
    }
  }

  /**
   * Wrap a fetch call with timing and tracking
   */
  async trackedFetch(
    service: string,
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    const startTime = performance.now();
    const method = options?.method || 'GET';
    let status = 0;
    let retries = 0;

    try {
      const response = await fetch(url, options);
      status = response.status;
      const duration = Math.round((performance.now() - startTime) * 100) / 100;

      this.trackApiCall({
        service,
        endpoint: new URL(url).pathname,
        method,
        status,
        duration,
        retries,
      });

      return response;
    } catch (error) {
      const duration = Math.round((performance.now() - startTime) * 100) / 100;

      this.trackApiCall({
        service,
        endpoint: new URL(url).pathname,
        method,
        status: 0,
        duration,
        retries,
      });

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Metrics Aggregation
  // ---------------------------------------------------------------------------

  /**
   * Get total request duration
   */
  getTotalDuration(): number {
    return Math.round((performance.now() - this.startTime) * 100) / 100;
  }

  /**
   * Get all metrics for this request
   */
  getMetrics(method: string, path: string, status: number): RequestMetrics {
    return {
      requestId: this.requestId,
      method,
      path,
      status,
      totalDuration: this.getTotalDuration(),
      timings: Array.from(this.timings.values()),
      databaseQueries: this.databaseQueries,
      apiCalls: this.apiCalls,
    };
  }

  /**
   * Get Server-Timing header value
   */
  getServerTimingHeader(): string {
    // Add total request time
    const entries: ServerTimingEntry[] = [
      ...this.serverTimings,
      {
        name: 'total',
        duration: this.getTotalDuration(),
      },
    ];

    return buildServerTimingHeader(entries);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalDuration: number;
    queryCount: number;
    totalQueryTime: number;
    apiCallCount: number;
    totalApiTime: number;
    slowQueries: number;
    failedApiCalls: number;
  } {
    const totalQueryTime = this.databaseQueries.reduce((sum, q) => sum + q.duration, 0);
    const totalApiTime = this.apiCalls.reduce((sum, a) => sum + a.duration, 0);
    const slowQueries = this.databaseQueries.filter((q) => q.duration > 100).length;
    const failedApiCalls = this.apiCalls.filter((a) => a.status >= 400 || a.status === 0).length;

    return {
      totalDuration: this.getTotalDuration(),
      queryCount: this.databaseQueries.length,
      totalQueryTime: Math.round(totalQueryTime * 100) / 100,
      apiCallCount: this.apiCalls.length,
      totalApiTime: Math.round(totalApiTime * 100) / 100,
      slowQueries,
      failedApiCalls,
    };
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  private sanitizeTimingName(name: string): string {
    // Server-Timing names must be valid tokens (no spaces, quotes, etc.)
    return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').substring(0, 64);
  }
}

// =============================================================================
// Database Query Wrapper
// =============================================================================

export interface QueryWrapper<TClient> {
  client: TClient;
  monitor: PerformanceMonitor;
}

/**
 * Create a wrapper that tracks all database queries
 * This is a generic helper - specific implementation depends on the database client
 */
export function createTrackedSupabaseClient<T extends { from: (table: string) => unknown }>(
  client: T,
  monitor: PerformanceMonitor
): T {
  // Note: This is a simplified wrapper. In production, you would want to
  // use a more sophisticated approach like Proxy to intercept all calls.
  // For now, this serves as a reference implementation.
  return client;
}

// =============================================================================
// Response Time Buckets for Histograms
// =============================================================================

export const RESPONSE_TIME_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Get the bucket for a given duration
 */
export function getTimeBucket(duration: number): string {
  for (const bucket of RESPONSE_TIME_BUCKETS) {
    if (duration <= bucket) {
      return `<=${bucket}ms`;
    }
  }
  return `>${RESPONSE_TIME_BUCKETS[RESPONSE_TIME_BUCKETS.length - 1]}ms`;
}

// =============================================================================
// Performance Thresholds
// =============================================================================

export const PERFORMANCE_THRESHOLDS = {
  /** Slow page load threshold (ms) */
  SLOW_PAGE: 1000,
  /** Slow API response threshold (ms) */
  SLOW_API: 500,
  /** Slow database query threshold (ms) */
  SLOW_QUERY: 100,
  /** Slow external API call threshold (ms) */
  SLOW_EXTERNAL_API: 1000,
  /** Maximum acceptable response time (ms) */
  MAX_RESPONSE_TIME: 5000,
} as const;

/**
 * Check if a duration exceeds a threshold
 */
export function isSlowOperation(
  type: keyof typeof PERFORMANCE_THRESHOLDS,
  duration: number
): boolean {
  return duration > PERFORMANCE_THRESHOLDS[type];
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PerformanceMonitor for a request
 */
export function createPerformanceMonitor(requestId: string, logger?: Logger): PerformanceMonitor {
  return new PerformanceMonitor(requestId, logger);
}
