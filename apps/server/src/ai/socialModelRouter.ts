/**
 * Social Icebreaker Model Router
 *
 * Determines which AI provider (MiniMax or DeepSeek) handles each
 * Social Icebreaker function.  The default mode is "hybrid":
 *   - High-emotion/generative functions → MiniMax
 *   - Structural/game functions         → DeepSeek
 *
 * Override the mode globally with the SOCIAL_AI_PROVIDER env var:
 *   SOCIAL_AI_PROVIDER=hybrid    (default)
 *   SOCIAL_AI_PROVIDER=deepseek  (all functions use DeepSeek)
 *   SOCIAL_AI_PROVIDER=minimax   (all functions use MiniMax if available)
 */

import OpenAI from 'openai';
import { minimaxClient, getMinimaxModel } from './minimaxClient';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

// ─── Provider Types ─────────────────────────────────────────────────────────

export type AIProvider = 'minimax' | 'deepseek';

export type SocialAIFunction =
  | 'generateWarmupTopics'
  | 'generateMicroChallenges'
  | 'generateLieDetectiveStatements'
  | 'generateXiaoYueComment'
  | 'generateRecapSummary'
  | 'generatePersonalityDiceChallenges';

// ─── Routing Table ───────────────────────────────────────────────────────────

/**
 * Declares which provider each function prefers in hybrid mode.
 * Functions marked 'minimax' fall back to DeepSeek when MiniMax is unavailable.
 */
const HYBRID_ROUTING: Record<SocialAIFunction, AIProvider> = {
  // High-emotion / brand-voice functions → MiniMax
  generateWarmupTopics: 'minimax',
  generateXiaoYueComment: 'minimax',
  generateRecapSummary: 'minimax',
  generateLieDetectiveStatements: 'minimax',
  // Structural / game functions → DeepSeek
  generateMicroChallenges: 'deepseek',
  generatePersonalityDiceChallenges: 'deepseek',
};

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RoutedClient {
  client: OpenAI;
  model: string;
  provider: AIProvider;
}

/**
 * Returns the AI client and model to use for a given Social Icebreaker function.
 *
 * Resolution order:
 * 1. If SOCIAL_AI_PROVIDER=deepseek → always return DeepSeek.
 * 2. If SOCIAL_AI_PROVIDER=minimax  → return MiniMax if available, else DeepSeek.
 * 3. Default (hybrid)               → follow HYBRID_ROUTING; fall back to DeepSeek
 *    when the preferred provider is MiniMax but MINIMAX_API_KEY is not set.
 */
export function getClientForFunction(fn: SocialAIFunction): RoutedClient {
  const mode = process.env.SOCIAL_AI_PROVIDER || 'hybrid';

  if (mode === 'deepseek') {
    return { client: deepseekClient, model: DEEPSEEK_MODEL, provider: 'deepseek' };
  }

  if (mode === 'minimax') {
    if (minimaxClient) {
      return { client: minimaxClient, model: getMinimaxModel(), provider: 'minimax' };
    }
    console.warn('[SocialModelRouter] SOCIAL_AI_PROVIDER=minimax but MINIMAX_API_KEY not set; falling back to DeepSeek');
    return { client: deepseekClient, model: DEEPSEEK_MODEL, provider: 'deepseek' };
  }

  // hybrid mode
  const preferred = HYBRID_ROUTING[fn];
  if (preferred === 'minimax' && minimaxClient) {
    return { client: minimaxClient, model: getMinimaxModel(), provider: 'minimax' };
  }

  return { client: deepseekClient, model: DEEPSEEK_MODEL, provider: 'deepseek' };
}
