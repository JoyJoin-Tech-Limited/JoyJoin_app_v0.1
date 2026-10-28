// Table Rhythm (M2 · W2 flow calibration, v1) — deterministic run-plan
// duration calibration derived from the matched roster's table-vibe appetite.
//
// Design boundaries (docs/design/icebreaker-w1-w3-implementation-plan-20261027.md §5.2):
// - Pure and synchronous: no LLM, no DB reads, no timers, no randomness.
// - Duration-only. Phase selection and ordering stay owned by
//   `runPlanCompiler.ts`; this module never adds, removes, or reorders a phase.
// - Ambiguous or missing roster data is a no-op (mixed) so the compiled plan
//   stays byte-identical to the pre-M2 output.
// - Aggregate only: nothing per-member leaves `deriveTableRhythmAppetite()`.

import type { IcebreakerRunPlan, PhaseModule, PhaseSegment } from './phaseModule.js';
import type { SocialIcebreakerPhase } from './socialIcebreaker.js';
import { getPhaseModule } from './phaseRegistry.js';

/** Depth appetite of the table, aggregated from roster `table_vibe_preference`. */
export type TableRhythmAppetite = 'light' | 'mixed' | 'deep';

/** Minimal roster shape needed for aggregation (server passes the session roster). */
export interface TableRhythmMember {
  profile?: { tableVibePreference?: string | null } | null;
}

/** Maximum minutes moved in one calibration pass. */
export const TABLE_RHYTHM_SHIFT_MINUTES = 5;
/** Warmup never drops below this for a light table. */
export const WARMUP_RHYTHM_MIN_MINUTES = 10;
/** Warmup never grows above this for a deep table (the canonical 25-min ceiling). */
export const WARMUP_RHYTHM_MAX_MINUTES = 25;
/** micro_challenge may accept at most this many extra minutes in one pass. */
export const MICRO_CHALLENGE_RHYTHM_BONUS_MAX_MINUTES = 5;
/**
 * A `deep` donor must keep at least this many minutes after funding the shift.
 * Mirrors W9's `NON_CORE_FLOOR_MINUTES` (non-core phases never shrink below 4):
 * a 7-minute reflection beat dropping to 2 would be worse than no calibration
 * at all, so such a plan stays unchanged.
 */
export const TABLE_RHYTHM_DONOR_FLOOR_MINUTES = 4;
/** A signal needs at least this many matching members — one person never steers the table. */
const MIN_MEMBERS_FOR_SIGNAL = 2;

/**
 * Donor preference for `deep` tables. Taking the 5 minutes off a conversation /
 * reflection beat is safer than shortening a game the table is mid-way through.
 */
const DEEP_DONOR_PREFERENCE: SocialIcebreakerPhase[] = [
  'group_mirror',
  'quip_battle',
  'speed_friending',
  'auction',
];

/**
 * Phases that must never fund a rhythm shift:
 * - warmup / micro_challenge / recap are core or closing (compiler-owned timing)
 * - lie_detective carries the roster-derived floor (AC-W9.2) and would simply be
 *   re-grown by `normalizeRunPlanTiming()`
 * - mini_script is a feature-flagged bonus funded by `reconcileMiniScriptBudget()`
 */
const RHYTHM_DONOR_EXCLUDED: ReadonlySet<SocialIcebreakerPhase> = new Set([
  'warmup',
  'micro_challenge',
  'recap',
  'lie_detective',
  'mini_script',
]);

/**
 * Normalize one raw preference value into a depth appetite.
 * Returns `null` for missing/unknown data (treated as neutral by aggregation).
 *
 * Supported values:
 * - light: `轻松聊天`, `游戏互动`, legacy `light_fun` / `natural_chat`
 *   (Match Compass maps `natural_chat` to 轻松聊天)
 * - deep:  `深度交流`, legacy `deep_talk`
 * - mixed: `不限`
 */
export function classifyTableVibePreference(
  value: string | null | undefined,
): TableRhythmAppetite | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  switch (key) {
    case '轻松聊天':
    case '游戏互动':
    case 'natural_chat':
    case 'light_fun':
      return 'light';
    case '深度交流':
    case 'deep_talk':
      return 'deep';
    case '不限':
      return 'mixed';
    default:
      return null;
  }
}

/**
 * Aggregate the roster into a single depth appetite.
 *
 * Rule (deterministic, aggregate-only):
 * - A signal needs ≥ 2 members *and* a strict majority of the whole roster
 *   (`deepCount * 2 > roster.length`), so a tie or a half-filled profile always
 *   resolves to `mixed` and never nudges the plan.
 * - Members with missing/unknown preferences count toward the denominator as
 *   neutral: sparse profile coverage can only make the table *more* mixed.
 *
 * Returns `'mixed'` for an empty roster, missing profiles, or unknown values.
 */
export function deriveTableRhythmAppetite(
  roster?: ReadonlyArray<TableRhythmMember> | null,
): TableRhythmAppetite {
  if (!roster || roster.length === 0) return 'mixed';
  const members = roster.length;
  let deepCount = 0;
  let lightCount = 0;
  for (const member of roster) {
    const appetite = classifyTableVibePreference(member?.profile?.tableVibePreference);
    if (appetite === 'deep') deepCount += 1;
    else if (appetite === 'light') lightCount += 1;
  }
  if (deepCount >= MIN_MEMBERS_FOR_SIGNAL && deepCount * 2 > members) return 'deep';
  if (lightCount >= MIN_MEMBERS_FOR_SIGNAL && lightCount * 2 > members) return 'light';
  return 'mixed';
}

function rebuildPlan(plan: IcebreakerRunPlan, segments: PhaseSegment[]): IcebreakerRunPlan {
  return {
    ...plan,
    segments,
    totalMinutes: segments.reduce((sum, segment) => sum + segment.allocatedMinutes, 0),
  };
}

function isFiniteMinutes(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Pick the segment that funds a `deep` calibration.
 *
 * Preferred phases first (in `DEEP_DONOR_PREFERENCE` order), then the largest
 * eligible non-core allocation (ties keep the earlier segment, so the result is
 * deterministic). A donor is only eligible when it can give the full shift and
 * still keep `TABLE_RHYTHM_DONOR_FLOOR_MINUTES`.
 */
function findDeepDonorIndex(segments: PhaseSegment[], shift: number): number {
  const eligible = (segment: PhaseSegment, index: number): boolean =>
    index >= 0 &&
    !RHYTHM_DONOR_EXCLUDED.has(segment.phase) &&
    isFiniteMinutes(segment.allocatedMinutes) &&
    segment.allocatedMinutes - shift >= TABLE_RHYTHM_DONOR_FLOOR_MINUTES;

  for (const phase of DEEP_DONOR_PREFERENCE) {
    const index = segments.findIndex(
      (segment, i) => segment.phase === phase && eligible(segment, i),
    );
    if (index >= 0) return index;
  }

  let best = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (!eligible(segments[i], i)) continue;
    if (best < 0 || segments[i].allocatedMinutes > segments[best].allocatedMinutes) best = i;
  }
  return best;
}

/**
 * Pick the segment that receives a `light` calibration.
 *
 * micro_challenge is preferred (its gain is capped at
 * `MICRO_CHALLENGE_RHYTHM_BONUS_MAX_MINUTES`); when it is absent, the first
 * full-participation phase after warmup takes the minutes. `recap` and
 * `mini_script` are never recipients.
 */
function findLightRecipientIndex(
  segments: PhaseSegment[],
  warmupIndex: number,
  shift: number,
): number {
  const microIndex = segments.findIndex((segment) => segment.phase === 'micro_challenge');
  if (microIndex >= 0 && shift <= MICRO_CHALLENGE_RHYTHM_BONUS_MAX_MINUTES) {
    return microIndex;
  }

  for (let i = warmupIndex + 1; i < segments.length; i += 1) {
    const segment = segments[i];
    if (
      segment.phase === 'recap' ||
      segment.phase === 'micro_challenge' ||
      segment.phase === 'mini_script'
    ) {
      continue;
    }
    const module: PhaseModule | undefined = getPhaseModule(segment.phase);
    if (!module) continue;
    const participation = segment.participation ?? module.participation;
    if (participation === 'full') return i;
  }
  return -1;
}

/**
 * Apply the table's depth appetite to a compiled plan.
 *
 * - `deep`: warmup +min(5, room to the 25-min ceiling), funded by one eligible
 *   non-core phase (group_mirror → quip_battle → speed_friending → auction →
 *   largest non-core) that keeps at least 4 minutes afterwards.
 * - `light`: warmup −min(5, room above the 10-min floor), handed to
 *   micro_challenge (gain capped at +5) or the next full-participation phase.
 * - `mixed` / unknown appetite: the plan is returned unchanged (same reference).
 *
 * In every case `totalMinutes` is preserved exactly, the phase set and order are
 * untouched, and core/closing phases are never removed. When no eligible
 * donor/recipient exists the plan is returned unchanged (same reference).
 */
export function applyTableRhythm(
  plan: IcebreakerRunPlan,
  appetite: TableRhythmAppetite | null | undefined,
): IcebreakerRunPlan {
  if (!plan || !Array.isArray(plan.segments) || plan.segments.length === 0) return plan;
  if (appetite !== 'deep' && appetite !== 'light') return plan;

  const warmupIndex = plan.segments.findIndex((segment) => segment.phase === 'warmup');
  if (warmupIndex < 0) return plan;
  const warmup = plan.segments[warmupIndex];
  if (!isFiniteMinutes(warmup.allocatedMinutes)) return plan;

  if (appetite === 'deep') {
    const shift = Math.min(
      TABLE_RHYTHM_SHIFT_MINUTES,
      WARMUP_RHYTHM_MAX_MINUTES - warmup.allocatedMinutes,
    );
    if (shift <= 0) return plan;
    const donorIndex = findDeepDonorIndex(plan.segments, shift);
    if (donorIndex < 0) return plan;

    const segments = plan.segments.map((segment, index) => {
      if (index === warmupIndex) {
        return { ...segment, allocatedMinutes: segment.allocatedMinutes + shift };
      }
      if (index === donorIndex) {
        return { ...segment, allocatedMinutes: segment.allocatedMinutes - shift };
      }
      return segment;
    });
    return rebuildPlan(plan, segments);
  }

  const shift = Math.min(
    TABLE_RHYTHM_SHIFT_MINUTES,
    warmup.allocatedMinutes - WARMUP_RHYTHM_MIN_MINUTES,
  );
  if (shift <= 0) return plan;
  const recipientIndex = findLightRecipientIndex(plan.segments, warmupIndex, shift);
  if (recipientIndex < 0) return plan;

  const segments = plan.segments.map((segment, index) => {
    if (index === warmupIndex) {
      return { ...segment, allocatedMinutes: segment.allocatedMinutes - shift };
    }
    if (index === recipientIndex) {
      return { ...segment, allocatedMinutes: segment.allocatedMinutes + shift };
    }
    return segment;
  });
  return rebuildPlan(plan, segments);
}
