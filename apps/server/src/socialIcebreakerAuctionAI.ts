import type { AuctionLot } from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema } from '@shared/socialIcebreaker';
import { buildAuctionLotsPrompt, AUCTION_LOTS_PROMPT_VERSION } from './ai/socialIcebreakerPrompts';
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
  });
  if (!moderation.safe) {
    return attachAIGC({
      data: options.fallbackData,
      meta: buildFallbackAIMeta('content_safety', options.promptVersion, options.aiCorrelationId),
    });
  }
  return attachAIGC(result);
}

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

export async function generateAuctionLots(params: {
  participantCount: number;
  eventType?: string;
  _refinementHint?: string;
  sessionContext?: { mixText?: string };
}): Promise<AIServiceResult<AuctionLot[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();

  if (!isAuctionLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
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
    return attachAIGC({ data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta });
  }

  const { client, model, provider } = getClientForFunction('generateAuctionLots');
  try {
    const prompt = buildAuctionLotsPrompt({
      participantCount: params.participantCount,
      eventType: params.eventType,
      _refinementHint: params._refinementHint,
      mixText: params.sessionContext?.mixText,
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
      const meta = buildFallbackAIMeta('empty_response', AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
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
      return attachAIGC({ data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
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
      return attachAIGC({ data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta });
    }

    const validated = auctionLotsLlmPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      const meta = buildFallbackAIMeta('parse_error', AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
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
      return attachAIGC({ data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta });
    }

    const latencyMs = Date.now() - t0;
    const meta = buildLiveAIMeta(provider, AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateAuctionLots',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: meta.promptVersion,
    });
    fireAndForgetQualityGate(content, 'icebreaker_auction', aiCorrelationId, 'auction', params.eventType);
    const liveLots = normalizeAuctionLots(validated.data.lots);
    return moderateAndAttachAIGC(
      { data: liveLots, meta },
      {
        provider,
        model,
        latencyMs,
        promptVersion: AUCTION_LOTS_PROMPT_VERSION,
        aiCorrelationId,
        feature: 'generateAuctionLots',
        fallbackData: normalizeAuctionLots(FALLBACK_AUCTION_LOTS),
        checks: auctionLotsChecks(liveLots),
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateAuctionLots error latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', AUCTION_LOTS_PROMPT_VERSION, aiCorrelationId);
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
    return attachAIGC({ data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta });
  }
}
