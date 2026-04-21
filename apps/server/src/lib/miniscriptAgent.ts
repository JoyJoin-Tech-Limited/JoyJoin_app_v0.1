import type {
  MiniScriptGenre,
  MiniScriptStoryFramework,
  MiniScriptStyle,
} from '@shared/miniscriptStoryFramework';
import { miniScriptStoryFrameworkSchema } from '@shared/miniscriptStoryFramework';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
  type LiveAIProvider,
} from '@shared/types/aiMeta';
import {
  fetchMiniScriptFrameworkModelJson,
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
} from '../socialIcebreakerAIService';
import { createAiCorrelationId, logAITrace } from './aiTraceLogger';
import { recordAIProviderRecoveryMetric } from '../middleware/metrics';

const STYLE_PREMISE: Record<MiniScriptStyle, string> = {
  western_court: '凡尔赛厅里丢了一枚象征家族荣誉的胸针，众人各怀心事。',
  medieval: '城堡晚宴前，粮仓钥匙不翼而飞，怀疑像雾一样蔓延。',
  ancient_chinese: '灯会前夜，一封未署名的信落在茶楼，牵出几段旧缘。',
  xianxia: '灵舟靠岸时，匣中空无一物，只剩一缕若有若无的檀香。',
  future_tech: '轨道站上，一份实验记录被覆盖，谁在隐瞒什么？',
  modern_urban: '写字楼茶水间里，一份合同草稿被撕去关键页，气氛微妙。',
  republican_era: '小城戏院后台，一封戏票与半张照片，让旧识重逢。',
};

function sinLabel(i: number): string {
  const sins = ['怠惰', '虚荣', '嘴硬', '心软', '逞强', '逃避'];
  return sins[i % sins.length] ?? '心事';
}

function isMiniscriptLlmEnabled(): boolean {
  const v = process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  return v === '1' || v?.toLowerCase() === 'true';
}

/** Large framework JSON + dual provider attempt — keep above typical MiniMax RTT + parse. */
const LLM_ATTEMPT_TIMEOUT_MS = 32_000;

/**
 * Deterministic curated framework — always passes `miniScriptStoryFrameworkSchema`.
 */
export function generateMiniScriptFrameworkStub(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): MiniScriptStoryFramework {
  const n = Math.min(6, Math.max(4, params.playerCount));
  const premiseBase = STYLE_PREMISE[params.style];
  const genreHint = params.genres.join(', ');
  const premise = `${premiseBase}（基调：${genreHint}；低冲突、无暴力描写。）`;

  const characters = Array.from({ length: n }, (_, slotIndex) => ({
    slotIndex,
    roleLabel: `角色 ${slotIndex + 1}`,
    sinHook: `被「${sinLabel(slotIndex)}」轻轻绊了一下脚——一件无伤大雅的小麻烦。`,
    alibi: `当时在场，但只记得模糊的细节，足够真诚又不够完美。`,
    secret: `心里还藏着一句没说出口的道歉或感谢。`,
  }));

  const act_flow = [
    {
      actNumber: 1,
      title: '开场：各自落座',
      beats: ['交代场景', '每人一句立场', '埋下第一个小误会'],
    },
    {
      actNumber: 2,
      title: '升温：线索交汇',
      beats: ['交换信息', '发现矛盾点', '集体做一次轻推理投票'],
    },
    {
      actNumber: 3,
      title: '收束：温柔落地',
      beats: ['揭开误会层', '保留一点体面', '为复盘留空间'],
    },
  ];

  const raw: MiniScriptStoryFramework = {
    schemaVersion: 1,
    style: params.style,
    genres: params.genres,
    premise,
    characters,
    act_flow,
    ending: {
      resolutionSummary: '真相并不锋利：大多是误会、胆怯与好意叠在一起。用一句道歉或一次击掌收尾即可。',
      confessionMechanic: '主持人邀请每人用一句话「认领」自己的小秘密，不评判，只倾听。',
    },
  };

  return miniScriptStoryFrameworkSchema.parse(raw);
}

function applyHostAuthority(
  parsed: MiniScriptStoryFramework,
  params: { style: MiniScriptStyle; genres: MiniScriptGenre[]; playerCount: number },
): MiniScriptStoryFramework | null {
  if (parsed.characters.length !== params.playerCount) {
    return null;
  }
  const merged = {
    ...parsed,
    style: params.style,
    genres: params.genres,
  };
  const again = miniScriptStoryFrameworkSchema.safeParse(merged);
  return again.success ? again.data : null;
}

export type GenerateMiniScriptFrameworkMeta = {
  promptVersion: string;
  /** True when curated stub was used after a failed/ skipped model path, or schema rejected model JSON. */
  fallbackUsed: boolean;
  /** True when model JSON passed Zod + host checks. */
  llmAccepted: boolean;
  /**
   * True when MiniMax was tried first and DeepSeek produced the JSON that passed validation
   * (`fetchMiniScriptFrameworkModelJson` recovery path). Distinct from `fallbackUsed` (stub).
   */
  providerRecoveryUsed?: boolean;
};

/**
 * LLM attempt (when enabled) + Zod gate + deterministic stub fallback.
 * Emits a single `[AITrace]` line per invocation (non-PII).
 */
export async function generateMiniScriptFrameworkWithMeta(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): Promise<{
  framework: MiniScriptStoryFramework;
  meta: GenerateMiniScriptFrameworkMeta;
  aiResponseMeta: AIResponseMeta;
}> {
  const aiCorrelationId = createAiCorrelationId();
  const promptVersion = MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION;
  const tAll = Date.now();

  const emitTrace = (fields: {
    provider: AIProvider;
    model?: string;
    success: boolean;
    fallbackUsed: boolean;
    errorCode?: string;
  }) => {
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'miniscript',
      feature: 'generateMiniScriptFramework',
      provider: fields.provider,
      model: fields.model,
      latencyMs: Date.now() - tAll,
      success: fields.success,
      fallbackUsed: fields.fallbackUsed,
      fromCache: false,
      promptVersion,
      errorCode: fields.errorCode,
    });
  };

  if (!isMiniscriptLlmEnabled()) {
    const framework = generateMiniScriptFrameworkStub(params);
    emitTrace({
      provider: null,
      success: false,
      fallbackUsed: false,
      errorCode: 'llm_disabled',
    });
    return {
      framework,
      meta: { promptVersion, fallbackUsed: false, llmAccepted: false },
      aiResponseMeta: buildFallbackAIMeta('llm_disabled', promptVersion, aiCorrelationId),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_ATTEMPT_TIMEOUT_MS);
  const fetchResult = await fetchMiniScriptFrameworkModelJson({
    ...params,
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (fetchResult.ok) {
    const z = miniScriptStoryFrameworkSchema.safeParse(fetchResult.data);
    if (z.success) {
      const withAuthority = applyHostAuthority(z.data, params);
      if (withAuthority) {
        const providerRecoveryUsed = fetchResult.deepSeekRecoveryUsed === true;
        emitTrace({
          provider: fetchResult.provider,
          model: fetchResult.model,
          success: true,
          fallbackUsed: providerRecoveryUsed,
        });
        if (providerRecoveryUsed) {
          recordAIProviderRecoveryMetric({ domain: 'miniscript', feature: 'generateMiniScriptFramework' });
        }
        const live = buildLiveAIMeta(
          fetchResult.provider as LiveAIProvider,
          promptVersion,
          aiCorrelationId,
        );
        const aiResponseMeta: AIResponseMeta = providerRecoveryUsed
          ? { ...live, fallbackUsed: true }
          : live;
        return {
          framework: withAuthority,
          meta: {
            promptVersion,
            fallbackUsed: false,
            llmAccepted: true,
            providerRecoveryUsed,
          },
          aiResponseMeta,
        };
      }
      const framework = generateMiniScriptFrameworkStub(params);
      emitTrace({
        provider: fetchResult.provider,
        model: fetchResult.model,
        success: false,
        fallbackUsed: true,
        errorCode: 'schema_error',
      });
      return {
        framework,
        meta: { promptVersion, fallbackUsed: true, llmAccepted: false },
        aiResponseMeta: buildFallbackAIMeta('schema_error', promptVersion, aiCorrelationId),
      };
    }
    const framework = generateMiniScriptFrameworkStub(params);
    emitTrace({
      provider: fetchResult.provider,
      model: fetchResult.model,
      success: false,
      fallbackUsed: true,
      errorCode: 'schema_error',
    });
    return {
      framework,
      meta: { promptVersion, fallbackUsed: true, llmAccepted: false },
      aiResponseMeta: buildFallbackAIMeta('schema_error', promptVersion, aiCorrelationId),
    };
  }

  const framework = generateMiniScriptFrameworkStub(params);
  emitTrace({
    provider: fetchResult.provider,
    model: fetchResult.model,
    success: false,
    fallbackUsed: true,
    errorCode: fetchResult.reason,
  });
  return {
    framework,
    meta: { promptVersion, fallbackUsed: true, llmAccepted: false },
    aiResponseMeta: buildFallbackAIMeta(
      fetchResult.reason ?? 'llm_error',
      promptVersion,
      aiCorrelationId,
    ),
  };
}

/** Async orchestrator: prefer LLM JSON when `SOCIAL_MINISCRIPT_LLM_ENABLED`, else stub; always schema-valid. */
export async function generateMiniScriptFramework(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): Promise<MiniScriptStoryFramework> {
  const { framework } = await generateMiniScriptFrameworkWithMeta(params);
  return framework;
}
