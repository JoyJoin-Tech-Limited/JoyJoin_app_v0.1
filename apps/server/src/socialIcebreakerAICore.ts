import type { AIResponseMeta } from '@shared/types/aiMeta';
import { evaluateContent, formatQualityMetrics } from './ai/aiQualityGate';
import type { JudgeFeatureType } from './ai/qualityJudgePrompts';
import { logAITrace } from './lib/aiTraceLogger';

export type AIServiceResult<T> = {
  data: T;
  meta: AIResponseMeta;
};

// ─── LLM hard time bounds ────────────────────────────────────────────────────

/** Uniform hard bound for social-icebreaker LLM calls. Every generator must
 *  be race-wrapped so a hung provider can never freeze a route or a
 *  transitionPhase (2026-07-26 出题卡死 incident). */
export const RACE_LLM_TIMEOUT_MS = 6000;

export class LLMCallTimeoutError extends Error {
  constructor(ms: number) {
    super(`LLM call aborted by hard race timeout after ${ms}ms`);
    this.name = 'LLMCallTimeoutError';
  }
}

/** Deterministic time bound for a promise — resolves/rejects within `ms`
 *  regardless of whether the underlying operation honors AbortSignal. The
 *  handlers attach immediately, so a late rejection from the wrapped promise
 *  is always observed (never an unhandled rejection). */
export function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new LLMCallTimeoutError(ms)), ms);
    promise.then(
      (value) => { clearTimeout(id); resolve(value); },
      (error) => { clearTimeout(id); reject(error); },
    );
  });
}

export function isLLMTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'LLMCallTimeoutError' ||
      error.name === 'AbortError' ||
      (error.message?.includes('abort') ?? false))
  );
}

// ─── Quality Gate Integration (fire-and-forget telemetry) ────────────────────

export function fireAndForgetQualityGate(
  content: string,
  featureType: JudgeFeatureType,
  traceId: string,
  phase?: string,
  eventType?: string,
) {
  // Don't block the response — evaluate async and log metrics to AITrace
  evaluateContent(content, {
    featureType,
    phase,
    eventType,
    contentLanguage: 'zh',
  }).then((result) => {
    if (result) {
      logAITrace({
        traceId,
        domain: 'icebreaker',
        feature: `${featureType}_quality_gate`,
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        latencyMs: 0,
        success: result.action !== 'discard',
        fallbackUsed: false,
        fromCache: false,
        promptVersion: 'judge-v2',
        extra: formatQualityMetrics(featureType, result),
      });
    }
  }).catch(() => {
    // Silently ignore judge failures — don't fail the user request
  });
}
