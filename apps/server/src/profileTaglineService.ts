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
import {
  buildLiveAIMeta,
  buildFallbackAIMeta,
} from '@shared/types/aiMeta';
import type { ProfileTaglineResponse } from '@shared/ai/onboarding';

const PROMPT_VERSION = 'profile-tagline-v1';

// ─── Curated fallback library ──────────────────────────────────────────────────
// One line per archetype.  Chosen to feel warm, social, and forward-looking
// without being generic.  Activated when AI is unavailable or returns
// low-quality / unusable output.

const ARCHETYPE_FALLBACK_LINES: Record<string, string> = {
  '开心柯基':    '你的活力是天然的破冰利器，笑声能让陌生的房间变暖。',
  '太阳鸡':      '你总能带动全场的情绪，最适合在人群中发光。',
  '夸夸豚':      '你有一种让人觉得"被看见"的神奇能力。',
  '机智狐':      '你的观察力让你在每段对话里都能找到最妙的切入点。',
  '淡定海豚':    '你的平静是一种力量，能让紧张的气氛自然松弛下来。',
  '织网蛛':      '你擅长把不同的人连在一起，是天然的社交纽带。',
  '暖心熊':      '你的在场本身就让人有安全感，深聊从你这里开始最自然。',
  '灵感章鱼':    '你的想象力能把普通的聊天变成一场创意碰撞。',
  '沉思猫头鹰':  '你问的问题往往让对方第一次认真想这件事。',
  '定心大象':    '你的从容感染力强，适合在节奏快的聚会里做稳场的那个人。',
  '稳如龟':      '你的可靠感让初次见面的人也能放松下来。',
  '隐身猫':      '你慢热但深情，最好的关系往往从你不经意的一句话开始。',
};

const GENERIC_FALLBACK =
  '你的社交风格独特，期待在活动里遇见真正和你频道相近的人。';

function getFallbackLine(archetype?: string): string {
  if (archetype && ARCHETYPE_FALLBACK_LINES[archetype]) {
    return ARCHETYPE_FALLBACK_LINES[archetype];
  }
  return GENERIC_FALLBACK;
}

// ─── Input contract ────────────────────────────────────────────────────────────

// Interest category key → Chinese display label
const CATEGORY_LABELS: Record<string, string> = {
  career: '职场野心',
  philosophy: '深度思想',
  lifestyle: '生活方式',
  culture: '文化娱乐',
  city: '城市探索',
  tech: '前沿科技',
};

// Intent key → Chinese display label
const INTENT_LABELS: Record<string, string> = {
  make_friends: '交朋友',
  dating: '脱单约会',
  expand_network: '拓展人脉',
  find_partner: '寻找合伙人',
  casual_chat: '随便聊聊',
  flexible: '随缘',
};

export interface ProfileTaglineInput {
  /** Primary archetype name (Chinese), e.g. "机智狐" */
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
  input: ProfileTaglineInput
): Promise<ProfileTaglineResponse> {
  const { archetype, categoryHeat = {}, intentKeys = [] } = input;

  // Resolve top 2 interest categories by heat (label mapping is done once here)
  const topInterestCategories = Object.entries(categoryHeat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([k]) => CATEGORY_LABELS[k] ?? k);

  // Resolve intent labels
  const intentLabels = intentKeys.slice(0, 2).map((k) => INTENT_LABELS[k] ?? k);

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

  const contextLines = [archetype ? `性格原型：${archetype}` : '', interestFragment, intentFragment]
    .filter(Boolean)
    .join('，');

  if (!contextLines) {
    // No usable context — return fallback immediately without an LLM call
    return {
      insightLine: getFallbackLine(archetype),
      meta: buildFallbackAIMeta('no_context'),
    };
  }

  const prompt = `你是一个温暖、睿智的社交洞察助手。根据用户的简要档案，生成一句简短的社交风格洞察，帮助用户感受到"这个平台了解我"。

要求：
- 只返回这一句话，不要前缀、不要标点以外的内容
- 长度：20-36个汉字
- 语气：温暖、鼓励，略带洞察感，不夸张
- 聚焦于社交场景中的真实表现，而非性格评价
- 以第二人称（"你"）书写

用户档案：${contextLines}

请只输出这一句话：`;

  try {
    const result = await callSocialAI({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 80,
      callerTag: 'profileTagline',
    });

    const raw = result.content.trim();

    // Basic quality check: must be non-empty and not absurdly long
    if (!raw || raw.length > 120) {
      console.warn(
        `[profileTagline] LLM output failed quality check (length=${raw.length}), using fallback`
      );
      return {
        insightLine: getFallbackLine(archetype),
        meta: buildFallbackAIMeta('low_quality_score'),
      };
    }

    return {
      insightLine: raw,
      meta: buildLiveAIMeta(result.provider, PROMPT_VERSION),
    };
  } catch (err) {
    console.error('[profileTagline] LLM call failed, using fallback:', err);
    return {
      insightLine: getFallbackLine(archetype),
      meta: buildFallbackAIMeta('provider_error'),
    };
  }
}
