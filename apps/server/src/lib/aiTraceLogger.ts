/**
 * AI Call Trace Logger
 * AI调用结构化追踪日志
 *
 * Lightweight structured logging helper for AI service calls.
 * Emits consistent, machine-readable trace records to stdout so that
 * future log-aggregation or admin inspection tooling can query them
 * without coupling to a specific storage backend.
 *
 * Shape aligns with `AICallTrace` from AI_INTEGRATION_PLAN.md §10.4
 * and uses the same `AIProvider` vocabulary as `packages/shared/src/types/aiMeta.ts`.
 *
 * Usage:
 *   import { logAITrace } from '../lib/aiTraceLogger';
 *
 *   logAITrace({
 *     domain: 'match_explanation',
 *     feature: 'generatePairExplanation',
 *     provider: 'minimax',
 *     model: 'minimax-m2.7',
 *     latencyMs: Date.now() - t0,
 *     success: true,
 *     fallbackUsed: false,
 *     fromCache: false,
 *   });
 *
 * Design notes:
 *   - No PII is logged (no userId, no prompt content, no user-generated text).
 *   - `traceId` is auto-generated as a lightweight collision-resistant token.
 *   - The record is emitted as a single JSON line prefixed with [AITrace] so
 *     that log scanners can identify and extract trace lines without ambiguity.
 *   - This is intentionally minimal groundwork — storage/indexing is a future concern.
 */

import type { AIProvider } from '@shared/types/aiMeta';

/**
 * Structured record describing a single AI service call execution.
 * All fields are non-PII — do NOT add userId, prompt content, or
 * any user-generated text to this interface.
 */
export interface AICallTrace {
  /** Auto-generated opaque identifier for this trace record. */
  traceId: string;

  /** ISO-8601 timestamp of when the call completed (or failed). */
  timestamp: string;

  /**
   * High-level domain / product area for grouping.
   * Examples: 'match_explanation', 'icebreaker', 'theme_generation'
   */
  domain: string;

  /**
   * Specific service function that was called.
   * Examples: 'generatePairExplanation', 'generateWarmupTopics'
   */
  feature: string;

  /**
   * LLM provider used for this call.
   * null when fromCache is true and provider is unknown, or when
   * a deterministic fallback was activated.
   */
  provider: AIProvider;

  /**
   * Model identifier string returned by the routing layer.
   * Optional: include when naturally available from the router.
   */
  model?: string;

  /** Wall-clock latency of the LLM call in milliseconds. */
  latencyMs: number;

  /** true → call succeeded and usable content was returned */
  success: boolean;

  /**
   * true → any fallback execution path was used instead of the primary provider,
   * including:
   *   (a) a secondary provider (e.g. DeepSeek used when MiniMax fails), or
   *   (b) deterministic curated fallback content activated when all LLM calls fail.
   * false → the primary provider was used successfully.
   */
  fallbackUsed: boolean;

  /**
   * true → result was served from an in-memory or DB cache;
   * no live LLM call was made for this request.
   */
  fromCache: boolean;

  /**
   * Version tag of the prompt template used (optional).
   * Align with the prompt registry when it is wired up.
   */
  promptVersion?: string;

  /**
   * Short lowercase slug describing why the call failed or why
   * fallback was activated. Non-PII only.
   * Examples: 'llm_error', 'parse_error', 'evaluator_rejection', 'timeout'
   */
  errorCode?: string;
}

/**
 * Emit a structured AI call trace record to stdout as a single JSON line.
 *
 * The line is prefixed with `[AITrace]` so log-processing tooling can
 * identify trace lines by prefix without requiring a full JSON parse on
 * every log line.
 *
 * @param fields  Trace fields. `traceId` and `timestamp` are auto-populated
 *                if not provided.
 */
export function logAITrace(
  fields: Omit<AICallTrace, 'traceId' | 'timestamp'> &
    Partial<Pick<AICallTrace, 'traceId' | 'timestamp'>>,
): void {
  const record: AICallTrace = {
    traceId: fields.traceId ?? generateTraceId(),
    timestamp: fields.timestamp ?? new Date().toISOString(),
    domain: fields.domain,
    feature: fields.feature,
    provider: fields.provider,
    model: fields.model,
    latencyMs: fields.latencyMs,
    success: fields.success,
    fallbackUsed: fields.fallbackUsed,
    fromCache: fields.fromCache,
    promptVersion: fields.promptVersion,
    errorCode: fields.errorCode,
  };

  // Strip undefined keys for compact output
  const compact = Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as AICallTrace;

  console.log(`[AITrace] ${JSON.stringify(compact)}`);
}

/**
 * Generate a lightweight opaque trace ID.
 * Not cryptographically secure — used only for log correlation,
 * not for security-sensitive operations.
 */
function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}
