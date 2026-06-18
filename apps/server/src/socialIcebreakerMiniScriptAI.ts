import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import {
  buildMiniScriptFrameworkUserMessage,
  MINISCRIPT_FRAMEWORK_SYSTEM,
} from './ai/socialIcebreakerPrompts';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { logger } from './lib/logger';

export type MiniScriptFrameworkModelFetchResult =
  | {
      ok: true;
      data: unknown;
      provider: 'minimax' | 'deepseek';
      model: string;
      latencyMs: number;
      /** True when MiniMax was attempted first and DeepSeek json_object produced this successful parse. */
      deepSeekRecoveryUsed?: boolean;
    }
  | {
      ok: false;
      reason: 'empty_response' | 'parse_error' | 'llm_error' | 'timeout' | 'no_credentials';
      provider: 'minimax' | 'deepseek' | null;
      model?: string;
      latencyMs: number;
    };

type ClientSelection = ReturnType<typeof getClientForFunction>;

async function fetchMiniScriptFrameworkOnce(params: {
  selection: ClientSelection;
  userMessage: string;
  /** DeepSeek supports OpenAI json_object; MiniMax may ignore it — omit for MiniMax. */
  useJsonObject: boolean;
  signal?: AbortSignal;
}): Promise<MiniScriptFrameworkModelFetchResult> {
  const t0 = Date.now();
  const { client, model, provider } = params.selection;

  const body = {
    model,
    messages: [
      { role: 'system' as const, content: MINISCRIPT_FRAMEWORK_SYSTEM },
      { role: 'user' as const, content: params.userMessage },
    ],
    temperature: 0.55,
    /** Large nested framework JSON; truncation shows up as parse_error — size up before raising timeout. */
    max_tokens: 4096,
    ...(params.useJsonObject ? { response_format: { type: 'json_object' as const } } : {}),
  };

  try {
    const response = await client.chat.completions.create(
      body,
      params.signal ? { signal: params.signal } : undefined
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, reason: 'empty_response', provider, model, latencyMs: Date.now() - t0 };
    }
    try {
      const payload = extractJsonPayloadForParse(content);
      const data = JSON.parse(payload) as unknown;
      return { ok: true, data, provider, model, latencyMs: Date.now() - t0 };
    } catch {
      return { ok: false, reason: 'parse_error', provider, model, latencyMs: Date.now() - t0 };
    }
  } catch (error: unknown) {
    const latencyMs = Date.now() - t0;
    const name = error && typeof error === 'object' && 'name' in error ? (error as { name?: string }).name : '';
    if (name === 'AbortError' || params.signal?.aborted) {
      return {
        ok: false,
        reason: 'timeout',
        provider,
        model,
        latencyMs,
      };
    }
    logger.error('fetchMiniScriptFrameworkModelJson attempt failed', { error: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: 'llm_error', provider, model, latencyMs };
  }
}

/**
 * MiniScript framework JSON: MiniMax-first in hybrid mode; DeepSeek `json_object` as structured fallback.
 * Does not validate with Zod or emit AITrace — the miniscript orchestrator owns that.
 */
export async function fetchMiniScriptFrameworkModelJson(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  signal?: AbortSignal;
}): Promise<MiniScriptFrameworkModelFetchResult> {
  const t0 = Date.now();
  const userMessage = buildMiniScriptFrameworkUserMessage(params);

  let selection: ClientSelection;
  try {
    selection = getClientForFunction('generateMiniScriptFramework');
  } catch {
    return { ok: false, reason: 'no_credentials', provider: null, latencyMs: Date.now() - t0 };
  }

  const primary = await fetchMiniScriptFrameworkOnce({
    selection,
    userMessage,
    useJsonObject: true,
    signal: params.signal,
  });

  if (primary.ok) return primary;

  if (selection.provider === 'minimax' && process.env.DEEPSEEK_API_KEY) {
    const second = await fetchMiniScriptFrameworkOnce({
      selection: getDeepseekSelection(),
      userMessage,
      useJsonObject: true,
      signal: params.signal,
    });
    if (second.ok) {
      return { ...second, deepSeekRecoveryUsed: true };
    }
    return second;
  }

  return primary;
}
