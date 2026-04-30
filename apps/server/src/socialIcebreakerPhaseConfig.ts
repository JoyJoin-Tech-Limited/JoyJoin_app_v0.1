import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker';
import { DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES } from '@shared/socialIcebreaker';
import { getPhaseModule } from '@shared/phaseRegistry';
import { getNextPhaseFromPlan } from '@shared/phaseModule';
import type { IcebreakerRunPlan } from '@shared/phaseModule';

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/** Official flag: `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`. Legacy: `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA`. */
function isMiniScriptPhaseEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT, false)) return true;
  return isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA, false);
}

export function getServerEnabledPhases(env: NodeJS.ProcessEnv = process.env): SocialIcebreakerPhase[] {
  const enabledPhases = [...DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES];
  const personalityDiceEnabled = isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE, true);

  if (isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_AUCTION, false)) {
    const personalityDiceIndex = enabledPhases.indexOf('personality_dice');
    const insertAt = personalityDiceIndex >= 0 ? personalityDiceIndex : enabledPhases.length;
    enabledPhases.splice(insertAt, 0, 'auction');
  }

  if (personalityDiceEnabled === false) {
    const filteredPhases = enabledPhases.filter((phase) => phase !== 'personality_dice');
    if (isMiniScriptPhaseEnabled(env)) {
      filteredPhases.push('mini_script');
    }
    return filteredPhases;
  }

  if (isMiniScriptPhaseEnabled(env)) {
    enabledPhases.push('mini_script');
  }

  return enabledPhases;
}

export function ensureSessionEnabledPhases(state: SocialSessionState): SocialIcebreakerPhase[] {
  const enabledPhases = state.enabledPhases?.length ? state.enabledPhases : getServerEnabledPhases();
  state.enabledPhases = enabledPhases;
  return enabledPhases;
}

/**
 * Get the list of phases to use for navigation.
 *
 * Priority:
 * 1. If a run plan exists, use its segments
 * 2. Fall back to server-enabled phases
 */
export function getEffectivePhaseList(state: SocialSessionState): SocialIcebreakerPhase[] {
  if (state.runPlan?.segments?.length) {
    return state.runPlan.segments.map((s) => s.phase);
  }
  return ensureSessionEnabledPhases(state);
}

/**
 * Get the next phase, respecting run plans if present.
 *
 * If a run plan exists, uses the plan's segment order.
 * Otherwise falls back to the legacy `enabledPhases` / `PHASE_ORDER` logic.
 */
export function getNextPhase(
  current: SocialIcebreakerPhase,
  state: SocialSessionState,
): SocialIcebreakerPhase {
  // Run plan takes priority
  if (state.runPlan?.segments?.length) {
    const next = getNextPhaseFromPlan(current, state.runPlan);
    if (next) return next;
    return 'recap'; // always end at recap
  }

  // Legacy fallback
  const enabledPhases = ensureSessionEnabledPhases(state);
  const idx = enabledPhases.indexOf(current);
  if (idx === -1 || idx === enabledPhases.length - 1) return 'recap';
  return enabledPhases[idx + 1];
}

/**
 * Get the next eligible phase, skipping phases that don't meet min player requirements.
 *
 * Respects run plans if present.
 */
export function getNextEligiblePhase(
  current: SocialIcebreakerPhase,
  state: SocialSessionState,
): SocialIcebreakerPhase {
  let candidate: SocialIcebreakerPhase = getNextPhase(current, state);
  const visited = new Set<SocialIcebreakerPhase>();

  while (candidate !== 'recap' && !visited.has(candidate)) {
    visited.add(candidate);
    const module = getPhaseModule(candidate);
    if (state.playerCount >= module.minPlayers) {
      return candidate;
    }
    candidate = getNextPhase(candidate, state);
  }

  return 'recap';
}

export function cleanupPhaseStateForNextPhase(
  state: SocialSessionState,
  completedPhase: SocialIcebreakerPhase,
): void {
  switch (completedPhase) {
    case 'warmup':
      state.warmupReadyUserIds = undefined;
      return;
    case 'micro_challenge':
      state.currentChallenge = undefined;
      return;
    case 'lie_detective':
      if (Array.isArray(state.lieDetectivePlayers)) {
        state.lieDetectivePlayers = state.lieDetectivePlayers.map((player) => ({
          userId: player.userId,
          displayName: player.displayName,
          statements: [],
        }));
      }
      state.votes = undefined;
      state.currentLieDetectivePlayerIndex = undefined;
      state.currentLieDetectiveReveal = undefined;
      state.lieDetectiveCompletedUserIds = undefined;
      return;
    case 'personality_dice':
      state.personalityDiceChallenges = undefined;
      state.currentDicePlayerIndex = undefined;
      state.diceCompletedBy = undefined;
      state.dicePassedBy = undefined;
      return;
    case 'mini_script':
      state.miniScriptFramework = undefined;
      state.miniScriptFrameworkGeneratedAt = undefined;
      state.miniScriptFrameworkGeneratedByUserId = undefined;
      return;
    case 'auction':
      state.auctionLots = undefined;
      state.auctionLotsMeta = undefined;
      state.auctionBalances = undefined;
      state.auctionCurrentLotIndex = undefined;
      state.auctionHighBid = undefined;
      state.auctionAllLotsClosed = undefined;
      state.auctionRecapLines = undefined;
      return;
    default:
      return;
  }
}
