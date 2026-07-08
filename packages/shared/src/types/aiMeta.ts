/**
 * AI Response Observability Metadata
 * AI响应可观察性元数据
 *
 * A lightweight shared foundation for structured AI response metadata
 * across all AI-backed services in this repo.
 *
 * Usage: Embed this interface in AI service response types as a named
 * `meta` field, or extend existing response shapes that already carry
 * individual observability fields (`fromCache`, `generatedAt`, etc.).
 *
 * This type is intentionally minimal — it captures the core fields needed
 * for observability, auditability, and fallback reporting without
 * forcing a full envelope wrapper on existing response shapes.
 *
 * Context:
 *   - Fields map to the `AICallTrace` shape in AI_INTEGRATION_PLAN.md §10.4
 *     (Trace Viewer MVP Requirements).
 *   - Also mirrors the 7-stage guardrail pipeline in
 *     docs/ai/ai-agent-harness-separation-strategy.md §8 (stage 7: structured
 *     output return + logging and observability metadata emission).
 *
 * Current repo state: `GroupAnalysisResponse` (packages/shared/src/types/groupAnalysis.ts)
 * already carries `fromCache` and `generatedAt` inline on the response.
 * Future PRs may migrate those inline fields to reference this contract,
 * or embed `AIResponseMeta` as a nested `meta` field on new response shapes.
 * Do NOT duplicate the Match Intelligence contract — extend `groupAnalysis.ts`.
 *
 * Import via:
 *   import type { AIResponseMeta } from '@shared/types/aiMeta';
 *   import { buildLiveAIMeta, buildCachedAIMeta, buildFallbackAIMeta } from '@shared/types/aiMeta';
 */

/**
 * LLM provider identifier.
 * null in two cases:
 *   (a) a deterministic fallback was activated and no model was called, or
 *   (b) the response came from cache and the original provider is not recorded
 *       in the cached record.
 * Use `fallbackUsed` to distinguish case (a) from case (b).
 */
export type AIProvider = 'minimax' | 'deepseek' | null;

/**
 * Provider identifier for a fresh live LLM response.
 * Unlike `AIProvider`, this excludes null because the serving provider
 * must be known when a live model call succeeds.
 */
export type LiveAIProvider = Exclude<AIProvider, null>;

/**
 * AIGC compliance metadata for AI-generated or AI-assisted content surfaces.
 *
 * Carried in AIResponseMeta so clients can render an AIGC label when the
 * AIGC_LABELS_ENABLED feature flag is on. The meta itself is always present;
 * label rendering is gated client-side by the feature flag.
 */
export interface AIGCMeta {
  /**
   * true  → content is AI-generated or AI-assisted and should carry a label
   *         when AIGC labels are enabled.
   * false → deterministic fallback content (no AI generated this text), so no
   *         AIGC label is needed.
   */
  aiGenerated: boolean;

  /**
   * Which label variant the client should render when `aiGenerated` is true.
   *   - 'ai-generated' → primary label "AI 生成内容"
   *   - 'ai-assisted'  → allowed secondary label "AI 辅助生成" (only where output
   *                      clearly augments user-provided content, e.g. profession
   *                      reaction built on the user's profession text).
   * Omit when `aiGenerated` is false (deterministic fallback).
   */
  labelType?: 'ai-generated' | 'ai-assisted';
}

/**
 * Build a consistent AIGCMeta object.
 *
 * Note: when `fallbackUsed` is true, `labelType` is intentionally ignored.
 * Deterministic fallback content (curated templates, rule-based output) is
 * not considered AI-generated for AIGC-labeling purposes, so the returned
 * meta is always `{ aiGenerated: false }` in that case. Pass `labelType`
 * only when `fallbackUsed` is false.
 */
export function buildAIGCMeta({
  fallbackUsed,
  labelType,
}: {
  fallbackUsed: boolean;
  labelType?: 'ai-generated' | 'ai-assisted';
}): AIGCMeta {
  if (fallbackUsed) {
    return { aiGenerated: false };
  }
  return { aiGenerated: true, labelType: labelType ?? 'ai-generated' };
}

/**
 * Standard observability metadata for AI-backed service responses.
 *
 * Embed in response types or pass alongside responses for structured
 * logging and the Phase A trace viewer (AI_INTEGRATION_PLAN.md §10.4).
 *
 * These fields are aligned with the guardrail pipeline stage 7, which:
 * "Returns only the Policy Synthesizer-approved structured output and
 *  logs: prompt version, model version, input context hash, output schema
 *  validity, latency, fallback usage."
 */
export interface AIResponseMeta {
  /**
   * ISO-8601 timestamp of when this response was generated or last refreshed.
   * Clients can use this to display "updated X minutes ago".
   */
  generatedAt: string;

  /**
   * true  → response was served from cache (no live LLM call made this request)
   * false → fresh generation was performed
   */
  fromCache: boolean;

  /**
   * The LLM provider used for this response.
   * null when fromCache is true and the original provider is unknown,
   * or when a deterministic fallback was activated and no model was called.
   */
  provider: AIProvider;

  /**
   * true  → deterministic fallback content was used instead of live LLM output
   * (e.g. curated fallback library in socialIcebreakerAIService.ts,
   *  static archetype descriptions, rule-based theme generation).
   * false → live LLM output was used (possibly served from a previous cached call).
   */
  fallbackUsed: boolean;

  /**
   * Version tag of the prompt template used, for auditability and rollback.
   * Should match the promptId/version in the prompt registry
   * (AI_INTEGRATION_PLAN.md §10.4 — Phase A deliverable).
   * Optional: omit until the prompt registry is wired.
   */
  promptVersion?: string;

  /**
   * Non-PII reason string if an evaluator stage rejected the LLM output
   * and triggered fallback activation.
   * Structured for log-queryability — use short lowercase slug values.
   * Examples: 'schema_invalid', 'safety_flag', 'low_quality_score', 'timeout'
   * Optional: omit when no evaluator stage ran, or when output was accepted.
   */
  evaluatorRejectionReason?: string;

  /**
   * Opaque id matching `[AITrace].traceId` for this generation (client feedback join).
   * Omit when no model call was made (e.g. canned copy) or correlation is unavailable.
   */
  aiCorrelationId?: string;

  /**
   * AIGC compliance metadata. Always present so clients can render labels
   * when the AIGC_LABELS_ENABLED feature flag is enabled.
   */
  aigc?: AIGCMeta;

  /**
   * AI Quality Gate scores (optional — populated when the quality judge ran).
   * See apps/server/src/ai/aiQualityGate.ts for dimensions and thresholds.
   */
  qualityScores?: {
    funEngagement: number;
    brandAlignment: number;
    appropriateness: number;
    clarity: number;
    passed: boolean;
    action: 'pass' | 'refine' | 'discard';
  };
}

// ─── Builder helpers ───────────────────────────────────────────────────────────
// Use these helpers in service code to create consistent AIResponseMeta objects
// without manually setting every field.

/**
 * Build AIResponseMeta for a fresh live LLM response.
 *
 * @param provider  The provider that served the response.
 * @param promptVersion  Optional prompt registry version tag.
 */
export function buildLiveAIMeta(
  provider: LiveAIProvider,
  promptVersion?: string,
  aiCorrelationId?: string,
): AIResponseMeta {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider,
    fallbackUsed: false,
    promptVersion,
    ...(aiCorrelationId ? { aiCorrelationId } : {}),
  };
}

/**
 * Build AIResponseMeta for a cache-hit response.
 * Pass the `generatedAt` timestamp from the cached record so clients
 * can accurately display "updated X minutes ago".
 *
 * @param generatedAt  ISO-8601 timestamp from the original generation.
 * @param provider  The provider used at the time of original generation.
 *                  Pass null explicitly when the cached record does not
 *                  store the original provider.
 */
export function buildCachedAIMeta(
  generatedAt: string,
  provider: AIProvider,
  promptVersion?: string,
  aiCorrelationId?: string,
): AIResponseMeta {
  return {
    generatedAt,
    fromCache: true,
    provider,
    fallbackUsed: false,
    promptVersion,
    ...(aiCorrelationId ? { aiCorrelationId } : {}),
  };
}

/**
 * Build AIResponseMeta for a deterministic fallback response.
 * Called when the evaluator rejects LLM output or when the model
 * is unavailable and curated fallback content is activated.
 *
 * @param evaluatorRejectionReason  Optional structured reason slug.
 */
export function buildFallbackAIMeta(
  evaluatorRejectionReason?: string,
  promptVersion?: string,
  aiCorrelationId?: string,
): AIResponseMeta {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: null,
    fallbackUsed: true,
    promptVersion,
    evaluatorRejectionReason,
    ...(aiCorrelationId ? { aiCorrelationId } : {}),
  };
}
