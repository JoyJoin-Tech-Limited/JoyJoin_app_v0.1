import type { AIResponseMeta } from '@shared/types/aiMeta';
import { evaluateContent, formatQualityMetrics } from './ai/aiQualityGate';
import type { JudgeFeatureType } from './ai/qualityJudgePrompts';
import { logAITrace } from './lib/aiTraceLogger';

export type AIServiceResult<T> = {
  data: T;
  meta: AIResponseMeta;
};

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
