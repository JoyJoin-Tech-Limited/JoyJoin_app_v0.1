#!/usr/bin/env node
/**
 * Automation LLM Client
 * =======================
 *
 * Lightweight DeepSeek API client for auto-debug and auto-docs scripts.
 * Uses fetch() directly (no SDK dependency) for standalone script use.
 *
 * Model tier reference (from packages/shared/src/aiModels.ts):
 *   flash          → deepseek-v4-flash (no thinking, fastest)
 *   flash-thinking → deepseek-v4-flash + thinking (reasoning, good for analysis)
 *   pro-thinking   → deepseek-v4-pro + thinking (deepest, expensive)
 *
 * Usage:
 *   import { callDeepSeek } from './automation-llm.mjs';
 *   const result = await callDeepSeek({
 *     messages: [{ role: 'user', content: '...' }],
 *     tier: 'flash-thinking',
 *     reasoningEffort: 'high',
 *   });
 *
 * Environment:
 *   DEEPSEEK_API_KEY  – Required. DeepSeek API key.
 *   DEEPSEEK_BASE_URL – Optional. API base URL (default: https://api.deepseek.com)
 */

// @ts-check

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

/** @type {'flash' | 'flash-thinking' | 'pro-thinking'} */
export const DEFAULT_TIER = 'flash-thinking';
/** @type {'high' | 'max'} */
export const DEFAULT_REASONING_EFFORT = 'high';

/**
 * Model name resolution (mirrors packages/shared/src/aiModels.ts)
 * @param {'flash' | 'flash-thinking' | 'pro-thinking'} tier
 * @returns {string}
 */
function resolveModel(tier) {
  switch (tier) {
    case 'flash':
    case 'flash-thinking':
      return 'deepseek-v4-flash';
    case 'pro-thinking':
      return 'deepseek-v4-pro';
  }
}

/**
 * Build extra_body for thinking mode
 * @param {'flash' | 'flash-thinking' | 'pro-thinking'} tier
 * @param {'high' | 'max'} [reasoningEffort]
 * @returns {Record<string, unknown> | undefined}
 */
function buildExtraBody(tier, reasoningEffort) {
  if (tier === 'flash' || tier === 'flash-thinking' || tier === 'pro-thinking') {
    if (tier === 'flash') return undefined;
    return {
      thinking: { type: 'enabled' },
      reasoning_effort: reasoningEffort || 'high',
    };
  }
  return undefined;
}

/**
 * @typedef {Object} LLMCallParams
 * @property {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @property {'flash'|'flash-thinking'|'pro-thinking'} [tier]
 * @property {'high'|'max'} [reasoningEffort]
 * @property {number} [temperature] - Default 0.3 (lower = more deterministic)
 * @property {number} [maxTokens] - Default: 2048
 * @property {string} [callerTag] - For logging
 */

/**
 * @typedef {Object} LLMCallResult
 * @property {string} content
 * @property {string} model
 * @property {number} latencyMs
 * @property {string} [reasoningContent]
 * @property {boolean} ok
 * @property {string} [error]
 */

/**
 * Call DeepSeek API
 * @param {LLMCallParams} params
 * @returns {Promise<LLMCallResult>}
 */
export async function callDeepSeek(params) {
  const {
    messages,
    tier = DEFAULT_TIER,
    reasoningEffort = DEFAULT_REASONING_EFFORT,
    temperature = 0.3,
    maxTokens = 2048,
    callerTag = 'auto-llm',
  } = params;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      content: '',
      model: resolveModel(tier),
      latencyMs: 0,
      error: 'DEEPSEEK_API_KEY not set',
    };
  }

  const model = resolveModel(tier);
  const extraBody = buildExtraBody(tier, reasoningEffort);
  const start = Date.now();

  /** @type {Record<string, unknown>} */
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (extraBody) {
    body.extra_body = extraBody;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      return {
        ok: false,
        content: '',
        model,
        latencyMs: Date.now() - start,
        error: `DeepSeek API ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    /** @type {any} */
    const json = await response.json();
    const message = json.choices?.[0]?.message;
    const content = message?.content ?? '';
    const reasoningContent = message?.reasoning_content ?? undefined;

    return {
      ok: true,
      content: content.trim(),
      model,
      latencyMs: Date.now() - start,
      reasoningContent,
    };
  } catch (err) {
    const isTimeout = /** @type {any} */ (err)?.name === 'AbortError';
    return {
      ok: false,
      content: '',
      model,
      latencyMs: Date.now() - start,
      error: isTimeout ? `Timeout after 30000ms` : String(err),
    };
  }
}

/**
 * Quick inline LLM call for automation scripts.
 * Returns the text content, or null on failure.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Partial<LLMCallParams>} [opts]
 * @returns {Promise<string|null>}
 */
export async function llmQuery(systemPrompt, userPrompt, opts = {}) {
  const result = await callDeepSeek({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...opts,
  });

  if (!result.ok) {
    console.error(`[automation-llm] LLM call failed: ${result.error}`);
    return null;
  }

  return result.content;
}

// ─── CLI test mode ───────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('automation-llm.mjs')) {
  const prompt = process.argv.slice(2).join(' ') || 'Say hello in one sentence.';
  const result = await callDeepSeek({
    messages: [{ role: 'user', content: prompt }],
    tier: 'flash',
    temperature: 0.7,
    callerTag: 'cli-test',
  });

  if (result.ok) {
    console.log(`[${result.model}] ${result.content}`);
    if (result.reasoningContent) {
      console.log(`\n--- reasoning ---\n${result.reasoningContent}`);
    }
    console.log(`\n(latency: ${result.latencyMs}ms)`);
    process.exit(0);
  } else {
    console.error(`❌ ${result.error}`);
    process.exit(1);
  }
}
