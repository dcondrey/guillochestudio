/**
 * Health Check Endpoint
 * @module /api/health
 * @description Provides health check and monitoring endpoints for the Guilloche Studio Pro API.
 * Used for deployment monitoring, load balancer health probes, and uptime checks.
 *
 * @see {@link https://guilloche.studio/static/openapi.json OpenAPI Specification}
 *
 * @example
 * // Full health check
 * GET /api/health
 *
 * // Simple uptime probe
 * HEAD /api/health
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCacheHeaders } from '$lib/utils/cache';

// =============================================================================
// Types
// =============================================================================

interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: ServiceStatus[];
  uptime: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

// =============================================================================
// Constants
// =============================================================================

const startTime = Date.now();
const APP_VERSION = '1.0.0';

// =============================================================================
// Helper Functions
// =============================================================================

async function checkSupabase(locals: App.Locals): Promise<{ service: ServiceStatus; isHealthy: boolean }> {
  const startMs = Date.now();

  if (!locals.supabase) {
    return {
      service: { name: 'supabase', status: 'down', error: 'Client not initialized' },
      isHealthy: false,
    };
  }

  try {
    const { error } = await locals.supabase.from('profiles').select('id').limit(1);
    return {
      service: {
        name: 'supabase',
        status: error ? 'degraded' : 'up',
        latency: Date.now() - startMs,
        error: error?.message,
      },
      isHealthy: !error,
    };
  } catch (err) {
    return {
      service: {
        name: 'supabase',
        status: 'down',
        latency: Date.now() - startMs,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isHealthy: false,
    };
  }
}

async function checkCloudflareKV(platform: App.Platform | undefined): Promise<ServiceStatus> {
  if (!platform?.env?.PATTERN_CACHE) {
    return { name: 'cloudflare-kv', status: 'down', error: 'Not configured' };
  }

  const startMs = Date.now();
  try {
    await platform.env.PATTERN_CACHE.get('health-check');
    return { name: 'cloudflare-kv', status: 'up', latency: Date.now() - startMs };
  } catch (err) {
    return {
      name: 'cloudflare-kv',
      status: 'degraded',
      latency: Date.now() - startMs,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function checkCloudflareR2(platform: App.Platform | undefined): Promise<ServiceStatus> {
  if (!platform?.env?.PATTERN_ASSETS) {
    return { name: 'cloudflare-r2', status: 'down', error: 'Not configured' };
  }

  const startMs = Date.now();
  try {
    await platform.env.PATTERN_ASSETS.head('health-check');
    return { name: 'cloudflare-r2', status: 'up', latency: Date.now() - startMs };
  } catch {
    // R2 returns error for non-existent keys, that's expected behavior
    return { name: 'cloudflare-r2', status: 'up', latency: Date.now() - startMs };
  }
}

function checkCloudflareAI(platform: App.Platform | undefined): ServiceStatus {
  if (platform?.env?.AI) {
    return { name: 'cloudflare-ai', status: 'up' };
  }
  return { name: 'cloudflare-ai', status: 'down', error: 'Not configured' };
}

function determineOverallStatus(services: ServiceStatus[]): HealthStatus['status'] {
  const hasDown = services.some(s => s.status === 'down' && s.name === 'supabase');
  const hasDegraded = services.some(s => s.status === 'degraded');

  if (hasDown) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

// =============================================================================
// GET /api/health - Full health check
// =============================================================================

/**
 * Full health check endpoint
 * @name GET /api/health
 * @function
 * @description Returns comprehensive health status including all dependent services
 * (Supabase, Cloudflare KV, R2, AI). Checks are performed in parallel for efficiency.
 *
 * @param {Object} context - SvelteKit request context
 * @param {App.Platform} context.platform - Cloudflare platform bindings
 * @param {App.Locals} context.locals - Request-scoped locals including Supabase client
 *
 * @returns {Response} JSON response with health status
 * @returns {boolean} response.success - Whether the system is operational
 * @returns {Object} response.data - Health status data
 * @returns {('healthy'|'degraded'|'unhealthy')} response.data.status - Overall system status
 * @returns {string} response.data.timestamp - ISO 8601 timestamp
 * @returns {string} response.data.version - Application version
 * @returns {string} response.data.environment - Deployment environment
 * @returns {ServiceStatus[]} response.data.services - Individual service statuses
 * @returns {number} response.data.uptime - Server uptime in seconds
 *
 * @example
 * // Response for healthy system
 * {
 *   "success": true,
 *   "data": {
 *     "status": "healthy",
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "version": "1.0.0",
 *     "environment": "production",
 *     "services": [
 *       { "name": "supabase", "status": "up", "latency": 45 }
 *     ],
 *     "uptime": 86400
 *   }
 * }
 *
 * @throws {503} When critical services (Supabase) are down
 */
export const GET: RequestHandler = async ({ platform, locals }) => {
  // Run health checks in parallel for efficiency
  const [supabaseResult, kvStatus, r2Status] = await Promise.all([
    checkSupabase(locals),
    checkCloudflareKV(platform),
    checkCloudflareR2(platform),
  ]);

  const aiStatus = checkCloudflareAI(platform);

  const services: ServiceStatus[] = [
    supabaseResult.service,
    kvStatus,
    r2Status,
    aiStatus,
  ];

  const overallStatus = determineOverallStatus(services);

  const healthData: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    environment: platform?.env?.ENVIRONMENT || 'development',
    services,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  // Use 503 only for unhealthy status (critical failure)
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  const response: ApiResponse<HealthStatus> = {
    success: overallStatus !== 'unhealthy',
    data: healthData,
  };

  return json(response, {
    status: statusCode,
    headers: {
      ...getCacheHeaders('HEALTH'),
      'X-Health-Status': overallStatus,
    },
  });
};

// =============================================================================
// HEAD /api/health - Simple uptime check
// =============================================================================

/**
 * Simple uptime check endpoint
 * @name HEAD /api/health
 * @function
 * @description Lightweight health check that returns only headers. Ideal for
 * load balancer health probes where response body is not needed.
 *
 * @returns {Response} Empty response with status headers
 * @returns {200} Service is running
 *
 * @example
 * // Use with curl
 * curl -I https://guilloche.studio/api/health
 */
export const HEAD: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      ...getCacheHeaders('HEALTH'),
      'X-Health-Status': 'ok',
    },
  });
};
