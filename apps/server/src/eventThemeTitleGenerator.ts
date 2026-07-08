/**
 * Event Theme Title Generator Service
 * 
 * AI-powered event theme title generation for event pool groups.
 * Generates creative, culturally-relevant Chinese event theme titles based on member
 * archetypes, interests, and event context.
 * 
 * Features:
 * - Async non-blocking generation
 * - Content safety filtering
 * - Graceful fallback to templates
 * - AI usage tracking
 *
 * Provider: MiniMax (hybrid) when configured, DeepSeek otherwise.
 */

import OpenAI from 'openai';
import { db } from './db';
import { eventPoolGroups, users, userInterests } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import type { MatchGroup } from './poolMatchingService';
import { getMiniMaxClient, MINIMAX_MODEL } from './ai/minimaxClient';
import { getEventThemeTitleProvider, isProviderAvailable, type AIProvider } from './ai/creativeModelRouter';
import { getDeepseekClient, getDeepseekModel } from './ai/deepseekClient';
import { logAITrace } from './lib/aiTraceLogger';
import { logger } from './lib/logger';
import { buildAIGCMeta, buildFallbackAIMeta, buildLiveAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { moderateGeneratedContent } from './lib/aiContentModeration';

// Validate API keys at module initialization
if (!process.env.DEEPSEEK_API_KEY && !process.env.MINIMAX_API_KEY) {
  logger.warn('Neither DEEPSEEK_API_KEY nor MINIMAX_API_KEY is set. Event theme title generation will use fallback mode.');
}

/**
 * Returns the active AI client and model for event theme title generation based on provider routing.
 */
function getEventThemeTitleAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  const provider = getEventThemeTitleProvider();

  if (provider === 'minimax') {
    const minimaxClient = getMiniMaxClient();
    if (minimaxClient) {
      return { client: minimaxClient, model: MINIMAX_MODEL, provider: 'minimax' };
    }
    logger.warn('MiniMax provider selected but MINIMAX_API_KEY not set, falling back to DeepSeek', { component: 'EventThemeTitleGen' });
  }

  return { client: getDeepseekClient(), model: getDeepseekModel('flash'), provider: 'deepseek' };
}

const AI_TIMEOUT_MS = parseInt(
  process.env.AI_TIMEOUT_MS ||
  process.env.DEEPSEEK_TIMEOUT_MS ||
  process.env.MINIMAX_TIMEOUT_MS ||
  '5000',
  10
);
const ENABLE_EVENT_THEME_TITLE_GENERATION = process.env.ENABLE_EVENT_THEME_TITLE_GENERATION !== 'false';
const AI_USAGE_TRACKING_ENABLED = process.env.AI_USAGE_TRACKING_ENABLED !== 'false';
const EVENT_THEME_TITLE_PROMPT_VERSION = 'event-theme-title-v1';

// Blocked keywords for content safety (normalized to lowercase)
const BLOCKED_KEYWORDS = [
  '政治', '敏感', '违法', '暴力', '色情', '赌博', 
  '毒品', '歧视', '仇恨', '极端', '恐怖', '习近平',
  '共产党', '六四', '台独', '藏独', '法轮功'
];

const NORMALIZED_BLOCKED_KEYWORDS = BLOCKED_KEYWORDS.map(k => k.toLowerCase());

export interface EventThemeTitleResult {
  eventThemeTitle: string;
  themeTagline: string;
  themeEmoji: string;
  themeHighlights: string[];
  themeVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
  /** Standard AI observability metadata with AIGC compliance flags. */
  meta: AIResponseMeta;
}

function sanitizeThemeHighlights(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((highlight): highlight is string => typeof highlight === 'string')
    .map((highlight) => highlight.trim())
    .filter((highlight) => highlight.length > 0)
    .slice(0, 4);
}

export interface EventThemeTitleContext {
  groupId: string;
  memberArchetypes: string[];
  memberInterests: string[];
  eventType: string;
  temperatureLevel: string;
}

interface AIUsageMetrics {
  groupId: string;
  success: boolean;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
}

/**
 * Main export: Generate and assign event theme title to a group
 */
export async function generateAndAssignEventThemeTitle(
  groupId: string,
  group: MatchGroup,
  eventType: string
): Promise<EventThemeTitleResult | null> {
  if (!ENABLE_EVENT_THEME_TITLE_GENERATION) {
    logger.info('Feature disabled, skipping', { component: 'EventThemeTitleGen' });
    return null;
  }

  const startTime = Date.now();
  logger.info('Generating event theme title', { component: 'EventThemeTitleGen', groupId });

  try {
    // Fetch member details
    const memberUserIds = group.members.map(m => m.userId);
    const memberProfiles = await db.select().from(users)
      .where(inArray(users.id, memberUserIds));

    const memberArchetypes = memberProfiles
      .map((u: any) => u.archetype || '未知')
      .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i); // unique

    // Fetch member interests
    const memberInterestRecords = await db.select().from(userInterests)
      .where(inArray(userInterests.userId, memberUserIds));

    const allInterests: string[] = memberInterestRecords.flatMap((record: any) => {
      const selections = record.selections as any[] || [];
      return selections.map((s: any) => (s.label || s.fullName) as string);
    });
    
    const uniqueInterests: string[] = [...new Set(allInterests)].slice(0, 10); // Top 10 unique interests

    const context: EventThemeTitleContext = {
      groupId,
      memberArchetypes,
      memberInterests: uniqueInterests,
      eventType,
      temperatureLevel: group.temperatureLevel
    };

    // Try AI generation first
    let result: EventThemeTitleResult | null = null;
    let fallbackErrorCode: string = 'template_fallback';
    const aiSelection = getEventThemeTitleAIClient();

    if (isProviderAvailable(aiSelection.provider)) {
      try {
        result = await generateEventThemeTitleWithAI(context, aiSelection);
        
        if (result && validateEventThemeTitleResult(result)) {
          result.themeHighlights = sanitizeThemeHighlights(result.themeHighlights);

          const moderationChecks = [
            { field: 'eventThemeTitle', text: result.eventThemeTitle },
            { field: 'themeTagline', text: result.themeTagline },
            ...result.themeHighlights.map((h, i) => ({ field: `themeHighlight_${i}`, text: h })),
          ];
          const moderation = moderateGeneratedContent(moderationChecks, {
            domain: 'theme_generation',
            feature: 'generateEventThemeTitle',
            provider: aiSelection.provider,
            model: aiSelection.model,
            latencyMs: Date.now() - startTime,
            promptVersion: EVENT_THEME_TITLE_PROMPT_VERSION,
          });
          if (!moderation.safe) {
            logger.warn('Content safety moderation failed, using fallback', { component: 'EventThemeTitleGen', field: moderation.field });
            fallbackErrorCode = 'content_safety';
            trackAIUsage({
              groupId,
              success: false,
              latencyMs: Date.now() - startTime,
              errorMessage: 'content_safety',
            });
          } else {
            const duration = Date.now() - startTime;
            const meta = buildLiveAIMeta(aiSelection.provider, EVENT_THEME_TITLE_PROMPT_VERSION);
            result.meta = {
              ...meta,
              aigc: buildAIGCMeta({ fallbackUsed: false, labelType: 'ai-generated' }),
            };
            logger.info('Event theme title generated', { component: 'EventThemeTitleGen', provider: aiSelection.provider, latencyMs: duration });
            logger.info('Event theme title result', { component: 'EventThemeTitleGen', emoji: result.themeEmoji, title: result.eventThemeTitle });
            logAITrace({
              domain: 'theme_generation',
              feature: 'generateEventThemeTitle',
              provider: aiSelection.provider,
              model: aiSelection.model,
              latencyMs: duration,
              success: true,
              fallbackUsed: false,
              fromCache: false,
              promptVersion: EVENT_THEME_TITLE_PROMPT_VERSION,
            });

            await saveGroupTheme(groupId, result);

            trackAIUsage({
              groupId,
              success: true,
              latencyMs: duration,
            });

            return result;
          }
        } else {
          logger.warn('Validation failed, using fallback', { component: 'EventThemeTitleGen' });
          fallbackErrorCode = 'validation_failed';
          trackAIUsage({
            groupId,
            success: false,
            latencyMs: Date.now() - startTime,
            errorMessage: 'validation_failed',
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Event theme title generation failed', { component: 'EventThemeTitleGen', durationMs: duration, error: error instanceof Error ? error.message : String(error) });
        fallbackErrorCode = 'llm_error';
        
        trackAIUsage({
          groupId,
          success: false,
          latencyMs: duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      fallbackErrorCode = 'provider_unavailable';
    }

    // Fallback to template-based generation
    result = generateFallbackEventThemeTitle(context);
    result.themeHighlights = sanitizeThemeHighlights(result.themeHighlights);
    result.meta = {
      ...buildFallbackAIMeta(fallbackErrorCode, EVENT_THEME_TITLE_PROMPT_VERSION),
      aigc: buildAIGCMeta({ fallbackUsed: true, labelType: 'ai-generated' }),
    };
    logAITrace({
      domain: 'theme_generation',
      feature: 'generateEventThemeTitle',
      provider: fallbackErrorCode === 'provider_unavailable' ? null : aiSelection.provider,
      model: fallbackErrorCode === 'provider_unavailable' ? undefined : aiSelection.model,
      latencyMs: Date.now() - startTime,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: EVENT_THEME_TITLE_PROMPT_VERSION,
      errorCode: fallbackErrorCode,
    });
    logger.info('Fallback used for event theme title', { component: 'EventThemeTitleGen', emoji: result.themeEmoji, title: result.eventThemeTitle });

    await saveGroupTheme(groupId, result);

    return result;

  } catch (error) {
    logger.error('Critical error in event theme title generation', { component: 'EventThemeTitleGen', error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Persist generated theme metadata to the group's database row.
 */
async function saveGroupTheme(
  groupId: string,
  result: EventThemeTitleResult,
): Promise<void> {
  await db.update(eventPoolGroups)
    .set({
      theme: result.eventThemeTitle,
      subtitle: result.themeTagline,
      themeEmoji: result.themeEmoji,
      themeHighlights: result.themeHighlights,
      vibe: result.themeVibe,
      updatedAt: new Date(),
    })
    .where(eq(eventPoolGroups.id, groupId));
}

/**
 * Generate event theme title using the hybrid AI provider (with timeout protection).
 */
async function generateEventThemeTitleWithAI(
  context: EventThemeTitleContext,
  selection: { client: OpenAI; model: string; provider: AIProvider },
): Promise<EventThemeTitleResult | null> {
  const prompt = buildEventThemeTitlePrompt(context);

  // Resolve provider and client via shared helper
  const { client, model } = selection;

  // Timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个创意盲盒主题命名专家，擅长为社交活动小组创造有趣、文化相关的中文盲盒主题标题。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    }, {
      signal: controller.signal as any
    });

    clearTimeout(timeoutId);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI provider');
    }

    const parsed = JSON.parse(content);
    
    return {
      eventThemeTitle: parsed.eventThemeTitle || parsed.event_theme_title || parsed.teamName || parsed.team_name,
      themeTagline: parsed.themeTagline || parsed.theme_tagline || parsed.teamTagline || parsed.tagline,
      themeEmoji: parsed.themeEmoji || parsed.theme_emoji || parsed.teamEmoji || parsed.emoji,
      themeHighlights: parsed.themeHighlights || parsed.theme_highlights || parsed.teamSuperpowers || parsed.superpowers || [],
      themeVibe: parsed.themeVibe || parsed.theme_vibe || parsed.teamVibe || parsed.vibe || 'playful',
      meta: buildLiveAIMeta(selection.provider, EVENT_THEME_TITLE_PROMPT_VERSION),
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Request timeout', { component: 'EventThemeTitleGen', timeoutMs: AI_TIMEOUT_MS });
    }
    
    throw error;
  }
}

/**
 * Count user-perceived characters (grapheme clusters) in a string.
 * Uses Intl.Segmenter when available, with a safe fallback.
 */
function countGraphemeClusters(input: string): number {
  if (!input) return 0;

  // Prefer Intl.Segmenter for accurate grapheme segmentation
  if (typeof (Intl as any).Segmenter === 'function') {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
    let count = 0;
    for (const _ of segmenter.segment(input)) {
      count++;
    }
    return count;
  }

  // Fallback: split by code points. Not perfect for all ZWJ sequences,
  // but still better than raw UTF-16 .length.
  return Array.from(input).length;
}

/**
 * Whether the given string is exactly one grapheme cluster.
 */
function isSingleGrapheme(input: string): boolean {
  return countGraphemeClusters(input) === 1;
}

/**
 * Validate event theme title result for content safety and structure
 */
function validateEventThemeTitleResult(result: EventThemeTitleResult): boolean {
  const themeHighlights = sanitizeThemeHighlights(result.themeHighlights);

  // Structure validation
  if (!result.eventThemeTitle || result.eventThemeTitle.length < 2 || result.eventThemeTitle.length > 20) {
    logger.warn('Invalid event theme title length', { component: 'EventThemeTitleGen', title: result.eventThemeTitle });
    return false;
  }

  if (!result.themeTagline || result.themeTagline.length > 20) {
    logger.warn('Invalid tagline length', { component: 'EventThemeTitleGen' });
    return false;
  }

  const emoji = (result.themeEmoji || '').trim();
  // Require exactly one grapheme cluster for the emoji. We avoid using
  // raw string.length here because many single emojis use multiple UTF-16
  // code units (e.g. skin tones, ZWJ sequences).
  if (!emoji || !isSingleGrapheme(emoji)) {
    logger.warn('Invalid emoji', { component: 'EventThemeTitleGen', emoji: result.themeEmoji });
    return false;
  }

  if (themeHighlights.length === 0) {
    logger.warn('Invalid highlights', { component: 'EventThemeTitleGen' });
    return false;
  }

  const validVibes = ['playful', 'professional', 'creative', 'adventurous'];
  if (!validVibes.includes(result.themeVibe)) {
    logger.warn('Invalid vibe', { component: 'EventThemeTitleGen', vibe: result.themeVibe });
    return false;
  }

  // Content safety filtering
  const textToCheck = [
    result.eventThemeTitle,
    result.themeTagline,
    ...themeHighlights
  ].join(' ').toLowerCase();

  for (const keyword of NORMALIZED_BLOCKED_KEYWORDS) {
    if (textToCheck.includes(keyword)) {
      logger.warn('Blocked content detected', { component: 'EventThemeTitleGen', keyword });
      return false;
    }
  }

  return true;
}

/**
 * Build prompt for AI event theme title generation
 */
function buildEventThemeTitlePrompt(context: EventThemeTitleContext): string {
  const { memberArchetypes, memberInterests, eventType, temperatureLevel } = context;

  return `请为一个社交活动小组创建一个有趣、有创意的盲盒主题标题。

**小组信息：**
- 成员人格类型：${memberArchetypes.join('、')}
- 共同兴趣：${memberInterests.slice(0, 5).join('、') || '暂无'}
- 活动类型：${eventType}
- 化学反应温度：${temperatureLevel} ${temperatureLevel === 'fire' ? '🔥炽热' : temperatureLevel === 'warm' ? '🌡️温暖' : temperatureLevel === 'mild' ? '🌤️适宜' : '❄️冷淡'}

**要求：**
1. 盲盒主题标题要简洁有力（4-8个字）
2. 标语要鼓舞人心、积极向上（不超过20字）
3. 主题亮点要体现小组特点（3-4个词）
4. 氛围风格要符合小组特质
5. 使用一个合适的emoji代表主题

**输出格式（JSON）：**
{
  "eventThemeTitle": "盲盒主题标题",
  "tagline": "标语",
  "emoji": "🎯",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "vibe": "playful | professional | creative | adventurous"
}

请只返回JSON，不要有其他文字。`;
}

/**
 * Generate fallback event theme title using templates
 */
function generateFallbackEventThemeTitle(context: EventThemeTitleContext): EventThemeTitleResult {
  // Currently, the fallback strategy is purely template-based and does not
  // use detailed context fields like member archetypes or event type.

  // Template-based generation
  const prefixes = ['快乐', '温暖', '活力', '梦想', '冒险', '探索'];
  const suffixes = ['盲盒', '主题', '派对', '聚会', '时光', '空间'];
  
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  const eventThemeTitle = `${randomPrefix}${randomSuffix}`;
  
  const taglines = [
    '用热情点燃每一次相遇',
    '让陌生成为惊喜的开始',
    '我们用温暖融化社交坚冰',
    '每个人都是这里的主角',
    '不期而遇的美好'
  ];
  
  const emojis = ['🌟', '🎯', '🎉', '🌈', '🔥', '✨'];
  
  const highlights = ['氛围担当', '破冰高手', '话题王', '社交达人'];
  
  const vibes: Array<'playful' | 'professional' | 'creative' | 'adventurous'> = 
    ['playful', 'creative', 'adventurous'];

  return {
    eventThemeTitle,
    themeTagline: taglines[Math.floor(Math.random() * taglines.length)],
    themeEmoji: emojis[Math.floor(Math.random() * emojis.length)],
    themeHighlights: highlights.slice(0, 3),
    themeVibe: vibes[Math.floor(Math.random() * vibes.length)],
    meta: buildFallbackAIMeta('template_fallback', EVENT_THEME_TITLE_PROMPT_VERSION),
  };
}

/**
 * Track AI usage metrics
 */
function trackAIUsage(metrics: AIUsageMetrics): void {
  if (!AI_USAGE_TRACKING_ENABLED) return;

  const { groupId, success, latencyMs, errorMessage } = metrics;
  
  if (success) {
    logger.info('AI usage tracked', { component: 'AIUsage', groupId, latencyMs, success: true });
  } else {
    logger.info('AI usage tracked', { component: 'AIUsage', groupId, latencyMs, success: false, errorMessage });
  }
}
