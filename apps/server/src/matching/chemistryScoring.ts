/**
 * Chemistry pair-scoring helpers (archetype compatibility matrix).
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`
 * so all importers are unchanged.
 */
import type { ArchetypeName } from "../archetypeConfig";
import {
  getCalibratedChemistryScore,
  type ChemistryCalibrationMap,
} from "../archetypeChemistryCalibration";
import type { UserWithProfile } from "../poolMatchingService";

/**
 * W6 (gm-debrief) AC-W6.5: neutral chemistry score used when a member has no
 * resolvable archetype. Replaces the previous silent `|| "koala"` substitution.
 */
export const CHEMISTRY_UNKNOWN_ARCHETYPE_SCORE = 50;

/**
 * Explicit unknown-archetype resolution. Returns the value when it is a
 * non-empty string, else null; callers substitute
 * `CHEMISTRY_UNKNOWN_ARCHETYPE_SCORE` for any term with a null archetype
 * instead of pretending the member is a koala. An unrecognized non-empty value
 * still flows to the chemistry matrix, whose own fallback is also 50
 * (`getChemistryScore`), so unknown handling is consistently neutral.
 */
export function resolveChemistryArchetype(
  value: string | null | undefined,
): ArchetypeName | null {
  return value && value.length > 0 ? (value as ArchetypeName) : null;
}

/**
 * 计算两个用户之间的性格化学反应分数 (0-100)
 * 考虑主角色（70%）和次要角色的交叉兼容性（各15%，共30%）
 * (vibeVector blend removed 2026-08: dead branch — no production writer of users.vibeVector)
 */
export function calculateChemistryScore(
  user1: UserWithProfile,
  user2: UserWithProfile,
  chemistryCalibrationMap?: ChemistryCalibrationMap,
  /**
   * Plan Item 10: thread the resolved `derivedChemistryEnabled` flag through
   * (never read per-pair). Default false preserves the authored path exactly.
   */
  derivedChemistryEnabled = false,
): number {
  const primary1 = resolveChemistryArchetype(user1.archetype);
  const primary2 = resolveChemistryArchetype(user2.archetype);
  const secondary1 = resolveChemistryArchetype(user1.secondaryArchetype);
  const secondary2 = resolveChemistryArchetype(user2.secondaryArchetype);

  // 主角色化学反应（70%权重）. An unknown primary contributes the neutral score
  // explicitly (W6 AC-W6.5) rather than a fabricated koala compatibility.
  const primaryChemistryRaw =
    primary1 && primary2
      ? getCalibratedChemistryScore(primary1, primary2, chemistryCalibrationMap, derivedChemistryEnabled)
      : CHEMISTRY_UNKNOWN_ARCHETYPE_SCORE;
  const primaryChemistry = primaryChemistryRaw * 0.70;

  // 次要角色交叉加成（各15%权重，共30%）
  const crossChemistry1Raw =
    primary1 && secondary2
      ? getCalibratedChemistryScore(primary1, secondary2, chemistryCalibrationMap, derivedChemistryEnabled)
      : CHEMISTRY_UNKNOWN_ARCHETYPE_SCORE;
  const crossChemistry2Raw =
    secondary1 && primary2
      ? getCalibratedChemistryScore(secondary1, primary2, chemistryCalibrationMap, derivedChemistryEnabled)
      : CHEMISTRY_UNKNOWN_ARCHETYPE_SCORE;
  const crossChemistry1 = crossChemistry1Raw * 0.15;
  const crossChemistry2 = crossChemistry2Raw * 0.15;

  const score = primaryChemistry + crossChemistry1 + crossChemistry2;

  return Math.round(score);
}
