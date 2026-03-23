/**
 * MiniMax AI Client
 *
 * Provides an OpenAI-compatible client for the MiniMax API.
 * Credentials are read from environment variables:
 *   MINIMAX_API_KEY   — required to enable MiniMax
 *   MINIMAX_BASE_URL  — optional override (defaults to https://api.minimax.io/v1)
 *   MINIMAX_MODEL     — optional model name override (defaults to MiniMax-Text-01)
 */

import OpenAI from 'openai';

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io/v1';
export const MINIMAX_DEFAULT_MODEL = 'MiniMax-Text-01';

const apiKey = process.env.MINIMAX_API_KEY;
const baseURL = process.env.MINIMAX_BASE_URL || MINIMAX_DEFAULT_BASE_URL;

/**
 * OpenAI-compatible MiniMax client.
 * Will be `null` when MINIMAX_API_KEY is not configured.
 * No warning is emitted here; the router logs a warning only when a
 * MiniMax-routed function is actually requested with no key configured.
 */
export const minimaxClient: OpenAI | null = apiKey
  ? new OpenAI({ apiKey, baseURL })
  : null;

/**
 * Returns the MiniMax model name to use.
 * Reads MINIMAX_MODEL env var, falling back to the default.
 */
export function getMinimaxModel(): string {
  return process.env.MINIMAX_MODEL || MINIMAX_DEFAULT_MODEL;
}
