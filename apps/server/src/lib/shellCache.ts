/**
 * ShellCache — shared singleton cache for all Predictive Shell composite endpoints.
 *
 * Why a singleton?
 *   - One NodeCache instance instead of 4+ private instances = single
 *     checkperiod timer and less memory fragmentation.
 *   - Cross-shell invalidation: a pool registration can invalidate both
 *     Discover and Events caches in one call.
 *   - Future Redis migration becomes a one-file change with zero caller
 *     modifications.
 *
 * Contract reference: plan_20260517_predictive_shell_generalization.md
 */

import NodeCache from "node-cache";

const DEFAULT_TTL_SECONDS = 30;
const CHECK_PERIOD_SECONDS = 60;

class ShellCache {
  private cache = new NodeCache({
    stdTTL: DEFAULT_TTL_SECONDS,
    checkperiod: CHECK_PERIOD_SECONDS,
  });

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    this.cache.set(key, value, ttlSeconds ?? DEFAULT_TTL_SECONDS);
  }

  del(key: string): void {
    this.cache.del(key);
  }

  /**
   * Invalidate every cached entry belonging to a user.
   * Uses a wildcard prefix scan.
   */
  invalidateUser(userId: string): void {
    const keys = this.cache.keys();
    const prefix = `shell-`;
    const userSuffix = `-${userId}-`;
    for (const key of keys) {
      if (key.startsWith(prefix) && key.includes(userSuffix)) {
        this.cache.del(key);
      }
    }
  }

  /** Test hygiene only. */
  flushAll(): void {
    this.cache.flushAll();
  }
}

export const shellCache = new ShellCache();
