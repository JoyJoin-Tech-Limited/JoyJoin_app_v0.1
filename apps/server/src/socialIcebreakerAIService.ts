import type {
  SocialTopic,
  MicroChallenge,
  LieDetectiveStatement,
  AtmosphereMood,
  PersonalityDiceChallenge,
  SocialTopicDepthLevel,
  SocialTopicPromptStyle,
  SocialTopicSafety,
  AuctionLot,
  XiaoyueSessionPack,
} from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema, parseXiaoyueSessionPack } from '@shared/socialIcebreaker';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
} from '@shared/types/aiMeta';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildWarmupTopicsPrompt,
  buildMicroChallengesPrompt,
  buildLieDetectivePrompt,
  buildXiaoYueCommentPrompt,
  buildRecapSummaryPrompt,
  buildPersonalityDicePrompt,
  buildAuctionLotsPrompt,
  buildMiniScriptFrameworkUserMessage,
  buildXiaoyueSessionPackPrompt,
  buildQuipBattlePrompt,
  MINISCRIPT_FRAMEWORK_SYSTEM,
  WARMUP_TOPICS_PROMPT_VERSION,
  MICRO_CHALLENGES_PROMPT_VERSION,
  LIE_DETECTIVE_PROMPT_VERSION,
  RECAP_SUMMARY_PROMPT_VERSION,
  PERSONALITY_DICE_PROMPT_VERSION,
  AUCTION_LOTS_PROMPT_VERSION,
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
  SESSION_PACK_PROMPT_VERSION,
  XIAOYUE_COMMENT_PROMPT_VERSION,
} from './ai/socialIcebreakerPrompts';
import { selectMicroChallenges } from '@joyjoin/shared';
import { getRandomQuipBattlePrompts, type QuipBattlePrompt } from '@shared/quipBattle';
import { logger } from "./lib/logger";
import { evaluateContent, formatQualityMetrics } from './ai/aiQualityGate';
import type { JudgeFeatureType } from './ai/qualityJudgePrompts';

type AIServiceResult<T> = {
  data: T;
  meta: AIResponseMeta;
};

/** Re-export for downstream consumers that previously imported from this file. */
export { XIAOYUE_COMMENT_PROMPT_VERSION, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION };

// ─── Quality Gate Integration (fire-and-forget telemetry) ────────────────────

function fireAndForgetQualityGate(
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

function normalizeTopicDepthLevel(value: unknown): SocialTopicDepthLevel {
  if (value === 3) return 3;
  if (value === 2) return 2;
  return 1;
}

function normalizeTopicPromptStyle(value: unknown): SocialTopicPromptStyle {
  if (value === 'binary' || value === 'reflective') {
    return value;
  }
  return 'experiential';
}

function normalizeTopicSafety(value: unknown): SocialTopicSafety {
  if (value === 'open' || value === 'reflective') {
    return value;
  }
  return 'gentle';
}

function normalizeSocialTopic(topic: Partial<SocialTopic>, fallbackMood: AtmosphereMood, index: number): SocialTopic {
  return {
    id: topic.id || `topic_${index + 1}`,
    question: topic.question || '分享一件让你会心一笑的小事',
    mood: topic.mood || fallbackMood,
    emoji: topic.emoji || '✨',
    category: topic.category || '轻松开场',
    depthLevel: normalizeTopicDepthLevel(topic.depthLevel),
    promptStyle: normalizeTopicPromptStyle(topic.promptStyle),
    safety: normalizeTopicSafety(topic.safety),
  };
}

// ============ CURATED FALLBACK CONTENT ============

const FALLBACK_WARMUP_TOPICS: SocialTopic[] = [
  { id: 'w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w2', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w3', question: '手机里现在最奇怪的一张照片，敢不敢给大家看看？', mood: 'funny', emoji: '📱', category: '轻松破冰', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w4', question: '最近有没有那种"世界真小"的巧合？', mood: 'life', emoji: '🌍', category: '偶遇故事', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w5', question: '你的性格要是道菜，你是什么菜？', mood: 'funny', emoji: '🍽️', category: '自我比喻', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w6', question: '最近一次真正放松是在哪儿？干嘛呢？', mood: 'relaxed', emoji: '😌', category: '舒适感', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w7', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '🌟', category: '理想日常', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w8', question: '最想和谁（活着或已故）吃一顿饭？', mood: 'emotional', emoji: '💫', category: '重要关系', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w9', question: '最近有没有一个瞬间，让你突然心里一暖？', mood: 'emotional', emoji: '🥹', category: '感动瞬间', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w10', question: '你觉得自己哪个优点，其实被身边人低估了？', mood: 'life', emoji: '💡', category: '自我认知', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w11', question: '描述一下你理想的周末，越具体越好', mood: 'relaxed', emoji: '☀️', category: '理想节奏', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w12', question: '如果能瞬间学会一门技能，你想拿捏什么？', mood: 'funny', emoji: '🎯', category: '愿望清单', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w13', question: '最近有什么让你笑到停不下来的事？', mood: 'funny', emoji: '😂', category: '快乐来源', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w14', question: '小时候最想当什么？现在还这么想吗？', mood: 'life', emoji: '👶', category: '成长轨迹', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w15', question: '给五年前的自己留句话，你会说什么？', mood: 'emotional', emoji: '⏰', category: '自我回望', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w16', question: '最近尝试了什么新鲜事物，结果真香还是踩雷？', mood: 'life', emoji: '🚀', category: '新鲜体验', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w17', question: '你一般怎么给自己"充电"？', mood: 'relaxed', emoji: '🔋', category: '恢复能量', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w18', question: '有什么事看起来很难，其实上手发现也就那样？', mood: 'funny', emoji: '🤔', category: '反差观察', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w19', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🏡', category: '舒适空间', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w20', question: '最想去但还没去的地方是哪儿？为什么一直想去？', mood: 'emotional', emoji: '✈️', category: '向往之地', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w21', question: '今晚来这儿，你最期待发生什么？', mood: 'relaxed', emoji: '🎉', category: '现场期待', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w22', question: '用三个词形容下今天的心情呗', mood: 'life', emoji: '💭', category: '情绪快照', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w23', question: '有什么生活习惯，说出来别人会觉得"你也这样？"', mood: 'funny', emoji: '🙈', category: '可爱怪癖', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w24', question: '最近有没有一件事，让你突然改变了想法？', mood: 'emotional', emoji: '🌱', category: '观点变化', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w25', question: '如果人生是部电影，你现在演到哪个章节了？', mood: 'life', emoji: '🎬', category: '人生叙事', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
];

const FALLBACK_MICRO_CHALLENGES: MicroChallenge[] = [
  {
    id: 'c1',
    title: '找3个共同点',
    description: '在座的各位，找出3个你们共有的爱好或经历，越 unexpected 越好',
    durationSeconds: 180,
    completionCTA: '拿捏了！',
    visualHint: '🔍🤝',
  },
  {
    id: 'c2',
    title: '用3个词形容右边的人',
    description: '每人用3个词形容坐在自己右边的人，不准说"挺好的"',
    durationSeconds: 120,
    completionCTA: '说完收工！',
    visualHint: '💬🌟',
  },
  {
    id: 'c3',
    title: '整一个离谱创业点子',
    description: '来，大家一起整一个绝对不会成功的创业idea，脑洞越大越好',
    durationSeconds: 150,
    completionCTA: '这项目我投了！',
    visualHint: '🚀💡',
  },
  {
    id: 'c4',
    title: '哼歌猜曲',
    description: '每人哼一段歌，其他人猜，跑调也没事反而更好猜',
    durationSeconds: 120,
    completionCTA: '这波绝了！',
    visualHint: '🎵🎤',
  },
  {
    id: 'c5',
    title: '30秒不为人知',
    description: '每人30秒，说一个在场没人知道的事，越小众越好',
    durationSeconds: 180,
    completionCTA: '原来你是这样的！',
    visualHint: '⚡👤',
  },
  {
    id: 'c6',
    title: '心灵感应挑战',
    description: '两人背对背同时说同一个数字，看看你们有没有默契',
    durationSeconds: 90,
    completionCTA: '这都能中？',
    visualHint: '🧠✨',
  },
  {
    id: 'c7',
    title: '生日排序',
    description: '所有人按生日月份排成一排，不能说话只能比划，整起来',
    durationSeconds: 120,
    completionCTA: '排对了！',
    visualHint: '🎯👥',
  },
  {
    id: 'c8',
    title: '接力编故事',
    description: '每人接一句话，编个完整故事，结尾必须让人意想不到',
    durationSeconds: 180,
    completionCTA: '编剧实锤！',
    visualHint: '📖🎭',
  },
];

const FALLBACK_LIE_DETECTIVE_STATEMENTS: LieDetectiveStatement[][] = [
  [
    { index: 1, text: '我曾在凌晨三点一个人爬过一座山，就是觉得想去了', isLie: false },
    { index: 2, text: '我会说五种语言，虽然都不是很流利', isLie: true },
    { index: 3, text: '我的第一份工作是在便利店上夜班', isLie: false },
  ],
  [
    { index: 1, text: '我上过电视，虽然只有一个背影镜头', isLie: true },
    { index: 2, text: '我养过一只龟，养了整整十年，比有些恋爱还长', isLie: false },
    { index: 3, text: '我大学时是系里长跑第一名，虽然系里只有三个男生', isLie: false },
  ],
  [
    { index: 1, text: '我在飞机上遇到过一位演员，还聊了两句', isLie: false },
    { index: 2, text: '我曾经做过一段时间职业厨师，主要是切配', isLie: true },
    { index: 3, text: '我第一次坐飞机是二十五岁以后，之前一直坐高铁', isLie: false },
  ],
];

// ============ AI GENERATORS ============

export async function generateWarmupTopics(params: {
  mood: AtmosphereMood;
  eventType: string;
  participantCount: number;
  avoidTopics?: string[];
}): Promise<AIServiceResult<SocialTopic[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateWarmupTopics');
  const t0 = Date.now();
  try {
    const prompt = buildWarmupTopicsPrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', WARMUP_TOPICS_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getFallbackTopics(params.mood), meta };
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, WARMUP_TOPICS_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'warmup', params.eventType);
      return {
        data: parsed.slice(0, 5).map((topic, index) => normalizeSocialTopic(topic, params.mood, index)),
        meta,
      };
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', WARMUP_TOPICS_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackTopics(params.mood), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateWarmupTopics error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', WARMUP_TOPICS_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackTopics(params.mood), meta };
  }
}

function getFallbackTopics(mood: AtmosphereMood): SocialTopic[] {
  const filtered = FALLBACK_WARMUP_TOPICS.filter(t => t.mood === mood);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  // If not enough for this mood, supplement with others
  if (shuffled.length < 5) {
    const others = FALLBACK_WARMUP_TOPICS.filter(t => t.mood !== mood)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5 - shuffled.length);
    return [...shuffled, ...others].map((topic, index) => normalizeSocialTopic(topic, mood, index));
  }
  return shuffled.slice(0, 5).map((topic, index) => normalizeSocialTopic(topic, mood, index));
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
}): Promise<AIServiceResult<MicroChallenge[]>> {
  const aiCorrelationId = createAiCorrelationId();

  // 1. Always build the deterministic selector baseline
  const selectorSeed = params.seed ?? `default-${params.participantCount}-${params.eventType}`;
  const selectorResult = selectMicroChallenges({
    participantCount: params.participantCount,
    completedIds: params.completedChallengeIds,
    seed: selectorSeed,
    scene: inferSceneFromEventType(params.eventType),
    count: 3,
  });

  // 2. If AI is disabled, return selector result immediately
  if (!isMicroChallengeLlmEnabled()) {
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
    });
    return { data: selectorResult, meta: buildSelectorMeta() };
  }

  // 3. AI path (backward-compatible primary)
  const { client, model, provider } = getClientForFunction('generateMicroChallenges');
  const t0 = Date.now();
  try {
    const prompt = buildMicroChallengesPrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: selectorResult, meta };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: JSON parse failed, using selector fallback`);
      const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: selectorResult, meta };
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_micro_challenge', aiCorrelationId, 'micro_challenge', params.eventType);
      return { data: parsed.slice(0, 3), meta };
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape, using selector fallback`);
    const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: selectorResult, meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateMicroChallenges error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: selectorResult, meta };
  }
}

export async function generateLieDetectiveStatements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const prompt = buildLieDetectivePrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getRandomFallbackStatements(), meta };
    }

    const parsed = JSON.parse(content);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.filter((s: LieDetectiveStatement) => s.isLie).length === 1
    ) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_lie_detective', aiCorrelationId, 'lie_detective');
      return { data: parsed, meta };
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms: invalid response shape (expected 3 items with exactly 1 lie), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateLieDetectiveStatements error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  }
}

function getRandomFallbackStatements(): LieDetectiveStatement[] {
  const sets = [...FALLBACK_LIE_DETECTIVE_STATEMENTS].sort(() => Math.random() - 0.5);
  return sets[0];
}

export async function generateXiaoYueComment(params: {
  phase: string;
  event: string;
  context?: string;
}): Promise<AIServiceResult<string>> {
  const defaultComments: Record<string, Record<string, string>> = {
    warmup: {
      phase_start: '来，先随便聊聊，不用紧张 🌅',
      topic_refresh: '换个话题，这个更有意思～ ✨',
      mood_change: '行，换换口味，新话题来了 🎯',
    },
    micro_challenge: {
      phase_start: '热身差不多了，来点小挑战？⚡',
      timer_warning: '时间不多啦，抓紧 ⚡',
      challenge_complete: '可以啊，大家都完成了 🎉',
    },
    lie_detective: {
      phase_start: '侦探时间，仔细听，找出那个假的 🕵️',
      vote_reveal: '揭晓了，谁最会编？😏',
      generating: '正在准备谎言游戏，稍等...',
    },
    recap: {
      phase_start: '今晚这局差不多到这儿啦 ✨',
    },
  };

  const phaseComments = defaultComments[params.phase];
  if (phaseComments?.[params.event]) {
    const meta: AIResponseMeta = {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
    };
    return { data: phaseComments[params.event], meta };
  }

  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateXiaoYueComment');
  const t0 = Date.now();
  try {
    const prompt = buildXiaoYueCommentPrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const latencyMs = Date.now() - t0;
    logger.info(`[SocialIcebreakerAI] generateXiaoYueComment provider=${provider} latency=${latencyMs}ms`);
    if (content) {
      const meta = buildLiveAIMeta(provider, XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoYueComment',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      });
      return { data: content, meta };
    }
    const metaFb = buildFallbackAIMeta('empty_response', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'empty_response',
    });
    return { data: '继续加油，破冰进行中！✨', meta: metaFb };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoYueComment error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const metaFb = buildFallbackAIMeta('llm_error', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'llm_error',
    });
    return { data: '继续加油，破冰进行中！✨', meta: metaFb };
  }
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
}): Promise<AIServiceResult<{ headline: string; moments: string[]; closingLine: string }>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateRecapSummary');
  const t0 = Date.now();
  try {
    const diceBlock =
      params.personalityDiceRecapLines?.length ?
        `人格骰子亮点：${params.personalityDiceRecapLines.join('；')}`
      : '';
    const miniBlock = params.miniScriptRecapLine ? `迷你剧本杀：${params.miniScriptRecapLine}` : '';
    const auctionBlock =
      params.auctionRecapLines?.length ? `拍卖环节：${params.auctionRecapLines.join('；')}` : '';

    const prompt = `你是社交破冰助手小悦。请为今晚的活动生成一个温馨的总结：

参与者：${params.participants.map(p => p.displayName).join('、')}
讨论话题数：${params.topicsDiscussed.length}
完成挑战数：${params.challengesCompleted}
 发现共同点：${params.commonGroundCount}
活动时长：${params.durationMinutes}分钟
${params.lieDetectiveHighlights?.length ? `谎言侦探亮点：${params.lieDetectiveHighlights.join('、')}` : ''}
${diceBlock}
${miniBlock}
${auctionBlock}

请以JSON格式返回：
{
  "headline": "一句话总结（15字内）",
  "moments": ["精彩瞬间1", "精彩瞬间2", "精彩瞬间3"],
  "closingLine": "温馨结束语（20-30字）"
}

直接返回JSON，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getDefaultRecap(params), meta };
    }

    const parsed = JSON.parse(content);
    if (parsed.headline && parsed.moments && parsed.closingLine) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_recap', aiCorrelationId, 'recap');
      return { data: parsed, meta };
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getDefaultRecap(params), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateRecapSummary error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getDefaultRecap(params), meta };
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


// ─── Xiaoyue Session Pack ─────────────────────────────────────────────────────

const FALLBACK_SESSION_PACK: XiaoyueSessionPack = {
  generatedAt: new Date().toISOString(),
  opener: '来了来了，先放松，这局不会尬，我保证。',
  phaseCoaching: {
    warmup: { toneLine: '先随便聊聊，不用急着交心', hostHint: '没人开口？你先抛个自己的糗事呗' },
    micro_challenge: { toneLine: '来点小挑战，两分钟的事', energyRescue: '别急，慢慢玩，时间够的' },
    lie_detective: { toneLine: '仔细听，找出那个编的', hostHint: '大胆猜，错了也没人记仇' },
    auction: { toneLine: '虚拟拍卖，脑洞越大越好', energyRescue: '没人出价？自己夸自己也算' },
    personality_dice: { toneLine: '人格骰子，看看敢不敢接', hostHint: '先从简单的来，别一上来就hard模式' },
    mini_script: { toneLine: '迷你剧本杀，今晚重头戏', hostHint: '提醒一下，记住自己的秘密和任务' },
    quip_battle: { toneLine: '填空造句，秀出你的脑洞', hostHint: '越无厘头越好，没有标准答案' },
    undercover_word: { toneLine: '谁是卧底，仔细观察', hostHint: '描述别太明显，也别太模糊' },
    group_mirror: { toneLine: '匿名投票，看看大家眼中的你', hostHint: '轻松投，没有对错' },
    recap: { toneLine: '差不多了，回顾一下今晚' },
  },
  backupPrompts: [
    '大家突然安静了？试试轮流说一件今天的小事，多小都行。',
    '来个快速二选一：海边还是山里？火锅还是烧烤？',
    '有人还没怎么说话？直接点名，问TA一个简单的问题。',
  ],
  recapFraming: {
    open: '今晚这局，挺有意思的',
    highlightTemplate: '我印象最深的是',
    close: '这局算你们赢，下次继续',
  },
  playerSkillRoles: [],
};

function isSessionPackEnabled(): boolean {
  const v = process.env.SOCIAL_XIAOYUE_SESSION_PACK_ENABLED;
  if (v === undefined || v === '') return true;
  return v.toLowerCase() === 'true';
}

export async function generateXiaoyueSessionPack(params: {
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  eventType?: string;
  playerCount: number;
}): Promise<AIServiceResult<XiaoyueSessionPack>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();

  if (!isSessionPackEnabled()) {
    const meta = buildFallbackAIMeta('disabled', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider: 'deepseek',
      model: 'n/a',
      latencyMs: Date.now() - t0,
      success: true,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return { data: FALLBACK_SESSION_PACK, meta };
  }

  const { client, model, provider } = getClientForFunction('generateXiaoyueSessionPack');
  try {
    const prompt = buildXiaoyueSessionPackPrompt({
      participantCount: params.playerCount,
      eventType: params.eventType,
      participants: params.participants,
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return { data: FALLBACK_SESSION_PACK, meta };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return { data: FALLBACK_SESSION_PACK, meta };
    }

    try {
      const validated = parseXiaoyueSessionPack(parsed);
      const latencyMs = Date.now() - t0;
      const meta = buildLiveAIMeta(provider, SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: meta.promptVersion,
      });
      return { data: validated as XiaoyueSessionPack, meta };
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return { data: FALLBACK_SESSION_PACK, meta };
    }
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoyueSessionPack error latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return { data: FALLBACK_SESSION_PACK, meta };
  }
}

// ─── Personality Dice ─────────────────────────────────────────────────────────

import { getDaresForArchetype } from '@shared/personalityDiceDares';

type DominantTrait = 'A' | 'C' | 'E' | 'O' | 'X' | 'P';

function getDominantTrait(traitScores?: Record<string, number>): DominantTrait {
  if (!traitScores) return 'P';
  const traits: DominantTrait[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  let best: DominantTrait = 'P';
  let bestScore = -Infinity;
  for (const t of traits) {
    const score = traitScores[t] ?? traitScores[t.toLowerCase()] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** Build archetype-specific fallback using the v2 curated dare bank. */
function buildArchetypeFallback(
  p: { userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> },
): PersonalityDiceChallenge {
  const trait = getDominantTrait(p.traitScores);
  const dares = getDaresForArchetype(p.archetype || 'corgi');
  const dare = dares[Math.floor(Math.random() * dares.length)];
  return {
    userId: p.userId,
    displayName: p.displayName,
    archetype: p.archetype,
    dominantTrait: trait,
    challengeTitle: dare.title,
    challengeBody: dare.body,
    challengeEmoji: dare.emoji,
    difficulty: dare.difficulty === 'easy' ? 'easy' : dare.difficulty === 'medium' ? 'medium' : 'hard',
    passLine: dare.passLine,
    passConsequence: dare.passConsequence,
  };
}

export async function generatePersonalityDiceChallenges(participants: Array<{
  userId: string;
  displayName: string;
  archetype?: string;
  traitScores?: Record<string, number>;
}>): Promise<AIServiceResult<PersonalityDiceChallenge[]>> {
  const aiCorrelationId = createAiCorrelationId();
  // Build archetype-aware v2 fallbacks first
  const fallbacks: PersonalityDiceChallenge[] = participants.map(p => buildArchetypeFallback(p));

  const { client, model, provider } = getClientForFunction('generatePersonalityDiceChallenges');
  const t0 = Date.now();
  try {
    const participantList = participants.map((p) => ({
      displayName: p.displayName,
      archetype: p.archetype || '未知',
      dominantTrait: getDominantTrait(p.traitScores),
    }));

    const prompt = buildPersonalityDicePrompt({ participants: participantList });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', PERSONALITY_DICE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: fallbacks, meta };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`);
      const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: fallbacks, meta };
    }
    if (Array.isArray(parsed) && parsed.length === participants.length) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_personality_dice', aiCorrelationId, 'personality_dice');
      return { data: participants.map((p, i) => ({
        userId: p.userId,
        displayName: p.displayName,
        archetype: p.archetype,
        dominantTrait: getDominantTrait(p.traitScores),
        challengeTitle: parsed[i].challengeTitle || fallbacks[i].challengeTitle,
        challengeBody: parsed[i].challengeBody || fallbacks[i].challengeBody,
        challengeEmoji: parsed[i].challengeEmoji || fallbacks[i].challengeEmoji,
        difficulty: parsed[i].difficulty || fallbacks[i].difficulty,
      })), meta };
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape (expected ${participants.length} items), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbacks, meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generatePersonalityDiceChallenges error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', PERSONALITY_DICE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbacks, meta };
  }
}

const FALLBACK_AUCTION_LOTS: AuctionLot[] = [
  { id: 'lot_fb_1', title: '分享一个无伤大雅的社死瞬间', teaser: '越离谱越好，反正大家都不认识' },
  { id: 'lot_fb_2', title: '用三句话编一个离谱旅行故事', teaser: '现场即兴，瞎编也行' },
  { id: 'lot_fb_3', title: '爆料一个今晚之前没人知道的小习惯', teaser: '说完就翻篇，不截图' },
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
  }));
}

export async function generateAuctionLots(params: {
  participantCount: number;
  eventType?: string;
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
    const prompt = buildAuctionLotsPrompt(params);

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

export type MiniScriptFrameworkModelFetchResult =
  | {
      ok: true;
      data: unknown;
      provider: 'minimax' | 'deepseek';
      model: string;
      latencyMs: number;
      /** True when MiniMax was attempted first and DeepSeek json_object produced this successful parse. */
      deepSeekRecoveryUsed?: boolean;
    }
  | {
      ok: false;
      reason: 'empty_response' | 'parse_error' | 'llm_error' | 'timeout' | 'no_credentials';
      provider: 'minimax' | 'deepseek' | null;
      model?: string;
      latencyMs: number;
    };



type ClientSelection = ReturnType<typeof getClientForFunction>;

async function fetchMiniScriptFrameworkOnce(params: {
  selection: ClientSelection;
  userMessage: string;
  /** DeepSeek supports OpenAI json_object; MiniMax may ignore it — omit for MiniMax. */
  useJsonObject: boolean;
  signal?: AbortSignal;
}): Promise<MiniScriptFrameworkModelFetchResult> {
  const t0 = Date.now();
  const { client, model, provider } = params.selection;

  const body = {
    model,
    messages: [
      { role: 'system' as const, content: MINISCRIPT_FRAMEWORK_SYSTEM },
      { role: 'user' as const, content: params.userMessage },
    ],
    temperature: 0.55,
    /** Large nested framework JSON; truncation shows up as parse_error — size up before raising timeout. */
    max_tokens: 4096,
    ...(params.useJsonObject ? { response_format: { type: 'json_object' as const } } : {}),
  };

  try {
    const response = await client.chat.completions.create(
      body,
      params.signal ? { signal: params.signal } : undefined
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, reason: 'empty_response', provider, model, latencyMs: Date.now() - t0 };
    }
    try {
      const payload = extractJsonPayloadForParse(content);
      const data = JSON.parse(payload) as unknown;
      return { ok: true, data, provider, model, latencyMs: Date.now() - t0 };
    } catch {
      return { ok: false, reason: 'parse_error', provider, model, latencyMs: Date.now() - t0 };
    }
  } catch (error: unknown) {
    const latencyMs = Date.now() - t0;
    const name = error && typeof error === 'object' && 'name' in error ? (error as { name?: string }).name : '';
    if (name === 'AbortError' || params.signal?.aborted) {
      return {
        ok: false,
        reason: 'timeout',
        provider,
        model,
        latencyMs,
      };
    }
    logger.error('fetchMiniScriptFrameworkModelJson attempt failed', { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: 'llm_error', provider, model, latencyMs };
  }
}

/**
 * MiniScript framework JSON: MiniMax-first in hybrid mode; DeepSeek `json_object` as structured fallback.
 * Does not validate with Zod or emit AITrace — the miniscript orchestrator owns that.
 */
export async function fetchMiniScriptFrameworkModelJson(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  signal?: AbortSignal;
}): Promise<MiniScriptFrameworkModelFetchResult> {
  const t0 = Date.now();
  const userMessage = buildMiniScriptFrameworkUserMessage(params);

  let selection: ClientSelection;
  try {
    selection = getClientForFunction('generateMiniScriptFramework');
  } catch {
    return { ok: false, reason: 'no_credentials', provider: null, latencyMs: Date.now() - t0 };
  }

  const primary = await fetchMiniScriptFrameworkOnce({
    selection,
    userMessage,
    useJsonObject: selection.provider === 'deepseek',
    signal: params.signal,
  });

  if (primary.ok) return primary;

  if (selection.provider === 'minimax' && process.env.DEEPSEEK_API_KEY) {
    const second = await fetchMiniScriptFrameworkOnce({
      selection: getDeepseekSelection(),
      userMessage,
      useJsonObject: true,
      signal: params.signal,
    });
    if (second.ok) {
      return { ...second, deepSeekRecoveryUsed: true };
    }
    return second;
  }

  return primary;
}

// ─── Quip Battle ─────────────────────────────────────────────────────────────

export const QUIP_BATTLE_PROMPT_VERSION = 'social-quip-battle-v1';

export async function generateQuipBattlePrompts(params: {
  eventType: string;
  participantCount: number;
  participants: Array<{ displayName: string; archetype?: string }>;
}): Promise<AIServiceResult<QuipBattlePrompt[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateQuipBattlePrompts');
  const t0 = Date.now();

  // Always build fallback first
  const fallbackPrompts = getRandomQuipBattlePrompts(3);

  try {
    const prompt = buildQuipBattlePrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: fallbackPrompts, meta };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`);
      const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: fallbackPrompts, meta };
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'quip_battle', params.eventType);
      return {
        data: parsed.slice(0, 3).map((p: QuipBattlePrompt, i: number) => ({
          id: p.id || `qb_${i + 1}`,
          promptText: p.promptText || fallbackPrompts[i].promptText,
          category: p.category || fallbackPrompts[i].category,
        })),
        meta,
      };
    }

    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbackPrompts, meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateQuipBattlePrompts error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbackPrompts, meta };
  }
}
