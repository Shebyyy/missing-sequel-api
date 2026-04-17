import { createMiddleware } from 'hono/factory';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

export function rateLimitMiddleware(maxRequests: number, windowMs: number = 60_000) {
  return createMiddleware(async (c, next) => {
    const appId = c.get('app_id') || 'anonymous';
    const userId = c.req.header('X-User-Id') || '';
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const key = `${appId}:${userId || ip}`;

    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      return c.json({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests',
        retry_after: Math.ceil((entry.resetAt - now) / 1000),
        code: 429,
      }, 429);
    }

    await next();
  });
}
