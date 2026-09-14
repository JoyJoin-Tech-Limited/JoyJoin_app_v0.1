/**
 * Gender-balance helpers (Sprint 2026-07-14 D1–D9 gender-ratio enforcement).
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import type { UserWithProfile } from "../poolMatchingService";

/**
 * Classify a stored gender value for floor/balance math.
 * Only disclosed male/female values count; `null`, `不透露`, and any unknown
 * value count toward NEITHER floor (REL-01).
 */
export function classifyDisclosedGender(gender: string | null | undefined): "male" | "female" | null {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  if (g === "女性" || g === "女" || g === "female" || g === "f") return "female";
  if (g === "男性" || g === "男" || g === "male" || g === "m") return "male";
  return null;
}

/** Count disclosed male/female members of a candidate group (REL-01 safe). */
export function countDisclosedGenders(members: UserWithProfile[]): { male: number; female: number } {
  let male = 0;
  let female = 0;
  for (const m of members) {
    const g = classifyDisclosedGender(m.gender);
    if (g === "male") male++;
    else if (g === "female") female++;
  }
  return { male, female };
}

/**
 * D3/D4: commit-time gender floor check — authoritative in `hard` mode.
 * Undisclosed genders (null / 不透露) count toward neither floor.
 */
export function groupSatisfiesGenderFloor(
  members: UserWithProfile[],
  minFemaleCount: number,
  minMaleCount: number,
): boolean {
  const { male, female } = countDisclosedGenders(members);
  return female >= minFemaleCount && male >= minMaleCount;
}

/**
 * D8: exact gender balance = equal disclosed male/female counts with at least
 * one disclosed male. Single-gender groups (0 males or 0 females) are never
 * "balanced" — which naturally satisfies D5's bonus-skip for restricted pools.
 */
export function groupHasExactGenderBalance(members: UserWithProfile[]): boolean {
  const { male, female } = countDisclosedGenders(members);
  return male > 0 && male === female;
}
