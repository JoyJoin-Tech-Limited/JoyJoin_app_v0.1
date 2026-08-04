import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
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
  venues,
  venueTimeSlots,
  venueTimeSlotBookings,
  poolAICopy,
  poolMatchingLogs,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { logger } from "../lib/logger";
import { logAdminAudit } from "../lib/adminAuditLogger";
import { ARCHETYPE_DEFINITIONS } from "@shared/personality/archetypeNames";
import { INTEREST_TAXONOMY } from "@shared/interests";
import { isMatchingTestMode } from "../lib/isSingleTestMode";
import { parseEventDate } from "../venueAssignmentService";
import { cascadeDeleteByIds } from "../lib/fkCascadeDelete";

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

// Reserved test-venue identity. Cleanup matches on name, so never reuse it for
// a real venue. One venue per (city, area) is created on demand because venue
// assignment filters strictly on city + district.
const MATCHING_TEST_VENUE_NAME = "悦聚调试小馆";
const MATCHING_TEST_SLOT_START = "17:00";
const MATCHING_TEST_SLOT_END = "23:00";

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
  // Shared deterministic core so every bot (and the tester) overlaps strongly
  // and pair scores clear the minPairScore gate — fully random picks made
  // jaccard ≈ 0 and the group could never form in matching-test. Heat/level
  // still vary by botIndex for some diversity.
  const core = INTEREST_TAXONOMY.filter((i) => i.active).slice(0, 6);
  const selections = core.map((interest, idx) => ({
    topicId: interest.id,
    emoji: interest.riasec,
    label: interest.label,
    fullName: interest.label,
    category: interest.macroCategory,
    categoryId: interest.macroCategory,
    level: idx < 2 ? 3 : idx < 4 ? 2 : 1,
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

/**
 * Next Friday dinner slot (18:59). Used for pool.dateTime so the mini-program
 * 今晚这桌 brief renders a realistic dinner time instead of "now + 7 days"
 * (which landed at whatever time-of-day the test was started, e.g. 14:23).
 */
export function nextDinnerDateTime(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(18, 59, 0, 0);
  const delta = (5 - d.getDay() + 7) % 7; // 5 = Friday
  d.setDate(d.getDate() + delta);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 7);
  }
  return d;
}

/**
 * Find-or-create the reserved test venue for (city, area) plus weekly dinner
 * time slots covering every weekday, so venueAssignmentService always finds a
 * slot for any pool dateTime. Idempotent: safe to call on every pool ensure.
 *
 * Venue attributes are chosen to always pass the assignment filters:
 * - venueType 'restaurant' + isActive/onboardingStatus/partnerStatus 'active'
 * - cuisines/budgetCategories supersets of the bot registration values
 * - seatingCapacity 12 >= pool maxGroupSize (BOT_COUNT + 2)
 */
async function ensureMatchingTestVenue(city: string, district: string | null): Promise<string> {
  const area = district ?? "南山区";
  const [existingVenue] = await db
    .select({ id: venues.id })
    .from(venues)
    .where(and(
      eq(venues.name, MATCHING_TEST_VENUE_NAME),
      eq(venues.city, city),
      eq(venues.area, area),
    ))
    .limit(1);

  let venueId = existingVenue?.id;
  if (!venueId) {
    const [created] = await db
      .insert(venues)
      .values({
        name: MATCHING_TEST_VENUE_NAME,
        brandName: MATCHING_TEST_VENUE_NAME,
        venueType: "restaurant",
        address: `${city}${area}悦聚测试路 1 号`,
        city,
        area,
        cuisines: [...CUISINE_PREFS],
        priceRange: "150-200",
        budgetCategories: [...BUDGET_RANGES],
        seatingCapacity: 12,
        capacity: 4,
        isActive: true,
        onboardingStatus: "active",
        partnerStatus: "active",
        notes: "matching-test-mode seeded venue — removed by /api/test/matching-test/cleanup",
      })
      .returning({ id: venues.id });
    venueId = created.id;
    logger.info("[MatchingTest] test venue created", { venueId, city, area });
  }

  // Weekly slots for all 7 days (idempotent — skip days that already exist).
  const slotRows = await db
    .select({ dayOfWeek: venueTimeSlots.dayOfWeek })
    .from(venueTimeSlots)
    .where(and(eq(venueTimeSlots.venueId, venueId), eq(venueTimeSlots.isActive, true)));
  const coveredDays = new Set<number>(
    slotRows
      .map((row: { dayOfWeek: number | null }) => row.dayOfWeek)
      .filter((d: number | null): d is number => d !== null),
  );
  for (let day = 0; day < 7; day++) {
    if (coveredDays.has(day)) continue;
    await db.insert(venueTimeSlots).values({
      venueId,
      dayOfWeek: day,
      startTime: MATCHING_TEST_SLOT_START,
      endTime: MATCHING_TEST_SLOT_END,
      maxConcurrentEvents: 4,
      isActive: true,
      notes: "matching-test weekly dinner slot",
    });
  }

  return venueId;
}

export async function ensureMatchingTestPool(testerUserId: string): Promise<string> {
  assertMatchingTestMode();

  const [existing] = await db
    .select({
      id: eventPools.id,
      city: eventPools.city,
      district: eventPools.district,
      dateTime: eventPools.dateTime,
    })
    .from(eventPools)
    .where(and(eq(eventPools.title, MATCHING_TEST_POOL_TITLE), eq(eventPools.isTestPool, true)))
    .orderBy(asc(eventPools.createdAt))
    .limit(1);

  if (existing) {
    await ensureMatchingTestVenue(existing.city, existing.district);
    // Refresh a missing/past dateTime so the 今晚这桌 brief always renders.
    if (!existing.dateTime || existing.dateTime.getTime() <= Date.now()) {
      await db
        .update(eventPools)
        .set({ dateTime: nextDinnerDateTime(), updatedAt: new Date() })
        .where(eq(eventPools.id, existing.id));
    }
    // Reset the pool lifecycle so a fresh match run can commit. A previous run
    // that formed 0 groups leaves status stuck at 'matching' (or a completed
    // run leaves 'matched'), and the match CAS guard (active → matching)
    // rejects any re-run while it is not 'active'.
    await db
      .update(eventPools)
      .set({ status: "active", matchedAt: null, updatedAt: new Date() })
      .where(eq(eventPools.id, existing.id));
    return existing.id;
  }

  const city = pick(CITIES);
  const district = pick(DISTRICTS[city] ?? DISTRICTS["深圳"]);
  const dinnerDateTime = nextDinnerDateTime();
  const [pool] = await db
    .insert(eventPools)
    .values({
      title: MATCHING_TEST_POOL_TITLE,
      description: "匹配调试专用活动池 — 仅限测试模式",
      eventType: "饭局",
      city,
      district,
      dateTime: dinnerDateTime,
      registrationDeadline: new Date(dinnerDateTime.getTime() - 24 * 60 * 60 * 1000),
      status: "active",
      minGroupSize: BOT_COUNT + 1,
      maxGroupSize: BOT_COUNT + 2,
      targetGroups: 1,
      createdBy: testerUserId,
      isTestPool: true,
    })
    .returning({ id: eventPools.id });

  await ensureMatchingTestVenue(city, district);

  logger.info("[MatchingTest] pool created", { poolId: pool.id, testerUserId });
  return pool.id;
}

interface BotUser {
  userId: string;
  displayName: string;
  archetype: string;
}

/**
 * Give the tester a complete, bot-comparable profile so it can clear the
 * matching quality gate (`minPairScore`) alongside the full-profile bots.
 * Test-mode only. Fills only NULL fields (idempotent, never clobbers real
 * data the tester may have set) and seeds a `user_interests` row.
 */
async function seedTesterCompleteProfile(testerUserId: string, botIndex: number): Promise<void> {
  const industry = INDUSTRY_TIERS[botIndex % INDUSTRY_TIERS.length];
  const [tester] = await db
    .select({
      birthdate: users.birthdate,
      educationLevel: users.educationLevel,
      lifeStage: users.lifeStage,
      workMode: users.workMode,
      industryCategory: users.industryCategory,
      vibeVector: users.vibeVector,
      intent: users.intent,
      ageMatchPreference: users.ageMatchPreference,
      tableVibePreference: users.tableVibePreference,
      currentCity: users.currentCity,
    })
    .from(users)
    .where(eq(users.id, testerUserId))
    .limit(1);
  if (!tester) return;

  const updates: Record<string, unknown> = {};
  if (!tester.birthdate) updates.birthdate = generateBirthdate();
  if (!tester.educationLevel) updates.educationLevel = pick(EDUCATION_LEVELS);
  if (!tester.lifeStage) updates.lifeStage = pick(LIFE_STAGES);
  if (!tester.workMode) updates.workMode = pick(WORK_MODES);
  if (!tester.intent) updates.intent = [pick(EVENT_INTENTS), pick(EVENT_INTENTS)];
  if (!tester.ageMatchPreference) updates.ageMatchPreference = "相近";
  if (!tester.tableVibePreference) updates.tableVibePreference = "轻松聊天";
  if (!tester.currentCity) updates.currentCity = pick(CITIES);
  if (!tester.industryCategory) {
    updates.industryCategory = industry.category;
    updates.industryCategoryLabel = industry.categoryLabel;
    updates.industrySegmentNew = industry.segment;
    updates.industrySegmentLabel = industry.segmentLabel;
    updates.industryNiche = industry.niche;
    updates.industryNicheLabel = industry.nicheLabel;
    updates.industryRawInput = industry.nicheLabel;
    updates.industrySource = "seed";
    updates.industryConfidence = "0.95";
  }
  if (!tester.vibeVector) {
    // NOTE: matching no longer reads vibeVector (dead branch removed 2026-08); kept for bot profile realism only.
    updates.vibeVector = {
      energy: 50 + (botIndex % 40),
      depth: 40 + (botIndex % 50),
      play: 30 + (botIndex % 60),
      structure: 20 + (botIndex % 70),
    };
  }
  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, testerUserId));
  }

  const interests = buildBotInterests(botIndex);
  await db.delete(userInterests).where(eq(userInterests.userId, testerUserId));
  await db.insert(userInterests).values({
    userId: testerUserId,
    totalHeat: interests.totalHeat,
    totalSelections: interests.totalSelections,
    categoryHeat: interests.categoryHeat,
    selections: interests.selections,
    topPriorities: interests.topPriorities,
  });
}

export async function seedMatchingTestBots(
  poolId: string,
  testerUserId: string
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
        hometownRegionCity: city,
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
        // NOTE: matching no longer reads vibeVector (dead branch removed 2026-08); kept for bot profile realism only.
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
          hometownRegionCity: city,
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
          // NOTE: matching no longer reads vibeVector (dead branch removed 2026-08); kept for bot profile realism only.
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

    await db.delete(userInterests).where(eq(userInterests.userId, user.id));
    await db.insert(userInterests).values({
      userId: user.id,
      totalHeat: interests.totalHeat,
      totalSelections: interests.totalSelections,
      categoryHeat: interests.categoryHeat,
      selections: interests.selections,
      topPriorities: interests.topPriorities,
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

  // Register the tester as the final seat so the pool reaches minGroupSize and
  // `match` can run end-to-end without depending on wechatOpenId / mock payment
  // / async fulfillment. Mirrors the bot registration payload. Reset any prior
  // tester registration first (a previous 0-group match marks candidates
  // "unmatched"; without the reset the tester is stuck out of the candidate set).
  const [testerPool] = await db
    .select({ district: eventPools.district })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);
  await db
    .delete(eventPoolRegistrations)
    .where(and(eq(eventPoolRegistrations.poolId, poolId), eq(eventPoolRegistrations.userId, testerUserId)));
  await db
    .insert(eventPoolRegistrations)
    .values({
      poolId,
      userId: testerUserId,
      budgetRange: [pick(BUDGET_RANGES)],
      preferredLanguages: [pick(LANGUAGES), pick(LANGUAGES)],
      eventIntent: [pick(EVENT_INTENTS)],
      cuisinePreferences: [pick(CUISINE_PREFS), pick(CUISINE_PREFS)],
      dietaryRestrictions: [],
      tasteIntensity: ["不辣/清淡为主"],
      preferenceStrictness: 50,
      preferredDistricts: [testerPool?.district ?? pick(DISTRICTS["深圳"])],
      genderCompositionPreference: "balanced",
      acceptPairs: true,
      kolComfortLevel: "comfortable",
      matchStatus: "pending",
    });

  // Ensure the tester has a complete, bot-comparable profile so the matching
  // engine can score it above minPairScore and form a group.
  await seedTesterCompleteProfile(testerUserId, botUsers.length);

  logger.info("[MatchingTest] bots seeded", { poolId, botCount: botUsers.length, testerUserId });
  return { botUsers };
}

/**
 * Test-only post-match finalizer. The production match pipeline never writes
 * eventPoolGroups.finalDateTime (the column is read-only fallback territory —
 * the client uses `group.finalDateTime ?? pool.dateTime`), and venue
 * assignment only runs when the operator-review gate is open. This function
 * deterministically completes both so the squad-unboxing 今晚这桌 brief always
 * renders fully in test mode:
 *
 * - finalDateTime ← pool.dateTime for every group in the test pool
 * - venue fields ← the reserved test venue for groups still not 'assigned'
 *   (e.g. when matchingOperatorReviewEnabled held the side effects); a
 *   confirmed booking row is inserted so a later real assignment pass skips
 *   the group (existingBookingMap idempotency guard).
 *
 * Idempotent: safe to call after every match run.
 */
export async function finalizeMatchingTestGroups(
  poolId: string,
): Promise<{ groupsFinalized: number; venuesAssigned: number }> {
  assertMatchingTestMode();
  return finalizeTestPoolGroups(poolId);
}

/**
 * Ungated core of finalizeMatchingTestGroups, shared with the single-test
 * (单人调试局) path which runs under isSingleTestMode() rather than
 * isMatchingTestMode(). Callers must enforce their own test-mode gate.
 */
export async function finalizeTestPoolGroups(
  poolId: string,
): Promise<{ groupsFinalized: number; venuesAssigned: number }> {

  const [pool] = await db
    .select({
      id: eventPools.id,
      city: eventPools.city,
      district: eventPools.district,
      dateTime: eventPools.dateTime,
      isTestPool: eventPools.isTestPool,
    })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);

  if (!pool || !pool.isTestPool) {
    throw new Error("TEST_POOL_NOT_FOUND");
  }

  const groups = await db
    .select({
      id: eventPoolGroups.id,
      venueAssignmentStatus: eventPoolGroups.venueAssignmentStatus,
    })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));

  if (groups.length === 0) {
    return { groupsFinalized: 0, venuesAssigned: 0 };
  }

  const finalDateTime = pool.dateTime ?? nextDinnerDateTime();
  const venueId = await ensureMatchingTestVenue(pool.city, pool.district);
  const [venue] = await db
    .select()
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);

  const { dateStr: bookingDate, dayOfWeek } = parseEventDate(finalDateTime);
  const [slot] = await db
    .select({ id: venueTimeSlots.id })
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      eq(venueTimeSlots.dayOfWeek, dayOfWeek),
      eq(venueTimeSlots.isActive, true),
    ))
    .limit(1);

  let venuesAssigned = 0;

  for (const group of groups) {
    const needsVenue = group.venueAssignmentStatus !== "assigned";

    await db
      .update(eventPoolGroups)
      .set({
        finalDateTime,
        ...(needsVenue && venue
          ? {
              venueId: venue.id,
              venueName: venue.brandName || venue.name,
              venueAddress: venue.address,
              venueAssignmentStatus: "assigned",
              venueAssignmentReason: null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventPoolGroups.id, group.id));

    if (needsVenue && venue) {
      venuesAssigned++;

      if (slot) {
        const [existingBooking] = await db
          .select({ id: venueTimeSlotBookings.id })
          .from(venueTimeSlotBookings)
          .where(and(
            eq(venueTimeSlotBookings.eventGroupId, group.id),
            eq(venueTimeSlotBookings.status, "confirmed"),
          ))
          .limit(1);

        if (!existingBooking) {
          await db.insert(venueTimeSlotBookings).values({
            venueId: venue.id,
            timeSlotId: slot.id,
            eventPoolId: poolId,
            eventGroupId: group.id,
            bookingDate,
            status: "confirmed",
          });
        }
      }
    }
  }

  logger.info("[MatchingTest] groups finalized", {
    poolId,
    groupsFinalized: groups.length,
    venuesAssigned,
  });
  return { groupsFinalized: groups.length, venuesAssigned };
}

export async function cleanupMatchingTestData(): Promise<{
  deletedPools: number;
  deletedRegistrations: number;
  deletedGroups: number;
  deletedBots: number;
  deletedIcebreakerSessions: number;
  deletedVenueBookings: number;
  deletedTestVenues: number;
}> {
  assertMatchingTestMode();

  const result = {
    deletedPools: 0,
    deletedRegistrations: 0,
    deletedGroups: 0,
    deletedBots: 0,
    deletedIcebreakerSessions: 0,
    deletedVenueBookings: 0,
    deletedTestVenues: 0,
  };

  await db.transaction(async (tx: DbTransaction) => {
    // Step 1: Find test pools
    const poolRows = await tx
      .select({ id: eventPools.id })
      .from(eventPools)
      .where(eq(eventPools.isTestPool, true));
    const poolIds = poolRows.map((p: { id: string }) => p.id);

    // Reserved test venues (matched by name — never reused for real venues).
    const testVenueRows = await tx
      .select({ id: venues.id })
      .from(venues)
      .where(eq(venues.name, MATCHING_TEST_VENUE_NAME));
    const testVenueIds = testVenueRows.map((v: { id: string }) => v.id);

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

      // Step 3.5: Delete test-venue bookings BEFORE groups — the
      // venue_time_slot_bookings.event_group_id FK references
      // event_pool_groups.id, so group deletion would violate it otherwise.
      if (testVenueIds.length > 0) {
        const deletedBookings = await tx
          .delete(venueTimeSlotBookings)
          .where(inArray(venueTimeSlotBookings.venueId, testVenueIds))
          .returning({ id: venueTimeSlotBookings.id });
        result.deletedVenueBookings = deletedBookings.length;
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

      // Step 5.5: Delete pool-scoped child tables that FK-reference the pool
      // (pool_ai_copy / pool_matching_logs), otherwise pool deletion violates
      // the pool_ai_copy_pool_id_event_pools_id_fk constraint.
      await tx.delete(poolAICopy).where(inArray(poolAICopy.poolId, poolIds));
      await tx.delete(poolMatchingLogs).where(inArray(poolMatchingLogs.poolId, poolIds));

      // Step 6: Delete pools
      const deletedPools = await tx
        .delete(eventPools)
        .where(inArray(eventPools.id, poolIds))
        .returning({ id: eventPools.id });
      result.deletedPools = deletedPools.length;
    }

    // Step 7: Delete test-venue slots + venues (slots reference venues).
    if (testVenueIds.length > 0) {
      await tx.delete(venueTimeSlots).where(inArray(venueTimeSlots.venueId, testVenueIds));
      const deletedVenues = await tx
        .delete(venues)
        .where(inArray(venues.id, testVenueIds))
        .returning({ id: venues.id });
      result.deletedTestVenues = deletedVenues.length;
    }

    // Step 9: Delete bot users themselves (separate from pool scope so cleanup
    // works even if no test pools exist yet)
    const botUserRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isTestBot, true), like(users.phoneNumber, `${MATCHING_TEST_PHONE_PREFIX}%`)));
    const allBotIds = botUserRows.map((b: { id: string }) => b.id);

    if (allBotIds.length > 0) {
      // Catalog-driven recursive cascade delete (see fkCascadeDelete): covers all
      // non-cascade FK references to users.id, not just the three hand-picked
      // tables that previously left registrations / blind_box_events / etc. behind.
      await cascadeDeleteByIds(tx, "users", "id", allBotIds);
      result.deletedBots = allBotIds.length;
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
