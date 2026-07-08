/**
 * Profile Tagline Service
 * 档案标语生成服务
 *
 * Generates a single warm insight line for the onboarding profile review card
 * (ProfilePortraitCard inside FinalProfileReviewPage).
 *
 * Design guardrails (aligned with AI_INTEGRATION_PLAN Concept 1):
 *  - Deterministic inputs only: archetype, top interest categories, intent
 *  - Presentation-only output: no onboarding progression side-effects
 *  - Strict fallback: curated archetype-keyed lines activate on any error
 *  - Observable: returns AIResponseMeta on every code path
 */

import { callSocialAI } from './ai/socialModelRouter';
import { logger } from './lib/logger';
import {
  buildLiveAIMeta,
  buildFallbackAIMeta,
} from '@shared/types/aiMeta';
import {
  GENERIC_PROFILE_TAGLINE_FALLBACK,
  type ProfileTaglineResponse,
} from '@shared/ai/onboarding';
import { logAITrace } from './lib/aiTraceLogger';
import { moderateGeneratedContent } from './lib/aiContentModeration';
import { buildAIGCMeta } from '@shared/types/aiMeta';
import { XIAOYUE_CRAFT_LITE } from './prompts/craft';
import { INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION } from '@shared/constants';
import { MACRO_CATEGORY_LABELS } from '@shared/interests';
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames';

const PROMPT_VERSION = 'profile-tagline-v1';

// ─── Curated fallback library ──────────────────────────────────────────────────
// One line per archetype.  Chosen to feel warm, social, and forward-looking
// without being generic.  Activated when AI is unavailable or returns
// low-quality / unusable output.

const ARCHETYPE_FALLBACK_LINES: Record<string, string> = {
  'corgi':    '你的活力是天然的破冰利器，笑声能让陌生的房间变暖。',
  'rooster':      '你总能带动全场的情绪，最适合在人群中发光。',
  'hamster_praise':      '你有一种让人觉得"被看见"的神奇能力。',
  'fox':      '你的观察力让你在每段对话里都能找到最妙的切入点。',
  'dolphin_calm':    '你的平静是一种力量，能让紧张的气氛自然松弛下来。',
  'spider':      '你擅长把不同的人连在一起，是天然的社交纽带。',
  'koala':      '你的在场本身就让人有安全感，深聊从你这里开始最自然。',
  'octopus':    '你的想象力能把普通的聊天变成一场创意碰撞。',
  'owl':  '你问的问题往往让对方第一次认真想这件事。',
  'elephant':    '你的从容感染力强，适合在节奏快的聚会里做稳场的那个人。',
  'turtle':      '你的可靠感让初次见面的人也能放松下来。',
  'cat':      '你慢热但深情，最好的关系往往从你不经意的一句话开始。',
};

function getFallbackLine(archetype?: string): string {
  if (archetype && ARCHETYPE_FALLBACK_LINES[archetype]) {
    return ARCHETYPE_FALLBACK_LINES[archetype];
  }
  return GENERIC_PROFILE_TAGLINE_FALLBACK;
}

// ─── Input contract ────────────────────────────────────────────────────────────

// Intent key → Chinese display label (synced with @shared/constants)
const ALL_INTENT_OPTIONS = [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION];
function getIntentLabel(key: string): string {
  return ALL_INTENT_OPTIONS.find((o) => o.value === key)?.label ?? key;
}

// Interest category key → Chinese display label (synced with @shared/interests)
function getCategoryLabel(key: string): string {
  return (MACRO_CATEGORY_LABELS as Record<string, string>)[key] ?? key;
}

export interface ProfileTaglineInput {
  /** Primary archetype name (Chinese), e.g. "fox" */
  archetype?: string;
  /**
   * Raw categoryHeat record from user_interests (key = category slug, value = heat score).
   * The service resolves Chinese labels internally.
   */
  categoryHeat?: Record<string, number>;
  /**
   * Raw intent array from the users table (English keys, e.g. ["make_friends", "expand_network"]).
   * The service resolves Chinese labels internally.
   */
  intentKeys?: string[];
}

// ─── Service function ──────────────────────────────────────────────────────────

/**
 * Generates a single warm insight line for the profile review card.
 *
 * Always resolves — errors activate the deterministic fallback library.
 */
export async function generateProfileTagline(
  input?: ProfileTaglineInput | null
): Promise<ProfileTaglineResponse> {
  const startedAt = Date.now();
  const archetype = input?.archetype;
  const categoryHeat = input?.categoryHeat ?? {};
  const intentKeys = input?.intentKeys ?? [];

  // Resolve top 2 interest categories by heat (label mapping is done once here)
  const topInterestCategories = Object.entries(categoryHeat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([k]) => getCategoryLabel(k));

  // Resolve intent labels
  const intentLabels = intentKeys.slice(0, 2).map((k) => getIntentLabel(k));

  // Build a minimal, deterministic prompt.  Use only declared profile data —
  // no history, no latent state, no inferred attributes.
  const interestFragment =
    topInterestCategories.length > 0
      ? `兴趣方向：${topInterestCategories.slice(0, 2).join('、')}`
      : '';
  const intentFragment =
    intentLabels.length > 0
      ? `社交目标：${intentLabels.slice(0, 2).join('、')}`
      : '';

  const archetypeName = archetype ? (ARCHETYPE_BY_ID[archetype]?.nameCn ?? archetype) : '';
  const contextLines = [archetypeName ? `性格原型：${archetypeName}` : '', interestFragment, intentFragment]
    .filter(Boolean)
    .join('，');

  if (!contextLines) {
    // No usable context — return fallback immediately without an LLM call
    const meta = buildFallbackAIMeta('no_context', PROMPT_VERSION);
    logAITrace({
      domain: 'onboarding',
      feature: 'generateProfileTagline',
      provider: meta.provider,
      latencyMs: Date.now() - startedAt,
      success: false,
      fallbackUsed: meta.fallbackUsed,
      fromCache: meta.fromCache,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return {
      insightLine: getFallbackLine(archetype),
      meta: {
        ...meta,
        aigc: buildAIGCMeta({ fallbackUsed: true, labelType: 'ai-generated' }),
      },
    };
  }

  const prompt = `你是一个温暖、睿智的社交洞察助手。根据用户的简要档案，生成一句简短的社交风格洞察，帮助用户感受到"这个平台了解我"。

${XIAOYUE_CRAFT_LITE}

要求：
- 只返回这一句话，不要前缀、不要标点以外的内容
- 长度：20-36个汉字
- 语气：温暖、鼓励，略带洞察感，不夸张
- 聚焦于社交场景中的真实表现，而非性格评价
- 以第二人称（"你"）书写
- 不要出现"你是一个...的人"这类抽象评价；用具象场景代替
- 避免AI常见词："总的来说"、"值得注意的是"、"不仅仅"、"作为一种"、"让我们一起"等

用户档案：${contextLines}

请只输出这一句话：`;

  try {
    const result = await callSocialAI({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 80,
      callerTag: 'profileTagline',
      socialFunction: 'generateProfileTagline',
    });

    const raw = result.content.trim();

    // Basic quality check: must be non-empty and not absurdly long
    if (!raw || raw.length > 120) {
      logger.warn(
        'LLM output failed quality check, using fallback',
        { feature: 'profileTagline', rawLength: raw?.length }
      );
      const meta = buildFallbackAIMeta('low_quality_score', PROMPT_VERSION);
      logAITrace({
        domain: 'onboarding',
        feature: 'generateProfileTagline',
        provider: result.provider,
        latencyMs: Date.now() - startedAt,
        success: false,
        fallbackUsed: meta.fallbackUsed,
        fromCache: meta.fromCache,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
    return {
      insightLine: getFallbackLine(archetype),
      meta: {
        ...meta,
        aigc: buildAIGCMeta({ fallbackUsed: true, labelType: 'ai-generated' }),
      },
    };
    }

    const meta = buildLiveAIMeta(result.provider, PROMPT_VERSION);
    logAITrace({
      domain: 'onboarding',
      feature: 'generateProfileTagline',
      provider: meta.provider,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed: meta.fallbackUsed,
      fromCache: meta.fromCache,
      promptVersion: meta.promptVersion,
    });

    const moderation = moderateGeneratedContent(
      [{ field: 'insightLine', text: raw }],
      {
        domain: 'onboarding',
        feature: 'generateProfileTagline',
        provider: meta.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        promptVersion: meta.promptVersion,
      },
    );
    if (!moderation.safe) {
      return {
        insightLine: getFallbackLine(archetype),
        meta: {
          ...meta,
          fallbackUsed: true,
          aigc: buildAIGCMeta({ fallbackUsed: true, labelType: 'ai-generated' }),
        },
      };
    }

    return {
      insightLine: raw,
      meta: {
        ...meta,
        aigc: buildAIGCMeta({ fallbackUsed: meta.fallbackUsed, labelType: 'ai-generated' }),
      },
    };
  } catch (err) {
    logger.error('LLM call failed, using fallback', { feature: 'profileTagline', error: err instanceof Error ? err.message : String(err) });
    const meta = buildFallbackAIMeta('provider_error', PROMPT_VERSION);
    logAITrace({
      domain: 'onboarding',
      feature: 'generateProfileTagline',
      provider: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      fallbackUsed: meta.fallbackUsed,
      fromCache: meta.fromCache,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return {
      insightLine: getFallbackLine(archetype),
      meta: {
        ...meta,
        aigc: buildAIGCMeta({ fallbackUsed: true, labelType: 'ai-generated' }),
      },
    };
  }
}
