import type { SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker';
import { DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES } from '@shared/socialIcebreaker';

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
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
    if (isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA, false)) {
      filteredPhases.push('mini_script_beta');
    }
    return filteredPhases;
  }

  if (isEnabled(env.SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA, false)) {
    enabledPhases.push('mini_script_beta');
  }

  return enabledPhases;
}

export function ensureSessionEnabledPhases(state: SocialSessionState): SocialIcebreakerPhase[] {
  const enabledPhases = state.enabledPhases?.length ? state.enabledPhases : getServerEnabledPhases();
  state.enabledPhases = enabledPhases;
  return enabledPhases;
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
      return;
    default:
      return;
  }
}
