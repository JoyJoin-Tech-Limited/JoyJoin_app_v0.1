/**
 * Social AI model router — Phase 2 hybrid rollout + DeepSeek V4 tier support
 *
 * Routes social-experience AI calls to MiniMax when configured, falling
 * back to DeepSeek for resilience.  All caller code should go through
 * `callSocialAI` or `getClientForFunction` instead of instantiating
 * provider clients directly.
 *
 * DeepSeek V4 migration:
 *   - Three model tiers: flash (default), flash-thinking, pro-thinking
 *   - Deprecated `deepseek-chat` alias replaced with explicit `deepseek-v4-flash`
 *   - Thinking mode is enabled via extra_body per DeepSeek API spec
 *
 * Services routed through this file:
 *   - socialIcebreakerAIService.ts  (warmup topics, XiaoYue, recap, lie detective, miniscript framework)
 *   - matchExplanationService.ts    (pair explanations, icebreakers)
 *   - inference/hybridSemantic.ts   (semantic attribute analysis)
 *
 * Provider priority:
 *   1. MiniMax  (if MINIMAX_API_KEY is set)
 *   2. DeepSeek (always available as fallback)
 */

import OpenAI from 'openai';
import {
  type DeepSeekModelTier,
  buildThinkingExtraBody,
} from '@joyjoin/shared';
import { getDeepseekClient, getDeepseekModel } from './deepseekClient';
import {
  getMinimaxModel,
  getMinimaxClient,
  MINIMAX_DEFAULT_MODEL,
  isMinimaxEnabled,
} from './minimaxClient';
import { logger } from '../lib/logger';
import { isProBudgetAvailable } from './deepseekBudgetTracker';

// ---------------------------------------------------------------------------
// Model tier configuration
// ---------------------------------------------------------------------------

/**
 * Environment overrides for DeepSeek model selection.
 */
const ENABLE_PRO_MATCH_EXPLANATIONS =
  process.env.ENABLE_PRO_MATCH_EXPLANATIONS === 'true';

// ---------------------------------------------------------------------------
// Social functions routed through the explicit registry.
// ---------------------------------------------------------------------------

type SocialFunction =
  | 'generateWarmupTopics'
  | 'generateXiaoYueComment'
  | 'generateRecapSummary'
  | 'generateLieDetectiveStatements'
  | 'generateMicroChallenges'
  | 'generatePersonalityDiceChallenges'
  | 'generateAuctionLots'
  | 'generateXiaoyueSessionPack'
  | 'generateProfileTagline'
  | 'generateConversationTopics'
  | 'generateWelcomeMessage'
  | 'generateClosingMessage'
  | 'generatePairExplanation'       // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'generateIceBreakers'           // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'analyzeComplexSemantics'      // hybridSemantic — DeepSeek default (structured JSON inference)
  | 'generateMiniScriptFramework' // MiniScript story framework JSON (MiniMax-first; DeepSeek json_object fallback)
  | 'generatePoolCardHeadline'    // pool card AI headline — MiniMax preferred (warm creative copy)
  | 'generateQuipBattlePrompts'   // quip battle prompts — creative fill-in-the-blank (flash, fallback-rich)
  | 'generateUndercoverWordPair'   // undercover word pair generation
  | 'generateGroupMirrorQuestions'; // group mirror question generation

type SocialFunctionRoutingPolicy = {
  preferredProvider: 'minimax' | 'deepseek';
  forceProvider?: 'deepseek';
  /** DeepSeek model tier when DeepSeek is selected. Default: 'flash' */
  deepseekTier?: DeepSeekModelTier;
  /**
   * Override the default reasoning_effort for thinking tiers.
   *   'high'  — standard reasoning depth (default, lower latency/cost)
   *   'max'   — maximum reasoning depth for tasks where accuracy is
   *             critical and latency/cost are acceptable trade-offs.
   * When omitted, the tier default ('high') is used.
   */
  reasoningEffort?: 'high' | 'max';
};

/**
 * Reasoning-effort assignment framework
 *
 * Tier 0 — Flash (no thinking): real-time chat, creative generation,
 *   anything with rich fallbacks. Fastest, cheapest.
 * Tier 1 — Flash-thinking + high: structured output, medium-stakes.
 *   Default for thinking-tier features.
 * Tier 2 — Flash-thinking + max: complex analysis, validation,
 *   zero-tolerance accuracy. Higher latency/cost.
 * Tier 3 — Pro-thinking + max: highest-stakes user-facing content.
 *   Budget-gated.
 */
const SOCIAL_FUNCTION_ROUTING: Record<SocialFunction, SocialFunctionRoutingPolicy> = {
  // ── Tier 0: Flash, no thinking — real-time / creative / fallback-rich ──
  generateWarmupTopics: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateXiaoYueComment: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateRecapSummary: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateLieDetectiveStatements: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateMicroChallenges: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generatePersonalityDiceChallenges: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateAuctionLots: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateXiaoyueSessionPack: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateProfileTagline: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateConversationTopics: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateWelcomeMessage: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateClosingMessage: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateIceBreakers: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateMiniScriptFramework: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generatePoolCardHeadline: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateQuipBattlePrompts: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateUndercoverWordPair: { preferredProvider: 'minimax', deepseekTier: 'flash' },
  generateGroupMirrorQuestions: { preferredProvider: 'minimax', deepseekTier: 'flash' },

  // ── Tier 2: Flash-thinking + max — complex analysis, validation ──
  analyzeComplexSemantics: {
    preferredProvider: 'deepseek',
    forceProvider: 'deepseek',
    deepseekTier: 'flash-thinking',
    reasoningEffort: 'max',
  },

  // ── Tier 3: Pro-thinking + max — highest-stakes, budget-gated ──
  generatePairExplanation: {
    preferredProvider: 'minimax',
    deepseekTier: ENABLE_PRO_MATCH_EXPLANATIONS ? 'pro-thinking' : 'flash-thinking',
    reasoningEffort: 'max',
  },
};

/** Global fallback for reasoning_effort on all thinking-tier calls. */
const DEFAULT_REASONING_EFFORT: 'high' | 'max' | undefined =
  process.env.SOCIAL_DEFAULT_REASONING_EFFORT === 'max' ? 'max' :
  process.env.SOCIAL_DEFAULT_REASONING_EFFORT === 'high' ? 'high' :
  undefined;

export type RoutedSocialFunction = Exclude<SocialFunction, 'analyzeComplexSemantics'>;

type ProviderMode = 'hybrid' | 'deepseek' | 'minimax';

function resolveMode(): ProviderMode {
  const raw = process.env.SOCIAL_AI_PROVIDER;
  if (!raw || raw === 'hybrid') return 'hybrid';
  if (raw === 'deepseek') return 'deepseek';
  if (raw === 'minimax') return 'minimax';
  logger.warn('Unrecognized SOCIAL_AI_PROVIDER, defaulting to hybrid', { service: 'socialAI', envVar: 'SOCIAL_AI_PROVIDER', value: raw });
  return 'hybrid';
}

export interface ClientSelection {
  client: OpenAI;
  model: string;
  provider: 'minimax' | 'deepseek';
  /** DeepSeek thinking configuration to pass via extra_body */
  thinkingExtraBody?: { thinking?: { type: 'enabled' }; reasoning_effort?: 'high' | 'max' };
  /** The reasoning effort level that was resolved for this selection */
  reasoningEffort?: 'high' | 'max';
}

/**
 * Returns the appropriate AI client, model, and provider for a given social function.
 * Respects SOCIAL_AI_PROVIDER env var (hybrid | minimax | deepseek) with automatic
 * fallback to DeepSeek when MiniMax is not configured.
 *
 * Functions with `forceProvider: 'deepseek'` (currently `analyzeComplexSemantics`)
 * always receive a DeepSeek selection regardless of the configured mode — they rely on
 * DeepSeek-specific API features (e.g. response_format: json_object).
 */
export function getClientForFunction(fn: SocialFunction): ClientSelection {
  const policy = SOCIAL_FUNCTION_ROUTING[fn];

  // Forced-DeepSeek functions bypass all provider mode logic
  if (policy.forceProvider === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        `[socialAI] ${fn} requires DeepSeek (response_format: json_object) but DEEPSEEK_API_KEY is not set`
      );
    }
    return getDeepseekSelection(policy.deepseekTier, policy.reasoningEffort);
  }

  const mode = resolveMode();
  // Use getMinimaxClient() (evaluated on every call) rather than the module-load-time
  // constant so that env changes between module import and actual invocation are respected.
  const mmClient = getMinimaxClient();

  if (mode === 'deepseek') {
    return getDeepseekSelection(policy.deepseekTier, policy.reasoningEffort);
  }

  if (mode === 'minimax') {
    if (!mmClient) {
      logger.warn('MINIMAX_API_KEY is not set, falling back to deepseek', { service: 'socialAI', envVar: 'SOCIAL_AI_PROVIDER', value: 'minimax' });
      return getDeepseekSelection(policy.deepseekTier, policy.reasoningEffort);
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  // hybrid mode (default)
  if (policy.preferredProvider === 'minimax') {
    if (!mmClient) {
      logger.warn('MINIMAX_API_KEY is not set, falling back to deepseek', { service: 'socialAI', function: fn });
      return getDeepseekSelection(policy.deepseekTier, policy.reasoningEffort);
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  return getDeepseekSelection(policy.deepseekTier, policy.reasoningEffort);
}

/**
 * Returns a DeepSeek client selection unconditionally.
 * Used by callers that need an explicit DeepSeek fallback path when their
 * primary provider (MiniMax) has already failed.
 */
export function getDeepseekSelection(
  tier: DeepSeekModelTier = 'flash',
  reasoningEffort?: 'high' | 'max',
): ClientSelection {
  // Budget guard: downgrade pro-thinking to flash when daily Pro budget is exceeded
  let effectiveTier = tier;
  if (tier === 'pro-thinking' && !isProBudgetAvailable()) {
    logger.warn(
      'DeepSeek Pro daily budget exceeded — downgrading pro-thinking to flash',
      { requestedTier: tier, downgradedTo: 'flash' },
    );
    effectiveTier = 'flash';
  }

  const resolvedEffort = reasoningEffort ?? DEFAULT_REASONING_EFFORT;

  return {
    client: getDeepseekClient(),
    model: getDeepseekModel(effectiveTier),
    provider: 'deepseek',
    thinkingExtraBody: buildThinkingExtraBody(effectiveTier, resolvedEffort),
    reasoningEffort: resolvedEffort,
  };
}

export interface SocialAICallParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  /** Tag shown in logs (e.g. 'conversationTopics', 'welcomeMessage') */
  callerTag: string;
  /** Explicit routed social function key for function-level provider selection. */
  socialFunction?: RoutedSocialFunction;
  /**
   * Override the model name returned by the router.
   * Used by benchmark/evaluation harnesses to test alternative models
   * (e.g. minimax-m2.7-highspeed) without changing global env vars.
   */
  modelOverride?: string;
}

export interface SocialAICallResult {
  content: string;
  provider: 'minimax' | 'deepseek';
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  /** DeepSeek reasoning content when thinking mode is enabled */
  reasoningContent?: string;
}

/**
 * Calls the preferred social AI provider and returns the response text.
 * Automatically falls back to DeepSeek if MiniMax is unavailable or fails.
 */
export async function callSocialAI(
  params: SocialAICallParams
): Promise<SocialAICallResult> {
  const { messages, temperature = 0.8, max_tokens = 600, callerTag, socialFunction } = params;
  const overallStartedAt = Date.now();
  const routedSelection = socialFunction ? getClientForFunction(socialFunction) : null;
  const routedMode = socialFunction ? resolveMode() : null;
  const preCallFallbackUsed = Boolean(
    socialFunction &&
      routedMode !== 'deepseek' &&
      SOCIAL_FUNCTION_ROUTING[socialFunction].preferredProvider === 'minimax' &&
      routedSelection?.provider === 'deepseek'
  );
  let attemptedMinimax = false;

  if (routedSelection?.provider === 'minimax' || (!routedSelection && isMinimaxEnabled())) {
    attemptedMinimax = true;
    const minimaxSelection = routedSelection?.provider === 'minimax'
      ? routedSelection
      : {
          client: getMinimaxClient()!,
          model: MINIMAX_DEFAULT_MODEL,
          provider: 'minimax' as const,
        };
    const modelName = params.modelOverride ?? minimaxSelection.model;
    const start = Date.now();
    try {
      const response = await minimaxSelection.client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens,
      });
      const providerLatencyMs = Date.now() - start;
      const content = response.choices[0]?.message?.content ?? '';
      logger.info('MiniMax call completed', { service: 'socialAI', callerTag, provider: 'minimax', latencyMs: providerLatencyMs });
      return {
        content,
        provider: 'minimax',
        model: modelName,
        latencyMs: Date.now() - overallStartedAt,
        fallbackUsed: false,
      };
    } catch (err) {
      const providerLatencyMs = Date.now() - start;
      logger.warn(
        'minimax failed, falling back to deepseek',
        { service: 'socialAI', callerTag, provider: 'minimax', latencyMs: providerLatencyMs, error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  // DeepSeek fallback
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error(
      `[socialAI] ${callerTag}: MiniMax unavailable and DEEPSEEK_API_KEY is not set — cannot complete request`
    );
  }
  const deepseekSelection = routedSelection?.provider === 'deepseek'
    ? routedSelection
    : getDeepseekSelection();
  const modelName = params.modelOverride ?? deepseekSelection.model;
  const start = Date.now();

  // Build request payload; merge thinking extra_body when applicable
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParams = {
    model: modelName,
    messages,
    temperature,
    max_tokens,
  };

  if (deepseekSelection.thinkingExtraBody) {
    // @ts-expect-error - DeepSeek-specific extension via extra_body
    requestPayload.extra_body = deepseekSelection.thinkingExtraBody;
  }

  const response = await deepseekSelection.client.chat.completions.create(requestPayload);
  const providerLatencyMs = Date.now() - start;
  const message = response.choices[0]?.message;
  const content = message?.content ?? '';
  // DeepSeek thinking mode returns reasoning_content on the message object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reasoningContent = (message as any)?.reasoning_content ?? undefined;

  logger.info('DeepSeek call completed', { service: 'socialAI', callerTag, provider: 'deepseek', model: modelName, latencyMs: providerLatencyMs });
  return {
    content,
    provider: 'deepseek',
    model: modelName,
    latencyMs: Date.now() - overallStartedAt,
    fallbackUsed: attemptedMinimax || preCallFallbackUsed,
    reasoningContent: reasoningContent || undefined,
  };
}
