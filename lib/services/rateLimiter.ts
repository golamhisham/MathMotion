/**
 * Rate Limiter Service
 *
 * Implements token bucket algorithm for rate limiting
 * Tracks per-IP rate limits for job submissions and rendering
 */

interface RequestRecord {
  count: number;
  resetTime: number;
}

const RATE_LIMIT_CONFIGS = {
  // Job submission: 10 requests per 5 minutes per IP
  jobSubmission: {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  // Code generation: Inherits from job submission
  // Rendering: Inherits from job submission
} as const;

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Clean up old records every 10 minutes

export class RateLimiter {
  private store = new Map<string, RequestRecord>();
  private lastCleanup = Date.now();

  /**
   * Check if a request should be allowed and track it
   * Returns remaining quota and reset time if rate limited
   */
  checkLimit(
    ip: string,
    endpoint: 'jobSubmission' = 'jobSubmission'
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const config = RATE_LIMIT_CONFIGS[endpoint];
    const now = Date.now();

    // Periodic cleanup to prevent memory leaks
    if (now - this.lastCleanup > CLEANUP_INTERVAL_MS) {
      this.cleanup(now);
    }

    const key = `${ip}:${endpoint}`;
    let record = this.store.get(key);

    // Initialize or reset if window has expired
    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      this.store.set(key, record);
    }

    // Check if limit exceeded
    if (record.count >= config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter,
      };
    }

    // Increment counter
    record.count++;

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - record.count),
      resetTime: record.resetTime,
    };
  }

  /**
   * Get current limit status without incrementing
   */
  getStatus(
    ip: string,
    endpoint: 'jobSubmission' = 'jobSubmission'
  ): {
    used: number;
    limit: number;
    resetTime: number;
  } {
    const config = RATE_LIMIT_CONFIGS[endpoint];
    const key = `${ip}:${endpoint}`;
    const record = this.store.get(key);
    const now = Date.now();

    if (!record || now >= record.resetTime) {
      return {
        used: 0,
        limit: config.maxRequests,
        resetTime: now + config.windowMs,
      };
    }

    return {
      used: record.count,
      limit: config.maxRequests,
      resetTime: record.resetTime,
    };
  }

  /**
   * Reset rate limit for an IP (admin only)
   */
  resetLimit(ip: string, endpoint: 'jobSubmission' = 'jobSubmission'): void {
    const key = `${ip}:${endpoint}`;
    this.store.delete(key);
  }

  /**
   * Clean up expired records to prevent memory leaks
   */
  private cleanup(now: number): void {
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetTime) {
        this.store.delete(key);
      }
    }
    this.lastCleanup = now;
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    activeIPs: number;
    totalRecords: number;
  } {
    return {
      activeIPs: new Set(
        Array.from(this.store.keys()).map((k) => k.split(':')[0])
      ).size,
      totalRecords: this.store.size,
    };
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Extract client IP from request
 * Handles various proxy headers (Cloudflare, AWS, standard)
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple are present
    return forwardedFor.split(',')[0].trim();
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  // Fallback to localhost for development
  return '127.0.0.1';
}
