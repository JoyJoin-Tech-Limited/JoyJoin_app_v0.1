/**
 * Cache Layer for Industry Classification
 * 
 * Provides caching for AI classification results to improve performance
 * and reduce API calls to DeepSeek.
 */

import NodeCache from "node-cache";

// Cache TTL: 1 hour (3600 seconds)
const aiCache = new NodeCache({ stdTTL: 3600 });

export interface CachedClassification {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  confidence: number;
  reasoning?: string;
  source: string;
  rawInput: string;
  normalizedInput: string;
}

/**
 * Generate cache key from description and context
 */
export function generateCacheKey(
  description: string,
  context?: {
    occupationId?: string;
    lockedCategoryId?: string;
    source?: string;
  }
): string {
  const cleanDesc = description.trim().toLowerCase();
  
  const keyPayload = {
    description: cleanDesc,
    occupationId: context?.occupationId ?? null,
    lockedCategoryId: context?.lockedCategoryId ?? null,
    source: context?.source ?? null,
  };

  return JSON.stringify(keyPayload);
}

/**
 * Get cached classification result
 */
export function getCachedClassification(cacheKey: string): CachedClassification | undefined {
  return aiCache.get<CachedClassification>(cacheKey);
}

/**
 * Save classification result to cache
 */
export function setCachedClassification(
  cacheKey: string, 
  result: CachedClassification
): void {
  aiCache.set(cacheKey, result);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return aiCache.getStats();
}

/**
 * Clear cache (for testing/admin purposes)
 */
export function clearCache(): void {
  aiCache.flushAll();
}
