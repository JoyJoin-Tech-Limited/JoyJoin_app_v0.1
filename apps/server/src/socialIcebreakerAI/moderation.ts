/**
 * Generic moderation + AIGC-attachment helpers for the social-icebreaker AI
 * service. Extracted verbatim from socialIcebreakerAIService.ts (refactor-only
 * move; no behavior change).
 */
import { findReviewBlockedVocab } from '@shared/copy/terms';
import {
  buildAIGCMeta,
  buildFallbackAIMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { moderateGeneratedContent, type ModerationCheck } from '../lib/aiContentModeration';
import type { AIServiceResult } from '../socialIcebreakerAICore';

export type { ModerationCheck };

/** W7.2: first review-blocked token across a set of visible AI strings, or null. */
export function containsReviewBlockedVocab(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const hit = findReviewBlockedVocab(value);
    if (hit) return hit;
  }
  return null;
}

export function attachAIGC<T>(result: AIServiceResult<T>): AIServiceResult<T> {
  return {
    data: result.data,
    meta: {
      ...result.meta,
      aigc: buildAIGCMeta({ fallbackUsed: result.meta.fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

export function moderateAndAttachAIGC<T>(
  result: AIServiceResult<T>,
  options: {
    provider: AIProvider | null;
    model?: string;
    latencyMs: number;
    promptVersion?: string;
    aiCorrelationId: string;
    feature: string;
    fallbackData: T;
    checks: ModerationCheck[];
  },
): AIServiceResult<T> {
  if (result.meta.fallbackUsed) {
    return attachAIGC(result);
  }
  const moderation = moderateGeneratedContent(options.checks, {
    domain: 'icebreaker',
    feature: options.feature,
    provider: options.provider,
    model: options.model,
    latencyMs: options.latencyMs,
    promptVersion: options.promptVersion,
    traceId: options.aiCorrelationId,
    // W7.2: WeChat review posture — no visible AI string may contain
    // 匹配/社交/灵魂/撮合/AI. A hit degrades the payload to curated fallback.
    enforceReviewVocab: true,
  });
  if (!moderation.safe) {
    return attachAIGC({
      data: options.fallbackData,
      meta: buildFallbackAIMeta(
        moderation.blockedWord ? 'banned_vocab' : 'content_safety',
        options.promptVersion ?? 'unknown',
        options.aiCorrelationId,
      ),
    });
  }
  return attachAIGC(result);
}
