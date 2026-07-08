import { and, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../db";
import {
  eventAttendance,
  eventCreditRedemptions,
  eventGroupOutcomes,
  users,
  eventPools,
  eventPoolGroups,
  eventPoolRegistrations,
  invitationUses,
  matchHistory,
  socialIcebreakerSessions,
  socialIcebreakerParticipants,
  socialIcebreakerLieTruths,
  socialIcebreakerAiFeedback,
  socialIcebreakerPhasePulseChecks,
  socialIcebreakerPhaseMetrics,
  socialIcebreakerMiniscriptSecrets,
  momentCardInteractions,
  userInterests,
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { logger } from "../lib/logger";
import {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_CANONICAL_ORDER,
  ARCHETYPE_BY_ID,
} from "@shared/personality/archetypeNames";
import {
  singleTestStateSchema,
  type SingleTestState,
  type SingleTestBot,
  type SingleTestBotPersona,
} from "@shared/socialIcebreaker";
import { isSingleTestMode } from "../lib/isSingleTestMode";
import { isSocialIcebreakerTestMode } from "../lib/isSocialIcebreakerTestMode";
import { cleanupBotFillUsers } from "./botFillService";

type IdRow = { id: string };

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

/** Simple deterministic string hash (non-cryptographic). Used to derive a stable
 *  archetype mix from a groupId without adding DB state. Returns an unsigned
 *  32-bit integer so modulo selection never sees a negative value. */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash >>> 0;
}

/** Pick BOT_COUNT bots with distinct archetypes when possible, deterministically
 *  keyed by groupId so the same test group always gets the same archetype mix. */
export function pickDiverseBots(virtualUsers: VirtualUserRow[], groupId: string): VirtualUserRow[] {
  const byArchetype = new Map<string, VirtualUserRow[]>();
  for (const u of virtualUsers) {
    const archetypeId = u.primaryArchetype ?? 'corgi';
    if (!byArchetype.has(archetypeId)) byArchetype.set(archetypeId, []);
    byArchetype.get(archetypeId)!.push(u);
  }

  const archetypeIds = ARCHETYPE_CANONICAL_ORDER;
  const startIndex = simpleHash(groupId) % archetypeIds.length;
  const selected: VirtualUserRow[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < BOT_COUNT; i++) {
    const archetypeId = archetypeIds[(startIndex + i) % archetypeIds.length];
    const candidates = byArchetype.get(archetypeId) ?? [];
    const pickIndex = simpleHash(`${groupId}:${archetypeId}`) % Math.max(candidates.length, 1);
    const candidate = candidates[pickIndex];
    if (candidate && !usedIds.has(candidate.id)) {
      selected.push(candidate);
      usedIds.add(candidate.id);
    }
  }

  // Fill any remaining slots (e.g. not enough virtual users for full diversity)
  if (selected.length < BOT_COUNT) {
    const remaining = shuffle(virtualUsers).filter((u) => !usedIds.has(u.id));
    for (const u of remaining.slice(0, BOT_COUNT - selected.length)) {
      selected.push(u);
      usedIds.add(u.id);
    }
  }

  return selected;
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
    const primaryArchetype = pick(archetypeIds);
    const archetypeDef = ARCHETYPE_BY_ID[primaryArchetype];
    values.push({
      phoneNumber: `${VIRTUAL_PHONE_PREFIX}${String(i).padStart(4, '0')}`,
      password: passwordHash,
      displayName: namesToUse[i - existing.length] ?? `虚拟用户${i}`,
      gender: pick(GENDERS),
      currentCity: pick(CITIES),
      birthdate: generateBirthdate(),
      primaryArchetype,
      archetype: archetypeDef?.nameCn ?? primaryArchetype,
      educationLevel: pick(EDUCATION_LEVELS),
      lifeStage: pick(LIFE_STAGES),
      intent: [pick(INTENTS), pick(INTENTS)],
    hasCompletedProfileSetup: true,
    hasCompletedPersonalityTest: true,
    hasCompletedRegistration: true,
    isTestBot: true,
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

  if (existing) {
    await db.update(eventPools).set({ isTestPool: true }).where(eq(eventPools.id, existing.id));
    return existing.id;
  }

  const now = new Date();
  const [pool] = await db
    .insert(eventPools)
    .values({
      title: SINGLE_TEST_POOL_TITLE,
      description: "单人调试用活动池 — 仅限测试模式",
      isTestPool: true,
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
  await cleanupSingleTestPoolRows(poolId, { deletePool: false });
  return poolId;
}

interface VirtualUserRow {
  id: string;
  displayName: string | null;
  primaryArchetype: string | null;
  archetype: string | null;
}

export async function startSingleTestSession(testerUserId: string): Promise<{
  socialSessionId: string;
  groupId: string;
  testerRegistrationId: string;
  registrationId: string;
  bots: SingleTestBot[];
  botPersonas: SingleTestBotPersona[];
}> {
  // Phase 1: ensure virtual users + pool (fresh each time)
  await ensureVirtualUsers();
  const poolId = await ensureCleanSingleTestPool(testerUserId);

  // Generate the group id up-front so bot selection can be deterministic by groupId.
  const groupId = crypto.randomUUID();

  // Pick 5 bots with diverse archetypes (deterministic by groupId)
  const virtualUsers = (await db
    .select({
      id: users.id,
      displayName: users.displayName,
      primaryArchetype: users.primaryArchetype,
      archetype: users.archetype,
    })
    .from(users)
    .where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`))) as VirtualUserRow[];

  if (virtualUsers.length < BOT_COUNT) {
    throw new Error("INSUFFICIENT_VIRTUAL_USERS");
  }

  const bots = pickDiverseBots(virtualUsers, groupId);

  logger.info("social_icebreaker_test_mode_bot_roster_seeded", {
    groupId,
    botCount: bots.length,
    botArchetypes: bots.map((b) => b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn),
  });

  // Register tester + bots
  const [insertedTesterRegistration] = await db.insert(eventPoolRegistrations)
    .values({ userId: testerUserId, poolId, matchStatus: "pending" })
    .onConflictDoNothing()
    .returning({ id: eventPoolRegistrations.id });

  const [testerRegistration] = insertedTesterRegistration
    ? [insertedTesterRegistration]
    : await db
      .select({ id: eventPoolRegistrations.id })
      .from(eventPoolRegistrations)
      .where(and(eq(eventPoolRegistrations.userId, testerUserId), eq(eventPoolRegistrations.poolId, poolId)))
      .limit(1);

  if (!testerRegistration) {
    throw new Error("TESTER_REGISTRATION_NOT_PERSISTED");
  }

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
      id: groupId,
      poolId,
      groupNumber: 1,
      memberCount: allMemberIds.length,
      overallScore: 85,
      status: "confirmed",
    })
    .returning({ id: eventPoolGroups.id });

  if (!groupRecord) {
    throw new Error("GROUP_NOT_PERSISTED");
  }

  // Mark all registrations as matched + assign to the group (required for
  // getSocialIcebreakerAccess which checks assignedGroupId on registration)
  await db
    .update(eventPoolRegistrations)
    .set({ matchStatus: "matched", assignedGroupId: groupId })
    .where(and(eq(eventPoolRegistrations.poolId, poolId), eq(eventPoolRegistrations.matchStatus, "pending")));

  // Build client-safe bot roster and server-side persona mapping.
  // Raw users.id must never leave the server boundary.
  const selectedBots = bots;
  const clientBots: SingleTestBot[] = selectedBots.map((b: VirtualUserRow, index: number) => ({
    botId: `bot-${index + 1}`,
    displayName: b.displayName ?? "Bot",
    archetype: b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn ?? "社牛柯基",
  }));
  const botPersonas: SingleTestBotPersona[] = selectedBots.map((b: VirtualUserRow, index: number) => ({
    botId: `bot-${index + 1}`,
    userId: b.id,
    displayName: b.displayName ?? "Bot",
    archetype: b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn ?? "社牛柯基",
  }));

  const socialSessionId = `social_${groupId}`;
  logger.info("social_icebreaker_test_mode_session_ready", {
    groupId,
    socialSessionId,
    registrationId: testerRegistration.id,
    botCount: clientBots.length,
    botArchetypes: clientBots.map((b) => b.archetype),
  });
  return { socialSessionId, groupId, testerRegistrationId: testerRegistration.id, registrationId: testerRegistration.id, bots: clientBots, botPersonas };
}

/** Build a client-safe roster for a single-test group.
 *  Returns null if the group is not a single-test group or not in test mode. */
export async function getSingleTestBotRosterForClient(groupId: string): Promise<{ bots: SingleTestBot[]; personas: SingleTestBotPersona[] } | null> {
  if (!isSingleTestMode()) return null;

  const [group] = await db
    .select({ poolId: eventPoolGroups.poolId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, groupId))
    .limit(1);

  if (!group) return null;

  const [pool] = await db
    .select({ title: eventPools.title })
    .from(eventPools)
    .where(eq(eventPools.id, group.poolId))
    .limit(1);

  if (pool?.title !== SINGLE_TEST_POOL_TITLE) return null;

  const registrationRows: Array<{ userId: string | null; registeredAt: Date }> = await db
    .select({ userId: eventPoolRegistrations.userId, registeredAt: eventPoolRegistrations.registeredAt })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.assignedGroupId, groupId))
    .orderBy(eventPoolRegistrations.registeredAt);

  const botUserIds = registrationRows
    .map((r: { userId: string | null; registeredAt: Date }) => r.userId)
    .filter((id: string | null): id is string => typeof id === "string");

  if (botUserIds.length === 0) return { bots: [], personas: [] };

  const botRows: Array<{
    id: string;
    displayName: string | null;
    archetype: string | null;
    primaryArchetype: string | null;
  }> = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      archetype: users.archetype,
      primaryArchetype: users.primaryArchetype,
    })
    .from(users)
    .where(and(inArray(users.id, botUserIds), like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`)));

  const botById = new Map(botRows.map((b) => [b.id, b]));
  const orderedBots = botUserIds.map((id) => botById.get(id)).filter((b): b is typeof botRows[number] => !!b);

  const bots: SingleTestBot[] = orderedBots.map((b: { id: string; displayName: string | null; archetype: string | null; primaryArchetype: string | null }, index: number) => ({
    botId: `bot-${index + 1}`,
    displayName: b.displayName ?? "Bot",
    archetype: b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn ?? "社牛柯基",
  }));
  const personas: SingleTestBotPersona[] = orderedBots.map((b: { id: string; displayName: string | null; archetype: string | null; primaryArchetype: string | null }, index: number) => ({
    botId: `bot-${index + 1}`,
    userId: b.id,
    displayName: b.displayName ?? "Bot",
    archetype: b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn ?? "社牛柯基",
  }));

  return { bots, personas };
}

/** Returns validated single-test metadata for a new social session, or null if
 *  the group is not a single-test group or the server is not in test mode. */
export async function getSingleTestMetaForSessionStart(groupId: string): Promise<SingleTestState | null> {
  if (!isSingleTestMode()) return null;

  const result = await getSingleTestBotRosterForClient(groupId);
  if (!result) return null;
  const { bots, personas } = result;

  const runBots = isSocialIcebreakerTestMode();

  const payload = {
    version: 2 as const,
    groupId,
    isTestModeSkip: true,
    runBots,
    bots,
    botPersonas: personas,
  };

  // Validate on write so persisted state_json is always schema-compliant.
  return singleTestStateSchema.parse(payload);
}

async function cleanupSingleTestPoolRows(
  poolId: string,
  { deletePool }: { deletePool: boolean },
): Promise<{
  deletedRegistrations: number;
  deletedGroups: number;
  deletedSocialSessions: number;
}> {
  const registrationRows = await db
    .select({ id: eventPoolRegistrations.id })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId));
  const registrationIds = registrationRows.map((row: IdRow) => row.id);

  const groupRows = await db
    .select({ id: eventPoolGroups.id })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));
  const groupIds = groupRows.map((row: IdRow) => row.id);

  let deletedSocialSessions = 0;

  if (groupIds.length > 0) {
    const socialSessionRows = await db
      .select({ id: socialIcebreakerSessions.id })
      .from(socialIcebreakerSessions)
      .where(inArray(socialIcebreakerSessions.icebreakerSessionId, groupIds));
    const socialSessionIds = socialSessionRows.map((row: IdRow) => row.id);

    if (socialSessionIds.length > 0) {
      await db
        .delete(socialIcebreakerMiniscriptSecrets)
        .where(inArray(socialIcebreakerMiniscriptSecrets.socialSessionId, socialSessionIds));
      await db
        .delete(socialIcebreakerPhaseMetrics)
        .where(inArray(socialIcebreakerPhaseMetrics.socialSessionId, socialSessionIds));
      await db
        .delete(socialIcebreakerPhasePulseChecks)
        .where(inArray(socialIcebreakerPhasePulseChecks.socialSessionId, socialSessionIds));
      await db
        .delete(momentCardInteractions)
        .where(inArray(momentCardInteractions.socialSessionId, socialSessionIds));
      await db
        .delete(socialIcebreakerAiFeedback)
        .where(inArray(socialIcebreakerAiFeedback.socialSessionId, socialSessionIds));
      await db
        .delete(socialIcebreakerLieTruths)
        .where(inArray(socialIcebreakerLieTruths.socialSessionId, socialSessionIds));
      await db
        .delete(socialIcebreakerParticipants)
        .where(inArray(socialIcebreakerParticipants.socialSessionId, socialSessionIds));
      const deleted = await db
        .delete(socialIcebreakerSessions)
        .where(inArray(socialIcebreakerSessions.id, socialSessionIds))
        .returning({ id: socialIcebreakerSessions.id });
      deletedSocialSessions = deleted.length;
    }

    await db.delete(eventGroupOutcomes).where(inArray(eventGroupOutcomes.groupId, groupIds));
  }

  if (registrationIds.length > 0) {
    await db.delete(eventCreditRedemptions).where(inArray(eventCreditRedemptions.registrationId, registrationIds));
    await db.delete(invitationUses).where(inArray(invitationUses.poolRegistrationId, registrationIds));
  }

  const deletedRegistrations = await db
    .delete(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId))
    .returning({ id: eventPoolRegistrations.id });
  const deletedGroups = await db
    .delete(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId))
    .returning({ id: eventPoolGroups.id });

  if (deletePool) {
    await db.delete(eventPools).where(eq(eventPools.id, poolId));
  }

  return {
    deletedRegistrations: deletedRegistrations.length,
    deletedGroups: deletedGroups.length,
    deletedSocialSessions,
  };
}

export async function cleanupSingleTestData(): Promise<{
  deletedRegistrations: number;
  deletedGroups: number;
  deletedSocialSessions: number;
  deletedVirtualUsers: number;
  deletedBotFillUsers: number;
}> {
  const botFillCleanup = await cleanupBotFillUsers();
  let poolCleanup = {
    deletedRegistrations: 0,
    deletedGroups: 0,
    deletedSocialSessions: 0,
  };

  const [pool] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(eq(eventPools.title, SINGLE_TEST_POOL_TITLE))
    .limit(1);

  if (pool) {
    poolCleanup = await cleanupSingleTestPoolRows(pool.id, { deletePool: true });
  }

  const virtualUserRows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`));
  const virtualUserIds = virtualUserRows.map((row: IdRow) => row.id);

  let deletedVirtualUsers = 0;
  if (virtualUserIds.length > 0) {
    await db
      .delete(matchHistory)
      .where(or(inArray(matchHistory.user1Id, virtualUserIds), inArray(matchHistory.user2Id, virtualUserIds)));
    await db.delete(eventAttendance).where(inArray(eventAttendance.userId, virtualUserIds));
    await db.delete(userInterests).where(inArray(userInterests.userId, virtualUserIds));
    const deleted = await db.delete(users).where(inArray(users.id, virtualUserIds)).returning({ id: users.id });
    deletedVirtualUsers = deleted.length;
  }

  const result = {
    ...poolCleanup,
    deletedVirtualUsers,
    deletedBotFillUsers: botFillCleanup.deletedBots,
  };
  logger.info("[SingleTest] Cleanup complete", result);
  return result;
}
