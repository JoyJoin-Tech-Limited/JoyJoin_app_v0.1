/**
 * AI Call Trace Logger
 * AI调用结构化追踪日志
 *
 * Lightweight structured logging helper for AI service calls.
 * Emits consistent, machine-readable trace records to stdout so that
 * future log-aggregation or admin inspection tooling can query them
 * without coupling to a specific storage backend.
 *
 * Shape aligns with `AICallTrace` from docs/AI_INTEGRATION_PLAN.md §10.4
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

import { randomUUID } from 'node:crypto';
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
   *
   * - Use the attempted provider even when the call fails
   *   (e.g. 'parse_error', 'llm_error', 'timeout').
   * - Use null only when no live model call was made (pure
   *   deterministic fallback), or when the result was served
   *   from cache and the original provider is unknown.
   */
  provider: AIProvider;

  /**
   * Model identifier string returned by the routing layer.
   * Optional: include when naturally available from the router.
   */
  model?: string;

  /**
   * End-to-end wall-clock latency for this AI execution in milliseconds,
   * including time spent across retries and any fallback provider calls.
   */
  latencyMs: number;

  /**
   * LLM output acceptance flag.
   *
   * true  → an LLM-generated result (from the primary or a secondary provider,
   *         or from a cache of a previous LLM call) was accepted by the
   *         post-processing pipeline and used for the response.
   *
   * false → no LLM output was used for this response (e.g. all LLM calls
   *         failed or were rejected and deterministic / rule-based fallback
   *         content was served instead). The caller may still receive usable
   *         content when this is false; this flag is specifically about
   *         whether an LLM result was used, not overall request success.
   */
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
 * Generate an opaque trace ID for log correlation.
 * Uses Node's UUID generator to reduce collision risk across
 * concurrent requests and processes.
 */
function generateTraceId(): string {
  return randomUUID();
}
