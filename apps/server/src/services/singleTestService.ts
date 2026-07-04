import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  eventPools,
  eventPoolGroups,
  eventPoolRegistrations,
  socialIcebreakerSessions,
  socialIcebreakerParticipants,
  socialIcebreakerLieTruths,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { logger } from "../lib/logger";
import { ARCHETYPE_DEFINITIONS } from "@shared/personality/archetypeNames";
import { cleanupBotFillUsers } from "./botFillService";

const VIRTUAL_PHONE_PREFIX = "+861399999";
const SINGLE_TEST_POOL_TITLE = "单人调试局";
const COMMON_PASSWORD = "test123456";
const VIRTUAL_USER_COUNT = 100;
const BOT_COUNT = 5;

const CITIES = ["深圳", "香港", "广州", "北京", "上海"];
const GENDERS = ["女性", "男性", "不透露"];
const EDUCATION_LEVELS = ["博士", "硕士", "本科", "大专", "高中及以下"];
const LIFE_STAGES = ["学生党", "职场新人", "职场老手", "创业中", "自由职业"];
const INTENTS = ["networking", "friends", "discussion", "fun", "romance", "flexible"];

const VIRTUAL_NAMES = [
  "艾米丽", "小王子", "星星", "月光", "云朵", "清风", "晨曦", "晚霞",
  "晴天", "雨天", "雪花", "彩虹", "小溪", "山川", "大海", "森林",
  "草原", "沙漠", "极光", "流星", "银河", "彗星", "恒星", "行星",
  "樱花", "荷花", "梅花", "兰花", "菊花", "玫瑰", "茉莉", "百合",
  "丹顶鹤", "孔雀", "燕子", "百灵鸟", "黄鹂", "鹦鹉", "喜鹊", "鸳鸯",
  "北极熊", "熊猫", "长颈鹿", "狮子", "老虎", "斑马", "羚羊", "骆驼",
  "金鱼", "锦鲤", "龙鱼", "神仙鱼", "小丑鱼", "蝴蝶鱼", "天使鱼", "灯笼鱼",
  "枫叶", "银杏", "松树", "竹子", "柳树", "榕树", "梧桐", "白杨",
  "茉莉", "蔷薇", "丁香", "丹桂", "海棠", "木兰", "紫藤", "杜鹃",
  "萤火虫", "蝴蝶", "蜜蜂", "蜻蜓", "螳螂", "蝉", "瓢虫", "蚂蚁",
  "水晶", "琥珀", "玛瑙", "翡翠", "钻石", "珍珠", "玉石", "宝石",
  "芝士", "奶茶", "咖啡", "布丁", "蛋糕", "糖果", "饼干", "冰淇淋",
  "糯米", "年糕", "豆沙", "芝麻", "花生", "核桃", "杏仁", "腰果",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateBirthdate(): string {
  const year = 1985 + Math.floor(Math.random() * 20);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function ensureVirtualUsers(): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`));

  if (existing.length >= VIRTUAL_USER_COUNT) {
    logger.info("[SingleTest] Virtual users already seeded", { count: existing.length });
    return;
  }

  const passwordHash = await bcrypt.hash(COMMON_PASSWORD, 10);
  const archetypeIds = ARCHETYPE_DEFINITIONS.map(a => a.id);
  const namesToUse = shuffle(VIRTUAL_NAMES);

  const values = [];
  for (let i = existing.length; i < VIRTUAL_USER_COUNT && (i - existing.length) < namesToUse.length; i++) {
    values.push({
      phoneNumber: `${VIRTUAL_PHONE_PREFIX}${String(i).padStart(4, '0')}`,
      password: passwordHash,
      displayName: namesToUse[i - existing.length] ?? `虚拟用户${i}`,
      gender: pick(GENDERS),
      currentCity: pick(CITIES),
      birthdate: generateBirthdate(),
      primaryArchetype: pick(archetypeIds),
      educationLevel: pick(EDUCATION_LEVELS),
      lifeStage: pick(LIFE_STAGES),
      intent: [pick(INTENTS), pick(INTENTS)],
      hasCompletedProfileSetup: true,
      hasCompletedPersonalityTest: true,
      hasCompletedRegistration: true,
    });
  }

  if (values.length > 0) {
    await db.insert(users).values(values).onConflictDoNothing();
    logger.info("[SingleTest] Created virtual users", { count: values.length });
  }
}

export async function ensureSingleTestPool(createdBy: string): Promise<string> {
  const [existing] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(eq(eventPools.title, SINGLE_TEST_POOL_TITLE))
    .limit(1);

  if (existing) return existing.id;

  const now = new Date();
  const [pool] = await db
    .insert(eventPools)
    .values({
      title: SINGLE_TEST_POOL_TITLE,
      description: "单人调试用活动池 — 仅限测试模式",
      eventType: "饭局",
      city: "深圳",
      district: "南山区",
      dateTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000),
      status: "active",
      minGroupSize: 3,
      maxGroupSize: 6,
      targetGroups: 1,
      createdBy,
    })
    .returning({ id: eventPools.id });

  logger.info("[SingleTest] Created pool", { poolId: pool.id });
  return pool.id;
}

/** Like ensureSingleTestPool but cleans existing registrations + groups first. */
async function ensureCleanSingleTestPool(createdBy: string): Promise<string> {
  const poolId = await ensureSingleTestPool(createdBy);
  await db.delete(eventPoolRegistrations).where(eq(eventPoolRegistrations.poolId, poolId));
  await db.delete(eventPoolGroups).where(eq(eventPoolGroups.poolId, poolId));
  return poolId;
}

interface VirtualUserRow {
  id: string;
  displayName: string | null;
  primaryArchetype: string | null;
}

export async function startSingleTestSession(testerUserId: string): Promise<{
  socialSessionId: string;
  groupId: string;
  botUsers: { userId: string; displayName: string; archetype: string }[];
}> {
  // Phase 1: ensure virtual users + pool (fresh each time)
  await ensureVirtualUsers();
  const poolId = await ensureCleanSingleTestPool(testerUserId);

  // Pick 5 bots with diverse archetypes
  const virtualUsers = (await db
    .select({ id: users.id, displayName: users.displayName, primaryArchetype: users.primaryArchetype })
    .from(users)
    .where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`))) as VirtualUserRow[];

  if (virtualUsers.length < BOT_COUNT) {
    throw new Error("INSUFFICIENT_VIRTUAL_USERS");
  }

  const bots = shuffle(virtualUsers).slice(0, BOT_COUNT);

  // Register tester + bots
  await db.insert(eventPoolRegistrations)
    .values({ userId: testerUserId, poolId, matchStatus: "pending" })
    .onConflictDoNothing();

  for (const bot of bots) {
    await db.insert(eventPoolRegistrations)
      .values({ userId: bot.id, poolId, matchStatus: "pending" })
      .onConflictDoNothing();
  }

  // Direct group creation (skip matching — virtual users lack full profiles
  // for the deterministic scoring engine). The purpose of single-test sessions
  // is icebreaker testing, not matching verification.
  const allMemberIds = [testerUserId, ...bots.map(b => b.id)];
  const [groupRecord] = await db
    .insert(eventPoolGroups)
    .values({
      poolId,
      groupNumber: 1,
      memberIds: allMemberIds,
      overallScore: 85,
      status: "matched",
    })
    .returning({ id: eventPoolGroups.id });

  if (!groupRecord) {
    throw new Error("GROUP_NOT_PERSISTED");
  }

  const groupId = groupRecord.id;

  // Mark all registrations as matched + assign to the group (required for
  // getSocialIcebreakerAccess which checks assignedGroupId on registration)
  await db
    .update(eventPoolRegistrations)
    .set({ matchStatus: "matched", assignedGroupId: groupId })
    .where(and(eq(eventPoolRegistrations.poolId, poolId), eq(eventPoolRegistrations.matchStatus, "pending")));

  // Build bot user info
  const botUsers = bots.map((b: VirtualUserRow) => ({
    userId: b.id,
    displayName: b.displayName ?? "Bot",
    archetype: b.primaryArchetype ?? 'corgi',
  }));

  const socialSessionId = `social_${groupId}`;
  logger.info("[SingleTest] Session ready", { groupId, socialSessionId, botCount: botUsers.length });
  return { socialSessionId, groupId, botUsers };
}

export async function cleanupSingleTestData(): Promise<void> {
  await cleanupBotFillUsers();

  const [pool] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(eq(eventPools.title, SINGLE_TEST_POOL_TITLE))
    .limit(1);

  if (pool) {
    const groupRows = await db
      .select({ id: eventPoolGroups.id })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.poolId, pool.id));

    for (const g of groupRows) {
      const sid = `social_${g.id}`;
      await db.delete(socialIcebreakerParticipants).where(eq(socialIcebreakerParticipants.socialSessionId, sid));
      await db.delete(socialIcebreakerLieTruths).where(eq(socialIcebreakerLieTruths.socialSessionId, sid));
      await db.delete(socialIcebreakerSessions).where(eq(socialIcebreakerSessions.icebreakerSessionId, g.id));
    }

    await db.delete(eventPoolRegistrations).where(eq(eventPoolRegistrations.poolId, pool.id));
    await db.delete(eventPoolGroups).where(eq(eventPoolGroups.poolId, pool.id));
    await db.delete(eventPools).where(eq(eventPools.id, pool.id));
  }

  await db.delete(users).where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`));
  logger.info("[SingleTest] Cleanup complete");
}
