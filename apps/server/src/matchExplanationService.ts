// Cache persistence functions below use single UPDATE statements and are independent.
// No multi-statement transaction boundary is required for these best-effort writes.

/**
 * Match Explanation Service (桌友分析生成服务)
 * 
 * 通过 socialModelRouter 的混合路由（MiniMax 优先，DeepSeek 兜底）生成个性化匹配解释，
 * 说明为什么这些用户被匹配在一起。
 * 用于活动详情页的"桌友分析"部分。
 * 
 * 特性：
 * - 配对解释缓存（存储在 eventPoolGroups.pairExplanationsCache）
 * - 破冰话题缓存（存储在 eventPoolGroups.iceBreakersCache）
 * - 并发限制（最多3个并发API调用）
 * - 指数退避重试（最多2次重试）
 *
 * 模块拆分（行为保持不变）：
 * - ./matchExplanation/constants       配置常量与 prompt 版本
 * - ./matchExplanation/types           公共类型
 * - ./matchExplanation/concurrency     重试与并发控制
 * - ./matchExplanation/cache           缓存读写
 * - ./matchExplanation/connectionPoints 连接点/共同亮点提取
 * - ./matchExplanation/parsing         JSON 解析/抢救与归一化
 * - ./matchExplanation/promptBuilders  prompt 构建
 * - ./matchExplanation/fallbackCopy    降级文案
 * - ./matchExplanation/themeTags       主题标签与小组动态
 * - ./matchExplanation/metadata        provider 元数据归并
 * - ./matchExplanation/viewerPair      查看者配对辅助
 */

import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { recordProUsage } from './ai/deepseekBudgetTracker';
import { DEEPSEEK_V4_PRO } from '@joyjoin/shared';
import { getCalibratedChemistryScore } from './archetypeChemistryCalibration';
import { moderateGeneratedContent } from './lib/aiContentModeration';
import { logAITrace } from './lib/aiTraceLogger';
import { logger } from './lib/logger';
import { generateWithCraftQuality } from './lib/craftQualityGate';
import { validateCraft } from './lib/writingCraftValidator';
import { buildAIGCMeta, buildFallbackAIMeta, buildLiveAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import type { AIProvider } from '@shared/types/aiMeta';
import type { OverallChemistry } from '@shared/groupAnalysis';

import {
  API_CONFIG,
  GROUP_ANALYSIS_PROMPT_VERSION,
  GROUP_ICEBREAKERS_PROMPT_VERSION,
  PAIR_EXPLANATION_PROMPT_VERSION,
} from './matchExplanation/constants';
import type { MatchMember, MatchExplanation, GroupAnalysis } from './matchExplanation/types';
import { withRetry, runWithConcurrencyLimit } from './matchExplanation/concurrency';
import {
  loadCachedPairExplanations,
  savePairExplanationsCache,
  loadCachedIceBreakers,
  saveIceBreakersCache,
} from './matchExplanation/cache';
import {
  findSharedInterests,
  findConnectionPoints,
  findSharedSignalHighlights,
  formatDiscussionStyle,
  getPairKey,
} from './matchExplanation/connectionPoints';
import {
  normalizePairExplanationText,
  parsePairExplanationContent,
  DEFAULT_PAIR_EXPLANATION,
} from './matchExplanation/parsing';
import { buildPairExplanationPrompt, buildIceBreakersPrompt } from './matchExplanation/promptBuilders';
import { generateFallbackPairCopy, getFallbackIceBreakers } from './matchExplanation/fallbackCopy';
import {
  generateGroupThemeTags,
  generateGroupThemeCompanion,
  generateGroupDynamics,
} from './matchExplanation/themeTags';
import { mergeProviders, didComponentUseLLM } from './matchExplanation/metadata';
import { getPairExplanationForUser } from './matchExplanation/viewerPair';

// Re-export the stable public surface (unchanged import paths for consumers).
export type { MatchMember, MatchExplanation, GroupAnalysis } from './matchExplanation/types';
export { generateFallbackPairCopy } from './matchExplanation/fallbackCopy';
export { normalizePairExplanationText } from './matchExplanation/parsing';
export { getPairExplanationForUser } from './matchExplanation/viewerPair';

// ============ 生成结果类型 ============

interface PairExplanationGenerationResult {
  explanation: MatchExplanation;
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

interface BatchPairExplanationGenerationResult {
  explanations: MatchExplanation[];
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

interface IceBreakerGenerationResult {
  iceBreakers: string[];
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

// ============ 核心生成函数 ============

/**
 * 为一对用户生成匹配解释及其生成元数据。
 * Internal helper for group-level aggregation so the public
 * `generatePairExplanation()` API can stay focused on the explanation payload
 * while group analysis still captures provider/fallback observability.
 */
async function generatePairExplanationWithMetadata(
  member1: MatchMember,
  member2: MatchMember
): Promise<PairExplanationGenerationResult> {
  const chemistryScore = getCalibratedChemistryScore(member1.archetype || "koala", member2.archetype || "koala");
  const sharedInterests = findSharedInterests(member1.interestsTop, member2.interestsTop);
  const connectionPointsWithRarity = findConnectionPoints(member1, member2);
  const connectionPoints = connectionPointsWithRarity.map(cp => cp.text);
  const sharedHighlights = findSharedSignalHighlights(member1, member2, connectionPoints);

  // 构建提示词（结构化 JSON：主解释 + 开场角度）
  const prompt = buildPairExplanationPrompt(
    member1,
    member2,
    chemistryScore,
    sharedInterests,
    connectionPoints,
    sharedHighlights,
  );

  const { client, model, provider } = getClientForFunction('generatePairExplanation');
  const t0 = Date.now();
  try {
    const response = await withRetry(async () => {
      return client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 280,
        temperature: 0.7,
      });
    });
    if (response.model === DEEPSEEK_V4_PRO && response.usage) {
      recordProUsage({
        inputTokens: response.usage.prompt_tokens ?? 0,
        outputTokens: response.usage.completion_tokens ?? 0,
        feature: 'generatePairExplanation',
      });
    }
    const latencyMs = Date.now() - t0;
    logger.info(`[MatchExplanation] generatePairExplanation provider=${provider} latency=${latencyMs}ms`);
    logAITrace({
      domain: 'match_explanation',
      feature: 'generatePairExplanation',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    });

    const rawContent = response.choices[0]?.message?.content?.trim() || '';
    const parsed = parsePairExplanationContent(rawContent || DEFAULT_PAIR_EXPLANATION);

    // Craft quality diagnostic (non-blocking — prompt injection handles quality)
    const craftDiag = validateCraft(parsed.explanation, 'comment');
    if (craftDiag.craftScore < 55) {
      logger.info('[MatchExplanation] Craft score below threshold', {
        pairKey: getPairKey(member1.userId, member2.userId),
        craftScore: craftDiag.craftScore,
        issues: craftDiag.fixableIssues.length,
      });
    }

    // Post-generation content safety moderation before returning to users.
    const moderation = moderateGeneratedContent(
      [
        { field: 'explanation', text: parsed.explanation },
        { field: 'introAngle', text: parsed.introAngle },
      ],
      {
        domain: 'match_explanation',
        feature: 'generatePairExplanation',
        provider,
        model,
        latencyMs,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        enforceReviewVocab: true,
      }
    );

    if (!moderation.safe) {
      logger.warn('[MatchExplanation] Content safety moderation failed, using fallback pair copy', {
        pairKey: getPairKey(member1.userId, member2.userId),
        field: moderation.field,
      });
      const fb = generateFallbackPairCopy(chemistryScore, sharedInterests, connectionPoints);
      return {
        explanation: {
          pairKey: getPairKey(member1.userId, member2.userId),
          explanation: fb.explanation,
          chemistryScore,
          sharedInterests,
          connectionPoints,
          connectionPointsWithRarity,
          sharedHighlights,
          ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
        },
        providerUsed: null,
        fallbackUsed: true,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
      };
    }

    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation: parsed.explanation,
        chemistryScore,
        sharedInterests,
        connectionPoints,
        connectionPointsWithRarity,
        sharedHighlights,
        ...(parsed.introAngle ? { introAngle: parsed.introAngle } : {}),
      },
      providerUsed: provider,
      fallbackUsed: false,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    };
  } catch (primaryError) {
    if (provider === 'minimax') {
      logger.warn(`[MatchExplanation] generatePairExplanation minimax failed after retries, trying deepseek fallback:`, { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      const { client: fbClient, model: fbModel } = getDeepseekSelection();
      try {
        // Single attempt only — the primary path already exhausted its retries
        const fbResponse = await fbClient.chat.completions.create({
          model: fbModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 280,
          temperature: 0.7,
        });
        if (fbResponse.model === DEEPSEEK_V4_PRO && fbResponse.usage) {
          recordProUsage({
            inputTokens: fbResponse.usage.prompt_tokens ?? 0,
            outputTokens: fbResponse.usage.completion_tokens ?? 0,
            feature: 'generatePairExplanation_fallback',
          });
        }
        const latencyMs = Date.now() - t0;
        logger.info(`[MatchExplanation] generatePairExplanation provider=deepseek (fallback) latency=${latencyMs}ms`);
        logAITrace({
          domain: 'match_explanation',
          feature: 'generatePairExplanation',
          provider: 'deepseek',
          model: fbModel,
          latencyMs,
          success: true,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        });
        const fbRaw = fbResponse.choices[0]?.message?.content?.trim() || '';
        const fbParsed = parsePairExplanationContent(fbRaw || DEFAULT_PAIR_EXPLANATION);
        // Craft quality diagnostic
        const fbCraftDiag = validateCraft(fbParsed.explanation, 'comment');
        if (fbCraftDiag.craftScore < 55) {
          logger.info('[MatchExplanation] Craft score below threshold (fallback path)', {
            pairKey: getPairKey(member1.userId, member2.userId),
            craftScore: fbCraftDiag.craftScore,
          });
        }

        const fbModeration = moderateGeneratedContent(
          [
            { field: 'explanation', text: fbParsed.explanation },
            { field: 'introAngle', text: fbParsed.introAngle },
          ],
          {
            domain: 'match_explanation',
            feature: 'generatePairExplanation',
            provider: 'deepseek',
            model: fbModel,
            latencyMs: Date.now() - t0,
            promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
            enforceReviewVocab: true,
          }
        );

        if (!fbModeration.safe) {
          logger.warn('[MatchExplanation] Content safety moderation failed on deepseek fallback, using deterministic fallback', {
            pairKey: getPairKey(member1.userId, member2.userId),
            field: fbModeration.field,
          });
          const fb = generateFallbackPairCopy(chemistryScore, sharedInterests, connectionPoints);
          return {
            explanation: {
              pairKey: getPairKey(member1.userId, member2.userId),
              explanation: fb.explanation,
              chemistryScore,
              sharedInterests,
              connectionPoints,
              connectionPointsWithRarity,
              sharedHighlights,
              ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
            },
            providerUsed: null,
            fallbackUsed: true,
            promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
          };
        }

        return {
          explanation: {
            pairKey: getPairKey(member1.userId, member2.userId),
            explanation: fbParsed.explanation,
            chemistryScore,
            sharedInterests,
            connectionPoints,
            connectionPointsWithRarity,
            sharedHighlights,
            ...(fbParsed.introAngle ? { introAngle: fbParsed.introAngle } : {}),
          },
          providerUsed: 'deepseek',
          fallbackUsed: true,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        };
      } catch (fallbackError) {
        logger.error('[MatchExplanation] Error generating explanation after deepseek fallback:', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
        logAITrace({
          domain: 'match_explanation',
          feature: 'generatePairExplanation',
          provider: 'deepseek',
          model: fbModel,
          latencyMs: Date.now() - t0,
          success: false,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
          errorCode: 'deepseek_fallback_error',
        });
      }
    } else {
      logger.error('[MatchExplanation] Error generating explanation after retries:', { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      logAITrace({
        domain: 'match_explanation',
        feature: 'generatePairExplanation',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        errorCode: 'primary_retry_exhausted',
      });
    }
    // 降级处理：返回基于化学反应分数的模板解释
    const fb = generateFallbackPairCopy(chemistryScore, sharedInterests, connectionPoints);
    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation: fb.explanation,
        chemistryScore,
        sharedInterests,
        connectionPoints,
        connectionPointsWithRarity,
        sharedHighlights,
        ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
      },
      providerUsed: null,
      fallbackUsed: true,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    };
  }
}

/**
 * 生成所有配对的解释（不使用缓存），并汇总批次级别的元数据。
 * Returns the explanations plus aggregated provider/fallback state for the
 * full pair-explanation batch.
 */
async function generateFreshPairExplanations(members: MatchMember[]): Promise<BatchPairExplanationGenerationResult> {
  const pairs: Array<{ member1: MatchMember; member2: MatchMember }> = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push({ member1: members[i], member2: members[j] });
    }
  }
  
  const results = await runWithConcurrencyLimit(
    pairs,
    async (pair) => generatePairExplanationWithMetadata(pair.member1, pair.member2),
    API_CONFIG.CONCURRENCY_LIMIT
  );

  return {
    explanations: results.map((result) => result.explanation),
    providerUsed: mergeProviders(...results.map((result) => result.providerUsed)),
    fallbackUsed: results.some((result) => result.fallbackUsed),
    promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
  };
}

/**
 * 为一对用户生成匹配解释
 */
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember
): Promise<MatchExplanation> {
  const result = await generatePairExplanationWithMetadata(member1, member2);
  return result.explanation;
}

/**
 * 为整个小组生成分析报告
 */
export async function generateGroupAnalysis(
  groupId: string,
  members: MatchMember[],
  eventType: string = "饭局",
  useCache: boolean = true
): Promise<GroupAnalysis & { fromCache: boolean; generatedAt: string; provider: AIProvider; fallbackUsed: boolean; promptVersion: string }> {
  const startedAt = Date.now();
  let pairExplanations: MatchExplanation[] = [];
  let iceBreakers: string[] = [];
  let fromCache = false;
  let cacheGeneratedAt: string | undefined;
  // Normalized metadata fields (aligned with AIResponseMeta)
  let provider: AIProvider = null;
  let fallbackUsed = false;
  let promptVersion = GROUP_ANALYSIS_PROMPT_VERSION;
  let llmOutputUsed = false;
  
  // Try to load from cache first (with roster validation)
  if (useCache) {
    // Parallelize cache loading for better performance
    const [cachedExplanations, cachedIceBreakers] = await Promise.all([
      loadCachedPairExplanations(groupId, members),
      loadCachedIceBreakers(groupId, members, eventType)
    ]);
    
    if (cachedExplanations && cachedIceBreakers) {
      logger.info(`[MatchExplanation] Using cached data for group ${groupId}`);
      pairExplanations = cachedExplanations.explanations;
      cacheGeneratedAt = cachedExplanations.generatedAt;
      iceBreakers = cachedIceBreakers.topics;
      fromCache = true;
      provider = mergeProviders(cachedExplanations.provider, cachedIceBreakers.provider);
      fallbackUsed = cachedExplanations.fallbackUsed || cachedIceBreakers.fallbackUsed;
      llmOutputUsed =
        didComponentUseLLM(cachedExplanations) ||
        didComponentUseLLM(cachedIceBreakers);
    } else {
      // Cache miss, expired, or roster changed - regenerate in parallel
      const [pairExplanationResult, iceBreakerResult] = await Promise.all([
        generateFreshPairExplanations(members),
        generateIceBreakers(members, eventType)
      ]);
      pairExplanations = pairExplanationResult.explanations;
      iceBreakers = iceBreakerResult.iceBreakers;
      provider = mergeProviders(pairExplanationResult.providerUsed, iceBreakerResult.providerUsed);
      fallbackUsed = pairExplanationResult.fallbackUsed || iceBreakerResult.fallbackUsed;
      llmOutputUsed =
        didComponentUseLLM({
          provider: pairExplanationResult.providerUsed,
          fallbackUsed: pairExplanationResult.fallbackUsed,
        }) ||
        didComponentUseLLM({
          provider: iceBreakerResult.providerUsed,
          fallbackUsed: iceBreakerResult.fallbackUsed,
        });
      
      // Save to cache with roster metadata (fire and forget with error handling)
      savePairExplanationsCache(groupId, members, pairExplanations, {
        provider: pairExplanationResult.providerUsed,
        fallbackUsed: pairExplanationResult.fallbackUsed,
        promptVersion: pairExplanationResult.promptVersion,
      }).catch((err) => {
        logger.error('[MatchExplanation] Failed to save pair explanations cache:', { error: err instanceof Error ? err.message : String(err) });
      });
      saveIceBreakersCache(groupId, members, eventType, iceBreakers, {
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
        promptVersion: iceBreakerResult.promptVersion,
      }).catch((err) => {
        logger.error('[MatchExplanation] Failed to save ice breakers cache:', { error: err instanceof Error ? err.message : String(err) });
      });
    }
  } else {
    // No cache requested - generate fresh in parallel
    const [pairExplanationResult, iceBreakerResult] = await Promise.all([
      generateFreshPairExplanations(members),
      generateIceBreakers(members, eventType)
    ]);
    pairExplanations = pairExplanationResult.explanations;
    iceBreakers = iceBreakerResult.iceBreakers;
    provider = mergeProviders(pairExplanationResult.providerUsed, iceBreakerResult.providerUsed);
    fallbackUsed = pairExplanationResult.fallbackUsed || iceBreakerResult.fallbackUsed;
    llmOutputUsed =
      didComponentUseLLM({
        provider: pairExplanationResult.providerUsed,
        fallbackUsed: pairExplanationResult.fallbackUsed,
      }) ||
      didComponentUseLLM({
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
      });
  }

  logAITrace({
    domain: 'match_explanation',
    feature: 'generateGroupAnalysis',
    provider,
    latencyMs: Date.now() - startedAt,
    success: llmOutputUsed,
    fallbackUsed,
    fromCache,
    promptVersion,
  });
  
  // 计算整体化学反应
  const totalChemistry = pairExplanations.reduce((sum, exp) => sum + exp.chemistryScore, 0);
  const pairCount = pairExplanations.length;
  const avgChemistry = pairCount > 0 ? totalChemistry / pairCount : 50;

  // 确定化学反应等级
  let overallChemistry: OverallChemistry;
  if (avgChemistry >= 85) overallChemistry = 'fire';
  else if (avgChemistry >= 70) overallChemistry = 'warm';
  else if (avgChemistry >= 55) overallChemistry = 'mild';
  else overallChemistry = 'cold';

  // 生成小组动态描述
  const groupDynamics = generateGroupDynamics(members, avgChemistry, eventType);

  // 生成主题标签和伴随说明（确定性生成，无需LLM调用）
  const groupThemeTags = generateGroupThemeTags(members, overallChemistry, eventType);
  const groupThemeCompanion = generateGroupThemeCompanion(members, overallChemistry, eventType);

  // Final post-generation safety check — also defends against stale cache content
  // that may not have been moderated by earlier code versions.
  // Serve-path normalization: guarantee plain-text explanations for every
  // consumer, including legacy cached rows persisted before the persist fix.
  let pairExplanationsSafe: MatchExplanation[] = pairExplanations.map((exp) => ({
    ...exp,
    explanation: normalizePairExplanationText(exp.explanation),
    ...(exp.introAngle ? { introAngle: normalizePairExplanationText(exp.introAngle) } : {}),
  }));
  let iceBreakersSafe = iceBreakers;
  let anyModerationFailure = false;

  for (let i = 0; i < pairExplanationsSafe.length; i++) {
    const exp = pairExplanationsSafe[i];
    const moderation = moderateGeneratedContent(
      [
        { field: `pair_${i}_explanation`, text: exp.explanation },
        { field: `pair_${i}_introAngle`, text: exp.introAngle },
      ],
      {
        domain: 'match_explanation',
        feature: 'generateGroupAnalysis',
        provider,
        latencyMs: Date.now() - startedAt,
        promptVersion,
        enforceReviewVocab: true,
      }
    );
    if (!moderation.safe) {
      anyModerationFailure = true;
      const fb = generateFallbackPairCopy(exp.chemistryScore, exp.sharedInterests, exp.connectionPoints);
      pairExplanationsSafe[i] = {
        ...exp,
        explanation: fb.explanation,
        introAngle: fb.introAngle,
      };
    }
  }

  const iceBreakerModeration = moderateGeneratedContent(
    iceBreakersSafe.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
    {
      domain: 'match_explanation',
      feature: 'generateGroupAnalysis',
      provider,
      latencyMs: Date.now() - startedAt,
      promptVersion,
      enforceReviewVocab: true,
    }
  );
  if (!iceBreakerModeration.safe) {
    anyModerationFailure = true;
    const interestCounts = new Map<string, number>();
    members.forEach(m => {
      (m.interestsTop || []).forEach(i => {
        interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
      });
    });
    const commonInterests = Array.from(interestCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([interest]) => interest)
      .slice(0, 3);
    iceBreakersSafe = getFallbackIceBreakers(eventType, commonInterests);
  }

  if (anyModerationFailure) {
    fallbackUsed = true;
    logger.warn('[MatchExplanation] Final group-analysis moderation failed for some components; using deterministic fallback for those components');
  }

  const generatedAt = fromCache && cacheGeneratedAt ? cacheGeneratedAt : new Date().toISOString();

  return {
    groupId,
    overallChemistry,
    groupDynamics,
    pairExplanations: pairExplanationsSafe,
    iceBreakers: iceBreakersSafe,
    groupThemeTags,
    groupThemeCompanion,
    fromCache,
    generatedAt,
    provider,
    fallbackUsed,
    promptVersion,
    meta: {
      generatedAt,
      fromCache,
      provider,
      fallbackUsed,
      promptVersion,
      aigc: buildAIGCMeta({ fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

/**
 * 生成个性化破冰话题
 * Returns both the ice-breaker topics and a flag indicating whether
 * deterministic fallback content was used (i.e. all LLM calls failed).
 */
export async function generateIceBreakers(
  members: MatchMember[],
  eventType: string = "饭局"
): Promise<IceBreakerGenerationResult> {
  // 收集共同兴趣
  const allInterests: string[] = [];
  members.forEach(m => {
    if (m.interestsTop) allInterests.push(...m.interestsTop);
  });
  
  // 统计兴趣频率
  const interestCounts = new Map<string, number>();
  allInterests.forEach(i => {
    interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
  });
  
  // 找出共同兴趣（至少2人有）
  const commonInterests = Array.from(interestCounts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([interest, _]) => interest)
    .slice(0, 3);
  
  // 收集原型信息
  const archetypes = members.map(m => m.archetype).filter(Boolean);

  // Collect aligned interest signals (same interest key shared by ≥2 members)
  const signalKeyCount = new Map<string, { label: string; styles: string[]; depths: number[] }>();
  members.forEach(m => {
    (m.interestSignals || []).forEach(sig => {
      const entry = signalKeyCount.get(sig.interestKey) ?? { label: sig.interestLabel, styles: [], depths: [] };
      entry.styles.push(sig.discussionStyle);
      entry.depths.push(sig.conversationDepth);
      signalKeyCount.set(sig.interestKey, entry);
    });
  });
  const sharedSignals = Array.from(signalKeyCount.entries())
    .filter(([_, v]) => v.styles.length >= 2)
    .map(([key, v]) => {
      const styleCounts = new Map<string, number>();
      v.styles.forEach(s => styleCounts.set(s, (styleCounts.get(s) || 0) + 1));
      const dominantStyle = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const avgDepth = Math.round(v.depths.reduce((a, c) => a + c, 0) / v.depths.length);
      return `${v.label}（${formatDiscussionStyle(dominantStyle)}，深度${avgDepth}/3）`;
    })
    .slice(0, 3);
  
  const prompt = buildIceBreakersPrompt(eventType, archetypes, commonInterests, sharedSignals);

  const { client, model, provider } = getClientForFunction('generateIceBreakers');
  const t0 = Date.now();
  try {
    const response = await withRetry(async () => {
      return client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      });
    });
    const latencyMs = Date.now() - t0;
    logger.info(`[IceBreakers] generateIceBreakers provider=${provider} latency=${latencyMs}ms`);
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateIceBreakers',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
    });
    
    const content = response.choices[0]?.message?.content?.trim() || '';
    const iceBreakers = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.length < 100)
      .slice(0, 5);
    
    if (iceBreakers.length >= 2) { // Lowered threshold from 3 to 2
      const moderation = moderateGeneratedContent(
        iceBreakers.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
        {
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider,
          model,
          latencyMs,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          enforceReviewVocab: true,
        }
      );

      if (!moderation.safe) {
        logger.warn('[IceBreakers] Content safety moderation failed, using fallback topics', {
          field: moderation.field,
        });
        return {
          iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
          providerUsed: null,
          fallbackUsed: true,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        };
      }

      return {
        iceBreakers,
        providerUsed: provider,
        fallbackUsed: false,
        promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
      };
    }
  } catch (primaryError) {
    if (provider === 'minimax') {
      logger.warn(`[IceBreakers] generateIceBreakers minimax failed after retries, trying deepseek fallback:`, { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      const { client: fbClient, model: fbModel } = getDeepseekSelection();
      try {
        // Single attempt only — the primary path already exhausted its retries
        const fbResponse = await fbClient.chat.completions.create({
          model: fbModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.8,
        });
        const latencyMs = Date.now() - t0;
        logger.info(`[IceBreakers] generateIceBreakers provider=deepseek (fallback) latency=${latencyMs}ms`);
        logAITrace({
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider: 'deepseek',
          model: fbModel,
          latencyMs,
          success: true,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        });
        const content = fbResponse.choices[0]?.message?.content?.trim() || '';
        const iceBreakers = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 5 && line.length < 100)
          .slice(0, 5);
        if (iceBreakers.length >= 2) {
          const moderation = moderateGeneratedContent(
            iceBreakers.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
            {
              domain: 'match_explanation',
              feature: 'generateIceBreakers',
              provider: 'deepseek',
              model: fbModel,
              latencyMs: Date.now() - t0,
              promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
              enforceReviewVocab: true,
            }
          );

          if (!moderation.safe) {
            logger.warn('[IceBreakers] Content safety moderation failed on deepseek fallback, using fallback topics', {
              field: moderation.field,
            });
            return {
              iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
              providerUsed: null,
              fallbackUsed: true,
              promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
            };
          }

          return {
            iceBreakers,
            providerUsed: 'deepseek',
            fallbackUsed: true,
            promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          };
        }
      } catch (fallbackError) {
        logger.error('[IceBreakers] Error generating ice-breakers after deepseek fallback:', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
        logAITrace({
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider: 'deepseek',
          model: fbModel,
          latencyMs: Date.now() - t0,
          success: false,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          errorCode: 'deepseek_fallback_error',
        });
      }
    } else {
      logger.error('[IceBreakers] Error generating ice-breakers after retries:', { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      logAITrace({
        domain: 'match_explanation',
        feature: 'generateIceBreakers',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        errorCode: 'primary_retry_exhausted',
      });
    }
  }
  
  // 降级：返回预设话题
  return {
    iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
    providerUsed: null,
    fallbackUsed: true,
    promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
  };
}

// ============ 导出 ============

export const matchExplanationService = {
  generatePairExplanation,
  generateGroupAnalysis,
  generateIceBreakers,
  findSharedInterests,
  findConnectionPoints,
  findSharedSignalHighlights,
  getPairExplanationForUser,
  normalizePairExplanationText,
};
