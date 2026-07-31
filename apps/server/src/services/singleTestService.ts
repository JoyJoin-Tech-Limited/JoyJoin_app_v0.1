import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { db } from "../db";
import {
  eventAttendance,
  eventCreditRedemptions,
  eventGroupOutcomes,
  events,
  blindBoxEvents,
  poolAICopy,
  poolMatchingLogs,
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
  preGenerationJobs,
  preGenerationResults,
  momentCardInteractions,
  notifications,
  userInterests,
  venueTimeSlotBookings,
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
import { finalizeTestPoolGroups, nextDinnerDateTime } from "./matchingTestService";

type IdRow = { id: string };
type DbTransaction = NodePgDatabase<typeof schema>;
type DbConnection = DbTransaction | typeof db;

const VIRTUAL_PHONE_PREFIX = "+861399999";
const SINGLE_TEST_POOL_TITLE = "单人调试局";
const COMMON_PASSWORD = "test123456";
const VIRTUAL_USER_COUNT = 100;
const BOT_COUNT = 5;
const TEST_AVATAR_CDN_BASE = "https://joyjoinapp.com/static/assets/icons/archetype";

export interface SingleTestBotBackground {
  interestsRankedTop3: string[];
  industryCategory: string;
  industryCategoryLabel: string;
  industrySegmentNew: string;
  industrySegmentLabel: string;
  industryNiche: string;
  industryNicheLabel: string;
  hometownRegionCity: string;
  socialStyle: string;
  educationLevel: string;
  relationshipStatus: string;
  lifeStage: string;
  bio: string;
}

const SINGLE_TEST_BOT_BACKGROUNDS: readonly SingleTestBotBackground[] = [
  {
    interestsRankedTop3: ["城市摄影", "独立电影", "周末徒步"],
    industryCategory: "media",
    industryCategoryLabel: "文化传媒",
    industrySegmentNew: "visual_content",
    industrySegmentLabel: "视觉内容",
    industryNiche: "documentary_photography",
    industryNicheLabel: "纪录片摄影",
    hometownRegionCity: "云南大理",
    socialStyle: "慢热但很会观察，熟悉后喜欢分享旅途中遇到的小故事",
    educationLevel: "本科",
    relationshipStatus: "single",
    lifeStage: "自由职业",
    bio: "常背着相机走街串巷，正在记录深圳凌晨四点的城市故事。",
  },
  {
    interestsRankedTop3: ["人工智能", "桌游推理", "手冲咖啡"],
    industryCategory: "tech",
    industryCategoryLabel: "科技互联网",
    industrySegmentNew: "ai_ml",
    industrySegmentLabel: "AI与机器学习",
    industryNiche: "ai_product",
    industryNicheLabel: "AI产品设计",
    hometownRegionCity: "湖北武汉",
    socialStyle: "理性直接，喜欢从一个好问题开始深入聊天，也乐于帮大家梳理思路",
    educationLevel: "硕士",
    relationshipStatus: "single",
    lifeStage: "职场老手",
    bio: "白天研究AI产品，晚上组织推理桌游，最近在练习辨认咖啡产区。",
  },
  {
    interestsRankedTop3: ["爵士乐", "自然酒", "旧书店"],
    industryCategory: "finance",
    industryCategoryLabel: "金融",
    industrySegmentNew: "sustainable_investment",
    industrySegmentLabel: "可持续投资",
    industryNiche: "impact_investing",
    industryNicheLabel: "影响力投资",
    hometownRegionCity: "四川成都",
    socialStyle: "温和健谈，擅长照顾安静的人，常用音乐和美食打开话题",
    educationLevel: "硕士",
    relationshipStatus: "in_relationship",
    lifeStage: "职场老手",
    bio: "关注有社会价值的小生意，收藏爵士黑胶，也爱在旧书页里找城市记忆。",
  },
  {
    interestsRankedTop3: ["攀岩", "科幻小说", "硬件制作"],
    industryCategory: "manufacturing",
    industryCategoryLabel: "先进制造",
    industrySegmentNew: "robotics",
    industrySegmentLabel: "机器人",
    industryNiche: "service_robotics",
    industryNicheLabel: "服务机器人研发",
    hometownRegionCity: "陕西西安",
    socialStyle: "行动派，刚见面话不多，但聊到动手项目或户外挑战会立刻来劲",
    educationLevel: "博士",
    relationshipStatus: "single",
    lifeStage: "职场新人",
    bio: "在做能进家庭的服务机器人，周末不是在攀岩馆，就是在修自己的小装置。",
  },
  {
    interestsRankedTop3: ["社区营造", "粤菜研究", "即兴喜剧"],
    industryCategory: "social_services",
    industryCategoryLabel: "社会服务",
    industrySegmentNew: "community_development",
    industrySegmentLabel: "社区发展",
    industryNiche: "community_program_design",
    industryNicheLabel: "社区活动策划",
    hometownRegionCity: "广东潮州",
    socialStyle: "外向有感染力，擅长把陌生人拉进同一个话题，也会主动给别人留表达空间",
    educationLevel: "本科",
    relationshipStatus: "married",
    lifeStage: "创业中",
    bio: "在城中村做青年社区项目，认真研究一桌粤菜怎样让陌生人自然熟起来。",
  },
] as const;

export function getSingleTestBotBackground(index: number): SingleTestBotBackground {
  return SINGLE_TEST_BOT_BACKGROUNDS[index % SINGLE_TEST_BOT_BACKGROUNDS.length];
}

const OPTIONAL_SINGLE_TEST_TABLES = {
  socialIcebreakerSessions: "social_icebreaker_sessions",
  preGenerationResults: "pre_generation_results",
  preGenerationJobs: "pre_generation_jobs",
  socialIcebreakerMiniscriptSecrets: "social_icebreaker_miniscript_secrets",
  socialIcebreakerPhaseMetrics: "social_icebreaker_phase_metrics",
  socialIcebreakerPhasePulseChecks: "social_icebreaker_phase_pulse_checks",
  momentCardInteractions: "moment_card_interactions",
  socialIcebreakerAiFeedback: "social_icebreaker_ai_feedback",
  socialIcebreakerLieTruths: "social_icebreaker_lie_truths",
  socialIcebreakerParticipants: "social_icebreaker_participants",
} as const;

const CITIES = ["深圳", "香港", "广州", "北京", "上海"];
const GENDERS = ["女性", "男性", "不透露"];
const EDUCATION_LEVELS = ["博士", "硕士", "本科", "大专", "高中及以下"];
const LIFE_STAGES = ["学生党", "职场新人", "职场老手", "创业中", "自由职业"];
const INTENTS = ["networking", "friends", "discussion", "fun", "explore", "flexible"];

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

function getSqlRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | undefined)?.rows;
  return Array.isArray(rows) ? rows : [];
}

async function tableExists(conn: DbConnection, tableName: string): Promise<boolean> {
  const result = await conn.execute(
    sql`select to_regclass(${`public.${tableName}`}) as table_name`,
  );
  const [row] = getSqlRows<{ table_name: string | null }>(result);
  return Boolean(row?.table_name);
}

async function deleteIfTableExists(
  conn: DbConnection,
  tableName: string,
  deleteRows: () => Promise<unknown>,
): Promise<void> {
  if (await tableExists(conn, tableName)) {
    await deleteRows();
    return;
  }

  logger.warn("[SingleTest] Skipping cleanup for missing optional table", { tableName });
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

export function buildSingleTestBotAvatarUrl(groupId: string, index: number): string {
  const avatarIndex = (simpleHash(groupId) + index) % ARCHETYPE_CANONICAL_ORDER.length;
  const avatarId = ARCHETYPE_CANONICAL_ORDER[avatarIndex] ?? "corgi";
  return `${TEST_AVATAR_CDN_BASE}/archetype-${avatarId}-head.webp`;
}

/** Curated group themes for single-test sessions. The production match commit
 *  generates these via LLM; the test path picks deterministically by groupId
 *  so the squad-unboxing 今晚这桌 theme row always has content without an AI
 *  call. */
const SINGLE_TEST_GROUP_THEMES = [
  { theme: "深夜食堂：一桌人的城市故事", subtitle: "从粤菜聊到凌晨四点的深圳", themeEmoji: "🍲", vibe: "温暖慢热 (85分)" },
  { theme: "高能充电站：周末出逃计划", subtitle: "行动派和脑洞星人的碰撞", themeEmoji: "⚡", vibe: "超高能 (88分)" },
  { theme: "灵魂共振局：小众热爱交流会", subtitle: "从旧书店到爵士黑胶", themeEmoji: "🎷", vibe: "深度畅聊 (82分)" },
] as const;

export function pickSingleTestGroupTheme(groupId: string): (typeof SINGLE_TEST_GROUP_THEMES)[number] {
  return SINGLE_TEST_GROUP_THEMES[simpleHash(groupId) % SINGLE_TEST_GROUP_THEMES.length];
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
  for (let i = existing.length; i < VIRTUAL_USER_COUNT; i++) {
    const nameIndex = i - existing.length;
    const primaryArchetype = pick(archetypeIds);
    const archetypeDef = ARCHETYPE_BY_ID[primaryArchetype];
    values.push({
      phoneNumber: `${VIRTUAL_PHONE_PREFIX}${String(i).padStart(4, '0')}`,
      password: passwordHash,
      displayName: namesToUse[nameIndex % namesToUse.length] ?? `虚拟用户${i}`,
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
  // Deterministic canonical test pool: only manage pools already flagged as
  // test pools, and always pick the oldest one. Without the isTestPool filter
  // + ordering, same-title pools are adopted arbitrarily and the un-picked
  // pools' registrations/groups/derived events leak across runs (the 足迹
  // duplicate-cards bug).
  const [existing] = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(and(eq(eventPools.title, SINGLE_TEST_POOL_TITLE), eq(eventPools.isTestPool, true)))
    .orderBy(asc(eventPools.createdAt))
    .limit(1);

  if (existing) {
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

async function enrichSelectedBotBackgrounds(bots: VirtualUserRow[], groupId: string): Promise<void> {
  await Promise.all(
    bots.map((bot, index) =>
      db
        .update(users)
        .set({
          ...getSingleTestBotBackground(index),
          wechatAvatarUrl: buildSingleTestBotAvatarUrl(groupId, index),
          updatedAt: new Date(),
        })
        .where(eq(users.id, bot.id)),
    ),
  );
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
  await enrichSelectedBotBackgrounds(bots, groupId);

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

  // Finalize the group the same way the production match commit does
  // (poolMatchingService steps 2.5-2.8): events + eventAttendance +
  // blind_box_events records, group back-links, and a theme. Without these the
  // squad-unboxing 确认出席 flow 409s (ATTENDANCE_NOT_READY) and the
  // post-confirm event-detail redirect has nothing to load.
  const dinnerDateTime = nextDinnerDateTime();
  const [pool] = await db
    .update(eventPools)
    .set({
      dateTime: dinnerDateTime,
      registrationDeadline: new Date(dinnerDateTime.getTime() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(eq(eventPools.id, poolId))
    .returning();

  const theme = pickSingleTestGroupTheme(groupId);

  const [testerRow] = await db
    .select({ archetype: users.archetype, primaryArchetype: users.primaryArchetype })
    .from(users)
    .where(eq(users.id, testerUserId))
    .limit(1);

  const location = pool?.district ? `${pool.city} ${pool.district}` : pool?.city || "待定";
  const [eventRecord] = await db.insert(events).values({
    title: `${pool?.title || SINGLE_TEST_POOL_TITLE} - 第1组`,
    description: "单人调试局自动成局 — 仅限测试模式",
    dateTime: pool?.dateTime || dinnerDateTime,
    location,
    area: pool?.district || null,
    maxAttendees: allMemberIds.length,
    currentAttendees: allMemberIds.length,
    hostId: testerUserId,
    status: "matched",
    iconName: pool?.eventType === "酒局" ? "wine" : "utensils",
  }).returning();

  for (const memberId of allMemberIds) {
    await db.insert(eventAttendance).values({
      eventId: eventRecord.id,
      userId: memberId,
      status: "confirmed",
    });
  }

  const [blindBoxEventRecord] = await db.insert(blindBoxEvents).values({
    poolId,
    userId: testerUserId,
    title: pool?.title ?? SINGLE_TEST_POOL_TITLE,
    eventType: pool?.eventType ?? "饭局",
    city: pool?.city ?? "",
    district: pool?.district ?? "",
    dateTime: pool?.dateTime ?? dinnerDateTime,
    budgetTier: "",
    status: "matched",
    progress: 100,
    currentParticipants: allMemberIds.length,
    totalParticipants: allMemberIds.length,
    matchedAttendees: [
      { userId: testerUserId, archetype: testerRow?.archetype ?? testerRow?.primaryArchetype ?? null },
      ...bots.map((b) => ({
        userId: b.id,
        archetype: b.archetype ?? ARCHETYPE_BY_ID[b.primaryArchetype ?? "corgi"]?.nameCn ?? null,
      })),
    ],
    matchExplanation: "单人调试局自动成局 — 仅限测试模式",
  }).returning();

  await db
    .update(eventPoolGroups)
    .set({
      eventId: eventRecord.id,
      blindBoxEventId: blindBoxEventRecord?.id ?? null,
      theme: theme.theme,
      subtitle: theme.subtitle,
      themeEmoji: theme.themeEmoji,
      vibe: theme.vibe,
      themeGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eventPoolGroups.id, groupId));

  // Reserve the shared test venue + finalDateTime so the squad-unboxing
  // 今晚这桌 brief renders 场地已确定 instead of 场地待定.
  await finalizeTestPoolGroups(poolId);

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

  logger.info("social_icebreaker_test_mode_runBots_decision", {
    groupId,
    isSingleTestMode: isSingleTestMode(),
    isSocialIcebreakerTestMode: isSocialIcebreakerTestMode(),
    runBots,
  });
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
  tx?: DbTransaction,
): Promise<{
  deletedRegistrations: number;
  deletedGroups: number;
  deletedSocialSessions: number;
}> {
  const conn = tx ?? db;
  const [poolTitleRow] = await conn
    .select({ title: eventPools.title })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);
  const poolTitle = poolTitleRow?.title ?? "";
  const registrationRows = await conn
    .select({ id: eventPoolRegistrations.id })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId));
  const registrationIds = registrationRows.map((row: IdRow) => row.id);

  const groupRows = await conn
    .select({
      id: eventPoolGroups.id,
      eventId: eventPoolGroups.eventId,
      blindBoxEventId: eventPoolGroups.blindBoxEventId,
    })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));
  const groupIds = groupRows.map((row: IdRow) => row.id);
  const linkedEventIds = groupRows
    .map((row: { eventId: string | null }) => row.eventId)
    .filter((id: string | null): id is string => Boolean(id));
  const linkedBlindBoxEventIds = groupRows
    .map((row: { blindBoxEventId: string | null }) => row.blindBoxEventId)
    .filter((id: string | null): id is string => Boolean(id));

  let deletedSocialSessions = 0;

  if (groupIds.length > 0) {
    if (await tableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerSessions)) {
      const socialSessionRows = await conn
        .select({ id: socialIcebreakerSessions.id })
        .from(socialIcebreakerSessions)
        .where(inArray(socialIcebreakerSessions.icebreakerSessionId, groupIds));
      const socialSessionIds = socialSessionRows.map((row: IdRow) => row.id);

      if (socialSessionIds.length > 0) {
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.preGenerationResults, () =>
          conn
            .delete(preGenerationResults)
            .where(inArray(preGenerationResults.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.preGenerationJobs, () =>
          conn
            .delete(preGenerationJobs)
            .where(inArray(preGenerationJobs.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerMiniscriptSecrets, () =>
          conn
            .delete(socialIcebreakerMiniscriptSecrets)
            .where(inArray(socialIcebreakerMiniscriptSecrets.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerPhaseMetrics, () =>
          conn
            .delete(socialIcebreakerPhaseMetrics)
            .where(inArray(socialIcebreakerPhaseMetrics.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerPhasePulseChecks, () =>
          conn
            .delete(socialIcebreakerPhasePulseChecks)
            .where(inArray(socialIcebreakerPhasePulseChecks.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.momentCardInteractions, () =>
          conn
            .delete(momentCardInteractions)
            .where(inArray(momentCardInteractions.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerAiFeedback, () =>
          conn
            .delete(socialIcebreakerAiFeedback)
            .where(inArray(socialIcebreakerAiFeedback.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerLieTruths, () =>
          conn
            .delete(socialIcebreakerLieTruths)
            .where(inArray(socialIcebreakerLieTruths.socialSessionId, socialSessionIds)),
        );
        await deleteIfTableExists(conn, OPTIONAL_SINGLE_TEST_TABLES.socialIcebreakerParticipants, () =>
          conn
            .delete(socialIcebreakerParticipants)
            .where(inArray(socialIcebreakerParticipants.socialSessionId, socialSessionIds)),
        );
        const deleted = await conn
          .delete(socialIcebreakerSessions)
          .where(inArray(socialIcebreakerSessions.id, socialSessionIds))
          .returning({ id: socialIcebreakerSessions.id });
        deletedSocialSessions = deleted.length;
      }
    } else {
      logger.warn("[SingleTest] Skipping social icebreaker cleanup because sessions table is missing", {
        poolId,
        groupCount: groupIds.length,
      });
    }

    await conn.delete(eventGroupOutcomes).where(inArray(eventGroupOutcomes.groupId, groupIds));

    await conn
      .delete(venueTimeSlotBookings)
      .where(inArray(venueTimeSlotBookings.eventGroupId, groupIds));

    // Groups reference events + blind_box_events with NO ACTION FKs (the
    // 2026-07-26 finalization writes both back-links). Null the back-links
    // before deleting the referenced rows, otherwise the second test run's
    // cleanup violates the FK and the whole /start fails.
    await conn
      .update(eventPoolGroups)
      .set({ eventId: null, blindBoxEventId: null })
      .where(inArray(eventPoolGroups.id, groupIds));

    if (linkedEventIds.length > 0) {
      await conn.delete(eventAttendance).where(inArray(eventAttendance.eventId, linkedEventIds));
      await conn.delete(events).where(inArray(events.id, linkedEventIds));
    }

    if (linkedBlindBoxEventIds.length > 0) {
      await conn
        .delete(eventAttendance)
        .where(inArray(eventAttendance.blindBoxEventId, linkedBlindBoxEventIds));
    }
  }

  // Safety net: blind_box_events rows for this pool created before the group
  // back-link existed (or left behind by an interrupted start) would otherwise
  // leak across runs and satisfy the confirm-attendance pool-level fallback
  // lookup with a stale event.
  const staleBlindBoxRows = await conn
    .select({ id: blindBoxEvents.id })
    .from(blindBoxEvents)
    .where(eq(blindBoxEvents.poolId, poolId));
  const staleBlindBoxEventIds = staleBlindBoxRows.map((row: IdRow) => row.id);
  if (staleBlindBoxEventIds.length > 0) {
    await conn
      .delete(eventAttendance)
      .where(inArray(eventAttendance.blindBoxEventId, staleBlindBoxEventIds));
    await conn.delete(blindBoxEvents).where(inArray(blindBoxEvents.id, staleBlindBoxEventIds));
  }

  // Safety net: legacy `events` rows derived from this pool's matches
  // (`<pool.title> - 第N组`) have no poolId column and leak when a run is
  // interrupted before the group back-link is written. Sweep them by title so
  // the 足迹 list never shows a stale `<pool> - 第N组` duplicate. Rows already
  // removed via the group back-link are excluded to avoid touching the FK
  // window twice.
  if (poolTitle) {
    const orphanEventRows = await conn
      .select({ id: events.id })
      .from(events)
      .where(like(events.title, `${poolTitle} - 第%组`));
    const orphanEventCandidateIds = orphanEventRows
      .map((row: IdRow) => row.id)
      .filter((id: string) => !linkedEventIds.includes(id));
    const referencedOrphanEventRows = orphanEventCandidateIds.length > 0
      ? await conn
        .select({ eventId: eventPoolGroups.eventId })
        .from(eventPoolGroups)
        .where(inArray(eventPoolGroups.eventId, orphanEventCandidateIds))
      : [];
    const referencedOrphanEventIds = new Set(
      referencedOrphanEventRows
        .map((row: { eventId: string | null }) => row.eventId)
        .filter((id: string | null): id is string => Boolean(id)),
    );
    const orphanEventIds = orphanEventCandidateIds
      .filter((id: string) => !referencedOrphanEventIds.has(id));
    if (orphanEventIds.length > 0) {
      await conn.delete(eventAttendance).where(inArray(eventAttendance.eventId, orphanEventIds));
      await conn.delete(events).where(inArray(events.id, orphanEventIds));
    }
  }

  await conn.delete(poolAICopy).where(eq(poolAICopy.poolId, poolId));
  await conn.delete(poolMatchingLogs).where(eq(poolMatchingLogs.poolId, poolId));

  if (registrationIds.length > 0) {
    await conn.delete(eventCreditRedemptions).where(inArray(eventCreditRedemptions.registrationId, registrationIds));
    await conn.delete(invitationUses).where(inArray(invitationUses.poolRegistrationId, registrationIds));
  }

  const deletedRegistrations = await conn
    .delete(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId))
    .returning({ id: eventPoolRegistrations.id });
  const deletedGroups = await conn
    .delete(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId))
    .returning({ id: eventPoolGroups.id });

  if (deletePool) {
    await conn.delete(eventPools).where(eq(eventPools.id, poolId));
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

  const result = await db.transaction(async (tx: DbTransaction) => {
    const [pool] = await tx
      .select({ id: eventPools.id })
      .from(eventPools)
      .where(eq(eventPools.title, SINGLE_TEST_POOL_TITLE))
      .limit(1);

    const poolCleanup = pool
      ? await cleanupSingleTestPoolRows(pool.id, { deletePool: true }, tx)
      : { deletedRegistrations: 0, deletedGroups: 0, deletedSocialSessions: 0 };

    const virtualUserRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(like(users.phoneNumber, `${VIRTUAL_PHONE_PREFIX}%`));
    const virtualUserIds = virtualUserRows.map((row: IdRow) => row.id);

    let deletedVirtualUsers = 0;
    if (virtualUserIds.length > 0) {
      await tx
        .delete(matchHistory)
        .where(or(inArray(matchHistory.user1Id, virtualUserIds), inArray(matchHistory.user2Id, virtualUserIds)));
      await tx.delete(eventAttendance).where(inArray(eventAttendance.userId, virtualUserIds));
      await tx.delete(userInterests).where(inArray(userInterests.userId, virtualUserIds));
      await tx
        .delete(notifications)
        .where(or(inArray(notifications.userId, virtualUserIds), inArray(notifications.sentBy, virtualUserIds)));
      // Delete the virtual users' pool registrations across ALL pools before
      // deleting the users themselves. cleanupSingleTestPoolRows only clears the
      // canonical 单人调试局 pool, so registrations in other pools (e.g. a 酒局
      // test pool) would otherwise violate
      // event_pool_registrations_user_id_users_id_fk on the user delete.
      await tx.delete(eventPoolRegistrations).where(inArray(eventPoolRegistrations.userId, virtualUserIds));
      // Same for blind_box_events rows owned by virtual users
      // (blind_box_events_user_id_users_id_fk).
      await tx.delete(blindBoxEvents).where(inArray(blindBoxEvents.userId, virtualUserIds));
      const deleted = await tx.delete(users).where(inArray(users.id, virtualUserIds)).returning({ id: users.id });
      deletedVirtualUsers = deleted.length;
    }

    return {
      ...poolCleanup,
      deletedVirtualUsers,
      deletedBotFillUsers: botFillCleanup.deletedBots,
    };
  });

  logger.info("[SingleTest] Cleanup complete", result);
  return result;
}
