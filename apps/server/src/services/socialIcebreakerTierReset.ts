import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';
import { compileForSession } from './runPlanService';
import { seedSingleTestBotsWarmupReady } from './socialIcebreakerBotService';
import { updateSession, invalidatePreGenerationForSession } from '../lib/socialIcebreakerStore';
import { logger } from '../lib/logger';

export type ResetTierSource = '/start' | '/set-tier';

export type ResetTierResult =
  | {
      reset: true;
      oldTier: TierMachineId | undefined;
      newTier: TierMachineId;
      hadExistingRunPlan: boolean;
    }
  | {
      reset: false;
      reason: 'same_tier' | 'not_host' | 'not_warmup' | 'custom_disabled';
    };

export interface ResetSocialIcebreakerTierOptions {
  state: SocialSessionState;
  newTier: TierMachineId;
  newVibe?: 'chat' | 'balanced' | 'game';
  userId: string;
  resetSource: ResetTierSource;
  customModeEnabled: boolean;
}

const VALID_VIBES: Array<'chat' | 'balanced' | 'game'> = ['chat', 'balanced', 'game'];

/**
 * Reset an existing social icebreaker session to a different tier/vibe.
 *
 * Guards:
 * - Only the original host can reset the tier.
 * - Reset is only allowed while the session is still in warmup.
 * - Custom mode requires `socialIcebreakerCustomModeEnabled` to be true.
 *
 * Side effects:
 * - Persists the mutated session via `updateSession`.
 * - Invalidates any pre-generated content for the old run plan asynchronously.
 * - Emits a structured log event.
 *
 * The participant roster is preserved; only tier/vibe and phase progress are
 * cleared. Callers must still handle response formatting and any follow-up
 * work (e.g. enqueueing pre-generation for a new preset run plan).
 */
export async function resetSocialIcebreakerTier(
  options: ResetSocialIcebreakerTierOptions,
): Promise<ResetTierResult> {
  const { state, newTier, newVibe, userId, resetSource, customModeEnabled } = options;

  if (state.hostUserId !== userId) {
    return { reset: false, reason: 'not_host' };
  }

  if (state.currentPhase !== 'warmup') {
    return { reset: false, reason: 'not_warmup' };
  }

  const oldTier = state.eventTier;
  const oldVibe = state.vibe;
  const oldPhase = state.currentPhase;

  const resolvedVibe = newVibe && VALID_VIBES.includes(newVibe) ? newVibe : undefined;
  const willVibeChange = resolvedVibe !== undefined && resolvedVibe !== oldVibe;

  if (oldTier === newTier && !willVibeChange) {
    return { reset: false, reason: 'same_tier' };
  }

  if (newTier === 'custom' && !customModeEnabled) {
    return { reset: false, reason: 'custom_disabled' };
  }

  const hadExistingRunPlan = !!state.runPlan;

  // Clear inherited phase progress and ephemeral state. Iterate over any
  // completed phases to scrub their phase-specific payloads.
  if (state.completedPhases?.length) {
    for (const completedPhase of state.completedPhases) {
      cleanupPhaseStateForNextPhase(state, completedPhase);
    }
  }

  state.completedPhases = [];
  state.phaseSelectionId = undefined;
  state.currentPhase = 'warmup';
  state.phaseStartedAt = Date.now();
  state.autoAdvanceScheduledAt = undefined;
  state.warmupReadyUserIds = [];
  // Tier reset discards the previous topic set; generation is not in-flight.
  state.warmupTopicsStatus = 'idle';
  // Single-test bot attendees default to ready after a tier reset.
  seedSingleTestBotsWarmupReady(state);

  if (newTier === 'custom') {
    state.eventTier = 'custom';
    state.vibe = resolvedVibe ?? oldVibe ?? 'balanced';
    state.runPlan = undefined;
    state.autoAdvanceEnabled = false;
  } else {
    state.eventTier = newTier;
    if (resolvedVibe) {
      state.vibe = resolvedVibe;
    }
    const runPlan = await compileForSession(state, newTier);
    state.runPlan = runPlan;
    state.autoAdvanceEnabled = true;
  }

  await updateSession(state.socialSessionId, state);
  void invalidatePreGenerationForSession(state.socialSessionId).catch((err) => {
    logger.warn('Failed to invalidate pre-generated content after tier reset', {
      socialSessionId: state.socialSessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  logger.info('Social icebreaker tier reset', {
    socialSessionId: state.socialSessionId,
    userId,
    resetSource,
    oldTier,
    newTier,
    oldVibe,
    newVibe: state.vibe,
    oldPhase,
    hadExistingRunPlan,
  });

  return { reset: true, oldTier, newTier, hadExistingRunPlan };
}
