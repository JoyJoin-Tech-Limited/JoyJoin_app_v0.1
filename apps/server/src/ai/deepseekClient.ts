/**
 * Shared DeepSeek client factory
 *
 * Centralises DeepSeek API client creation and model name resolution
 * so that no other file needs to hardcode model strings or instantiate
 * OpenAI clients directly.
 *
 * Replaces the scattered inline `new OpenAI({ baseURL: 'https://api.deepseek.com' })`
 * patterns across the server codebase.
 */

import OpenAI from 'openai';
import {
  resolveDeepSeekModel,
  type DeepSeekModelTier,
} from '@joyjoin/shared';

let _deepseekClient: OpenAI | null = null;

/**
 * Returns a lazily-initialised DeepSeek OpenAI-compatible client.
 * The same client instance is reused for all model tiers.
 */
export function getDeepseekClient(): OpenAI {
  if (!_deepseekClient) {
    _deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-fallback',
      baseURL: 'https://api.deepseek.com',
    });
  }
  return _deepseekClient;
}

/**
 * Resolve a tier to the exact model name.
 */
export function getDeepseekModel(tier: DeepSeekModelTier = 'flash'): string {
  return resolveDeepSeekModel(tier);
}
