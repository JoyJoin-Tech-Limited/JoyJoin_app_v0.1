#!/usr/bin/env node
/**
 * Seed Test Data
 * 测试数据种子脚本
 *
 * Idempotently seeds the database with known test entities for QA and E2E use.
 * Safe to run multiple times — uses upsert/merge patterns where possible.
 *
 * Environment:
 *   DATABASE_URL  (loaded from ../../.env via --env-file)
 *
 * Usage:
 *   node --env-file=../../.env --import tsx/esm src/scripts/seed-test-data.ts
 *
 * Known test identifiers (stable for QA reference):
 *   - Test User phone:  +8613800000001  (profile complete)
 *   - Test User phone:  +8613800000002  (profile incomplete)
 *   - Test Admin:       test_admin_seed / TestAdmin123!
 *   - Test Event Pool:  "QA 测试饭局 — 周五夜聊"
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, eventPools, adminAccounts } from "@joyjoin/shared";
import bcrypt from "bcrypt";

const TEST_USERS = [
  {
    phoneNumber: "+8613800000001",
    displayName: "测试用户_完整资料",
    gender: "女性",
    currentCity: "深圳",
    hasCompletedProfileSetup: true,
    hasCompletedVoiceQuiz: true,
    wechatOpenId: "test_openid_001",
  },
  {
    phoneNumber: "+8613800000002",
    displayName: "测试用户_未完成资料",
    gender: "男性",
    currentCity: "香港",
    hasCompletedProfileSetup: false,
    hasCompletedVoiceQuiz: false,
    wechatOpenId: "test_openid_002",
  },
];

const TEST_ADMIN = {
  username: "test_admin_seed",
  password: "TestAdmin123!",
  role: "super_admin" as const,
  displayName: "QA Test Admin",
};

async function seedTestUsers() {
  const results = [];
  for (const userData of TEST_USERS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, userData.phoneNumber))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[seed] Test user exists: ${userData.phoneNumber} (${existing[0].id})`);
      results.push(existing[0]);
      continue;
    }

    const [inserted] = await db
      .insert(users)
      .values({
        phoneNumber: userData.phoneNumber,
        displayName: userData.displayName,
        gender: userData.gender,
        currentCity: userData.currentCity,
        hasCompletedProfileSetup: userData.hasCompletedProfileSetup,
        hasCompletedVoiceQuiz: userData.hasCompletedVoiceQuiz,
        wechatOpenId: userData.wechatOpenId,
      })
      .returning({ id: users.id });

    console.log(`[seed] Created test user: ${userData.phoneNumber} (${inserted.id})`);
    results.push(inserted);
  }
  return results;
}

async function seedTestAdmin() {
  const existing = await db
    .select({ id: adminAccounts.id })
    .from(adminAccounts)
    .where(eq(adminAccounts.username, TEST_ADMIN.username))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed] Test admin exists: ${TEST_ADMIN.username} (${existing[0].id})`);
    return existing[0];
  }

  const passwordHash = await bcrypt.hash(TEST_ADMIN.password, 12);
  const [inserted] = await db
    .insert(adminAccounts)
    .values({
      username: TEST_ADMIN.username,
      passwordHash,
      role: TEST_ADMIN.role,
      displayName: TEST_ADMIN.displayName,
    })
    .returning({ id: adminAccounts.id });

  console.log(`[seed] Created test admin: ${TEST_ADMIN.username} (${inserted.id})`);
  return inserted;
}

async function seedTestEventPool(createdByUserId: string) {
  const poolTitle = "QA 测试饭局 — 周五夜聊";

  const existing = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(eq(eventPools.title, poolTitle))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed] Test event pool exists: "${poolTitle}" (${existing[0].id})`);
    return existing[0];
  }

  const now = new Date();
  const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

  const [inserted] = await db
    .insert(eventPools)
    .values({
      title: poolTitle,
      description: "这是一个用于 QA 测试的饭局活动池。",
      eventType: "饭局",
      city: "深圳",
      district: "南山区",
      dateTime: eventDate,
      registrationDeadline: deadline,
      status: "active",
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 2,
      createdBy: createdByUserId,
    })
    .returning({ id: eventPools.id });

  console.log(`[seed] Created test event pool: "${poolTitle}" (${inserted.id})`);
  return inserted;
}

async function main() {
  console.log("[seed] Starting test data seed...");

  const testUsers = await seedTestUsers();
  const testAdmin = await seedTestAdmin();
  const testPool = await seedTestEventPool(testUsers[0].id);

  console.log("\n[seed] Summary:");
  console.log(`  Test users:   ${testUsers.length}`);
  console.log(`  Test admin:   ${testAdmin.id} (${TEST_ADMIN.username})`);
  console.log(`  Test pool:    ${testPool.id}`);
  console.log("\n[seed] Done.");

  // Graceful exit for pg pool
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
