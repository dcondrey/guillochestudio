/**
 * Metrics API Endpoint
 * Exposes application metrics for monitoring and observability
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import {
  getMetricsCollector,
  getOperationTracker,
  buildHealthStatus,
  type HealthStatus,
} from '$lib/utils/metrics';
import { getCacheHeaders } from '$lib/utils/cache';

// =============================================================================
// GET /api/metrics - Get metrics snapshot (JSON)
// =============================================================================

export const GET: RequestHandler = async ({ url, locals }) => {
  const format = url.searchParams.get('format') || 'json';
  const includeHealth = url.searchParams.get('health') === 'true';

  const metrics = getMetricsCollector();
  const operationTracker = getOperationTracker();

  // Log metrics access
  locals.logger?.info('Metrics accessed', {
    format,
    includeHealth,
  });

  if (format === 'prometheus') {
    // Prometheus format for scraping
    return new Response(metrics.toPrometheusFormat(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...getCacheHeaders('HEALTH'),
      },
    });
  }

  // JSON format for dashboards and debugging
  const snapshot = metrics.getSnapshot();
  const operations = operationTracker.getAll();

  let health: HealthStatus | undefined;
  if (includeHealth) {
    // Run basic health checks
    const checks: HealthStatus['checks'] = [];

    // Check database connectivity (simplified - in production, actually ping DB)
    if (snapshot.database.queryCount > 0) {
      const avgQueryTime =
        snapshot.database.queryCount > 0
          ? snapshot.database.totalTime / snapshot.database.queryCount
          : 0;

      checks.push({
        name: 'database',
        status: snapshot.database.slowQueries > 10 ? 'warn' : 'pass',
        duration: avgQueryTime,
        message: `${snapshot.database.queryCount} queries, ${snapshot.database.slowQueries} slow`,
      });
    }

    // Check external APIs
    if (snapshot.externalApi.callCount > 0) {
      const failureRate = snapshot.externalApi.failedCalls / snapshot.externalApi.callCount;
      checks.push({
        name: 'external_apis',
        status: failureRate > 0.1 ? 'fail' : failureRate > 0.05 ? 'warn' : 'pass',
        message: `${snapshot.externalApi.failedCalls}/${snapshot.externalApi.callCount} failed`,
      });
    }

    // Check error rate
    if (snapshot.requests.total > 0) {
      const errorRate = snapshot.errors.total / snapshot.requests.total;
      checks.push({
        name: 'error_rate',
        status: errorRate > 0.05 ? 'fail' : errorRate > 0.01 ? 'warn' : 'pass',
        message: `${(errorRate * 100).toFixed(2)}% error rate`,
      });
    }

    // Check response time
    checks.push({
      name: 'response_time',
      status: snapshot.responseTime.p95 > 1000 ? 'warn' : 'pass',
      duration: snapshot.responseTime.p95,
      message: `p95: ${snapshot.responseTime.p95}ms`,
    });

    health = buildHealthStatus(metrics, checks, process.env.npm_package_version);
  }

  return json(
    {
      metrics: snapshot,
      operations,
      ...(health && { health }),
    },
    {
      status: 200,
      headers: getCacheHeaders('HEALTH'),
    }
  );
};
