/**
 * Energy-composition helpers and thresholds (W6 AC-W6.2) + the magnetism
 * energizer bar constants.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { ARCHETYPE_ENERGY } from "../archetypeChemistry";
import type { UserWithProfile } from "../poolMatchingService";

/**
 * Calculate group energy balance score (0-100)
 *
 * W6 (gm-debrief) AC-W6.2: replaced the mean-band heuristic (which scored an
 * all-mid 68–75 table ~99 and an all-introvert table ≥94) with a COMPOSITION
 * gate — a table is judged on whether it has energizers and on how many very-low
 * members it drags, not on its average. Golden:
 *   [95,90,52,38] (two energizers) ranks ABOVE [75,72,70,68] (no true energizer).
 *
 * `composeEnergyBalance` is the pure, testable metric; `calculateEnergyBalance`
 * maps members' archetype energies into it.
 * Source for energy values: ARCHETYPE_ENERGY in apps/server/src/archetypeChemistry.ts
 * DB column: energy_balance (integer) in event_pool_groups table
 */
export function calculateEnergyBalance(members: UserWithProfile[]): number {
  if (members.length < 2) return 50;
  return composeEnergyBalance(members.map(userArchetypeEnergy));
}

/** R1 无孤立者: every member needs ≥1 intra-group pair score at/above this. */
export const MAGNETISM_STRONG_TIE_THRESHOLD = 60;
/** R2 能量编排: a committed group needs ≥1 member at/above this archetype energy. */
export const MAGNETISM_ENERGIZER_THRESHOLD = 75;
/** R4 新奇分散: ranking penalty for an explore-intent candidate joining a group that already has an explorer. */
export const MAGNETISM_EXPLORE_RANKING_PENALTY = 8;

// ── W6 (gm-debrief): energy COMPOSITION metric ──────────────────────────────
// Replaces the mean-band heuristic. A table is lively when it has energizers and
// tolerant of at most one very-low member; absence of energizers / excess silent
// drag is penalised. Single-sourced with the R2 energizer bar.
/** Energies at/above this count as table energizers (same bar as R2). */
export const ENERGY_ENERGIZER_THRESHOLD = MAGNETISM_ENERGIZER_THRESHOLD;
/** Archetype energies at/below this are "very low" (silent drag). */
export const ENERGY_VERY_LOW_THRESHOLD = 45;
/** How many very-low members a table tolerates before it is penalised. */
export const ENERGY_VERY_LOW_CAP = 1;
/** A table with no energizer is bland — heavy penalty. */
export const ENERGY_NO_ENERGIZER_PENALTY = 45;
/** A table with exactly one energizer is only half-alive — small penalty. */
export const ENERGY_SINGLE_ENERGIZER_PENALTY = 12;
/** Reward per energizer beyond two (liveliness headroom), capped. */
export const ENERGY_EXTRA_ENERGIZER_BONUS = 5;
export const ENERGY_EXTRA_ENERGIZER_BONUS_CAP = 2;
/** Penalty per very-low member beyond the cap. */
export const ENERGY_VERY_LOW_PENALTY = 15;

/**
 * W6 AC-W6.2 pure composition metric. Golden: `[95,90,52,38]` > `[75,72,70,68]`.
 * Deterministic O(n), no queries. Groups < 2 members return the neutral 50.
 */
export function composeEnergyBalance(energyLevels: number[]): number {
  if (energyLevels.length < 2) return 50;

  const energizerCount = energyLevels.filter((e) => e >= ENERGY_ENERGIZER_THRESHOLD).length;
  const veryLowCount = energyLevels.filter((e) => e <= ENERGY_VERY_LOW_THRESHOLD).length;

  let score = 100;
  if (energizerCount === 0) {
    score -= ENERGY_NO_ENERGIZER_PENALTY;
  } else if (energizerCount === 1) {
    score -= ENERGY_SINGLE_ENERGIZER_PENALTY;
  }
  score +=
    Math.min(Math.max(0, energizerCount - 2), ENERGY_EXTRA_ENERGIZER_BONUS_CAP) *
    ENERGY_EXTRA_ENERGIZER_BONUS;
  score -= Math.max(0, veryLowCount - ENERGY_VERY_LOW_CAP) * ENERGY_VERY_LOW_PENALTY;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Archetype energy lookup shared by R2 and calculateEnergyBalance.
 * Missing/unknown archetype defaults to 60 (mid) — same as calculateEnergyBalance.
 */
export function userArchetypeEnergy(user: UserWithProfile): number {
  return ARCHETYPE_ENERGY[user.archetype as keyof typeof ARCHETYPE_ENERGY] ?? 60;
}
