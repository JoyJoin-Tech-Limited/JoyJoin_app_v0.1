import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { createRunPlan, type IcebreakerRunPlan, type PhaseSegment } from '@shared/phaseModule';
import { getPhaseModule } from '@shared/phaseRegistry';

export type CustomGamePhase = Exclude<
  SocialIcebreakerPhase,
  'warmup' | 'recap' | 'phase_selection'
>;

const NON_GAME_PHASES = new Set<SocialIcebreakerPhase>(['warmup', 'recap', 'phase_selection']);
export const CUSTOM_GAME_PHASES: CustomGamePhase[] = [
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'speed_friending',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'mini_script',
];

export type CustomGameValidation =
  | { ok: true; phases: CustomGamePhase[] }
  | { ok: false; reason: 'empty' | 'duplicate' | 'invalid' };

export function validateCustomGamePhases(
  phases: SocialIcebreakerPhase[],
): CustomGameValidation {
  if (phases.length === 0) return { ok: false, reason: 'empty' };
  if (new Set(phases).size !== phases.length) return { ok: false, reason: 'duplicate' };

  const knownGames = new Set<SocialIcebreakerPhase>(CUSTOM_GAME_PHASES);
  if (
    phases.some(
      (phase) => NON_GAME_PHASES.has(phase) || !knownGames.has(phase),
    )
  ) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, phases: phases as CustomGamePhase[] };
}

function toSegment(phase: SocialIcebreakerPhase): PhaseSegment {
  const module = getPhaseModule(phase);
  const energyWeight = module.energyArc === 'peak' ? 3 : module.energyArc === 'rising' ? 2 : 1;
  return {
    phase,
    allocatedMinutes: module.durationMinutes,
    energyWeight,
    participation: module.participation,
    tone: module.tone,
    rationale: '主持人自定义选择',
  };
}

export function buildCustomRunPlan(phases: CustomGamePhase[]): IcebreakerRunPlan {
  const orderedPhases: SocialIcebreakerPhase[] = [...phases, 'recap'];
  return createRunPlan(
    orderedPhases.map(toSegment),
    'custom-selection-v1',
  );
}
