/**
 * Social AI model router — Phase 2 hybrid rollout
 *
 * Routes social-experience AI calls to MiniMax when configured, falling
 * back to DeepSeek for resilience.  All caller code should go through
 * `callSocialAI` or `getClientForFunction` instead of instantiating
 * provider clients directly.
 *
 * Services routed through this file:
 *   - socialIcebreakerAIService.ts  (warmup topics, XiaoYue, recap, lie detective)
 *   - matchExplanationService.ts    (pair explanations, icebreakers)
 *   - inference/hybridSemantic.ts   (semantic attribute analysis)
 *
 * Provider priority:
 *   1. MiniMax  (if MINIMAX_API_KEY is set)
 *   2. DeepSeek (always available as fallback)
 */

import OpenAI from 'openai';
import { getMinimaxModel, getMinimaxClient, MINIMAX_DEFAULT_MODEL, isMinimaxEnabled } from './minimaxClient';

const DEEPSEEK_MODEL = 'deepseek-chat';

// DeepSeek client — lazy-initialized so the module can load safely even when
// DEEPSEEK_API_KEY is not set (e.g. MiniMax-only envs).  The dummy key
// follows the same pattern used by other services in this codebase.
let _deepseekClient: OpenAI | null = null;

function getDeepseekClient(): OpenAI {
  if (!_deepseekClient) {
    _deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-fallback',
      baseURL: 'https://api.deepseek.com',
    });
  }
  return _deepseekClient;
}

// Social functions routed through the explicit registry.
type SocialFunction =
  | 'generateWarmupTopics'
  | 'generateXiaoYueComment'
  | 'generateRecapSummary'
  | 'generateLieDetectiveStatements'
  | 'generateMicroChallenges'
  | 'generatePersonalityDiceChallenges'
  | 'generateProfileTagline'
  | 'generateConversationTopics'
  | 'generateWelcomeMessage'
  | 'generateClosingMessage'
  | 'generatePairExplanation'       // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'generateIceBreakers'           // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'analyzeComplexSemantics';      // hybridSemantic — DeepSeek default (structured JSON inference)

type SocialFunctionRoutingPolicy = {
  preferredProvider: 'minimax' | 'deepseek';
  forceProvider?: 'deepseek';
};

const SOCIAL_FUNCTION_ROUTING: Record<SocialFunction, SocialFunctionRoutingPolicy> = {
  generateWarmupTopics: { preferredProvider: 'minimax' },
  generateXiaoYueComment: { preferredProvider: 'minimax' },
  generateRecapSummary: { preferredProvider: 'minimax' },
  generateLieDetectiveStatements: { preferredProvider: 'minimax' },
  generateMicroChallenges: { preferredProvider: 'deepseek' },
  generatePersonalityDiceChallenges: { preferredProvider: 'deepseek' },
  generateProfileTagline: { preferredProvider: 'minimax' },
  generateConversationTopics: { preferredProvider: 'minimax' },
  generateWelcomeMessage: { preferredProvider: 'minimax' },
  generateClosingMessage: { preferredProvider: 'minimax' },
  generatePairExplanation: { preferredProvider: 'minimax' },
  generateIceBreakers: { preferredProvider: 'minimax' },
  analyzeComplexSemantics: { preferredProvider: 'deepseek', forceProvider: 'deepseek' },
};

export type RoutedSocialFunction = Exclude<SocialFunction, 'analyzeComplexSemantics'>;

type ProviderMode = 'hybrid' | 'deepseek' | 'minimax';

function resolveMode(): ProviderMode {
  const raw = process.env.SOCIAL_AI_PROVIDER;
  if (!raw || raw === 'hybrid') return 'hybrid';
  if (raw === 'deepseek') return 'deepseek';
  if (raw === 'minimax') return 'minimax';
  console.warn(`[socialAI] Unrecognized SOCIAL_AI_PROVIDER="${raw}", defaulting to hybrid`);
  return 'hybrid';
}

export interface ClientSelection {
  client: OpenAI;
  model: string;
  provider: 'minimax' | 'deepseek';
}

/**
 * Returns the appropriate AI client, model, and provider for a given social function.
 * Respects SOCIAL_AI_PROVIDER env var (hybrid | minimax | deepseek) with automatic
 * fallback to DeepSeek when MiniMax is not configured.
 *
 * Functions with `forceProvider: 'deepseek'` always receive a DeepSeek
 * selection regardless of the configured mode — they rely on
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
    return getDeepseekSelection();
  }

  const mode = resolveMode();
  // Use getMinimaxClient() (evaluated on every call) rather than the module-load-time
  // constant so that env changes between module import and actual invocation are respected.
  const mmClient = getMinimaxClient();

  if (mode === 'deepseek') {
    return getDeepseekSelection();
  }

  if (mode === 'minimax') {
    if (!mmClient) {
      console.warn('[socialAI] SOCIAL_AI_PROVIDER=minimax but MINIMAX_API_KEY is not set, falling back to deepseek');
      return getDeepseekSelection();
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  // hybrid mode (default)
  if (policy.preferredProvider === 'minimax') {
    if (!mmClient) {
      console.warn(`[socialAI] ${fn}: MINIMAX_API_KEY is not set, falling back to deepseek`);
      return getDeepseekSelection();
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  return getDeepseekSelection();
}

/**
 * Returns a DeepSeek client selection unconditionally.
 * Used by callers that need an explicit DeepSeek fallback path when their
 * primary provider (MiniMax) has already failed.
 */
export function getDeepseekSelection(): ClientSelection {
  return { client: getDeepseekClient(), model: DEEPSEEK_MODEL, provider: 'deepseek' };
}

export interface SocialAICallParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  /** Tag shown in logs (e.g. 'conversationTopics', 'welcomeMessage') */
  callerTag: string;
  /** Explicit routed social function key for function-level provider selection. */
  socialFunction?: RoutedSocialFunction;
}

export interface SocialAICallResult {
  content: string;
  provider: 'minimax' | 'deepseek';
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
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
    const start = Date.now();
    try {
      const response = await minimaxSelection.client.chat.completions.create({
        model: minimaxSelection.model,
        messages,
        temperature,
        max_tokens,
      });
      const providerLatencyMs = Date.now() - start;
      const content = response.choices[0]?.message?.content ?? '';
      console.log(`[socialAI] ${callerTag} provider=minimax latency=${providerLatencyMs}ms`);
      return {
        content,
        provider: 'minimax',
        model: minimaxSelection.model,
        latencyMs: Date.now() - overallStartedAt,
        fallbackUsed: false,
      };
    } catch (err) {
      const providerLatencyMs = Date.now() - start;
      console.warn(
        `[socialAI] ${callerTag} minimax failed after ${providerLatencyMs}ms, falling back to deepseek:`,
        err
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
  const start = Date.now();
  const response = await deepseekSelection.client.chat.completions.create({
    model: deepseekSelection.model,
    messages,
    temperature,
    max_tokens,
  });
  const providerLatencyMs = Date.now() - start;
  const content = response.choices[0]?.message?.content ?? '';
  console.log(`[socialAI] ${callerTag} provider=deepseek latency=${providerLatencyMs}ms`);
  return {
    content,
    provider: 'deepseek',
    model: deepseekSelection.model,
    latencyMs: Date.now() - overallStartedAt,
    fallbackUsed: attemptedMinimax || preCallFallbackUsed,
  };
}
