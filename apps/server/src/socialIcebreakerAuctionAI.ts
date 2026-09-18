import type { AuctionLot } from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema, AUCTION_LOT_COUNT_MIN, AUCTION_MAX_LOTS } from '@shared/socialIcebreaker';
import { padAuctionLotsToTarget, selectAuctionFallbackLots, type AuctionVibe } from '@shared/socialIcebreakerAuctionFallback';
import { buildAuctionLotsPrompt, AUCTION_LOTS_PROMPT_VERSION, AUCTION_LOTS_PROMPT_VERSION_V3 } from './ai/socialIcebreakerPrompts';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildAIGCMeta,
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { moderateGeneratedContent, type ModerationCheck } from './lib/aiContentModeration';
import { logger } from './lib/logger';
import { fireAndForgetQualityGate, raceWithTimeout, RACE_LLM_TIMEOUT_MS, type AIServiceResult } from './socialIcebreakerAICore';

function auctionLotsChecks(lots: AuctionLot[]): ModerationCheck[] {
  return lots.flatMap((lot, index) => [
    { field: `lot[${index}].title`, text: lot.title },
    { field: `lot[${index}].teaser`, text: lot.teaser },
  ]);
}

function attachAIGC<T>(result: AIServiceResult<T>): AIServiceResult<T> {
  return {
    data: result.data,
    meta: {
      ...result.meta,
      aigc: buildAIGCMeta({ fallbackUsed: result.meta.fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

function moderateAndAttachAIGC<T>(
  result: AIServiceResult<T>,
  options: {
    provider: AIProvider | null;
    model?: string;
    latencyMs: number;
    promptVersion: string;
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
    // W7.2: WeChat review posture — banned vocabulary degrades to curated.
    enforceReviewVocab: true,
  });
  if (!moderation.safe) {
    return attachAIGC({
      data: options.fallbackData,
      meta: buildFallbackAIMeta('content_safety', options.promptVersion, options.aiCorrelationId),
    });
  }
  return attachAIGC(result);
}

/**
 * Legacy flag-OFF fallback (contract AC-09): the V1 path keeps this exact
 * 3-item constant byte-for-byte. The canonical 12-item bank in
 * `@shared/socialIcebreakerAuctionFallback` serves ONLY the V2 path.
 */
const FALLBACK_AUCTION_LOTS: AuctionLot[] = [
  { id: 'lot_fb_1', title: '分享一个无伤大雅的社死瞬间', teaser: '越离谱越好，反正大家都不认识', emoji: '😅' },
  { id: 'lot_fb_2', title: '用三句话编一个离谱旅行故事', teaser: '现场即兴，瞎编也行', emoji: '✈️' },
  { id: 'lot_fb_3', title: '爆料一个今晚之前没人知道的小习惯', teaser: '说完就翻篇，不截图', emoji: '🤫' },
];

function isAuctionLlmEnabled(): boolean {
  const v = process.env.SOCIAL_AUCTION_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

function normalizeAuctionLots(raw: AuctionLot[]): AuctionLot[] {
  return raw.map((lot, i) => ({
    id: (lot.id || `lot_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48),
    title: lot.title?.trim() || `竞拍项 ${i + 1}`,
    teaser: lot.teaser?.trim() ? lot.teaser.trim().slice(0, 200) : undefined,
    emoji: lot.emoji?.trim() || undefined,
  }));
}

/**
 * Auction V2 (sprint wave2-auctionV2, verifier M1): prompt version resolves
 * PER SESSION SNAPSHOT. snapshot ON → v3; OFF/undefined (legacy sessions) →
 * v2, byte-identical to pre-V2 behavior. Consumed by this service AND by the
 * generate-lots cached-meta path in socialIcebreakerExtended.ts (:996 drift
 * fix — legacy cached meta now stamps v2 instead of the hardcoded v1).
 */
export function resolveAuctionLotsPromptVersion(auctionV2Enabled: boolean | undefined): string {
  return auctionV2Enabled === true ? AUCTION_LOTS_PROMPT_VERSION_V3 : AUCTION_LOTS_PROMPT_VERSION;
}

export async function generateAuctionLots(params: {
  participantCount: number;
  eventType?: string;
  _refinementHint?: string;
  sessionContext?: { mixText?: string };
  /** Auction V2: session snapshot (state.auctionV2Enabled). Absent ≡ legacy. */
  auctionV2?: boolean;
  /** Auction V2: table vibe for prompt + bank filtering. */
  vibe?: AuctionVibe;
  /** Auction V2 (spec D5): deterministic lot-count target, clamp(bidders,3,5). */
  targetLotCount?: number;
  /** Auction V2: rotation seed for the deterministic fallback subset. */
  sessionId?: string;
}): Promise<AIServiceResult<AuctionLot[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();

  const v2Enabled = params.auctionV2 === true;
  const promptVersion = resolveAuctionLotsPromptVersion(params.auctionV2);
  const targetLotCount = v2Enabled
    ? Math.min(Math.max(params.targetLotCount ?? AUCTION_LOT_COUNT_MIN, AUCTION_LOT_COUNT_MIN), AUCTION_MAX_LOTS)
    : undefined;
  /** Flag OFF → legacy 3-item bank (byte-identical); flag ON → canonical
   *  12-item bank, vibe-filtered + session-rotated at the clamp target. */
  const buildFallbackLots = (): AuctionLot[] =>
    v2Enabled
      ? normalizeAuctionLots(
          selectAuctionFallbackLots({
            count: targetLotCount ?? AUCTION_LOT_COUNT_MIN,
            vibe: params.vibe,
            sessionId: params.sessionId,
          }),
        )
      : normalizeAuctionLots(FALLBACK_AUCTION_LOTS);

  if (!isAuctionLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', promptVersion, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateAuctionLots',
      provider: 'deepseek',
      model: 'n/a',
      latencyMs: Date.now() - t0,
      success: true,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: buildFallbackLots(), meta });
  }

  const { client, model, provider } = getClientForFunction('generateAuctionLots');
  try {
    const prompt = buildAuctionLotsPrompt({
      participantCount: params.participantCount,
      eventType: params.eventType,
      _refinementHint: params._refinementHint,
      mixText: params.sessionContext?.mixText,
      // Auction V2: new args only on the flag-ON path — flag OFF builds the
      // byte-identical v2 prompt (verifier M1).
      ...(v2Enabled ? { vibe: params.vibe, targetLotCount } : {}),
    });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens: 500,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', promptVersion, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateAuctionLots',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: buildFallbackLots(), meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', promptVersion, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateAuctionLots',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: buildFallbackLots(), meta });
    }

    const validated = auctionLotsLlmPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      const meta = buildFallbackAIMeta('parse_error', promptVersion, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateAuctionLots',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: buildFallbackLots(), meta });
    }

    const latencyMs = Date.now() - t0;
    const meta = buildLiveAIMeta(provider, promptVersion, aiCorrelationId);
    fireAndForgetQualityGate(content, 'icebreaker_auction', aiCorrelationId, 'auction', params.eventType);
    const liveLots = normalizeAuctionLots(validated.data.lots);

    // Auction V2 (verifier M2): pad an under-delivering LLM generation to the
    // deterministic clamp target BEFORE moderation/tracing so the success
    // trace and meta carry the final fallbackUsed/paddedCount semantics.
    const padded = v2Enabled && targetLotCount
      ? padAuctionLotsToTarget(liveLots, targetLotCount, { vibe: params.vibe, sessionId: params.sessionId })
      : { lots: liveLots, paddedCount: 0 };
    const finalLots = padded.lots;
    const finalFallbackUsed = padded.paddedCount > 0;
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateAuctionLots',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: finalFallbackUsed,
      fromCache: false,
      promptVersion: meta.promptVersion,
      ...(finalFallbackUsed
        ? { errorCode: 'lots_padded', extra: { paddedCount: padded.paddedCount } }
        : {}),
    });
    const moderated = moderateAndAttachAIGC(
      { data: finalLots, meta },
      {
        provider,
        model,
        latencyMs,
        promptVersion,
        aiCorrelationId,
        feature: 'generateAuctionLots',
        fallbackData: buildFallbackLots(),
        checks: auctionLotsChecks(finalLots),
      },
    );
    if (!finalFallbackUsed || moderated.meta.fallbackUsed) {
      return moderated;
    }
    // Padded live generation: bank supplied ≥1 lot → meta falls back to
    // fail-closed (AIGC badge hidden on mixed live+curated content) with
    // paddedCount recorded (verifier M2).
    return attachAIGC({
      data: moderated.data,
      meta: { ...moderated.meta, fallbackUsed: true, paddedCount: padded.paddedCount },
    });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateAuctionLots error latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', promptVersion, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateAuctionLots',
      provider: 'deepseek',
      model: 'n/a',
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: buildFallbackLots(), meta });
  }
}
