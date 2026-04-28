/**
 * Theme LLM Service
 * 主题LLM服务
 * 
 * Handles AI generation for event themes with validation and retry logic.
 * Provider: MiniMax (hybrid) when configured, DeepSeek otherwise.
 */

import OpenAI from 'openai';
import type { 
  EventTheme, 
  ThemeLLMInput, 
  ValidationResult 
} from '@shared/types/eventTheme';
import { getEnergyLabel, getEnergyEmoji } from './themeScoringService';
import { getMiniMaxClient, MINIMAX_MODEL } from './ai/minimaxClient';
import { getThemeLLMProvider, isProviderAvailable, type AIProvider } from './ai/creativeModelRouter';
import { getDeepseekClient, getDeepseekModel } from './ai/deepseekClient';
import { logAITrace } from './lib/aiTraceLogger';
import { logger } from "./lib/logger";

const THEME_LLM_PROMPT_VERSION = 'event-theme-llm-v1';

// Validate API keys at module initialization
if (!process.env.DEEPSEEK_API_KEY && !process.env.MINIMAX_API_KEY) {
  logger.warn('[ThemeLLM] Neither DEEPSEEK_API_KEY nor MINIMAX_API_KEY is set. Theme generation will use fallback mode.');
}

/**
 * Returns the active AI client and model for theme generation based on provider routing.
 */
function getThemeAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  const provider = getThemeLLMProvider();

  if (provider === 'minimax') {
    const minimaxClient = getMiniMaxClient();
    if (minimaxClient) {
      return { client: minimaxClient, model: MINIMAX_MODEL, provider: 'minimax' };
    }
    logger.warn('[ThemeLLM] MiniMax provider selected but MINIMAX_API_KEY not set, falling back to DeepSeek');
  }

  return { client: getDeepseekClient(), model: getDeepseekModel('flash'), provider: 'deepseek' };
}

/**
 * System Prompt (~800 tokens)
 * Defines theme structure, archetype usage, and good/bad patterns
 */
const SYSTEM_PROMPT = `你生成JoyJoin的盲盒主题 (mystery box themes) 活动主题,用于中国大陆的社交聚会。

# 主题结构

## 主题 (Main Theme)
- 12-18个中文字符
- 必须引人入胜、神秘
- 如果提供了原型,必须包含原型
- 使用能量描述词: 高能、超高能、温暖、沉静、平衡
- 创造期待感 (而不仅仅是描述)

## 副标题 (Subtitle)
- 15-25个中文字符
- 必须用具体元素来落地主题
- 如果提供了家乡,要包含老乡元素
- 包含兴趣/活动
- 平衡神秘感与清晰度

# 原型使用 (关键)

JoyJoin的12个原型 (必须在主题中使用):
- 高能量 (80-95): corgi、rooster、hamster_praise、fox
- 中能量 (60-79): dolphin_calm、spider、koala、octopus
- 低能量 (30-59): owl、elephant、turtle、cat

模式类型:
- 同质型: "柯基的快乐派对" (全是同一个原型)
- 互补型: "柯基×狐狸的能量碰撞" (2-3个原型)
- 多样型: "原型大聚会" (4+个原型)

能量词汇: 高能、超高能、温暖、沉静、平衡、活力、深度

# 好的模式 (必须遵循)

✅ "高能充电站：柯基×rooster的周末探险"
   主题: 原型 + 能量 + 活动
   副标题: "广州老乡的咖啡派对"

✅ "沉思者花园：猫头鹰的深夜书房"
   主题: 原型 + 氛围 + 场景
   副标题: "纯交友·阅读分享"

✅ "能量平衡实验室：狐狸点火×熊守护"
   主题: 原型动态
   副标题: "咖啡×美食双重享受"

# 坏的模式 (绝不生成)

❌ "广州老乡咖啡局" (太平淡,无原型,无神秘感)
❌ "周末美食探店团" (通用,可以是任何app)
❌ "精英人脉拓展会" (无聊,商务风)
❌ "年轻人的聚会" (模糊,无个性)
❌ "高学历专业人士交流" (精英主义,无温度)

# 输出格式 (仅JSON)
{
  "theme": "string (12-18字符, 原型主导)",
  "subtitle": "string (15-25字符, 落地)",
  "vibe": "string (emoji + 能量等级)",
  "emoji": "string (单个emoji)"
}`;

/**
 * Build user prompt (~500-600 tokens)
 */
function buildUserPrompt(input: ThemeLLMInput): string {
  const { 
    archetypeDynamics, 
    avgEnergy = 50, 
    pattern = 'complementary',
    additionalThemeElement,
    hometown,
    intent,
    interest,
    energyProfile,
    eventType,
    city,
    memberCount 
  } = input;
  
  let prompt = `为以下小组生成活动主题:\n\n`;
  
  // Theme elements (for main theme)
  prompt += `# 主题元素 (用于主题)\n`;
  if (archetypeDynamics) {
    prompt += `1. 原型: ${archetypeDynamics} (能量${avgEnergy}分)\n`;
    prompt += `   模式: ${pattern === 'homogeneous' ? '同质型' : pattern === 'complementary' ? '互补型' : '多样型'}\n`;
  }
  if (additionalThemeElement) {
    prompt += `2. ${additionalThemeElement}\n`;
  }
  
  // Grounding elements (for subtitle)
  prompt += `\n# 落地元素 (用于副标题)\n`;
  if (hometown) {
    prompt += `1. 家乡: ${hometown.count}人来自${hometown.city}\n`;
  }
  if (intent) {
    prompt += `2. 目的: ${intent.count}人${intent.intent}\n`;
  }
  if (interest) {
    prompt += `3. 兴趣: ${interest.count}人对${interest.name}很上头 (热度${interest.avgHeat}/25)\n`;
  }
  
  // Energy profile
  prompt += `\n# 小组能量画像\n`;
  prompt += `- 平均能量: ${avgEnergy}\n`;
  prompt += `- 分布: ${energyProfile.highCount}人高能, ${energyProfile.mediumCount}人温和, ${energyProfile.lowCount}人沉静\n`;
  prompt += `- 化学反应模式: ${energyProfile.pattern}\n`;
  
  // Context
  prompt += `\n# 背景信息\n`;
  prompt += `- 活动类型: ${eventType}\n`;
  prompt += `- 城市: ${city}\n`;
  prompt += `- 小组人数: ${memberCount}人\n`;
  
  prompt += `\n现在生成JSON:`;
  
  return prompt;
}

/**
 * Validate generated theme
 * Returns validation result with errors and warnings
 */
export function validateTheme(
  theme: any,
  input: ThemeLLMInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // CHECK 1: Structure
  if (!theme.theme || typeof theme.theme !== 'string') {
    errors.push('Missing or invalid theme field');
  }
  if (!theme.subtitle || typeof theme.subtitle !== 'string') {
    errors.push('Missing or invalid subtitle field');
  }
  if (!theme.vibe || typeof theme.vibe !== 'string') {
    errors.push('Missing or invalid vibe field');
  }
  if (!theme.emoji || typeof theme.emoji !== 'string') {
    errors.push('Missing or invalid emoji field');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  
  // CHECK 2: Character limits
  const themeLength = theme.theme.length;
  const subtitleLength = theme.subtitle.length;
  
  if (themeLength < 12 || themeLength > 18) {
    warnings.push(`Theme length ${themeLength} is outside recommended 12-18 characters`);
  }
  
  if (subtitleLength < 14 || subtitleLength > 25) {
    warnings.push(`Subtitle length ${subtitleLength} is outside recommended 14-25 characters`);
  }
  
  // CHECK 3: Archetype presence (CRITICAL)
  const ARCHETYPE_NAMES = [
    'corgi', 'rooster', 'hamster_praise', 'fox',
    'dolphin_calm', 'spider', 'koala', 'octopus',
    'owl', 'elephant', 'turtle', 'cat'
  ];
  
  // Short aliases for archetypes (used in themes)
  const ARCHETYPE_ALIASES = [
    '柯基', 'rooster', '豚', '狐狸', '狐',
    '海豚', '蛛', '熊', '章鱼',
    '猫头鹰', '大象', '龟', '猫'
  ];
  
  if (input.archetypeDynamics) {
    const hasArchetype = ARCHETYPE_NAMES.some(name => theme.theme.includes(name)) ||
                        ARCHETYPE_ALIASES.some(alias => theme.theme.includes(alias));
    if (!hasArchetype) {
      errors.push('Theme must include archetype name when archetype data exists');
    }
  }
  
  // CHECK 4: Energy alignment (NEW for themes)
  const avgEnergy = input.avgEnergy || 50;
  const lowEnergyTerms = ['沉静', '安静', '深度', '沉思'];
  const highEnergyTerms = ['高能', '活力', '爆发', '超高能'];
  
  const themeWithoutArchetypes = [...ARCHETYPE_NAMES, ...ARCHETYPE_ALIASES].reduce(
    (currentTheme, token) => currentTheme.replaceAll(token, ''),
    theme.theme
  );
  const hasLowEnergyTerms = lowEnergyTerms.some(term => themeWithoutArchetypes.includes(term));
  const hasHighEnergyTerms = highEnergyTerms.some(term => themeWithoutArchetypes.includes(term));
  
  if (avgEnergy > 80 && hasLowEnergyTerms && !hasHighEnergyTerms) {
    errors.push('Energy mismatch: high energy group (>80) but theme suggests low energy');
  }
  
  if (avgEnergy < 60 && hasHighEnergyTerms && !hasLowEnergyTerms) {
    errors.push('Energy mismatch: low energy group (<60) but theme suggests high energy');
  }
  
  // CHECK 5: Grounding in subtitle
  const hasHometown = input.hometown && theme.subtitle.includes(input.hometown.city);
  const hasIntent = input.intent && theme.subtitle.includes(input.intent.intent);
  const hasInterest = input.interest && theme.subtitle.includes(input.interest.name);
  
  if (!hasHometown && !hasIntent && !hasInterest) {
    warnings.push('Subtitle missing grounding elements (hometown/interest/intent)');
  }
  
  // CHECK 6: Generic detection
  const GENERIC_TERMS = [
    '周末聚会', '朋友聚餐', '美食探店', '咖啡交流会', '社交活动',
    '精英人脉', '高端社交', '专业交流'
  ];
  
  const hasGeneric = GENERIC_TERMS.some(term => 
    theme.theme.includes(term) || theme.subtitle.includes(term)
  );
  
  if (hasGeneric) {
    errors.push('Theme contains generic terms - must use JoyJoin archetype language');
  }
  
  // CHECK 7: Vibe format
  const VIBE_EMOJIS = ['🔥', '🌡️', '🌤️', '❄️', '🌙'];
  const hasVibeEmoji = VIBE_EMOJIS.some(emoji => theme.vibe.includes(emoji));
  
  if (!hasVibeEmoji) {
    warnings.push('Vibe should include emoji: 🔥 (fire), 🌡️ (warm), 🌤️ (mild), ❄️ (cold), 🌙 (quiet)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate theme using the hybrid AI provider (MiniMax or DeepSeek) with retry logic.
 * Max 3 attempts with fallback.
 */
export async function generateThemeWithLLM(
  input: ThemeLLMInput,
  maxAttempts: number = 3
): Promise<{
  theme: EventTheme;
  usedFallback: boolean;
  attempt: number;
  validationErrors: string[];
}> {
  const requestStartedAt = Date.now();
  const { client, model, provider } = getThemeAIClient();

  // Check if any AI key is available for the resolved provider
  if (!isProviderAvailable(provider)) {
    logger.warn('[ThemeLLM] No AI provider configured, using fallback');
    logAITrace({
      domain: 'theme_generation',
      feature: 'generateThemeLLM',
      provider: null,
      latencyMs: Date.now() - requestStartedAt,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: THEME_LLM_PROMPT_VERSION,
      errorCode: 'provider_unavailable',
    });
    return {
      theme: generateFallbackTheme(input),
      usedFallback: true,
      attempt: 0,
      validationErrors: [],
    };
  }
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const userPrompt = buildUserPrompt(input);
      
      logger.info(`[ThemeLLM] provider=${provider} attempt=${attempt} - Generating theme...`);
      const startTime = Date.now();
      
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const durationMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn(`[ThemeLLM] provider=${provider} attempt=${attempt} - No content in response (${durationMs}ms)`);
        if (attempt === maxAttempts) {
          logAITrace({
            domain: 'theme_generation',
            feature: 'generateThemeLLM',
            provider,
            model,
            latencyMs: Date.now() - requestStartedAt,
            success: false,
            fallbackUsed: true,
            fromCache: false,
            promptVersion: THEME_LLM_PROMPT_VERSION,
            errorCode: 'empty_response',
          });
          return {
            theme: generateFallbackTheme(input),
            usedFallback: true,
            attempt,
            validationErrors: ['Empty response from LLM'],
          };
        }
        continue;
      }
      
      const parsed = JSON.parse(content);
      
      // Validate
      const validation = validateTheme(parsed, input);
      
      if (validation.valid) {
        logger.info(`[ThemeLLM] provider=${provider} attempt=${attempt} latency=${durationMs}ms success=true`);
        logAITrace({
          domain: 'theme_generation',
          feature: 'generateThemeLLM',
          provider,
          model,
          latencyMs: Date.now() - requestStartedAt,
          success: true,
          fallbackUsed: false,
          fromCache: false,
          promptVersion: THEME_LLM_PROMPT_VERSION,
        });
        
        // Build full EventTheme with reasoning
        const fullTheme: EventTheme = {
          theme: parsed.theme,
          subtitle: parsed.subtitle,
          vibe: parsed.vibe,
          emoji: parsed.emoji,
          reasoning: buildReasoning(input),
          dataSources: buildDataSources(input),
        };
        
        return {
          theme: fullTheme,
          usedFallback: false,
          attempt,
          validationErrors: validation.warnings,
        };
      } else {
        logger.warn('Validation failed', { provider, attempt, errors: validation.errors });
        
        if (attempt === maxAttempts) {
          // Last attempt failed, use fallback
          logAITrace({
            domain: 'theme_generation',
            feature: 'generateThemeLLM',
            provider,
            model,
            latencyMs: Date.now() - requestStartedAt,
            success: false,
            fallbackUsed: true,
            fromCache: false,
            promptVersion: THEME_LLM_PROMPT_VERSION,
            errorCode: 'validation_failed',
          });
          return {
            theme: generateFallbackTheme(input),
            usedFallback: true,
            attempt,
            validationErrors: validation.errors,
          };
        }
        
        // Retry with stricter prompt
        // (could add validation feedback to prompt here)
      }
    } catch (error) {
      logger.error(`[ThemeLLM] provider=${provider} attempt=${attempt} - Error:`, { error: error instanceof Error ? error.message : String(error) });
      
      if (attempt === maxAttempts) {
        logAITrace({
          domain: 'theme_generation',
          feature: 'generateThemeLLM',
          provider,
          model,
          latencyMs: Date.now() - requestStartedAt,
          success: false,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: THEME_LLM_PROMPT_VERSION,
          errorCode: 'llm_error',
        });
        return {
          theme: generateFallbackTheme(input),
          usedFallback: true,
          attempt,
          validationErrors: ['LLM error: ' + String(error)],
        };
      }
    }
  }
  
  // Should not reach here, but return fallback just in case
  logAITrace({
    domain: 'theme_generation',
    feature: 'generateThemeLLM',
    provider,
    model,
    latencyMs: Date.now() - requestStartedAt,
    success: false,
    fallbackUsed: true,
    fromCache: false,
    promptVersion: THEME_LLM_PROMPT_VERSION,
    errorCode: 'max_attempts_reached',
  });
  return {
    theme: generateFallbackTheme(input),
    usedFallback: true,
    attempt: maxAttempts,
    validationErrors: ['Max attempts reached'],
  };
}

/**
 * Generate deterministic fallback theme
 */
function generateFallbackTheme(input: ThemeLLMInput): EventTheme {
  const avgEnergy = input.avgEnergy || 50;
  const energyLabel = getEnergyLabel(avgEnergy);
  const energyEmoji = getEnergyEmoji(avgEnergy);
  
  let theme = '';
  let subtitle = '';
  
  // Build theme
  if (input.archetypeDynamics) {
    const mainArchetype = input.archetypeDynamics.split('×')[0] || input.archetypeDynamics;
    theme = `${mainArchetype}的${energyLabel}聚会`;
  } else {
    theme = `${energyLabel}派对`;
  }
  
  // Build subtitle
  const parts: string[] = [];
  
  if (input.hometown) {
    parts.push(`${input.hometown.city}老乡`);
  }
  
  if (input.interest) {
    parts.push(`${input.interest.name}派对`);
  } else if (input.intent) {
    parts.push(input.intent.intent);
  }
  
  subtitle = parts.length > 0 ? parts.join('的') : `${input.city}的${energyLabel}聚会`;
  
  const vibe = `${energyEmoji} ${energyLabel} (${avgEnergy}分)`;
  
  return {
    theme,
    subtitle,
    vibe,
    emoji: energyEmoji,
    reasoning: '使用确定性回退模板生成 (Deterministic fallback)',
    dataSources: buildDataSources(input),
  };
}

/**
 * Build reasoning with data provenance
 */
function buildReasoning(input: ThemeLLMInput): string {
  const parts: string[] = ['主题整合:'];
  
  if (input.archetypeDynamics) {
    parts.push(`1. 原型化学反应: ${input.archetypeDynamics} (能量${input.avgEnergy}分)`);
  }
  
  if (input.hometown) {
    parts.push(`2. 同乡: ${input.hometown.count}人来自${input.hometown.city}`);
  }
  
  if (input.interest) {
    parts.push(`3. 强兴趣: ${input.interest.count}人对${input.interest.name}很上头 (热度${input.interest.avgHeat}/25)`);
  }
  
  if (input.intent) {
    parts.push(`4. 目的: ${input.intent.count}人来${input.intent.intent}`);
  }
  
  return parts.join('\n');
}

/**
 * Build data sources object
 */
function buildDataSources(input: ThemeLLMInput): EventTheme['dataSources'] {
  const sources: EventTheme['dataSources'] = {};
  
  if (input.archetypeDynamics) {
    sources.archetype = 'archetypeRegistry.ts';
  }
  
  if (input.hometown) {
    sources.hometown = `users.hometown_region_city (${input.hometown.city} x${input.hometown.count})`;
  }
  
  if (input.interest) {
    sources.interests = `user_interests.selections (${input.interest.name} heat>=${input.interest.avgHeat/25} x${input.interest.count}人)`;
  }
  
  if (input.intent) {
    sources.intent = `users.intent (${input.intent.intent} x${input.intent.count}人)`;
  }
  
  return sources;
}
