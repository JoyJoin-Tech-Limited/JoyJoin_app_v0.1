/**
 * Warmup-topic generation + curated fallback selection for the social-icebreaker
 * AI service. Extracted verbatim from socialIcebreakerAIService.ts (refactor-only
 * move; no behavior change).
 */
import type {
  SocialTopic,
  AtmosphereMood,
  SocialTopicDepthLevel,
  SocialTopicPromptStyle,
  SocialTopicSafety,
} from '@shared/socialIcebreaker';
import { selectPermissionLineForTopic } from '@shared/socialIcebreakerYuezaiCopy';
import { findReviewBlockedVocab } from '@shared/copy/terms';
import { buildFallbackAIMeta, buildLiveAIMeta } from '@shared/types/aiMeta';
import {
  buildWarmupTopicsPrompt,
  WARMUP_TOPICS_PROMPT_VERSION,
  WARMUP_TOPICS_CHAT_PROMPT_VERSION,
  WARMUP_TOPICS_PROMPT_VERSION_HL,
  WARMUP_TOPICS_CHAT_PROMPT_VERSION_HL,
} from '../ai/socialIcebreakerPrompts';
import { getClientForFunction } from '../ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from '../lib/aiTraceLogger';
import type { ModerationCheck } from '../lib/aiContentModeration';
import { buildArchetypeContext } from '../lib/contextInjector';
import { buildSharedInterestHooks } from '../lib/icebreakerRosterSignals';
import { logger } from '../lib/logger';
import {
  fireAndForgetQualityGate,
  isLLMTimeoutError,
  raceWithTimeout,
  type AIServiceResult,
} from '../socialIcebreakerAICore';
import { attachAIGC, moderateAndAttachAIGC } from './moderation';

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
  const base: SocialTopic = {
    id: topic.id || `topic_${index + 1}`,
    question: topic.question || '分享一件让你会心一笑的小事',
    mood: topic.mood || fallbackMood,
    emoji: topic.emoji || '✨',
    category: topic.category || '轻松开场',
    depthLevel: normalizeTopicDepthLevel(topic.depthLevel),
    promptStyle: normalizeTopicPromptStyle(topic.promptStyle),
    safety: normalizeTopicSafety(topic.safety),
  };
  // 悦仔说 permission whisper — deterministic per topic so every table member
  // sees the identical line (campfire-vault-card-pr1 A2).
  base.permissionLine = selectPermissionLineForTopic({ question: base.question, depthLevel: base.depthLevel });
  if (topic.promptTiers?.opener && topic.promptTiers?.followUp && topic.promptTiers?.reflection) {
    base.promptTiers = {
      opener: String(topic.promptTiers.opener).slice(0, 30),
      followUp: String(topic.promptTiers.followUp).slice(0, 40),
      reflection: String(topic.promptTiers.reflection).slice(0, 50),
    };
  }
  return base;
}

function warmupTopicsChecks(topics: SocialTopic[]): ModerationCheck[] {
  return topics.flatMap((t, i) => {
    const checks: ModerationCheck[] = [
      { field: `topic[${i}].question`, text: t.question },
      { field: `topic[${i}].category`, text: t.category },
    ];
    if (t.promptTiers) {
      checks.push(
        { field: `topic[${i}].promptTiers.opener`, text: t.promptTiers.opener },
        { field: `topic[${i}].promptTiers.followUp`, text: t.promptTiers.followUp },
        { field: `topic[${i}].promptTiers.reflection`, text: t.promptTiers.reflection },
      );
    }
    return checks;
  });
}

/**
 * Brave-but-safe guarantee (campfire-vault-card-pr1 A1).
 *
 * A topic counts as "brave" when it is marked `safety: 'reflective'` — the
 * existing field, no new enum. Brave questions are emotionally vulnerable
 * (jealousy toward a friend, fear of falling behind, pretending to fit in)
 * but must never touch death, abuse, self-harm, or explicit content; the
 * moderation pass below remains the hard gate on that.
 */
export function hasBraveTopic(topics: SocialTopic[]): boolean {
  return topics.some((t) => t.safety === 'reflective');
}

/**
 * Repair an LLM topic set that contains no brave question by replacing the
 * final topic with a curated brave topic for the requested mood. Deterministic:
 * the first curated brave topic for the mood whose question is not already in
 * the set is chosen. Runs BEFORE moderation so the repaired set is what gets
 * checked and persisted.
 */
function ensureBraveTopic(
  topics: SocialTopic[],
  mood: AtmosphereMood,
  aiCorrelationId?: string,
  excludedKeys?: Set<string>,
): SocialTopic[] {
  if (hasBraveTopic(topics)) return topics;
  const presentQuestions = new Set(topics.map((t) => t.question));
  const isFresh = (t: SocialTopic) =>
    !presentQuestions.has(t.question)
    && !excludedKeys?.has(`id:${t.id}`)
    && !excludedKeys?.has(`q:${t.question}`);
  const candidate = FALLBACK_WARMUP_TOPICS.find(
    (t) => t.mood === mood && t.safety === 'reflective' && isFresh(t),
  ) ?? FALLBACK_WARMUP_TOPICS.find((t) => t.safety === 'reflective' && isFresh(t))
    // Window exhausted every brave card → keep the guarantee even if it repeats.
    ?? FALLBACK_WARMUP_TOPICS.find(
      (t) => t.mood === mood && t.safety === 'reflective' && !presentQuestions.has(t.question),
    )
    ?? FALLBACK_WARMUP_TOPICS.find((t) => t.safety === 'reflective' && !presentQuestions.has(t.question));
  if (!candidate) return topics;
  const repaired = [...topics];
  const replacementIndex = repaired.length > 0 ? repaired.length - 1 : 0;
  repaired[replacementIndex] = normalizeSocialTopic(candidate, mood, replacementIndex);
  logger.info('[SocialIcebreakerAI] generateWarmupTopics brave guarantee repair: injected curated brave topic', {
    mood,
    replacementQuestion: candidate.question,
    aiCorrelationId,
  });
  return repaired;
}

// ============ CURATED FALLBACK CONTENT ============

/** Curated warmup fallback bank — exported for contract tests (A1 brave-per-mood coverage). */
export const FALLBACK_WARMUP_TOPICS: SocialTopic[] = [
  { id: 'w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w2', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w3', question: '手机里现在最奇怪的一张照片，敢不敢给大家看看？', mood: 'funny', emoji: '📱', category: '轻松破冰', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w4', question: '最近有没有那种"世界真小"的巧合？', mood: 'life', emoji: '🌍', category: '偶遇故事', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w5', question: '你的性格要是道菜，你是什么菜？', mood: 'funny', emoji: '🍽️', category: '自我比喻', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w6', question: '最近一次真正放松是在哪儿？干嘛呢？', mood: 'relaxed', emoji: '😌', category: '舒适感', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w7', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '🌟', category: '理想日常', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w8', question: '如果能和任何人对坐吃一顿饭，你最想选谁？想聊点什么？', mood: 'emotional', emoji: '💫', category: '重要关系', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
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
  // Brave-but-safe entries (campfire-vault-card-pr1 A1): every mood carries ≥1
  // emotionally vulnerable question marked safety 'reflective' — never death,
  // abuse, self-harm, or explicit content.
  { id: 'w26', question: '有没有哪一刻，你突然觉得自己被落下了？', mood: 'life', emoji: '🍂', category: '情绪共鸣', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w27', question: '你有没有过跟着大家一起笑，其实没听懂笑点的时候？', mood: 'funny', emoji: '😅', category: '可爱瞬间', depthLevel: 2, promptStyle: 'experiential', safety: 'reflective' },
  { id: 'w28', question: '最近有没有觉得累，却不好意思说出来的时刻？', mood: 'relaxed', emoji: '🌙', category: '情绪安放', depthLevel: 2, promptStyle: 'reflective', safety: 'reflective' },
];

// ============ AI GENERATORS ============

function getTargetTopicCount(vibe?: 'chat' | 'balanced' | 'game'): number {
  switch (vibe) {
    case 'chat': return 6;
    case 'game': return 4;
    case 'balanced':
    default: return 5;
  }
}

// ─── W7.3/W7.4: curated fallback selection ──────────────────────────────────

/** Depth bands each vibe prefers (W7.3). `game` stays light, `chat` goes deep. */
function getVibeDepthPreference(vibe?: 'chat' | 'balanced' | 'game'): SocialTopicDepthLevel[] {
  switch (vibe) {
    case 'game': return [1, 2];
    case 'chat': return [2, 3];
    default: return [1, 2, 3];
  }
}

/**
 * Recently-served warmup-topic window, keyed by a caller-supplied pool/group
 * key (W7.4). Process-local and bounded: an in-memory dedup window is the
 * deliberate trade-off (no schema/migration in this sprint), and it never
 * blocks output — when the window would exhaust the curated bank the selection
 * widens back to the full pool instead of serving nothing.
 */
const WARMUP_DEDUPE_WINDOW_SESSIONS = 3;
const recentlyServedWarmupTopics = new Map<string, string[]>();

/** Test seam + operational reset for the process-local dedup window. */
export function resetWarmupTopicDedupe(): void {
  recentlyServedWarmupTopics.clear();
}

function warmupTopicKeys(topic: SocialTopic): string[] {
  const keys = [`id:${topic.id}`];
  if (topic.question) keys.push(`q:${topic.question}`);
  return keys;
}

function getRecentlyServedKeys(dedupeKey?: string, avoidKeys?: string[]): Set<string> {
  const excluded = new Set<string>(dedupeKey ? (recentlyServedWarmupTopics.get(dedupeKey) ?? []) : []);
  for (const key of avoidKeys ?? []) {
    excluded.add(key);
    // Callers (and the legacy `avoidTopics` body field) pass question text —
    // normalize to the same `q:` namespace used by the dedup window.
    if (!key.startsWith('id:') && !key.startsWith('q:')) excluded.add(`q:${key}`);
  }
  return excluded;
}

function recordRecentlyServedTopics(dedupeKey: string | undefined, topics: SocialTopic[]): void {
  if (!dedupeKey || topics.length === 0) return;
  const windowSize = getTargetTopicCount('balanced') * WARMUP_DEDUPE_WINDOW_SESSIONS;
  const merged = [...(recentlyServedWarmupTopics.get(dedupeKey) ?? [])];
  for (const topic of topics) {
    for (const key of warmupTopicKeys(topic)) {
      if (!merged.includes(key)) merged.push(key);
    }
  }
  recentlyServedWarmupTopics.set(dedupeKey, merged.slice(-windowSize));
}

/**
 * Build a specific card that names a roster shared interest (W7.3) so the
 * curated path is never vague when the table has a concrete common thread.
 */
function buildSharedInterestTopic(interest: string, mood: AtmosphereMood, index: number): SocialTopic {
  return normalizeSocialTopic(
    {
      id: `shared_interest_${index}`,
      question: `围绕「${interest}」，你们最近有什么想分享的新发现？`,
      mood,
      emoji: '✨',
      category: '共同兴趣',
      depthLevel: 1,
      promptStyle: 'binary',
      safety: 'gentle',
    },
    mood,
    index,
  );
}

export interface WarmupFallbackOptions {
  /** Roster shared-interest hooks — drives the ≥1 specific-card guarantee. */
  sharedInterests?: string[];
  /** Additional exclusion keys (`id:…`/`q:…`) from the caller's avoid list. */
  avoidKeys?: string[];
  /** Pool/group identity for the recently-served dedup window (W7.4). */
  dedupeKey?: string;
}

/**
 * Pure curated fallback selection — mood-first, vibe-depth-aware, shared-interest
 * specific, and dedup-aware. Does NOT mutate the dedup window (callers record
 * only what they actually serve).
 */
function selectFallbackTopics(
  mood: AtmosphereMood,
  vibe?: 'chat' | 'balanced' | 'game',
  options: WarmupFallbackOptions = {},
): SocialTopic[] {
  const targetCount = getTargetTopicCount(vibe);
  const preferredDepths = getVibeDepthPreference(vibe);
  const depthRank = (topic: SocialTopic): number => {
    const rank = preferredDepths.indexOf(normalizeTopicDepthLevel(topic.depthLevel));
    return rank === -1 ? preferredDepths.length : rank;
  };

  // Mood register first, then vibe-appropriate depth. Deterministic ordering
  // (no shuffle) so the dedup window is meaningful across sessions.
  const ordered = [
    ...FALLBACK_WARMUP_TOPICS.filter((t) => t.mood === mood),
    ...FALLBACK_WARMUP_TOPICS.filter((t) => t.mood !== mood),
  ].sort((a, b) => depthRank(a) - depthRank(b));

  const excluded = getRecentlyServedKeys(options.dedupeKey, options.avoidKeys);
  const available = ordered.filter(
    (t) => !excluded.has(`id:${t.id}`) && !excluded.has(`q:${t.question}`),
  );
  // Window exhausted the bank → widen rather than serve an empty table.
  const pool = available.length >= targetCount ? available : ordered;
  if (available.length < targetCount && options.dedupeKey) {
    logger.info('[SocialIcebreakerAI] warmup dedup window widened to avoid starving the topic pool', {
      dedupeKey: options.dedupeKey,
      available: available.length,
      targetCount,
    });
  }

  let topics = pool.slice(0, targetCount).map((topic, index) => normalizeSocialTopic(topic, mood, index));

  // W7.3: when the roster shares an interest, guarantee ≥1 card names it.
  const sharedInterest = (options.sharedInterests ?? []).find(
    (interest) => typeof interest === 'string' && interest.trim().length > 0 && !findReviewBlockedVocab(interest),
  );
  if (sharedInterest) {
    topics = [buildSharedInterestTopic(sharedInterest.trim(), mood, 0), ...topics.slice(1)];
  }

  return ensureBraveTopic(topics, mood, undefined, excluded);
}

function getPromptVersionForVibe(vibe?: 'chat' | 'balanced' | 'game', highlightsInjected = false): string {
  // Wave 3 (contract AC-08, verifier Q1): the highlights pair is selected
  // HERE, pre-build — the trace meta is never post-hoc overridden. Flag-off /
  // highlights-empty runs keep the legacy constants byte-identically.
  if (highlightsInjected) {
    return vibe === 'chat' ? WARMUP_TOPICS_CHAT_PROMPT_VERSION_HL : WARMUP_TOPICS_PROMPT_VERSION_HL;
  }
  return vibe === 'chat' ? WARMUP_TOPICS_CHAT_PROMPT_VERSION : WARMUP_TOPICS_PROMPT_VERSION;
}

function isWarmupLlmEnabled(): boolean {
  const v = process.env.SOCIAL_WARMUP_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

/** Hard ceiling for one warmup-topics LLM call. The AbortController below is
 *  best-effort (SDK/transport may swallow signals); the race in raceWithTimeout
 *  is the deterministic bound, so a hung provider can never freeze /topics. */
const WARMUP_TOPICS_LLM_TIMEOUT_MS = 6000;

export async function generateWarmupTopics(params: {
  mood: AtmosphereMood;
  eventType: string;
  participantCount: number;
  avoidTopics?: string[];
  _refinementHint?: string;
  /** Roster archetypes (and, when matching-aware W5 is on, top interests). */
  roster?: Array<{ archetype?: string; interests?: string[] }>;
  /** Vibe drives card count, depth curve, and tier generation. */
  vibe?: 'chat' | 'balanced' | 'game';
  /**
   * W7.4: stable pool/group identity for the recently-served dedup window.
   * Omit to disable cross-session dedup (test/one-off callers).
   */
  dedupeKey?: string;
  /** Wave 3 (contract AC-07): aggregate session highlights body (state.highlights).
   *  Threaded into the prompt as a 【本场高光】 block when non-empty; also drives
   *  the paired *_HL promptVersion selection (AC-08). */
  highlights?: string;
}): Promise<AIServiceResult<SocialTopic[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const highlightsInjected = Boolean(params.highlights?.trim());
  const promptVersion = getPromptVersionForVibe(params.vibe, highlightsInjected);

  // W5/W7.3: shared-interest hooks (labels declared by ≥2 members). Empty when
  // the roster carries no interests (flag off). Also drives fallback
  // specificity so the curated path names a real common thread when possible.
  const sharedInterests = buildSharedInterestHooks(params.roster ?? []);
  const fallbackOptions: WarmupFallbackOptions = {
    sharedInterests,
    dedupeKey: params.dedupeKey,
    avoidKeys: params.avoidTopics,
  };

  // If AI is disabled, return curated fallback immediately
  if (!isWarmupLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe, fallbackOptions), meta });
  }

  let selection: ReturnType<typeof getClientForFunction>;
  try {
    selection = getClientForFunction('generateWarmupTopics');
  } catch (error) {
    logger.error('[SocialIcebreakerAI] generateWarmupTopics provider selection failed; using curated fallback', {
      error: error instanceof Error ? error.message : String(error),
      aiCorrelationId,
    });
    const meta = buildFallbackAIMeta('provider_unavailable', promptVersion, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateWarmupTopics',
      provider: null,
      model: 'n/a',
      latencyMs: 0,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
      extra: { highlightsInjected },
    });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe, fallbackOptions), meta });
  }

  const { client, model, provider } = selection;
  const t0 = Date.now();

  // 6s budget for warmup generation. AbortController is best-effort; the race
  // wrapper is the hard bound — a hung provider must never freeze /topics
  // (2026-07-26 出题卡死 incident: >75s generating, stall nudge misfired).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WARMUP_TOPICS_LLM_TIMEOUT_MS);

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (params.roster?.length) {
      // Observability: record whether roster signals were actually present.
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'contextInjector',
        provider: null,
        model: 'n/a',
        latencyMs: 0,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: 'context-injector-v2',
        extra: {
          members: params.roster.length,
          archetypeMix: sessionContext?.mixText || null,
          sharedInterestCount: sharedInterests.length,
        },
      });
    }
    const prompt = buildWarmupTopicsPrompt({ ...params, sessionContext, sharedInterests });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: params.vibe === 'chat' ? 1200 : 500,
      }, { signal: controller.signal }),
      WARMUP_TOPICS_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
      return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe, fallbackOptions), meta });
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms vibe=${params.vibe ?? 'balanced'}`);
      const meta = buildLiveAIMeta(provider, promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion, extra: { highlightsInjected } });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'warmup', params.eventType);
      const targetCount = getTargetTopicCount(params.vibe);
      const normalizedTopics: SocialTopic[] = parsed.slice(0, targetCount + 1).map((topic, index) => normalizeSocialTopic(topic, params.mood, index));
      // Brave-but-safe guarantee: repair before moderation so the checked and
      // persisted set always contains ≥1 brave question (contract A1/A4).
      const braveRepairedTopics = ensureBraveTopic(normalizedTopics, params.mood, aiCorrelationId);
      // W7.4: drop recently-served cards and top up from curated so this pool
      // never hears the same question across its recent sessions.
      const liveTopics = dedupeLiveWarmupTopics(
        braveRepairedTopics,
        params.mood,
        params.vibe,
        params.dedupeKey,
        sharedInterests,
      );
      recordRecentlyServedTopics(params.dedupeKey, liveTopics);
      return moderateAndAttachAIGC(
        { data: liveTopics, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateWarmupTopics',
          // Pure selection (no dedup mutation) — only recorded if moderation
          // actually degrades to it.
          fallbackData: selectFallbackTopics(params.mood, params.vibe, fallbackOptions),
          checks: warmupTopicsChecks(liveTopics),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe, fallbackOptions), meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const isTimeout = isLLMTimeoutError(error);
    logger.error(`[SocialIcebreakerAI] generateWarmupTopics error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error), isTimeout });
    const meta = buildFallbackAIMeta(isTimeout ? 'timeout' : 'llm_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason, extra: { highlightsInjected } });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe, fallbackOptions), meta });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * W7.4: drop recently-served cards from a live set and top up from the curated
 * pool so the target count and the brave guarantee are preserved. No-op when no
 * dedupe key is supplied.
 */
function dedupeLiveWarmupTopics(
  topics: SocialTopic[],
  mood: AtmosphereMood,
  vibe: 'chat' | 'balanced' | 'game' | undefined,
  dedupeKey: string | undefined,
  sharedInterests: string[],
): SocialTopic[] {
  if (!dedupeKey) return topics;
  const excluded = getRecentlyServedKeys(dedupeKey);
  const kept = topics.filter(
    (t) => !excluded.has(`id:${t.id}`) && !excluded.has(`q:${t.question}`),
  );
  if (kept.length === topics.length) return topics;

  const targetCount = getTargetTopicCount(vibe);
  const topUp = selectFallbackTopics(mood, vibe, { dedupeKey, sharedInterests });
  const merged = [...kept];
  for (const topic of topUp) {
    if (merged.length >= targetCount) break;
    if (!merged.some((m) => m.id === topic.id || m.question === topic.question)) merged.push(topic);
  }
  return ensureBraveTopic(merged, mood, undefined, excluded);
}

/**
 * Served curated fallback (records the dedup window). Prefer `selectFallbackTopics`
 * when the result may not actually be served.
 */
function getFallbackTopics(
  mood: AtmosphereMood,
  vibe?: 'chat' | 'balanced' | 'game',
  options: WarmupFallbackOptions = {},
): SocialTopic[] {
  const topics = selectFallbackTopics(mood, vibe, options);
  recordRecentlyServedTopics(options.dedupeKey, topics);
  return topics;
}

export function getCuratedWarmupTopics(
  mood: AtmosphereMood,
  vibe?: 'chat' | 'balanced' | 'game',
  options: WarmupFallbackOptions = {},
): SocialTopic[] {
  return getFallbackTopics(mood, vibe, options);
}
