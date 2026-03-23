/**
 * Social AI model router — Phase 2 hybrid rollout
 *
 * Routes social-experience AI calls to MiniMax when configured, falling
 * back to DeepSeek for resilience.  All caller code should go through
 * `callSocialAI` instead of instantiating provider clients directly.
 *
 * Provider priority:
 *   1. MiniMax  (if MINIMAX_API_KEY is set)
 *   2. DeepSeek (always available as fallback)
 */

import OpenAI from 'openai';
import { getMinimaxClient, MINIMAX_DEFAULT_MODEL, isMinimaxEnabled } from './minimaxClient';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

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
  const start = Date.now();
  const response = await deepseekClient.chat.completions.create({
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
