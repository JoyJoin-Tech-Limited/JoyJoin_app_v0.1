import { z } from 'zod';

export const ICEBREAKER_RUN_PLAN_VERSION = 1 as const;

export const socialIcebreakerPhaseSchema = z.enum([
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'mini_script',
  'recap',
]);

export const participationModeSchema = z.enum([
  'full',
  'text_only',
  'observe_ok',
  'pass_ok',
]);

export const runPlanSegmentSchema = z.object({
  phase: socialIcebreakerPhaseSchema,
  /** Relative weight for UX “energy” meter; compiler uses 1–3 only in v1 */
  energyWeight: z.number().int().min(1).max(3).default(2),
  participation: participationModeSchema.default('pass_ok'),
  /** Soft hint for copy tone; server AI services may read in later tasks */
  tone: z.enum(['gentle', 'playful', 'neutral']).default('gentle'),
});

export const icebreakerRunPlanSchema = z.object({
  version: z.literal(ICEBREAKER_RUN_PLAN_VERSION),
  /** Ordered phases to attempt; server still enforces min player rules per phase */
  segments: z.array(runPlanSegmentSchema).min(1),
  /** Human + machine audit trail */
  rationale: z.string().max(4000).optional(),
  /** Bounded safe context snapshot — no secrets, no phone numbers */
  context: z
    .object({
      poolId: z.string().optional(),
      groupId: z.string().optional(),
      memberCount: z.number().int().min(1),
      eventType: z.string().optional(),
      temperatureLevel: z.string().optional(),
      /** Compiler input from event_pool_groups at match time */
      groupTheme: z.string().optional(),
      groupSubtitle: z.string().optional(),
      themeEmoji: z.string().optional(),
    })
    .strict(),
});

// Note: Canonical types (IcebreakerRunPlan, ParticipationMode) now live in phaseModule.ts.
// This file retains the v1 Zod schemas for backward-compatible parsing of legacy stored data.
import type { IcebreakerRunPlan } from './phaseModule';

export function parseIcebreakerRunPlan(input: unknown): IcebreakerRunPlan {
  // v1 schema parse; cast to v2 type (v1 is a subset of v2 fields)
  const parsed = icebreakerRunPlanSchema.parse(input);
  return parsed as unknown as IcebreakerRunPlan;
}
