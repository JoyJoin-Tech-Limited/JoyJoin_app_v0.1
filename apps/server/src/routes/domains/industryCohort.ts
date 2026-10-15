import type { Express, Request, Response } from "express";
import { getFeatureFlag } from "../../lib/featureFlags";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middleware/auth";
import {
  countIndustryCohortUsers,
  getIndustryCohortIdentity,
} from "../../repositories/industryCohortRepo";

/**
 * Privacy min-count policy: cohorts smaller than this are never surfaced.
 * The response collapses to `{ count: null }` so a raw small number can never
 * be read off the wire or enumerated by probing.
 */
export const INDUSTRY_COHORT_MIN_COUNT = 10;

/** Response contract for `GET /api/inference/industry-cohort-count`. */
export interface IndustryCohortCountResponse {
  count: number | null;
}

/**
 * Read-only industry peer count for the authenticated session user.
 *
 * Contract:
 * - Session-scoped: identity is derived from the session user only. There is no
 *   query/body input, so the endpoint cannot be used to enumerate arbitrary
 *   users or other cities/categories.
 * - `count` is `null` when: the session user's `currentCity` or
 *   `industryCategory` is missing (absent row / null / blank after trim), the
 *   true count is below the min-count, or the kill switch is off.
 * - Never fabricates: a non-null count is the exact cohort count.
 */
export function registerIndustryCohortRoutes(app: Express): void {
  app.get(
    "/api/inference/industry-cohort-count",
    requireAuth,
    async (req: Request, res: Response) => {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        // Defense in depth: requireAuth already rejects unauthenticated calls.
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        // Kill switch is resolved FIRST: when off, neither the identity lookup
        // nor the cohort query runs — fail-closed with the same response shape.
        const enabled = await getFeatureFlag("industryCohortCountEnabled", true);
        if (!enabled) {
          logger.info("[industry-cohort-count] Feature disabled — serving null count", {
            userId,
          });
          return res.json({ count: null } satisfies IndustryCohortCountResponse);
        }

        const identity = await getIndustryCohortIdentity(userId);
        // Stale/deleted session row → fail closed. Values are trimmed so an
        // empty/whitespace-only field can never become a count predicate.
        // Column values are written normalized (closed option set / classifier
        // ids), so a trim is purely defensive and exact equality still holds.
        const city = identity?.currentCity?.trim() ?? "";
        const category = identity?.industryCategory?.trim() ?? "";
        if (!city || !category) {
          logger.info("[industry-cohort-count] Incomplete cohort identity — serving null count", {
            userId,
            hasCity: Boolean(city),
            hasCategory: Boolean(category),
          });
          return res.json({ count: null } satisfies IndustryCohortCountResponse);
        }

        const rawCount = await countIndustryCohortUsers(city, category);
        const count = rawCount >= INDUSTRY_COHORT_MIN_COUNT ? rawCount : null;
        logger.info("[industry-cohort-count] Served", {
          userId,
          suppressed: count === null,
          // Server-side telemetry only — raw sub-threshold counts never leave
          // the server (privacy min-count policy).
          rawCount,
        });
        return res.json({ count } satisfies IndustryCohortCountResponse);
      } catch (error) {
        logger.error("[industry-cohort-count] Failed to resolve cohort count", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ message: "Failed to fetch industry cohort count" });
      }
    },
  );
}
