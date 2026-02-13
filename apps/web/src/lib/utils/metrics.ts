/**
 * Metrics Collection Module
 * Collects and aggregates metrics for monitoring and alerting
 */

import { dev } from '$app/environment';
import type { RequestMetrics } from './performance';
import { RESPONSE_TIME_BUCKETS, getTimeBucket } from './performance';

// =============================================================================
// Types
// =============================================================================

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  name: string;
  help: string;
  type: 'counter';
  values: MetricValue[];
}

export interface GaugeMetric {
  name: string;
  help: string;
  type: 'gauge';
  value: number;
  timestamp: number;
}

export interface HistogramMetric {
  name: string;
  help: string;
  type: 'histogram';
  buckets: Map<string, number>;
  sum: number;
  count: number;
}

export interface SummaryMetric {
  name: string;
  help: string;
  type: 'summary';
  values: number[];
  sum: number;
  count: number;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;

export interface MetricsSnapshot {
  timestamp: string;
  uptime: number;
  requests: {
    total: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
    byPath: Record<string, number>;
  };
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    buckets: Record<string, number>;
  };
  database: {
    queryCount: number;
    totalTime: number;
    slowQueries: number;
    byOperation: Record<string, number>;
  };
  externalApi: {
    callCount: number;
    totalTime: number;
    failedCalls: number;
    byService: Record<string, number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  custom: Record<string, number>;
}

// =============================================================================
// Metrics Collector
// =============================================================================

export class MetricsCollector {
  private startTime: number;
  private requestCount!: number;
  private requestsByStatus!: Map<number, number>;
  private requestsByMethod!: Map<string, number>;
  private requestsByPath!: Map<string, number>;
  private responseTimes!: number[];
  private responseTimeBuckets!: Map<string, number>;
  private databaseMetrics!: {
    queryCount: number;
    totalTime: number;
    slowQueries: number;
    byOperation: Map<string, number>;
  };
  private apiMetrics!: {
    callCount: number;
    totalTime: number;
    failedCalls: number;
    byService: Map<string, number>;
  };
  private errorCount!: number;
  private errorsByType!: Map<string, number>;
  private customMetrics!: Map<string, number>;
  private maxSampleSize: number;

  constructor(maxSampleSize = 10000) {
    this.startTime = Date.now();
    this.maxSampleSize = maxSampleSize;
    this.reset();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.requestCount = 0;
    this.requestsByStatus = new Map();
    this.requestsByMethod = new Map();
    this.requestsByPath = new Map();
    this.responseTimes = [];
    this.responseTimeBuckets = new Map();
    this.databaseMetrics = {
      queryCount: 0,
      totalTime: 0,
      slowQueries: 0,
      byOperation: new Map(),
    };
    this.apiMetrics = {
      callCount: 0,
      totalTime: 0,
      failedCalls: 0,
      byService: new Map(),
    };
    this.errorCount = 0;
    this.errorsByType = new Map();
    this.customMetrics = new Map();

    // Initialize buckets
    for (const bucket of RESPONSE_TIME_BUCKETS) {
      this.responseTimeBuckets.set(`<=${bucket}ms`, 0);
    }
    this.responseTimeBuckets.set(`>${RESPONSE_TIME_BUCKETS[RESPONSE_TIME_BUCKETS.length - 1]}ms`, 0);
  }

  // ---------------------------------------------------------------------------
  // Request Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record a completed request
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestCount++;

    // By status
    const statusGroup = Math.floor(metrics.status / 100) * 100;
    this.requestsByStatus.set(statusGroup, (this.requestsByStatus.get(statusGroup) || 0) + 1);

    // By method
    this.requestsByMethod.set(
      metrics.method,
      (this.requestsByMethod.get(metrics.method) || 0) + 1
    );

    // By path (normalized)
    const normalizedPath = this.normalizePath(metrics.path);
    this.requestsByPath.set(
      normalizedPath,
      (this.requestsByPath.get(normalizedPath) || 0) + 1
    );

    // Response time
    this.recordResponseTime(metrics.totalDuration);

    // Database queries
    for (const query of metrics.databaseQueries) {
      this.recordDatabaseQuery(query.operation, query.duration, query.duration > 100);
    }

    // API calls
    for (const apiCall of metrics.apiCalls) {
      this.recordApiCall(
        apiCall.service,
        apiCall.duration,
        apiCall.status >= 400 || apiCall.status === 0
      );
    }

    // Record errors
    if (metrics.status >= 400) {
      this.recordError(metrics.status >= 500 ? 'server_error' : 'client_error');
    }
  }

  /**
   * Record response time
   */
  private recordResponseTime(duration: number): void {
    // Store sample for percentile calculation
    if (this.responseTimes.length < this.maxSampleSize) {
      this.responseTimes.push(duration);
    } else {
      // Reservoir sampling for bounded memory
      const index = Math.floor(Math.random() * this.requestCount);
      if (index < this.maxSampleSize) {
        this.responseTimes[index] = duration;
      }
    }

    // Bucket for histogram
    const bucket = getTimeBucket(duration);
    this.responseTimeBuckets.set(bucket, (this.responseTimeBuckets.get(bucket) || 0) + 1);
  }

  /**
   * Normalize path by replacing dynamic segments
   */
  private normalizePath(path: string): string {
    return path
      // Replace UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      // Replace numeric IDs
      .replace(/\/\d+/g, '/:id')
      // Remove trailing slash
      .replace(/\/$/, '') || '/';
  }

  // ---------------------------------------------------------------------------
  // Database Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record a database query
   */
  recordDatabaseQuery(operation: string, duration: number, slow: boolean): void {
    this.databaseMetrics.queryCount++;
    this.databaseMetrics.totalTime += duration;
    if (slow) {
      this.databaseMetrics.slowQueries++;
    }
    this.databaseMetrics.byOperation.set(
      operation,
      (this.databaseMetrics.byOperation.get(operation) || 0) + 1
    );
  }

  // ---------------------------------------------------------------------------
  // External API Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record an external API call
   */
  recordApiCall(service: string, duration: number, failed: boolean): void {
    this.apiMetrics.callCount++;
    this.apiMetrics.totalTime += duration;
    if (failed) {
      this.apiMetrics.failedCalls++;
    }
    this.apiMetrics.byService.set(
      service,
      (this.apiMetrics.byService.get(service) || 0) + 1
    );
  }

  // ---------------------------------------------------------------------------
  // Error Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record an error
   */
  recordError(type: string): void {
    this.errorCount++;
    this.errorsByType.set(type, (this.errorsByType.get(type) || 0) + 1);
  }

  // ---------------------------------------------------------------------------
  // Custom Metrics
  // ---------------------------------------------------------------------------

  /**
   * Increment a custom counter
   */
  increment(name: string, value = 1): void {
    this.customMetrics.set(name, (this.customMetrics.get(name) || 0) + value);
  }

  /**
   * Set a custom gauge value
   */
  gauge(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  // ---------------------------------------------------------------------------
  // Percentile Calculation
  // ---------------------------------------------------------------------------

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  // ---------------------------------------------------------------------------
  // Snapshot
  // ---------------------------------------------------------------------------

  /**
   * Get a snapshot of all metrics
   */
  getSnapshot(): MetricsSnapshot {
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const avgResponseTime =
      sortedTimes.length > 0
        ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length
        : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        byStatus: Object.fromEntries(this.requestsByStatus),
        byMethod: Object.fromEntries(this.requestsByMethod),
        byPath: Object.fromEntries(
          [...this.requestsByPath.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20) // Top 20 paths
        ),
      },
      responseTime: {
        avg: Math.round(avgResponseTime * 100) / 100,
        p50: Math.round(this.percentile(sortedTimes, 50) * 100) / 100,
        p95: Math.round(this.percentile(sortedTimes, 95) * 100) / 100,
        p99: Math.round(this.percentile(sortedTimes, 99) * 100) / 100,
        buckets: Object.fromEntries(this.responseTimeBuckets),
      },
      database: {
        queryCount: this.databaseMetrics.queryCount,
        totalTime: Math.round(this.databaseMetrics.totalTime * 100) / 100,
        slowQueries: this.databaseMetrics.slowQueries,
        byOperation: Object.fromEntries(this.databaseMetrics.byOperation),
      },
      externalApi: {
        callCount: this.apiMetrics.callCount,
        totalTime: Math.round(this.apiMetrics.totalTime * 100) / 100,
        failedCalls: this.apiMetrics.failedCalls,
        byService: Object.fromEntries(this.apiMetrics.byService),
      },
      errors: {
        total: this.errorCount,
        byType: Object.fromEntries(this.errorsByType),
      },
      custom: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    const snapshot = this.getSnapshot();

    // Request total
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${snapshot.requests.total}`);

    // Requests by status
    for (const [status, count] of Object.entries(snapshot.requests.byStatus)) {
      lines.push(`http_requests_total{status="${status}"} ${count}`);
    }

    // Requests by method
    for (const [method, count] of Object.entries(snapshot.requests.byMethod)) {
      lines.push(`http_requests_total{method="${method}"} ${count}`);
    }

    // Response time histogram
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');
    for (const [bucket, count] of Object.entries(snapshot.responseTime.buckets)) {
      const le = bucket.replace('<=', '').replace('ms', '').replace('>', '+Inf');
      lines.push(`http_request_duration_seconds_bucket{le="${le}"} ${count}`);
    }
    lines.push(`http_request_duration_seconds_sum ${snapshot.responseTime.avg * snapshot.requests.total / 1000}`);
    lines.push(`http_request_duration_seconds_count ${snapshot.requests.total}`);

    // Database metrics
    lines.push('# HELP db_queries_total Total number of database queries');
    lines.push('# TYPE db_queries_total counter');
    lines.push(`db_queries_total ${snapshot.database.queryCount}`);
    lines.push(`db_slow_queries_total ${snapshot.database.slowQueries}`);

    // API call metrics
    lines.push('# HELP external_api_calls_total Total number of external API calls');
    lines.push('# TYPE external_api_calls_total counter');
    lines.push(`external_api_calls_total ${snapshot.externalApi.callCount}`);
    lines.push(`external_api_failed_calls_total ${snapshot.externalApi.failedCalls}`);

    // Error metrics
    lines.push('# HELP errors_total Total number of errors');
    lines.push('# TYPE errors_total counter');
    lines.push(`errors_total ${snapshot.errors.total}`);
    for (const [type, count] of Object.entries(snapshot.errors.byType)) {
      lines.push(`errors_total{type="${type}"} ${count}`);
    }

    // Uptime
    lines.push('# HELP uptime_seconds Uptime in seconds');
    lines.push('# TYPE uptime_seconds gauge');
    lines.push(`uptime_seconds ${Math.floor(snapshot.uptime / 1000)}`);

    return lines.join('\n');
  }
}

// =============================================================================
// Global Metrics Instance
// =============================================================================

// Singleton instance for the application
let globalMetrics: MetricsCollector | null = null;

/**
 * Get the global metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector();
  }
  return globalMetrics;
}

/**
 * Reset the global metrics collector
 */
export function resetMetrics(): void {
  if (globalMetrics) {
    globalMetrics.reset();
  }
}

// =============================================================================
// Key Operations Tracking
// =============================================================================

export interface OperationMetric {
  name: string;
  count: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  avgDuration: number;
  lastExecuted?: number;
}

/**
 * Track key operations in the application
 */
export class OperationTracker {
  private operations: Map<string, OperationMetric>;

  constructor() {
    this.operations = new Map();
  }

  /**
   * Record an operation execution
   */
  record(name: string, duration: number, success: boolean): void {
    const existing = this.operations.get(name) || {
      name,
      count: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      avgDuration: 0,
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.lastExecuted = Date.now();

    if (success) {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }

    this.operations.set(name, existing);
  }

  /**
   * Get all operation metrics
   */
  getAll(): OperationMetric[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get metrics for a specific operation
   */
  get(name: string): OperationMetric | undefined {
    return this.operations.get(name);
  }

  /**
   * Clear all operation metrics
   */
  clear(): void {
    this.operations.clear();
  }
}

// Global operation tracker
let globalOperationTracker: OperationTracker | null = null;

export function getOperationTracker(): OperationTracker {
  if (!globalOperationTracker) {
    globalOperationTracker = new OperationTracker();
  }
  return globalOperationTracker;
}

// =============================================================================
// Health Check Data
// =============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  uptime: number;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    duration?: number;
    message?: string;
  }[];
  metrics?: {
    requestRate: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

/**
 * Build health status from metrics
 */
export function buildHealthStatus(
  metrics: MetricsCollector,
  checks: HealthStatus['checks'],
  version?: string
): HealthStatus {
  const snapshot = metrics.getSnapshot();

  // Calculate rates (per minute, assuming metrics are recent)
  const uptimeMinutes = snapshot.uptime / 60000;
  const requestRate = uptimeMinutes > 0 ? snapshot.requests.total / uptimeMinutes : 0;
  const errorRate = snapshot.requests.total > 0
    ? snapshot.errors.total / snapshot.requests.total
    : 0;

  // Determine overall status
  const hasFailedChecks = checks.some((c) => c.status === 'fail');
  const hasWarnings = checks.some((c) => c.status === 'warn');
  const highErrorRate = errorRate > 0.05; // > 5% error rate

  let status: HealthStatus['status'] = 'healthy';
  if (hasFailedChecks || highErrorRate) {
    status = 'unhealthy';
  } else if (hasWarnings) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version,
    uptime: snapshot.uptime,
    checks,
    metrics: {
      requestRate: Math.round(requestRate * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 100, // as percentage
      avgResponseTime: snapshot.responseTime.avg,
    },
  };
}

