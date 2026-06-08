import { db } from "../db";
import { users, eventPools, adminAccounts, eventPoolRegistrations, eventPoolGroups } from "@shared/schema";
import { eq, like, inArray, count } from "drizzle-orm";
import bcrypt from "bcrypt";
import { logger } from "../lib/logger";

export interface CreateTestUserInput {
  phoneNumber: string;
  password: string;
  displayName: string;
  gender?: string;
  currentCity?: string;
  archetype?: string;
  hasCompletedProfileSetup?: boolean;
  hasCompletedPersonalityTest?: boolean;
}

export interface CreateTestUserResult {
  id: string;
  phoneNumber: string;
  displayName: string;
}

export interface CreateTestEventPoolInput {
  title: string;
  description?: string;
  eventType?: string;
  city?: string;
  district?: string;
  dateTime?: Date;
  registrationDeadline?: Date;
  minGroupSize?: number;
  maxGroupSize?: number;
  targetGroups?: number;
  createdBy?: string;
}

export interface TestStatusResult {
  mode: string;
  databaseUrl: string;
  userCount: number;
  poolCount: number;
}

const TEST_PHONE_PREFIX = "+861380000";

export async function createTestUser(data: CreateTestUserInput): Promise<CreateTestUserResult> {
  const passwordHash = await bcrypt.hash(data.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      phoneNumber: data.phoneNumber,
      displayName: data.displayName,
      password: passwordHash,
      gender: data.gender ?? "不透露",
      currentCity: data.currentCity ?? "深圳",
      primaryArchetype: data.archetype ?? null,
      hasCompletedProfileSetup: data.hasCompletedProfileSetup ?? true,
      hasCompletedPersonalityTest: data.hasCompletedPersonalityTest ?? true,
      hasCompletedRegistration: true,
    })
    .returning({ id: users.id, phoneNumber: users.phoneNumber, displayName: users.displayName });

  logger.info("[TestAdmin] Created test user", { userId: user.id, phone: data.phoneNumber });
  return user;
}

export async function createTestEventPool(data: CreateTestEventPoolInput) {
  const now = new Date();
  const eventDate = data.dateTime ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const deadline = data.registrationDeadline ?? new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const [pool] = await db
    .insert(eventPools)
    .values({
      title: data.title,
      description: data.description ?? "Test event pool created via Test Admin API",
      eventType: data.eventType ?? "饭局",
      city: data.city ?? "深圳",
      district: data.district ?? "南山区",
      dateTime: eventDate,
      registrationDeadline: deadline,
      status: "active",
      minGroupSize: data.minGroupSize ?? 4,
      maxGroupSize: data.maxGroupSize ?? 6,
      targetGroups: data.targetGroups ?? 2,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  logger.info("[TestAdmin] Created test event pool", { poolId: pool.id, title: data.title });
  return pool;
}

export async function registerTestUserToPool(userId: string, poolId: string) {
  const [registration] = await db
    .insert(eventPoolRegistrations)
    .values({
      userId,
      poolId,
      matchStatus: "pending",
    })
    .onConflictDoNothing()
    .returning();

  logger.info("[TestAdmin] Registered user to pool", { userId, poolId, registrationId: registration?.id });
  return registration;
}

export async function resetTestData(): Promise<{ deletedUsers: number; deletedPools: number }> {
  const testPhones: { id: string }[] = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.phoneNumber, `${TEST_PHONE_PREFIX}%`));

  const testUserIds: string[] = testPhones.map((u: { id: string }) => u.id);
  let deletedPoolCount = 0;

  if (testUserIds.length > 0) {
    await db.delete(eventPoolRegistrations).where(inArray(eventPoolRegistrations.userId, testUserIds));

    const poolsCreatedByTestUsers: { id: string }[] = await db
      .select({ id: eventPools.id })
      .from(eventPools)
      .where(inArray(eventPools.createdBy, testUserIds));
    const poolIds: string[] = poolsCreatedByTestUsers.map((p: { id: string }) => p.id);
    deletedPoolCount = poolIds.length;

    if (poolIds.length > 0) {
      await db.delete(eventPoolRegistrations).where(inArray(eventPoolRegistrations.poolId, poolIds));
      await db.delete(eventPoolGroups).where(inArray(eventPoolGroups.poolId, poolIds));
      await db.delete(eventPools).where(inArray(eventPools.id, poolIds));
    }

    await db.delete(users).where(inArray(users.id, testUserIds));
  }

  await db.delete(adminAccounts).where(eq(adminAccounts.username, "test_admin_seed"));

  logger.info("[TestAdmin] Reset complete", { deletedUsers: testUserIds.length, deletedPools: deletedPoolCount });
  return { deletedUsers: testUserIds.length, deletedPools: deletedPoolCount };
}

export async function getTestStatus(): Promise<TestStatusResult> {
  const userCountResult = await db.select({ value: count() }).from(users);
  const poolCountResult = await db.select({ value: count() }).from(eventPools);

  return {
    mode: "test",
    databaseUrl: process.env.TEST_DATABASE_URL?.substring(0, 20) + "...",
    userCount: Number(userCountResult[0]?.value ?? 0),
    poolCount: Number(poolCountResult[0]?.value ?? 0),
  };
}
