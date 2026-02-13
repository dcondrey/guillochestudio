/**
 * Caching Utilities
 * Server-side and client-side caching helpers
 */

// Type alias for Cloudflare KV namespace
interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<unknown>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expirationTtl?: number; expiration?: number; metadata?: Record<string, unknown> }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
  getWithMetadata<M = unknown>(
    key: string,
    type?: 'text' | 'json' | 'arrayBuffer' | 'stream'
  ): Promise<{ value: unknown; metadata: M | null }>;
}

// =============================================================================
// Cache Configuration
// =============================================================================

export const CACHE_DURATIONS = {
  /** Static assets (icons, fonts) - 1 year */
  STATIC: 31536000,
  /** Immutable assets (hashed files) - 1 year */
  IMMUTABLE: 31536000,
  /** Pattern thumbnails - 1 day */
  THUMBNAILS: 86400,
  /** Public pattern data - 1 hour */
  PATTERNS: 3600,
  /** User-specific data - 5 minutes */
  USER_DATA: 300,
  /** API responses - 1 minute */
  API: 60,
  /** DNA lookups - 1 week */
  DNA: 604800,
  /** Sitemap - 1 hour */
  SITEMAP: 3600,
  /** Health check - no cache */
  HEALTH: 0,
} as const;

export const STALE_WHILE_REVALIDATE = {
  PATTERNS: 300, // 5 minutes
  THUMBNAILS: 3600, // 1 hour
  DNA: 86400, // 1 day
} as const;

// =============================================================================
// Cache Headers
// =============================================================================

export interface CacheOptions {
  maxAge: number;
  staleWhileRevalidate?: number;
  private?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
}

/**
 * Generate Cache-Control header value
 */
export function getCacheControl(options: CacheOptions): string {
  if (options.noStore) {
    return 'no-store, no-cache, must-revalidate';
  }

  const directives: string[] = [];

  if (options.private) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  directives.push(`max-age=${options.maxAge}`);

  if (options.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Get standard cache headers for different content types
 */
export function getCacheHeaders(type: keyof typeof CACHE_DURATIONS): Record<string, string> {
  const headers: Record<string, string> = {};

  switch (type) {
    case 'STATIC':
    case 'IMMUTABLE':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS[type],
      });
      if (type === 'IMMUTABLE') {
        headers['Cache-Control'] += ', immutable';
      }
      break;

    case 'THUMBNAILS':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.THUMBNAILS,
        staleWhileRevalidate: STALE_WHILE_REVALIDATE.THUMBNAILS,
      });
      break;

    case 'PATTERNS':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.PATTERNS,
        staleWhileRevalidate: STALE_WHILE_REVALIDATE.PATTERNS,
      });
      break;

    case 'USER_DATA':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.USER_DATA,
        private: true,
      });
      break;

    case 'API':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.API,
      });
      break;

    case 'DNA':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.DNA,
        staleWhileRevalidate: STALE_WHILE_REVALIDATE.DNA,
      });
      break;

    case 'SITEMAP':
      headers['Cache-Control'] = getCacheControl({
        maxAge: CACHE_DURATIONS.SITEMAP,
      });
      break;

    case 'HEALTH':
      headers['Cache-Control'] = getCacheControl({
        maxAge: 0,
        noStore: true,
      });
      break;
  }

  return headers;
}

// =============================================================================
// ETag Generation
// =============================================================================

/**
 * Generate a weak ETag for content
 */
export function generateETag(content: string | object): string {
  const data = typeof content === 'string' ? content : JSON.stringify(content);
  // Simple hash for ETag - in production, use a proper hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `W/"${Math.abs(hash).toString(16)}"`;
}

/**
 * Check if the request has a matching ETag
 */
export function checkETag(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (!ifNoneMatch) return false;
  return ifNoneMatch === etag || ifNoneMatch === `"${etag}"`;
}

// =============================================================================
// Cloudflare KV Cache
// =============================================================================

export interface KVCacheOptions {
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cache wrapper for Cloudflare KV
 */
export class KVCache {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json');
    return value as T | null;
  }

  async set<T>(key: string, value: T, options?: KVCacheOptions): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), {
      expirationTtl: options?.expirationTtl,
      metadata: options?.metadata,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async getWithMetadata<T, M = unknown>(
    key: string
  ): Promise<{ value: T | null; metadata: M | null }> {
    const result = await this.kv.getWithMetadata<M>(key, 'json');
    return {
      value: result.value as T | null,
      metadata: result.metadata,
    };
  }
}

// =============================================================================
// In-Memory Cache (for single request lifetime)
// =============================================================================

const requestCache = new Map<string, { value: unknown; timestamp: number }>();
const MAX_CACHE_SIZE = 1000;
const DEFAULT_TTL = 60000; // 1 minute

/**
 * Simple in-memory cache for request deduplication
 */
export const memoryCache = {
  get<T>(key: string): T | null {
    const entry = requestCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > DEFAULT_TTL) {
      requestCache.delete(key);
      return null;
    }
    return entry.value as T;
  },

  set<T>(key: string, value: T, ttl = DEFAULT_TTL): void {
    // Evict oldest entries if cache is too large
    if (requestCache.size >= MAX_CACHE_SIZE) {
      const oldest = [...requestCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100);
      oldest.forEach(([k]) => requestCache.delete(k));
    }

    requestCache.set(key, { value, timestamp: Date.now() });

    // Schedule deletion
    setTimeout(() => requestCache.delete(key), ttl);
  },

  delete(key: string): void {
    requestCache.delete(key);
  },

  clear(): void {
    requestCache.clear();
  },
};

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a cached JSON response
 */
export function cachedJson<T>(
  data: T,
  cacheType: keyof typeof CACHE_DURATIONS,
  init?: ResponseInit
): Response {
  const headers = new Headers(init?.headers);
  const cacheHeaders = getCacheHeaders(cacheType);

  Object.entries(cacheHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Add ETag
  const etag = generateETag(data as object);
  headers.set('ETag', etag);

  // Set content type
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

/**
 * Check conditional request and return 304 if not modified
 */
export function checkConditional(request: Request, etag: string): Response | null {
  if (checkETag(request, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
      },
    });
  }
  return null;
}
