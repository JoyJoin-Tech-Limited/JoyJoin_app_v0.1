/**
 * Shell Repository — composite data access for Predictive Shell endpoints
 *
 * Optimized for minimal DB round-trips:
 *   1. User slice (1 query)
 *   2. Active pools (1 query)
 *   3. Parallel bulk: all registrations + AI headlines (2 queries)
 *   4. In-memory assembly (zero additional DB calls)
 *
 * With small-to-medium registration counts (<1000), fetching all
 * registration rows and computing aggregates in JS is faster than
 * multiple window-function / GROUP BY round-trips to a remote DB.
 */

import { and, eq, gt, inArray, sql, desc } from "drizzle-orm";
import { db } from "../db";
import {
  eventPools,
  eventPoolRegistrations,
  poolAICopy,
  users,
  eventAttendance,
  connections,
  eventFeedback,
} from "@shared/schema";
import type { DiscoverShellPoolItem, ProfileShellResponse, UserCouponsResponse, ConnectionsShellContext } from "@shared/api";
import { getArchetypeFamily } from "@shared/archetypeColors";
import { computeOracleCardFields } from "../lib/oracleCardComputation";
import { buildAuthUserResponse } from "../lib/buildAuthUserResponse";
import { paymentsRepo } from "./paymentsRepo";
import { notificationsRepo } from "./notificationsRepo";
import { getUserJoinedEventsSummary, getConnectionsContextEvents } from "./joinedEventsRepo";
import { getUserConnections, getUserPendingRequests } from "./connectionsRepo";
import { resolveConnectionsContext, type JoinedEventForContext } from "../lib/connectionsContextResolver";

const SAMPLE_ARCHETYPE_COUNT = 5;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 20;

function resolvePoolCapacity(pool: {
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  targetGroups?: number | null;
}): number {
  const minGroupSize = Math.max(pool.minGroupSize ?? 4, 1);
  const maxGroupSize = Math.max(pool.maxGroupSize ?? minGroupSize, minGroupSize);
  const targetGroups = Math.max(pool.targetGroups ?? 1, 1);
  return maxGroupSize * targetGroups;
}

/** Encode a composite cursor from the last pool's dateTime and id. */
function encodeCursor(dateTime: Date, id: string): string {
  const payload = `${dateTime.toISOString()}__${id}`;
  return Buffer.from(payload).toString("base64url");
}

/** Decode a composite cursor into { dateTime, id }. Returns null on malformed input. */
function decodeCursor(cursor: string): { dateTime: Date; id: string } | null {
  try {
    const payload = Buffer.from(cursor, "base64url").toString("utf8");
    const sepIndex = payload.indexOf("__");
    if (sepIndex === -1) return null;
    const dateTime = new Date(payload.slice(0, sepIndex));
    const id = payload.slice(sepIndex + 2);
    if (Number.isNaN(dateTime.getTime()) || !id) return null;
    return { dateTime, id };
  } catch {
    return null;
  }
}

export interface DiscoverShellQueryResult {
  user: { nextStep: string; primaryArchetype: string | null };
  pools: {
    items: DiscoverShellPoolItem[];
    hasMore: boolean;
    nextCursor?: string;
  };
  myRegistrations: {
    ids: string[];
    statuses: Record<string, "pending" | "confirmed" | "cancelled">;
  };
  meta: { cacheKey: string; serverTime: string };
}

export async function getDiscoverShellData(params: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<DiscoverShellQueryResult> {
  const { userId, cursor: rawCursor } = params;
  const limit = Math.min(
    Math.max(params.limit ?? DEFAULT_PAGE_LIMIT, 1),
    MAX_PAGE_LIMIT
  );
  const now = new Date();

  // ── 1. User slice ────────────────────────────────────────────────────────
  const [userRow] = await db
    .select({
      displayName: users.displayName,
      gender: users.gender,
      currentCity: users.currentCity,
      hasCompletedPersonalityTest: users.hasCompletedPersonalityTest,
      hasCompletedRegistration: users.hasCompletedRegistration,
      hasCompletedInterestsCarousel: users.hasCompletedInterestsCarousel,
      hasSeenProfileReview: users.hasSeenProfileReview,
      onboardingCheckpoint: users.onboardingCheckpoint,
      primaryArchetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return {
      user: { nextStep: "discover", primaryArchetype: null },
      pools: { items: [], hasMore: false },
      myRegistrations: { ids: [], statuses: {} },
      meta: {
        cacheKey: `shell-discover-${userId}-0-${limit}`,
        serverTime: now.toISOString(),
      },
    };
  }

  const profileEssentialComplete = !!(
    userRow.displayName && userRow.gender && userRow.currentCity
  );

  type OnboardingStep =
    | "onboarding"
    | "personality-test"
    | "essential-data"
    | "extended-data"
    | "profile-review"
    | "discover";

  let nextStep: OnboardingStep;
  if (!userRow.hasCompletedPersonalityTest && !userRow.hasCompletedRegistration) {
    nextStep = "onboarding";
  } else if (!userRow.hasCompletedPersonalityTest) {
    nextStep = "personality-test";
  } else if (!profileEssentialComplete) {
    nextStep = "essential-data";
  } else if (!userRow.hasCompletedInterestsCarousel) {
    nextStep = "extended-data";
  } else if (!userRow.hasSeenProfileReview) {
    nextStep = "profile-review";
  } else {
    nextStep = "discover";
  }

  const stepOrder: OnboardingStep[] = [
    "onboarding",
    "personality-test",
    "essential-data",
    "extended-data",
    "profile-review",
    "discover",
  ];
  const baseIndex = stepOrder.indexOf(nextStep);
  const checkpointValue = userRow.onboardingCheckpoint as OnboardingStep | null;
  const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;
  if (
    checkpointValue &&
    checkpointIndex !== -1 &&
    baseIndex !== -1 &&
    checkpointIndex > baseIndex &&
    checkpointIndex < stepOrder.indexOf("discover")
  ) {
    const nextStepIndex = Math.min(
      checkpointIndex + 1,
      stepOrder.indexOf("discover")
    );
    nextStep = stepOrder[nextStepIndex];
  }

  const userArchetype = userRow.primaryArchetype ?? null;

  // ── 2. Active pools (pruned SELECT, cursor pagination) ───────────────────
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;

  const whereClauses = [
    eq(eventPools.status, "active"),
    gt(eventPools.registrationDeadline, now),
  ];

  if (cursor) {
    whereClauses.push(
      sql`(${eventPools.dateTime} > ${cursor.dateTime} OR (${eventPools.dateTime} = ${cursor.dateTime} AND ${eventPools.id} > ${cursor.id}))`
    );
  }

  const poolsRaw = await db
    .select({
      id: eventPools.id,
      title: eventPools.title,
      eventType: eventPools.eventType,
      city: eventPools.city,
      district: eventPools.district,
      dateTime: eventPools.dateTime,
      status: eventPools.status,
      minGroupSize: eventPools.minGroupSize,
      maxGroupSize: eventPools.maxGroupSize,
      targetGroups: eventPools.targetGroups,
      price: eventPools.price,
      registrationDeadline: eventPools.registrationDeadline,
    })
    .from(eventPools)
    .where(and(...whereClauses))
    .orderBy(eventPools.dateTime, eventPools.id)
    .limit(limit + 1);

  const hasMore = poolsRaw.length > limit;
  const pagePools = poolsRaw.slice(0, limit);
  const poolIds = pagePools.map((p: any) => p.id);

  // ── 3. Parallel bulk queries (only 2 round-trips) ────────────────────────
  const [allRegistrationRows, aiCopyRows] = await Promise.all([
    // All registrations for visible pools + their user archetypes (single JOIN)
    poolIds.length > 0
      ? db
          .select({
            poolId: eventPoolRegistrations.poolId,
            userId: eventPoolRegistrations.userId,
            matchStatus: eventPoolRegistrations.matchStatus,
            archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
          })
          .from(eventPoolRegistrations)
          .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
          .where(
            and(
              sql`${eventPoolRegistrations.poolId} IN (${sql.join(poolIds.map((id: any) => sql`${id}`), sql`, `)})`,
              eq(eventPoolRegistrations.matchStatus, "pending")
            )
          )
          .orderBy(eventPoolRegistrations.poolId, eventPoolRegistrations.registeredAt)
      : Promise.resolve([]),

    // AI headlines
    poolIds.length > 0
      ? db
          .select({
            poolId: poolAICopy.poolId,
            headline: poolAICopy.headline,
          })
          .from(poolAICopy)
          .where(
            and(
              inArray(poolAICopy.poolId, poolIds),
              eq(poolAICopy.displayStatus, "live"),
              gt(poolAICopy.expiresAt, now)
            )
          )
      : Promise.resolve([]),
  ]);

  // ── 4. In-memory aggregation (zero DB round-trips) ───────────────────────
  const registrationsByPool = new Map<string, Array<{ userId: string; archetype: string | null; matchStatus: string | null }>>();
  const myRegistrations: DiscoverShellQueryResult["myRegistrations"] = { ids: [], statuses: {} };

  for (const row of allRegistrationRows) {
    // Group by pool
    const poolRegs = registrationsByPool.get(row.poolId) ?? [];
    poolRegs.push({ userId: row.userId, archetype: row.archetype, matchStatus: row.matchStatus });
    registrationsByPool.set(row.poolId, poolRegs);

    // Track my registrations
    if (row.userId === userId) {
      myRegistrations.ids.push(row.poolId);
      myRegistrations.statuses[row.poolId] =
        row.matchStatus === "matched" ? "confirmed" : "pending";
    }
  }

  const aiHeadlineByPool = new Map<string, string | null>();
  for (const row of aiCopyRows) {
    if (row.headline) {
      aiHeadlineByPool.set(row.poolId, row.headline);
    }
  }

  // ── 5. Assemble pruned pool items ────────────────────────────────────────
  const items: DiscoverShellPoolItem[] = pagePools.map((pool: any) => {
    const regs = registrationsByPool.get(pool.id) ?? [];
    const registrationCount = regs.length;
    const capacity = resolvePoolCapacity(pool);

    // Sample archetypes: first 5 registered users' archetypes
    const sampleArchetypes = regs
      .slice(0, SAMPLE_ARCHETYPE_COUNT)
      .map((r) => r.archetype)
      .filter((a): a is string => Boolean(a));

    // Top archetypes: count frequencies, sort desc, take top 3
    const archetypeCounts = new Map<string, number>();
    for (const r of regs) {
      if (r.archetype) {
        archetypeCounts.set(r.archetype, (archetypeCounts.get(r.archetype) ?? 0) + 1);
      }
    }
    const topArchetypes = Array.from(archetypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([archetype, count]) => ({ archetype, count }));

    const dominantArchetype = topArchetypes[0]?.archetype;
    const accentFamily = getArchetypeFamily(dominantArchetype);
    const hasUserArchetypeMatch = userArchetype
      ? sampleArchetypes.includes(userArchetype)
      : false;

    const allArchetypes = Array.from(archetypeCounts.entries()).map(([archetype, count]) => ({
      archetype,
      count,
    }));

    const oracleFields = computeOracleCardFields({
      pool,
      allArchetypes,
      userArchetype,
      registrationCount,
      now,
    });

    return {
      id: pool.id,
      title: pool.title,
      eventType: pool.eventType,
      city: pool.city,
      district: pool.district,
      dateTime: pool.dateTime?.toISOString?.() ?? String(pool.dateTime),
      status: pool.status,
      registrationCount,
      currentParticipants: registrationCount,
      maxParticipants: capacity,
      spotsLeft: Math.max(capacity - registrationCount, 0),
      sampleArchetypes,
      topArchetypes,
      accentFamily,
      aiHeadline: aiHeadlineByPool.get(pool.id) ?? null,
      hasUserArchetypeMatch,
      ...oracleFields,
    };
  });

  const nextCursor =
    hasMore && pagePools.length > 0
      ? encodeCursor(pagePools[pagePools.length - 1].dateTime, pagePools[pagePools.length - 1].id)
      : undefined;

  const cacheKey = `shell-discover-${userId}-${rawCursor ?? "0"}-${limit}`;

  return {
    user: { nextStep, primaryArchetype: userArchetype },
    pools: { items, hasMore, nextCursor },
    myRegistrations,
    meta: {
      cacheKey,
      serverTime: now.toISOString(),
    },
  };
}

// ── Profile Shell ───────────────────────────────────────────────────────────

function normalizeCouponStatus(raw: any): 'available' | 'used' | 'expired' {
  const isUsed = raw.is_used === true || raw.isUsed === true
  if (isUsed) return 'used'

  const validUntil = raw.valid_until ?? raw.validUntil
  if (validUntil && new Date(validUntil) < new Date()) return 'expired'

  return 'available'
}

function normalizeUserCoupons(rawRows: any[]): UserCouponsResponse {
  const coupons = rawRows.map((raw) => ({
    id: String(raw.id),
    couponId: raw.coupon_id ?? raw.couponId ?? null,
    code: raw.code ?? null,
    discountType: raw.discount_type ?? raw.discountType ?? null,
    discountValue:
      typeof raw.discount_value === 'number'
        ? raw.discount_value
        : typeof raw.discountValue === 'number'
          ? raw.discountValue
          : null,
    validFrom: raw.valid_from ?? raw.validFrom ?? null,
    validUntil: raw.valid_until ?? raw.validUntil ?? null,
    isUsed: raw.is_used === true || raw.isUsed === true,
    usedAt: raw.used_at ?? raw.usedAt ?? null,
    source: raw.source ?? null,
    sourceId: raw.source_id ?? raw.sourceId ?? null,
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    status: normalizeCouponStatus(raw),
  }))

  const availableCount = coupons.filter((c) => c.status === 'available').length

  return {
    count: coupons.length,
    availableCount,
    coupons,
  }
}

export interface ProfileShellQueryResult {
  user: NonNullable<Awaited<ReturnType<typeof buildAuthUserResponse>>>
  coupons: UserCouponsResponse
  stats: {
    eventsJoined: number
    connectionsCount: number
  }
  meta: { cacheKey: string; serverTime: string }
}

export async function getProfileShellData(params: {
  userId: string
}): Promise<ProfileShellQueryResult> {
  const { userId } = params
  const now = new Date()

  // 1. Auth user (full response — same as GET /api/auth/user)
  const user = await buildAuthUserResponse(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // 2. Coupons + stats in parallel (3 round-trips → 1 parallel batch)
  const [couponRows, eventsJoinedRows, connectionsRows] = await Promise.all([
    paymentsRepo.getUserCoupons(userId),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAttendance)
      .where(eq(eventAttendance.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(connections)
      .where(
        and(
          sql`${connections.userAId} = ${userId} OR ${connections.userBId} = ${userId}`,
          eq(connections.status, 'mutual')
        )
      ),
  ])

  // Also count pool registrations as "events joined"
  const poolRegistrationsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.userId, userId),
        inArray(eventPoolRegistrations.matchStatus, ['pending', 'matched'])
      )
    )

  const eventsJoinedResult = eventsJoinedRows[0]?.count ?? 0
  const connectionsResult = connectionsRows[0]?.count ?? 0
  const poolRegistrationsResult = poolRegistrationsRows[0]?.count ?? 0

  const eventsJoined = (eventsJoinedResult ?? 0) + (poolRegistrationsResult ?? 0)
  const connectionsCount = connectionsResult ?? 0

  const coupons = normalizeUserCoupons(couponRows)

  return {
    user,
    coupons,
    stats: {
      eventsJoined,
      connectionsCount,
    },
    meta: {
      cacheKey: `shell-profile-${userId}`,
      serverTime: now.toISOString(),
    },
  }
}

// ── Events Shell ────────────────────────────────────────────────────────────

export interface EventsShellQueryResult {
  user: { nextStep: string; primaryArchetype: string | null }
  joinedEvents: Awaited<ReturnType<typeof getUserJoinedEventsSummary>>
  notifications: Awaited<ReturnType<typeof notificationsRepo.getNotificationCounts>>
  meta: { cacheKey: string; serverTime: string }
}

export async function getEventsShellData(params: {
  userId: string
}): Promise<EventsShellQueryResult> {
  const { userId } = params
  const now = new Date()

  // 1. Auth user (pruned — same as Discover shell)
  const user = await buildAuthUserResponse(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // 2. Joined events + notifications in parallel (2 round-trips)
  const [joinedEvents, notifications] = await Promise.all([
    getUserJoinedEventsSummary(userId),
    notificationsRepo.getNotificationCounts(userId),
  ])

  return {
    user: {
      nextStep: user.nextStep,
      primaryArchetype: user.primaryArchetype ?? null,
    },
    joinedEvents,
    notifications,
    meta: {
      cacheKey: `shell-events-${userId}`,
      serverTime: now.toISOString(),
    },
  }
}

// ── Connections Shell ───────────────────────────────────────────────────────

export interface ConnectionsShellQueryResult {
  user: { nextStep: string; primaryArchetype: string | null }
  connections: Awaited<ReturnType<typeof getUserConnections>>
  pendingRequests: Awaited<ReturnType<typeof getUserPendingRequests>>
  connectionsContext: ConnectionsShellContext | null
  notifications: Awaited<ReturnType<typeof notificationsRepo.getNotificationCounts>>
  meta: { cacheKey: string; serverTime: string }
}

export async function getConnectionsShellData(params: {
  userId: string
}): Promise<ConnectionsShellQueryResult> {
  const { userId } = params
  const now = new Date()

  // 1. Auth user (pruned — same as Discover shell)
  const user = await buildAuthUserResponse(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // 2. Connections + pending requests + notifications + lightweight joined events in parallel
  const [connections, pendingRequests, notifications, joinedEvents] = await Promise.all([
    getUserConnections(userId),
    getUserPendingRequests(userId),
    notificationsRepo.getNotificationCounts(userId),
    getConnectionsContextEvents(userId),
  ])

  // 3. Feedback rows for joined events (1 round-trip, skipped if no events)
  const eventIds = joinedEvents.map((e) => e.id)
  const feedbackRows: { eventId: string }[] = eventIds.length
    ? await db
        .select({ eventId: eventFeedback.eventId })
        .from(eventFeedback)
        .where(and(eq(eventFeedback.userId, userId), inArray(eventFeedback.eventId, eventIds)))
    : []
  const feedbackEventIds = new Set(feedbackRows.map((r) => r.eventId))

  const connectionsContext = resolveConnectionsContext(joinedEvents, feedbackEventIds, now)

  return {
    user: {
      nextStep: user.nextStep,
      primaryArchetype: user.primaryArchetype ?? null,
    },
    connections,
    pendingRequests,
    connectionsContext,
    notifications,
    meta: {
      cacheKey: `shell-connections-${userId}`,
      serverTime: now.toISOString(),
    },
  }
}
