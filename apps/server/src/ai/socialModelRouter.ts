/**
 * Social AI model router — DeepSeek V4 primary with MiniMax fallback
 *
 * Routes social-experience AI calls to DeepSeek V4 by default, with
 * per-function thinking-tier assignments (flash / flash-thinking / pro-thinking).
 * All caller code should go through `callSocialAI` or `getClientForFunction`
 * instead of instantiating provider clients directly.
 *
 * DeepSeek V4 tiers:
 *   - flash (thinking disabled):       real-time comments, structured JSON, fast
 *   - flash-thinking (high/max):       genuinely analytical tasks only
 *   - pro-thinking (max):              highest-stakes, budget-gated
 *
 * Note (2026-08-11): DeepSeek V4 reasons by default when no thinking control is
 * sent, and thinking burns the completion budget (verified: empty content at
 * production max_tokens budgets, 11-15s latency > 6s icebreaker bound). The
 * client wrapper in deepseekClient.ts injects `thinking: {type:'disabled'}`
 * unless a call already carries explicit thinking control.
 *
 * Services routed through this file:
 *   - socialIcebreakerAIService.ts  (warmup topics, XiaoYue, recap, lie detective, miniscript framework)
 *   - matchExplanationService.ts    (pair explanations, icebreakers)
 *   - inference/hybridSemantic.ts   (semantic attribute analysis)
 *
 * Provider priority:
 *   1. DeepSeek (primary — all functions route here by default)
 *   2. MiniMax  (available as env-controlled override via SOCIAL_AI_PROVIDER=minimax)
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
  | 'generateXiaoyueAdaptiveSuggestion'
  | 'generateMomentHighlights'
  | 'generateRecapSummary'
  | 'generateLieDetectiveStatements'
  | 'generateMicroChallenges'
  | 'generatePersonalityDiceChallenges'
  | 'generatePersonalityDiceChallengeGroups'
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
 * DeepSeek V4 models reason by default when no thinking control is sent, and
 * with `thinking: enabled` they can burn 1000+ completion tokens on
 * `reasoning_content` for structured-output tasks — exceeding production
 * `max_tokens` budgets and the 6s icebreaker call bound, which yields empty or
 * truncated `message.content` (benchmark-verified 2026-08-11). Thinking is
 * therefore opt-in and reserved for genuinely analytical functions:
 *
 * Tier 0 — Flash (thinking disabled): real-time chat, JSON formatting,
 *   creative generation, anything with rich fallbacks. Fastest, cheapest.
 *   This is the default for every structured-JSON surface.
 * Tier 1 — Flash-thinking + high: structured JSON output, medium-stakes
 *   (only when a task genuinely needs multi-step reasoning).
 * Tier 2 — Flash-thinking + max: complex analysis, validation,
 *   zero-tolerance accuracy. Higher latency/cost.
 * Tier 3 — Pro-thinking + max: highest-stakes user-facing content.
 *   Budget-gated.
 */
const SOCIAL_FUNCTION_ROUTING: Record<SocialFunction, SocialFunctionRoutingPolicy> = {
  // ── Tier 0: Flash, thinking disabled — real-time comments / JSON formatting / fast ──
  generateXiaoYueComment: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateXiaoyueAdaptiveSuggestion: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateMomentHighlights: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateRecapSummary: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateWelcomeMessage: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateClosingMessage: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateProfileTagline: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generatePoolCardHeadline: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateConversationTopics: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateWarmupTopics: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateMicroChallenges: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateLieDetectiveStatements: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generatePersonalityDiceChallenges: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generatePersonalityDiceChallengeGroups: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateAuctionLots: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateXiaoyueSessionPack: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateIceBreakers: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateMiniScriptFramework: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateQuipBattlePrompts: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateUndercoverWordPair: { preferredProvider: 'deepseek', deepseekTier: 'flash' },
  generateGroupMirrorQuestions: { preferredProvider: 'deepseek', deepseekTier: 'flash' },

  // ── Tier 1: Flash-thinking + high — reserved for genuinely analytical tasks ──
  generatePairExplanation: {
    preferredProvider: 'deepseek',
    deepseekTier: ENABLE_PRO_MATCH_EXPLANATIONS ? 'pro-thinking' : 'flash',
    reasoningEffort: 'max',
  },

  // ── Tier 2: Flash-thinking + max — complex analysis, validation ──
  analyzeComplexSemantics: {
    preferredProvider: 'deepseek',
    forceProvider: 'deepseek',
    deepseekTier: 'flash-thinking',
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
  /** DeepSeek thinking configuration — applied as TOP-LEVEL request fields (extra_body is not serialized by the SDK) */
  thinkingExtraBody?: { thinking?: { type: 'enabled' | 'disabled' }; reasoning_effort?: 'high' | 'max' | 'medium' };
  /** The reasoning effort level that was resolved for this selection */
  reasoningEffort?: 'high' | 'max';
}

type DeepSeekChatCompletionCreateParams = Omit<
  OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  'reasoning_effort' | 'thinking'
> & {
  thinking?: NonNullable<ClientSelection['thinkingExtraBody']>['thinking'];
  reasoning_effort?: 'high' | 'max' | 'medium';
};

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
 * Calls the social AI provider (DeepSeek primary, MiniMax fallback)
 * and returns the response text.
 */
export async function callSocialAI(
  params: SocialAICallParams
): Promise<SocialAICallResult> {
  const { messages, temperature = 0.8, max_tokens = 600, callerTag, socialFunction } = params;
  const overallStartedAt = Date.now();
  const routedSelection = socialFunction ? getClientForFunction(socialFunction) : null;

  // DeepSeek primary path
  const deepseekSelection = routedSelection?.provider === 'deepseek'
    ? routedSelection
    : getDeepseekSelection();
  const modelName = routedSelection?.model ?? deepseekSelection.model;

  if (routedSelection?.provider === 'deepseek' || !routedSelection) {
    const start = Date.now();

    const requestPayload: DeepSeekChatCompletionCreateParams = {
      model: modelName,
      messages,
      temperature,
      max_tokens,
    };

    if (deepseekSelection.thinkingExtraBody) {
      requestPayload.thinking = deepseekSelection.thinkingExtraBody.thinking;
      if (deepseekSelection.thinkingExtraBody.reasoning_effort) {
        requestPayload.reasoning_effort = deepseekSelection.thinkingExtraBody.reasoning_effort;
      }
    }

    try {
      // DeepSeek supports "max" and top-level thinking fields beyond the OpenAI SDK contract.
      const response = await deepseekSelection.client.chat.completions.create(
        requestPayload as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
      );
      const providerLatencyMs = Date.now() - start;
      const message = response.choices[0]?.message;
      const content = message?.content ?? '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reasoningContent = (message as any)?.reasoning_content ?? undefined;

      logger.info('DeepSeek call completed', { service: 'socialAI', callerTag, provider: 'deepseek', model: modelName, latencyMs: providerLatencyMs });
      return {
        content,
        provider: 'deepseek',
        model: modelName,
        latencyMs: Date.now() - overallStartedAt,
        fallbackUsed: false,
        reasoningContent: reasoningContent || undefined,
      };
    } catch (err) {
      const providerLatencyMs = Date.now() - start;
      logger.warn(
        'deepseek failed, falling back to minimax',
        { service: 'socialAI', callerTag, provider: 'deepseek', latencyMs: providerLatencyMs, error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  // MiniMax fallback
  if (routedSelection?.provider === 'minimax') {
    const minimaxSelection = routedSelection;
    const fallbackModelName = minimaxSelection.model;
    const start = Date.now();
    try {
      const response = await minimaxSelection.client.chat.completions.create({
        model: fallbackModelName,
        messages,
        temperature,
        max_tokens,
      });
      const providerLatencyMs = Date.now() - start;
      const content = response.choices[0]?.message?.content ?? '';
      logger.info('MiniMax fallback completed', { service: 'socialAI', callerTag, provider: 'minimax', latencyMs: providerLatencyMs });
      return {
        content,
        provider: 'minimax',
        model: fallbackModelName,
        latencyMs: Date.now() - overallStartedAt,
        fallbackUsed: true,
      };
    } catch (err) {
      const providerLatencyMs = Date.now() - start;
      logger.error(
        'minimax fallback also failed',
        { service: 'socialAI', callerTag, provider: 'minimax', latencyMs: providerLatencyMs, error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  throw new Error(
    `[socialAI] ${callerTag}: All providers failed — cannot complete request`
  );
}
