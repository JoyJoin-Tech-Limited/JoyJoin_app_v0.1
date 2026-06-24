import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "../db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  users,
  eventPools,
  eventPoolRegistrations,
  eventPoolGroups,
  userInterests,
  eventAttendance,
  matchHistory,
  socialIcebreakerSessions,
  socialIcebreakerParticipants,
  socialIcebreakerLieTruths,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { logger } from "../lib/logger";
import { logAdminAudit } from "../lib/adminAuditLogger";
import { ARCHETYPE_DEFINITIONS } from "@shared/personality/archetypeNames";
import { INTEREST_TAXONOMY } from "@shared/interests";
import { isMatchingTestMode } from "../lib/isSingleTestMode";

type DbTransaction = NodePgDatabase<typeof schema>;

/**
 * Matching-test mode service.
 *
 * Creates fully-profiled synthetic users and a dedicated test event pool so that
 * one real tester can pay, register, and run through the production matching
 * engine together with bots. All operations are gated by isMatchingTestMode().
 *
 * Production isolation:
 * - Bot users are tagged with users.isTestBot = true and a reserved phone prefix.
 * - The test pool is tagged with eventPools.isTestPool = true.
 * - Cleanup filters on both markers; real users are never touched.
 */

const MATCHING_TEST_POOL_TITLE = "匹配调试局";
const MATCHING_TEST_PHONE_PREFIX = "+8613999999"; // distinct from single-test icebreaker prefix
const BOT_COMMON_PASSWORD = "test123456";
const BOT_COUNT = 5;

const CITIES = ["深圳", "香港", "广州", "北京", "上海"];
const DISTRICTS: Record<string, string[]> = {
  深圳: ["南山区", "福田区", "罗湖区", "宝安区"],
  香港: ["中西区", "湾仔区", "东区", "九龙城区"],
  广州: ["天河区", "越秀区", "海珠区", "番禺区"],
  北京: ["朝阳区", "海淀区", "东城区"],
  上海: ["浦东新区", "黄浦区", "徐汇区"],
};
const EDUCATION_LEVELS = ["博士", "硕士", "本科", "大专", "高中及以下"];
const LIFE_STAGES = ["学生党", "职场新人", "职场老手", "创业中", "自由职业"];
const WORK_MODES = ["employed", "founder", "student", "freelancer", "successor"];
const BUDGET_RANGES = ["150-200", "200-300", "300-500"];
const LANGUAGES = ["普通话", "粤语", "英语"];
const EVENT_INTENTS = ["交朋友", "扩展人脉", "放松心情", "行业交流", "flexible"];
const CUISINE_PREFS = ["中餐", "日料", "西餐", "粤菜", "川菜"];

const BOT_NAMES = [
  "艾米", "小王子", "星星", "月光", "云朵",
  "清风", "晨曦", "晚霞", "晴天", "雪花",
];

const INDUSTRY_TIERS = [
  { category: "tech", categoryLabel: "科技互联网", segment: "ai", segmentLabel: "人工智能", niche: "medical_ai", nicheLabel: "医疗AI" },
  { category: "tech", categoryLabel: "科技互联网", segment: "software", segmentLabel: "软件服务", niche: "enterprise_saas", nicheLabel: "企业SaaS" },
  { category: "finance", categoryLabel: "金融", segment: "vc_pe", segmentLabel: "VC/PE", niche: "early_stage_vc", nicheLabel: "早期风险投资" },
  { category: "finance", categoryLabel: "金融", segment: "ib", segmentLabel: "投资银行", niche: "m_a", nicheLabel: "并购重组" },
  { category: "creative", categoryLabel: "文创传媒", segment: "content", segmentLabel: "内容创作", niche: "brand_content", nicheLabel: "品牌内容" },
  { category: "consulting", categoryLabel: "咨询", segment: "strategy", segmentLabel: "战略咨询", niche: "digital_transformation", nicheLabel: "数字化转型" },
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateBirthdate(minAge = 22, maxAge = 35): string {
  const year = new Date().getFullYear() - (minAge + Math.floor(Math.random() * (maxAge - minAge)));
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildBotInterests(botIndex: number) {
  const shuffled = shuffle(INTEREST_TAXONOMY.filter((i) => i.active));
  const selections = shuffled.slice(0, 4 + (botIndex % 3)).map((interest, idx) => ({
    topicId: interest.id,
    emoji: interest.riasec,
    label: interest.label,
    fullName: interest.label,
    category: interest.macroCategory,
    categoryId: interest.macroCategory,
    level: idx < 2 ? 3 : idx < 3 ? 2 : 1,
    heat: idx < 2 ? 80 + (botIndex % 15) : 40 + (botIndex % 25),
  }));

  const totalHeat = selections.reduce((sum, s) => sum + s.heat, 0);
  const categoryHeat: Record<string, number> = {};
  for (const s of selections) {
    categoryHeat[s.category] = (categoryHeat[s.category] ?? 0) + s.heat;
  }

  return {
    totalHeat,
    totalSelections: selections.length,
    categoryHeat,
    selections,
    topPriorities: selections.filter((s) => s.level === 3).map((s) => ({ topicId: s.topicId, label: s.label, heat: s.heat })),
  };
}

function assertMatchingTestMode() {
  if (!isMatchingTestMode()) {
    throw new Error("MATCHING_TEST_MODE_NOT_ENABLED");
  }
  if (process.env.APP_MODE === "production") {
    throw new Error("MATCHING_TEST_MODE_BLOCKED_IN_PRODUCTION");
  }
}

export async function ensureMatchingTestPool(testerUserId: string): Promise<string> {
  assertMatchingTestMode();

  const [existing] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(and(eq(eventPools.title, MATCHING_TEST_POOL_TITLE), eq(eventPools.isTestPool, true)))
    .limit(1);

  if (existing) return existing.id;

  const now = new Date();
  const city = pick(CITIES);
  const [pool] = await db
    .insert(eventPools)
    .values({
      title: MATCHING_TEST_POOL_TITLE,
      description: "匹配调试专用活动池 — 仅限测试模式",
      eventType: "饭局",
      city,
      district: pick(DISTRICTS[city] ?? DISTRICTS["深圳"]),
      dateTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      status: "active",
      minGroupSize: BOT_COUNT + 1,
      maxGroupSize: BOT_COUNT + 2,
      targetGroups: 1,
      createdBy: testerUserId,
      isTestPool: true,
    })
    .returning({ id: eventPools.id });

  logger.info("[MatchingTest] pool created", { poolId: pool.id, testerUserId });
  return pool.id;
}

interface BotUser {
  userId: string;
  displayName: string;
  archetype: string;
}

export async function seedMatchingTestBots(
  poolId: string,
  _testerUserId: string
): Promise<{ botUsers: BotUser[] }> {
  assertMatchingTestMode();

  const passwordHash = await bcrypt.hash(BOT_COMMON_PASSWORD, 10);
  const archetypeIds = shuffle(ARCHETYPE_DEFINITIONS.map((a) => a.id));
  const botNames = shuffle(BOT_NAMES);

  const phoneNumbers = Array.from({ length: BOT_COUNT }, (_, i) =>
    `${MATCHING_TEST_PHONE_PREFIX}${String(i).padStart(4, "0")}`
  );

  // Reset all prior bot registrations in this pool so re-seeding is safe.
  const existingBotIds = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isTestBot, true), like(users.phoneNumber, `${MATCHING_TEST_PHONE_PREFIX}%`)));
  if (existingBotIds.length > 0) {
    await db
      .delete(eventPoolRegistrations)
      .where(and(
        eq(eventPoolRegistrations.poolId, poolId),
        inArray(eventPoolRegistrations.userId, existingBotIds.map((b: { id: string }) => b.id)),
      ));
  }

  const botUsers: BotUser[] = [];

  for (let i = 0; i < BOT_COUNT; i++) {
    const phoneNumber = phoneNumbers[i];
    const displayName = botNames[i] ?? `调试bot${i}`;
    const archetype = archetypeIds[i % archetypeIds.length];
    const city = pick(CITIES);
    const district = pick(DISTRICTS[city] ?? DISTRICTS["深圳"]);
    const industry = INDUSTRY_TIERS[i % INDUSTRY_TIERS.length];
    const interests = buildBotInterests(i);

    const [user] = await db
      .insert(users)
      .values({
        phoneNumber,
        password: passwordHash,
        displayName,
        gender: i % 3 === 0 ? "女性" : "男性",
        currentCity: city,
        birthdate: generateBirthdate(),
        primaryArchetype: archetype,
        secondaryArchetype: archetypeIds[(i + 1) % archetypeIds.length],
        educationLevel: EDUCATION_LEVELS[i % EDUCATION_LEVELS.length],
        lifeStage: LIFE_STAGES[i % LIFE_STAGES.length],
        workMode: WORK_MODES[i % WORK_MODES.length],
        hometown: city,
        hometownAffinityOptin: true,
        intent: [pick(EVENT_INTENTS), pick(EVENT_INTENTS)],
        industryCategory: industry.category,
        industryCategoryLabel: industry.categoryLabel,
        industrySegmentNew: industry.segment,
        industrySegmentLabel: industry.segmentLabel,
        industryNiche: industry.niche,
        industryNicheLabel: industry.nicheLabel,
        industryRawInput: industry.nicheLabel,
        industrySource: "seed",
        industryConfidence: "0.95",
        hasCompletedProfileSetup: true,
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
        isTestBot: true,
        vibeVector: {
          energy: 50 + (i % 40),
          depth: 40 + (i % 50),
          play: 30 + (i % 60),
          structure: 20 + (i % 70),
        },
        ageMatchPreference: "相近",
        tableVibePreference: i % 2 === 0 ? "轻松聊天" : "深度交流",
      })
      .onConflictDoUpdate({
        target: users.phoneNumber,
        set: {
          displayName,
          primaryArchetype: archetype,
          secondaryArchetype: archetypeIds[(i + 1) % archetypeIds.length],
          currentCity: city,
          birthdate: generateBirthdate(),
          educationLevel: EDUCATION_LEVELS[i % EDUCATION_LEVELS.length],
          lifeStage: LIFE_STAGES[i % LIFE_STAGES.length],
          workMode: WORK_MODES[i % WORK_MODES.length],
          hometown: city,
          hometownAffinityOptin: true,
          intent: [pick(EVENT_INTENTS), pick(EVENT_INTENTS)],
          industryCategory: industry.category,
          industryCategoryLabel: industry.categoryLabel,
          industrySegmentNew: industry.segment,
          industrySegmentLabel: industry.segmentLabel,
          industryNiche: industry.niche,
          industryNicheLabel: industry.nicheLabel,
          industryRawInput: industry.nicheLabel,
          industrySource: "seed",
          industryConfidence: "0.95",
          isTestBot: true,
          vibeVector: {
            energy: 50 + (i % 40),
            depth: 40 + (i % 50),
            play: 30 + (i % 60),
            structure: 20 + (i % 70),
          },
          ageMatchPreference: "相近",
          tableVibePreference: i % 2 === 0 ? "轻松聊天" : "深度交流",
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id, displayName: users.displayName, primaryArchetype: users.primaryArchetype });

    await db
      .insert(userInterests)
      .values({
        userId: user.id,
        totalHeat: interests.totalHeat,
        totalSelections: interests.totalSelections,
        categoryHeat: interests.categoryHeat,
        selections: interests.selections,
        topPriorities: interests.topPriorities,
      })
      .onConflictDoUpdate({
        target: userInterests.userId,
        set: {
          totalHeat: interests.totalHeat,
          totalSelections: interests.totalSelections,
          categoryHeat: interests.categoryHeat,
          selections: interests.selections,
          topPriorities: interests.topPriorities,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(eventPoolRegistrations)
      .values({
        poolId,
        userId: user.id,
        budgetRange: [pick(BUDGET_RANGES)],
        preferredLanguages: [pick(LANGUAGES), pick(LANGUAGES)],
        eventIntent: [pick(EVENT_INTENTS)],
        cuisinePreferences: [pick(CUISINE_PREFS), pick(CUISINE_PREFS)],
        dietaryRestrictions: [],
        tasteIntensity: ["不辣/清淡为主"],
        preferenceStrictness: 50,
        preferredDistricts: [district],
        genderCompositionPreference: "balanced",
        acceptPairs: true,
        kolComfortLevel: "comfortable",
        matchStatus: "pending",
      })
      .onConflictDoNothing();

    botUsers.push({
      userId: user.id,
      displayName: user.displayName ?? "Bot",
      archetype: user.primaryArchetype ?? "corgi",
    });
  }

  logger.info("[MatchingTest] bots seeded", { poolId, botCount: botUsers.length });
  return { botUsers };
}

export async function cleanupMatchingTestData(): Promise<{
  deletedPools: number;
  deletedRegistrations: number;
  deletedGroups: number;
  deletedBots: number;
  deletedIcebreakerSessions: number;
}> {
  assertMatchingTestMode();

  const result = {
    deletedPools: 0,
    deletedRegistrations: 0,
    deletedGroups: 0,
    deletedBots: 0,
    deletedIcebreakerSessions: 0,
  };

  await db.transaction(async (tx: DbTransaction) => {
    // Step 1: Find test pools
    const poolRows = await tx
      .select({ id: eventPools.id })
      .from(eventPools)
      .where(eq(eventPools.isTestPool, true));
    const poolIds = poolRows.map((p: { id: string }) => p.id);

    let groupIds: string[] = [];

    if (poolIds.length > 0) {
      // Step 2: Find groups for those pools
      const groupRows = await tx
        .select({ id: eventPoolGroups.id })
        .from(eventPoolGroups)
        .where(inArray(eventPoolGroups.poolId, poolIds));
      groupIds = groupRows.map((g) => g.id);

      // Step 3: Clean icebreaker data for these groups
      if (groupIds.length > 0) {
        // sessions have icebreakerSessionId pointing to the group ID
        const icebreakerRows = await tx
          .select({ id: socialIcebreakerSessions.id })
          .from(socialIcebreakerSessions)
          .where(inArray(socialIcebreakerSessions.icebreakerSessionId, groupIds));
        const icebreakerIds = icebreakerRows.map((s: { id: string }) => s.id);

        if (icebreakerIds.length > 0) {
          await tx.delete(socialIcebreakerLieTruths).where(inArray(socialIcebreakerLieTruths.socialSessionId, icebreakerIds));
          await tx.delete(socialIcebreakerParticipants).where(inArray(socialIcebreakerParticipants.socialSessionId, icebreakerIds));
          const deletedSessions = await tx
            .delete(socialIcebreakerSessions)
            .where(inArray(socialIcebreakerSessions.id, icebreakerIds))
            .returning({ id: socialIcebreakerSessions.id });
          result.deletedIcebreakerSessions = deletedSessions.length;
        }
      }

      // Step 4: Delete ALL registrations for test pools (including tester's).
      // The FK constraint on poolId REFERENCES eventPools.id requires this.
      // The real tester's payment records in the payments table are NOT touched.
      const deletedRegistrations = await tx
        .delete(eventPoolRegistrations)
        .where(inArray(eventPoolRegistrations.poolId, poolIds))
        .returning({ id: eventPoolRegistrations.id });
      result.deletedRegistrations = deletedRegistrations.length;

      // Step 5: Delete groups
      const deletedGroups = await tx
        .delete(eventPoolGroups)
        .where(inArray(eventPoolGroups.poolId, poolIds))
        .returning({ id: eventPoolGroups.id });
      result.deletedGroups = deletedGroups.length;

      // Step 6: Delete pools
      const deletedPools = await tx
        .delete(eventPools)
        .where(inArray(eventPools.id, poolIds))
        .returning({ id: eventPools.id });
      result.deletedPools = deletedPools.length;
    }

    // Step 9: Delete bot users themselves (separate from pool scope so cleanup
    // works even if no test pools exist yet)
    const botUserRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isTestBot, true), like(users.phoneNumber, `${MATCHING_TEST_PHONE_PREFIX}%`)));
    const allBotIds = botUserRows.map((b: { id: string }) => b.id);

    if (allBotIds.length > 0) {
      await tx
        .delete(matchHistory)
        .where(or(inArray(matchHistory.user1Id, allBotIds), inArray(matchHistory.user2Id, allBotIds)));
      await tx.delete(eventAttendance).where(inArray(eventAttendance.userId, allBotIds));
      await tx.delete(userInterests).where(inArray(userInterests.userId, allBotIds));

      const deletedBots = await tx
        .delete(users)
        .where(inArray(users.id, allBotIds))
        .returning({ id: users.id });
      result.deletedBots = deletedBots.length;
    }
  });

  logAdminAudit({
    action: "USER_DATA_DELETED",
    adminId: "matching-test-cleanup",
    targetEntityType: "event_pool",
    context: {
      reason: "matching-test-cleanup",
      ...result,
    },
  });

  logger.info("[MatchingTest] cleanup complete", result);
  return result;
}

export async function detectTestBotRowsInProduction(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isTestBot, true));
  return row?.count ?? 0;
}
