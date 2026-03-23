/**
 * MiniMax AI Client
 *
 * Provides a shared OpenAI-compatible client for MiniMax API.
 * Used by creative/identity-facing generation surfaces (Phase 3 hybrid rollout).
 *
 * Environment variables:
 *   MINIMAX_API_KEY      — required to enable MiniMax
 *   MINIMAX_BASE_URL     — optional override (default: https://api.minimax.chat/v1)
 */

import OpenAI from 'openai';

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1';
const MINIMAX_TIMEOUT_MS = parseInt(process.env.MINIMAX_TIMEOUT_MS || '15000', 10);

let _client: OpenAI | null = null;

/**
 * Returns the shared MiniMax OpenAI-compatible client, or null if not configured.
 */
export function getMiniMaxClient(): OpenAI | null {
  if (!process.env.MINIMAX_API_KEY) {
    return null;
  }

  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: MINIMAX_BASE_URL,
      timeout: MINIMAX_TIMEOUT_MS,
      maxRetries: 2,
    });
  }

  return _client;
}

/**
 * Returns true if MiniMax is configured and available.
 */
export function isMiniMaxAvailable(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY);
}

/**
 * Default MiniMax model for all generation tasks.
 */
export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'minimax-m2.7';

/**
 * Alias used by the social model router.
 */
export const MINIMAX_DEFAULT_MODEL = MINIMAX_MODEL;

/**
 * Returns the current configured MiniMax model name.
 * Read on each call so env overrides work at runtime.
 */
export function getMinimaxModel(): string {
  return process.env.MINIMAX_MODEL || 'minimax-m2.7';
}

/**
 * The shared MiniMax OpenAI-compatible client (null if not configured).
 * Evaluated once at module load; env var must be set before first import.
 */
export const minimaxClient: OpenAI | null = getMiniMaxClient();

/**
 * Returns true if MiniMax is configured and available (alias for isMiniMaxAvailable).
 */
export const isMinimaxEnabled = isMiniMaxAvailable;

/**
 * Returns the shared MiniMax client (alias for getMiniMaxClient, used by socialModelRouter).
 */
export const getMinimaxClient = getMiniMaxClient;
