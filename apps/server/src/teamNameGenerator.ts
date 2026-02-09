/**
 * Team Name Generator Service
 * 
 * AI-powered team name generation for event pool groups using DeepSeek API.
 * Generates creative, culturally-relevant Chinese team names based on member
 * archetypes, interests, and event context.
 * 
 * Features:
 * - Async non-blocking generation
 * - Content safety filtering
 * - Graceful fallback to templates
 * - AI usage tracking
 */

import OpenAI from 'openai';
import { db } from './db';
import { eventPoolGroups, users, userInterests } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import type { MatchGroup } from './poolMatchingService';

// Validate API key at module initialization
if (!process.env.DEEPSEEK_API_KEY) {
  console.warn('⚠️ DEEPSEEK_API_KEY environment variable is not set. Team name generation will use fallback mode.');
}

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-fallback',
  baseURL: 'https://api.deepseek.com',
});

const DEEPSEEK_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '5000', 10);
const ENABLE_TEAM_NAME_GENERATION = process.env.ENABLE_TEAM_NAME_GENERATION !== 'false';
const AI_USAGE_TRACKING_ENABLED = process.env.AI_USAGE_TRACKING_ENABLED !== 'false';

// Blocked keywords for content safety (normalized to lowercase)
const BLOCKED_KEYWORDS = [
  '政治', '敏感', '违法', '暴力', '色情', '赌博', 
  '毒品', '歧视', '仇恨', '极端', '恐怖', '习近平',
  '共产党', '六四', '台独', '藏独', '法轮功'
];

const NORMALIZED_BLOCKED_KEYWORDS = BLOCKED_KEYWORDS.map(k => k.toLowerCase());

export interface TeamNameResult {
  teamName: string;
  teamTagline: string;
  teamEmoji: string;
  teamSuperpowers: string[];
  teamVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
}

export interface TeamNameContext {
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
 * Main export: Generate and assign team name to a group
 */
export async function generateAndAssignTeamName(
  groupId: string,
  group: MatchGroup,
  eventType: string
): Promise<TeamNameResult | null> {
  if (!ENABLE_TEAM_NAME_GENERATION) {
    console.log('[TeamNameGen] Feature disabled, skipping');
    return null;
  }

  const startTime = Date.now();
  console.log(`[TeamNameGen] Generating for group ${groupId}...`);

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

    const context: TeamNameContext = {
      groupId,
      memberArchetypes,
      memberInterests: uniqueInterests,
      eventType,
      temperatureLevel: group.temperatureLevel
    };

    // Try AI generation first
    let result: TeamNameResult | null = null;
    
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        result = await generateTeamNameWithAI(context);
        
        if (result && validateTeamNameResult(result)) {
          const duration = Date.now() - startTime;
          console.log(`[AI] Team name generated in ${duration}ms`);
          console.log(`[TeamNameGen] ✅ ${result.teamEmoji} ${result.teamName}`);
          
          // Save to database
          await db.update(eventPoolGroups)
            .set({
              teamName: result.teamName,
              teamTagline: result.teamTagline,
              teamEmoji: result.teamEmoji,
              teamSuperpowers: result.teamSuperpowers,
              teamVibe: result.teamVibe,
              updatedAt: new Date()
            })
            .where(eq(eventPoolGroups.id, groupId));

          trackAIUsage({
            groupId,
            success: true,
            latencyMs: duration,
          });

          return result;
        } else {
          console.warn('[AI] Validation failed, using fallback');
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[AI] Team name generation failed after ${duration}ms:`, error);
        
        trackAIUsage({
          groupId,
          success: false,
          latencyMs: duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Fallback to template-based generation
    result = generateFallbackTeamName(context);
    console.log(`[TeamNameGen] 🔄 Fallback used: ${result.teamEmoji} ${result.teamName}`);

    // Save to database
    await db.update(eventPoolGroups)
      .set({
        teamName: result.teamName,
        teamTagline: result.teamTagline,
        teamEmoji: result.teamEmoji,
        teamSuperpowers: result.teamSuperpowers,
        teamVibe: result.teamVibe,
        updatedAt: new Date()
      })
      .where(eq(eventPoolGroups.id, groupId));

    return result;

  } catch (error) {
    console.error('[TeamNameGen] Critical error:', error);
    return null;
  }
}

/**
 * Generate team name using DeepSeek AI (with timeout protection)
 */
async function generateTeamNameWithAI(context: TeamNameContext): Promise<TeamNameResult | null> {
  const prompt = buildTeamNamePrompt(context);

  // Timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  try {
    const completion = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个创意团队命名专家，擅长为社交活动小组创造有趣、文化相关的中文团队名称。'
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
      throw new Error('Empty response from DeepSeek');
    }

    const parsed = JSON.parse(content);
    
    return {
      teamName: parsed.teamName || parsed.team_name,
      teamTagline: parsed.teamTagline || parsed.tagline,
      teamEmoji: parsed.teamEmoji || parsed.emoji,
      teamSuperpowers: parsed.teamSuperpowers || parsed.superpowers || [],
      teamVibe: parsed.teamVibe || parsed.vibe || 'playful'
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[AI] Request timeout after', DEEPSEEK_TIMEOUT_MS, 'ms');
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
 * Validate team name result for content safety and structure
 */
function validateTeamNameResult(result: TeamNameResult): boolean {
  // Structure validation
  if (!result.teamName || result.teamName.length < 2 || result.teamName.length > 20) {
    console.warn('[AI] Invalid team name length:', result.teamName);
    return false;
  }

  if (!result.teamTagline || result.teamTagline.length > 20) {
    console.warn('[AI] Invalid tagline length');
    return false;
  }

  const emoji = (result.teamEmoji || '').trim();
  // Require exactly one grapheme cluster for the emoji. We avoid using
  // raw string.length here because many single emojis use multiple UTF-16
  // code units (e.g. skin tones, ZWJ sequences).
  if (!emoji || !isSingleGrapheme(emoji)) {
    console.warn('[AI] Invalid emoji:', result.teamEmoji);
    return false;
  }

  if (!Array.isArray(result.teamSuperpowers) || result.teamSuperpowers.length === 0) {
    console.warn('[AI] Invalid superpowers');
    return false;
  }

  const validVibes = ['playful', 'professional', 'creative', 'adventurous'];
  if (!validVibes.includes(result.teamVibe)) {
    console.warn('[AI] Invalid vibe:', result.teamVibe);
    return false;
  }

  // Content safety filtering
  const textToCheck = [
    result.teamName,
    result.teamTagline,
    ...result.teamSuperpowers
  ].join(' ').toLowerCase();

  for (const keyword of NORMALIZED_BLOCKED_KEYWORDS) {
    if (textToCheck.includes(keyword)) {
      console.warn('[AI] Blocked content detected:', keyword);
      return false;
    }
  }

  return true;
}

/**
 * Build prompt for AI team name generation
 */
function buildTeamNamePrompt(context: TeamNameContext): string {
  const { memberArchetypes, memberInterests, eventType, temperatureLevel } = context;

  return `请为一个社交活动小组创建一个有趣、有创意的团队名称。

**小组信息：**
- 成员人格类型：${memberArchetypes.join('、')}
- 共同兴趣：${memberInterests.slice(0, 5).join('、') || '暂无'}
- 活动类型：${eventType}
- 化学反应温度：${temperatureLevel} ${temperatureLevel === 'fire' ? '🔥炽热' : temperatureLevel === 'warm' ? '🌡️温暖' : temperatureLevel === 'mild' ? '🌤️适宜' : '❄️冷淡'}

**要求：**
1. 团队名称要简洁有力（4-8个字）
2. 标语要鼓舞人心、积极向上（不超过20字）
3. 超能力要体现小组特点（3-4个词）
4. 氛围风格要符合小组特质
5. 使用一个合适的emoji代表团队

**输出格式（JSON）：**
{
  "teamName": "团队名称",
  "tagline": "标语",
  "emoji": "🎯",
  "superpowers": ["特长1", "特长2", "特长3"],
  "vibe": "playful | professional | creative | adventurous"
}

请只返回JSON，不要有其他文字。`;
}

/**
 * Generate fallback team name using templates
 */
function generateFallbackTeamName(context: TeamNameContext): TeamNameResult {
  // Currently, the fallback strategy is purely template-based and does not
  // use detailed context fields like member archetypes or event type.

  // Template-based generation
  const prefixes = ['快乐', '温暖', '活力', '梦想', '冒险', '探索'];
  const suffixes = ['天团', '小队', '联盟', '军团', '战队', '组合'];
  
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  const teamName = `${randomPrefix}${randomSuffix}`;
  
  const taglines = [
    '用热情点燃每一次相遇',
    '让陌生成为惊喜的开始',
    '我们用温暖融化社交坚冰',
    '每个人都是这里的主角',
    '不期而遇的美好'
  ];
  
  const emojis = ['🌟', '🎯', '🎉', '🌈', '🔥', '✨'];
  
  const superpowers = ['氛围担当', '破冰高手', '话题王', '社交达人'];
  
  const vibes: Array<'playful' | 'professional' | 'creative' | 'adventurous'> = 
    ['playful', 'creative', 'adventurous'];

  return {
    teamName,
    teamTagline: taglines[Math.floor(Math.random() * taglines.length)],
    teamEmoji: emojis[Math.floor(Math.random() * emojis.length)],
    teamSuperpowers: superpowers.slice(0, 3),
    teamVibe: vibes[Math.floor(Math.random() * vibes.length)]
  };
}

/**
 * Track AI usage metrics
 */
function trackAIUsage(metrics: AIUsageMetrics): void {
  if (!AI_USAGE_TRACKING_ENABLED) return;

  const { groupId, success, latencyMs, errorMessage } = metrics;
  
  if (success) {
    console.log(`[AI Usage] Group ${groupId}: SUCCESS in ${latencyMs}ms`);
  } else {
    console.log(`[AI Usage] Group ${groupId}: FAILED in ${latencyMs}ms - ${errorMessage}`);
  }
}
