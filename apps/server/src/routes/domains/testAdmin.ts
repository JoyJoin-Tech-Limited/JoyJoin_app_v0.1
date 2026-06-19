import type { Express } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { requireAdmin } from "../../adminAuth";
import {
  createTestUser,
  createTestEventPool,
  registerTestUserToPool,
  resetTestData,
  getTestStatus,
} from "../../services/testAdminService";
import { getSessionByIcebreakerSessionId, updateSession } from "../../lib/socialIcebreakerStore";
import { generateSpeedFriendingPairs } from "../socialIcebreakerHelpers";
import { listParticipants } from "../../lib/socialIcebreakerStore";
import { db } from "../../db";
import { socialIcebreakerSessions } from "@shared/schema";

const createUserSchema = z.object({
  phoneNumber: z.string().min(5),
  password: z.string().min(4),
  displayName: z.string().min(1),
  gender: z.string().optional(),
  currentCity: z.string().optional(),
  archetype: z.string().optional(),
  hasCompletedProfileSetup: z.boolean().optional(),
  hasCompletedPersonalityTest: z.boolean().optional(),
});

const createPoolSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  eventType: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  dateTime: z.string().optional(),
  registrationDeadline: z.string().optional(),
  minGroupSize: z.number().int().optional(),
  maxGroupSize: z.number().int().optional(),
  targetGroups: z.number().int().optional(),
  createdBy: z.string().optional(),
});

const registerSchema = z.object({
  userId: z.string().min(1),
  poolId: z.string().min(1),
});

const forcePhaseSchema = z.object({
  phase: z.enum([
    "warmup",
    "micro_challenge",
    "lie_detective",
    "auction",
    "personality_dice",
    "quip_battle",
    "undercover_word",
    "group_mirror",
    "speed_friending",
    "mini_script",
    "recap",
  ]),
});

export function registerTestAdminRoutes(app: Express): void {
  app.get("/api/test/admin/status", (_req, res) => {
    getTestStatus()
      .then((status) => res.json(status))
      .catch((error) => {
        logger.error("[TestAdmin] status error", { error: String(error) });
        res.status(500).json({ message: "Failed to get test status" });
      });
  });

  app.post("/api/test/admin/users", async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const user = await createTestUser(parsed.data);
      logger.info("[TestAdmin] User created via API", { userId: user.id, phone: user.phoneNumber });
      res.status(201).json(user);
    } catch (error: any) {
      logger.error("[TestAdmin] create user error", { error: String(error) });
      res.status(500).json({ message: "Failed to create test user", error: error?.message });
    }
  });

  app.post("/api/test/admin/event-pools", async (req, res) => {
    try {
      const parsed = createPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const data = {
        ...parsed.data,
        dateTime: parsed.data.dateTime ? new Date(parsed.data.dateTime) : undefined,
        registrationDeadline: parsed.data.registrationDeadline ? new Date(parsed.data.registrationDeadline) : undefined,
      };

      const pool = await createTestEventPool(data);
      logger.info("[TestAdmin] Event pool created via API", { poolId: pool.id });
      res.status(201).json(pool);
    } catch (error: any) {
      logger.error("[TestAdmin] create pool error", { error: String(error) });
      res.status(500).json({ message: "Failed to create test event pool", error: error?.message });
    }
  });

  app.post("/api/test/admin/registrations", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      }

      const registration = await registerTestUserToPool(parsed.data.userId, parsed.data.poolId);
      if (!registration) {
        return res.status(409).json({ message: "Registration already exists or failed" });
      }

      res.status(201).json(registration);
    } catch (error: any) {
      logger.error("[TestAdmin] register error", { error: String(error) });
      res.status(500).json({ message: "Failed to register user to pool", error: error?.message });
    }
  });

  app.post("/api/test/admin/reset", async (_req, res) => {
    try {
      const result = await resetTestData();
      logger.info("[TestAdmin] Data reset via API", result);
      res.json({ message: "Test data reset complete", ...result });
    } catch (error: any) {
      logger.error("[TestAdmin] reset error", { error: String(error) });
      res.status(500).json({ message: "Failed to reset test data", error: error?.message });
    }
  });

  app.post("/api/test/social-icebreaker/:icebreakerSessionId/force-phase", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Forbidden - not available in production" });
    }

    const { icebreakerSessionId } = req.params;
    const parsed = forcePhaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid phase", errors: parsed.error.issues });
    }

    const { phase: targetPhase } = parsed.data;

    try {
      const existing = await getSessionByIcebreakerSessionId(icebreakerSessionId);
      if (!existing) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (existing.expired) {
        return res.status(410).json({ message: "Session expired" });
      }

      const state = { ...existing.state };
      state.currentPhase = targetPhase;
      state.phaseStartedAt = Date.now();

      if (targetPhase === 'speed_friending') {
        const roster = await listParticipants(existing.socialSessionId);
        const playerIds = roster.map((p: any) => p.userId);
        const displayNames = new Map(roster.map((p: any) => [p.userId, p.displayName]));
        const rounds = generateSpeedFriendingPairs(playerIds, displayNames);
        state.speedFriendingPairs = rounds.flat();
        state.speedFriendingTotalRounds = rounds.length;
        state.speedFriendingCurrentRound = 0;
        state.speedFriendingAllRoundsComplete = false;
        state.speedFriendingRoundStartedAt = Date.now();
      }

      await updateSession(existing.socialSessionId, state);
      logger.info("[TestAdmin] Force phase", {
        icebreakerSessionId,
        socialSessionId: existing.socialSessionId,
        phase: targetPhase,
      });

      res.json({ phase: targetPhase, socialSessionId: existing.socialSessionId });
    } catch (error: any) {
      logger.error("[TestAdmin] force-phase error", { error: String(error) });
      res.status(500).json({ message: "Failed to force phase", error: error?.message });
    }
  });

  app.post("/api/test/social-icebreaker/:icebreakerSessionId/cleanup", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Forbidden - not available in production" });
    }

    const { icebreakerSessionId } = req.params;
    try {
      await db.delete(socialIcebreakerSessions)
        .where(eq(socialIcebreakerSessions.icebreakerSessionId, icebreakerSessionId));
      logger.info("[TestAdmin] Cleanup icebreaker session", { icebreakerSessionId });
      res.json({ deleted: true, icebreakerSessionId });
    } catch (error: any) {
      logger.error("[TestAdmin] cleanup error", { error: String(error) });
      res.status(500).json({ message: "Failed to cleanup session", error: error?.message });
    }
  });
}
