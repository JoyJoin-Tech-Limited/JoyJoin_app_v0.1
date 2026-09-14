import { logger } from '../lib/logger';
import { API_CONFIG } from './constants';

// ============ 重试与并发控制 ============

/**
 * 带指数退避的重试逻辑
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = API_CONFIG.MAX_RETRIES,
  baseDelayMs: number = API_CONFIG.RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`[MatchExplanation] Attempt ${attempt + 1} failed:`, { error: (error as Error).message });
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * 控制并发的批量执行器（使用队列模式）
 */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number = API_CONFIG.CONCURRENCY_LIMIT
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  
  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await fn(item);
    }
  }
  
  // Create 'limit' number of workers that process items from the queue
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  
  return results;
}
