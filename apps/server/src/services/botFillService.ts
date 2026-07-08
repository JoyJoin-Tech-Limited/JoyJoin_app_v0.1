import { inArray, like, or } from "drizzle-orm";
import { db } from "../db";
import {
  eventAttendance,
  eventCreditRedemptions,
  eventPoolRegistrations,
  eventPools,
  invitationUses,
  matchHistory,
  userInterests,
  users,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { logger } from "../lib/logger";
import { isBotFillForTestingEnabled } from "../lib/isSingleTestMode";
import { ARCHETYPE_DEFINITIONS } from "@shared/personality/archetypeNames";
import { INTEREST_TAXONOMY } from "@shared/interests";

export const BOT_FILL_PHONE_PREFIX = "+8613999988";

type EventPoolRow = typeof eventPools.$inferSelect;
type PendingRegistration = typeof eventPoolRegistrations.$inferSelect;

const BOT_COMMON_PASSWORD = "test123456";
const BOT_NAMES = ["阿舟", "小檀", "晴川", "鹿鸣", "星禾", "南栀"];
const INDUSTRY_TIERS = [
  { category: "tech", categoryLabel: "科技互联网", segment: "ai", segmentLabel: "人工智能", niche: "ai_product", nicheLabel: "AI产品" },
  { category: "finance", categoryLabel: "金融", segment: "vc_pe", segmentLabel: "VC/PE", niche: "early_stage_vc", nicheLabel: "早期投资" },
  { category: "creative", categoryLabel: "文创传媒", segment: "content", segmentLabel: "内容创作", niche: "brand_content", nicheLabel: "品牌内容" },
  { category: "consulting", categoryLabel: "咨询", segment: "strategy", segmentLabel: "战略咨询", niche: "digital_strategy", nicheLabel: "数字战略" },
] as const;

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

function stableDigits(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(hash % 1000000).padStart(6, "0");
}

function birthdateForIndex(index: number): string {
  const year = 1990 + (index % 10);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 28) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildBotInterests(botIndex: number) {
  const active = INTEREST_TAXONOMY.filter((interest) => interest.active);
  const selections = Array.from({ length: Math.min(5, active.length) }, (_, i) => {
    const interest = active[(botIndex + i * 7) % active.length];
    return {
      topicId: interest.id,
      emoji: interest.riasec,
      label: interest.label,
      fullName: interest.label,
      category: interest.macroCategory,
      categoryId: interest.macroCategory,
      level: i < 2 ? 3 : i === 2 ? 2 : 1,
      heat: i < 2 ? 85 : i === 2 ? 60 : 35,
    };
  });

  const categoryHeat: Record<string, number> = {};
  for (const selection of selections) {
    categoryHeat[selection.category] = (categoryHeat[selection.category] ?? 0) + selection.heat;
  }

  return {
    totalHeat: selections.reduce((sum, selection) => sum + selection.heat, 0),
    totalSelections: selections.length,
    categoryHeat,
    selections,
    topPriorities: selections.filter((selection) => selection.level === 3).map((selection) => ({
      topicId: selection.topicId,
      label: selection.label,
      heat: selection.heat,
    })),
  };
}

export function shouldFillBotsForTesting(params: {
  pool: Pick<EventPoolRow, "isTestPool">;
  pendingUsersCount: number;
  minGroupSize: number;
}): boolean {
  return Boolean(
    isBotFillForTestingEnabled() &&
      params.pool.isTestPool === true &&
      params.pendingUsersCount > 0 &&
      params.pendingUsersCount < params.minGroupSize,
  );
}

export async function fillBotsForTesting(params: {
  pool: EventPoolRow;
  pendingRegistrations: PendingRegistration[];
  minGroupSize: number;
}): Promise<{ filledCount: number; botUserIds: string[] }> {
  const pendingUsersCount = params.pendingRegistrations.length;
  if (!shouldFillBotsForTesting({ pool: params.pool, pendingUsersCount, minGroupSize: params.minGroupSize })) {
    return { filledCount: 0, botUserIds: [] };
  }

  const botCount = params.minGroupSize - pendingUsersCount;
  const passwordHash = await bcrypt.hash(BOT_COMMON_PASSWORD, 10);
  const poolDigits = stableDigits(params.pool.id);
  const botUserIds: string[] = [];

  for (let i = 0; i < botCount; i++) {
    const globalIndex = pendingUsersCount + i;
    const phoneNumber = `${BOT_FILL_PHONE_PREFIX}${poolDigits}${String(i).padStart(2, "0")}`;
    const archetype = pick(ARCHETYPE_DEFINITIONS, globalIndex).id;
    const secondaryArchetype = pick(ARCHETYPE_DEFINITIONS, globalIndex + 1).id;
    const industry = pick(INDUSTRY_TIERS, globalIndex);
    const interests = buildBotInterests(globalIndex);

    const [user] = await db
      .insert(users)
      .values({
        phoneNumber,
        password: passwordHash,
        displayName: `测试搭子${pick(BOT_NAMES, globalIndex)}`,
        gender: globalIndex % 2 === 0 ? "女性" : "男性",
        currentCity: params.pool.city,
        birthdate: birthdateForIndex(globalIndex),
        primaryArchetype: archetype,
        secondaryArchetype,
        educationLevel: globalIndex % 2 === 0 ? "本科" : "硕士",
        lifeStage: "职场老手",
        workMode: "employed",
        hometownAffinityOptin: true,
        intent: ["交朋友", "扩展人脉"],
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
        vibeVector: {
          energy: 55 + (globalIndex % 20),
          depth: 50 + (globalIndex % 25),
          play: 45 + (globalIndex % 30),
          structure: 40 + (globalIndex % 20),
        },
        ageMatchPreference: "相近",
        tableVibePreference: globalIndex % 2 === 0 ? "轻松聊天" : "深度交流",
      })
      .onConflictDoUpdate({
        target: users.phoneNumber,
        set: {
          displayName: `测试搭子${pick(BOT_NAMES, globalIndex)}`,
          currentCity: params.pool.city,
          primaryArchetype: archetype,
          secondaryArchetype,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });

    botUserIds.push(user.id);

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
        poolId: params.pool.id,
        userId: user.id,
        budgetRange: ["200-300"],
        preferredLanguages: ["普通话"],
        eventIntent: ["交朋友", "扩展人脉"],
        cuisinePreferences: params.pool.eventType === "酒局" ? ["酒吧"] : ["中餐", "粤菜"],
        dietaryRestrictions: [],
        tasteIntensity: ["适中"],
        matchStatus: "pending",
      })
      .onConflictDoNothing();
  }

  logger.info("[BotFill] created virtual users and pending registrations", {
    data: {
      poolId: params.pool.id,
      pendingUsersCount,
      minGroupSize: params.minGroupSize,
      filledCount: botCount,
      phonePrefix: BOT_FILL_PHONE_PREFIX,
    },
  });

  return { filledCount: botCount, botUserIds };
}

export async function cleanupBotFillUsers(): Promise<{ deletedBots: number }> {
  const botRows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.phoneNumber, `${BOT_FILL_PHONE_PREFIX}%`));
  const botIds = botRows.map((bot: { id: string }) => bot.id);

  if (botIds.length === 0) {
    return { deletedBots: 0 };
  }

  const registrationRows = await db
    .select({ id: eventPoolRegistrations.id })
    .from(eventPoolRegistrations)
    .where(inArray(eventPoolRegistrations.userId, botIds));
  const registrationIds = registrationRows.map((row: { id: string }) => row.id);

  if (registrationIds.length > 0) {
    await db.delete(eventCreditRedemptions).where(inArray(eventCreditRedemptions.registrationId, registrationIds));
    await db.delete(invitationUses).where(inArray(invitationUses.poolRegistrationId, registrationIds));
    await db.delete(eventPoolRegistrations).where(inArray(eventPoolRegistrations.id, registrationIds));
  }
  await db.delete(matchHistory).where(or(inArray(matchHistory.user1Id, botIds), inArray(matchHistory.user2Id, botIds)));
  await db.delete(eventAttendance).where(inArray(eventAttendance.userId, botIds));
  await db.delete(userInterests).where(inArray(userInterests.userId, botIds));
  const deleted = await db.delete(users).where(inArray(users.id, botIds)).returning({ id: users.id });

  logger.info("[BotFill] cleanup complete", { data: { deletedBots: deleted.length, phonePrefix: BOT_FILL_PHONE_PREFIX } });
  return { deletedBots: deleted.length };
}
