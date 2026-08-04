import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import {
  eventPools,
  eventPoolRegistrations,
  users,
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { createRateLimiter } from "../../rateLimiter";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import {
  buildDefaultPreferencesFromArchetype,
  coerceStrictness,
  resolveEffectivePreferenceDNA,
  resolveTemperatureBand,
} from "../../lib/matchCompass";
import { pairMeetsDealbreakers } from "../../poolMatchingService";
import type { UserWithProfile } from "../../poolMatchingService";

const matchCompassPreferenceSchema = z.object({
  strictness: z.number().min(0).max(100).optional(),
  preferredDistricts: z.array(z.string()).nullable().optional(),
  genderComposition: z.enum(["mixed", "female_only", "no_pref"]).nullable().optional(),
  acceptPairs: z.boolean().nullable().optional(),
  kolComfort: z.enum(["comfortable", "neutral", "avoid"]).nullable().optional(),
  ageMatchPreference: z.string().nullable().optional(),
  tableVibePreference: z.string().nullable().optional(),
});

const preferenceDNASchema = z.object({
  strictness: z.number().min(0).max(100).optional(),
  preferredDistricts: z.array(z.string()).nullable().optional(),
  genderComposition: z.enum(["mixed", "female_only", "no_pref"]).nullable().optional(),
  acceptPairs: z.boolean().nullable().optional(),
  kolComfort: z.enum(["comfortable", "neutral", "avoid"]).nullable().optional(),
});

const preferenceEditLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyPrefix: "pref",
});

function requireAuth(req: Request, res: Response): string | null {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return userId;
}

export function registerMatchCompassRoutes(app: Express): void {
  // GET /api/event-pools/:id/match-compass
  app.get("/api/event-pools/:id/match-compass", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const poolId = req.params.id;
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, poolId),
      });
      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const [registration] = await db
        .select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.userId, userId),
          ),
        )
        .limit(1);

      if (!registration) {
        return res.status(404).json({ message: "Registration not found" });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      // Pool composition: count pending registrations + archetype breakdown
      const pendingRegs = await db
        .select({
          userId: eventPoolRegistrations.userId,
          archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending"),
          ),
        );

      const totalPending = pendingRegs.length;
      const archetypeBreakdown: Record<string, number> = {};
      for (const row of pendingRegs) {
        const a = row.archetype || "未设置";
        archetypeBreakdown[a] = (archetypeBreakdown[a] || 0) + 1;
      }

      // Eligibility count: other pending users that pass dealbreakers at current strictness
      const strictness = coerceStrictness(registration.preferenceStrictness);
      const isStrictnessEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
      let eligibleCount = 0;

      if (isStrictnessEnabled && strictness < 50) {
        const viewerProfile: Partial<UserWithProfile> = {
          userId,
          gender: user?.gender ?? null,
          genderCompositionPreference: registration.genderCompositionPreference,
          preferenceStrictness: strictness,
          birthdate: user?.birthdate ?? null,
          industryNiche: user?.industryNiche ?? null,
          industryNicheLabel: user?.industryNicheLabel ?? null,
          industryCategoryLabel: user?.industryCategoryLabel ?? null,
          educationLevel: user?.educationLevel ?? null,
          archetype: user?.primaryArchetype ?? user?.archetype ?? null,
          secondaryArchetype: user?.secondaryArchetype ?? null,
          workMode: user?.workMode ?? null,
          hometown: user?.hometownRegionCity ?? null,
          hometownAffinityOptin: user?.hometownAffinityOptin ?? false,
          budgetRange: registration.budgetRange,
          barBudgetRange: registration.barBudgetRange,
          preferredLanguages: registration.preferredLanguages,
          eventIntent: registration.eventIntent,
          userIntent: user?.intent ?? null,
          cuisinePreferences: registration.cuisinePreferences,
          dietaryRestrictions: registration.dietaryRestrictions,
          barThemes: registration.barThemes,
          alcoholComfort: registration.alcoholComfort,
          eventType: pool.eventType,
          ageMatchPreference: user?.ageMatchPreference ?? null,
          tableVibePreference: user?.tableVibePreference ?? null,
        };

        // Batch load all candidate users and registrations to avoid N+1
        const candidateUserIds = pendingRegs
          .filter((r: { userId: string }) => r.userId !== userId)
          .map((r: { userId: string }) => r.userId);

        const otherUsers: (typeof users.$inferSelect)[] = candidateUserIds.length
          ? await db.select().from(users).where(inArray(users.id, candidateUserIds))
          : [];
        const otherRegs: (typeof eventPoolRegistrations.$inferSelect)[] = candidateUserIds.length
          ? await db
              .select()
              .from(eventPoolRegistrations)
              .where(
                and(
                  eq(eventPoolRegistrations.poolId, poolId),
                  inArray(eventPoolRegistrations.userId, candidateUserIds),
                ),
              )
          : [];

        const userMap = new Map(otherUsers.map((u) => [u.id, u]));
        const regMap = new Map(otherRegs.map((r) => [r.userId, r]));

        for (const other of pendingRegs) {
          if (other.userId === userId) continue;
          const otherUser = userMap.get(other.userId);
          if (!otherUser) continue;
          const otherReg = regMap.get(other.userId);

          const candidateProfile: Partial<UserWithProfile> = {
            userId: other.userId,
            gender: otherUser.gender ?? null,
            genderCompositionPreference: otherReg?.genderCompositionPreference ?? null,
            preferenceStrictness: coerceStrictness(otherReg?.preferenceStrictness),
            birthdate: otherUser.birthdate ?? null,
            industryNiche: otherUser.industryNiche ?? null,
            industryNicheLabel: otherUser.industryNicheLabel ?? null,
            industryCategoryLabel: otherUser.industryCategoryLabel ?? null,
            educationLevel: otherUser.educationLevel ?? null,
            archetype: otherUser.primaryArchetype ?? otherUser.archetype ?? null,
            secondaryArchetype: otherUser.secondaryArchetype ?? null,
            workMode: otherUser.workMode ?? null,
            hometown: otherUser.hometownRegionCity ?? null,
            hometownAffinityOptin: otherUser.hometownAffinityOptin ?? false,
            budgetRange: otherReg?.budgetRange ?? null,
            barBudgetRange: otherReg?.barBudgetRange ?? null,
            preferredLanguages: otherReg?.preferredLanguages ?? null,
            eventIntent: otherReg?.eventIntent ?? null,
            userIntent: otherUser.intent ?? null,
            cuisinePreferences: otherReg?.cuisinePreferences ?? null,
            dietaryRestrictions: otherReg?.dietaryRestrictions ?? null,
            barThemes: otherReg?.barThemes ?? null,
            alcoholComfort: otherReg?.alcoholComfort ?? null,
            eventType: pool.eventType,
            ageMatchPreference: otherUser.ageMatchPreference ?? null,
            tableVibePreference: otherUser.tableVibePreference ?? null,
          };

          if (
            pairMeetsDealbreakers(
              viewerProfile as UserWithProfile,
              candidateProfile as UserWithProfile,
              strictness,
            )
          ) {
            eligibleCount++;
          }
        }
      } else {
        eligibleCount = totalPending - 1; // exclude self
      }

      // Temperature band: proxy from registration count vitality
      const vitalityScore = Math.min(100, totalPending * 10);
      const temperature = resolveTemperatureBand(vitalityScore);

      const matchCompass = {
        strictness,
        preferredDistricts: registration.preferredDistricts,
        genderComposition: registration.genderCompositionPreference,
        acceptPairs: registration.acceptPairs,
        kolComfort: registration.kolComfortLevel,
        ageMatchPreference: user?.ageMatchPreference ?? null,
        tableVibePreference: user?.tableVibePreference ?? null,
      };

      return res.json({
        matchCompass,
        poolComposition: {
          totalPending,
          archetypeBreakdown,
          temperature,
          eligibleCount: Math.max(0, eligibleCount),
        },
        lockInfo: {
          locked: pool.preferenceLockAt ? new Date() >= new Date(pool.preferenceLockAt) : false,
          lockAt: pool.preferenceLockAt,
        },
      });
    } catch (error) {
      logger.error("[MatchCompass] GET failed", {
        poolId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to fetch match compass" });
    }
  });

  // PATCH /api/event-pool-registrations/:id/preferences
  app.patch(
    "/api/event-pool-registrations/:id/preferences",
    preferenceEditLimiter,
    async (req, res) => {
      try {
        const userId = requireAuth(req, res);
        if (!userId) return;

        const registrationId = req.params.id;
        const [registration] = await db
          .select()
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.id, registrationId))
          .limit(1);

        if (!registration) {
          return res.status(404).json({ message: "Registration not found" });
        }

        if (registration.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const [pool] = await db
          .select()
          .from(eventPools)
          .where(eq(eventPools.id, registration.poolId))
          .limit(1);

        if (!pool) {
          return res.status(404).json({ message: "Pool not found" });
        }

        if (pool.status !== "active") {
          return res.status(409).json({
            message: "Pool is not active",
            code: "pool_not_active",
          });
        }

        if (registration.matchStatus !== "pending") {
          return res.status(409).json({
            message: "Registration is not pending",
            code: "registration_not_pending",
          });
        }

        if (pool.preferenceLockAt && new Date() >= new Date(pool.preferenceLockAt)) {
          return res.status(409).json({
            message: "Preferences are locked",
            code: "preferences_locked",
          });
        }

        const parsed = matchCompassPreferenceSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
        }
        const body = parsed.data;
        const updates: Record<string, unknown> = {};
        const oldValues: Record<string, unknown> = {};

        if (body.strictness !== undefined) {
          oldValues.strictness = registration.preferenceStrictness;
          updates.preferenceStrictness = body.strictness;
        }

        if (body.preferredDistricts !== undefined) {
          oldValues.preferredDistricts = registration.preferredDistricts;
          updates.preferredDistricts = body.preferredDistricts ?? null;
        }

        if (body.genderComposition !== undefined) {
          oldValues.genderComposition = registration.genderCompositionPreference;
          updates.genderCompositionPreference = body.genderComposition ?? null;
        }

        if (body.acceptPairs !== undefined) {
          oldValues.acceptPairs = registration.acceptPairs;
          updates.acceptPairs = body.acceptPairs ?? null;
        }

        if (body.kolComfort !== undefined) {
          oldValues.kolComfort = registration.kolComfortLevel;
          updates.kolComfortLevel = body.kolComfort ?? null;
        }

        if (body.ageMatchPreference !== undefined) {
          oldValues.ageMatchPreference = registration.ageMatchPreference;
          // stored on user table, not registration; skip here
        }

        if (body.tableVibePreference !== undefined) {
          oldValues.tableVibePreference = registration.tableVibePreference;
          // stored on user table, not registration; skip here
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No valid fields to update" });
        }

        const [updated] = await db
          .update(eventPoolRegistrations)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(eventPoolRegistrations.id, registrationId))
          .returning();

        logger.info("[MatchCompass] Preference edited", {
          userId,
          poolId: pool.id,
          registrationId,
          changedFields: Object.keys(updates),
          oldValues,
          newValues: updates,
        });

        return res.json({
          ok: true,
          matchCompass: {
            strictness: coerceStrictness(updated.preferenceStrictness),
            preferredDistricts: updated.preferredDistricts,
            genderComposition: updated.genderCompositionPreference,
            acceptPairs: updated.acceptPairs,
            kolComfort: updated.kolComfortLevel,
          },
        });
      } catch (error) {
        logger.error("[MatchCompass] PATCH failed", {
          registrationId: req.params.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ message: "Failed to update preferences" });
      }
    },
  );

  // POST /api/event-pool-registrations/:id/preferences/reset
  app.post(
    "/api/event-pool-registrations/:id/preferences/reset",
    preferenceEditLimiter,
    async (req, res) => {
      try {
        const userId = requireAuth(req, res);
        if (!userId) return;

        const registrationId = req.params.id;
        const [registration] = await db
          .select()
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.id, registrationId))
          .limit(1);

        if (!registration) {
          return res.status(404).json({ message: "Registration not found" });
        }
        if (registration.userId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const [pool] = await db
          .select()
          .from(eventPools)
          .where(eq(eventPools.id, registration.poolId))
          .limit(1);

        if (pool?.status !== "active") {
          return res.status(409).json({ message: "Pool is not active", code: "pool_not_active" });
        }
        if (registration.matchStatus !== "pending") {
          return res.status(409).json({
            message: "Registration is not pending",
            code: "registration_not_pending",
          });
        }
        if (pool?.preferenceLockAt && new Date() >= new Date(pool.preferenceLockAt)) {
          return res.status(409).json({
            message: "Preferences are locked",
            code: "preferences_locked",
          });
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const dna = resolveEffectivePreferenceDNA({
          primaryArchetype: user?.primaryArchetype ?? null,
          archetype: user?.archetype ?? null,
          defaultPreferenceStrictness: user?.defaultPreferenceStrictness ?? null,
          defaultAcceptPairs: user?.defaultAcceptPairs ?? null,
          defaultGenderComposition: user?.defaultGenderComposition ?? null,
          defaultPreferredDistricts: user?.defaultPreferredDistricts ?? null,
          defaultKolComfort: user?.defaultKolComfort ?? null,
        });

        const [updated] = await db
          .update(eventPoolRegistrations)
          .set({
            preferenceStrictness: dna.strictness,
            preferredDistricts: dna.preferredDistricts,
            genderCompositionPreference: dna.genderComposition,
            acceptPairs: dna.acceptPairs,
            kolComfortLevel: dna.kolComfort,
            updatedAt: new Date(),
          })
          .where(eq(eventPoolRegistrations.id, registrationId))
          .returning();

        logger.info("[MatchCompass] Preferences reset to DNA", {
          userId,
          poolId: pool?.id,
          registrationId,
        });

        return res.json({
          ok: true,
          matchCompass: {
            strictness: coerceStrictness(updated.preferenceStrictness),
            preferredDistricts: updated.preferredDistricts,
            genderComposition: updated.genderCompositionPreference,
            acceptPairs: updated.acceptPairs,
            kolComfort: updated.kolComfortLevel,
          },
        });
      } catch (error) {
        logger.error("[MatchCompass] RESET failed", {
          registrationId: req.params.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ message: "Failed to reset preferences" });
      }
    },
  );

  // POST /api/users/me/preference-dna
  app.post("/api/users/me/preference-dna", async (req, res) => {
    try {
      const userId = requireAuth(req, res);
      if (!userId) return;

      const parsed = preferenceDNASchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      }
      const body = parsed.data;

      const updates: Record<string, unknown> = {};
      if (body.strictness !== undefined) {
        updates.defaultPreferenceStrictness = body.strictness;
      }
      if (body.preferredDistricts !== undefined) {
        updates.defaultPreferredDistricts = body.preferredDistricts;
      }
      if (body.genderComposition !== undefined) {
        updates.defaultGenderComposition = body.genderComposition;
      }
      if (body.acceptPairs !== undefined) {
        updates.defaultAcceptPairs = body.acceptPairs;
      }
      if (body.kolComfort !== undefined) {
        updates.defaultKolComfort = body.kolComfort;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      const [updated] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      logger.info("[MatchCompass] DNA saved", { userId, changedFields: Object.keys(updates) });

      return res.json({
        ok: true,
        dna: {
          strictness: updated.defaultPreferenceStrictness ?? 50,
          preferredDistricts: updated.defaultPreferredDistricts,
          genderComposition: updated.defaultGenderComposition,
          acceptPairs: updated.defaultAcceptPairs,
          kolComfort: updated.defaultKolComfort,
        },
      });
    } catch (error) {
      logger.error("[MatchCompass] DNA save failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to save preference DNA" });
    }
  });
}
