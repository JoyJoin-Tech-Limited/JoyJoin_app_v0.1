/**
 * Profile Tagline Service (v2)
 * 档案标语生成服务 — 入场卡「悦仔的观察」三行揭示 + 证据行
 *
 * Sprint contract: entry-card-insight-v2 (D1-D5).
 *  - D2 inputs: archetype(+secondary/blend) + 六维 trait vector + 3-5 原始问答对
 *    (assessment_answers) + 兴趣 selections/topPriorities labels & heat.
 *  - D3 authority split: observation line + evidence pills are DETERMINISTIC
 *    template renders citing real interest labels (never LLM); inference/reveal
 *    lines are LLM-generated in ONE call (strict JSON + Zod safeParse).
 *  - D4 contract: returns {lines, evidence, meta} with per-line `aigc`, and
 *    keeps `insightLine` (= inference line text) for old clients.
 *  - D5 fallback ladder per line: LLM → rule template (12 archetypes × slotted
 *    templates, slots = real labels/answer text) → line dropped. Observation +
 *    evidence are always deterministic. Total rule-fallback failure retreats
 *    to v1 GENERIC_PROFILE_TAGLINE_FALLBACK (insightLine only, lines = []).
 *  - Reliability: LLM call wrapped in raceWithTimeout (env
 *    PROFILE_TAGLINE_TIMEOUT_MS, default 7000ms).
 *  - Cache: per-process Map + TTL (same value as xiaoyueAnalysisService) +
 *    500-entry LRU + in-flight dedupe; key digests EVERY citable signal
 *    (AC-06) so no cross-user leakage of referenced answers/interests.
 *  - Observable: AITrace + AIResponseMeta on every path
 *    (promptVersion/fallbackUsed/fromCache/timeout errorCode).
 */

import { z } from 'zod';
import { callSocialAI } from './ai/socialModelRouter';
import { logger } from './lib/logger';
import {
  buildFallbackAIMeta,
  buildAIGCMeta,
} from '@shared/types/aiMeta';
import type { AIResponseMeta, LiveAIProvider } from '@shared/types/aiMeta';
import {
  GENERIC_PROFILE_TAGLINE_FALLBACK,
  type ProfileTaglineResponse,
  type ProfileTaglineLine,
  type ProfileTaglineEvidence,
} from '@shared/ai/onboarding';
import { logAITrace } from './lib/aiTraceLogger';
import { moderateGeneratedContent } from './lib/aiContentModeration';
import { raceWithTimeout, isLLMTimeoutError } from './socialIcebreakerAICore';
import { XIAOYUE_CRAFT_LITE } from './prompts/craft';
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames';
import { getQuestionById } from '@shared/personality/questionsV4';
import type { TraitKey } from '@shared/personality/types';
import {
  MIN_TAGLINE_LINE_CHARS,
  MAX_TAGLINE_LINE_CHARS,
  OBSERVATION_INTEREST_TEMPLATES,
  ARCHETYPE_OBSERVATION_LINES,
  ARCHETYPE_RULE_TEMPLATES,
  renderRuleTemplate,
  sanitizeSlotValue,
  type TaglineTemplateSlots,
  type RuleTemplateRole,
} from '@shared/copy/profileTaglineRuleTemplates';

export const PROFILE_TAGLINE_PROMPT_VERSION = 'profile-tagline-v2';
const PROMPT_VERSION = PROFILE_TAGLINE_PROMPT_VERSION;

const DEFAULT_TIMEOUT_MS = 7_000;

/** LLM hard bound. Env read per-call so tests can stub it (vi.stubEnv). */
function getTaglineTimeoutMs(): number {
  const raw = Number(process.env.PROFILE_TAGLINE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TIMEOUT_MS;
}

// ─── Cache (AC-06) ────────────────────────────────────────────────────────────
// Per-process in-memory cache. Key digests EVERY citable signal (archetype,
// trait bucket, answered questionIds, top interest topicIds, topPriorities
// topicIds) so a cached payload can never leak another user's cited answers
// or interests. TTL matches xiaoyueAnalysisService.CACHE_TTL; 500-entry LRU;
// in-flight dedupe mirrors the same precedent.

const TAGLINE_CACHE_TTL_MS = 1_000 * 60 * 60;
const TAGLINE_CACHE_MAX_ENTRIES = 500;
const taglineCache = new Map<string, { response: ProfileTaglineResponse; timestamp: number }>();
const inFlightTaglines = new Map<string, Promise<ProfileTaglineResponse>>();

/** Test-only hook: clears caches so suites stay isolated. */
export function __resetProfileTaglineCacheForTests(): void {
  taglineCache.clear();
  inFlightTaglines.clear();
}

function readTaglineCache(cacheKey: string): ProfileTaglineResponse | null {
  const cached = taglineCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= TAGLINE_CACHE_TTL_MS) {
    taglineCache.delete(cacheKey);
    return null;
  }
  // LRU refresh: re-insert at the tail.
  taglineCache.delete(cacheKey);
  taglineCache.set(cacheKey, cached);
  return {
    ...cached.response,
    meta: { ...cached.response.meta, fromCache: true },
  };
}

function storeTaglineCache(cacheKey: string, response: ProfileTaglineResponse): void {
  if (taglineCache.size >= TAGLINE_CACHE_MAX_ENTRIES) {
    const oldest = taglineCache.keys().next().value;
    if (oldest !== undefined) taglineCache.delete(oldest);
  }
  taglineCache.set(cacheKey, { response, timestamp: Date.now() });
}

// ─── Input contract (D2) ─────────────────────────────────────────────────────

/** Raw assessment_answers row (joined through assessment_sessions). */
export interface RawAssessmentAnswer {
  questionId: string;
  questionLevel: number;
  selectedOption: string;
  answeredAt?: Date | string | null;
}

/** Raw user_interests selection / topPriorities entry (jsonb). */
export interface InterestSelectionInput {
  topicId?: string;
  label?: string;
  heat?: number;
}

export interface ProfileTaglineInput {
  /** Primary archetype id, e.g. "fox". */
  archetype?: string;
  /** Second-highest archetype id, when known. */
  secondaryArchetype?: string | null;
  /** Blend marker: top-two archetype gap ≤ 8 (mirrors xiaoyueAnalysisService). */
  isBlend?: boolean;
  /** 六维 trait vector (0-100 or 0-1 normalized; both accepted). */
  traitScores?: Partial<Record<TraitKey, number>> | null;
  /** Raw assessment answers; selection + option-text recovery happen here. */
  rawAnswers?: RawAssessmentAnswer[] | null;
  /** user_interests.selections entries. Top 3 by heat are cited. */
  selections?: InterestSelectionInput[] | null;
  /** user_interests.topPriorities entries (level-3 items). */
  topPriorities?: InterestSelectionInput[] | null;
}

// ─── Deterministic signal preparation ────────────────────────────────────────

const TRAIT_KEYS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const TRAIT_SHORT_LABELS: Record<TraitKey, string> = {
  A: '亲和',
  C: '责任',
  E: '稳定',
  O: '开放',
  X: '外向',
  P: '积极',
};

/** Mirrors xiaoyueAnalysisService.normalizeTraitScore (0-1 → 0-100, clamped). */
function normalizeTraitValue(value: number): number {
  const scaled = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

export interface NormalizedInterest {
  topicId: string;
  label: string;
  heat: number;
}

function normalizeInterests(
  raw: readonly InterestSelectionInput[] | null | undefined,
): NormalizedInterest[] {
  return (raw ?? [])
    .filter(
      (s): s is InterestSelectionInput & { label: string } =>
        typeof s?.label === 'string' && s.label.trim().length > 0,
    )
    .map((s) => ({
      topicId: typeof s.topicId === 'string' && s.topicId ? s.topicId : s.label,
      label: s.label.trim(),
      heat: typeof s.heat === 'number' && Number.isFinite(s.heat) ? s.heat : 0,
    }))
    .sort((a, b) => b.heat - a.heat);
}

export interface RecoveredQaPair {
  questionId: string;
  questionText: string;
  answerText: string;
}

const MAX_QA_PAIRS = 5;

/**
 * Deterministic Q&A selection rule (AC-02):
 *   questionLevel desc → discriminationIndex desc (undefined = 0) →
 *   answeredAt desc; take top 5; fewer than 3 → use whatever exists.
 * Option-text recovery mirrors the pre-signup pattern in
 * routes/domains/assessmentV4.ts:366 —
 * `question.options.find(o => o.value === ans.selectedOption)`.
 * AC-13: a questionId no longer in the bank (getQuestionById → undefined) is
 * skipped silently.
 */
export function selectQaPairs(
  rawAnswers: readonly RawAssessmentAnswer[] | null | undefined,
): RecoveredQaPair[] {
  const questionMemo = new Map<string, ReturnType<typeof getQuestionById>>();
  const decorated: Array<{
    ans: RawAssessmentAnswer;
    questionText: string;
    answerText: string;
    discriminationIndex: number;
    answeredAtMs: number;
  }> = [];

  for (const ans of rawAnswers ?? []) {
    if (!ans || typeof ans.questionId !== 'string' || !ans.questionId) continue;
    if (typeof ans.selectedOption !== 'string' || !ans.selectedOption) continue;
    if (!questionMemo.has(ans.questionId)) {
      questionMemo.set(ans.questionId, getQuestionById(ans.questionId));
    }
    const question = questionMemo.get(ans.questionId);
    if (!question) continue; // questionId left the bank — skip, never throw
    const optionText = question.options.find((o) => o.value === ans.selectedOption)?.text;
    if (!optionText) continue;
    const answeredAtMs = ans.answeredAt ? new Date(ans.answeredAt).getTime() : 0;
    decorated.push({
      ans,
      questionText: question.questionText,
      answerText: optionText,
      discriminationIndex: question.discriminationIndex ?? 0,
      answeredAtMs: Number.isFinite(answeredAtMs) ? answeredAtMs : 0,
    });
  }

  decorated.sort(
    (a, b) =>
      (b.ans.questionLevel ?? 0) - (a.ans.questionLevel ?? 0) ||
      b.discriminationIndex - a.discriminationIndex ||
      b.answeredAtMs - a.answeredAtMs,
  );

  return decorated.slice(0, MAX_QA_PAIRS).map((d) => ({
    questionId: d.ans.questionId,
    questionText: d.questionText,
    answerText: d.answerText,
  }));
}

const MAX_EVIDENCE_PILLS = 3;

/** Evidence pills (AC-03/AC-13): topPriorities first, then top selections. */
export function buildEvidencePills(
  priorities: readonly NormalizedInterest[],
  topSelections: readonly NormalizedInterest[],
): ProfileTaglineEvidence[] {
  const evidence: ProfileTaglineEvidence[] = [];
  const seen = new Set<string>();
  for (const p of priorities.slice(0, 2)) {
    if (seen.has(p.label)) continue;
    seen.add(p.label);
    evidence.push({ text: p.label, sourceRef: `priority:${p.topicId}` });
  }
  for (const s of topSelections) {
    if (evidence.length >= MAX_EVIDENCE_PILLS) break;
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    evidence.push({ text: s.label, sourceRef: `interest:${s.topicId}` });
  }
  return evidence;
}

/**
 * Observation line (AC-03/AC-05/AC-13): deterministic, cites real interest
 * labels; degrades to the archetype-level line when zero selections exist.
 * Returns null only when there is no archetype AND no interest signal.
 */
function buildObservationLine(
  archetype: string | undefined,
  topSelections: readonly NormalizedInterest[],
): ProfileTaglineLine | null {
  const slots: TaglineTemplateSlots = {
    interest: topSelections[0]?.label,
    interest2: topSelections[1]?.label,
  };
  for (const template of OBSERVATION_INTEREST_TEMPLATES) {
    const text = renderRuleTemplate(template, slots);
    if (text) return { role: 'observation', text, aigc: false };
  }
  const archetypeLine = archetype ? ARCHETYPE_OBSERVATION_LINES[archetype] : undefined;
  if (archetypeLine) return { role: 'observation', text: archetypeLine, aigc: false };
  return null;
}

/** First renderable rule-fallback template for a role (AC-05 slot rules). */
function renderArchetypeTemplate(
  role: RuleTemplateRole,
  archetype: string | undefined,
  slots: TaglineTemplateSlots,
): string | null {
  if (!archetype) return null;
  const templates = ARCHETYPE_RULE_TEMPLATES[archetype] ?? [];
  for (const template of templates) {
    if (template.role !== role) continue;
    const text = renderRuleTemplate(template, slots);
    if (text) return text;
  }
  return null;
}

/** Cache key digesting every citable signal (AC-06). */
function buildTaglineCacheKey(params: {
  archetype?: string;
  secondaryArchetype?: string | null;
  traitScores?: Partial<Record<TraitKey, number>> | null;
  rawAnswers?: readonly RawAssessmentAnswer[] | null;
  topSelections: readonly NormalizedInterest[];
  priorities: readonly NormalizedInterest[];
}): string {
  // Bucket normalized trait scores to the nearest 10 — same rounding范式 as
  // xiaoyueAnalysisService.getCacheKey (traitBucketKey).
  const traitBucketKey = TRAIT_KEYS.map(
    (k) => Math.round(normalizeTraitValue(params.traitScores?.[k] ?? 0) / 10) * 10,
  ).join('_');
  // Digest `questionId:selectedOption` pairs (not just ids) so two users with
  // the same questions but different picks can never share a cached payload
  // that cites the other's answer text (AC-06 residual, closed 2026-10-14).
  const answerDigest = [
    ...new Set(
      (params.rawAnswers ?? [])
        .filter(
          (a): a is RawAssessmentAnswer =>
            !!a && typeof a.questionId === 'string' && a.questionId.length > 0,
        )
        .map((a) => `${a.questionId}:${a.selectedOption ?? ''}`),
    ),
  ].sort().join(',');
  const interestIds = params.topSelections.map((s) => s.topicId).join(',');
  const priorityIds = params.priorities.map((p) => p.topicId).join(',');
  return [
    params.archetype ?? 'none',
    params.secondaryArchetype ?? 'none',
    traitBucketKey,
    answerDigest,
    interestIds,
    priorityIds,
    PROMPT_VERSION,
  ].join('|');
}

// ─── Prompt construction (AC-02/AC-04/AC-13) ─────────────────────────────────

interface PromptContext {
  archetype?: string;
  secondaryArchetype?: string | null;
  isBlend?: boolean;
  traitScores?: Partial<Record<TraitKey, number>> | null;
  qaPairs: RecoveredQaPair[];
  topSelections: NormalizedInterest[];
  priorities: NormalizedInterest[];
}

/**
 * Builds the v2 prompt. Empty signal sections are omitted entirely (AC-13
 * data-availability matrix: zero answers → no Q&A section, zero interests →
 * no interest section, null topPriorities → no priorities section).
 */
export function buildTaglinePrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  if (ctx.archetype) {
    const nameCn = ARCHETYPE_BY_ID[ctx.archetype]?.nameCn ?? ctx.archetype;
    const secondaryCn = ctx.secondaryArchetype
      ? ARCHETYPE_BY_ID[ctx.secondaryArchetype]?.nameCn ?? ctx.secondaryArchetype
      : null;
    sections.push(
      `原型：${nameCn}` +
        (secondaryCn
          ? `（次高原型：${secondaryCn}，边界混合：${ctx.isBlend ? '是' : '否'}）`
          : ''),
    );
  }

  const traitParts = TRAIT_KEYS.filter((k) => typeof ctx.traitScores?.[k] === 'number').map(
    (k) => `${TRAIT_SHORT_LABELS[k]} ${normalizeTraitValue(ctx.traitScores![k]!)}`,
  );
  if (traitParts.length > 0) {
    sections.push(`六维特质：${traitParts.join(' / ')}`);
  }

  if (ctx.qaPairs.length > 0) {
    const qaLines = ctx.qaPairs
      .map((pair) => `- 问：${pair.questionText} 答：${pair.answerText}`)
      .join('\n');
    sections.push(`【真实问答】\n${qaLines}`);
  }

  if (ctx.topSelections.length > 0) {
    sections.push(
      `【兴趣方向】${ctx.topSelections.map((s) => `${s.label}（热度${s.heat}）`).join('、')}`,
    );
  }

  if (ctx.priorities.length > 0) {
    sections.push(`【最在意】${ctx.priorities.map((p) => p.label).join('、')}`);
  }

  return `你是悦仔，JoyJoin 里最懂用户的观察员。根据一位用户的真实资料，写两行"被读懂"的揭示文案：推断行（inference）与揭穿行（reveal）。

${XIAOYUE_CRAFT_LITE}

【工作链路——严格按此思考，但只输出最终文案】
1. observe：先从问答与兴趣里挑出至少两个具体信号，记住原词
2. infer：推断这个人在陌生人的局里一个具体、可验证的行为表现
3. verify：自检——这句话是不是放到谁身上都成立？是就重写得更具体（反巴纳姆）
4. phrase：口语化、温暖、第二人称，像认识很久的朋友说的话

【硬要求】
- inference 必须引用资料里至少两个具体信号（兴趣词或回答细节）
- reveal 点破一个对方自己可能没察觉的小模式；没有把握就省略该字段
- 每行 15-30 字，不要"你是一个……的人"这类抽象评价，用具象场景代替
- 禁止出现：匹配、灵魂、撮合、AI、"总的来说"、"值得注意的是"
- 禁止万能句（如"外表坚强内心柔软"）

【用户资料】
${sections.join('\n')}

【输出格式】严格输出 JSON，不要 markdown 代码块，不要多余文字：
{"inference": "……", "reveal": "……（可省略该字段）"}`;
}

// ─── LLM output parsing + per-line acceptance ────────────────────────────────

const taglineLLMOutputSchema = z.object({
  inference: z.string().trim().min(1).max(200),
  reveal: z.string().trim().min(1).max(200).optional(),
});

/** Extract the first {...} JSON object from raw LLM content (fence-tolerant). */
function parseJsonObject(raw: string): unknown | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Per-line quality + moderation gate (REL-01): a line is accepted only when
 * it is 12-80 chars and passes content moderation with the review-vocab gate
 * (enforceReviewVocab). Rejection drops ONLY that line.
 */
function acceptLLMLine(
  text: string,
  role: 'inference' | 'reveal',
  provider: LiveAIProvider,
  model?: string,
): string | null {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TAGLINE_LINE_CHARS || trimmed.length > MAX_TAGLINE_LINE_CHARS) {
    return null;
  }
  const moderation = moderateGeneratedContent([{ field: role, text: trimmed }], {
    domain: 'onboarding',
    feature: 'generateProfileTagline',
    provider,
    model,
    promptVersion: PROMPT_VERSION,
    enforceReviewVocab: true,
  });
  return moderation.safe ? trimmed : null;
}

// ─── Service entry point ─────────────────────────────────────────────────────

/**
 * Generates the entry-card insight (observation + inference [+ reveal] lines
 * and evidence pills) for the profile review card.
 *
 * Always resolves — every failure path degrades: LLM line → rule template →
 * line dropped; total rule-fallback failure → v1 GENERIC fallback.
 */
export async function generateProfileTagline(
  input?: ProfileTaglineInput | null,
): Promise<ProfileTaglineResponse> {
  const startedAt = Date.now();
  const safeInput = input ?? {};

  const archetype =
    typeof safeInput.archetype === 'string' && safeInput.archetype
      ? safeInput.archetype
      : undefined;
  const secondaryArchetype =
    typeof safeInput.secondaryArchetype === 'string' && safeInput.secondaryArchetype
      ? safeInput.secondaryArchetype
      : null;
  const qaPairs = selectQaPairs(safeInput.rawAnswers);
  const selections = normalizeInterests(safeInput.selections);
  const topSelections = selections.slice(0, 3);
  const priorities = normalizeInterests(safeInput.topPriorities);

  // ── Cache (AC-06/SCA-02): hit → no LLM call ──
  const cacheKey = buildTaglineCacheKey({
    archetype,
    secondaryArchetype,
    traitScores: safeInput.traitScores,
    rawAnswers: safeInput.rawAnswers,
    topSelections,
    priorities,
  });
  const cached = readTaglineCache(cacheKey);
  if (cached) {
    logAITrace({
      domain: 'onboarding',
      feature: 'generateProfileTagline',
      provider: cached.meta.provider,
      latencyMs: Date.now() - startedAt,
      success: !cached.meta.fallbackUsed,
      fallbackUsed: cached.meta.fallbackUsed,
      fromCache: true,
      promptVersion: PROMPT_VERSION,
    });
    return cached;
  }
  const inFlight = inFlightTaglines.get(cacheKey);
  if (inFlight) {
    logger.info('[profileTagline] Reusing in-flight generation', { archetype });
    return inFlight;
  }

  const running = runTaglineGeneration(
    { archetype, secondaryArchetype, isBlend: safeInput.isBlend, traitScores: safeInput.traitScores, qaPairs, topSelections, priorities },
    startedAt,
  );
  inFlightTaglines.set(cacheKey, running);
  try {
    const response = await running;
    storeTaglineCache(cacheKey, response);
    return response;
  } finally {
    inFlightTaglines.delete(cacheKey);
  }
}

interface NormalizedContext {
  archetype?: string;
  secondaryArchetype?: string | null;
  isBlend?: boolean;
  traitScores?: Partial<Record<TraitKey, number>> | null;
  qaPairs: RecoveredQaPair[];
  topSelections: NormalizedInterest[];
  priorities: NormalizedInterest[];
}

function buildGenericRetreat(
  startedAt: number,
  reason: string,
  provider: LiveAIProvider | null,
): ProfileTaglineResponse {
  const meta = buildFallbackAIMeta(reason, PROMPT_VERSION);
  logAITrace({
    domain: 'onboarding',
    feature: 'generateProfileTagline',
    provider,
    latencyMs: Date.now() - startedAt,
    success: false,
    fallbackUsed: true,
    fromCache: false,
    promptVersion: PROMPT_VERSION,
    errorCode: reason,
  });
  return {
    insightLine: GENERIC_PROFILE_TAGLINE_FALLBACK,
    lines: [],
    evidence: [],
    meta: { ...meta, aigc: buildAIGCMeta({ fallbackUsed: true }) },
  };
}

async function runTaglineGeneration(ctx: NormalizedContext, startedAt: number): Promise<ProfileTaglineResponse> {
  const { archetype, qaPairs, topSelections, priorities } = ctx;

  // ── Deterministic rows (AC-03): observation + evidence never touch the LLM ──
  const observationLine = buildObservationLine(archetype, topSelections);
  const evidence = buildEvidencePills(priorities, topSelections);

  const hasAnySignal =
    !!archetype ||
    TRAIT_KEYS.some((k) => typeof ctx.traitScores?.[k] === 'number') ||
    qaPairs.length > 0 ||
    topSelections.length > 0 ||
    priorities.length > 0;

  if (!hasAnySignal) {
    // v1 parity: no usable context → no LLM call, straight to GENERIC.
    return buildGenericRetreat(startedAt, 'no_context', null);
  }

  const slots: TaglineTemplateSlots = {
    interest: topSelections[0]?.label,
    interest2: topSelections[1]?.label,
    priority: priorities[0]?.label,
    answer: qaPairs[0] ? sanitizeSlotValue(qaPairs[0].answerText) : undefined,
  };

  // ── LLM: single call, strict JSON, hard timeout (AC-04/AC-05) ──
  let llmInference: string | null = null;
  let llmReveal: string | null = null;
  let revealAttempted = false;
  let llmErrorCode: string | null = null;
  let provider: LiveAIProvider | null = null;
  let model: string | undefined;

  const prompt = buildTaglinePrompt(ctx);

  try {
    const result = await raceWithTimeout(
      callSocialAI({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
        callerTag: 'profileTagline',
        socialFunction: 'generateProfileTagline',
      }),
      getTaglineTimeoutMs(),
    );
    provider = result.provider;
    model = result.model;
    const raw = (result.content ?? '').trim();

    if (!raw) {
      llmErrorCode = 'empty_content';
      revealAttempted = true;
    } else {
      const parsed = parseJsonObject(raw);
      const zodResult = parsed !== null ? taglineLLMOutputSchema.safeParse(parsed) : null;
      if (!zodResult || !zodResult.success) {
        llmErrorCode = parsed !== null ? 'schema_invalid' : 'parse_error';
        revealAttempted = true;
      } else {
        llmInference = acceptLLMLine(zodResult.data.inference, 'inference', provider, model);
        if (typeof zodResult.data.reveal === 'string') {
          revealAttempted = true;
          llmReveal = acceptLLMLine(zodResult.data.reveal, 'reveal', provider, model);
        }
        if (!llmInference) llmErrorCode = 'line_dropped';
      }
    }
  } catch (err) {
    llmErrorCode = isLLMTimeoutError(err) ? 'timeout' : 'provider_error';
    revealAttempted = true;
    if (llmErrorCode === 'timeout') {
      logger.warn('LLM call hit hard timeout, using rule fallback', {
        feature: 'profileTagline',
        timeoutMs: getTaglineTimeoutMs(),
      });
    } else {
      logger.error('LLM call failed, using rule fallback', {
        feature: 'profileTagline',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Fallback ladder per line (D5): LLM → rule template → drop ──
  const inferenceFromLlm = llmInference !== null;
  const inferenceText = llmInference ?? renderArchetypeTemplate('inference', archetype, slots);
  if (!inferenceText) {
    // Rule fallback unusable → total retreat to v1 GENERIC (AC-05).
    return buildGenericRetreat(startedAt, llmErrorCode ?? 'fallback_unavailable', provider);
  }

  // AC-20③ cohort convergence: when the ONLY signal is the archetype (no
  // evidence pills AND no recovered Q&A pairs), a "点破" reveal line would be
  // fabricated — it has no private signal to stand on. Drop it; lines ≤ 2.
  const singleSignalCohort = evidence.length === 0 && qaPairs.length === 0;

  let revealText = singleSignalCohort ? null : llmReveal;
  let revealFromLlm = llmReveal !== null;
  if (!revealText && revealAttempted && !singleSignalCohort) {
    revealText = renderArchetypeTemplate('reveal', archetype, slots);
    revealFromLlm = false;
  }
  if (singleSignalCohort) {
    revealFromLlm = false;
  }

  const lines: ProfileTaglineLine[] = [];
  if (observationLine) lines.push(observationLine);
  lines.push({ role: 'inference', text: inferenceText, aigc: inferenceFromLlm });
  if (revealText) lines.push({ role: 'reveal', text: revealText, aigc: revealFromLlm });

  const anyLlmLine = inferenceFromLlm || (revealText !== null && revealFromLlm);
  const templateLineUsed = !inferenceFromLlm || (revealText !== null && !revealFromLlm);
  const fallbackUsed = templateLineUsed || !anyLlmLine;

  // meta.aigc is keyed off the INFERENCE line only: insightLine (= inference
  // text) is what old clients label, and the per-line flags are fail-closed
  // (SEC-02) — deterministic lines never carry the mark.
  const meta: AIResponseMeta = {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: anyLlmLine ? provider : null,
    fallbackUsed,
    promptVersion: PROMPT_VERSION,
    ...(llmErrorCode ? { evaluatorRejectionReason: llmErrorCode } : {}),
    aigc: buildAIGCMeta({ fallbackUsed: !inferenceFromLlm, labelType: 'ai-generated' }),
  };

  logAITrace({
    domain: 'onboarding',
    feature: 'generateProfileTagline',
    provider: meta.provider,
    model,
    latencyMs: Date.now() - startedAt,
    success: anyLlmLine,
    fallbackUsed,
    fromCache: false,
    promptVersion: PROMPT_VERSION,
    errorCode: llmErrorCode ?? undefined,
    extra: { lineCount: lines.length, evidenceCount: evidence.length },
  });

  return {
    insightLine: inferenceText,
    lines,
    evidence,
    meta,
  };
}
