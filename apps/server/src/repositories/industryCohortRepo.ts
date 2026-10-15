import { and, eq, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";

/**
 * Industry cohort repository — read-only data access for
 * `GET /api/inference/industry-cohort-count`.
 *
 * The endpoint answers one narrow question for the session user: "how many
 * people in my city share my industry category?" — nothing else. Both helpers
 * below exist so the route can be tested without a live database (the server
 * test suite mocks this module; CI has no Postgres).
 */

export interface IndustryCohortIdentity {
  currentCity: string | null;
  industryCategory: string | null;
}

/**
 * Loads ONLY the two fields that define the session user's cohort.
 *
 * - Returns `null` when the user row no longer exists (stale/deleted session) —
 *   callers must fail closed to `{ count: null }` instead of querying with an
 *   empty identity.
 * - The column projection is intentionally narrowed to these two fields so the
 *   endpoint can never surface other profile data.
 */
export async function getIndustryCohortIdentity(
  userId: string,
): Promise<IndustryCohortIdentity | null> {
  const [row] = await db
    .select({
      currentCity: users.currentCity,
      industryCategory: users.industryCategory,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Counts users in the session user's industry cohort.
 *
 * Predicate (must stay exact-equality; no fuzzy/adjacency matching):
 *   users.current_city     = :city       — CURRENT_CITY_OPTIONS values (e.g. 深圳/香港/其他)
 *   users.industry_category = :category  — Layer-1 category ids (e.g. "tech")
 *   AND coalesce(users.is_banned, false)  = false — banned accounts are not community members
 *   AND coalesce(users.is_test_bot, false) = false — single/matching-test bots are synthetic
 *       (bots are seeded with real cities + industry categories, so counting them
 *       would fabricate a cohort; same convention as user-visible aggregates in
 *       personalStoryRepo)
 *
 * `currentCity` / `industryCategory` are written normalized (closed option set /
 * classifier ids) and the columns are nullable, so equality + coalesce is the
 * correct predicate. The caller is responsible for the <10 privacy min-count
 * and for passing already-trimmed, non-empty values.
 */
export async function countIndustryCohortUsers(
  city: string,
  category: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.currentCity, city),
        eq(users.industryCategory, category),
        sql`coalesce(${users.isBanned}, false) = false`,
        sql`coalesce(${users.isTestBot}, false) = false`,
      ),
    );

  return row?.count ?? 0;
}
