#!/usr/bin/env node
/**
 * Seed Test Data
 *
 * Idempotently seeds the database with known test entities for QA and E2E use.
 * Safe to run multiple times — uses phone-based upsert patterns.
 *
 * Environment:
 *   DATABASE_URL (or TEST_DATABASE_URL when APP_MODE=test)
 *
 * Usage:
 *   node --env-file=../../.env --import tsx/esm src/scripts/seed-test-data.ts
 *   APP_MODE=test node --env-file=../../.env --import tsx/esm src/scripts/seed-test-data.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, eventPools, adminAccounts, featureFlags } from "@joyjoin/shared";
import bcrypt from "bcrypt";

const COMMON_PASSWORD = "test123456";
const TEST_USERS = [
  {
    phoneNumber: "+8613800000001",
    displayName: "测试用户_完整资料",
    gender: "女性",
    currentCity: "深圳",
    primaryArchetype: "开心柯基",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_001",
  },
  {
    phoneNumber: "+8613800000002",
    displayName: "测试用户_未完成资料",
    gender: "男性",
    currentCity: "香港",
    primaryArchetype: null,
    hasCompletedProfileSetup: false,
    hasCompletedPersonalityTest: false,
    wechatOpenId: "test_openid_002",
  },
  {
    phoneNumber: "+8613800000003",
    displayName: "测试用户_太阳鸡",
    gender: "男性",
    currentCity: "香港",
    primaryArchetype: "太阳鸡",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_003",
  },
  {
    phoneNumber: "+8613800000004",
    displayName: "测试用户_树洞考拉",
    gender: "女性",
    currentCity: "广州",
    primaryArchetype: "树洞考拉",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_004",
  },
  {
    phoneNumber: "+8613800000005",
    displayName: "测试用户_靠谱大象",
    gender: "男性",
    currentCity: "深圳",
    primaryArchetype: "靠谱大象",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_005",
  },
  {
    phoneNumber: "+8613800000006",
    displayName: "测试用户_最小资料",
    gender: "不透露",
    currentCity: "深圳",
    primaryArchetype: null,
    hasCompletedProfileSetup: false,
    hasCompletedPersonalityTest: false,
    wechatOpenId: "test_openid_006",
  },
  {
    phoneNumber: "+8613800000007",
    displayName: "测试用户_机灵海豚",
    gender: "女性",
    currentCity: "香港",
    primaryArchetype: "机灵海豚",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_007",
  },
  {
    phoneNumber: "+8613800000008",
    displayName: "测试用户_脑洞章鱼",
    gender: "男性",
    currentCity: "深圳",
    primaryArchetype: "脑洞章鱼",
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    wechatOpenId: "test_openid_008",
  },
];

const TEST_ADMIN = {
  username: "test_admin_seed",
  password: "TestAdmin123!",
  role: "super_admin" as const,
  displayName: "QA Test Admin",
};

const BETA_FEATURE_FLAGS: Array<{ key: string; value: string; label: string }> = [
  { key: "personalityShareEnabled", value: "true", label: "Personality share poster" },
  { key: "personalitySlotAnimationEnabled", value: "true", label: "Personality slot animation" },
  { key: "matchingLiveReveal", value: "true", label: "Matching live reveal" },
  { key: "promoBannerEnabled", value: "true", label: "Hero promo banner" },
  { key: "smartProfession", value: "true", label: "Smart profession AI classification" },
  { key: "restartOnboarding", value: "false", label: "Onboarding restart (off by default)" },
  { key: "onboardingForceSkip", value: "false", label: "Onboarding force skip (off by default)" },
  { key: "socialIcebreakerClientForceEnd", value: "false", label: "Icebreaker force-end kill-switch (off by default)" },
  { key: "runPlanTemplatesEnabled", value: "false", label: "Run plan templates (off by default)" },
  { key: "paymentsEnabled", value: "false", label: "Payments (set true + WeChat Pay creds for payment flow)" },
];

async function seedTestUsers() {
  const passwordHash = await bcrypt.hash(COMMON_PASSWORD, 10);
  const results: Array<{ id: string; phoneNumber: string }> = [];
  for (const userData of TEST_USERS) {
    const existing = await db
      .select({ id: users.id, phoneNumber: users.phoneNumber })
      .from(users)
      .where(eq(users.phoneNumber, userData.phoneNumber))
      .limit(1);

    if (existing.length > 0) {
      await db.update(users).set({
        password: passwordHash,
        displayName: userData.displayName,
        gender: userData.gender,
        currentCity: userData.currentCity,
        primaryArchetype: userData.primaryArchetype,
        hasCompletedProfileSetup: userData.hasCompletedProfileSetup,
        hasCompletedPersonalityTest: userData.hasCompletedPersonalityTest,
      }).where(eq(users.id, existing[0].id));
      console.log(`  [update] User: ${userData.phoneNumber} (${existing[0].id})`);
      results.push(existing[0]);
      continue;
    }

    const [inserted] = await db
      .insert(users)
      .values({
        phoneNumber: userData.phoneNumber,
        password: passwordHash,
        displayName: userData.displayName,
        gender: userData.gender,
        currentCity: userData.currentCity,
        primaryArchetype: userData.primaryArchetype,
        hasCompletedProfileSetup: userData.hasCompletedProfileSetup,
        hasCompletedPersonalityTest: userData.hasCompletedPersonalityTest,
        hasCompletedRegistration: true,
        wechatOpenId: userData.wechatOpenId,
      })
      .returning({ id: users.id, displayName: users.displayName });

    console.log(`  [create] User: ${inserted.displayName} (${inserted.id})`);
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
    console.log(`  [skip] Admin exists: ${TEST_ADMIN.username} (${existing[0].id})`);
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

  console.log(`  [create] Admin: ${TEST_ADMIN.username} (${inserted.id})`);
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
    console.log(`  [skip] Pool exists: "${poolTitle}" (${existing[0].id})`);
    return existing[0];
  }

  const now = new Date();
  const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const deadline = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

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

  console.log(`  [create] Pool: "${poolTitle}" (${inserted.id})`);
  return inserted;
}

async function seedBetaFeatureFlags() {
  let created = 0;
  let existing = 0;

  for (const flag of BETA_FEATURE_FLAGS) {
    const row = await db
      .select({ key: featureFlags.key })
      .from(featureFlags)
      .where(eq(featureFlags.key, flag.key))
      .limit(1);

    if (row.length > 0) {
      existing++;
      continue;
    }

    await db.insert(featureFlags).values({
      key: flag.key,
      value: flag.value,
      updatedBy: "seed-script",
    });
    console.log(`[seed] Created feature flag: ${flag.key} = ${flag.value} (${flag.label})`);
    created++;
  }

  console.log(`[seed] Feature flags: ${created} created, ${existing} already existed`);
}

async function main() {
  console.log("[seed] Starting test data seed...\n");

  console.log("[seed] Users:");
  const testUsers = await seedTestUsers();

  console.log("\n[seed] Admin:");
  const testAdmin = await seedTestAdmin();

  console.log("\n[seed] Event Pool:");
  const testPool = await seedTestEventPool(testUsers[0].id);
  await seedBetaFeatureFlags();

  const completedUsers = testUsers.filter((_, i) => TEST_USERS[i]?.hasCompletedProfileSetup).length;
  const incompleteUsers = testUsers.filter((_, i) => !TEST_USERS[i]?.hasCompletedProfileSetup).length;

  console.log("\n[seed] Summary:");
  console.log(`  Users (total):     ${testUsers.length}`);
  console.log(`  Users (complete):  ${completedUsers}`);
  console.log(`  Users (partial):   ${incompleteUsers}`);
  console.log(`  Admin:             ${testAdmin.id} (${TEST_ADMIN.username})`);
  console.log(`  Pool:              ${testPool.id}`);
  console.log(`  Common password:   ${COMMON_PASSWORD}`);
  console.log(`  Feature flags: ${BETA_FEATURE_FLAGS.length} configured`);
  console.log("\n[seed] Done.");

  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
