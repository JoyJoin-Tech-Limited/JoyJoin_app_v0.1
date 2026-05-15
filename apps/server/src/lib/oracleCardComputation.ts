/**
 * Oracle Card Computation — Pure functions for Discover PoolCard personalization
 *
 * All fields computed in-memory from existing query data.
 * Zero additional DB queries.
 */

import { compatibilityMatrix } from "@shared/personality/archetypeCompatibility";
import type { PoolNarrativePivot, PoolUserTypeRarity } from "@shared/api";

export interface OracleCardInput {
  pool: {
    id: string;
    registrationDeadline?: Date | null;
    price?: number | null;
  };
  allArchetypes: Array<{ archetype: string; count: number }>;
  userArchetype: string | null;
  registrationCount: number;
  now: Date;
}

export interface OracleCardFields {
  price: number | null;
  userTypeCount: number;
  userTypeRarity: PoolUserTypeRarity;
  highChemistryCount: number;
  topComplementaryType: string | null;
  narrativePivot: PoolNarrativePivot;
  hoursUntilDeadline: number;
}

/**
 * Compute all Oracle Card fields for a single pool.
 * Pure function — no side effects, no DB access.
 */
export function computeOracleCardFields(opts: OracleCardInput): OracleCardFields {
  const { pool, allArchetypes, userArchetype, registrationCount, now } = opts;

  // 1. Price resolution (yuan, not cents)
  const price = resolvePrice(pool);

  // 2. User type presence & rarity
  const userTypeCount = userArchetype
    ? (allArchetypes.find((r) => r.archetype === userArchetype)?.count ?? 0)
    : 0;

  const userTypeRarity = computeUserTypeRarity(userTypeCount, registrationCount, userArchetype);

  // 3. High chemistry count (compatibility >= 70, excluding self)
  const highChemistryCount = computeHighChemistryCount(
    allArchetypes,
    userArchetype,
    registrationCount
  );

  // 4. Top complementary type (highest compat >= 85 present in pool)
  const topComplementaryType = computeTopComplementaryType(allArchetypes, userArchetype);

  // 5. Narrative pivot (4-branch Phase 2)
  const narrativePivot: PoolNarrativePivot =
    registrationCount < 3 ? "empty" :
    userTypeRarity === "rare" ? "rare" :
    userTypeRarity === "dominant" ? "dominant" :
    "present";

  // 6. Hours until deadline
  const hoursUntilDeadline = computeHoursUntilDeadline(pool.registrationDeadline, now);

  return {
    price,
    userTypeCount,
    userTypeRarity,
    highChemistryCount,
    topComplementaryType,
    narrativePivot,
    hoursUntilDeadline,
  };
}

/**
 * Resolve display price in yuan.
 * Returns pool.price if present and positive, otherwise null.
 */
function resolvePrice(pool: OracleCardInput["pool"]): number | null {
  if (typeof pool.price === "number" && pool.price > 0) {
    return pool.price;
  }
  return null;
}

/**
 * Compute rarity tier based on user's archetype presence in pool.
 *
 * Rules:
 * - 'rare': count 0–2 AND total registration count >= 8
 * - 'dominant': count >= 40% of total pool
 * - 'present': everything else
 *
 * Special case: if user has no archetype, returns 'present' (generic fallback)
 */
function computeUserTypeRarity(
  userTypeCount: number,
  registrationCount: number,
  userArchetype: string | null
): PoolUserTypeRarity {
  if (!userArchetype) {
    return "present";
  }

  // Empty or near-empty pool — no meaningful rarity
  if (registrationCount === 0) {
    return "present";
  }

  if (userTypeCount <= 2 && registrationCount >= 8) {
    return "rare";
  }

  const ratio = userTypeCount / registrationCount;
  if (ratio >= 0.4) {
    return "dominant";
  }

  return "present";
}

/**
 * Count registrants with compatibility score >= 70 against user's archetype.
 * Excludes the user's own archetype from the sum.
 *
 * Returns 0 if user has no archetype or pool is empty.
 */
function computeHighChemistryCount(
  allArchetypes: Array<{ archetype: string; count: number }>,
  userArchetype: string | null,
  registrationCount: number
): number {
  if (!userArchetype || registrationCount === 0) {
    return 0;
  }

  let sum = 0;
  for (const row of allArchetypes) {
    if (row.archetype === userArchetype) {
      continue; // exclude self-compatibility
    }

    const score = compatibilityMatrix[userArchetype]?.[row.archetype] ?? 50;
    if (score >= 70) {
      sum += row.count;
    }
  }

  return sum;
}

/**
 * Find the highest-compatible archetype (score >= 85) that is actually present in the pool.
 * Returns null if none meet the threshold.
 *
 * Scans compatibility matrix for user's archetype and picks the highest-scoring
 * archetype that exists in `allArchetypes`.
 */
function computeTopComplementaryType(
  allArchetypes: Array<{ archetype: string; count: number }>,
  userArchetype: string | null
): string | null {
  if (!userArchetype) {
    return null;
  }

  const presentTypes = new Set(allArchetypes.map((r) => r.archetype));
  const compatRow = compatibilityMatrix[userArchetype];
  if (!compatRow) {
    return null;
  }

  let bestType: string | null = null;
  let bestScore = -1;

  for (const [otherArchetype, score] of Object.entries(compatRow)) {
    if (otherArchetype === userArchetype) {
      continue; // exclude self
    }
    if (!presentTypes.has(otherArchetype)) {
      continue; // not in this pool
    }
    if (score >= 85 && score > bestScore) {
      bestType = otherArchetype;
      bestScore = score;
    }
  }

  return bestType;
}

/**
 * Compute hours until registration deadline.
 * Returns 0 if deadline has passed or is not set.
 */
function computeHoursUntilDeadline(
  deadline: Date | null | undefined,
  now: Date
): number {
  if (!deadline) {
    return 0;
  }
  const diffMs = deadline.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 3_600_000));
}
