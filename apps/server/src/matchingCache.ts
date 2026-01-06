/**
 * 匹配算法缓存服务
 * 吴代码专家建议：引入缓存优化匹配计算性能
 * 当前使用内存缓存，可后续迁移到Redis
 */

import memoizee from 'memoizee';

interface CacheConfig {
  maxAge: number;
  max: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxAge: 5 * 60 * 1000,
  max: 1000,
};

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

class MatchingCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use setInterval with proper cleanup interval
    const cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    // Store reference for potential cleanup (though in practice this runs for app lifetime)
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => clearInterval(cleanupInterval));
    }
  }

  private generateKey(prefix: string, ...args: unknown[]): string {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  set<T>(key: string, value: T, maxAge?: number): void {
    const now = Date.now();
    const ttl = maxAge || this.config.maxAge;
    
    if (this.cache.size >= this.config.max) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    // Find oldest entry more efficiently
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];
    
    // Collect expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        entriesToDelete.push(key);
      }
    }
    
    // Batch delete to reduce iteration time
    for (const key of entriesToDelete) {
      this.cache.delete(key);
    }
    
    if (entriesToDelete.length > 0) {
      console.log(`[MatchingCache] Cleaned up ${entriesToDelete.length} expired entries`);
    }
  }

  invalidate(pattern?: string): number {
    let count = 0;
    if (!pattern) {
      count = this.cache.size;
      this.cache.clear();
    } else {
      const keysToDelete: string[] = [];
      // Collect keys to delete first
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      }
      // Then delete them in batch
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
      count = keysToDelete.length;
    }
    return count;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(1) + '%' : '0%',
      size: this.cache.size,
      maxSize: this.config.max,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

export const matchingCache = new MatchingCache({
  maxAge: 5 * 60 * 1000,
  max: 500,
});

export const signatureCache = new MatchingCache({
  maxAge: 30 * 60 * 1000,
  max: 200,
});

export function getCachedPairScore(
  userId1: string,
  userId2: string,
  calculator: () => number
): number {
  const key = [userId1, userId2].sort().join(':');
  const cached = matchingCache.get<number>(`pair:${key}`);
  if (cached !== undefined) {
    return cached;
  }
  const score = calculator();
  matchingCache.set(`pair:${key}`, score);
  return score;
}

export function getCachedSignature<T>(
  userId: string,
  generator: () => T
): T {
  const cached = signatureCache.get<T>(`sig:${userId}`);
  if (cached !== undefined) {
    return cached;
  }
  const signature = generator();
  signatureCache.set(`sig:${userId}`, signature);
  return signature;
}

export function invalidateUserCache(userId: string): void {
  matchingCache.invalidate(userId);
  signatureCache.invalidate(userId);
}

export function getCacheStats() {
  return {
    matching: matchingCache.getStats(),
    signature: signatureCache.getStats(),
  };
}

export default {
  matchingCache,
  signatureCache,
  getCachedPairScore,
  getCachedSignature,
  invalidateUserCache,
  getCacheStats,
};
