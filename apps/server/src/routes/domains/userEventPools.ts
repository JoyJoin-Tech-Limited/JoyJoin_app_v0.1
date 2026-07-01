import type { Express, Request } from "express";
import { db } from "../../db";
import { eq, and, desc, inArray, gt, sql } from "drizzle-orm";
import {
  eventPools,
  eventPoolRegistrations,
  eventPoolGroups,
  users,
  invitations,
  invitationUses,
  blindBoxEvents,
  poolAICopy,
  userInterests,
  userInterestSignals,
  referralCodes,
  referralConversions,
} from "@shared/schema";
import type { User } from "@shared/schema";
import { formatAge } from "@shared/utils";
import { getArchetypeFamily } from "@shared/archetypeColors";
import { storage } from "../../storage";
import { buildEventPoolRegistrationInsert, type EventPoolRegistrationPreferenceDNA } from "../../lib/eventPoolRegistration";
import { resolveEffectivePreferenceDNA } from "../../lib/matchCompass";
import { describePoolRegistrationAvailability } from "../../lib/poolRegistrationRules";
import { eventCreditsRepo } from "../../repositories/eventCreditsRepo";
import { buildPoolPersonaSnapshot } from "../../repositories/eventPoolPersonaRepo";
import { loadInterestSignalsByUserIds } from "./helpers";
import { recordPoolCardCopyCache } from "../../middleware/metrics";
import { enrichProfileFromRegistration } from "../../lib/profileEnrichment";
import { logger } from "../../lib/logger";
import { captureLocationSnapshot } from "../../lib/captureLocationSnapshot";
import { getFeatureFlag, getFeatureFlagSync } from "../../lib/featureFlags";
import { shellCache } from "../../lib/shellCache";
import { computeOracleCardFields } from "../../lib/oracleCardComputation";
import { broadcastAttendanceStatusUpdated } from "../../eventBroadcast";
import { wsService } from "../../wsService";
import { aiEndpointLimiter } from "../../rateLimiter";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { paymentService } from "../../paymentService";
import { resolveCouponValidation } from "../domains/payments";
import { getTestPriceCents } from "../../lib/paymentTestPrice";
import type { GroupAnalysisResponse } from "@shared/types/groupAnalysis";
import * as schema from "@shared/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const SAMPLE_ARCHETYPE_COUNT = 5;
type DbTransaction = NodePgDatabase<typeof schema>;

function createEmptyInsightsData() {
  return {
    engagementMetrics: {
      totalUsers: 0,
      activeUsers: 0,
      totalEvents: 0,
      avgEventsPerUser: 0,
      newUsers7Days: 0,
      newUsersPrevious7Days: 0,
    },
    userGrowth: [],
    eventTrends: [],
    personalityDistribution: [],
    matchingEfficiency: {
      successRate: 0,
      avgMatchTime: 0,
      attemptsPerUser: 0,
    },
    retention: {
      weeklyRetention: [],
      userSegments: {
        new: 0,
        active: 0,
        dormant: 0,
        churned: 0,
      },
      superUsers: {
        count: 0,
        topArchetypes: [],
      },
    },
    eventQuality: {
      completionRate: 0,
      avgRating: 0,
      complaintRate: 0,
      lowRatedEvents: [],
    },
    monetization: {
      conversionRate: 0,
      revenueBreakdown: {
        subscription: 0,
        singleEvent: 0,
      },
      arpu: 0,
      conversionFunnel: {
        registered: 0,
        browsedEvents: 0,
        signedUp: 0,
        paid: 0,
      },
      monthlyRevenue: 0,
    },
    isFallback: true,
    warning: "部分数据源暂不可用，已显示空状态。请稍后重试或联系技术团队检查数据洞察查询。",
  };
}

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

function getUserDisplayName(user: any): string {
  return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
}

async function requireAuth(req: Request, res: any, next: any) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function registerUserEventPoolRoutes(app: Express): void {
  // ============ USER EVENT POOLS (用户端活动池) ============
  
  // Get all active event pools (for DiscoverPage)
  app.get('/api/event-pools', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { city, eventType } = req.query;
      const now = new Date();

      const whereClauses = [
        eq(eventPools.status, "active"),
        gt(eventPools.registrationDeadline, now),
      ];

      if (city) {
        whereClauses.push(eq(eventPools.city, String(city)));
      }

      if (eventType) {
        whereClauses.push(eq(eventPools.eventType, String(eventType)));
      }

      const pools = await db
        .select()
        .from(eventPools)
        .where(and(...whereClauses))
        // 不用 asc/desc，直接按时间排序即可，防止少 import 报错
        .orderBy(eventPools.dateTime);

      if (pools.length === 0) {
        return res.json([]);
      }

      const poolIds = (pools as any[]).map((p: any) => p.id);

      // 查出当前用户在这些池子里的报名记录
      const userRegistrations = await db
        .select({ poolId: eventPoolRegistrations.poolId })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.userId, userId),
            inArray(eventPoolRegistrations.poolId, poolIds)
          )
        );

      const registeredPoolIds = new Set((userRegistrations as any[]).map((r: any) => r.poolId));

      // 过滤掉已经报名过的池子
      const visiblePools = (pools as any[]).filter((p: any) => !registeredPoolIds.has(p.id));

      const visiblePoolIds = visiblePools.map((pool: any) => pool.id);
      const registrationCountRows = visiblePoolIds.length > 0
        ? await db
            .select({
              poolId: eventPoolRegistrations.poolId,
              count: sql<number>`count(*)::int`,
            })
            .from(eventPoolRegistrations)
            .where(
              and(
                inArray(eventPoolRegistrations.poolId, visiblePoolIds),
                inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
              ),
            )
            .groupBy(eventPoolRegistrations.poolId)
        : [];

      const registrationCountByPool = new Map<string, number>();
      for (const row of registrationCountRows as Array<{ poolId: string; count: number }>) {
        registrationCountByPool.set(row.poolId, row.count);
      }

      const sampleRegistrationRows = visiblePoolIds.length > 0
        ? await db.execute(sql<{ poolId: string; userId: string }>`
            SELECT ranked.pool_id AS "poolId", ranked.user_id AS "userId"
            FROM (
              SELECT
                pool_id,
                user_id,
                row_number() OVER (
                  PARTITION BY pool_id
                  ORDER BY registered_at ASC
                ) AS sample_rank
              FROM event_pool_registrations
              WHERE pool_id = ANY(${visiblePoolIds})
            ) ranked
            WHERE ranked.sample_rank <= ${SAMPLE_ARCHETYPE_COUNT}
          `)
        : { rows: [] as Array<{ poolId: string; userId: string }> };

      const sampleRegistrationsByPool = new Map<string, Array<{ userId: string }>>();
      for (const row of sampleRegistrationRows.rows as Array<{ poolId: string; userId: string }>) {
        const entries = sampleRegistrationsByPool.get(row.poolId) ?? [];
        entries.push({ userId: row.userId });
        sampleRegistrationsByPool.set(row.poolId, entries);
      }

      const sampleUserIds = Array.from(
        new Set(
          [...sampleRegistrationsByPool.values()]
            .flatMap((registrations) => registrations.slice(0, SAMPLE_ARCHETYPE_COUNT).map((registration) => registration.userId)),
        ),
      );

      const sampleUserRows = sampleUserIds.length > 0
        ? await db
            .select({
              id: users.id,
              archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
            })
            .from(users)
            .where(inArray(users.id, sampleUserIds))
        : [];

      const userArchetypeMap = new Map<string, string | null>(
        sampleUserRows.map((row: { id: string; archetype: string | null }) => [row.id, row.archetype]),
      );

      // ── Fetch current user's archetype for personalization ──
      const [currentUserRow] = await db
        .select({
          archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const userArchetype = currentUserRow?.archetype ?? null;

      // ── Aggregate top archetypes per visible pool ──
      const topArchetypeRows = visiblePoolIds.length > 0
        ? await db
            .select({
              poolId: eventPoolRegistrations.poolId,
              archetype: sql<string>`coalesce(${users.primaryArchetype}, ${users.archetype}, '未设置')`,
              count: sql<number>`count(*)::int`,
            })
            .from(eventPoolRegistrations)
            .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
            .where(inArray(eventPoolRegistrations.poolId, visiblePoolIds))
            .groupBy(eventPoolRegistrations.poolId, sql`coalesce(${users.primaryArchetype}, ${users.archetype}, '未设置')`)
            .orderBy(eventPoolRegistrations.poolId, sql`count(*) desc`)
        : [];

      // Build full archetype breakdown (for Oracle Card computation) + capped top-3 (backward compat)
      const allArchetypesByPool = new Map<string, Array<{ archetype: string; count: number }>>();
      const topArchetypesByPool = new Map<string, Array<{ archetype: string; count: number }>>();
      for (const row of topArchetypeRows as Array<{ poolId: string; archetype: string; count: number }>) {
        // All archetypes (no cap) — used for Oracle Card computation
        const allEntries = allArchetypesByPool.get(row.poolId) ?? [];
        allEntries.push({ archetype: row.archetype, count: row.count });
        allArchetypesByPool.set(row.poolId, allEntries);

        // Capped at 3 — backward compatible field
        const topEntries = topArchetypesByPool.get(row.poolId) ?? [];
        if (topEntries.length < 3) {
          topEntries.push({ archetype: row.archetype, count: row.count });
          topArchetypesByPool.set(row.poolId, topEntries);
        }
      }

      // ── Fetch cached AI headlines (Slice 3 will populate this) ──
      const aiCopyRows = visiblePoolIds.length > 0
        ? await db
            .select({
              poolId: poolAICopy.poolId,
              headline: poolAICopy.headline,
            })
            .from(poolAICopy)
            .where(
              and(
                inArray(poolAICopy.poolId, visiblePoolIds),
                eq(poolAICopy.displayStatus, 'live'),
                gt(poolAICopy.expiresAt, new Date())
              )
            )
        : [];

      const aiHeadlineByPool = new Map<string, string | null>();
      for (const row of aiCopyRows) {
        if (row.headline) {
          aiHeadlineByPool.set(row.poolId, row.headline);
        }
      }

      // Instrument cache hit/miss per pool for observability
      for (const poolId of visiblePoolIds) {
        recordPoolCardCopyCache(aiHeadlineByPool.has(poolId) ? 'hit' : 'miss');
      }

      const poolsWithSocialProof = visiblePools.map((pool: any) => {
        const registrations = sampleRegistrationsByPool.get(pool.id) ?? [];
        const registrationCount = registrationCountByPool.get(pool.id) ?? 0;
        const capacity = resolvePoolCapacity(pool);
        const sampleArchetypes = registrations
          .map((registration) => userArchetypeMap.get(registration.userId))
          .filter((archetype): archetype is string => Boolean(archetype));

        const topArchetypes = topArchetypesByPool.get(pool.id) ?? [];
        const dominantArchetype = topArchetypes[0]?.archetype;
        const accentFamily = getArchetypeFamily(dominantArchetype);
        const hasUserArchetypeMatch = userArchetype
          ? sampleArchetypes.includes(userArchetype)
          : false;

        // ── Oracle Card computation (Phase 1) ──
        const allArchetypes = allArchetypesByPool.get(pool.id) ?? [];
        const oracleFields = computeOracleCardFields({
          pool,
          allArchetypes,
          userArchetype,
          registrationCount,
          now,
        });

        return {
          ...pool,
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

      logger.info("[EventPools] visible pools for user", {
        userId,
        total: pools.length,
        registeredCount: userRegistrations.length,
        visibleCount: visiblePools.length,
      });

      return res.json(poolsWithSocialProof);
    } catch (error) {
      logger.error(`Error fetching event pools for user ${req.session?.userId}: ${error}`);
      return res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // Get single event pool details
  app.get("/api/event-pools/:id", requireAuth, async (req: any, res) => {
    try {
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, req.params.id),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      // Get registration count + archetype breakdown
      const registrations = await db.query.eventPoolRegistrations.findMany({
        where: and(
          eq(eventPoolRegistrations.poolId, req.params.id),
          inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
        ),
      });

      const regUserIds = registrations.map((r: any) => r.userId);
      const regUsers = regUserIds.length > 0
        ? await db
            .select({
              id: users.id,
              archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
            })
            .from(users)
            .where(inArray(users.id, regUserIds))
        : [];

      const sampleArchetypes = regUsers
        .map((u: { archetype: string | null }) => u.archetype)
        .filter((a: string | null): a is string => Boolean(a));

      const archetypeCounts = new Map<string, number>();
      for (const a of sampleArchetypes) {
        archetypeCounts.set(a, (archetypeCounts.get(a) ?? 0) + 1);
      }
      const allArchetypes = Array.from(archetypeCounts.entries())
        .map(([archetype, count]) => ({ archetype, count }))
        .sort((a, b) => b.count - a.count);
      const topArchetypes = allArchetypes.slice(0, 3);

      const accentFamily = getArchetypeFamily(topArchetypes[0]?.archetype);

      // ── Fetch current user's archetype for Oracle Card personalization ──
      const userId = req.session?.userId;
      const [currentUserRow] = userId
        ? await db
            .select({
              archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
        : [null];
      const userArchetype = currentUserRow?.archetype ?? null;
      const hasUserArchetypeMatch = userArchetype
        ? sampleArchetypes.includes(userArchetype)
        : false;

      // ── Oracle Card computation ──
      const capacity = resolvePoolCapacity(pool);
      const oracleFields = computeOracleCardFields({
        pool,
        allArchetypes,
        userArchetype,
        registrationCount: registrations.length,
        now: new Date(),
      });

      res.json({
        ...pool,
        registrationCount: registrations.length,
        currentParticipants: registrations.length,
        maxParticipants: capacity,
        spotsLeft: Math.max(capacity - registrations.length, 0),
        sampleArchetypes,
        topArchetypes,
        accentFamily,
        aiHeadline: null,
        hasUserArchetypeMatch,
        ...oracleFields,
      });
    } catch (error) {
      logger.error("Error fetching event pool", { error: String(error), poolId: req.params.id });
      res.status(500).json({ message: "Failed to fetch event pool" });
    }
  });

  // Aggregate persona snapshot for pool registration preview card
  app.get("/api/event-pools/:id/persona-snapshot", requireAuth, async (req: any, res) => {
    try {
      const poolId = req.params.id;
      if (!poolId || typeof poolId !== "string" || poolId.trim() === "") {
        return res.status(400).json({ message: "Invalid pool ID" });
      }
      const userId = req.session?.userId;
      const snapshot = await buildPoolPersonaSnapshot(poolId, userId);

      if (!snapshot) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      res.json(snapshot);
    } catch (error) {
      logger.error("Error fetching persona snapshot", { error: String(error), poolId: req.params.id });
      res.status(500).json({ message: "Failed to fetch persona snapshot" });
    }
  });

  // Get group-fill progress for a pool (lightweight progress tracking)
  app.get("/api/event-pools/:poolId/group-fill", async (req, res) => {
    try {
      const { poolId } = req.params;

      // Count pending registrations in this pool
      const pendingRegs = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending")
          )
        );

      // Get pool config for min/max group size
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId),
        columns: { minGroupSize: true, maxGroupSize: true },
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const minSize = pool.minGroupSize || 4;
      const maxSize = pool.maxGroupSize || 6;
      const currentFill = Math.min(pendingRegs[0]?.count || 0, maxSize);
      
      // Progress is based on reaching minSize, capped at 100%
      const progress = Math.min((currentFill / minSize) * 100, 100);

      res.json({
        currentFill,
        minGroupSize: minSize,
        maxGroupSize: maxSize,
        progress,
      });
    } catch (error) {
      logger.error("Error fetching group-fill progress", { error: String(error), poolId: req.params.poolId });
      res.status(500).json({ message: "Failed to fetch group-fill progress" });
    }
  });

  // User register for event pool with preferences
  app.post("/api/event-pools/:id/register", requireAuth, async (req, res) => {
    try {
      const poolId = req.params.id;
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Feature flag kill-switch for emergency registration disable
      if (!getFeatureFlagSync("registrationEnabled", true)) {
        return res.status(503).json({
          message: "Registration is temporarily unavailable",
          code: "REGISTRATION_DISABLED",
        });
      }

      // Check if pool exists and is active, and load user's preference DNA
      const [pool, user] = await Promise.all([
        db.query.eventPools.findFirst({
          where: (pools: any, { eq }: any) => eq(pools.id, poolId)
        }),
        db.query.users.findFirst({
          where: (u: any, { eq }: any) => eq(u.id, userId),
          columns: {
            id: true,
            archetype: true,
            primaryArchetype: true,
            defaultPreferenceStrictness: true,
            defaultAcceptPairs: true,
            defaultGenderComposition: true,
            defaultPreferredDistricts: true,
            defaultKolComfort: true,
          },
        }),
      ]);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const dna = resolveEffectivePreferenceDNA(user);
      const preferenceDNA: EventPoolRegistrationPreferenceDNA = {
        strictness: dna.strictness,
        acceptPairs: dna.acceptPairs,
        genderComposition: dna.genderComposition,
        preferredDistricts: dna.preferredDistricts,
        kolComfort: dna.kolComfort,
      };

      const { invitationCode, values: validatedData } = buildEventPoolRegistrationInsert({
        poolId,
        userId,
        payload: req.body,
        preferenceDNA,
      });

      // Check if user already registered
      const existingReg = await db.query.eventPoolRegistrations.findFirst({
        where: (regs: any, { eq, and }: any) => and(
          eq(regs.poolId, poolId),
          eq(regs.userId, userId)
        )
      });

      if (existingReg) {
        return res.status(400).json({ message: "You have already registered for this event pool" });
      }

      const [registrationCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
          ),
        );

      const availability = describePoolRegistrationAvailability(
        {
          status: pool.status,
          registrationDeadline: pool.registrationDeadline,
          minGroupSize: pool.minGroupSize,
          maxGroupSize: pool.maxGroupSize,
          targetGroups: pool.targetGroups,
        },
        registrationCountRow?.count ?? 0,
      );

      if (!availability.allowed) {
        return res.status(availability.status).json({
          message: availability.message,
          code: availability.code,
        });
      }

      // ── Unit/integration test bypass ─────────────────────────────────
      // Only APP_MODE=test may bypass entitlement storage because local test
      // databases may omit `subscriptions` and `event_credit_grants`.
      // Staging single-test mode must still exercise the real payment path.
      const isTestMode = (process.env.APP_MODE ?? "production") === "test";
      let subscription: any;
      let availableEventCredits: number;
      let entitlementMode: string | null;

      if (isTestMode) {
        subscription = undefined;
        availableEventCredits = 0;
        entitlementMode = "test";
      } else {
        subscription = await storage.getUserSubscription(userId);
        availableEventCredits = subscription ? 0 : await eventCreditsRepo.getAvailableCreditCount(userId);
        entitlementMode = subscription ? "subscription" : availableEventCredits > 0 ? "event_pack" : null;
      }

      if (!entitlementMode) {
        return res.status(403).json({ 
          message: "Subscription or event pack required",
          requiresSubscription: true,
          requiresEventPack: true,
          availableEventCredits,
          code: "NO_ACTIVE_ENTITLEMENT"
        });
      }

      // Validate invitation/referral code if provided
      let invitationId: string | undefined;
      let inviterId: string | undefined;
      let referralCodeId: string | undefined;
      if (invitationCode) {
        // First check if it's an invitation code
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(eq(invitations.code, invitationCode))
          .limit(1);

        if (invitation) {
          // Check if invitation expired
          if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
            return res.status(410).json({ message: "Invitation has expired" });
          }

          // Prevent self-invitation
          if (invitation.inviterId === userId) {
            return res.status(400).json({ message: "Cannot use your own invitation code", code: "SELF_INVITE" });
          }

          inviterId = invitation.inviterId;
          invitationId = invitation.id;
        } else {
          // Not an invitation code — check if it's a referral code
          const [referral] = await db
            .select({ id: referralCodes.id, userId: referralCodes.userId })
            .from(referralCodes)
            .where(eq(referralCodes.code, invitationCode))
            .limit(1);

          if (referral) {
            // Prevent self-referral
            if (referral.userId === userId) {
              return res.status(400).json({ message: "Cannot use your own referral code", code: "SELF_INVITE" });
            }

            referralCodeId = referral.id;
            inviterId = referral.userId;
          }
          // If neither invitation nor referral, the code is invalid
          if (!referralCodeId) {
            return res.status(400).json({ message: "Invalid code", code: "INVALID_CODE" });
          }
        }
      }

      const registration = await db.transaction(async (tx: DbTransaction) => {
        const [createdRegistration] = await tx
          .insert(eventPoolRegistrations)
          .values(validatedData)
          .returning();

        if (entitlementMode === "event_pack") {
          try {
            await eventCreditsRepo.consumeCreditForPoolRegistration(tx, {
              userId,
              poolId,
              registrationId: createdRegistration.id,
            });
          } catch (error) {
            const legacyCreditConsumed = await eventCreditsRepo.consumeLegacyUserCreditForPoolRegistration(tx, {
              userId,
            });
            if (!legacyCreditConsumed) {
              throw error;
            }
          }
        }

        if (invitationId && inviterId) {
          const [existingUse] = await tx
            .select({ id: invitationUses.id })
            .from(invitationUses)
            .where(and(
              eq(invitationUses.invitationId, invitationId),
              eq(invitationUses.inviteeId, userId),
            ))
            .limit(1);

          if (!existingUse) {
            await tx.insert(invitationUses).values({
              invitationId,
              inviteeId: userId,
              poolRegistrationId: createdRegistration.id,
            });

            await tx.update(invitations)
              .set({ totalAcceptances: sql`COALESCE(total_acceptances, 0) + 1` })
              .where(eq(invitations.id, invitationId));
          }
        }

        if (referralCodeId) {
          const [existingConversion] = await tx
            .select({ id: referralConversions.id })
            .from(referralConversions)
            .where(eq(referralConversions.invitedUserId, userId))
            .limit(1);

          if (!existingConversion) {
            await tx.insert(referralConversions).values({
              referralCodeId,
              invitedUserId: userId,
            });

            await tx.update(referralCodes)
              .set({ totalConversions: sql`COALESCE(total_conversions, 0) + 1` })
              .where(eq(referralCodes.id, referralCodeId));
          }
        }

        return createdRegistration;
      });

      // Invalidate Predictive Shell caches so Discover/Events reflect new state.
      shellCache.invalidateUser(userId);

      // Clear pending referral code from session after successful use
      if (req.session?.pendingReferralCode) {
        req.session.pendingReferralCode = undefined;
        req.session.save?.(() => {});
      }

      // Trigger realtime matching scan after registration (fire and forget with error handling)
      // Import at top: import { scanPoolAndMatch } from "./poolRealtimeMatchingService";
      const { scanPoolAndMatch } = await import("../../poolRealtimeMatchingService");
      
      // Async trigger (don't block response)
      scanPoolAndMatch(poolId, "realtime", "user_registration").catch((err: any) =>  {
        logger.error(`[Realtime Matching] Scan failed after registration:`, err);
        // Error logged, operation continues
      });

      // Fire-and-forget: regenerate AI card copy when archetype mix changes
      const { generateAndSavePoolCardCopy } = await import("../../ai/workers/poolCardCopyWorker");
      generateAndSavePoolCardCopy(poolId).catch((err: any) => {
        logger.error(`[poolCardCopyWorker] Failed to regenerate copy after registration ${poolId}:`, err);
      });

      // Silently backfill empty profile fields from registration data (fire-and-forget)
      enrichProfileFromRegistration({
        userId: registration.userId,
        eventIntent: registration.eventIntent ?? undefined,
        preferredLanguages: registration.preferredLanguages ?? undefined,
        dietaryRestrictions: registration.dietaryRestrictions ?? undefined,
      }).catch((err: any) => {
        // Log but don't fail the registration
        logger.error("[profileEnrichment] Failed to enrich profile:", err);
      });

      logger.info("Registered for event pool", {
        poolId,
        userId,
        entitlementMode,
        registrationId: registration.id,
      });

      res.json({
        ...registration,
        entitlementMode,
      });

      // Fire-and-forget: if the pool just reached capacity, notify registered users
      (async () => {
        try {
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(eventPoolRegistrations)
            .where(eq(eventPoolRegistrations.poolId, poolId));

          const capacity = resolvePoolCapacity(pool);
          if (count >= capacity) {
            const registeredUserRows = await db
              .select({ userId: eventPoolRegistrations.userId })
              .from(eventPoolRegistrations)
              .where(eq(eventPoolRegistrations.poolId, poolId));

            const registeredUserIds: string[] = registeredUserRows.map((r: { userId: string }) => r.userId);

            await Promise.all(
              registeredUserIds.map((registeredUserId: string) =>
                storage.createNotification({
                  userId: registeredUserId,
                  category: 'activities',
                  type: 'pool_full',
                  title: '活动池已满员',
                  message: `「${pool.title}」报名已满，匹配即将开始`,
                  relatedResourceId: poolId,
                })
              )
            );

            wsService.broadcastToUsers(registeredUserIds, {
              type: 'POOL_FULL',
              data: {
                poolId,
                poolTitle: pool.title,
                totalRegistrations: count,
                capacity,
              },
              timestamp: new Date().toISOString(),
            });

            logger.info("Pool reached capacity; pool_full notifications sent", {
              poolId,
              capacity,
              totalRegistrations: count,
            });
          }
        } catch (poolFullErr) {
          logger.error("Failed to send pool_full notifications", {
            poolId,
            error: poolFullErr instanceof Error ? poolFullErr.message : String(poolFullErr),
          });
        }
      })();

      // Best-effort geolocation capture at pool registration.
      captureLocationSnapshot(req, "pool_registration", userId).catch(() => {});
    } catch (error: any) {
      logger.error("Failed to register for event pool", {
        route: "/api/event-pools/:id/register",
        poolId: req.params.id,
        userId: (req.user as User | undefined)?.id,
        code: typeof error?.code === "string" ? error.code : undefined,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error?.code === "23505" || error?.cause?.code === "23505") {
        return res.status(400).json({ message: "You have already registered for this event pool" });
      }

      if (error instanceof Error && error.message === "No available event-pack credits remain") {
        return res.status(403).json({
          message: "No available event-pack credits remain",
          requiresSubscription: true,
          requiresEventPack: true,
          code: "NO_AVAILABLE_EVENT_PACK_CREDITS",
        });
      }

      if (error instanceof Error && "validationErrors" in error) {
        return res.status(400).json({
          message: "Invalid registration payload",
          code: "REGISTRATION_FAILED",
        });
      }

      res.status(500).json({ 
        message: "Failed to register for event pool",
        code: "REGISTRATION_FAILED",
      });
    }
  });

  // Unified register-with-payment: creates payment + auto-registers on fulfillment.
  // For users who do NOT have an active subscription or event-pack credits.
  app.post("/api/event-pools/:poolId/register-with-payment", requireAuth, async (req, res) => {
    try {
      const poolId = req.params.poolId;
      const userId = getAuthenticatedUserId(req) as string;

      if (!getFeatureFlagSync("registrationEnabled", true)) {
        return res.status(503).json({
          message: "报名暂不可用，请稍后重试",
          code: "REGISTRATION_DISABLED",
        });
      }

      if (!(await getFeatureFlag("paymentsEnabled", false))) {
        return res.status(503).json({
          message: "支付功能暂不可用，请稍后重试",
          code: "PAYMENTS_DISABLED",
        });
      }

      const { invitationCode, values: validatedData } = buildEventPoolRegistrationInsert({
        poolId,
        userId,
        payload: req.body,
      });

      // Check if pool exists and is active
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId)
      });

      if (!pool) {
        return res.status(404).json({ message: "活动不存在" });
      }

      // Check duplicates
      const existingReg = await db.query.eventPoolRegistrations.findFirst({
        where: (regs: any, { eq, and }: any) => and(
          eq(regs.poolId, poolId),
          eq(regs.userId, userId)
        )
      });

      if (existingReg) {
        return res.status(400).json({ message: "你已经报名过这个活动了", code: "ALREADY_REGISTERED" });
      }

      // Check capacity
      const [registrationCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
          ),
        );

      const availability = describePoolRegistrationAvailability(
        {
          status: pool.status,
          registrationDeadline: pool.registrationDeadline,
          minGroupSize: pool.minGroupSize,
          maxGroupSize: pool.maxGroupSize,
          targetGroups: pool.targetGroups,
        },
        registrationCountRow?.count ?? 0,
      );

      if (!availability.allowed) {
        const messageMap: Record<string, string> = {
          POOL_CANCELLED: "该活动已取消",
          POOL_CLOSED: "该活动已停止报名",
          REGISTRATION_DEADLINE_PASSED: "报名已截止",
          POOL_FULL: "该活动已满员",
        };
        return res.status(availability.status).json({
          message: messageMap[availability.code] ?? availability.message,
          code: availability.code,
        });
      }

      // Get pricing from admin portal
      const testPrice = getTestPriceCents();
      let originalAmount: number;
      if (testPrice !== null) {
        originalAmount = testPrice;
      } else {
        const pricing = await storage.getActivePricingSettings().catch(() => []);
        const eventSinglePlan = pricing.find((item: any) => item.planType === "event_single");
        originalAmount = eventSinglePlan?.priceInCents ?? 8800;
      }

      // Validate optional coupon code
      let couponId: string | undefined;
      const couponCode = typeof req.body?.couponCode === "string" ? req.body.couponCode.trim() : "";
      if (couponCode) {
        const couponValidation = await resolveCouponValidation(userId, couponCode, originalAmount);
        if (!couponValidation.valid) {
          return res.status(400).json({ message: couponValidation.message, code: "INVALID_COUPON" });
        }
        couponId = couponValidation.couponId;
      }

      // Collect the full registration payload to store on the payment row
      const eventRegistrationPayload = {
        poolId,
        budgetRange: validatedData.budgetRange ?? [],
        preferredLanguages: validatedData.preferredLanguages ?? [],
        eventIntent: validatedData.eventIntent ?? [],
        cuisinePreferences: validatedData.cuisinePreferences ?? [],
        dietaryRestrictions: validatedData.dietaryRestrictions ?? [],
        tasteIntensity: validatedData.tasteIntensity ?? [],
        barThemes: validatedData.barThemes ?? [],
        alcoholComfort: validatedData.alcoholComfort ?? [],
        barBudgetRange: validatedData.barBudgetRange ?? [],
      };

      // Create WeChat Pay prepay via payment service
      const user = await storage.getUser(userId);
      const paymentOpenId = user?.wechatOpenId?.trim();
      if (!paymentOpenId) {
        return res.status(400).json({ message: "微信身份未绑定，请重新登录" });
      }

      const paymentResult = await paymentService.createMiniProgramPayment({
        userId,
        paymentType: "event",
        relatedId: poolId,
        originalAmount,
        couponId,
        eventRegistrationPayload,
        clientIp: req.ip || req.socket.remoteAddress || "127.0.0.1",
        openid: paymentOpenId,
      });

      logger.info("Register-with-payment payment created", {
        poolId,
        userId,
        paymentId: paymentResult.paymentId,
        wechatOrderId: paymentResult.wechatOrderId,
        originalAmount,
      });

      res.json({
        paymentId: paymentResult.paymentId,
        wechatOrderId: paymentResult.wechatOrderId,
        timeStamp: paymentResult.timeStamp,
        nonceStr: paymentResult.nonceStr,
        package: paymentResult.package,
        signType: paymentResult.signType,
        paySign: paymentResult.paySign,
        outTradeNo: paymentResult.wechatOrderId,
      });
    } catch (error: any) {
      logger.error("Failed to create register-with-payment", {
        route: "/api/event-pools/:poolId/register-with-payment",
        poolId: req.params.poolId,
        userId: (req.user as User | undefined)?.id,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error?.code === "23505" || error?.cause?.code === "23505") {
        return res.status(400).json({ message: "你已经报名过这个活动了", code: "ALREADY_REGISTERED" });
      }

      res.status(500).json({
        message: "支付创建失败，请稍后重试",
        code: "PAYMENT_CREATION_FAILED",
      });
    }
  });

  // Get user's pool registrations
  app.get("/api/my-pool-registrations", requireAuth, async (req, res) => {
    try {
      const anyReq = req as any;
      const session = anyReq.session;
      const reqUser = anyReq.user;

      // 尽量兼容不同的 user 存放方式：req.user / session.userId / session.user.id
      const userId: string | undefined =
        reqUser?.id ||
        session?.userId ||
        session?.user?.id;

      console.log("[MyPoolRegistrations] identity debug:", {
        hasReqUser: !!reqUser,
        hasSession: !!session,
        sessionUserId: session?.userId,
        sessionUser: session?.user,
        finalUserId: userId,
      });

      if (!userId) {
        console.error("[MyPoolRegistrations] No user on request/session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("[MyPoolRegistrations] fetching registrations for userId:", userId);

      const registrations = await db
        .select({
          id: eventPoolRegistrations.id,
          poolId: eventPoolRegistrations.poolId,
          budgetRange: eventPoolRegistrations.budgetRange,
          preferredLanguages: eventPoolRegistrations.preferredLanguages,
          eventIntent: eventPoolRegistrations.eventIntent,
          matchStatus: eventPoolRegistrations.matchStatus,
          assignedGroupId: eventPoolRegistrations.assignedGroupId,
          matchScore: eventPoolRegistrations.matchScore,
          registeredAt: eventPoolRegistrations.registeredAt,
          // Pool details
          poolTitle: eventPools.title,
          poolEventType: eventPools.eventType,
          poolCity: eventPools.city,
          poolDistrict: eventPools.district,
          poolDateTime: eventPools.dateTime,
          poolStatus: eventPools.status,
          theme: eventPoolGroups.theme,
          subtitle: eventPoolGroups.subtitle,
          vibe: eventPoolGroups.vibe,
          themeEmoji: eventPoolGroups.themeEmoji,
          highlights: eventPoolGroups.themeHighlights,
          venueName: eventPoolGroups.venueName,
          venueAddress: eventPoolGroups.venueAddress,
          finalDateTime: eventPoolGroups.finalDateTime,
        })
        .from(eventPoolRegistrations)
        .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
        .leftJoin(eventPoolGroups, eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id))
        .where(eq(eventPoolRegistrations.userId, userId))
        .orderBy(desc(eventPoolRegistrations.registeredAt));

      console.log("[MyPoolRegistrations] base registrations count:", registrations.length);

      const registrationIds = (registrations as any[]).map((registration: any) => registration.id);
      const registrationPoolIds = Array.from(
        new Set((registrations as any[]).map((registration: any) => registration.poolId)),
      );

      const inviteUses = registrationIds.length > 0
        ? await db
            .select({
              poolRegistrationId: invitationUses.poolRegistrationId,
              invitationId: invitationUses.invitationId,
              inviteeId: invitationUses.inviteeId,
            })
            .from(invitationUses)
            .where(inArray(invitationUses.poolRegistrationId, registrationIds))
        : [];

      const inviteUseByRegistrationId = new Map<
        string,
        { poolRegistrationId: string; invitationId: string | null; inviteeId: string | null }
      >(
        inviteUses.map((inviteUse: {
          poolRegistrationId: string;
          invitationId: string | null;
          inviteeId: string | null;
        }) => [inviteUse.poolRegistrationId, inviteUse]),
      );

      const invitationIds = Array.from(
        new Set(
          inviteUses
            .map((inviteUse: { invitationId: string | null }) => inviteUse.invitationId)
            .filter((invitationId: string | null): invitationId is string => Boolean(invitationId)),
        ),
      );

      const invitationRows = invitationIds.length > 0
        ? await db
            .select({
              id: invitations.id,
              code: invitations.code,
              inviterId: invitations.inviterId,
            })
            .from(invitations)
            .where(inArray(invitations.id, invitationIds as string[]))
        : [];

      const invitationById = new Map<string, { id: string; code: string; inviterId: string }>(
        invitationRows.map((invitation: { id: string; code: string; inviterId: string }) => [invitation.id, invitation]),
      );

      const userInvitations = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(eq(invitations.inviterId, userId))
        .limit(10);

      const userInvitationIds = userInvitations.map((invitation: { id: string }) => invitation.id);

      const relatedInviteUses = userInvitationIds.length > 0 && registrationPoolIds.length > 0
        ? await db
            .select({
              invitationId: invitationUses.invitationId,
              inviteeId: invitationUses.inviteeId,
              poolId: eventPoolRegistrations.poolId,
            })
            .from(invitationUses)
            .innerJoin(
              eventPoolRegistrations,
              eq(invitationUses.poolRegistrationId, eventPoolRegistrations.id),
            )
            .where(
              and(
                inArray(invitationUses.invitationId, userInvitationIds),
                inArray(eventPoolRegistrations.poolId, registrationPoolIds),
              ),
            )
        : [];

      const relatedInviteUseByPoolId = new Map<string, { inviteeId: string | null }>();
      for (const relatedInviteUse of relatedInviteUses) {
        if (!relatedInviteUseByPoolId.has(relatedInviteUse.poolId)) {
          relatedInviteUseByPoolId.set(relatedInviteUse.poolId, {
            inviteeId: relatedInviteUse.inviteeId,
          });
        }
      }

      const relatedUserIds = Array.from(
        new Set(
          [
            ...invitationRows.map((invitation: { inviterId: string }) => invitation.inviterId),
            ...Array.from(relatedInviteUseByPoolId.values()).map((inviteUse) => inviteUse.inviteeId),
          ].filter((candidate): candidate is string => Boolean(candidate)),
        ),
      );

      const relatedUsers = relatedUserIds.length > 0
        ? await db
            .select({
              id: users.id,
              displayName: users.displayName,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(inArray(users.id, relatedUserIds))
        : [];

      const relatedUserMap = new Map<string, string>(
        relatedUsers.map((relatedUser: {
          id: string;
          displayName: string | null;
          firstName: string | null;
          lastName: string | null;
        }) => [
          relatedUser.id,
          relatedUser.displayName ||
            `${relatedUser.firstName || ""} ${relatedUser.lastName || ""}`.trim() ||
            "好友",
        ]),
      );

      const enrichedRegistrations = (registrations as any[]).map((reg: any) => {
        const inviteUse = inviteUseByRegistrationId.get(reg.id);
        let invitationRole: "inviter" | "invitee" | null = null;
        let relatedUserName: string | null = null;

        if (inviteUse?.invitationId) {
          const invitation = invitationById.get(inviteUse.invitationId);
          if (invitation?.inviterId) {
            invitationRole = "invitee";
            relatedUserName = relatedUserMap.get(invitation.inviterId) ?? "好友";
          }
        } else {
          const relatedInviteUse = relatedInviteUseByPoolId.get(reg.poolId);
          if (relatedInviteUse?.inviteeId) {
            invitationRole = "inviter";
            relatedUserName = relatedUserMap.get(relatedInviteUse.inviteeId) ?? "好友";
          }
        }

        return {
          ...reg,
          highlights: Array.isArray(reg.highlights) ? reg.highlights : [],
          invitationRole,
          relatedUserName,
        };
      });

      console.log("[MyPoolRegistrations] enriched registrations:", enrichedRegistrations);

      res.json(enrichedRegistrations);
    } catch (error) {
      console.error("Error fetching user pool registrations:", error);
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });


    // 取消盲盒报名（从活动池中移除当前用户的报名记录）
    app.delete('/api/pool-registrations/:id', requireAuth, async (req: any, res) => {
      try {
        console.log('[MyPoolRegistrationsCancel] route hit for /api/pool-registrations/:id', {
          method: req.method,
          originalUrl: req.originalUrl,
          params: req.params,
          sessionUserId: req.session?.userId,
        });

        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        if (!userId) {
          console.error('[MyPoolRegistrationsCancel] No userId in session');
          return res.status(401).json({ message: 'Unauthorized' });
        }

        console.log('[MyPoolRegistrationsCancel] attempting to delete registration', {
          userId,
          registrationId: id,
        });

        // 1) 删除当前用户在这个报名记录上的 row
        let deletedRegistrations = await db
          .delete(eventPoolRegistrations)
          .where(
            and(
              eq(eventPoolRegistrations.id, id),
              eq(eventPoolRegistrations.userId, userId),
            )
          )
          .returning();

        if (deletedRegistrations.length === 0) {
          console.warn('[MyPoolRegistrationsCancel] no registration found to delete', {
            userId,
            registrationId: id,
          });
          return res.status(404).json({
            message: '没有找到可以取消的报名记录，可能已经取消过了',
          });
        }

        console.log('[MyPoolRegistrationsCancel] deleted registrations:', {
          count: deletedRegistrations.length,
          ids: deletedRegistrations.map((r: any) => r.id),
          poolIds: deletedRegistrations.map((r: any) => r.poolId),
        });

        // 2) 对每个受影响的池子，把 totalRegistrations - 1
        for (const reg of deletedRegistrations) {
          if (reg.poolId) {
            await db
              .update(eventPools)
              .set({
                totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
                updatedAt: new Date(),
              })
              .where(eq(eventPools.id, reg.poolId));
          }
        }

        console.log('[MyPoolRegistrationsCancel] updated pools after deletion');

        return res.json({
          ok: true,
          cancelledRegistrationIds: (deletedRegistrations as any[]).map((r: any) => r.id),
        });
      } catch (error) {
        console.error('[MyPoolRegistrationsCancel] error while cancelling registration', error);
        return res.status(500).json({ message: 'Failed to cancel pool registration' });
      }
    });

    // Get pool group details (members + activity info)
    app.get("/api/pool-groups/:groupId", requireAuth, async (req, res) => {
      try {
        const groupId = req.params.groupId;
        const userId = (req.session as any).userId as string;

        // Get group info
        const group = await db.query.eventPoolGroups.findFirst({
          where: (groups: any, { eq }: any) => eq(groups.id, groupId),
        });

        if (!group) {
          return res.status(404).json({ message: "Group not found" });
        }

        // Get pool info
        const pool = await db.query.eventPools.findFirst({
          where: (pools: any, { eq }: any) => eq(pools.id, group.poolId),
        });

        if (!pool) {
          return res.status(404).json({ message: "Event pool not found" });
        }

        // Check if user is in this group
        const userRegistration = await db.query.eventPoolRegistrations.findFirst({
          where: (regs: any, { eq, and }: any) => and(
            eq(regs.assignedGroupId, groupId),
            eq(regs.userId, userId)
          ),
        });

        if (!userRegistration) {
          return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Get all group members with their profile info
        const members = await db
          .select({
            userId: users.id,
            displayName: users.displayName,
            archetype: users.archetype,
            topInterests: users.interestsRankedTop3,
            birthdate: users.birthdate,
            // UPDATED: Use 3-tier industry classification
            industryNicheLabel: users.industryNicheLabel,
            industryCategoryLabel: users.industryCategoryLabel,
            ageVisible: users.ageVisibility,
            industryVisible: users.workVisibility,
            gender: users.gender,
            educationLevel: users.educationLevel,
            hometownRegionCity: users.hometownRegionCity,
            hometownAffinityOptin: users.hometownAffinityOptin,
            educationVisible: users.educationVisibility,
            relationshipStatus: users.relationshipStatus,
            // Event-specific preferences from registration
            intent: eventPoolRegistrations.eventIntent,
          })
          .from(eventPoolRegistrations)
          .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
          .where(eq(eventPoolRegistrations.assignedGroupId, groupId));

        const memberSummaries = members.map((member: (typeof members)[number]) => ({
          userId: member.userId,
          displayName: member.displayName,
          archetype: member.archetype,
          topInterests: member.topInterests,
          ageLabel: formatAge(member.birthdate, member.ageVisible ?? 'hide_all'),
          industryNicheLabel: member.industryNicheLabel,
          industryCategoryLabel: member.industryCategoryLabel,
          ageVisible: member.ageVisible !== 'hide_all',
          industryVisible: member.industryVisible !== 'hide_all',
          gender: member.gender,
          educationLevel: member.educationLevel,
          hometownRegionCity: member.hometownRegionCity,
          hometownAffinityOptin: member.hometownAffinityOptin,
          educationVisible: member.educationVisible !== 'hide_all',
          relationshipStatus: member.relationshipStatus,
          intent: member.intent,
        }));

        res.json({
          group: {
            id: group.id,
            groupNumber: group.groupNumber,
            memberCount: group.memberCount,
            matchScore: group.overallScore,
            avgPairScore: group.avgChemistryScore, // stored as avgChemistryScore in DB (= avgPairScore)
            diversityScore: group.diversityScore,
            energyBalance: group.energyBalance,
            matchExplanation: group.matchExplanation,
            theme: group.theme,
            subtitle: group.subtitle,
            vibe: group.vibe,
            themeEmoji: group.themeEmoji,
            highlights: Array.isArray(group.themeHighlights) ? group.themeHighlights : [],
            venueName: group.venueName,
            venueAddress: group.venueAddress,
            venueAssignmentStatus: group.venueAssignmentStatus,
            venueAssignmentReason: group.venueAssignmentReason,
            finalDateTime: group.finalDateTime,
            status: group.status,
          },
          pool: {
            id: pool.id,
            title: pool.title,
            description: pool.description,
            eventType: pool.eventType,
            city: pool.city,
            district: pool.district,
            dateTime: pool.dateTime,
          },
          members: memberSummaries,
        });
      } catch (error) {
        console.error("Error fetching pool group details:", error);
        res.status(500).json({ message: "Failed to fetch group details" });
      }
    });

    // Get AI-generated group analysis for a pool group
    app.get('/api/pool-groups/:groupId/analysis', requireAuth, aiEndpointLimiter, async (req, res) => {
      const { groupId } = req.params;
      const userId = (req.session as any).userId as string;

      try {
        // Load group from DB
        const group = await db.query.eventPoolGroups.findFirst({
          where: eq(eventPoolGroups.id, groupId),
        });
        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }

        // Load pool for eventType context
        const pool = await db.query.eventPools.findFirst({
          where: eq(eventPools.id, group.poolId),
        });

        // Check if user is in this group
        const userRegistration = await db.query.eventPoolRegistrations.findFirst({
          where: and(
            eq(eventPoolRegistrations.userId, userId),
            eq(eventPoolRegistrations.assignedGroupId, groupId)
          ),
        });

        if (!userRegistration) {
          return res.status(403).json({ error: 'Not a member of this group' });
        }

        // Load all group registrations to get member IDs
        const groupRegistrations = await db.query.eventPoolRegistrations.findMany({
          where: eq(eventPoolRegistrations.assignedGroupId, groupId),
        });

        const memberIds = groupRegistrations.map((r: any) => r.userId as string);

        if (memberIds.length === 0) {
          return res.status(404).json({ error: 'Group has no members' });
        }

        // Load full user profiles for all members
        const memberProfiles = await db.query.users.findMany({
          where: inArray(users.id, memberIds),
        });

        // Load user interests (with heat levels) for deep interest overlap detection
        const memberInterestsRows = await db.query.userInterests.findMany({
          where: inArray(userInterests.userId, memberIds),
        }) as Array<{
          userId: string;
          selections: Array<{ topicId: string; level?: number | null }> | null;
        }>;
        const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);
        const interestsByUserId = new Map(
          memberInterestsRows.map((row) => [row.userId, row] as const)
        );

        // Build MatchMember[] using the same field mapping as the existing handler
        const members = memberProfiles.map((m: any) => {
          const interestRow = interestsByUserId.get(m.id);
          const interestsWithHeat = interestRow?.selections
            ? interestRow.selections.map(
                (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
              )
            : null;
          // Prefer interestsRankedTop3; fall back to top heat-sorted selections; then legacy field
          const interestsTop =
            Array.isArray(m.interestsRankedTop3) && m.interestsRankedTop3.length > 0
              ? m.interestsRankedTop3
              : interestsWithHeat
              ? interestsWithHeat
                  .slice()
                  .sort((a: { heatLevel: number }, b: { heatLevel: number }) => b.heatLevel - a.heatLevel)
                  .slice(0, 3)
                  .map((s: { topicId: string }) => s.topicId)
              : m.interestsTop;
          return {
            userId: m.id,
            displayName: m.displayName || '神秘嘉宾',
            archetype: m.archetype,
            secondaryArchetype: m.secondaryArchetype,
            interestsTop,
            industry: m.industryNicheLabel || m.industryCategoryLabel,
            hometown: m.hometownRegionCity,
            socialStyle: m.socialStyle,
            educationLevel: m.educationLevel,
            relationshipStatus: m.relationshipStatus,
            workMode: m.workMode,
            industryCategory: m.industryCategory,
            industryCategoryLabel: m.industryCategoryLabel,
            interestsWithHeat,
            interestSignals: interestSignalsByUserId.get(m.id) ?? null,
          };
        });

        const { generateGroupAnalysis, getPairExplanationForUser } = await import('../../matchExplanationService');

        // Call the existing service with caching enabled
        const analysis = await generateGroupAnalysis(
          groupId,
          members,
          pool?.eventType ?? '饭局',
          true
        );

        // Helper: map an internal PairExplanation to the shared response type
        const mapPe = (pe: {
          pairKey: string;
          explanation: string;
          chemistryScore: number;
          sharedInterests?: string[];
          connectionPoints?: string[];
          introAngle?: string;
        }) => ({
          pairKey: pe.pairKey,
          explanation: pe.explanation,
          chemistryScore: pe.chemistryScore,
          sharedInterests: pe.sharedInterests ?? [],
          connectionPoints: pe.connectionPoints ?? [],
          ...(pe.introAngle ? { introAngle: pe.introAngle } : {}),
        });

        // Map internal GroupAnalysis → GroupAnalysisResponse
        const response: GroupAnalysisResponse = {
          groupId,
          overallChemistry: analysis.overallChemistry as GroupAnalysisResponse['overallChemistry'],
          groupDynamics: analysis.groupDynamics,
          iceBreakers: analysis.iceBreakers,
          pairExplanations: analysis.pairExplanations.map(mapPe),
          fromCache: analysis.fromCache ?? false,
          generatedAt: analysis.generatedAt ?? new Date().toISOString(),
          provider: analysis.provider ?? null,
          fallbackUsed: analysis.fallbackUsed ?? false,
          promptVersion: analysis.promptVersion,
          meta: {
            generatedAt: analysis.generatedAt ?? new Date().toISOString(),
            fromCache: analysis.fromCache ?? false,
            provider: analysis.provider ?? null,
            fallbackUsed: analysis.fallbackUsed ?? false,
            promptVersion: analysis.promptVersion,
          },
          // Convenience field: pairs involving the authenticated viewer
          myPairs: getPairExplanationForUser(analysis, userId).map(mapPe),
          // Post-match theme layer
          groupThemeTags: analysis.groupThemeTags,
          groupThemeCompanion: analysis.groupThemeCompanion,
        };

        return res.json(response);
      } catch (error) {
        logger.error("Error generating group analysis:", { error: String(error), groupId });
        return res.status(500).json({ error: "Failed to generate analysis" });
      }
    });

    // Confirm attendance for a pool group
    app.post("/api/pool-groups/:groupId/confirm-attendance", requireAuth, async (req, res) => {
      const groupId = req.params.groupId;
      const session = req.session as any;
      const userId = session?.userId;

      try {

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Verify the user is a member of this group
        const userRegistration = await db.query.eventPoolRegistrations.findFirst({
          where: (regs: any, { eq, and }: any) =>
            and(eq(regs.assignedGroupId, groupId), eq(regs.userId, userId)),
        });

        if (!userRegistration) {
          return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Look up the event pool to find a linked blind box event
        const group = await db.query.eventPoolGroups.findFirst({
          where: (groups: any, { eq }: any) => eq(groups.id, groupId),
        });

        let blindBoxEventId: string | null = null;
        if (group?.poolId) {
          const linkedEvent = await db
            .select({ id: blindBoxEvents.id })
            .from(blindBoxEvents)
            .where(eq(blindBoxEvents.poolId, group.poolId))
            .limit(1);
          if (linkedEvent.length > 0) {
            blindBoxEventId = linkedEvent[0].id;
          }
        }

        if (!blindBoxEventId) {
          return res.status(409).json({
            message: "当前活动暂未开放确认出席，请稍后再试",
            code: "ATTENDANCE_NOT_READY",
          });
        }

        // Idempotency: if already confirmed, return clean 200 without DB write or re-broadcast.
        const currentAttendance = await storage.getAttendanceStatus(blindBoxEventId, userId);
        if (currentAttendance?.status === 'confirmed') {
          return res.json({ success: true, blindBoxEventId, attendanceStatus: 'confirmed' });
        }

        await storage.updateAttendanceStatus(blindBoxEventId, userId, 'confirmed');

        const user = await storage.getUser(userId);
        const displayName = getUserDisplayName(user);
        broadcastAttendanceStatusUpdated(blindBoxEventId, userId, displayName, 'confirmed');

        res.json({ success: true, blindBoxEventId, attendanceStatus: 'confirmed' });
      } catch (error) {
        logger.error("Error confirming pool group attendance:", { error: String(error), groupId, userId });
        res.status(500).json({ message: "Failed to confirm attendance" });
      }
    });
    app.get("/api/admin/finance/stats", requireAdmin, async (req, res) => {
      try {
        const stats = await storage.getFinanceStats();
        res.json(stats);
      } catch (error) {
        console.error("Error fetching finance stats:", error);
        res.status(500).json({ message: "Failed to fetch finance stats" });
      }
    });

    // Finance - Get all payments
    app.get("/api/admin/finance/payments", requireAdmin, async (req, res) => {
      try {
        const { type } = req.query;
        const payments = type
          ? await storage.getPaymentsByType(type as string)
          : await storage.getAllPayments();
        res.json(payments);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    });

    // Finance - Get venue commissions
    app.get("/api/admin/finance/commissions", requireAdmin, async (req, res) => {
      try {
        const commissions = await storage.getVenueCommissions();
        res.json(commissions);
      } catch (error) {
        console.error("Error fetching commissions:", error);
        res.status(500).json({ message: "Failed to fetch commissions" });
      }
    });

    // Moderation - Get statistics
    app.get("/api/admin/moderation/stats", requireAdmin, async (req, res) => {
      try {
        const stats = await storage.getModerationStats();
        res.json(stats);
      } catch (error) {
        console.error("Error fetching moderation stats:", error);
        res.status(500).json({ message: "Failed to fetch moderation stats" });
      }
    });

    // Moderation - Get all reports
    app.get("/api/admin/moderation/reports", requireAdmin, async (req, res) => {
      try {
        const { status } = req.query;
        const reports = status === 'pending'
          ? await storage.getPendingReports()
          : await storage.getAllReports();
        res.json(reports);
      } catch (error) {
        console.error("Error fetching reports:", error);
        res.status(500).json({ message: "Failed to fetch reports" });
      }
    });

    // Moderation - Update report status
    app.patch("/api/admin/moderation/reports/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
      try {
        const { status, adminNotes } = req.body;
        const report = await storage.updateReportStatus(req.params.id, status, adminNotes);
        res.json(report);
      } catch (error) {
        console.error("Error updating report:", error);
        res.status(500).json({ message: "Failed to update report" });
      }
    });

    // Moderation - Create moderation log
    app.post("/api/admin/moderation/logs", requireAdmin, requireOperatorOrAbove, async (req, res) => {
      try {
        const session = req.session as any;
        const log = await storage.createModerationLog({
          adminId: session.userId,
          action: req.body.action,
          targetUserId: req.body.targetUserId,
          reason: req.body.reason,
          notes: req.body.notes,
        });
        res.json(log);
      } catch (error) {
        console.error("Error creating moderation log:", error);
        res.status(500).json({ message: "Failed to create moderation log" });
      }
    });

    // Moderation - Get moderation logs
    app.get("/api/admin/moderation/logs", requireAdmin, async (req, res) => {
      try {
        const logs = await storage.getModerationLogs();
        res.json(logs);
      } catch (error) {
        console.error("Error fetching moderation logs:", error);
        res.status(500).json({ message: "Failed to fetch moderation logs" });
      }
    });

    // Data Insights - Get analytics data
    app.get("/api/admin/insights", requireAdmin, async (req, res) => {
      try {
        const insights = await storage.getInsightsData();
        res.json(insights);
      } catch (error) {
        console.error("Error fetching insights:", error);
        res.json(createEmptyInsightsData());
      }
    });

    // Registration Funnel Analytics - Get registration funnel data
    app.get("/api/admin/insights/registration-funnel", requireAdmin, async (req, res) => {
      try {
        const { getRegistrationFunnelData } = await import('../../analytics/registrationFunnelAnalytics');
        const funnelData = await getRegistrationFunnelData();
        res.json(funnelData);
      } catch (error) {
        console.error("Error fetching registration funnel data:", error);
        res.status(500).json({ message: "Failed to fetch registration funnel data" });
      }
    });
}
