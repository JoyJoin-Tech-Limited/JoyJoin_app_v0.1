/**
 * Pre-Generation Worker — Async AI content generator with Quality Gate
 *
 * Polls for pending pre-generation jobs, calls the appropriate AI generator,
 * runs LLM-as-judge quality gate with blocking refine loop, stores results,
 * and marks jobs as completed/failed.
 *
 * Usage:
 *   import { startPreGenerationWorker, stopPreGenerationWorker } from './preGenerationWorker';
 *   startPreGenerationWorker(); // starts polling loop
 *   stopPreGenerationWorker();  // graceful shutdown
 */

import {
  dequeuePendingJob,
  completePreGenerationJob,
  failPreGenerationJob,
  storePreGenerationResult,
  isPreGenerationJobRunning,
  deletePreGenerationResultById,
} from '../lib/socialIcebreakerStore';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generatePersonalityDiceChallenges,
  generatePersonalityDiceChallengeGroups,
  generateAuctionLots,
  generateQuipBattlePrompts,
  generateUndercoverWordPair,
  generateGroupMirrorQuestions,
} from '../socialIcebreakerAIService';
import { generateWithQualityGate } from '../ai/aiQualityGate';
import type { JudgeFeatureType } from '../ai/qualityJudgePrompts';
import { getRandomQuipBattlePrompts } from '@shared/quipBattle';
import { selectMicroChallenges } from '@shared/microChallengeTemplates';
import { getDaresForArchetype } from '@shared/personalityDiceDares';
import { getFallbackUndercoverPair } from '@shared/undercoverWord';
import { getFallbackGroupMirrorQuestions } from '@shared/groupMirror';
import { selectAuctionFallbackLots } from '@shared/socialIcebreakerAuctionFallback';
import type { SocialTopic, AtmosphereMood, LieDetectiveStatement, AuctionLot, MicroChallenge, GroupMirrorQuestion, PersonalityDiceChallengeGroup } from '@shared/socialIcebreaker';
import { selectPermissionLineForTopic } from '@shared/socialIcebreakerYuezaiCopy';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let workerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const POLL_INTERVAL_MS = 5000; // 5 seconds
const JOB_TIMEOUT_MS = 60000; // 60 seconds per job (quality gate may retry)

// ---------------------------------------------------------------------------
// Phase-to-feature-type mapping for quality gate
// ---------------------------------------------------------------------------

const PHASE_FEATURE_TYPES: Record<string, JudgeFeatureType> = {
  warmup: 'icebreaker_warmup',
  micro_challenge: 'icebreaker_micro_challenge',
  lie_detective: 'icebreaker_lie_detective',
  personality_dice: 'icebreaker_personality_dice',
  auction: 'icebreaker_auction',
  quip_battle: 'icebreaker_micro_challenge', // reuse micro_challenge rubric for quip battle
  group_mirror: 'icebreaker_warmup', // reuse warmup rubric for group mirror
};

// ---------------------------------------------------------------------------
// Fallback content generators (used when quality gate discards)
// ---------------------------------------------------------------------------

function getFallbackTopics(mood: AtmosphereMood): SocialTopic[] {
  // campfire-vault-card-pr1 A1: fb_w2 carries the brave-but-safe slot
  // (safety 'reflective' — invites admitting a regret, never death/abuse/
  // self-harm/explicit), so this quality-gate-discard bank also guarantees
  // ≥1 brave question.
  const topics: SocialTopic[] = [
    { id: 'fb_w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
    { id: 'fb_w2', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'reflective' },
    { id: 'fb_w3', question: '你手机里最新的一张照片是什么？（不想秀可以描述）', mood: 'funny', emoji: '📸', category: '轻松好奇', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
    { id: 'fb_w4', question: '最近有get到什么新技能吗？哪怕是煮泡面不糊锅', mood: 'life', emoji: '✨', category: '成长小事', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
    { id: 'fb_w5', question: '如果用一种动物形容今天的自己，你会选什么？', mood: 'funny', emoji: '🐾', category: '脑洞联想', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  ];
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((t, i) => ({
    ...t,
    id: `fb_${mood}_${i}`,
    mood,
    // 悦仔说 permission whisper — deterministic per topic (contract A2).
    permissionLine: selectPermissionLineForTopic({ question: t.question, depthLevel: t.depthLevel }),
  }));
}

function getFallbackLieDetectiveStatements(): LieDetectiveStatement[] {
  const sets: LieDetectiveStatement[][] = [
    [
      { index: 1, text: '我曾在凌晨三点一个人爬过一座山，就是觉得想去了', isLie: false },
      { index: 2, text: '我养过一只会接电话的鹦鹉，后来它学会了骂人', isLie: true },
      { index: 3, text: '我高考前一天还在打游戏，结果比平时多考了30分', isLie: false },
    ],
    [
      { index: 1, text: '我曾经为了吃一碗面坐了两个小时地铁', isLie: false },
      { index: 2, text: '我大学时是街舞社的社长，拿过市级冠军', isLie: true },
      { index: 3, text: '我有一次做饭把锅烧穿了，邻居以为着火了', isLie: false },
    ],
    [
      { index: 1, text: '我能用舌头给樱桃梗打结', isLie: true },
      { index: 2, text: '我曾在便利店打工三个月，记住了所有关东煮的位置', isLie: false },
      { index: 3, text: '我有一次出差把行李箱落在了出租车上，里面有护照', isLie: false },
    ],
  ];
  return [...sets].sort(() => Math.random() - 0.5)[0];
}

/**
 * wave2-auctionV2 (verifier M4): delegates to the canonical 12-item bank —
 * the former stale 3-item duplicate was retired in the same sprint that born
 * the canonical bank. NOTE (contract Proposed Files): the auction pregen
 * output is currently UNCONSUMED (no getPreGenerationResult call in
 * socialIcebreakerExtended.ts); any future consumption must thread the
 * session's auctionV2Enabled snapshot + vibe instead of this legacy call.
 */
function getFallbackAuctionLots(): AuctionLot[] {
  return selectAuctionFallbackLots({ count: 3 });
}

/**
 * wave1-3 (AC-02 sites 7–8 / AC-10): resolve choose-mode from the per-job
 * payload FIRST (threaded from the session snapshot at enqueue time), falling
 * back to the legacy env read for jobs enqueued before the field existed.
 * Synchronous by design — `getFallbackForPhase` is a sync function and a
 * session without a payload snapshot is semantically a legacy session.
 * Exported for the personalityDiceChooseModeFlag contract tests; pure.
 */
export function resolvePersonalityDiceChooseModeFromPayload(
  payload: Record<string, unknown>,
): boolean {
  return typeof payload.personalityDiceChooseMode === 'boolean'
    ? payload.personalityDiceChooseMode
    : (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true';
}

/** Exported for the wave1-3 contract tests (worker output-shape assertions). */
export function getFallbackForPhase(
  phase: string,
  payload: Record<string, unknown>,
): { data: unknown; meta: Record<string, unknown> } {
  switch (phase) {
    case 'warmup': {
      const mood = (payload.mood as AtmosphereMood) || 'funny';
      return { data: getFallbackTopics(mood), meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() } };
    }
    case 'micro_challenge': {
      const challenges = selectMicroChallenges({
        participantCount: (payload.participantCount as number) || 4,
        completedIds: [],
        seed: payload.seed as string || 'fallback',
        scene: 'both',
        count: 3,
      });
      return { data: challenges, meta: { provider: null, fallbackUsed: true, promptVersion: 'selector-v1', generatedAt: new Date().toISOString() } };
    }
    case 'lie_detective': {
      const participants = (payload.participants as Array<{ userId: string; displayName: string }>) || [];
      const statements = getFallbackLieDetectiveStatements();
      return {
        data: participants.map(() => statements),
        meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() },
      };
    }
    case 'personality_dice': {
      const participants = (payload.participants as Array<{ userId: string; displayName: string; archetype?: string }>) || [];
      // wave1-3 (AC-02 site 7): payload-first; legacy jobs fall back to env.
      const chooseModeEnabled = resolvePersonalityDiceChooseModeFromPayload(payload);
      if (chooseModeEnabled) {
        const groups: PersonalityDiceChallengeGroup[] = participants.map((p) => {
          const dares = getDaresForArchetype(p.archetype || 'corgi');
          const options = dares.map((dare) => ({
            userId: p.userId,
            displayName: p.displayName,
            archetype: p.archetype,
            dominantTrait: 'P' as const,
            challengeTitle: dare.title,
            challengeBody: dare.body,
            challengeEmoji: dare.emoji,
            difficulty: (dare.difficulty === 'easy' ? 'easy' : dare.difficulty === 'medium' ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard',
            passLine: dare.passLine,
            passConsequence: dare.passConsequence,
          }));
          return {
            userId: p.userId,
            displayName: p.displayName,
            archetype: p.archetype,
            dominantTrait: 'P' as const,
            options,
          };
        });
        return { data: groups, meta: { provider: null, fallbackUsed: true, promptVersion: 'dare-bank-v2', generatedAt: new Date().toISOString() } };
      }
      const challenges = participants.map((p) => {
        const dares = getDaresForArchetype(p.archetype || 'corgi');
        const dare = dares[Math.floor(Math.random() * dares.length)];
        return {
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
          dominantTrait: 'P' as const,
          challengeTitle: dare.title,
          challengeBody: dare.body,
          challengeEmoji: dare.emoji,
          difficulty: (dare.difficulty === 'easy' ? 'easy' : dare.difficulty === 'medium' ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard',
          passLine: dare.passLine,
          passConsequence: dare.passConsequence,
        };
      });
      return { data: challenges, meta: { provider: null, fallbackUsed: true, promptVersion: 'dare-bank-v1', generatedAt: new Date().toISOString() } };
    }
    case 'auction': {
      return { data: getFallbackAuctionLots(), meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() } };
    }
    case 'quip_battle': {
      return { data: getRandomQuipBattlePrompts(3), meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() } };
    }
    case 'undercover_word': {
      return { data: getFallbackUndercoverPair(), meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() } };
    }
    case 'group_mirror': {
      const participants = (payload.participants as Array<{ userId: string; displayName: string }>) || [];
      return {
        data: getFallbackGroupMirrorQuestions(5).map((q) => ({
          ...q,
          // seed participant names into fallback for minimal personalization
          questionText: participants.length > 0
            ? q.questionText.replace('大家', participants.map((p) => p.displayName).join('、'))
            : q.questionText,
        })),
        meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() },
      };
    }
    default:
      return { data: [], meta: { provider: null, fallbackUsed: true, promptVersion: 'fallback-v1', generatedAt: new Date().toISOString() } };
  }
}

// ---------------------------------------------------------------------------
// Phase-to-generator mapping
// ---------------------------------------------------------------------------

type GeneratorFn = (socialSessionId: string, payload: Record<string, unknown>) => Promise<{
  data: unknown;
  meta: Record<string, unknown>;
}>;

// NOTE (sprint wave3-highlightsInjector, contract Out-of-Scope): pregen runs
// SESSION-FREE — there is no social-icebreaker session state at job time, so
// no generator below receives `highlights` and none ever should invent one.
// Session highlights (state.highlights) only exist after real transitions;
// any future pregen consumption of the highlights-injector feature must stay
// silent-by-design (the in-session on-demand paths re-ask with state anyway).
const PHASE_GENERATORS: Record<string, GeneratorFn> = {
  warmup: async (_sessionId, payload) => {
    const result = await generateWarmupTopics({
      mood: (payload.mood as any) || 'funny',
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      roster: (payload.participants as any[]) || [],
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  micro_challenge: async (_sessionId, payload) => {
    const result = await generateMicroChallenges({
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      seed: payload.seed as string,
      roster: (payload.participants as any[]) || [],
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  // NOTE (sprint wave1-2-lieDetectiveV2Enabled, verifier hole 4-1): this path
  // resolves the lie-detective mode env-only (generateLieDetectiveStatements
  // falls back to getLieDetectiveMode() with no session mode) and BYPASSES the
  // DB-backed lieDetectiveV2Enabled flag + phase-entry snapshot. Safe today
  // only because lie_detective pregen output is currently UNCONSUMED (no
  // getPreGenerationResult reader for this phase). Any future pregen
  // consumption for lie_detective MUST thread the session's snapshotted
  // state.lieDetectiveMode through as `mode` first.
  lie_detective: async (_sessionId, payload) => {
    const participants = (payload.participants as Array<{ userId: string; displayName: string; archetype?: string; interests?: string[] }>) || [];
    const results = await Promise.all(
      participants.map((p) =>
        generateLieDetectiveStatements({
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
          interests: p.interests,
          _refinementHint: payload._refinementHint as string | undefined,
        }),
      ),
    );
    return {
      data: results.map((r) => r.data),
      meta: (results[0]?.meta as unknown as Record<string, unknown>) || {},
    };
  },

  personality_dice: async (_sessionId, payload) => {
    const participants = (payload.participants as Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>) || [];
    // wave1-3 (AC-02 site 8): payload-first; legacy jobs fall back to env.
    const chooseModeEnabled = resolvePersonalityDiceChooseModeFromPayload(payload);
    if (chooseModeEnabled) {
      const result = await generatePersonalityDiceChallengeGroups({ participants, _refinementHint: payload._refinementHint as string | undefined });
      return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
    }
    const result = await generatePersonalityDiceChallenges({ participants, _refinementHint: payload._refinementHint as string | undefined });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  auction: async (_sessionId, payload) => {
    const result = await generateAuctionLots({
      participantCount: (payload.participantCount as number) || 4,
      eventType: payload.eventType as string,
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  quip_battle: async (_sessionId, payload) => {
    const result = await generateQuipBattlePrompts({
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      participants: (payload.participants as Array<{ displayName: string; archetype?: string }>) || [],
      roster: (payload.participants as Array<{ archetype?: string }>) || [],
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  undercover_word: async (_sessionId, payload) => {
    const result = await generateUndercoverWordPair({
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      roster: (payload.participants as Array<{ userId: string; displayName: string; archetype?: string }>) || [],
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  group_mirror: async (_sessionId, payload) => {
    const participants = (payload.participants as Array<{ userId: string; displayName: string; archetype?: string }>) || [];
    const result = await generateGroupMirrorQuestions({
      eventType: (payload.eventType as string) || '活动',
      participantCount: participants.length,
      participantNames: participants.map((p) => p.displayName).filter(Boolean) as string[],
      roster: participants,
      _refinementHint: payload._refinementHint as string | undefined,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },
};

// ---------------------------------------------------------------------------
// Quality-gated generation wrapper
// ---------------------------------------------------------------------------

async function runGeneratorWithQualityGate(
  phase: string,
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<{ data: unknown; meta: Record<string, unknown>; gateResult?: Record<string, unknown> } | null> {
  const generator = PHASE_GENERATORS[phase];
  if (!generator) return null;

  const featureType = PHASE_FEATURE_TYPES[phase];
  if (!featureType) {
    // Phase without quality gate support — generate directly
    return generator(sessionId, payload);
  }

  let lastResult: { data: unknown; meta: Record<string, unknown> } | null = null;

  const generateFn = async (hint?: string): Promise<string> => {
    const enrichedPayload = hint
      ? { ...payload, _refinementHint: hint }
      : payload;
    lastResult = await generator(sessionId, enrichedPayload);
    return JSON.stringify(lastResult.data);
  };

  const gateResult = await generateWithQualityGate(
    generateFn,
    { featureType, phase, contentLanguage: 'zh' },
    { forceBlocking: true },
  );

  if (!gateResult) {
    // Quality gate discarded — use fallback
    logger.warn('Pre-generation worker: quality gate discarded, using fallback', { phase, sessionId });
    return getFallbackForPhase(phase, payload);
  }

  // Use the last generator result (may be from a refined attempt)
  return lastResult!;
}

// ---------------------------------------------------------------------------
// Job execution
// ---------------------------------------------------------------------------

async function processOneJob(): Promise<void> {
  const job = await dequeuePendingJob();
  if (!job) return;

  logger.info('Pre-generation worker processing job', {
    jobId: job.id,
    socialSessionId: job.socialSessionId,
    phase: job.phase,
  });

  try {
    const result = await Promise.race([
      runGeneratorWithQualityGate(job.phase, job.socialSessionId, job.payload),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT_MS),
      ),
    ]);

    if (!result) {
      await failPreGenerationJob(job.id, 'quality_gate_discard');
      return;
    }

    if (!(await isPreGenerationJobRunning(job.id))) {
      logger.warn('Pre-generation job superseded before result write, skipping', {
        jobId: job.id,
        socialSessionId: job.socialSessionId,
        phase: job.phase,
      });
      return;
    }

    const resultId = await storePreGenerationResult(
      job.socialSessionId,
      job.phase,
      result.data as Record<string, unknown>,
      result.meta,
    );

    const completed = await completePreGenerationJob(job.id, resultId);
    if (!completed) {
      await deletePreGenerationResultById(resultId);
      logger.warn('Pre-generation result discarded (job superseded during completion)', {
        jobId: job.id,
        resultId,
        socialSessionId: job.socialSessionId,
        phase: job.phase,
      });
      return;
    }

    logger.info('Pre-generation worker completed job', {
      jobId: job.id,
      socialSessionId: job.socialSessionId,
      phase: job.phase,
      resultId,
      fallbackUsed: result.meta?.fallbackUsed === true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Pre-generation worker failed job', {
      jobId: job.id,
      socialSessionId: job.socialSessionId,
      phase: job.phase,
      error: errorMessage,
    });
    await failPreGenerationJob(job.id, errorMessage.slice(0, 100));
  }
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

export function startPreGenerationWorker(): void {
  if (isRunning) {
    logger.warn('Pre-generation worker already running');
    return;
  }

  isRunning = true;
  logger.info('Pre-generation worker started', { pollIntervalMs: POLL_INTERVAL_MS });

  // Process immediately, then on interval
  void processOneJob();

  workerInterval = setInterval(() => {
    void processOneJob();
  }, POLL_INTERVAL_MS);
}

export function stopPreGenerationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  isRunning = false;
  logger.info('Pre-generation worker stopped');
}

export function isPreGenerationWorkerRunning(): boolean {
  return isRunning;
}
