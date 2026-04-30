/**
 * Social Icebreaker — Tier Run Plans
 *
 * Hardcoded run plans for the three session tiers.
 * Each tier adds a new "category" of phase, creating a clear escalation ladder:
 *   Breeze  = social warm-up only (no performance/competition phases)
 *   Glow    = adds conversation generators (personality_dice, group_mirror)
 *   Blaze   = adds performance/competition phases (auction, quip_battle)
 */

import type { IcebreakerRunPlan } from './phaseModule.js';
import type { SocialIcebreakerPhase } from './socialIcebreaker.js';

export const BREEZE_RUN_PLAN: IcebreakerRunPlan = {
  version: 2,
  segments: [
    { phase: 'warmup', allocatedMinutes: 10, energyWeight: 1, participation: 'full', tone: 'gentle' },
    { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2, participation: 'full', tone: 'playful' },
    { phase: 'lie_detective', allocatedMinutes: 15, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'recap', allocatedMinutes: 5, energyWeight: 1, participation: 'observe_ok', tone: 'gentle' },
  ],
  totalMinutes: 40,
  compilerId: 'breeze-v1',
  compiledAt: new Date().toISOString(),
};

export const GLOW_RUN_PLAN: IcebreakerRunPlan = {
  version: 2,
  segments: [
    { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1, participation: 'full', tone: 'gentle' },
    { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2, participation: 'full', tone: 'playful' },
    { phase: 'lie_detective', allocatedMinutes: 12, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'personality_dice', allocatedMinutes: 12, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'group_mirror', allocatedMinutes: 15, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'recap', allocatedMinutes: 5, energyWeight: 1, participation: 'observe_ok', tone: 'gentle' },
  ],
  totalMinutes: 60,
  compilerId: 'glow-v1',
  compiledAt: new Date().toISOString(),
};

export const BLAZE_RUN_PLAN: IcebreakerRunPlan = {
  version: 2,
  segments: [
    { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1, participation: 'full', tone: 'gentle' },
    { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2, participation: 'full', tone: 'playful' },
    { phase: 'lie_detective', allocatedMinutes: 10, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'personality_dice', allocatedMinutes: 10, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'auction', allocatedMinutes: 20, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'quip_battle', allocatedMinutes: 17, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'group_mirror', allocatedMinutes: 12, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'recap', allocatedMinutes: 5, energyWeight: 1, participation: 'observe_ok', tone: 'gentle' },
  ],
  totalMinutes: 90,
  compilerId: 'blaze-v1',
  compiledAt: new Date().toISOString(),
};

export const TIER_RUN_PLANS: Record<string, IcebreakerRunPlan> = {
  breeze: BREEZE_RUN_PLAN,
  glow: GLOW_RUN_PLAN,
  blaze: BLAZE_RUN_PLAN,
};

export function getRunPlanForTier(tier: string): IcebreakerRunPlan | undefined {
  return TIER_RUN_PLANS[tier];
}

/**
 * Returns the ordered list of phases for a tier.
 * Useful for building the phase icon strip in the tier selection UI.
 */
export function getPhaseListForTier(tier: string): SocialIcebreakerPhase[] {
  const plan = TIER_RUN_PLANS[tier];
  if (!plan) return [];
  return plan.segments.map((s) => s.phase);
}

/**
 * NOTE: mini_script (迷你剧本杀) is intentionally excluded from default run plans.
 *
 * It is a feature-flagged phase (`SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`) that
 * adds ~20-25 min of narrative-driven roleplay. When enabled, the server can
 * optionally swap it in place of `group_mirror` in the Glow plan, or extend
 * Blaze with it as a premium variant. Default hardcoded plans stay predictable
 * so hosts always know what to expect.
 */
