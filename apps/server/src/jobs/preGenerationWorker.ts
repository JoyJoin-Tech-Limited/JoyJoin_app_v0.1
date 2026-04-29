/**
 * Pre-Generation Worker — Async AI content generator
 *
 * Polls for pending pre-generation jobs, calls the appropriate AI generator,
 * stores results, and marks jobs as completed/failed.
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
} from '../lib/socialIcebreakerStore';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generatePersonalityDiceChallenges,
  generateAuctionLots,
  generateQuipBattlePrompts,
} from '../socialIcebreakerAIService';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let workerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const POLL_INTERVAL_MS = 5000; // 5 seconds
const JOB_TIMEOUT_MS = 30000; // 30 seconds per job

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
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  micro_challenge: async (_sessionId, payload) => {
    const result = await generateMicroChallenges({
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      seed: payload.seed as string,
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
    const result = await generatePersonalityDiceChallenges(participants);
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  auction: async (_sessionId, payload) => {
    const result = await generateAuctionLots({
      participantCount: (payload.participantCount as number) || 4,
      eventType: payload.eventType as string,
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },

  quip_battle: async (_sessionId, payload) => {
    const result = await generateQuipBattlePrompts({
      eventType: (payload.eventType as string) || '活动',
      participantCount: (payload.participantCount as number) || 4,
      participants: (payload.participants as Array<{ displayName: string; archetype?: string }>) || [],
    });
    return { data: result.data, meta: result.meta as unknown as Record<string, unknown> };
  },
};

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

  const generator = PHASE_GENERATORS[job.phase];
  if (!generator) {
    logger.warn('Pre-generation worker: no generator for phase', { phase: job.phase });
    await failPreGenerationJob(job.id, 'no_generator');
    return;
  }

  try {
    const result = await Promise.race([
      generator(job.socialSessionId, job.payload),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT_MS),
      ),
    ]);

    const resultId = await storePreGenerationResult(
      job.socialSessionId,
      job.phase,
      result.data as Record<string, unknown>,
      result.meta,
    );

    await completePreGenerationJob(job.id, resultId);

    logger.info('Pre-generation worker completed job', {
      jobId: job.id,
      socialSessionId: job.socialSessionId,
      phase: job.phase,
      resultId,
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
