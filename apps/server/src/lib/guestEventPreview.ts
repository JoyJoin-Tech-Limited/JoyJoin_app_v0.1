import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { eventPools, eventPoolRegistrations } from "@shared/schema";
import type { GuestEventPreviewItem } from "@shared/api";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";

/**
 * P1c 游客预告卡 (T46 contract AC-08) — guest-safe event preview.
 *
 * Served by GET /api/event-pools/guest-preview (no auth). The route stays a
 * thin shell; every gate lives here so the endpoint can never surface an
 * error page to a guest:
 *
 *   Gate 1 (flag):      guestEventPreviewEnabled OFF → 200 + []
 *   Gate 2 (supply):    qualified supply < GUEST_PREVIEW_MIN_SUPPLY → 200 + []
 *   Gate 3 (eligibility): full pools (spotsLeft = 0, CONCERN C2) are cut
 *                         before the teaser is built; if the remaining
 *                         supply drops below GUEST_PREVIEW_MIN_SUPPLY the
 *                         response degrades to 200 + [] (same fail-closed
 *                         semantics as Gate 2, same layer).
 *   Any exception:      logged, still 200 + []
 *
 * The response carries at most GUEST_PREVIEW_MAX_ITEMS items with a minimal,
 * zero-PII projection locked by guestEventPreviewItemSchema in
 * packages/shared/src/api/eventPools.ts.
 */

export const GUEST_PREVIEW_DEFAULT_CITY = "深圳";
export const GUEST_PREVIEW_MIN_SUPPLY = 3;
export const GUEST_PREVIEW_MAX_ITEMS = 3;
/** Coarse SQL pre-filter fetch bound; the predicate re-checks every row, so
 *  this only needs to be a small multiple of the max item count. */
const GUEST_PREVIEW_CANDIDATE_FETCH_LIMIT = 12;

export interface GuestPreviewPoolCandidate {
  id: string;
  title: string;
  dateTime: Date;
  district: string | null;
  eventType: string;
  status: string | null;
  isTestPool: boolean | null;
  registrationDeadline: Date | null;
  city: string | null;
  minGroupSize: number | null;
  maxGroupSize: number | null;
  targetGroups: number | null;
}

/**
 * Single authority for pool qualification. Mirrors the Discover feed rules:
 * active only, deadline in the future, test pools excluded (is_test_pool
 * nullable — null/false stay visible), city match. Extracted as a pure
 * predicate so route tests can prove exclusion semantics without a DB.
 */
export function isQualifiedGuestPreviewPool(
  pool: Pick<
    GuestPreviewPoolCandidate,
    "status" | "isTestPool" | "registrationDeadline" | "city"
  >,
  opts: { now: Date; city: string },
): boolean {
  if (pool.status !== "active") return false;
  if (pool.isTestPool === true) return false;
  if (!pool.registrationDeadline) return false;
  if (pool.registrationDeadline.getTime() <= opts.now.getTime()) return false;
  if (pool.city !== opts.city) return false;
  return true;
}

/**
 * Mirrors resolvePoolCapacity() in routes/domains/userEventPools.ts — the
 * detail-page seats口径 (capacity = maxGroupSize * targetGroups) must stay
 * identical so 剩余座位 never contradicts the pool detail page.
 */
export function resolvePreviewPoolCapacity(pool: {
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  targetGroups?: number | null;
}): number {
  const minGroupSize = Math.max(pool.minGroupSize ?? 4, 1);
  const maxGroupSize = Math.max(pool.maxGroupSize ?? minGroupSize, minGroupSize);
  const targetGroups = Math.max(pool.targetGroups ?? 1, 1);
  return maxGroupSize * targetGroups;
}

export async function buildGuestEventPreview(
  cityInput?: string,
): Promise<GuestEventPreviewItem[]> {
  const city =
    typeof cityInput === "string" && cityInput.trim() !== ""
      ? cityInput.trim()
      : GUEST_PREVIEW_DEFAULT_CITY;

  try {
    // Gate 1 — flag off = zero guest surface (fail-closed, no error).
    if (!(await getFeatureFlag("guestEventPreviewEnabled"))) {
      return [];
    }

    const now = new Date();
    const candidates: GuestPreviewPoolCandidate[] = await db
      .select({
        id: eventPools.id,
        title: eventPools.title,
        dateTime: eventPools.dateTime,
        district: eventPools.district,
        eventType: eventPools.eventType,
        status: eventPools.status,
        isTestPool: eventPools.isTestPool,
        registrationDeadline: eventPools.registrationDeadline,
        city: eventPools.city,
        minGroupSize: eventPools.minGroupSize,
        maxGroupSize: eventPools.maxGroupSize,
        targetGroups: eventPools.targetGroups,
      })
      .from(eventPools)
      .where(
        and(
          eq(eventPools.status, "active"),
          gt(eventPools.registrationDeadline, now),
          or(eq(eventPools.isTestPool, false), isNull(eventPools.isTestPool)),
          eq(eventPools.city, city),
        ),
      )
      .orderBy(eventPools.dateTime)
      .limit(GUEST_PREVIEW_CANDIDATE_FETCH_LIMIT);

    // The SQL where is a coarse pre-filter; the predicate is the authority
    // (and the surface route tests exercise) for qualification semantics.
    const qualified = candidates.filter((pool) =>
      isQualifiedGuestPreviewPool(pool, { now, city }),
    );

    // Gate 2 — qualified supply below the frozen ≥3 threshold means the
    // guest sees nothing rather than a thin, weak teaser (fail-closed). Since
    // eligible ⊆ qualified, this early return also guarantees the seats
    // count query below always runs with at least one pool id.
    if (qualified.length < GUEST_PREVIEW_MIN_SUPPLY) {
      return [];
    }

    // Live seats — same口径 as the pool detail page: active registrations
    // (matchStatus pending + matched) counted against capacity. Computed for
    // EVERY qualified candidate (not just the top-3 slice) so the Gate 3
    // eligibility cut can exclude full pools before the teaser is built.
    const countRows: Array<{ poolId: string; count: number }> = await db
      .select({
        poolId: eventPoolRegistrations.poolId,
        count: sql<number>`count(*)::int`,
      })
      .from(eventPoolRegistrations)
      .where(
        and(
          inArray(
            eventPoolRegistrations.poolId,
            qualified.map((pool) => pool.id),
          ),
          inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
        ),
      )
      .groupBy(eventPoolRegistrations.poolId);

    const countByPool = new Map<string, number>(
      countRows.map((row) => [row.poolId, row.count]),
    );

    const seatsLeftOf = (pool: GuestPreviewPoolCandidate): number =>
      Math.max(
        resolvePreviewPoolCapacity(pool) - (countByPool.get(pool.id) ?? 0),
        0,
      );

    // Gate 3 (CONCERN C2) — a pool with zero seats left is full; rendering it
    // as a "还剩 0 座" teaser card is a turn-off, not an acquisition hook.
    // Same layer as the ≥3 supply threshold: after the cut, < 3 → 200 + [].
    const eligible = qualified.filter((pool) => seatsLeftOf(pool) > 0);
    if (eligible.length < GUEST_PREVIEW_MIN_SUPPLY) {
      return [];
    }

    const previewPools = eligible.slice(0, GUEST_PREVIEW_MAX_ITEMS);

    return previewPools.map((pool) => ({
      id: pool.id,
      title: pool.title,
      dateTime: pool.dateTime.toISOString(),
      district: pool.district,
      eventType: pool.eventType,
      spotsLeft: seatsLeftOf(pool),
    }));
  } catch (error) {
    // Guests never see an error page — every failure degrades to an empty
    // teaser, and the failure is observable server-side.
    logger.error("Failed to build guest event preview", {
      city,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
