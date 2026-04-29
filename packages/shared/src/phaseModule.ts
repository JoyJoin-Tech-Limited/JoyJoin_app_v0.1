// Phase Module System — Self-contained phase definitions for dynamic flow compilation

import type { SocialIcebreakerPhase } from './socialIcebreaker';

export type PhaseCategory =
  | 'conversation'
  | 'game'
  | 'creative'
  | 'deduction'
  | 'narrative'
  | 'competition'
  | 'voting';

export type EnergyArc = 'rising' | 'peak' | 'falling' | 'variable' | 'warmup';

export type ParticipationMode =
  | 'full'
  | 'text_only'
  | 'observe_ok'
  | 'pass_ok';

/**
 * Self-contained metadata for a Social Icebreaker phase.
 *
 * This is pure data — serializable, cross-platform, and safe to send to clients.
 * Business logic (advance guards, cleanup, recap builders) lives server-side
 * in `phaseRegistry.ts` keyed by `id`.
 */
export interface PhaseModule {
  id: SocialIcebreakerPhase;
  /** Display name (Chinese) */
  name: string;
  /** Display name (English) */
  nameEn: string;
  /** Emoji for visual identification */
  emoji: string;
  /** Nominal duration in minutes */
  durationMinutes: number;
  /** Minimum players required; phase is auto-skipped if roster is smaller */
  minPlayers: number;
  /** Optional maximum player cap */
  maxPlayers?: number;
  /** Broad category for Game Design Agent selection */
  category: PhaseCategory;
  /** Where this phase sits in the energy arc */
  energyArc: EnergyArc;
  /** Does this phase need AI-generated content before it can start? */
  requiresGeneration: boolean;
  /** How many minutes before event start should generation begin? */
  generationLeadTimeMinutes: number;
  /** Can the host skip this phase manually? */
  canBeSkipped: boolean;
  /** Default participation mode */
  participation: ParticipationMode;
  /** Soft hint for copy tone */
  tone: 'gentle' | 'playful' | 'neutral' | 'dramatic' | 'competitive';

  // ─── UI tokens (copied from PHASE_CONFIG for client use) ───
  gradient: string;
  bgGradient: string;
  darkBgGradient: string;
  pillColor: string;
}

/**
 * A segment in a compiled IcebreakerRunPlan.
 *
 * The Game Design Agent produces these after analyzing the matched group.
 */
export interface PhaseSegment {
  phase: SocialIcebreakerPhase;
  /** Actual allocated duration for this group (may differ from module default) */
  allocatedMinutes: number;
  /** Energy weight for UX meter (1=low, 2=medium, 3=high) */
  energyWeight: number;
  /** Participation mode override (optional) */
  participation?: ParticipationMode;
  /** Tone override (optional) */
  tone?: PhaseModule['tone'];
  /** Human-readable rationale for why this phase was chosen */
  rationale?: string;
}

/**
 * Full compiled plan for a single session.
 */
export interface IcebreakerRunPlan {
  version: number;
  segments: PhaseSegment[];
  /** Total allocated minutes; must equal sum of segment allocatedMinutes */
  totalMinutes: number;
  /** Compiler metadata */
  compiledAt: string;
  compilerId: string;
}

export const RUN_PLAN_VERSION = 2 as const;

export function createRunPlan(
  segments: PhaseSegment[],
  compilerId: string = 'manual'
): IcebreakerRunPlan {
  const totalMinutes = segments.reduce((sum, s) => sum + s.allocatedMinutes, 0);
  return {
    version: RUN_PLAN_VERSION,
    segments,
    totalMinutes,
    compiledAt: new Date().toISOString(),
    compilerId,
  };
}

export function getNextPhaseFromPlan(
  current: SocialIcebreakerPhase,
  plan: IcebreakerRunPlan
): SocialIcebreakerPhase | null {
  const idx = plan.segments.findIndex((s) => s.phase === current);
  if (idx === -1 || idx >= plan.segments.length - 1) return null;
  return plan.segments[idx + 1].phase;
}

export function getPlanSegment(
  phase: SocialIcebreakerPhase,
  plan: IcebreakerRunPlan
): PhaseSegment | undefined {
  return plan.segments.find((s) => s.phase === phase);
}
