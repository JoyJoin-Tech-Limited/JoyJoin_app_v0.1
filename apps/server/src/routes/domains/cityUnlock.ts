import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  userCityInterests,
  cityUnlockProgress,
  users,
} from "@shared/schema";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import { notifyCityUnlockThreshold } from "../../lib/wecomNotifier";

// ─── Validation schemas ───────────────────────────────────────────

const recordInterestSchema = z.object({
  city: z.string().min(1).max(50),
  source: z.enum(["floating_banner", "feed_card", "profile", "share"]).default("floating_banner"),
});

// ─── Helpers ──────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getAuthenticatedUserId(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

async function getOrCreateCityProgress(city: string) {
  const existing = await db
    .select()
    .from(cityUnlockProgress)
    .where(eq(cityUnlockProgress.city, city))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(cityUnlockProgress)
    .values({ city, interestedCount: 0, targetThreshold: 50, status: "collecting" })
    .returning();

  return created;
}

async function incrementCityInterestedCount(city: string) {
  // Atomic increment using SQL expression — safe under concurrent requests
  const [updated] = await db
    .update(cityUnlockProgress)
    .set({
      interestedCount: sql`${cityUnlockProgress.interestedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(cityUnlockProgress.city, city))
    .returning();

  if (!updated) {
    // Race: row was deleted between getOrCreate and update; recreate
    await getOrCreateCityProgress(city);
    return incrementCityInterestedCount(city);
  }

  // Check threshold crossing (second update is still racy but extremely low blast radius)
  if (updated.status === "collecting" && updated.interestedCount >= updated.targetThreshold) {
    const [transitioned] = await db
      .update(cityUnlockProgress)
      .set({ status: "researching", notifiedAt: new Date() })
      .where(and(
        eq(cityUnlockProgress.city, city),
        eq(cityUnlockProgress.status, "collecting")
      ))
      .returning();

    if (transitioned) {
      // Notify ops team via WeCom
      void notifyCityUnlockThreshold(city, updated.interestedCount, updated.targetThreshold);
    }
  }

  return updated;
}

async function decrementCityInterestedCount(city: string) {
  // Atomic decrement with floor at 0
  const [updated] = await db
    .update(cityUnlockProgress)
    .set({
      interestedCount: sql`GREATEST(${cityUnlockProgress.interestedCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(cityUnlockProgress.city, city))
    .returning();

  if (!updated) {
    await getOrCreateCityProgress(city);
    return decrementCityInterestedCount(city);
  }

  return updated;
}

// ─── Routes ───────────────────────────────────────────────────────

export function registerCityUnlockRoutes(app: Express): void {
  // POST /api/cities/interest — Record user's city interest
  app.post("/api/cities/interest", requireAuth, async (req: Request, res) => {
    try {
      const parsed = recordInterestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.format() });
      }

      const userId = req.session.userId!;
      const { city, source } = parsed.data;

      // Upsert city interest
      const existing = await db
        .select()
        .from(userCityInterests)
        .where(and(
          eq(userCityInterests.userId, userId),
          eq(userCityInterests.city, city)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update timestamp and source
        await db
          .update(userCityInterests)
          .set({ updatedAt: new Date(), source })
          .where(eq(userCityInterests.id, existing[0].id));

        return res.json({
          success: true,
          alreadyRegistered: true,
          city,
        });
      }

      // Insert new interest
      await db.insert(userCityInterests).values({
        userId,
        city,
        source,
      });

      // Increment city count
      const progress = await incrementCityInterestedCount(city);

      res.json({
        success: true,
        alreadyRegistered: false,
        city,
        progress: {
          interestedCount: progress.interestedCount,
          targetThreshold: progress.targetThreshold,
          status: progress.status,
        },
      });
    } catch (err) {
      logger.error("Failed to record city interest", { err });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/cities/progress — Get all cities' unlock progress (public)
  app.get("/api/cities/progress", async (_req, res) => {
    try {
      const progress = await db
        .select()
        .from(cityUnlockProgress)
        .orderBy(desc(cityUnlockProgress.interestedCount));

      res.json({
        cities: progress.map((p: typeof cityUnlockProgress.$inferSelect) => ({
          city: p.city,
          interestedCount: p.interestedCount,
          targetThreshold: p.targetThreshold,
          status: p.status,
          progressPercent: Math.min(100, Math.round((p.interestedCount / p.targetThreshold) * 100)),
        })),
      });
    } catch (err) {
      logger.error("Failed to get city progress", { err });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/cities/my-interests — Get current user's interested cities
  app.get("/api/cities/my-interests", requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId!;

      const interests = await db
        .select()
        .from(userCityInterests)
        .where(eq(userCityInterests.userId, userId))
        .orderBy(desc(userCityInterests.createdAt));

      // Fetch progress for each interested city
      const cityNames = interests.map((i: typeof userCityInterests.$inferSelect) => i.city);
      const progress = cityNames.length > 0
        ? await db
            .select()
            .from(cityUnlockProgress)
            .where(inArray(cityUnlockProgress.city, cityNames))
        : [];

      const progressMap = new Map<string, typeof cityUnlockProgress.$inferSelect>(
        progress.map((p: typeof cityUnlockProgress.$inferSelect) => [p.city, p])
      );

      res.json({
        interests: interests.map((i: typeof userCityInterests.$inferSelect) => {
          const p = progressMap.get(i.city);
          return {
            city: i.city,
            source: i.source,
            createdAt: i.createdAt,
            progress: p
              ? {
                  interestedCount: p.interestedCount,
                  targetThreshold: p.targetThreshold,
                  status: p.status,
                  progressPercent: Math.min(100, Math.round((p.interestedCount / p.targetThreshold) * 100)),
                }
              : null,
          };
        }),
      });
    } catch (err) {
      logger.error("Failed to get user city interests", { err });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // DELETE /api/cities/interest/:city — Remove user's city interest
  app.delete("/api/cities/interest/:city", requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId!;
      const city = req.params.city;

      if (!city || city.length > 50) {
        return res.status(400).json({ message: "Invalid city" });
      }

      const existing = await db
        .select()
        .from(userCityInterests)
        .where(and(
          eq(userCityInterests.userId, userId),
          eq(userCityInterests.city, city)
        ))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: "City interest not found" });
      }

      await db
        .delete(userCityInterests)
        .where(eq(userCityInterests.id, existing[0].id));

      // Decrement city count
      await decrementCityInterestedCount(city);

      res.json({ success: true, city });
    } catch (err) {
      logger.error("Failed to remove city interest", { err });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/admin/cities/unlock-report — Admin dashboard data
  app.get("/api/admin/cities/unlock-report", requireAuth, async (req: Request, res) => {
    try {
      // Basic admin check
      const userId = req.session.userId!;
      const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!userRows.length || !["admin", "super_admin"].includes(userRows[0].role ?? "")) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const progress = await db
        .select()
        .from(cityUnlockProgress)
        .orderBy(desc(cityUnlockProgress.interestedCount));

      // Get recent sign-ups per city
      const cityNames = progress.map((p: typeof cityUnlockProgress.$inferSelect) => p.city);
      const recentSignups = cityNames.length > 0
        ? await db
            .select({
              city: userCityInterests.city,
              count: sql<number>`count(*)`,
            })
            .from(userCityInterests)
            .where(
              and(
                inArray(userCityInterests.city, cityNames),
                sql`${userCityInterests.createdAt} > now() - interval '7 days'`
              )
            )
            .groupBy(userCityInterests.city)
        : [];

      const recentMap = new Map(recentSignups.map((r: { city: string; count: number }) => [r.city, r.count]));

      res.json({
        cities: progress.map((p: typeof cityUnlockProgress.$inferSelect) => ({
          city: p.city,
          interestedCount: p.interestedCount,
          targetThreshold: p.targetThreshold,
          status: p.status,
          progressPercent: Math.min(100, Math.round((p.interestedCount / p.targetThreshold) * 100)),
          recentSignups7d: recentMap.get(p.city) ?? 0,
          notifiedAt: p.notifiedAt,
          launchedAt: p.launchedAt,
          createdAt: p.createdAt,
        })),
      });
    } catch (err) {
      logger.error("Failed to get admin city unlock report", { err });
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
