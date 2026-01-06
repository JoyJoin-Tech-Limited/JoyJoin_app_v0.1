/**
 * Rate Limiter Middleware
 * 
 * Simple in-memory rate limiting for AI-powered endpoints
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

// Register cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => clearInterval(cleanupInterval));
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).session?.userId || 
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
