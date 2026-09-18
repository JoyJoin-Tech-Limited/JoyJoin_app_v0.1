import type {
  LieDetectiveStatement,
  AuctionLot,
  XiaoyueSessionPack,
  XiaoyueAdaptiveSuggestion,
  MomentHighlightsPanel,
  MomentHighlightAspect,
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema, parseXiaoyueSessionPack } from '@shared/socialIcebreaker';
import { findReviewBlockedVocab } from '@shared/copy/terms';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildLieDetectivePrompt,
  buildLieDetectiveV2Prompt,
  LieDetectiveV2ResponseSchema,
  buildXiaoYueCommentPrompt,
  buildPersonalityDicePrompt,
  buildPersonalityDicePromptV4,
  buildAuctionLotsPrompt,
  buildMiniScriptFrameworkUserMessage,
  buildXiaoyueSessionPackPrompt,
  buildQuipBattlePrompt,
  buildUndercoverWordPrompt,
  buildGroupMirrorPrompt,
  MINISCRIPT_FRAMEWORK_SYSTEM,
  LIE_DETECTIVE_PROMPT_VERSION,
  LIE_DETECTIVE_V2_PROMPT_VERSION,
  PERSONALITY_DICE_PROMPT_VERSION,
  PERSONALITY_DICE_CHOOSE_PROMPT_VERSION,
  AUCTION_LOTS_PROMPT_VERSION,
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
  SESSION_PACK_PROMPT_VERSION,
  XIAOYUE_COMMENT_PROMPT_VERSION,
  UNDERCOVER_WORD_PROMPT_VERSION,
  GROUP_MIRROR_PROMPT_VERSION,
} from './ai/socialIcebreakerPrompts';
import { getRandomQuipBattlePrompts, type QuipBattlePrompt } from '@shared/quipBattle';
import { getFallbackUndercoverPair, type UndercoverWordPair } from '@shared/undercoverWord';
import { buildArchetypeContext } from './lib/contextInjector';
import { getFallbackGroupMirrorQuestions, type GroupMirrorQuestion } from '@shared/groupMirror';
import { getRandomFallbackSet, type LieDetectiveV2FallbackStatement } from '@shared/lieDetectiveFallback';
import { logger } from "./lib/logger";
import { XIAOYUE_PERSONA } from './prompts';
import { validateContentSafe } from './lib/contentSafety';
import { AIServiceResult, fireAndForgetQualityGate, isLLMTimeoutError, raceWithTimeout, RACE_LLM_TIMEOUT_MS } from './socialIcebreakerAICore';
import { attachAIGC, moderateAndAttachAIGC, containsReviewBlockedVocab, type ModerationCheck } from './socialIcebreakerAI/moderation';

export { fireAndForgetQualityGate, isLLMTimeoutError, raceWithTimeout, RACE_LLM_TIMEOUT_MS } from './socialIcebreakerAICore';
export type { AIServiceResult } from './socialIcebreakerAICore';

/** Re-export for downstream consumers that previously imported from this file. */
export { XIAOYUE_COMMENT_PROMPT_VERSION, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION };

function lieDetectiveStatementsChecks(statements: LieDetectiveStatement[]): ModerationCheck[] {
  return statements.map((s, i) => ({ field: `statement[${i}].text`, text: s.text }));
}

function xiaoYueCommentChecks(comment: string): ModerationCheck[] {
  return [{ field: 'comment', text: comment }];
}

function xiaoyueSessionPackChecks(pack: XiaoyueSessionPack): ModerationCheck[] {
  const checks: ModerationCheck[] = [{ field: 'opener', text: pack.opener }];
  for (const [phase, coaching] of Object.entries(pack.phaseCoaching)) {
    checks.push({ field: `phaseCoaching.${phase}.toneLine`, text: coaching.toneLine });
    if (coaching.hostHint) checks.push({ field: `phaseCoaching.${phase}.hostHint`, text: coaching.hostHint });
    if (coaching.energyRescue) checks.push({ field: `phaseCoaching.${phase}.energyRescue`, text: coaching.energyRescue });
  }
  pack.backupPrompts.forEach((prompt, i) => checks.push({ field: `backupPrompts[${i}]`, text: prompt }));
  checks.push({ field: 'recapFraming.open', text: pack.recapFraming.open });
  checks.push({ field: 'recapFraming.highlightTemplate', text: pack.recapFraming.highlightTemplate });
  checks.push({ field: 'recapFraming.close', text: pack.recapFraming.close });
  return checks;
}

function quipBattlePromptsChecks(prompts: QuipBattlePrompt[]): ModerationCheck[] {
  return prompts.flatMap((p, i) => [
    { field: `prompt[${i}].promptText`, text: p.promptText },
    { field: `prompt[${i}].category`, text: p.category },
  ]);
}

function undercoverWordPairChecks(pair: UndercoverWordPair): ModerationCheck[] {
  return [
    { field: 'civilianWord', text: pair.civilianWord },
    { field: 'undercoverWord', text: pair.undercoverWord },
    { field: 'category', text: pair.category },
  ];
}

function groupMirrorQuestionsChecks(questions: GroupMirrorQuestion[]): ModerationCheck[] {
  return questions.map((q, i) => ({ field: `question[${i}].questionText`, text: q.questionText }));
}

const FALLBACK_LIE_DETECTIVE_STATEMENTS: LieDetectiveStatement[][] = [
  [
    { index: 1, text: '我曾在凌晨三点一个人爬过一座山，就是觉得想去了', isLie: false },
    { index: 2, text: '我会说五种语言，虽然都不是很流利', isLie: true },
    { index: 3, text: '我的第一份工作是在便利店上夜班', isLie: false },
  ],
  [
    { index: 1, text: '我上过电视，虽然只有一个背影镜头', isLie: true },
    { index: 2, text: '我养过一只龟，养了整整十年，比有些恋爱还长', isLie: false },
    { index: 3, text: '我大学时是系里长跑第一名，虽然系里只有三个男生', isLie: false },
  ],
  [
    { index: 1, text: '我在飞机上遇到过一位演员，还聊了两句', isLie: false },
    { index: 2, text: '我曾经做过一段时间职业厨师，主要是切配', isLie: true },
    { index: 3, text: '我第一次坐飞机是二十五岁以后，之前一直坐高铁', isLie: false },
  ],
];

function isLieDetectiveLlmEnabled(): boolean {
  const v = process.env.SOCIAL_LIE_DETECTIVE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

/** Determine the effective lie-detective mode. Synchronous fast path covering
 *  resolution tiers (1) session-state override, (3) legacy env
 *  `LIE_DETECTIVE_MODE` fallback, and (4) default 'v1'. Tier (2) — the
 *  DB-backed `lieDetectiveV2Enabled` flag — is resolved once at lie_detective
 *  phase entry by `resolveLieDetectiveModeSnapshot` in
 *  routes/socialIcebreakerHelpers.ts and snapshotted into
 *  `state.lieDetectiveMode`, which then flows in here as `sessionMode`. */
export function getLieDetectiveMode(sessionMode?: 'v1' | 'v2'): 'v1' | 'v2' {
  if (sessionMode) return sessionMode;
  const envMode = process.env.LIE_DETECTIVE_MODE;
  return envMode === 'v2' ? 'v2' : 'v1';
}

/** Compute dynamic difficulty based on reveal history. First 2 rounds always medium. */
export function getDynamicDifficulty(
  history?: Array<{ round: number; correctRate: number }>,
): 'easy' | 'medium' | 'hard' {
  if (!history || history.length < 2) return 'medium';
  const lastTwo = history.slice(-2);
  const avgCorrectRate = lastTwo.reduce((sum, h) => sum + h.correctRate, 0) / lastTwo.length;
  if (avgCorrectRate < 0.4) return 'easy';
  if (avgCorrectRate > 0.6) return 'hard';
  return 'medium';
}

/** Validate user-submitted tags for V2. */
export function validateLieDetectiveV2Tags(tags: unknown): { valid: false; error: string } | { valid: true; tags: [string, string] } {
  if (!Array.isArray(tags) || tags.length !== 2) {
    return { valid: false, error: 'Exactly 2 tags are required' };
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length < 2 || tag.length > 20) {
      return { valid: false, error: 'Each tag must be 2–20 characters' };
    }
    const safetyResult = validateContentSafe(tag, 'tag');
    if (!safetyResult.safe) {
      return { valid: false, error: safetyResult.violation?.message || 'Tag contains inappropriate content' };
    }
  }
  return { valid: true, tags: [tags[0].trim(), tags[1].trim()] as [string, string] };
}

export function validateLieDetectiveTag(tag: unknown): { valid: false; error: string } | { valid: true; tag: string } {
  if (typeof tag !== 'string') {
    return { valid: false, error: '标签格式不正确' };
  }
  const trimmed = tag.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: '标签需要 1-20 个字' };
  }
  const safetyResult = validateContentSafe(trimmed, 'tag');
  if (!safetyResult.safe) {
    return { valid: false, error: safetyResult.violation?.message || '标签包含不合适的内容' };
  }
  return { valid: true, tag: trimmed };
}

export async function generateLieDetectiveStatementFromTag(params: {
  tag: string;
  displayName: string;
}): Promise<AIServiceResult<{ text: string }>> {
  const aiCorrelationId = createAiCorrelationId();
  const promptVersion = 'social-lie-detective-tag-assist-v1';
  const fallback = { text: `我曾经认真体验过一次和「${params.tag}」有关的事。` };

  if (!isLieDetectiveLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatementFromTag', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }

  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: `请根据标签「${params.tag}」写一句适合“谁是谎言侦探”游戏的第一人称事实陈述。只输出一句中文，不判断真假，不加引号或解释，控制在80字内。玩家昵称：${params.displayName}`,
        }],
        temperature: 0.8,
        max_tokens: 120,
      }),
      RACE_LLM_TIMEOUT_MS,
    );
    const text = response.choices[0]?.message?.content?.trim().replace(/^["“]|["”]$/g, '');
    const safetyResult = text ? validateContentSafe(text, 'lieDetectiveStatement') : null;
    const blockedWord = text ? findReviewBlockedVocab(text) : null;
    if (!text || text.length > 80 || !safetyResult?.safe || blockedWord) {
      throw new Error(blockedWord ? 'banned_vocab' : 'invalid_generated_statement');
    }
    const latencyMs = Date.now() - t0;
    const meta = buildLiveAIMeta(provider, promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatementFromTag', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion });
    return attachAIGC({ data: { text }, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const reason = error instanceof Error && error.message === 'banned_vocab' ? 'banned_vocab' : 'llm_error';
    const meta = buildFallbackAIMeta(reason, promptVersion, aiCorrelationId);
    logger.warn('[SocialIcebreakerAI] tag-assisted statement generation fell back', {
      provider,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    });
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatementFromTag', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }
}

/** Build V2 recap data from reveal history. */
export function buildLieDetectiveV2RecapData(
  history: Array<{ round: number; correctRate: number }>,
): { aiWinRate: number; hardestRound: number; fooledEveryone: number } {
  if (history.length === 0) {
    return { aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 };
  }
  const aiWonRounds = history.filter((h) => h.correctRate < 0.5).length;
  const aiWinRate = Math.round((aiWonRounds / history.length) * 100);
  const hardestEntry = history.reduce((min, h) => (h.correctRate < min.correctRate ? h : min), history[0]);
  const fooledEveryone = history.filter((h) => h.correctRate === 0).length;
  return {
    aiWinRate,
    hardestRound: hardestEntry.round,
    fooledEveryone,
  };
}

export async function generateLieDetectiveStatements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  mode?: 'v1' | 'v2';
  tags?: [string, string];
  difficulty?: 'easy' | 'medium' | 'hard';
  _refinementHint?: string;
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const effectiveMode = params.mode ?? getLieDetectiveMode();

  // If AI is disabled, use deterministic fallback for both V1 and V2
  if (!isLieDetectiveLlmEnabled()) {
    return generateLieDetectiveDisabledFallback(params);
  }

  if (effectiveMode === 'v2' && params.tags) {
    return generateLieDetectiveV2Statements({
      userId: params.userId,
      displayName: params.displayName,
      archetype: params.archetype,
      tags: params.tags,
      difficulty: params.difficulty,
    });
  }

  // V1 path (existing behavior)
  return generateLieDetectiveV1Statements(params);
}

async function generateLieDetectiveV1Statements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  _refinementHint?: string;
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const prompt = buildLieDetectivePrompt(params);

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 300,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: getRandomFallbackStatements(), meta });
    }

    const parsed = JSON.parse(content);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.filter((s: LieDetectiveStatement) => s.isLie).length === 1
    ) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_lie_detective', aiCorrelationId, 'lie_detective');
      const liveStatements: LieDetectiveStatement[] = parsed;
      return moderateAndAttachAIGC(
        { data: liveStatements, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: LIE_DETECTIVE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateLieDetectiveStatements',
          fallbackData: getRandomFallbackStatements(),
          checks: lieDetectiveStatementsChecks(liveStatements),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms: invalid response shape (expected 3 items with exactly 1 lie), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateLieDetectiveStatements error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  }
}

function getRandomFallbackStatements(): LieDetectiveStatement[] {
  const sets = [...FALLBACK_LIE_DETECTIVE_STATEMENTS].sort(() => Math.random() - 0.5);
  return sets[0];
}

/**
 * Deterministic fallback used when SOCIAL_LIE_DETECTIVE_LLM_ENABLED=false.
 * Ignores tags/AI and returns a shuffled curated statement set.
 */
function generateLieDetectiveDisabledFallback(
  params: {
    userId: string;
    displayName: string;
    archetype?: string;
    tags?: [string, string];
  },
): AIServiceResult<LieDetectiveStatement[]> {
  const aiCorrelationId = createAiCorrelationId();
  const meta = buildFallbackAIMeta('disabled', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
  logAITrace({
    traceId: aiCorrelationId,
    domain: 'icebreaker',
    feature: 'generateLieDetectiveStatements',
    provider: null,
    model: 'n/a',
    latencyMs: 0,
    success: true,
    fallbackUsed: true,
    fromCache: false,
    promptVersion: meta.promptVersion,
    errorCode: meta.evaluatorRejectionReason,
  });
  const statements = getRandomFallbackStatements();
  // V2 callers expect is_ai/source_tag fields when tags were provided.
  if (params.tags) {
    return attachAIGC({
      data: statements.map((s, index) => ({
        ...s,
        index,
        is_ai: s.isLie,
        source_tag: s.isLie ? undefined : params.tags![index % 2],
      })),
      meta,
    });
  }
  return attachAIGC({ data: statements.map((s, index) => ({ ...s, index })), meta });
}

// ─── Lie Detective V2 ───────────────────────────────────────────────────────

/**
 * 4-tier degrade chain for Lie Detective V2:
 * 1. V2 prompt → buildLieDetectiveV2Prompt() + LieDetectiveV2ResponseSchema.safeParse()
 * 2. V2 fallback sets → getRandomFallbackSet(archetype)
 * 3. V1 prompt → buildLieDetectivePrompt() (AI generates all 3)
 * 4. V1 hardcoded → existing deterministic fallback
 *
 * All tiers are AITraced with fallbackUsed: true.
 */
async function generateLieDetectiveV2Statements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  tags: [string, string];
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const difficulty = params.difficulty ?? 'medium';

  // Tier 1: V2 prompt
  const tier1 = await tryV2Prompt(params, aiCorrelationId, difficulty);
  if (tier1.success) return tier1.result;

  // Tier 2: V2 fallback sets
  const tier2 = tryV2Fallback(params, aiCorrelationId);
  if (tier2.success) return tier2.result;

  // Tier 3: V1 prompt
  const tier3 = await tryV1PromptAsFallback(params, aiCorrelationId);
  if (tier3.success) return tier3.result;

  // Tier 4: V1 hardcoded fallback
  return tier4HardcodedFallback(aiCorrelationId);
}

async function tryV2Prompt(
  params: { displayName: string; archetype?: string; tags: [string, string] },
  aiCorrelationId: string,
  difficulty: 'easy' | 'medium' | 'hard',
): Promise<{ success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false }> {
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const prompt = buildLieDetectiveV2Prompt({
      displayName: params.displayName,
      tags: params.tags,
      archetype: params.archetype,
      difficulty,
    });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt empty response provider=${provider} latency=${latencyMs}ms`);
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt JSON parse failed provider=${provider} latency=${latencyMs}ms`);
      const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    const validation = LieDetectiveV2ResponseSchema.safeParse(parsed);
    if (!validation.success) {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt validation failed provider=${provider} latency=${latencyMs}ms: ${validation.error.message}`);
      const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    // Convert V2 shape to LieDetectiveStatement[] (is_ai → isLie for compatibility)
    const statements: LieDetectiveStatement[] = validation.data.map((s) => ({
      index: s.index,
      text: s.text,
      isLie: s.is_ai,
      is_ai: s.is_ai,
      source_tag: s.source_tag ?? null,
    }));

    const latencyMs = Date.now() - t0;
    logger.info(`[SocialIcebreakerAI] V2 prompt success provider=${provider} latency=${latencyMs}ms`);
    const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
    fireAndForgetQualityGate(content, 'icebreaker_lie_detective', aiCorrelationId, 'lie_detective');
    return {
      success: true,
      result: moderateAndAttachAIGC(
        { data: statements, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: LIE_DETECTIVE_V2_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateLieDetectiveV2Statements',
          fallbackData: getRandomFallbackStatements(),
          checks: lieDetectiveStatementsChecks(statements),
        },
      ),
    };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] V2 prompt error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { success: false };
  }
}

function tryV2Fallback(
  params: { archetype?: string },
  aiCorrelationId: string,
): { success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false } {
  try {
    const fallbackSet = getRandomFallbackSet(params.archetype);
    const statements: LieDetectiveStatement[] = fallbackSet.statements.map((s: LieDetectiveV2FallbackStatement) => ({
      index: s.index,
      text: s.text,
      isLie: s.is_ai,
      is_ai: s.is_ai,
      source_tag: s.source_tag,
    }));

    const meta = buildFallbackAIMeta('v2_fallback_pool', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: null, model: 'v2-fallback-pool', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    logger.info('[SocialIcebreakerAI] V2 fallback set used');
    return { success: true, result: attachAIGC({ data: statements, meta }) };
  } catch (error) {
    logger.error('[SocialIcebreakerAI] V2 fallback set error:', { error: error instanceof Error ? error.message : String(error) });
    return { success: false };
  }
}

async function tryV1PromptAsFallback(
  params: { userId: string; displayName: string; archetype?: string; interests?: string[] },
  aiCorrelationId: string,
): Promise<{ success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false }> {
  try {
    const v1Result = await generateLieDetectiveV1Statements(params);
    // Overwrite meta to indicate V1 fallback was used
    const meta: AIResponseMeta = {
      ...v1Result.meta,
      fallbackUsed: true,
      promptVersion: `${v1Result.meta.promptVersion}-v1-degrade`,
    };
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: v1Result.meta.provider, model: 'v1-degrade', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion });
    return { success: true, result: attachAIGC({ data: v1Result.data, meta }) };
  } catch {
    return { success: false };
  }
}

function tier4HardcodedFallback(aiCorrelationId: string): AIServiceResult<LieDetectiveStatement[]> {
  const statements = getRandomFallbackStatements();
  const meta = buildFallbackAIMeta('v1_hardcoded_fallback', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
  logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: null, model: 'v1-hardcoded', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
  logger.info('[SocialIcebreakerAI] V1 hardcoded fallback used (tier 4)');
  return attachAIGC({ data: statements, meta });
}

export async function generateXiaoYueComment(params: {
  phase: string;
  event: string;
  context?: string;
  playerCount?: number;
  participants?: Array<{ displayName: string; archetype?: string | null; profile?: { archetype?: string | null; industryLabel?: string | null; age?: number | null; city?: string | null; stateLabel?: string | null; gender?: string | null; educationLevel?: string | null; lifeStage?: string | null; bio?: string | null } | null }>;
}): Promise<AIServiceResult<string>> {
  const defaultComments: Record<string, Record<string, string>> = {
    warmup: {
      phase_start: '来，先抽张话题卡，不用紧张 🌅',
      topic_refresh: '换个话题，这个更有意思～ ✨',
      mood_change: '行，换换口味，新话题来了 🎯',
    },
    micro_challenge: {
      phase_start: '话题卡环节差不多了，来点小挑战？⚡',
      timer_warning: '时间不多啦，抓紧 ⚡',
      challenge_complete: '可以啊，大家都完成了 🎉',
    },
    lie_detective: {
      phase_start: '侦探时间，仔细听，找出那个假的 🕵️',
      vote_reveal: '揭晓了，谁最会编？😏',
      generating: '正在准备谎言游戏，稍等...',
    },
    recap: {
      phase_start: '今晚这局差不多到这儿啦 ✨',
    },
  };

  const phaseComments = defaultComments[params.phase];
  if (phaseComments?.[params.event]) {
    const meta = buildFallbackAIMeta('default_comment', XIAOYUE_COMMENT_PROMPT_VERSION);
    return attachAIGC({ data: phaseComments[params.event], meta });
  }

  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateXiaoYueComment');
  const t0 = Date.now();
  try {
    const prompt = buildXiaoYueCommentPrompt(params);

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: XIAOYUE_PERSONA },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 100,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    const latencyMs = Date.now() - t0;
    logger.info(`[SocialIcebreakerAI] generateXiaoYueComment provider=${provider} latency=${latencyMs}ms`);
    if (content) {
      const meta = buildLiveAIMeta(provider, XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoYueComment',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      });
      return moderateAndAttachAIGC(
        { data: content, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateXiaoYueComment',
          fallbackData: '继续加油，破冰进行中！✨',
          checks: xiaoYueCommentChecks(content),
        },
      );
    }
    const metaFb = buildFallbackAIMeta('empty_response', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'empty_response',
    });
    return attachAIGC({ data: '继续加油，破冰进行中！✨', meta: metaFb });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoYueComment error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const metaFb = buildFallbackAIMeta('llm_error', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'llm_error',
    });
    return attachAIGC({ data: '继续加油，破冰进行中！✨', meta: metaFb });
  }
}

const ADAPTIVE_SUGGESTION_PROMPT_VERSION = 'social-adaptive-suggestion-v2';
const MOMENT_HIGHLIGHTS_PROMPT_VERSION = 'social-moment-highlights-v2';

function boundedText(value: unknown, maxLength: number, minLength = 1): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= minLength && text.length <= maxLength ? text : null;
}

export async function generateAdaptiveGameSuggestion(params: {
  phase: string;
  phaseLabel: string;
  playerCount: number;
  signals: XiaoyueAdaptiveSuggestion['basedOnSignals'];
  fallback: XiaoyueAdaptiveSuggestion;
  currentGameFacts: string[];
}): Promise<AIServiceResult<XiaoyueAdaptiveSuggestion>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();
  let provider: AIProvider | null = null;
  let model = 'n/a';
  try {
    const selection = getClientForFunction('generateXiaoyueAdaptiveSuggestion');
    provider = selection.provider;
    model = selection.model;
    const response = await raceWithTimeout(
      selection.client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: `你是悦仔，正在协助主持人带领“${params.phaseLabel}”。请只根据下列实时事实给出一条具体、可立即执行、对陌生人友好的游戏建议，不改变规则或阶段。不要使用倒计时。\n实时事实：${JSON.stringify({
            playerCount: params.playerCount,
            signals: params.signals,
            currentGameFacts: params.currentGameFacts.slice(0, 8),
          })}\n仅返回 JSON：{"message":"40-100字的判断与建议","actionableHint":"20-60字的具体操作"}`,
        }],
        temperature: 0.7,
        max_tokens: 220,
      }),
      RACE_LLM_TIMEOUT_MS,
    );
    const parsed = JSON.parse(extractJsonPayloadForParse(response.choices[0]?.message?.content ?? ''));
    const message = boundedText(parsed?.message, 160, 20);
    const actionableHint = boundedText(parsed?.actionableHint, 100, 10);
    if (!message || !actionableHint) throw new Error('invalid_response_shape');
    const blockedWord = containsReviewBlockedVocab([message, actionableHint]);
    if (blockedWord) {
      const meta = buildFallbackAIMeta('banned_vocab', ADAPTIVE_SUGGESTION_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateAdaptiveGameSuggestion', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: ADAPTIVE_SUGGESTION_PROMPT_VERSION, errorCode: 'banned_vocab', extra: { blockedWord } });
      return attachAIGC({ data: params.fallback, meta });
    }
    const data: XiaoyueAdaptiveSuggestion = {
      ...params.fallback,
      message,
      actionableHint,
      generatedAt: new Date().toISOString(),
    };
    const meta = buildLiveAIMeta(provider, ADAPTIVE_SUGGESTION_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateAdaptiveGameSuggestion', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: ADAPTIVE_SUGGESTION_PROMPT_VERSION });
    return attachAIGC({ data, meta });
  } catch (error) {
    const reason = isLLMTimeoutError(error) ? 'timeout' : 'llm_or_parse_error';
    const meta = buildFallbackAIMeta(reason, ADAPTIVE_SUGGESTION_PROMPT_VERSION, aiCorrelationId);
    logger.warn('[SocialIcebreakerAI] generateAdaptiveGameSuggestion error; using fallback', {
      provider,
      model,
      latencyMs: Date.now() - t0,
      reason,
      aiCorrelationId,
      error: error instanceof Error ? error.message : String(error),
    });
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateAdaptiveGameSuggestion', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: ADAPTIVE_SUGGESTION_PROMPT_VERSION, errorCode: reason });
    return attachAIGC({ data: params.fallback, meta });
  }
}

const MOMENT_ASPECTS = new Set<MomentHighlightAspect>([
  'participation',
  'popularity',
  'collaboration',
  'memorable',
]);

export function normalizeMomentHighlightsPayload(
  payload: any,
  evidence: string[],
): MomentHighlightsPanel | null {
  const headline = boundedText(payload?.headline, 80);
  const overview = boundedText(payload?.overview, 260, 40);
  const closingLine = boundedText(payload?.closingLine, 120);
  if (!Array.isArray(payload?.highlights) || payload.highlights.length < 3) return null;
  const highlights: MomentHighlightsPanel['highlights'] = [];
  for (const item of payload.highlights.slice(0, 4)) {
    if (!Array.isArray(item?.evidenceIds) || item.evidenceIds.length < 1 || item.evidenceIds.length > 3) {
      return null;
    }
    const evidenceIds = item.evidenceIds as unknown[];
    if (
      new Set(evidenceIds).size !== evidenceIds.length
      || evidenceIds.some((id) => !Number.isInteger(id) || Number(id) < 0 || Number(id) >= evidence.length)
    ) {
      return null;
    }
    const aspect = item?.aspect as MomentHighlightAspect;
    const title = boundedText(item?.title, 60);
    const narrative = boundedText(item?.narrative, 260, 24);
    if (!MOMENT_ASPECTS.has(aspect) || !title || !narrative) return null;
    highlights.push({
      aspect,
      title,
      evidence: (evidenceIds as number[]).map((id) => evidence[id]).join('；'),
      narrative,
    });
  }
  if (!headline || !overview || !closingLine || highlights.length < 3) return null;
  return { headline, overview, highlights, closingLine };
}

export async function generateMomentHighlights(params: {
  playerCount: number;
  completedPhases: string[];
  interruptedAtPhase?: string;
  evidence: string[];
  fallback: MomentHighlightsPanel;
}): Promise<AIServiceResult<MomentHighlightsPanel>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();
  let provider: AIProvider | null = null;
  let model = 'n/a';
  try {
    const numberedEvidence = params.evidence.slice(0, 30).map((text, id) => ({ id, text }));
    const selection = getClientForFunction('generateMomentHighlights');
    provider = selection.provider;
    model = selection.model;
    const response = await raceWithTimeout(
      selection.client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: `你是悦仔，要把一场线下破冰整理成细致、温暖、可核验的文字高光面板。只能使用证据，不推断性格，不贬低或排名沉默成员。分别覆盖积极参与、受欢迎/被选择、合作贡献、难忘玩法；没有证据的维度要诚实说明。${params.interruptedAtPhase ? `本局在 ${params.interruptedAtPhase} 中途结束，措辞须明确“中途收尾”。` : ''}\n数据：${JSON.stringify({
            playerCount: params.playerCount,
            completedPhases: params.completedPhases,
            evidence: numberedEvidence,
          })}\n每项只能引用上面存在的证据编号，narrative 只能解释所引用证据，不得补充姓名、次数或事实。仅返回 JSON：{"headline":"标题","overview":"80-160字总览","highlights":[{"aspect":"participation|popularity|collaboration|memorable","title":"小标题","evidenceIds":[0],"narrative":"60-140字解读"}],"closingLine":"温暖收束"}；highlights 为 3-4 项。`,
        }],
        temperature: 0.65,
        max_tokens: 900,
      }),
      RACE_LLM_TIMEOUT_MS,
    );
    const parsed = JSON.parse(extractJsonPayloadForParse(response.choices[0]?.message?.content ?? ''));
    const data = normalizeMomentHighlightsPayload(parsed, params.evidence);
    if (!data) throw new Error('invalid_or_ungrounded_response');
    const blockedWord = containsReviewBlockedVocab([
      data.headline,
      data.overview,
      data.closingLine,
      ...data.highlights.flatMap((h) => [h.title, h.narrative]),
    ]);
    if (blockedWord) {
      const meta = buildFallbackAIMeta('banned_vocab', MOMENT_HIGHLIGHTS_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMomentHighlights', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: MOMENT_HIGHLIGHTS_PROMPT_VERSION, errorCode: 'banned_vocab', extra: { blockedWord } });
      return attachAIGC({ data: params.fallback, meta });
    }
    const meta = buildLiveAIMeta(provider, MOMENT_HIGHLIGHTS_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMomentHighlights', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: MOMENT_HIGHLIGHTS_PROMPT_VERSION });
    return attachAIGC({ data, meta });
  } catch (error) {
    const reason = isLLMTimeoutError(error) ? 'timeout' : 'llm_or_parse_error';
    const meta = buildFallbackAIMeta(reason, MOMENT_HIGHLIGHTS_PROMPT_VERSION, aiCorrelationId);
    logger.warn('[SocialIcebreakerAI] generateMomentHighlights error; using fallback', {
      provider,
      model,
      latencyMs: Date.now() - t0,
      reason,
      aiCorrelationId,
      error: error instanceof Error ? error.message : String(error),
    });
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMomentHighlights', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: MOMENT_HIGHLIGHTS_PROMPT_VERSION, errorCode: reason });
    return attachAIGC({ data: params.fallback, meta });
  }
}

// ─── Xiaoyue Session Pack ─────────────────────────────────────────────────────

const FALLBACK_SESSION_PACK: XiaoyueSessionPack = {
  generatedAt: new Date().toISOString(),
  opener: '来了来了，先放松，这局不会尬，我保证。',
  phaseCoaching: {
    warmup: { toneLine: '先抽张话题卡，不用急着交心', hostHint: '没人开口？你先抽一张打个样呗' },
    micro_challenge: { toneLine: '来点小挑战，两分钟的事', energyRescue: '别急，慢慢玩，时间够的' },
    lie_detective: { toneLine: '仔细听，找出那个编的', hostHint: '大胆猜，错了也没人记仇' },
    auction: { toneLine: '虚拟拍卖，脑洞越大越好', energyRescue: '没人出价？自己夸自己也算' },
    personality_dice: { toneLine: '人格骰子，看看敢不敢接', hostHint: '先从简单的来，别一上来就hard模式' },
    mini_script: { toneLine: '迷你剧本杀，今晚重头戏', hostHint: '提醒一下，记住自己的秘密和任务' },
    quip_battle: { toneLine: '填空造句，秀出你的脑洞', hostHint: '越无厘头越好，没有标准答案' },
    undercover_word: { toneLine: '谁是卧底，仔细观察', hostHint: '描述别太明显，也别太模糊' },
    group_mirror: { toneLine: '匿名投票，看看大家眼中的你', hostHint: '轻松投，没有对错' },
    speed_friending: { toneLine: '快速轮转，每人三分钟', hostHint: '铃响就换人，别恋战' },
    phase_selection: { toneLine: '该选下一个环节了，主持人大权在握', hostHint: '挑一个大家状态适合的游戏继续' },
    recap: { toneLine: '差不多了，回顾一下今晚' },
  },
  backupPrompts: [
    '大家突然安静了？试试轮流说一件今天的小事，多小都行。',
    '来个快速二选一：海边还是山里？火锅还是烧烤？',
    '有人还没怎么说话？直接点名，问TA一个简单的问题。',
  ],
  recapFraming: {
    open: '今晚这局，挺有意思的',
    highlightTemplate: '我印象最深的是',
    close: '这局算你们赢，下次继续',
  },
  playerSkillRoles: [],
};

function isSessionPackEnabled(): boolean {
  const v = process.env.SOCIAL_XIAOYUE_SESSION_PACK_ENABLED;
  if (v === undefined || v === '') return true;
  return v.toLowerCase() === 'true';
}

export async function generateXiaoyueSessionPack(params: {
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  eventType?: string;
  playerCount: number;
}): Promise<AIServiceResult<XiaoyueSessionPack>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();

  if (!isSessionPackEnabled()) {
    const meta = buildFallbackAIMeta('disabled', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider: 'deepseek',
      model: 'n/a',
      latencyMs: Date.now() - t0,
      success: true,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
  }

  const { client, model, provider } = getClientForFunction('generateXiaoyueSessionPack');
  try {
    const prompt = buildXiaoyueSessionPackPrompt({
      participantCount: params.playerCount,
      eventType: params.eventType,
      participants: params.participants,
    });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }

    try {
      const validated = parseXiaoyueSessionPack(parsed);
      const latencyMs = Date.now() - t0;
      const meta = buildLiveAIMeta(provider, SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: meta.promptVersion,
      });
      const livePack = validated as XiaoyueSessionPack;
      return moderateAndAttachAIGC(
        { data: livePack, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: SESSION_PACK_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateXiaoyueSessionPack',
          fallbackData: FALLBACK_SESSION_PACK,
          checks: xiaoyueSessionPackChecks(livePack),
        },
      );
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoyueSessionPack error latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
  }
}

// ─── Quip Battle ─────────────────────────────────────────────────────────────

export const QUIP_BATTLE_PROMPT_VERSION = 'social-quip-battle-v1';

function isQuipBattleLlmEnabled(): boolean {
  const v = process.env.SOCIAL_QUIP_BATTLE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateQuipBattlePrompts(params: {
  eventType: string;
  participantCount: number;
  participants: Array<{ displayName: string; archetype?: string }>;
  _refinementHint?: string;
  roster?: Array<{ archetype?: string }>;
}): Promise<AIServiceResult<QuipBattlePrompt[]>> {
  const aiCorrelationId = createAiCorrelationId();

  // Always build fallback first
  const fallbackPrompts = getRandomQuipBattlePrompts(3);

  // If AI is disabled, return curated fallback immediately
  if (!isQuipBattleLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  }

  const { client, model, provider } = getClientForFunction('generateQuipBattlePrompts');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildQuipBattlePrompt({ ...params, sessionContext });

    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbackPrompts, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`);
      const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbackPrompts, meta });
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'quip_battle', params.eventType);
      const livePrompts: QuipBattlePrompt[] = parsed.slice(0, 3).map((p: QuipBattlePrompt, i: number) => ({
        id: p.id || `qb_${i + 1}`,
        promptText: p.promptText || fallbackPrompts[i].promptText,
        category: p.category || fallbackPrompts[i].category,
      }));
      return moderateAndAttachAIGC(
        { data: livePrompts, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: QUIP_BATTLE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateQuipBattlePrompts',
          fallbackData: fallbackPrompts,
          checks: quipBattlePromptsChecks(livePrompts),
        },
      );
    }

    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateQuipBattlePrompts error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  }
}

// ─── Undercover Word ─────────────────────────────────────────────────────────

function isUndercoverWordLlmEnabled(): boolean {
  const v = process.env.SOCIAL_UNDERCOVER_WORD_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateUndercoverWordPair(params: {
  eventType?: string;
  participantCount: number;
  roster?: Array<{ userId: string; displayName: string; archetype?: string }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<UndercoverWordPair>> {
  const aiCorrelationId = createAiCorrelationId();

  const fallback = getFallbackUndercoverPair();

  // If AI is disabled, return curated fallback immediately
  if (!isUndercoverWordLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }

  const { client, model, provider } = getClientForFunction('generateUndercoverWordPair');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logger.info('[SocialIcebreakerAI] Undercover word context injected', {
        aiCorrelationId,
        mixText: sessionContext.mixText,
        diversityScore: sessionContext.diversityScore,
      });
    }
    const prompt = buildUndercoverWordPrompt({
      participantCount: params.participantCount,
      eventType: params.eventType,
      sessionContext,
    });
    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 800,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    const pair = parsed as Record<string, unknown>;
    if (pair.civilianWord && pair.undercoverWord && pair.category) {
      const meta = buildLiveAIMeta(provider, UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'undercover_word', params.eventType);
      const livePair: UndercoverWordPair = {
        civilianWord: String(pair.civilianWord),
        undercoverWord: String(pair.undercoverWord),
        category: String(pair.category),
      };
      return moderateAndAttachAIGC(
        { data: livePair, meta },
        {
          provider,
          model,
          latencyMs: Date.now() - t0,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateUndercoverWordPair',
          fallbackData: fallback,
          checks: undercoverWordPairChecks(livePair),
        },
      );
    }

    const meta = buildFallbackAIMeta('parse_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateUndercoverWordPair error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }
}

// ─── Group Mirror ────────────────────────────────────────────────────────────

function isGroupMirrorLlmEnabled(): boolean {
  const v = process.env.SOCIAL_GROUP_MIRROR_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateGroupMirrorQuestions(params: {
  eventType?: string;
  participantCount: number;
  participantNames: string[];
  roster?: Array<{ userId: string; displayName: string; archetype?: string }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<GroupMirrorQuestion[]>> {
  const aiCorrelationId = createAiCorrelationId();

  const fallback = getFallbackGroupMirrorQuestions(5);

  // If AI is disabled, return curated fallback immediately
  if (!isGroupMirrorLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }

  const { client, model, provider } = getClientForFunction('generateGroupMirrorQuestions');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildGroupMirrorPrompt({ ...params, sessionContext });
    const response = await raceWithTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 600,
      }),
      RACE_LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const meta = buildLiveAIMeta(provider, GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'group_mirror', params.eventType);
      const liveQuestions: GroupMirrorQuestion[] = parsed.slice(0, 5).map((q: GroupMirrorQuestion, i: number) => ({
        id: q.id || `gm_${i + 1}`,
        questionText: q.questionText || fallback[i]?.questionText || '谁最有趣？',
        category: q.category || 'perception',
      }));
      return moderateAndAttachAIGC(
        { data: liveQuestions, meta },
        {
          provider,
          model,
          latencyMs: Date.now() - t0,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateGroupMirrorQuestions',
          fallbackData: fallback,
          checks: groupMirrorQuestionsChecks(liveQuestions),
        },
      );
    }

    const meta = buildFallbackAIMeta('parse_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateGroupMirrorQuestions error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }
}

// Re-exports from topical AI modules so downstream consumers can keep importing
// from this file as the public barrel.
export {
  generatePersonalityDiceChallenges,
  generatePersonalityDiceChallengeGroups,
} from './socialIcebreakerPersonalityDiceAI';
export {
  generateAuctionLots,
} from './socialIcebreakerAuctionAI';

// ─── Extracted modules (re-exported to preserve the public barrel) ───────────
export {
  generateWarmupTopics,
  getCuratedWarmupTopics,
  resetWarmupTopicDedupe,
  hasBraveTopic,
  FALLBACK_WARMUP_TOPICS,
} from './socialIcebreakerAI/warmupTopics';
export type { WarmupFallbackOptions } from './socialIcebreakerAI/warmupTopics';
export { generateMicroChallenges } from './socialIcebreakerAI/microChallenge';
export { generateRecapSummary } from './socialIcebreakerAI/recap';
