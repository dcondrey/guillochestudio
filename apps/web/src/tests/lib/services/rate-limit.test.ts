/**
 * Rate Limiting Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Simplified rate limiter for testing
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: this.limit - entry.count, resetAt: entry.resetAt };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(5, 60000); // 5 requests per minute
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it('should block requests exceeding limit', () => {
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
    }

    // Next request should be blocked
    const result = limiter.check('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
    }

    // Blocked
    expect(limiter.check('user1').allowed).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(60001);

    // Should be allowed again
    const result = limiter.check('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should track different keys separately', () => {
    // Use up user1's limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
    }

    // user1 is blocked
    expect(limiter.check('user1').allowed).toBe(false);

    // user2 should still be allowed
    expect(limiter.check('user2').allowed).toBe(true);
  });

  it('should return correct resetAt timestamp', () => {
    const now = Date.now();
    const result = limiter.check('user1');

    expect(result.resetAt).toBe(now + 60000);
  });

  it('should handle manual reset', () => {
    // Use up limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
    }
    expect(limiter.check('user1').allowed).toBe(false);

    // Manual reset
    limiter.reset('user1');

    // Should be allowed again
    expect(limiter.check('user1').allowed).toBe(true);
  });
});

describe('Rate Limit Key Generation', () => {
  function getRateLimitKey(ip: string, path: string): string {
    if (path.startsWith('/api/auth')) return `auth:${ip}`;
    if (path.startsWith('/api/ai')) return `ai:${ip}`;
    if (path.startsWith('/api/export')) return `export:${ip}`;
    if (path.startsWith('/api')) return `api:${ip}`;
    return `default:${ip}`;
  }

  it('should categorize auth routes correctly', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/auth/login')).toBe('auth:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/api/auth/register')).toBe('auth:1.2.3.4');
  });

  it('should categorize AI routes correctly', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/ai/suggest')).toBe('ai:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/api/ai/generate')).toBe('ai:1.2.3.4');
  });

  it('should categorize export routes correctly', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/export/svg')).toBe('export:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/api/export/pdf')).toBe('export:1.2.3.4');
  });

  it('should categorize generic API routes correctly', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/patterns')).toBe('api:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/api/health')).toBe('api:1.2.3.4');
  });

  it('should categorize non-API routes correctly', () => {
    expect(getRateLimitKey('1.2.3.4', '/studio')).toBe('default:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/')).toBe('default:1.2.3.4');
  });
});

// =============================================================================
// Additional Edge Case Tests
// =============================================================================

describe('RateLimiter Edge Cases', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(5, 60000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle rapid successive requests', () => {
    for (let i = 0; i < 100; i++) {
      limiter.check('user1');
    }
    // Should only count first 5 as allowed
    const result = limiter.check('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should handle clear method correctly', () => {
    // Use up limit for multiple users
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
      limiter.check('user2');
    }

    expect(limiter.check('user1').allowed).toBe(false);
    expect(limiter.check('user2').allowed).toBe(false);

    limiter.clear();

    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user2').allowed).toBe(true);
  });

  it('should handle empty key string', () => {
    const result = limiter.check('');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should handle very long key strings', () => {
    const longKey = 'a'.repeat(10000);
    const result = limiter.check(longKey);
    expect(result.allowed).toBe(true);
  });

  it('should handle special characters in keys', () => {
    const specialKey = 'user@example.com:192.168.1.1';
    const result = limiter.check(specialKey);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should handle exactly at window boundary', () => {
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      limiter.check('user1');
    }

    // Advance exactly to window boundary
    vi.advanceTimersByTime(60000);

    // Should still be blocked at exact boundary
    expect(limiter.check('user1').allowed).toBe(false);

    // One ms later should be allowed
    vi.advanceTimersByTime(1);
    expect(limiter.check('user1').allowed).toBe(true);
  });

  it('should preserve resetAt across multiple checks within window', () => {
    const firstResult = limiter.check('user1');
    const firstResetAt = firstResult.resetAt;

    // Multiple checks should have same resetAt
    for (let i = 0; i < 4; i++) {
      const result = limiter.check('user1');
      expect(result.resetAt).toBe(firstResetAt);
    }
  });
});

describe('RateLimiter with different configurations', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should work with limit of 1', () => {
    vi.useFakeTimers();
    const strictLimiter = new RateLimiter(1, 1000);

    expect(strictLimiter.check('user1').allowed).toBe(true);
    expect(strictLimiter.check('user1').allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(strictLimiter.check('user1').allowed).toBe(true);
  });

  it('should work with very short window', () => {
    vi.useFakeTimers();
    const fastLimiter = new RateLimiter(3, 100);

    for (let i = 0; i < 3; i++) {
      expect(fastLimiter.check('user1').allowed).toBe(true);
    }
    expect(fastLimiter.check('user1').allowed).toBe(false);

    vi.advanceTimersByTime(101);
    expect(fastLimiter.check('user1').allowed).toBe(true);
  });

  it('should work with very high limit', () => {
    vi.useFakeTimers();
    const generousLimiter = new RateLimiter(10000, 60000);

    for (let i = 0; i < 10000; i++) {
      expect(generousLimiter.check('user1').allowed).toBe(true);
    }
    expect(generousLimiter.check('user1').allowed).toBe(false);
  });
});

describe('Rate Limit Key Edge Cases', () => {
  function getRateLimitKey(ip: string, path: string): string {
    if (path.startsWith('/api/auth')) return `auth:${ip}`;
    if (path.startsWith('/api/ai')) return `ai:${ip}`;
    if (path.startsWith('/api/export')) return `export:${ip}`;
    if (path.startsWith('/api')) return `api:${ip}`;
    return `default:${ip}`;
  }

  it('should handle IPv6 addresses', () => {
    expect(getRateLimitKey('2001:0db8:85a3:0000:0000:8a2e:0370:7334', '/api/auth/login')).toBe(
      'auth:2001:0db8:85a3:0000:0000:8a2e:0370:7334'
    );
  });

  it('should handle localhost', () => {
    expect(getRateLimitKey('127.0.0.1', '/api/patterns')).toBe('api:127.0.0.1');
    expect(getRateLimitKey('::1', '/api/patterns')).toBe('api:::1');
  });

  it('should handle paths with query strings', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/auth/login?redirect=/')).toBe('auth:1.2.3.4');
  });

  it('should handle paths with fragments', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/patterns#section')).toBe('api:1.2.3.4');
  });

  it('should handle nested API paths', () => {
    expect(getRateLimitKey('1.2.3.4', '/api/auth/oauth/callback')).toBe('auth:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/api/ai/suggest/pattern')).toBe('ai:1.2.3.4');
  });

  it('should handle empty path', () => {
    expect(getRateLimitKey('1.2.3.4', '')).toBe('default:1.2.3.4');
  });

  it('should be case sensitive for paths', () => {
    expect(getRateLimitKey('1.2.3.4', '/API/auth/login')).toBe('default:1.2.3.4');
    expect(getRateLimitKey('1.2.3.4', '/Api/Auth/login')).toBe('default:1.2.3.4');
  });
});
