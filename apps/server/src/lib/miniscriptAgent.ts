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
  deriveMiniScriptTitleFromPremise,
  resolveMiniScriptTitle,
  MINISCRIPT_TITLE_MAX_CHARS,
} from '@shared/miniscriptStoryFramework';
import { getGameModeConfig } from '@shared/miniscriptGameModes';
import {
  getMiniScriptGenreLabel,
  sanitizeMiniScriptUserText,
} from '@shared/miniscriptCatalog';
import {
  findCuratedMiniScriptStory,
  MINISCRIPT_CURATED_STORIES,
} from '@shared/miniscriptCuratedStories';
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
import { isLLMTimeoutError, raceWithTimeout } from '../socialIcebreakerAICore';
import { createAiCorrelationId, logAITrace } from './aiTraceLogger';
import { recordAIProviderRecoveryMetric } from '../middleware/metrics';
import { validateMiniScriptFramework } from './miniscriptValidator';
import { runMiniScriptRuntimeCritic } from './miniscriptCritic';
import {
  moderateGeneratedContent,
  type ModerationCheck,
  type ModerationResult,
} from './aiContentModeration';
import { findCatalogEntry, getRandomCatalogEntry } from './miniscriptCatalog';
import { logger } from "./logger";
import { buildArchetypeContext } from './contextInjector';
import {
  buildRosterCharacterTraits,
  type RosterSignalMember,
} from './icebreakerRosterSignals';
import { getFeatureFlag } from './featureFlags';
import { validateCraft } from './writingCraftValidator';

/**
 * Total hard bound for the whole generation pipeline (pass 1 + pass 2 share it
 * as a remaining-budget deadline). Enforced via deterministic Promise.race
 * (raceWithTimeout) so a stalled provider socket can never freeze the generate
 * route — the AbortSignal is only a cooperative backstop the SDK may ignore.
 * Must stay under the mini-program's 35s POST timeout and nginx's 60s proxy
 * timeout, leaving headroom for fallback persistence.
 */
const PIPELINE_TIMEOUT_MS = 28_000;

/** Test/ops override hook; production default stays PIPELINE_TIMEOUT_MS. */
function pipelineTimeoutMs(): number {
  const override = Number(process.env.SOCIAL_MINISCRIPT_PIPELINE_TIMEOUT_MS);
  return Number.isFinite(override) && override > 0 ? override : PIPELINE_TIMEOUT_MS;
}

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

/**
 * The v2 stub is a dev convenience, not a playable script (nameless roles,
 * duplicated secrets, placeholder clues). It may only serve outside
 * production, or when ops explicitly opts in via MINISCRIPT_ENABLE_STUB_FALLBACK.
 */
export function isMiniscriptStubFallbackEnabled(): boolean {
  if (process.env.MINISCRIPT_ENABLE_STUB_FALLBACK === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Normalize everything the client will render: resolve a ≤12-char title
 * (deriving from the premise when absent/over-long) and scrub any echoed
 * style/genre machine keys from user-facing strings (belt-and-braces — the
 * prompt also forbids them). Idempotent.
 */
function resolveWhoSlot(framework: MiniScriptStoryFramework): number | undefined {
  const { solution } = framework;
  if (!solution) return undefined;
  if (solution.whoSlot != null) {
    const n = framework.characters.length;
    if (solution.whoSlot >= 1 && solution.whoSlot <= n) return solution.whoSlot;
  }
  // Fallback: match solution.who against the base roleLabel (strip "·新客" suffix
  // that adaptCatalogEntry adds for duplicated roles).
  const baseWho = solution.who.replace(/·新客$/, '').trim();
  const idx = framework.characters.findIndex(
    (c) => c.roleLabel.replace(/·新客$/, '').trim() === baseWho,
  );
  return idx >= 0 ? idx + 1 : undefined;
}

function finalizeFrameworkUserSurfaces(
  framework: MiniScriptStoryFramework,
): MiniScriptStoryFramework {
  const resolvedWhoSlot = resolveWhoSlot(framework);
  return {
    ...framework,
    title: sanitizeMiniScriptUserText(
      resolveMiniScriptTitle(framework.title, framework.premise),
    ),
    premise: sanitizeMiniScriptUserText(framework.premise),
    characters: framework.characters.map((character) => ({
      ...character,
      roleLabel: sanitizeMiniScriptUserText(character.roleLabel),
    })),
    clues: framework.clues.map((clue) => ({
      ...clue,
      text: sanitizeMiniScriptUserText(clue.text),
    })),
    // C3: every user-facing string on the act flow + motive options gets the
    // same machine-key scrub — an LLM that echoes style/genre tokens into
    // evidence copy, reaction text, or act beats must not ship them to
    // players (WeChat review posture: no raw enum keys in visible copy).
    act_flow: framework.act_flow.map((act) => ({
      ...act,
      title: sanitizeMiniScriptUserText(act.title),
      beats: act.beats.map((beat) => sanitizeMiniScriptUserText(beat)),
      ...(act.cliffhanger !== undefined
        ? { cliffhanger: sanitizeMiniScriptUserText(act.cliffhanger) }
        : {}),
      ...(act.evidence !== undefined
        ? {
            evidence: act.evidence.map((item) => ({
              ...item,
              name: sanitizeMiniScriptUserText(item.name),
              description: sanitizeMiniScriptUserText(item.description),
              iconKey: sanitizeMiniScriptUserText(item.iconKey),
              ...(item.evidenceReactions !== undefined
                ? {
                    evidenceReactions: Object.fromEntries(
                      Object.entries(item.evidenceReactions).map(([slot, text]) => [
                        slot,
                        sanitizeMiniScriptUserText(text),
                      ]),
                    ),
                  }
                : {}),
            })),
          }
        : {}),
    })),
    ...(framework.motiveOptions !== undefined
      ? { motiveOptions: framework.motiveOptions.map((m) => sanitizeMiniScriptUserText(m)) }
      : {}),
    ending: {
      ...framework.ending,
      resolutionSummary: sanitizeMiniScriptUserText(
        framework.ending.resolutionSummary,
      ),
      confessionMechanic: sanitizeMiniScriptUserText(
        framework.ending.confessionMechanic ?? '',
      ),
    },
    solution: {
      ...framework.solution,
      who: sanitizeMiniScriptUserText(framework.solution.who),
      what: sanitizeMiniScriptUserText(framework.solution.what),
      why: sanitizeMiniScriptUserText(framework.solution.why),
      ...(resolvedWhoSlot != null ? { whoSlot: resolvedWhoSlot } : {}),
    },
  };
}

/**
 * W7.2 — collect every user-visible (or player-revealed) string from a generated
 * framework so the WeChat review-vocab gate (匹配/社交/灵魂/撮合/AI) and the
 * profanity filter can scan the whole story before it is persisted. Machine
 * identifiers (`style`/`genres` keys, `clueId`, `evidence.id`/`iconKey`, the
 * `fromClues` clue-id references) are deliberately excluded — they are not
 * user-facing copy and are label-scrubbed separately by
 * `finalizeFrameworkUserSurfaces`.
 */
function collectFrameworkModerationChecks(
  framework: MiniScriptStoryFramework,
): ModerationCheck[] {
  const checks: ModerationCheck[] = [
    { field: 'title', text: framework.title },
    { field: 'premise', text: framework.premise },
    { field: 'ending.resolutionSummary', text: framework.ending.resolutionSummary },
    { field: 'ending.confessionMechanic', text: framework.ending.confessionMechanic },
    { field: 'solution.who', text: framework.solution.who },
    { field: 'solution.what', text: framework.solution.what },
    { field: 'solution.why', text: framework.solution.why },
  ];

  framework.characters.forEach((character, i) => {
    checks.push(
      { field: `characters[${i}].roleLabel`, text: character.roleLabel },
      { field: `characters[${i}].sinHook`, text: character.sinHook },
      { field: `characters[${i}].alibi`, text: character.alibi },
      // Revealed to the owning player at the revelation beat — still AI copy.
      { field: `characters[${i}].secret`, text: character.secret },
    );
  });

  framework.clues.forEach((clue, i) => {
    checks.push({ field: `clues[${i}].text`, text: clue.text });
  });

  framework.act_flow.forEach((act, i) => {
    checks.push(
      { field: `act_flow[${i}].title`, text: act.title },
      { field: `act_flow[${i}].cliffhanger`, text: act.cliffhanger },
      ...act.beats.map((beat, j) => ({
        field: `act_flow[${i}].beats[${j}]`,
        text: beat,
      })),
    );
    act.evidence?.forEach((item, j) => {
      checks.push(
        { field: `act_flow[${i}].evidence[${j}].name`, text: item.name },
        { field: `act_flow[${i}].evidence[${j}].description`, text: item.description },
      );
      if (item.evidenceReactions) {
        for (const [slot, text] of Object.entries(item.evidenceReactions)) {
          checks.push({
            field: `act_flow[${i}].evidence[${j}].evidenceReactions[${slot}]`,
            text,
          });
        }
      }
    });
  });

  framework.playerKnowledge.forEach((knowledge, i) => {
    checks.push(
      { field: `playerKnowledge[${i}].secretAgenda`, text: knowledge.secretAgenda },
      { field: `playerKnowledge[${i}].truthfulAlibi`, text: knowledge.truthfulAlibi },
      ...knowledge.knownFacts.map((fact, j) => ({
        field: `playerKnowledge[${i}].knownFacts[${j}]`,
        text: fact,
      })),
    );
  });

  framework.motiveOptions?.forEach((motive, i) => {
    checks.push({ field: `motiveOptions[${i}]`, text: motive });
  });
  framework.voteOptions?.what.forEach((option, i) => {
    checks.push({ field: `voteOptions.what[${i}]`, text: option });
  });
  framework.voteOptions?.why.forEach((option, i) => {
    checks.push({ field: `voteOptions.why[${i}]`, text: option });
  });
  framework.redHerrings?.forEach((herring, i) => {
    checks.push(
      { field: `redHerrings[${i}].text`, text: herring.text },
      { field: `redHerrings[${i}].misleadingTarget`, text: herring.misleadingTarget },
    );
  });
  framework.deductionChain?.forEach((step, i) => {
    checks.push({ field: `deductionChain[${i}].conclusion`, text: step.conclusion });
  });

  return checks;
}

/**
 * W7.2 — deterministic content gate for the generated framework. Returns the
 * `moderateGeneratedContent` verdict, failing closed (`safe: false`) if the
 * moderator itself throws so a broken gate can never ship unreviewed copy.
 */
function moderateFrameworkSurfaces(params: {
  framework: MiniScriptStoryFramework;
  provider: AIProvider;
  model?: string;
  latencyMs: number;
  promptVersion: string;
  traceId: string;
}): ModerationResult {
  try {
    return moderateGeneratedContent(
      collectFrameworkModerationChecks(params.framework),
      {
        domain: 'icebreaker',
        feature: 'generateMiniScriptFramework',
        provider: params.provider,
        model: params.model,
        latencyMs: params.latencyMs,
        promptVersion: params.promptVersion,
        traceId: params.traceId,
        // WeChat review posture (W7.2): no visible AI string may contain
        // 匹配/社交/灵魂/撮合/AI. A hit degrades the framework to curated
        // fallback — never ship blocked vocab.
        enforceReviewVocab: true,
      },
    );
  } catch (error) {
    logger.error('[MiniScriptAgent] moderation failed — failing closed to catalog fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { safe: false, field: 'moderation', message: 'moderation_error' };
  }
}

/**
 * W5 (AC-W5.4): the curated failure fallback must not be roster-blind. When the
 * `icebreakerMatchingAwareEnabled` flag is on and the matched roster is known,
 * overlay every character slot with a real player's name + top interest/
 * archetype — the same guarantee the live prompt path asks the LLM for.
 *
 * Coherence: the culprit (`solution.who`) is re-pointed at the woven role it
 * already targeted, and each slot's private `playerKnowledge` is rewritten to
 * match its woven role so a player never receives another character's secret.
 *
 * Flag off / no named roster → the framework is returned untouched, keeping the
 * fallback byte-identical to pre-W5 (AC-W5.6).
 */
function weaveRosterTraitsIntoFramework(
  framework: MiniScriptStoryFramework,
  params: { roster?: RosterSignalMember[]; includeRosterTraits?: boolean },
): MiniScriptStoryFramework {
  if (!params.includeRosterTraits || !params.roster || params.roster.length === 0) {
    return framework;
  }
  const traits = buildRosterCharacterTraits(params.roster, framework.characters.length);
  if (!traits) return framework;

  const characters = framework.characters.map((character, slotIndex) => {
    const trait = traits[slotIndex]!;
    return {
      ...character,
      roleLabel: trait.roleLabel,
      sinHook: trait.sinHook,
      alibi: trait.alibi,
      secret: trait.secret,
    };
  });

  const { whoSlot } = framework.solution;
  let solution = framework.solution;
  if (whoSlot != null && whoSlot >= 1 && whoSlot <= characters.length) {
    solution = { ...solution, who: characters[whoSlot - 1]!.roleLabel };
  } else {
    const priorIdx = framework.characters.findIndex((c) => c.roleLabel === framework.solution.who);
    if (priorIdx >= 0) solution = { ...solution, who: characters[priorIdx]!.roleLabel };
  }

  const playerKnowledge = framework.playerKnowledge.map((knowledge) => {
    const woven = characters[knowledge.slotIndex];
    if (!woven) return knowledge;
    return {
      ...knowledge,
      knownFacts: [`我是${woven.roleLabel}`, woven.alibi].slice(0, 6),
      secretAgenda: woven.secret,
      truthfulAlibi: woven.alibi,
    };
  });

  return { ...framework, characters, playerKnowledge, solution };
}

function getCatalogFallback(params: {
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  playerCount: number;
  roster?: RosterSignalMember[];
  /** W5: gate the roster weave so flag-off stays byte-identical to pre-W5. */
  includeRosterTraits?: boolean;
}): MiniScriptStoryFramework {
  const warnFallback = (source: string) =>
    logger.warn('[MiniScriptAgent] fallback path taken', {
      source,
      style: params.style,
      genres: params.genres,
      playerCount: params.playerCount,
      rosterWeaved: params.includeRosterTraits === true && (params.roster?.length ?? 0) > 0,
    });

  const finalize = (framework: MiniScriptStoryFramework) =>
    finalizeFrameworkUserSurfaces(weaveRosterTraitsIntoFramework(framework, params));

  const exact = findCatalogEntry(params.style, params.genres);
  if (exact) {
    warnFallback('catalog_exact');
    return finalize(adaptCatalogEntry(exact.framework, params));
  }

  const random = getRandomCatalogEntry(params.style, params.genres);
  if (random) {
    warnFallback('catalog_random');
    return finalize(adaptCatalogEntry(random.framework, params));
  }

  // Production-grade fallback: complete playable frameworks from the shared
  // curated registry (covers styles the server catalog lacks, e.g. western_court).
  const curated = findCuratedMiniScriptStory(params.style, params.genres);
  if (curated) {
    warnFallback('curated_shared');
    return finalize(adaptCatalogEntry(curated, params));
  }

  // Dev-only last resort: the intentionally thin v2 stub. Never served in
  // production unless MINISCRIPT_ENABLE_STUB_FALLBACK explicitly opts in.
  if (isMiniscriptStubFallbackEnabled()) {
    warnFallback('v2_stub_dev_only');
    return finalize(generateV2Stub(params));
  }

  // Unreachable while the curated registry is non-empty. Defensive: in
  // production never ship the stub — adapt the first curated story off-style.
  logger.error('[MiniScriptAgent] curated registry exhausted; adapting first curated story', {
    style: params.style,
    genres: params.genres,
  });
  return finalize(adaptCatalogEntry(MINISCRIPT_CURATED_STORIES[0]!, params));
}

/**
 * Adapt a catalog entry to the requested player count.
 * If catalog has fewer characters, duplicate/adjust. If more, slice.
 */
export function adaptCatalogEntry(
  framework: MiniScriptStoryFramework,
  params: {
    playerCount: number;
    style: MiniScriptStyle;
    genres: MiniScriptGenre[];
  },
): MiniScriptStoryFramework {
  const n = Math.min(6, Math.max(4, params.playerCount));
  const chars = Array.from({ length: n }, (_, slotIndex) => {
    const source = framework.characters[slotIndex % framework.characters.length]!;
    return {
      ...source,
      slotIndex,
      roleLabel: slotIndex < framework.characters.length
        ? source.roleLabel
        : `${source.roleLabel}·新客`,
    };
  });
  const knowledge = Array.from({ length: n }, (_, slotIndex) => {
    const source = framework.playerKnowledge[slotIndex % framework.playerKnowledge.length]!;
    return {
      ...source,
      slotIndex,
      knownFacts: [...source.knownFacts],
    };
  });
  const config = getGameModeConfig(params.genres);

  return {
    ...framework,
    // Older curated entries carry no title; derive one so the client never
    // falls back to a mid-sentence premise cut.
    title: framework.title ?? deriveMiniScriptTitleFromPremise(framework.premise, MINISCRIPT_TITLE_MAX_CHARS),
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
    characters: chars,
    playerKnowledge: knowledge,
  };
}

// ─── Deterministic V2 Stub ────────────────────────────────────────────────────

/** Dev-only thin stub. Exported so tests can exercise it directly — production
 * sessions must receive a complete curated framework instead. */
export function generateV2Stub(params: {
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

  const styleTitle: Record<MiniScriptStyle, string> = {
    western_court: '失踪的胸针',
    medieval: '消失的粮仓钥匙',
    ancient_chinese: '灯会的无名信',
    xianxia: '空匣之谜',
    future_tech: '被覆盖的记录',
    modern_urban: '茶水间悬案',
    republican_era: '戏院后台的信',
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
    // No self-numbering prefix — the client owns the 「线索 N」 ordinal.
    text: `某个细节暗示了真相的一角……`,
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
    title: styleTitle[params.style],
    gameModeConfig: {
      clueCountRange: config.clueCountRange,
      hasRedHerrings: config.hasRedHerrings,
      hasHiddenAgendas: config.hasHiddenAgendas,
      votingStyle: config.votingStyle,
      winCondition: config.winCondition,
      targetPlayMinutes: config.targetPlayMinutes,
      difficulty: config.difficulty,
    },
    premise: `${stylePremise[params.style]}（基调：${params.genres.map((genre) => getMiniScriptGenreLabel(genre)).join('、')}；低冲突、无暴力描写。）`,
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
      whoSlot: 1,
    },
    playerKnowledge,
    voteOptions: {
      what: ['顺手而为', '借走忘了还', '只是误会一场'],
      why: ['善意', '胆怯', '好面子'],
    },
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
  roster?: Array<{ displayName?: string; archetype?: string; interests?: string[] }>;
  selectedLabel?: string;
  /** W5: when true, weave the roster's names/archetypes/interests into characters. */
  includeRosterTraits?: boolean;
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
    selectedLabel: params.selectedLabel,
    roster: params.includeRosterTraits ? params.roster : undefined,
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
      max_tokens: 3500,
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
  roster?: Array<{ displayName?: string; archetype?: string; interests?: string[] }>;
  selectedLabel?: string;
  onProgress?: (stage: 'generating' | 'validating' | 'fallback', progress: number) => void;
}): Promise<{
  framework: MiniScriptStoryFramework;
  meta: GenerateMiniScriptFrameworkMeta;
  aiResponseMeta: AIResponseMeta;
}> {
  const aiCorrelationId = createAiCorrelationId();
  const promptVersion = MINISCRIPT_GENERATION_PROMPT_VERSION;
  const tAll = Date.now();
  const config = getGameModeConfig(params.genres);
  // W5: roster trait weaving is kill-switched. Flag off → pass1Generate omits
  // the roster block and the prompt is byte-identical to pre-W5.
  const includeRosterTraits = await getFeatureFlag('icebreakerMatchingAwareEnabled', false);
  // W5: pass the same gate into the failure fallback so a roster is only woven
  // when the flag is on (flag-off stays byte-identical to pre-W5).
  const fallbackParams = { ...params, includeRosterTraits };
  params.onProgress?.('generating', 15);

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
    params.onProgress?.('fallback', 86);
    const framework = getCatalogFallback(fallbackParams);
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
  const timeoutMs = pipelineTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Deterministic hard bound: even if the provider socket stalls and the SDK
  // never honors the AbortSignal, pass 1 settles to a failure result inside
  // `timeoutMs` and the pipeline degrades to the curated catalog fallback.
  //
  // Progress heartbeat: pass 1 is the long pole (a 2500-token json_object
  // generation can run 15–25s) and previously emitted zero intermediate
  // progress, freezing the client bar at 15% for the whole call — read by
  // hosts as "stuck" (2026-08-13 生成卡住 incident). Interpolate 15→65 across
  // the budget and stop the moment the race settles, so no late tick can
  // regress the bar after a 'validating'/'fallback'/'persisting' update.
  const pass1StartedAt = Date.now();
  const pass1Heartbeat = setInterval(() => {
    const ratio = Math.min(1, (Date.now() - pass1StartedAt) / timeoutMs);
    params.onProgress?.('generating', Math.round(15 + ratio * 50));
  }, 1500);
  pass1Heartbeat.unref?.();

  const pass1 = await (async () => {
    try {
      return await raceWithTimeout(
        pass1Generate({
          ...params,
          config,
          signal: controller.signal,
          roster: params.roster,
          includeRosterTraits,
        }),
        timeoutMs,
      ).catch((error): Awaited<ReturnType<typeof pass1Generate>> => {
        if (isLLMTimeoutError(error)) {
          logger.error('[MiniScriptAgent] pass 1 hit hard pipeline timeout — settling to catalog fallback', {
            timeoutMs,
          });
          return { ok: false, errorCode: 'pipeline_timeout', latencyMs: Date.now() - tAll };
        }
        throw error;
      });
    } finally {
      clearInterval(pass1Heartbeat);
    }
  })();

  if (!pass1.ok || !pass1.framework) {
    clearTimeout(timer);
    params.onProgress?.('fallback', 86);
    const framework = getCatalogFallback(fallbackParams);
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
  const withAuthorityRaw = applyHostAuthority(pass1.framework, params);
  if (!withAuthorityRaw) {
    clearTimeout(timer);
    params.onProgress?.('fallback', 86);
    const framework = getCatalogFallback(fallbackParams);
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

  // Normalize user-facing surfaces (title resolution + enum-token scrub) so an
  // LLM that echoes machine keys or overshoots the title still ships clean copy.
  const withAuthority = finalizeFrameworkUserSurfaces(withAuthorityRaw);

  // ── Content moderation (post-generation, pre-persist; W7.2) ────────────────
  // The mini-script route renders this framework to every player (and reveals
  // character secrets / clues / the solution at later beats), so the generated
  // copy must clear the same deterministic gate the social-icebreaker
  // generators use. Fail-closed: a review-blocked token (匹配/社交/灵魂/撮合/AI),
  // a profanity hit, or a moderator error degrades to the curated catalog
  // fallback (roster weaving still applies) — never ship blocked vocab.
  // Synchronous, so the 28s PIPELINE_TIMEOUT_MS bound is unaffected.
  const moderation = moderateFrameworkSurfaces({
    framework: withAuthority,
    provider: pass1.provider!,
    model: pass1.model,
    latencyMs: Date.now() - tAll,
    promptVersion,
    traceId: aiCorrelationId,
  });
  if (!moderation.safe) {
    clearTimeout(timer);
    params.onProgress?.('fallback', 86);
    const moderationErrorCode = moderation.blockedWord ? 'banned_vocab' : 'content_safety';
    const framework = getCatalogFallback(fallbackParams);
    emitTrace({
      provider: pass1.provider!,
      model: pass1.model,
      success: false,
      fallbackUsed: true,
      errorCode: moderationErrorCode,
    });
    return {
      framework,
      meta: {
        promptVersion,
        fallbackUsed: true,
        // The LLM story was REJECTED by moderation — llmAccepted stays false so
        // the acceptance metric is not corrupted by a rejected generation.
        llmAccepted: false,
        providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
        catalogUsed: true,
      },
      aiResponseMeta: buildFallbackAIMeta(moderationErrorCode, promptVersion, aiCorrelationId),
    };
  }

  // ── Runtime critic (post-generation, pre-persist; flag-gated no-op by default)
  // Runs before pass 2 so a blocked story never burns validation budget. The
  // critic never throws: timeout/budget-exhaustion fail open, a detected
  // violation fails closed to the catalog fallback.
  const critic = await runMiniScriptRuntimeCritic({
    framework: withAuthority,
    remainingBudgetMs: timeoutMs - (Date.now() - tAll),
  });
  if (critic.verdict === 'blocked') {
    clearTimeout(timer);
    params.onProgress?.('fallback', 86);
    const framework = getCatalogFallback(fallbackParams);
    emitTrace({
      provider: pass1.provider!,
      model: pass1.model,
      success: false,
      fallbackUsed: true,
      errorCode: 'runtime_critic_blocked',
    });
    return {
      framework,
      meta: {
        promptVersion,
        fallbackUsed: true,
        // C4: the LLM story was REJECTED by the runtime critic — reporting
        // llmAccepted: true would corrupt the acceptance metric.
        llmAccepted: false,
        providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
        catalogUsed: true,
      },
      aiResponseMeta: buildFallbackAIMeta('runtime_critic_blocked', promptVersion, aiCorrelationId),
    };
  }

  // ── Pass 2: Validate (optional, gated by env) ──────────────────────────────
  if (isValidationEnabled()) {
    params.onProgress?.('validating', 70);
    // Same deterministic bound: pass 2 gets whatever pipeline budget remains.
    // On timeout it degrades to `null` and flows into the catalog fallback
    // branch below exactly like a failed validation.
    const pass2BudgetMs = Math.max(1, timeoutMs - (Date.now() - tAll));
    // Heartbeat: interpolate 70→86 across pass 2's remaining budget so the
    // validation wait also reads as movement, not a freeze. Cleared the moment
    // the race settles — monotonic with the following 'validating' 88 /
    // 'fallback' 86 / 'persisting' 92 updates.
    const pass2StartedAt = Date.now();
    const pass2Heartbeat = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - pass2StartedAt) / pass2BudgetMs);
      params.onProgress?.('validating', Math.round(70 + ratio * 16));
    }, 1500);
    pass2Heartbeat.unref?.();

    const pass2 = await (async () => {
      try {
        return await raceWithTimeout(
          validateMiniScriptFramework({
            draft: withAuthority,
            config,
          }),
          pass2BudgetMs,
        ).catch((error): Awaited<ReturnType<typeof validateMiniScriptFramework>> | null => {
          if (isLLMTimeoutError(error)) {
            logger.error('[MiniScriptAgent] pass 2 hit hard pipeline timeout — settling to catalog fallback', {
              timeoutMs,
            });
            return null;
          }
          throw error;
        });
      } finally {
        clearInterval(pass2Heartbeat);
      }
    })();

    if (!pass2 || !pass2.valid) {
      clearTimeout(timer);
      params.onProgress?.('fallback', 86);
      const framework = getCatalogFallback(fallbackParams);
      const pass2ErrorCode = pass2 == null
        ? 'pipeline_timeout'
        : pass2.meta.fixable
          ? 'validation_fixable'
          : 'validation_failed';
      emitTrace({
        provider: pass1.provider!,
        model: pass1.model,
        success: false,
        fallbackUsed: true,
        errorCode: pass2ErrorCode,
      });
      return {
        framework,
        meta: {
          promptVersion,
          fallbackUsed: true,
          llmAccepted: true,
          providerRecoveryUsed: pass1.deepSeekRecoveryUsed,
          validationUsed: true,
          validationScore: pass2?.meta.score,
          catalogUsed: true,
        },
        aiResponseMeta: buildFallbackAIMeta(pass2ErrorCode, promptVersion, aiCorrelationId),
      };
    }

    // Validation passed
    clearTimeout(timer);
    params.onProgress?.('validating', 88);

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
