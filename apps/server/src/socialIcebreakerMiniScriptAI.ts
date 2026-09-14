import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import {
  buildMiniScriptFrameworkUserMessage,
  MINISCRIPT_FRAMEWORK_SYSTEM,
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
} from './ai/socialIcebreakerPrompts';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { logger } from './lib/logger';
import {
  buildAIGCMeta,
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { moderateGeneratedContent, type ModerationCheck } from './lib/aiContentModeration';
import { migrateMiniScriptFrameworkV1ToV2 } from '@shared/miniscriptStoryFramework';

export type MiniScriptFrameworkModelFetchResult =
  | {
      ok: true;
      data: unknown;
      provider: 'minimax' | 'deepseek' | null;
      model: string;
      latencyMs: number;
      /** True when MiniMax was attempted first and DeepSeek json_object produced this successful parse. */
      deepSeekRecoveryUsed?: boolean;
      meta?: AIResponseMeta;
    }
  | {
      ok: false;
      reason: 'empty_response' | 'parse_error' | 'llm_error' | 'timeout' | 'no_credentials';
      provider: 'minimax' | 'deepseek' | null;
      model?: string;
      latencyMs: number;
      meta?: AIResponseMeta;
    };

function collectStringFields(value: unknown, path = ''): ModerationCheck[] {
  if (typeof value === 'string') {
    return path ? [{ field: path, text: value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectStringFields(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, val]) =>
      collectStringFields(val, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

function attachAIGCMeta(meta: AIResponseMeta): AIResponseMeta {
  return {
    ...meta,
    aigc: buildAIGCMeta({ fallbackUsed: meta.fallbackUsed, labelType: 'ai-generated' }),
  };
}

function buildMiniScriptFallback(style: MiniScriptStyle, genres: MiniScriptGenre[]): unknown {
  const v1 = {
    schemaVersion: 1 as const,
    style,
    genres,
    premise: '一场轻松有趣的聚会，大家围坐一起，通过小游戏和对话慢慢熟悉。没有压力，也没有尴尬。',
    characters: [
      { slotIndex: 0, roleLabel: '主持人', sinHook: '热情但有点健忘', alibi: '整场都在组织大家', secret: '其实有点紧张' },
      { slotIndex: 1, roleLabel: '来客A', sinHook: '好奇心旺盛', alibi: '一直在问问题', secret: '想多认识人' },
      { slotIndex: 2, roleLabel: '来客B', sinHook: '话不多但观察力强', alibi: '安静听大家讲', secret: '记得很多细节' },
      { slotIndex: 3, roleLabel: '来客C', sinHook: '喜欢开玩笑', alibi: '调节气氛', secret: '用玩笑掩饰紧张' },
    ],
    act_flow: [
      {
        actNumber: 1,
        title: '开场破冰',
        beats: ['大家简单自我介绍', '分享一个今天的小趣事'],
      },
      {
        actNumber: 2,
        title: '小游戏时间',
        beats: ['进行一个轻松问答', '揭晓一个有趣的共同点'],
      },
    ],
    ending: {
      resolutionSummary: '聚会结束时，大家发现彼此比想象中更有共同点。',
      confessionMechanic: '每人用一句话总结今晚的印象。',
    },
  };
  return migrateMiniScriptFrameworkV1ToV2(v1);
}

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

function moderateMiniScriptFramework(
  data: unknown,
  provider: AIProvider,
  model: string | undefined,
  latencyMs: number,
  traceId?: string,
): ReturnType<typeof moderateGeneratedContent> {
  return moderateGeneratedContent(collectStringFields(data), {
    domain: 'icebreaker',
    feature: 'generateMiniScriptFramework',
    provider,
    model,
    latencyMs,
    promptVersion: MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
    traceId,
  });
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

  if (primary.ok) {
    const moderation = moderateMiniScriptFramework(
      primary.data,
      primary.provider,
      primary.model,
      primary.latencyMs,
    );
    if (!moderation.safe) {
      return {
        ok: true,
        data: buildMiniScriptFallback(params.style, params.genres),
        provider: null,
        model: 'n/a',
        latencyMs: primary.latencyMs,
        meta: attachAIGCMeta(buildFallbackAIMeta('content_safety', MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION)),
      };
    }
    return {
      ...primary,
      meta: attachAIGCMeta(buildLiveAIMeta(primary.provider!, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION)),
    };
  }

  if (selection.provider === 'minimax' && process.env.DEEPSEEK_API_KEY) {
    const second = await fetchMiniScriptFrameworkOnce({
      selection: getDeepseekSelection(),
      userMessage,
      useJsonObject: true,
      signal: params.signal,
    });
    if (second.ok) {
      const moderation = moderateMiniScriptFramework(
        second.data,
        second.provider,
        second.model,
        second.latencyMs,
      );
      if (!moderation.safe) {
        return {
          ok: true,
          data: buildMiniScriptFallback(params.style, params.genres),
          provider: null,
          model: 'n/a',
          latencyMs: second.latencyMs,
          meta: attachAIGCMeta(buildFallbackAIMeta('content_safety', MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION)),
        };
      }
      return {
        ...second,
        deepSeekRecoveryUsed: true,
        meta: attachAIGCMeta(buildLiveAIMeta(second.provider!, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION)),
      };
    }
    return second;
  }

  return primary;
}
