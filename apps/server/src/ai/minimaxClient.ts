/**
 * MiniMax AI client — Phase 2 hybrid rollout
 *
 * Uses the MiniMax OpenAI-compatible endpoint so the rest of the codebase
 * can treat it identically to the existing DeepSeek client.
 *
 * Env vars:
 *   MINIMAX_API_KEY   — required to enable MiniMax routing
 *   MINIMAX_BASE_URL  — defaults to https://api.minimax.chat/v1
 *   MINIMAX_MODEL     — defaults to MiniMax-Text-01
 */

import OpenAI from 'openai';

export const MINIMAX_DEFAULT_MODEL = process.env.MINIMAX_MODEL ?? 'MiniMax-Text-01';
const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.chat/v1';

/**
 * Returns true when a MiniMax API key is present in the environment.
 * Use this before attempting a MiniMax call.
 */
export function isMinimaxEnabled(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY);
}

/**
 * Lazily-created MiniMax client (OpenAI-compatible).
 * Returns null when MINIMAX_API_KEY is not configured.
 */
let _minimaxClient: OpenAI | null = null;

export function getMinimaxClient(): OpenAI | null {
  if (!process.env.MINIMAX_API_KEY) return null;
  if (!_minimaxClient) {
    _minimaxClient = new OpenAI({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: MINIMAX_BASE_URL,
    });
  }
  return _minimaxClient;
}
