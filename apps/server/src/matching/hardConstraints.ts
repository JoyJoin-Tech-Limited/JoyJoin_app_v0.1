/**
 * L1 hard-constraint filters, Match-Compass dealbreakers, and duo atomicity
 * across the hard-constraint boundary.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { eventPools } from "@shared/schema";
import { calculateAge } from "@shared/utils";
import { logger } from "../lib/logger";
import type { UserWithProfile } from "./poolMatchingTypes";

/**
 * 硬约束检查：验证用户是否符合活动池的所有限制
 * ✅ UPDATED: Added budget as L1 hard constraint
 * ✅ Match Compass: accepts optional strictness parameter for future dealbreaker expansion
 */
function meetsHardConstraints(
  user: UserWithProfile, 
  pool: typeof eventPools.$inferSelect,
  _strictness?: number,
): boolean {
  // 性别限制
  if (pool.genderRestriction && user.gender !== pool.genderRestriction) {
    return false;
  }
  
  // 行业限制
  // ✅ UPDATED: Use industryNiche for matching (Layer 3 of 3-tier classification)
  if (pool.industryRestrictions && pool.industryRestrictions.length > 0) {
    if (!user.industryNiche || !pool.industryRestrictions.includes(user.industryNiche)) {
      return false;
    }
  }
  
  // Seniority restrictions (DEPRECATED - field no longer collected from users)
  // Skip this check since seniority is not collected during onboarding
  // if (pool.seniorityRestrictions && pool.seniorityRestrictions.length > 0) {
  //   if (!user.seniority || !pool.seniorityRestrictions.includes(user.seniority)) {
  //     return false;
  //   }
  // }
  
  // 学历限制
  if (pool.educationLevelRestrictions && pool.educationLevelRestrictions.length > 0) {
    if (!user.educationLevel || !pool.educationLevelRestrictions.includes(user.educationLevel)) {
      return false;
    }
  }
  
  // 年龄限制 (calculated from birthdate)
  const userAge = user.birthdate ? calculateAge(user.birthdate) : null;
  if (pool.ageRangeMin && userAge !== null && userAge < pool.ageRangeMin) {
    return false;
  }
  if (pool.ageRangeMax && userAge !== null && userAge > pool.ageRangeMax) {
    return false;
  }
  
  // ✅ NEW: Budget hard constraint (L1)
  const eventType = pool.eventType || "饭局";
  
  if (eventType === "酒局") {
    // 酒局预算限制
    if (pool.barBudgetRestrictions && pool.barBudgetRestrictions.length > 0) {
      const userBudget = user.barBudgetRange || [];
      const hasOverlap = userBudget.some(b => pool.barBudgetRestrictions!.includes(b));
      if (!hasOverlap) {
        logger.info(`[Matching] User ${user.userId} filtered out: bar budget mismatch`);
        return false;
      }
    }
  } else {
    // 饭局预算限制
    if (pool.budgetRestrictions && pool.budgetRestrictions.length > 0) {
      const userBudget = user.budgetRange || [];
      const hasOverlap = userBudget.some(b => pool.budgetRestrictions!.includes(b));
      if (!hasOverlap) {
        logger.info(`[Matching] User ${user.userId} filtered out: budget mismatch`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * W8 (AC-W8.6): enforce duo atomicity ACROSS the hard-constraint boundary.
 *
 * The duo binding must be resolved from the pre-filter registration set (a
 * partner filtered out by a hard constraint must still strand the other), then
 * applied here. If exactly one member of a duo survives the hard-constraint
 * filter, BOTH are removed from the eligible set — a duo never matches as a
 * half-unit (variant A 整组顺延). Duos with both members eligible are kept and
 * returned as the scoped `duoPairs` for the greedy core.
 *
 * Pure: no DB, no scoring. `strandedUserIds` is returned for observability.
 */
export function resolveDuoEligibilityAfterHardConstraint<T extends { userId: string }>(params: {
  eligibleUsers: T[];
  duoPairs: Array<{ inviterId: string; inviteeId: string }>;
}): {
  eligibleUsers: T[];
  duoPairs: Array<{ inviterId: string; inviteeId: string }>;
  strandedUserIds: string[];
} {
  const { eligibleUsers, duoPairs } = params;
  if (duoPairs.length === 0) {
    return { eligibleUsers, duoPairs: [], strandedUserIds: [] };
  }

  const eligibleIds = new Set(eligibleUsers.map((user) => user.userId));
  const strandedUserIds = new Set<string>();

  // A pair survives only when BOTH partners are eligible. Any eligible partner
  // whose counterpart is missing is stranded (removed) here.
  const survivingPairs: Array<{ inviterId: string; inviteeId: string }> = [];
  for (const pair of duoPairs) {
    const inviterEligible = eligibleIds.has(pair.inviterId);
    const inviteeEligible = eligibleIds.has(pair.inviteeId);
    if (inviterEligible && inviteeEligible) {
      survivingPairs.push(pair);
      continue;
    }
    if (inviterEligible) strandedUserIds.add(pair.inviterId);
    if (inviteeEligible) strandedUserIds.add(pair.inviteeId);
  }

  const finalEligibleUsers =
    strandedUserIds.size === 0
      ? eligibleUsers
      : eligibleUsers.filter((user) => !strandedUserIds.has(user.userId));

  return {
    eligibleUsers: finalEligibleUsers,
    duoPairs: survivingPairs,
    strandedUserIds: [...strandedUserIds],
  };
}

/**
 * Match Compass dealbreaker check: evaluates whether two users are compatible
 * based on explicit user-level dealbreakers when strictness < 50.
 * At strictness >= 50, all pairs pass (dealbreakers are ignored).
 */
export function pairMeetsDealbreakers(
  user1: UserWithProfile,
  user2: UserWithProfile,
  strictness: number,
): boolean {
  if (strictness >= 50) return true;

  // Gender composition dealbreaker
  if (user1.genderCompositionPreference === "female_only" && user2.gender === "男性") {
    return false;
  }
  if (user2.genderCompositionPreference === "female_only" && user1.gender === "男性") {
    return false;
  }

  return true;
}

export { meetsHardConstraints };
