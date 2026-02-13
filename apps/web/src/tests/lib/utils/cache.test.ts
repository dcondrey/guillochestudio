/**
 * Cache Utilities Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CACHE_DURATIONS,
  STALE_WHILE_REVALIDATE,
  getCacheControl,
  getCacheHeaders,
  generateETag,
  checkETag,
  memoryCache,
  cachedJson,
  checkConditional,
} from '$lib/utils/cache';

describe('CACHE_DURATIONS', () => {
  it('should have correct static cache duration (1 year)', () => {
    expect(CACHE_DURATIONS.STATIC).toBe(31536000);
  });

  it('should have correct thumbnail cache duration (1 day)', () => {
    expect(CACHE_DURATIONS.THUMBNAILS).toBe(86400);
  });

  it('should have correct pattern cache duration (1 hour)', () => {
    expect(CACHE_DURATIONS.PATTERNS).toBe(3600);
  });

  it('should have correct user data cache duration (5 minutes)', () => {
    expect(CACHE_DURATIONS.USER_DATA).toBe(300);
  });

  it('should have correct API cache duration (1 minute)', () => {
    expect(CACHE_DURATIONS.API).toBe(60);
  });

  it('should have correct DNA cache duration (1 week)', () => {
    expect(CACHE_DURATIONS.DNA).toBe(604800);
  });

  it('should have no cache for health check', () => {
    expect(CACHE_DURATIONS.HEALTH).toBe(0);
  });
});

describe('STALE_WHILE_REVALIDATE', () => {
  it('should have correct patterns stale duration (5 minutes)', () => {
    expect(STALE_WHILE_REVALIDATE.PATTERNS).toBe(300);
  });

  it('should have correct thumbnails stale duration (1 hour)', () => {
    expect(STALE_WHILE_REVALIDATE.THUMBNAILS).toBe(3600);
  });

  it('should have correct DNA stale duration (1 day)', () => {
    expect(STALE_WHILE_REVALIDATE.DNA).toBe(86400);
  });
});

describe('getCacheControl', () => {
  it('should return no-store directive when noStore is true', () => {
    const result = getCacheControl({ maxAge: 3600, noStore: true });
    expect(result).toBe('no-store, no-cache, must-revalidate');
  });

  it('should return public directive by default', () => {
    const result = getCacheControl({ maxAge: 3600 });
    expect(result).toContain('public');
  });

  it('should return private directive when private is true', () => {
    const result = getCacheControl({ maxAge: 3600, private: true });
    expect(result).toContain('private');
    expect(result).not.toContain('public');
  });

  it('should include max-age directive', () => {
    const result = getCacheControl({ maxAge: 3600 });
    expect(result).toContain('max-age=3600');
  });

  it('should include stale-while-revalidate when provided', () => {
    const result = getCacheControl({ maxAge: 3600, staleWhileRevalidate: 300 });
    expect(result).toContain('stale-while-revalidate=300');
  });

  it('should include must-revalidate when provided', () => {
    const result = getCacheControl({ maxAge: 3600, mustRevalidate: true });
    expect(result).toContain('must-revalidate');
  });

  it('should combine multiple directives correctly', () => {
    const result = getCacheControl({
      maxAge: 3600,
      staleWhileRevalidate: 300,
      private: true,
      mustRevalidate: true,
    });
    expect(result).toBe('private, max-age=3600, stale-while-revalidate=300, must-revalidate');
  });

  it('should handle zero max-age', () => {
    const result = getCacheControl({ maxAge: 0 });
    expect(result).toContain('max-age=0');
  });
});

describe('getCacheHeaders', () => {
  it('should return correct headers for STATIC type', () => {
    const headers = getCacheHeaders('STATIC');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
    expect(headers['Cache-Control']).toContain('public');
  });

  it('should return immutable header for IMMUTABLE type', () => {
    const headers = getCacheHeaders('IMMUTABLE');
    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
  });

  it('should return correct headers for THUMBNAILS type', () => {
    const headers = getCacheHeaders('THUMBNAILS');
    expect(headers['Cache-Control']).toContain('max-age=86400');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=3600');
  });

  it('should return correct headers for PATTERNS type', () => {
    const headers = getCacheHeaders('PATTERNS');
    expect(headers['Cache-Control']).toContain('max-age=3600');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=300');
  });

  it('should return private header for USER_DATA type', () => {
    const headers = getCacheHeaders('USER_DATA');
    expect(headers['Cache-Control']).toContain('private');
    expect(headers['Cache-Control']).toContain('max-age=300');
  });

  it('should return correct headers for API type', () => {
    const headers = getCacheHeaders('API');
    expect(headers['Cache-Control']).toContain('max-age=60');
  });

  it('should return correct headers for DNA type', () => {
    const headers = getCacheHeaders('DNA');
    expect(headers['Cache-Control']).toContain('max-age=604800');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
  });

  it('should return correct headers for SITEMAP type', () => {
    const headers = getCacheHeaders('SITEMAP');
    expect(headers['Cache-Control']).toContain('max-age=3600');
  });

  it('should return no-store headers for HEALTH type', () => {
    const headers = getCacheHeaders('HEALTH');
    expect(headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
  });
});

describe('generateETag', () => {
  it('should generate a weak ETag for string content', () => {
    const etag = generateETag('test content');
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should generate a weak ETag for object content', () => {
    const etag = generateETag({ key: 'value' });
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should generate consistent ETags for same content', () => {
    const content = { foo: 'bar', num: 42 };
    const etag1 = generateETag(content);
    const etag2 = generateETag(content);
    expect(etag1).toBe(etag2);
  });

  it('should generate different ETags for different content', () => {
    const etag1 = generateETag('content1');
    const etag2 = generateETag('content2');
    expect(etag1).not.toBe(etag2);
  });

  it('should handle empty string', () => {
    const etag = generateETag('');
    expect(etag).toMatch(/^W\/"0"/);
  });

  it('should handle empty object', () => {
    const etag = generateETag({});
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should handle complex nested objects', () => {
    const complex = {
      level1: {
        level2: {
          data: [1, 2, 3],
        },
      },
    };
    const etag = generateETag(complex);
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });
});

describe('checkETag', () => {
  it('should return false when no If-None-Match header', () => {
    const request = new Request('http://test.com');
    expect(checkETag(request, 'W/"abc123"')).toBe(false);
  });

  it('should return true when ETags match exactly', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': 'W/"abc123"' },
    });
    expect(checkETag(request, 'W/"abc123"')).toBe(true);
  });

  it('should return true when ETag matches with quotes', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': '"W/"abc123""' },
    });
    expect(checkETag(request, 'W/"abc123"')).toBe(true);
  });

  it('should return false when ETags do not match', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': 'W/"different"' },
    });
    expect(checkETag(request, 'W/"abc123"')).toBe(false);
  });
});

describe('memoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    memoryCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve values', () => {
    memoryCache.set('key1', { data: 'value1' });
    const result = memoryCache.get<{ data: string }>('key1');
    expect(result).toEqual({ data: 'value1' });
  });

  it('should return null for non-existent keys', () => {
    const result = memoryCache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should expire entries after default TTL', () => {
    memoryCache.set('key1', 'value1');

    // Advance time past default TTL (60 seconds)
    vi.advanceTimersByTime(60001);

    const result = memoryCache.get('key1');
    expect(result).toBeNull();
  });

  it('should not expire entries before TTL', () => {
    memoryCache.set('key1', 'value1');

    // Advance time but not past TTL
    vi.advanceTimersByTime(59999);

    const result = memoryCache.get('key1');
    expect(result).toBe('value1');
  });

  it('should delete entries manually', () => {
    memoryCache.set('key1', 'value1');
    memoryCache.delete('key1');
    expect(memoryCache.get('key1')).toBeNull();
  });

  it('should clear all entries', () => {
    memoryCache.set('key1', 'value1');
    memoryCache.set('key2', 'value2');
    memoryCache.clear();
    expect(memoryCache.get('key1')).toBeNull();
    expect(memoryCache.get('key2')).toBeNull();
  });

  it('should handle different data types', () => {
    memoryCache.set('string', 'hello');
    memoryCache.set('number', 42);
    memoryCache.set('array', [1, 2, 3]);
    memoryCache.set('object', { nested: { data: true } });

    expect(memoryCache.get('string')).toBe('hello');
    expect(memoryCache.get('number')).toBe(42);
    expect(memoryCache.get('array')).toEqual([1, 2, 3]);
    expect(memoryCache.get('object')).toEqual({ nested: { data: true } });
  });

  it('should use custom TTL when provided', () => {
    memoryCache.set('key1', 'value1', 5000); // 5 seconds

    // Advance time to just before expiry
    vi.advanceTimersByTime(4999);
    expect(memoryCache.get('key1')).toBe('value1');

    // Advance past expiry
    vi.advanceTimersByTime(2);
    expect(memoryCache.get('key1')).toBeNull();
  });

  it('should overwrite existing entries', () => {
    memoryCache.set('key1', 'value1');
    memoryCache.set('key1', 'value2');
    expect(memoryCache.get('key1')).toBe('value2');
  });
});

describe('cachedJson', () => {
  it('should create a response with JSON content', async () => {
    const data = { message: 'hello' };
    const response = cachedJson(data, 'API');

    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual(data);
  });

  it('should include cache headers', () => {
    const data = { test: true };
    const response = cachedJson(data, 'PATTERNS');

    expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
  });

  it('should include ETag header', () => {
    const data = { id: 123 };
    const response = cachedJson(data, 'API');

    expect(response.headers.get('ETag')).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should merge with additional headers', () => {
    const data = { test: true };
    const response = cachedJson(data, 'API', {
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
    expect(response.headers.get('Cache-Control')).toBeDefined();
  });

  it('should handle arrays', async () => {
    const data = [1, 2, 3];
    const response = cachedJson(data, 'API');
    const body = await response.json();
    expect(body).toEqual([1, 2, 3]);
  });

  it('should use different cache headers for different types', () => {
    const response1 = cachedJson({}, 'API');
    const response2 = cachedJson({}, 'USER_DATA');

    const cache1 = response1.headers.get('Cache-Control');
    const cache2 = response2.headers.get('Cache-Control');

    expect(cache1).toContain('max-age=60');
    expect(cache2).toContain('private');
    expect(cache2).toContain('max-age=300');
  });
});

describe('checkConditional', () => {
  it('should return null when no matching ETag', () => {
    const request = new Request('http://test.com');
    const result = checkConditional(request, 'W/"abc123"');
    expect(result).toBeNull();
  });

  it('should return 304 response when ETag matches', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': 'W/"abc123"' },
    });
    const result = checkConditional(request, 'W/"abc123"');

    expect(result).not.toBeNull();
    expect(result!.status).toBe(304);
  });

  it('should include ETag in 304 response', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': 'W/"abc123"' },
    });
    const result = checkConditional(request, 'W/"abc123"');

    expect(result!.headers.get('ETag')).toBe('W/"abc123"');
  });

  it('should return null when ETags do not match', () => {
    const request = new Request('http://test.com', {
      headers: { 'If-None-Match': 'W/"different"' },
    });
    const result = checkConditional(request, 'W/"abc123"');
    expect(result).toBeNull();
  });
});

describe('Edge Cases', () => {
  it('should handle special characters in cache content', () => {
    const etag = generateETag('<script>alert("xss")</script>');
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should handle unicode in cache content', () => {
    const etag = generateETag({ emoji: '🚀', japanese: '日本語' });
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should handle very large content', () => {
    const largeContent = 'a'.repeat(100000);
    const etag = generateETag(largeContent);
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });

  it('should handle null values in objects', () => {
    const etag = generateETag({ nullValue: null, nested: { also: null } });
    expect(etag).toMatch(/^W\/"[0-9a-f]+"/);
  });
});
