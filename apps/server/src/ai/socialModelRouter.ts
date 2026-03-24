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

// Social functions that are routed to MiniMax in hybrid mode
type SocialFunction =
  | 'generateWarmupTopics'
  | 'generateXiaoYueComment'
  | 'generateRecapSummary'
  | 'generateLieDetectiveStatements'
  | 'generateMicroChallenges'
  | 'generatePersonalityDiceChallenges'
  | 'generatePairExplanation'       // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'generateIceBreakers'           // matchExplanationService — MiniMax preferred (warm narrative copy)
  | 'analyzeComplexSemantics';      // hybridSemantic — DeepSeek default (structured JSON inference)

const MINIMAX_DESIGNATED_FUNCTIONS = new Set<SocialFunction>([
  'generateWarmupTopics',
  'generateXiaoYueComment',
  'generateRecapSummary',
  'generateLieDetectiveStatements',
  'generatePairExplanation',
  'generateIceBreakers',
]);

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
 */
export function getClientForFunction(fn: SocialFunction): ClientSelection {
  const mode = resolveMode();
  // Use getMinimaxClient() (evaluated on every call) rather than the module-load-time
  // constant so that env changes between module import and actual invocation are respected.
  const mmClient = getMinimaxClient();

  if (mode === 'deepseek') {
    return { client: getDeepseekClient(), model: 'deepseek-chat', provider: 'deepseek' };
  }

  if (mode === 'minimax') {
    if (!mmClient) {
      console.warn('[socialAI] SOCIAL_AI_PROVIDER=minimax but MINIMAX_API_KEY is not set, falling back to deepseek');
      return { client: getDeepseekClient(), model: 'deepseek-chat', provider: 'deepseek' };
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  // hybrid mode (default)
  if (MINIMAX_DESIGNATED_FUNCTIONS.has(fn)) {
    if (!mmClient) {
      console.warn(`[socialAI] ${fn}: MINIMAX_API_KEY is not set, falling back to deepseek`);
      return { client: getDeepseekClient(), model: 'deepseek-chat', provider: 'deepseek' };
    }
    return { client: mmClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  return { client: getDeepseekClient(), model: 'deepseek-chat', provider: 'deepseek' };
}

export interface SocialAICallParams {
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  /** Tag shown in logs (e.g. 'conversationTopics', 'welcomeMessage') */
  callerTag: string;
}

export interface SocialAICallResult {
  content: string;
  provider: 'minimax' | 'deepseek';
  latencyMs: number;
}

/**
 * Calls the preferred social AI provider and returns the response text.
 * Automatically falls back to DeepSeek if MiniMax is unavailable or fails.
 */
export async function callSocialAI(
  params: SocialAICallParams
): Promise<SocialAICallResult> {
  const { messages, temperature = 0.8, max_tokens = 600, callerTag } = params;

  if (isMinimaxEnabled()) {
    const minimax = getMinimaxClient()!;
    const start = Date.now();
    try {
      const response = await minimax.chat.completions.create({
        model: MINIMAX_DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens,
      });
      const latencyMs = Date.now() - start;
      const content = response.choices[0]?.message?.content ?? '';
      console.log(`[socialAI] ${callerTag} provider=minimax latency=${latencyMs}ms`);
      return { content, provider: 'minimax', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      console.warn(
        `[socialAI] ${callerTag} minimax failed after ${latencyMs}ms, falling back to deepseek:`,
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
  const start = Date.now();
  const response = await getDeepseekClient().chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens,
  });
  const latencyMs = Date.now() - start;
  const content = response.choices[0]?.message?.content ?? '';
  console.log(`[socialAI] ${callerTag} provider=deepseek latency=${latencyMs}ms`);
  return { content, provider: 'deepseek', latencyMs };
}
