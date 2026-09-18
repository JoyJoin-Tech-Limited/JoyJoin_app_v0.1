/**
 * Recap-summary generation for the social-icebreaker AI service. Extracted
 * verbatim from socialIcebreakerAIService.ts (refactor-only move; no behavior
 * change).
 */
import { buildFallbackAIMeta, buildLiveAIMeta } from '@shared/types/aiMeta';
import {
  buildRecapSummaryPrompt,
  RECAP_SUMMARY_PROMPT_VERSION,
  RECAP_SUMMARY_PROMPT_VERSION_HL,
} from '../ai/socialIcebreakerPrompts';
import { getClientForFunction } from '../ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from '../lib/aiTraceLogger';
import type { ModerationCheck } from '../lib/aiContentModeration';
import { buildArchetypeContext } from '../lib/contextInjector';
import { logger } from '../lib/logger';
import {
  fireAndForgetQualityGate,
  raceWithTimeout,
  RACE_LLM_TIMEOUT_MS,
  type AIServiceResult,
} from '../socialIcebreakerAICore';
import { attachAIGC, moderateAndAttachAIGC } from './moderation';

function recapChecks(recap: { headline: string; moments: string[]; closingLine: string }): ModerationCheck[] {
  const checks: ModerationCheck[] = [
    { field: 'headline', text: recap.headline },
    { field: 'closingLine', text: recap.closingLine },
  ];
  recap.moments.forEach((moment, i) => checks.push({ field: `moment[${i}]`, text: moment }));
  return checks;
}

function isRecapLlmEnabled(): boolean {
  const v = process.env.SOCIAL_RECAP_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateRecapSummary(params: {
  participants: Array<{ displayName: string; archetype?: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  lieDetectiveHighlights?: string[];
  /** Bounded one-liners, e.g. "Name：挑战标题" — max ~6 in caller */
  personalityDiceRecapLines?: string[];
  /** Single bounded line, e.g. premise excerpt */
  miniScriptRecapLine?: string;
  /** Bounded one-liners after auction phase, e.g. lot titles + winners */
  auctionRecapLines?: string[];
  durationMinutes: number;
  /** Wave 3 (contract AC-07): aggregate session highlights body (state.highlights).
   *  Threaded into the prompt as a 【本场高光】 block when non-empty; also drives
   *  the paired *_HL promptVersion selection (AC-08). */
  highlights?: string;
}): Promise<AIServiceResult<{ headline: string; moments: string[]; closingLine: string }>> {
  const aiCorrelationId = createAiCorrelationId();
  // Wave 3 (contract AC-08): paired version selected pre-build, never post-hoc.
  const highlightsInjected = Boolean(params.highlights?.trim());
  const promptVersion = highlightsInjected
    ? RECAP_SUMMARY_PROMPT_VERSION_HL
    : RECAP_SUMMARY_PROMPT_VERSION;

  // If AI is disabled, return deterministic default recap immediately
  if (!isRecapLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  }

  const { client, model, provider } = getClientForFunction('generateRecapSummary');
  const t0 = Date.now();
  try {
    const sessionContext = buildArchetypeContext(params.participants);
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }

    const prompt = buildRecapSummaryPrompt({ ...params, sessionContext });

    // 6s hard bound — this generator runs inside transitionPhase on the path
    // into recap, so an unbounded call freezes the whole session.
    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 300,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
      return attachAIGC({ data: getDefaultRecap(params), meta });
    }

    const parsed = JSON.parse(content);
    if (parsed.headline && parsed.moments && parsed.closingLine) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion, extra: { highlightsInjected } });
      fireAndForgetQualityGate(content, 'icebreaker_recap', aiCorrelationId, 'recap');
      const liveRecap: { headline: string; moments: string[]; closingLine: string } = parsed;
      return moderateAndAttachAIGC(
        { data: liveRecap, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion,
          aiCorrelationId,
          feature: 'generateRecapSummary',
          fallbackData: getDefaultRecap(params),
          checks: recapChecks(liveRecap),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateRecapSummary error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  }
}

function getDefaultRecap(params: {
  participants: Array<{ displayName: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  durationMinutes: number;
}): { headline: string; moments: string[]; closingLine: string } {
  const names = params.participants.map(p => p.displayName);
  return {
    headline: `${params.durationMinutes}分钟，这局有点东西`,
    moments: [
      `聊了${params.topicsDiscussed.length}个话题，有几个还挺深的`,
      `完成了${params.challengesCompleted}个挑战，没人掉链子`,
      `发现了${params.commonGroundCount}个共同点，缘分啊`,
      `${names.length}个人，从陌生到能聊到一块`,
    ],
    closingLine: `这局算你们赢，下次继续 ${names.length > 2 ? '（特别是' + names.slice(0, 2).join('和') + '）' : ''}🌟`,
  };
}
