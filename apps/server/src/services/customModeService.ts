import type { SocialSessionState, SelectablePhaseInfo, SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { getPhaseModule, getAllPhaseModules } from '@shared/phaseRegistry';
import crypto from 'crypto';

export function isCustomMode(state: SocialSessionState): boolean {
  return state.eventTier === 'custom';
}

export function generatePhaseSelectionId(): string {
  return `ps_${crypto.randomUUID()}`;
}

const EXCLUDED_PHASES: Set<SocialIcebreakerPhase> = new Set([
  'warmup',
  'recap',
  'phase_selection',
]);

/**
 * Compute the list of phases a custom-mode host can choose next.
 *
 * Rules:
 * - Exclude warmup, recap, and the picker itself.
 * - Respect server-enabled phases (unless overridden).
 * - Disable phases that do not meet min player requirements.
 * - Mark already-completed phases as disabled with a friendly reason
 *   (they can still be re-selected if desired, but we visually flag them).
 */
export function computeSelectablePhases(state: SocialSessionState): SelectablePhaseInfo[] {
  const enabledPhases = state.enabledPhases?.length
    ? state.enabledPhases
    : getAllPhaseModules().map((m) => m.id as SocialIcebreakerPhase);

  const playerCount = state.playerCount || 1;
  const completed = new Set(state.completedPhases || []);

  const selectable: SelectablePhaseInfo[] = [];

  for (const phase of enabledPhases) {
    if (EXCLUDED_PHASES.has(phase)) continue;

    const module = getPhaseModule(phase);
    const completedAlready = completed.has(phase);
    const lacksPlayers = playerCount < module.minPlayers;

    let disabledReason: string | undefined;
    if (lacksPlayers) {
      disabledReason = `至少 ${module.minPlayers} 人`;
    } else if (completedAlready) {
      disabledReason = '已经玩过';
    }

    selectable.push({
      phase: phase as Exclude<SocialIcebreakerPhase, 'warmup' | 'recap' | 'phase_selection'>,
      name: module.name,
      nameEn: module.nameEn,
      emoji: module.emoji,
      minPlayers: module.minPlayers,
      disabled: lacksPlayers || completedAlready,
      disabledReason,
    });
  }

  return selectable;
}
