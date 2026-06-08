import type { Express } from "express";
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
}
