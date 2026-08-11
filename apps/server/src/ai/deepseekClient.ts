/**
 * Shared DeepSeek client factory
 *
 * Centralises DeepSeek API client creation and model name resolution
 * so that no other file needs to hardcode model strings or instantiate
 * OpenAI clients directly.
 *
 * Replaces the scattered inline `new OpenAI({ baseURL: 'https://api.deepseek.com' })`
 * patterns across the server codebase.
 *
 * Thinking default: DeepSeek V4 models reason by default when a request carries
 * no thinking control, burning the completion budget on `reasoning_content` and
 * frequently returning empty/truncated `message.content` at production
 * `max_tokens` budgets. The wrapped `chat.completions.create` therefore injects
 * a TOP-LEVEL `thinking: { type: 'disabled' }` field into any request that does
 * not already carry explicit thinking control, so flash-tier output is produced
 * directly. Thinking-tier callers (e.g. the social model router's
 * `flash-thinking`/`pro-thinking` selections) already send top-level
 * `thinking: { type: 'enabled' }` and are left untouched.
 *
 * Note (2026-08-11): `extra_body` in the request body or RequestOptions is NOT
 * serialized by this SDK build — verified with a live probe (reasoning still
 * ran when thinking control was sent via extra_body). Thinking control must be
 * top-level in the request body.
 */

import OpenAI from 'openai';
import {
  resolveDeepSeekModel,
  type DeepSeekModelTier,
} from '@joyjoin/shared';
import { logger } from '../lib/logger';

let _deepseekClient: OpenAI | null = null;

/**
 * Returns a lazily-initialised DeepSeek OpenAI-compatible client.
 * The same client instance is reused for all model tiers.
 */
export function getDeepseekClient(): OpenAI {
  if (!_deepseekClient) {
    if (!process.env.DEEPSEEK_API_KEY) {
      logger.warn(
        '[DeepSeek] DEEPSEEK_API_KEY is not set — calls will fail with 401 (client uses a placeholder key)'
      );
    }
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-fallback',
      baseURL: 'https://api.deepseek.com',
    });

    // Default-inject thinking disabled for requests without explicit thinking control.
    const completions = client.chat.completions;
    const originalCreate = completions.create.bind(completions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    completions.create = (async (body: any, options?: any) => {
      const bodyWithThinking = body as Record<string, unknown>;
      const extraBody = bodyWithThinking.extra_body as Record<string, unknown> | undefined;
      const hasThinkingControl =
        'thinking' in bodyWithThinking || (extraBody !== undefined && 'thinking' in extraBody);
      if (!hasThinkingControl) {
        bodyWithThinking.thinking = { type: 'disabled' };
      }
      return options !== undefined ? originalCreate(body, options) : originalCreate(body);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    _deepseekClient = client;
  }
  return _deepseekClient;
}

/**
 * Resolve a tier to the exact model name.
 */
export function getDeepseekModel(tier: DeepSeekModelTier = 'flash'): string {
  return resolveDeepSeekModel(tier);
}
