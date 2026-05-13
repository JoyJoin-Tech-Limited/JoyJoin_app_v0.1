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
import type { SocialTopic, AtmosphereMood, LieDetectiveStatement, AuctionLot, MicroChallenge, GroupMirrorQuestion } from '@shared/socialIcebreaker';
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
  const topics: SocialTopic[] = [
    { id: 'fb_w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
    { id: 'fb_w2', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
    { id: 'fb_w3', question: '你手机里最新的一张照片是什么？（不想秀可以描述）', mood: 'funny', emoji: '📸', category: '轻松好奇', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
    { id: 'fb_w4', question: '最近有get到什么新技能吗？哪怕是煮泡面不糊锅', mood: 'life', emoji: '✨', category: '成长小事', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
    { id: 'fb_w5', question: '如果用一种动物形容今天的自己，你会选什么？', mood: 'funny', emoji: '🐾', category: '脑洞联想', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  ];
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map((t, i) => ({ ...t, id: `fb_${mood}_${i}`, mood }));
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

function getFallbackAuctionLots(): AuctionLot[] {
  return [
    { id: 'lot_fb_1', title: '分享一个无伤大雅的社死瞬间', teaser: '越离谱越好，反正大家都不认识' },
    { id: 'lot_fb_2', title: '用三句话编一个离谱旅行故事', teaser: '现场即兴，瞎编也行' },
    { id: 'lot_fb_3', title: '爆料一个今晚之前没人知道的小习惯', teaser: '说完就翻篇，不截图' },
  ];
}

function getFallbackForPhase(
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
