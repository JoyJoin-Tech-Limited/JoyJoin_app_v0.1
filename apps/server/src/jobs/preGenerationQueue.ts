/**
 * Pre-Generation Queue — Submit jobs for async AI content generation
 *
 * Usage:
 *   import { enqueuePreGeneration } from './preGenerationQueue';
 *   await enqueuePreGeneration(sessionId, phase, payload);
 *
 * Phases that benefit from pre-generation:
 *   - warmup, micro_challenge, lie_detective, personality_dice, auction, quip_battle, undercover_word, group_mirror
 * Phases that do NOT pre-generate (lightweight or real-time dependent):
 *   - mini_script (framework pre-gen handled separately), vote, summary
 */

import { enqueuePreGenerationJob } from '../lib/socialIcebreakerStore';
import { logger } from '../lib/logger';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';

// Phases eligible for pre-generation
const ELIGIBLE_PHASES: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'personality_dice',
  'auction',
  'quip_battle',
  'undercover_word',
  'group_mirror',
];

/**
 * Enqueue a single pre-generation job.
 * Returns jobId if enqueued, null if phase not eligible.
 */
export async function enqueuePreGeneration(
  socialSessionId: string,
  phase: SocialIcebreakerPhase,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!ELIGIBLE_PHASES.includes(phase)) {
    return null;
  }

  try {
    const jobId = await enqueuePreGenerationJob(socialSessionId, phase, 0, payload);
    logger.info('Pre-generation job enqueued', {
      jobId,
      socialSessionId,
      phase,
    });
    return jobId ?? null;
  } catch (error) {
    logger.error('Failed to enqueue pre-generation job', {
      socialSessionId,
      phase,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Enqueue pre-generation jobs for all phases in a run plan.
 * Uses participant roster from the session payload.
 */
export async function enqueueRunPlanPreGeneration(
  socialSessionId: string,
  runPlan: { segments: Array<{ phase: string; durationMinutes?: number }> },
  sessionPayload: {
    participantCount?: number;
    eventType?: string;
    participants?: Array<{
      userId: string;
      displayName: string;
      archetype?: string;
      interests?: string[];
      traitScores?: Record<string, number>;
    }>;
  },
): Promise<string[]> {
  const jobIds: string[] = [];

  for (const entry of runPlan.segments) {
    if (!ELIGIBLE_PHASES.includes(entry.phase as SocialIcebreakerPhase)) {
      continue;
    }

    const payload: Record<string, unknown> = {
      participantCount: sessionPayload.participantCount,
      eventType: sessionPayload.eventType,
      participants: sessionPayload.participants,
      seed: `${socialSessionId}-${entry.phase}`,
    };

    // Phase-specific payload tailoring
    switch (entry.phase) {
      case 'warmup':
        payload.mood = 'funny';
        break;
      case 'personality_dice':
      case 'lie_detective':
        // Already includes full participant list with archetypes
        break;
      case 'auction':
      case 'quip_battle':
      case 'micro_challenge':
      case 'undercover_word':
      default:
        // Minimal payload, generator fills in
        break;
    }

    const jobId = await enqueuePreGeneration(socialSessionId, entry.phase as SocialIcebreakerPhase, payload);
    if (jobId) jobIds.push(jobId);
  }

  logger.info('Run plan pre-generation enqueued', {
    socialSessionId,
    phaseCount: jobIds.length,
  });

  return jobIds;
}

/**
 * Check whether a phase should skip on-demand generation because
 * pre-generation is in-flight or already available.
 */
export async function shouldSkipOnDemandGeneration(
  socialSessionId: string,
  phase: string,
): Promise<{ skip: boolean; reason: 'available' | 'in_flight' | 'none'; resultId?: string }> {
  const { getPreGenerationResult, getInFlightJobForPhase } = await import('../lib/socialIcebreakerStore');

  const result = await getPreGenerationResult(socialSessionId, phase);
  if (result) {
    return { skip: true, reason: 'available', resultId: undefined };
  }

  const inFlight = await getInFlightJobForPhase(socialSessionId, phase);
  if (inFlight && isPreGenerationJobFresh(inFlight.updatedAt)) {
    return { skip: true, reason: 'in_flight' };
  }

  return { skip: false, reason: 'none' };
}

const PRE_GENERATION_RUNNING_FRESH_MS = 60_000;

export function isPreGenerationJobFresh(updatedAt?: Date | null, now = Date.now()): boolean {
  const updatedAtMs = updatedAt?.getTime() ?? Number.NaN;
  return Number.isFinite(updatedAtMs) && now - updatedAtMs < PRE_GENERATION_RUNNING_FRESH_MS;
}
