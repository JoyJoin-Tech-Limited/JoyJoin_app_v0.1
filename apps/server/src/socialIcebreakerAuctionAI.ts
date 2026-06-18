import type { AuctionLot } from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema } from '@shared/socialIcebreaker';
import { buildAuctionLotsPrompt, AUCTION_LOTS_PROMPT_VERSION } from './ai/socialIcebreakerPrompts';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
} from '@shared/types/aiMeta';
import { logger } from './lib/logger';
import { fireAndForgetQualityGate, type AIServiceResult } from './socialIcebreakerAICore';

const FALLBACK_AUCTION_LOTS: AuctionLot[] = [
  { id: 'lot_fb_1', title: '分享一个无伤大雅的社死瞬间', teaser: '越离谱越好，反正大家都不认识', emoji: '😅' },
  { id: 'lot_fb_2', title: '用三句话编一个离谱旅行故事', teaser: '现场即兴，瞎编也行', emoji: '✈️' },
  { id: 'lot_fb_3', title: '爆料一个今晚之前没人知道的小习惯', teaser: '说完就翻篇，不截图', emoji: '🤫' },
];

function isAuctionLlmEnabled(): boolean {
  const v = process.env.SOCIAL_AUCTION_LLM_ENABLED;
  if (v === undefined || v === '') return false;
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
    return { data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta };
  }

  const { client, model, provider } = getClientForFunction('generateAuctionLots');
  try {
    const prompt = buildAuctionLotsPrompt({
      participantCount: params.participantCount,
      eventType: params.eventType,
      _refinementHint: params._refinementHint,
      mixText: params.sessionContext?.mixText,
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 500,
    });

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
      return { data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta };
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
      return { data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta };
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
      return { data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta };
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
    return { data: normalizeAuctionLots(validated.data.lots), meta };
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
    return { data: normalizeAuctionLots(FALLBACK_AUCTION_LOTS), meta };
  }
}
