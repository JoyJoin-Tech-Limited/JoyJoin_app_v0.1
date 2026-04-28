/**
 * DeepSeek Pro-tier daily budget tracker
 *
 * Guards against runaway Pro-tier spend by maintaining an in-memory
 * daily spend counter.  When the configured budget is exceeded, all
 * requests for `pro-thinking` are silently downgraded to `flash`.
 *
 * Usage:
 *   import { isProBudgetAvailable, recordProUsage } from './deepseekBudgetTracker';
 *
 *   // Before routing a call to Pro
 *   const tier = isProBudgetAvailable() ? 'pro-thinking' : 'flash';
 *
 *   // After the API call returns
 *   recordProUsage({ inputTokens, outputTokens });
 *
 * Cost estimation uses DeepSeek V4 Pro published pricing:
 *   - Input (cache miss):  $1.74 / 1M tokens
 *   - Output:              $3.48 / 1M tokens
 *
 * The tracker auto-resets at midnight local time.  It is process-local
 * (not distributed), which is sufficient for a single-server deployment.
 */

import NodeCache from 'node-cache';
import { logger } from '../lib/logger';

// ─── Pricing constants (USD per 1M tokens) ───────────────────────────────────
const PRO_INPUT_PRICE_PER_1M = 1.74;
const PRO_OUTPUT_PRICE_PER_1M = 3.48;

// ─── Configuration ───────────────────────────────────────────────────────────
const DAILY_BUDGET_USD = parseFloat(process.env.DEEPSEEK_PRO_DAILY_BUDGET_USD || '0');
const BUDGET_ENABLED = DAILY_BUDGET_USD > 0;

// ─── In-memory daily spend store ─────────────────────────────────────────────
// Keyed by ISO date string (YYYY-MM-DD).  TTL = 25 hours so the previous
// day's data lingers slightly past midnight, avoiding race conditions.
const spendStore = new NodeCache({ stdTTL: 25 * 60 * 60 });

interface DailySpend {
  inputTokens: number;
  outputTokens: number;
  estimatedSpendUSD: number;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getOrCreateDailySpend(): DailySpend {
  const key = getTodayKey();
  const existing = spendStore.get<DailySpend>(key);
  if (existing) return existing;

  const fresh: DailySpend = { inputTokens: 0, outputTokens: 0, estimatedSpendUSD: 0 };
  spendStore.set(key, fresh);
  return fresh;
}

function estimateCostUSD(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRO_INPUT_PRICE_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * PRO_OUTPUT_PRICE_PER_1M;
  return inputCost + outputCost;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns true if the Pro tier is still within the daily budget.
 * Always returns true when no budget is configured.
 */
export function isProBudgetAvailable(): boolean {
  if (!BUDGET_ENABLED) return true;
  const spend = getOrCreateDailySpend();
  return spend.estimatedSpendUSD < DAILY_BUDGET_USD;
}

/**
 * Record actual token usage from a Pro-tier API call.
 * Callers should extract `usage.prompt_tokens` and `usage.completion_tokens`
 * from the OpenAI SDK response and pass them here.
 */
export function recordProUsage(options: {
  inputTokens: number;
  outputTokens: number;
  feature?: string;
}): void {
  if (!BUDGET_ENABLED) return;

  const { inputTokens, outputTokens, feature } = options;
  const incrementalCost = estimateCostUSD(inputTokens, outputTokens);

  const spend = getOrCreateDailySpend();
  spend.inputTokens += inputTokens;
  spend.outputTokens += outputTokens;
  spend.estimatedSpendUSD += incrementalCost;

  spendStore.set(getTodayKey(), spend);

  if (spend.estimatedSpendUSD >= DAILY_BUDGET_USD) {
    logger.warn(
      'DeepSeek Pro daily budget exceeded',
      {
        feature: feature || 'unknown',
        dailySpendUSD: spend.estimatedSpendUSD.toFixed(4),
        budgetUSD: DAILY_BUDGET_USD,
        inputTokens: spend.inputTokens,
        outputTokens: spend.outputTokens,
      },
    );
  }
}

/**
 * Get current day's estimated Pro spend for monitoring / admin endpoints.
 */
export function getProSpendTodayUSD(): number {
  return getOrCreateDailySpend().estimatedSpendUSD;
}

/**
 * Get current day's token totals for monitoring.
 */
export function getProTokenUsageToday(): { inputTokens: number; outputTokens: number } {
  const spend = getOrCreateDailySpend();
  return { inputTokens: spend.inputTokens, outputTokens: spend.outputTokens };
}
