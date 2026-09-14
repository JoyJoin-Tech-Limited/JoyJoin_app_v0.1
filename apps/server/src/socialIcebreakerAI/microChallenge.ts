/**
 * Micro-challenge generation + deterministic selector wrapper for the
 * social-icebreaker AI service. Extracted verbatim from
 * socialIcebreakerAIService.ts (refactor-only move; no behavior change).
 */
import type { MicroChallenge } from '@shared/socialIcebreaker';
import { selectMicroChallenges } from '@joyjoin/shared';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
} from '@shared/types/aiMeta';
import { extractJsonPayloadForParse } from '../ai/extractLlmJson';
import { getClientForFunction } from '../ai/socialModelRouter';
import {
  buildMicroChallengesPrompt,
  MICRO_CHALLENGES_PROMPT_VERSION,
} from '../ai/socialIcebreakerPrompts';
import { createAiCorrelationId, logAITrace } from '../lib/aiTraceLogger';
import type { ModerationCheck } from '../lib/aiContentModeration';
import { buildArchetypeContext } from '../lib/contextInjector';
import { logger } from '../lib/logger';
import {
  fireAndForgetQualityGate,
  isLLMTimeoutError,
  raceWithTimeout,
  type AIServiceResult,
} from '../socialIcebreakerAICore';
import { attachAIGC, moderateAndAttachAIGC } from './moderation';

function microChallengesChecks(challenges: MicroChallenge[]): ModerationCheck[] {
  return challenges.flatMap((c, i) => [
    { field: `challenge[${i}].title`, text: c.title },
    { field: `challenge[${i}].description`, text: c.description },
    { field: `challenge[${i}].completionCTA`, text: c.completionCTA },
    { field: `challenge[${i}].visualHint`, text: c.visualHint },
  ]);
}

function isMicroChallengeLlmEnabled(): boolean {
  const v = process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

function buildSelectorMeta(): AIResponseMeta {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: null,
    fallbackUsed: false,
    promptVersion: 'selector-v1',
  };
}

function inferSceneFromEventType(eventType: string): 'dinner' | 'bar' | 'both' {
  const t = eventType.toLowerCase();
  if (t.includes('酒') || t.includes('bar') || t.includes('pub')) return 'bar';
  if (t.includes('饭') || t.includes('餐') || t.includes('dinner') || t.includes('lunch')) return 'dinner';
  return 'both';
}

export async function generateMicroChallenges(params: {
  eventType: string;
  participantCount: number;
  completedChallengeIds?: string[];
  /** Deterministic seed for template selector (e.g. session ID). */
  seed?: string;
  _refinementHint?: string;
  /** Roster archetypes (and, when matching-aware W5 is on, top interests). */
  roster?: Array<{ archetype?: string; interests?: string[] }>;
  /** W5: host-selected atmosphere mood — drives selector scoring. */
  mood?: 'relaxed' | 'funny' | 'life' | 'emotional';
  /** W5: phase energy-arc hint — drives `inferTargetEnergy` in the selector. */
  energyArc?: 'start' | 'build' | 'peak' | 'winddown';
}): Promise<AIServiceResult<MicroChallenge[]>> {
  const aiCorrelationId = createAiCorrelationId();

  // W5: build the archetype context once so it is observable on every path
  // (including the AI-disabled selector path) — production callers must pass
  // the roster for `sessionContext` to be non-undefined.
  const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
  const rosterSignalExtra = {
    sessionContext: sessionContext?.mixText ?? null,
    rosterSize: params.roster?.length ?? 0,
    mood: params.mood ?? null,
    energyArc: params.energyArc ?? null,
  };

  // 1. Always build the deterministic selector baseline. Passing mood +
  //    energyArc activates `scoreTemplate`/`inferTargetEnergy` (AC-W5.3).
  const selectorSeed = params.seed ?? `default-${params.participantCount}-${params.eventType}`;
  let selectorResult = [] as MicroChallenge[];
  try {
    selectorResult = selectMicroChallenges({
      participantCount: params.participantCount,
      completedIds: params.completedChallengeIds,
      seed: selectorSeed,
      scene: inferSceneFromEventType(params.eventType),
      count: 3,
      mood: params.mood,
      energyArc: params.energyArc,
    });
  } catch (selectorErr) {
    logger.warn('[SocialIcebreakerAI] selector fallback unavailable, relying on AI only', {
      error: selectorErr instanceof Error ? selectorErr.message : String(selectorErr),
    });
  }

  // 2. If AI is disabled, return selector result immediately
  if (!isMicroChallengeLlmEnabled()) {
    if (selectorResult.length === 0) {
      throw new Error(`No micro-challenge templates available for ${params.participantCount} players`);
    }
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateMicroChallenges',
      provider: null,
      model: 'selector-v1',
      latencyMs: 0,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: 'selector-v1',
      extra: rosterSignalExtra,
    });
    return attachAIGC({ data: selectorResult, meta: buildSelectorMeta() });
  }

  // 3. AI path (backward-compatible primary)
  const { client, model, provider } = getClientForFunction('generateMicroChallenges');
  const t0 = Date.now();

  // 6s hard abort — this generator runs inline inside transitionPhase (host
  // /advance, auto fuse, poll-driven processAutoAdvance), so an unbounded
  // DeepSeek call freezes phase transitions and stalls every session poll.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildMicroChallengesPrompt({ ...params, sessionContext });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 400,
      }, { signal: controller.signal }),
      6000,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: selectorResult, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: JSON parse failed, using selector fallback`);
      const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: selectorResult, meta });
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion, extra: rosterSignalExtra });
      fireAndForgetQualityGate(content, 'icebreaker_micro_challenge', aiCorrelationId, 'micro_challenge', params.eventType);
      const liveChallenges: MicroChallenge[] = parsed.slice(0, 3);
      return moderateAndAttachAIGC(
        { data: liveChallenges, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: MICRO_CHALLENGES_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateMicroChallenges',
          fallbackData: selectorResult,
          checks: microChallengesChecks(liveChallenges),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape, using selector fallback`);
    const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: selectorResult, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const isTimeout = isLLMTimeoutError(error);
    logger.error(`[SocialIcebreakerAI] generateMicroChallenges error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error), isTimeout });
    const meta = buildFallbackAIMeta(isTimeout ? 'timeout' : 'llm_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    if (selectorResult.length === 0) throw error;
    return attachAIGC({ data: selectorResult, meta });
  } finally {
    clearTimeout(timeoutId);
  }
}
