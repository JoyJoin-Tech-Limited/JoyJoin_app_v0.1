/**
 * MiniScript Agent — Two-Pass Generation + Validation + Catalog Fallback
 *
 * Pass 1: Generate draft framework (non-thinking mode, fast, creative)
 * Pass 2: Validate logical consistency (thinking mode, deliberate)
 * Fallback: Curated catalog if either pass fails or times out
 */

import type {
  MiniScriptGenre,
  MiniScriptStoryFramework,
  MiniScriptStyle,
} from '@shared/miniscriptStoryFramework';
import {
  miniScriptStoryFrameworkSchema,
  parseMiniScriptStoryFramework,
} from '@shared/miniscriptStoryFramework';
import { getGameModeConfig } from '@shared/miniscriptGameModes';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
  type LiveAIProvider,
} from '@shared/types/aiMeta';
import {
  buildMiniScriptGenerationPrompt,
  MINISCRIPT_GENERATION_PROMPT_VERSION,
} from '../ai/miniscriptPrompts';
import { getClientForFunction, getDeepseekSelection } from '../ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './aiTraceLogger';
import { recordAIProviderRecoveryMetric } from '../middleware/metrics';
import { validateMiniScriptFramework } from './miniscriptValidator';
import { findCatalogEntry, getRandomCatalogEntry } from './miniscriptCatalog';
import { logger } from "./logger";
import { buildArchetypeContext } from './contextInjector';
import { validateCraft } from './writingCraftValidator';

/** Total timeout for both passes + overhead. */
const PIPELINE_TIMEOUT_MS = 32_000;

function isMiniscriptLlmEnabled(): boolean {
  const v = process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v === '1' || v?.toLowerCase() === 'true';
}

function isValidationEnabled(): boolean {
  const v = process.env.SOCIAL_MINISCRIPT_VALIDATION_ENABLED;
  // Default: enabled when LLM is enabled
  if (v === undefined || v === '') return isMiniscriptLlmEnabled();
  return v === '1' || v?.toLowerCase() === 'true';
}

// ─── Catalog Fallback ─────────────────────────────────────────────────────────

function getCatalogFallback(params: {
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  playerCount: number;
}): MiniScriptStoryFramework {
  const exact = findCatalogEntry(params.style, params.genres);
  if (exact) {
    return adaptCatalogEntry(exact.framework, params.playerCount);
  }

  const random = getRandomCatalogEntry(params.style, params.genres);
  if (random) {
    return adaptCatalogEntry(random.framework, params.playerCount);
  }

  // Ultimate fallback: generic v2 stub
  return generateV2Stub(params);
}

/**
 * Adapt a catalog entry to the requested player count.
 * If catalog has fewer characters, duplicate/adjust. If more, slice.
 */
function adaptCatalogEntry(
  framework: MiniScriptStoryFramework,
  playerCount: number
): MiniScriptStoryFramework {
  const n = Math.min(6, Math.max(4, playerCount));
  if (framework.characters.length === n) return framework;

  const chars = framework.characters.slice(0, n);
  const knowledge = framework.playerKnowledge.slice(0, n);

  // Re-index slotIndices
  chars.forEach((c, i) => {
    c.slotIndex = i;
  });
  knowledge.forEach((k, i) => {
    k.slotIndex = i;
  });

  return {
    ...framework,
    characters: chars,
    playerKnowledge: knowledge,
  };
}

// ─── Deterministic V2 Stub ────────────────────────────────────────────────────

function generateV2Stub(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): MiniScriptStoryFramework {
  const n = Math.min(6, Math.max(4, params.playerCount));
  const config = getGameModeConfig(params.genres);

  const stylePremise: Record<MiniScriptStyle, string> = {
    western_court: '凡尔赛厅里丢了一枚象征家族荣誉的胸针，众人各怀心事。',
    medieval: '城堡晚宴前，粮仓钥匙不翼而飞，怀疑像雾一样蔓延。',
    ancient_chinese: '灯会前夜，一封未署名的信落在茶楼，牵出几段旧缘。',
    xianxia: '灵舟靠岸时，匣中空无一物，只剩一缕若有若无的檀香。',
    future_tech: '轨道站上，一份实验记录被覆盖，谁在隐瞒什么？',
    modern_urban: '写字楼茶水间里，一份合同草稿被撕去关键页，气氛微妙。',
    republican_era: '小城戏院后台，一封戏票与半张照片，让旧识重逢。',
  };

  const sins = ['怠惰', '虚荣', '嘴硬', '心软', '逞强', '逃避'];

  const characters = Array.from({ length: n }, (_, slotIndex) => ({
    slotIndex,
    roleLabel: `角色 ${slotIndex + 1}`,
    sinHook: `被「${sins[slotIndex % sins.length]}」轻轻绊了一下脚——一件无伤大雅的小麻烦。`,
    alibi: `当时在场，但只记得模糊的细节，足够真诚又不够完美。`,
    secret: `心里还藏着一句没说出口的道歉或感谢。`,
  }));

  const act_flow = [
    {
      actNumber: 1,
      title: '开场：各自落座',
      beats: ['交代场景', '每人一句立场', '埋下第一个小误会'],
      cliffhanger: '可是，谁都不愿意第一个开口。',
    },
    {
      actNumber: 2,
      title: '升温：线索交汇',
      beats: ['交换信息', '发现矛盾点', '集体做一次轻推理投票'],
      cliffhanger: '他说的话，和之前对不上了。',
    },
    {
      actNumber: 3,
      title: '收束：温柔落地',
      beats: ['揭开误会层', '保留一点体面', '为复盘留空间'],
    },
  ];

  const clues = Array.from({ length: Math.min(n, config.clueCountRange[1]) }, (_, i) => ({
    clueId: `c${i + 1}`,
    text: `线索 ${i + 1}：某个细节暗示了真相的一角……`,
    revealedInAct: Math.min(3, i + 1),
    implies: i < 2 ? [`c${i + 2}`] : undefined,
  }));

  const playerKnowledge = characters.map((c) => ({
    slotIndex: c.slotIndex,
    knownFacts: [`我是${c.roleLabel}`, c.alibi],
    secretAgenda: c.secret,
    truthfulAlibi: c.alibi,
  }));

  const raw: MiniScriptStoryFramework = {
    schemaVersion: 2,
    style: params.style,
    genres: params.genres,
    gameModeConfig: {
      clueCountRange: config.clueCountRange,
      hasRedHerrings: config.hasRedHerrings,
      hasHiddenAgendas: config.hasHiddenAgendas,
      votingStyle: config.votingStyle,
      winCondition: config.winCondition,
      targetPlayMinutes: config.targetPlayMinutes,
      difficulty: config.difficulty,
    },
    premise: `${stylePremise[params.style]}（基调：${params.genres.join('、')}；低冲突、无暴力描写。）`,
    characters,
    act_flow,
    ending: {
      resolutionSummary: '真相并不锋利：大多是误会、胆怯与好意叠在一起。用一句道歉或一次击掌收尾即可。',
      confessionMechanic: '主持人邀请每人用一句话「认领」自己的小秘密，不评判，只倾听。',
    },
    clues,
    solution: {
      who: characters[0]?.roleLabel ?? '未知角色',
      what: '一场误会',
      why: '因为大家都太在乎别人的看法',
    },
    playerKnowledge,
  };

  return miniScriptStoryFrameworkSchema.parse(raw);
}

// ─── Pass 1: Generation ───────────────────────────────────────────────────────

async function pass1Generate(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  config: ReturnType<typeof getGameModeConfig>;
  lite?: boolean;
  signal?: AbortSignal;
  roster?: Array<{ archetype?: string }>;
}): Promise<{
  ok: boolean;
  framework?: MiniScriptStoryFramework;
  provider?: AIProvider;
  model?: string;
  latencyMs?: number;
  deepSeekRecoveryUsed?: boolean;
  errorCode?: string;
}> {
  const t0 = Date.now();
  const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
  const prompt = buildMiniScriptGenerationPrompt({
    playerCount: params.playerCount,
    style: params.style,
    genres: params.genres,
    config: params.config,
    lite: params.lite,
    sessionContext: sessionContext?.mixText ? { mixText: sessionContext.mixText } : undefined,
  });

  let selection;
  try {
    selection = getClientForFunction('generateMiniScriptFramework');
  } catch {
    return { ok: false, errorCode: 'no_credentials', latencyMs: Date.now() - t0 };
  }

  // Primary attempt
  const primary = await fetchFrameworkOnce({
    selection,
    system: prompt.system,
    user: prompt.user,
    useJsonObject: true,
    signal: params.signal,
  });

  if (primary.ok) {
    return {
      ok: true,
      framework: primary.framework,
      provider: primary.provider,
      model: primary.model,
      latencyMs: Date.now() - t0,
    };
  }

  // Recovery: MiniMax failed, try DeepSeek
  if (selection.provider === 'minimax' && process.env.DEEPSEEK_API_KEY) {
    const second = await fetchFrameworkOnce({
      selection: getDeepseekSelection(),
      system: prompt.system,
      user: prompt.user,
      useJsonObject: true,
      signal: params.signal,
    });
    if (second.ok) {
      return {
        ok: true,
        framework: second.framework,
        provider: second.provider,
        model: second.model,
        latencyMs: Date.now() - t0,
        deepSeekRecoveryUsed: true,
      };
    }
  }

  return {
    ok: false,
    provider: primary.provider,
    model: primary.model,
    latencyMs: Date.now() - t0,
    errorCode: primary.errorCode ?? 'generation_failed',
  };
}

interface FetchFrameworkOnceParams {
  selection: { client: any; model: string; provider: AIProvider };
  system: string;
  user: string;
  useJsonObject: boolean;
  signal?: AbortSignal;
}

async function fetchFrameworkOnce(
  params: FetchFrameworkOnceParams
): Promise<{
  ok: boolean;
  framework?: MiniScriptStoryFramework;
  provider?: AIProvider;
  model?: string;
  errorCode?: string;
}> {
  const { selection, system, user, useJsonObject, signal } = params;

  try {
    const apiParams: any = {
      model: selection.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      max_tokens: 2500,
    };

    if (useJsonObject) {
      apiParams.response_format = { type: 'json_object' };
    }

    const response = await selection.client.chat.completions.create(apiParams, { signal });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    if (!content) {
      return { ok: false, provider: selection.provider, model: selection.model, errorCode: 'empty_response' };
    }

    // Try parsing — may be wrapped in markdown fences
    let parsed: unknown;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
      parsed = JSON.parse(jsonMatch?.[1]?.trim() ?? content);
    } catch {
      return { ok: false, provider: selection.provider, model: selection.model, errorCode: 'parse_error' };
    }

    // Use the v2 parse which supports v1→v2 migration
    const framework = parseMiniScriptStoryFramework(parsed);

    return {
      ok: true,
      framework,
      provider: selection.provider,
      model: selection.model,
    };
  } catch (error) {
    logger.error('[MiniScriptAgent] fetch error:', { error: error instanceof Error ? error.message : String(error) });
    const code = error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'llm_error';
    return {
      ok: false,
      provider: selection.provider,
      model: selection.model,
      errorCode: code,
    };
  }
}

// ─── Host Authority ───────────────────────────────────────────────────────────

function applyHostAuthority(
  parsed: MiniScriptStoryFramework,
  params: { style: MiniScriptStyle; genres: MiniScriptGenre[]; playerCount: number }
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

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export type GenerateMiniScriptFrameworkMeta = {
  promptVersion: string;
  fallbackUsed: boolean;
  llmAccepted: boolean;
  providerRecoveryUsed?: boolean;
  validationUsed?: boolean;
  validationScore?: number;
  catalogUsed?: boolean;
};

/**
 * Two-pass generation with validation + catalog fallback.
 *
 * Pipeline:
 *   1. If LLM disabled → catalog fallback
 *   2. Pass 1: Generate draft (non-thinking)
 *   3. If Pass 1 fails → catalog fallback
 *   4. Pass 2: Validate (thinking) — if disabled, skip
 *   5. If Pass 2 fails → catalog fallback
 *   6. Return validated framework
 */
export async function generateMiniScriptFrameworkWithMeta(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  lite?: boolean;
  roster?: Array<{ archetype?: string }>;
}): Promise<{
  framework: MiniScriptStoryFramework;
  meta: GenerateMiniScriptFrameworkMeta;
  aiResponseMeta: AIResponseMeta;
}> {
  const aiCorrelationId = createAiCorrelationId();
  const promptVersion = MINISCRIPT_GENERATION_PROMPT_VERSION;
  const tAll = Date.now();
  const config = getGameModeConfig(params.genres);

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

  // ── LLM disabled → immediate catalog fallback ──────────────────────────────
  if (!isMiniscriptLlmEnabled()) {
    const framework = getCatalogFallback(params);
    emitTrace({ provider: null, success: true, fallbackUsed: true, errorCode: 'llm_disabled' });
    return {
      framework,
      meta: {
        promptVersion,
        fallbackUsed: true,
        llmAccepted: false,
        catalogUsed: true,
      },
      aiResponseMeta: buildFallbackAIMeta('llm_disabled', promptVersion, aiCorrelationId),
    };
  }

  // ── Pass 1: Generate ───────────────────────────────────────────────────────
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PIPELINE_TIMEOUT_MS);

  const pass1 = await pass1Generate({
    ...params,
    config,
    signal: controller.signal,
    roster: params.roster,
  });

  if (!pass1.ok || !pass1.framework) {
    clearTimeout(timer);
    const framework = getCatalogFallback(params);
    emitTrace({
      provider: pass1.provider ?? null,
      model: pass1.model,
      success: false,
      fallbackUsed: true,
      errorCode: pass1.errorCode ?? 'generation_failed',
    });
    return {
      framework,
      meta: {
        promptVersion,
        fallbackUsed: true,
        llmAccepted: false,
        catalogUsed: true,
      },
      aiResponseMeta: buildFallbackAIMeta(
        pass1.errorCode ?? 'generation_failed',
        promptVersion,
        aiCorrelationId
      ),
    };
  }

  // Apply host authority (ensure style/genres match request)
  const withAuthority = applyHostAuthority(pass1.framework, params);
  if (!withAuthority) {
    clearTimeout(timer);
    const framework = getCatalogFallback(params);
    emitTrace({
      provider: pass1.provider!,
      model: pass1.model,
      success: false,
      fallbackUsed: true,
      errorCode: 'host_authority_mismatch',
    });
    return {
      framework,
      meta: {
        promptVersion,
        fallbackUsed: true,
        llmAccepted: false,
        catalogUsed: true,
      },
      aiResponseMeta: buildFallbackAIMeta('host_authority_mismatch', promptVersion, aiCorrelationId),
    };
  }

  // ── Pass 2: Validate (optional, gated by env) ──────────────────────────────
  if (isValidationEnabled()) {
    const pass2 = await validateMiniScriptFramework({
      draft: withAuthority,
      config,
    });

    if (!pass2.valid) {
      clearTimeout(timer);
      const framework = getCatalogFallback(params);
      emitTrace({
        provider: pass1.provider!,
        model: pass1.model,
        success: false,
        fallbackUsed: true,
        errorCode: pass2.meta.fixable ? 'validation_fixable' : 'validation_failed',
      });
      return {
        framework,
        meta: {
          promptVersion,
          fallbackUsed: true,
          llmAccepted: true,
          providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
          validationUsed: true,
          validationScore: pass2.meta.score,
          catalogUsed: true,
        },
        aiResponseMeta: buildFallbackAIMeta(
          pass2.meta.fixable ? 'validation_fixable' : 'validation_failed',
          promptVersion,
          aiCorrelationId
        ),
      };
    }

    // Validation passed
    clearTimeout(timer);

    if (pass1.deepSeekRecoveryUsed) {
      recordAIProviderRecoveryMetric({ domain: 'miniscript', feature: 'generateMiniScriptFramework' });
    }

    // Craft quality diagnostic (non-blocking — logs for monitoring)
    const narrativeText = [
      withAuthority.premise,
      ...withAuthority.characters.flatMap(c => [c.roleLabel, c.sinHook, c.alibi]),
      withAuthority.ending.resolutionSummary,
      withAuthority.ending.confessionMechanic,
    ].join('\n');
    const craftDiag = validateCraft(narrativeText, 'narrative');
    if (craftDiag.craftScore < 70) {
      logger.info('[MiniScriptAgent] Craft score below threshold', {
        craftScore: craftDiag.craftScore,
        issues: craftDiag.fixableIssues.length,
      });
    }

    const live = buildLiveAIMeta(pass1.provider as LiveAIProvider, promptVersion, aiCorrelationId);
    emitTrace({
      provider: pass1.provider!,
      model: pass1.model,
      success: true,
      fallbackUsed: pass1.deepSeekRecoveryUsed ?? false,
    });

    return {
      framework: withAuthority,
      meta: {
        promptVersion,
        fallbackUsed: pass1.deepSeekRecoveryUsed ?? false,
        llmAccepted: true,
        providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
        validationUsed: true,
        validationScore: pass2.meta.score,
        catalogUsed: false,
      },
      aiResponseMeta: pass1.deepSeekRecoveryUsed ? { ...live, fallbackUsed: true } : live,
    };
  }

  // Validation skipped
  clearTimeout(timer);

  if (pass1.deepSeekRecoveryUsed) {
    recordAIProviderRecoveryMetric({ domain: 'miniscript', feature: 'generateMiniScriptFramework' });
  }

  // Craft quality diagnostic (non-blocking)
  const narrativeTextSkipped = [
    withAuthority.premise,
    ...withAuthority.characters.flatMap(c => [c.roleLabel, c.sinHook, c.alibi]),
    withAuthority.ending.resolutionSummary,
    withAuthority.ending.confessionMechanic,
  ].join('\n');
  const craftDiagSkipped = validateCraft(narrativeTextSkipped, 'narrative');
  if (craftDiagSkipped.craftScore < 70) {
    logger.info('[MiniScriptAgent] Craft score below threshold (no-validation path)', {
      craftScore: craftDiagSkipped.craftScore,
      issues: craftDiagSkipped.fixableIssues.length,
    });
  }

  const live = buildLiveAIMeta(pass1.provider as LiveAIProvider, promptVersion, aiCorrelationId);
  emitTrace({
    provider: pass1.provider!,
    model: pass1.model,
    success: true,
    fallbackUsed: pass1.deepSeekRecoveryUsed ?? false,
  });

  return {
    framework: withAuthority,
    meta: {
      promptVersion,
      fallbackUsed: pass1.deepSeekRecoveryUsed ?? false,
      llmAccepted: true,
      providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
      validationUsed: false,
      catalogUsed: false,
    },
    aiResponseMeta: pass1.deepSeekRecoveryUsed ? { ...live, fallbackUsed: true } : live,
  };
}

/** Async orchestrator: two-pass + validation + catalog fallback; always schema-valid. */
export async function generateMiniScriptFramework(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): Promise<MiniScriptStoryFramework> {
  const { framework } = await generateMiniScriptFrameworkWithMeta(params);
  return framework;
}
