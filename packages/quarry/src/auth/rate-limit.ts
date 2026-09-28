/**
 * Rate Limiting Middleware
 *
 * Simple in-memory rate limiter for API requests.
 * Limits requests per IP address within a time window.
 */

import type { Context, Next } from 'hono';

export interface RateLimitConfig {
  /** Whether rate limiting is enabled */
  enabled: boolean;
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit data
const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  lastCleanup = now;
}

/**
 * Get client IP from request
 */
function getClientIp(c: Context): string {
  // Check X-Forwarded-For header (for proxied requests)
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = c.req.header('X-Real-IP');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (in production, this would come from the connection)
  return 'unknown';
}

/**
 * Rate limiting middleware for Hono
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    // Skip if disabled
    if (!config.enabled) {
      return next();
    }

    // Skip for health check endpoint
    if (c.req.path === '/api/health') {
      return next();
    }

    // Cleanup expired entries periodically
    cleanupExpiredEntries();

    const clientIp = getClientIp(c);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(clientIp);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      rateLimitStore.set(clientIp, entry);
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return c.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`,
            retryAfter,
          },
        },
        429,
        { 'Retry-After': String(retryAfter) }
      );
    }

    // Add rate limit headers
    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    return next();
  };
}

/**
 * Clear all rate limit entries (useful for testing)
 */
export function clearRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats(): {
  totalEntries: number;
  entries: Array<{ ip: string; count: number; resetTime: number }>;
} {
  const entries = Array.from(rateLimitStore.entries()).map(([ip, entry]) => ({
    ip,
    count: entry.count,
    resetTime: entry.resetTime,
  }));
  return {
    totalEntries: entries.length,
    entries,
  };
}