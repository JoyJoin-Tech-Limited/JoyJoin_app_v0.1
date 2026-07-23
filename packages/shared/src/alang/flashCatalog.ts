import npcData from "./flashCatalogData.npcs.json";
import taskData1 from "./flashCatalogData.tasks1.json";
import taskData2 from "./flashCatalogData.tasks2.json";
import taskData3 from "./flashCatalogData.tasks3.json";
import { z } from "zod";

import type { FlashDialogueQuestion, FlashFeedbackPrompt } from "../schema/flash.js";

export type FlashNpcSeed = {
  slug: string;
  name: string;
  species: string;
  personalitySummary: string;
  inviteLine: string;
  voiceGuide: string[];
  dialogueQuestions: FlashDialogueQuestion[];
  eligibleWeekdays: number[];
  oneShiftProbability: number;
  twoShiftProbability: number;
  minShiftMinutes: number;
  maxShiftMinutes: number;
  minGapMinutes: number;
  themeColor: string;
};

export type FlashTaskSeed = {
  code: string;
  category: string;
  title: string;
  brief: string;
  instructions: string;
  dialogueIntro: string;
  feedbackPrompts: FlashFeedbackPrompt[];
  tags: string[];
  durationDays: number;
  baseWeight: number;
  safetyLevel: string;
  safetyNotes: string;
  npcSlugs: string[];
  requestCopy: string;
};

export type FlashLocationSeed = {
  code: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  destinationType: "public_place" | "park" | "culture_space";
  tags: string[];
  taskCategories: FlashTaskSeed["category"][];
  safetyNotes: string;
};

const ALL_TASK_CATEGORIES = ["探店", "城市观察", "轻社交勇气", "独处放松", "文化发现", "微小善意"];
const PARK_TASK_CATEGORIES = ["城市观察", "轻社交勇气", "独处放松", "微小善意"];
const CULTURE_TASK_CATEGORIES = ["探店", "城市观察", "轻社交勇气", "文化发现", "微小善意"];

/**
 * Operator-reviewed GCJ-02 candidates for the Shenzhen-only formal Flash
 * catalog. Every district has two public, no-purchase-required places. The
 * staging seed route still reverse-geocodes every coordinate through Tencent
 * Maps before it may persist these rows as approved.
 */
export const FLASH_LOCATION_SEEDS: FlashLocationSeed[] = [
  { code: "NS-SEAWORLD-ART", name: "海上世界文化艺术中心外围广场", district: "南山区", address: "深圳市南山区望海路1187号海上世界文化艺术中心外围广场", latitude: 22.4806000, longitude: 113.9171000, destinationType: "culture_space", tags: ["文化", "滨水", "公共广场"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅使用文化艺术中心外围开放广场；无需入馆、进店或消费，避开临水边缘和闭馆后封闭区域。" },
  { code: "NS-NANTOU", name: "南头古城公共街区", district: "南山区", address: "深圳市南山区南山大道南头古城", latitude: 22.5373061, longitude: 113.9242904, destinationType: "culture_space", tags: ["古城", "街区", "免费"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅在开放公共街巷活动；不要求进店、消费、拍摄或与商户互动。" },
  { code: "FT-UPPERHILLS", name: "深业上城公共空间", district: "福田区", address: "深圳市福田区皇岗路5001号深业上城公共空间", latitude: 22.5650000, longitude: 114.0670000, destinationType: "public_place", tags: ["街区", "连廊", "公共空间"], taskCategories: ALL_TASK_CATEGORIES, safetyNotes: "仅使用开放街区、公共连廊和休息区；无需进店或消费，闭店后停用且不在通道内聚集。" },
  { code: "FT-BOOK-CITY", name: "深圳书城中心城公共阅读区", district: "福田区", address: "深圳市福田区福中一路深圳书城中心城公共阅读区", latitude: 22.5466000, longitude: 114.0596000, destinationType: "culture_space", tags: ["阅读", "文化", "公共空间"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅使用免费开放的公共阅读区；无需购买书籍或消费，遵守开放时间并保持安静。" },
  { code: "LH-EASTLAKE", name: "东湖公园", district: "罗湖区", address: "深圳市罗湖区爱国路东湖公园", latitude: 22.5629093, longitude: 114.1487351, destinationType: "park", tags: ["公园", "湖景", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放公共步道；与水边保持安全距离，避开偏僻和照明不足区域。" },
  { code: "LH-PEOPLE", name: "人民公园", district: "罗湖区", address: "深圳市罗湖区人民北路人民公园", latitude: 22.5534514, longitude: 114.1166622, destinationType: "park", tags: ["公园", "城市", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅在开放公共区域停留；不采摘植物，不影响园内居民和活动。" },
  { code: "BA-PARK", name: "宝安公园", district: "宝安区", address: "深圳市宝安区公园路宝安公园", latitude: 22.5860298, longitude: 113.9029171, destinationType: "park", tags: ["公园", "步道", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放步道和广场；不进入封闭山林，夜间遵守现场开放时间。" },
  { code: "BA-OH-BAY", name: "欢乐港湾海滨文化公园", district: "宝安区", address: "深圳市宝安区宝华路欢乐港湾", latitude: 22.5432666, longitude: 113.8859008, destinationType: "public_place", tags: ["滨水", "广场", "免费"], taskCategories: ALL_TASK_CATEGORIES, safetyNotes: "任务只使用免消费公共区域；不要求进入商业设施、乘坐项目或购买商品。" },
  { code: "LG-DAYUN", name: "大运山自然公园", district: "龙岗区", address: "深圳市龙岗区龙城街道大运山自然公园", latitude: 22.6908987, longitude: 114.2089059, destinationType: "park", tags: ["公园", "自然", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅走开放步道；不进入未开放山地，恶劣天气或天黑后不安排深入路线。" },
  { code: "LG-LONGCHENG", name: "龙城公园", district: "龙岗区", address: "深圳市龙岗区黄阁路龙城公园", latitude: 22.7044352, longitude: 114.2184478, destinationType: "park", tags: ["公园", "城市", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放公共区域；避开施工、陡坡和照明不足路段。" },
  { code: "YT-CENTRAL", name: "盐田中央公园", district: "盐田区", address: "深圳市盐田区海景二路盐田中央公园", latitude: 22.5524397, longitude: 114.2397995, destinationType: "park", tags: ["公园", "海景", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅在开放公共空间活动；与车道、临水边缘保持安全距离。" },
  { code: "YT-HAISHAN", name: "海山公园", district: "盐田区", address: "深圳市盐田区深盐路海山公园", latitude: 22.5596491, longitude: 114.2401710, destinationType: "park", tags: ["公园", "步道", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放步道；雨后注意台阶湿滑，不进入封闭或维护区域。" },
  { code: "LHUA-NORTH", name: "深圳北站中心公园", district: "龙华区", address: "深圳市龙华区民治街道深圳北站中心公园", latitude: 22.6062626, longitude: 114.0246392, destinationType: "park", tags: ["公园", "交通", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用公园开放区域；避开车道、接驳区和人流拥挤的站口。" },
  { code: "LHUA-GUANLAN", name: "观澜河湿地公园", district: "龙华区", address: "深圳市龙华区观澜河湿地公园", latitude: 22.6829351, longitude: 114.0431405, destinationType: "park", tags: ["湿地", "步道", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅走开放步道；不靠近水边、不进入生态保育区域，不打扰野生动物。" },
  { code: "PS-CENTRAL", name: "坪山中心公园", district: "坪山区", address: "深圳市坪山区和安路坪山中心公园", latitude: 22.7017868, longitude: 114.3479818, destinationType: "park", tags: ["公园", "广场", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅在开放公共区域活动；避开施工围挡和机动车通行区域。" },
  { code: "PS-DASHANBEI", name: "大山陂主题公园", district: "坪山区", address: "深圳市坪山区马峦街道大山陂主题公园", latitude: 22.6686781, longitude: 114.3447790, destinationType: "park", tags: ["公园", "自然", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放步道；不进入水库管理区或未开放山地，遵守现场告示。" },
  { code: "GM-RAINBOW", name: "虹桥公园", district: "光明区", address: "深圳市光明区光明街道虹桥公园", latitude: 22.7452484, longitude: 113.9582031, destinationType: "park", tags: ["公园", "步道", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放栈道和公共区域；高温、雷雨或关闭时不进入。" },
  { code: "GM-KAIMING", name: "光明开明公园", district: "光明区", address: "深圳市光明区光明街道开明公园", latitude: 22.7493693, longitude: 113.9288328, destinationType: "park", tags: ["公园", "草地", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放公共区域；不进入养护区，不影响其他游园者。" },
  { code: "DP-KUICHONG", name: "葵涌生态公园", district: "大鹏新区", address: "深圳市大鹏新区葵涌街道葵涌生态公园", latitude: 22.6206750, longitude: 114.4238357, destinationType: "park", tags: ["公园", "生态", "免费"], taskCategories: PARK_TASK_CATEGORIES, safetyNotes: "仅使用开放步道；不进入偏僻山地，天黑、雷雨或现场关闭时不参与。" },
  { code: "DP-FORTRESS", name: "大鹏所城公共街区", district: "大鹏新区", address: "深圳市大鹏新区鹏城社区大鹏所城", latitude: 22.5949930, longitude: 114.5123735, destinationType: "culture_space", tags: ["古城", "文化", "免费"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅在免票开放公共街巷活动；不要求进入收费展馆、消费、拍照或与居民商户互动。" },
];

const districtSeedCounts = new Map<string, number>();
for (const location of FLASH_LOCATION_SEEDS) {
  districtSeedCounts.set(location.district, (districtSeedCounts.get(location.district) ?? 0) + 1);
}
if (FLASH_LOCATION_SEEDS.length !== 20 || [...districtSeedCounts.values()].some((count) => count !== 2)) {
  throw new Error("Built-in Flash location catalog must contain exactly two places per Shenzhen district");
}

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
const npcSeedSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  personalitySummary: z.string().min(1),
  inviteLine: z.string().min(1),
  voiceGuide: z.array(z.string().min(1)).min(1),
  dialogueQuestions: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(optionSchema.extend({ tags: z.array(z.string().min(1)) })).min(2),
  })).min(1).max(2),
  eligibleWeekdays: z.array(z.number().int().min(1).max(7)).min(1),
  oneShiftProbability: z.number().int().min(0).max(100),
  twoShiftProbability: z.number().int().min(0).max(100),
  minShiftMinutes: z.literal(90),
  maxShiftMinutes: z.literal(150),
  minGapMinutes: z.number().int().min(90),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
}).superRefine((npc, ctx) => {
  if (npc.oneShiftProbability + npc.twoShiftProbability !== 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "shift probabilities must total 100" });
  }
  for (const question of npc.dialogueQuestions) {
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate option id in ${question.id}` });
    }
  }
});
const taskSeedSchema = z.object({
  code: z.string().regex(/^T\d{2}$/),
  category: z.enum(["探店", "城市观察", "轻社交勇气", "独处放松", "文化发现", "微小善意"]),
  title: z.string().min(1),
  brief: z.string().min(1),
  instructions: z.string().min(1),
  dialogueIntro: z.string().min(1),
  feedbackPrompts: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(optionSchema).min(2),
  })).min(1).max(2),
  tags: z.array(z.string().min(1)).min(1),
  durationDays: z.literal(7),
  baseWeight: z.number().int().positive(),
  safetyLevel: z.enum(["L1", "L2"]),
  safetyNotes: z.string().min(1),
  npcSlugs: z.array(z.string().min(1)).min(1),
  requestCopy: z.string().min(1),
});

const catalogSchema = z.object({
  npcs: z.array(npcSeedSchema).length(5),
  tasks: z.array(taskSeedSchema).length(30),
}).superRefine((catalog, ctx) => {
  if (new Set(catalog.npcs.map((npc) => npc.slug)).size !== catalog.npcs.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NPC slugs must be unique" });
  }
  if (new Set(catalog.tasks.map((task) => task.code)).size !== catalog.tasks.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "task codes must be unique" });
  }
  const validSlugs = new Set(catalog.npcs.map((npc) => npc.slug));
  const counts = new Map<string, number>();
  for (const task of catalog.tasks) {
    counts.set(task.category, (counts.get(task.category) ?? 0) + 1);
    for (const slug of task.npcSlugs) {
      if (!validSlugs.has(slug)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown NPC slug ${slug} on ${task.code}` });
      }
    }
  }
  if ([...counts.values()].some((count) => count !== 5) || counts.size !== 6) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "catalog must contain exactly six categories with five tasks each" });
  }
});

function makeTaskFeelLikeAConversation(task: unknown) {
  const value = task as Record<string, any>;
  const soften = (text: string) => text
    .replace(/你替我/g, "你哪天刚好路过的话，能帮我")
    .replace(/替我看看/g, "顺便帮我看看")
    .replace(/你到附近帮我/g, "你哪天路过那附近，顺便帮我")
    .replace(/你去看看/g, "你哪天想去的话，顺便看看")
    .replace(/你去那里/g, "你哪天刚好到了那里")
    .replace(/替后来的人/g, "顺手给后来的人");
  const instructionDetail = value.instructions
    .replace(/^到达 50 米内；(?:可选)?/, "")
    .replace(/^若用户/, "如果你")
    .replace(/^若/, "如果");
  return {
    ...value,
    brief: soften(value.brief),
    dialogueIntro: soften(value.dialogueIntro),
    requestCopy: soften(value.requestCopy),
    instructions: `哪天顺路到了附近，点一下“我已到达”就好。${instructionDetail}`,
    feedbackPrompts: value.feedbackPrompts.map((prompt: Record<string, any>) => ({
      ...prompt,
      prompt: prompt.prompt.replace(/^到达以后，/, "后来真去了的话，").replace(/^这次到达，/, "后来到了那边，"),
    })),
  };
}

const parsedCatalog = catalogSchema.parse({
  npcs: npcData,
  tasks: [
  ...taskData1.map(makeTaskFeelLikeAConversation),
  ...taskData2.map(makeTaskFeelLikeAConversation),
  ...taskData3.map(makeTaskFeelLikeAConversation),
  ],
});

export const FLASH_NPC_SEEDS = parsedCatalog.npcs as FlashNpcSeed[];
export const FLASH_TASK_SEEDS = parsedCatalog.tasks as FlashTaskSeed[];

export const FLASH_DELIVERY_COPY_BY_NPC: Record<string, string> = {
  alang: "你真的替我去看了。你看到的，比我听来的准。",
  lizi: "原来是这样！这趟小冒险，我收到了 (´▽｀)",
  momo: "嗯，我听见了。谢谢你慢慢走完这一趟。",
  shiqi: "细节记下了。普通地方果然也会留下暗号。",
  atuan: "收到啦。能舒服地到过那里，就已经很好。",
};

/**
 * Curated draft voice frames used only by the explicit seed command. The
 * composed copy is persisted on each NPC/task link. An operator must explicitly
 * approve each task before production selection can read it; runtime never asks
 * an LLM to improvise a mission.
 */
export function buildFlashNpcTaskRequestCopy(npcSlug: string, task: FlashTaskSeed): string {
  const frame: Record<string, (brief: string) => string> = {
    alang: (brief) => `我刚好想到一件事。${brief} 你哪天顺路再去，不赶。`,
    lizi: (brief) => `欸，这个感觉你可能会喜欢：${brief} 哪天想出门了再说 (´▽｀)`,
    momo: (brief) => `我有点好奇那里。${brief} 你按自己的节奏来就好。`,
    shiqi: (brief) => `我总觉得那里藏着个小细节。${brief} 要是正好看见了，回来跟我说。`,
    atuan: (brief) => `这个地方也许适合随便走走。${brief} 不想去也没关系。`,
  };
  return (frame[npcSlug] ?? ((brief) => brief))(task.brief);
}

if (FLASH_NPC_SEEDS.length !== 5 || FLASH_TASK_SEEDS.length !== 30) {
  throw new Error("Built-in Flash catalog must contain exactly 5 NPCs and 30 tasks");
}
