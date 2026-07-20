/**
 * Rate Limiter Middleware
 * 
 * Simple in-memory rate limiting for AI-powered endpoints
 * 
 * TODO: Migrate to Redis-backed rate limiting for horizontal scalability.
 * The current in-memory Map will not share state across multiple server instances,
 * allowing distributed attackers to bypass limits by hitting different processes.
 * Consider packages like `rate-limit-redis` or moving rate limiting to the API gateway.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60000;
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  // Collect expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  }
  
  // Batch delete
  for (const key of keysToDelete) {
    rateLimitStore.delete(key);
  }
  
  if (keysToDelete.length > 0) {
    console.log(`[RateLimiter] Cleaned up ${keysToDelete.length} expired entries`);
  }
}, CLEANUP_INTERVAL_MS);

// Do not keep the Node process alive solely for cache cleanup. This also
// avoids accumulating process-level listeners under test/hot module reloads.
cleanupInterval.unref?.();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  keyResolver?: (req: Request) => string;
  errorCode?: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl', keyResolver, errorCode } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = keyResolver?.(req) ||
                   (req as any).session?.userId ||
                   (req as any).user?.id ||
                   req.ip ||
                   'anonymous';
    
    const key = `${keyPrefix}:${userId}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
      return next();
    }
    
    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        ...(errorCode ? { code: errorCode } : {}),
        message: '请求过于频繁，请稍后再试',
        retryAfterSeconds: retryAfter,
      });
    }
    
    entry.count++;
    rateLimitStore.set(key, entry);
    next();
  };
}

export const aiEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyPrefix: 'ai',
});

export const kpiEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  keyPrefix: 'kpi',
});

/**
 * Auth endpoint limiter — applied to WeChat login, phone auth, etc.
 * Conservative limit for beta: 20 attempts per minute per IP/user.
 */
export const authEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  keyPrefix: 'auth',
});

/**
 * Payment endpoint limiter — applied to payment creation and subscription renewal.
 * Prevents abuse of payment creation while keeping normal user flows unblocked.
 */
export const paymentEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyPrefix: 'pay',
});

/**
 * Tencent Maps proxy limiter. These endpoints consume a metered upstream
 * service, so keep the budget per authenticated user instead of per keyword
 * or coordinate.
 */
export const geoEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
  keyPrefix: 'geo',
});

/**
 * Hidden Flash encounter lookup is deliberately much tighter than ordinary
 * map traffic. The key includes the appearance so repeated synthetic points
 * cannot cheaply probe one NPC's hidden location.
 */
export const flashLocateEndpointLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 6,
  keyPrefix: 'flash-locate',
  keyResolver: (req) => {
    const actor = (req as any).session?.userId || (req as any).user?.id || req.ip || 'anonymous';
    return `${actor}:${req.params.id || 'unknown'}`;
  },
  errorCode: 'FLASH_LOCATE_RATE_LIMITED',
});

/**
 * Login-free location bootstrap limiter. Reverse geocoding and IP lookup are
 * intentionally public so the landing/onboarding flow can establish a city,
 * but they still consume the metered Tencent Maps key. Always budget these by
 * client IP, even when an optional session happens to be present.
 */
export const publicGeoEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
  keyPrefix: 'geo-public',
  keyResolver: (req) => req.ip || req.socket.remoteAddress || 'anonymous',
});

/**
 * Webhook endpoint limiter — applied to /api/webhooks/wechat-pay.
 * WeChat Pay may retry failed deliveries; allow a reasonable burst.
 */
export const webhookEndpointLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 120,
  keyPrefix: 'wh',
});

/**
 * Moment Card PNG endpoint limiter — canvas rendering is CPU/memory intensive.
 * Allow 5 requests per minute per user; bursts are unlikely for share cards.
 */
export const momentCardLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  keyPrefix: 'mc',
});
