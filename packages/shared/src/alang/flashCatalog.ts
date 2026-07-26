import npcData from "./flashCatalogData.npcs.json";
import { z } from "zod";

import type { FlashDialogueQuestion, FlashFeedbackPrompt } from "../schema/flash.js";
import { FLASH_INVITATION_DEFINITIONS } from "./flashInvitationCatalog.js";

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

const ALL_TASK_CATEGORIES = ["城市出发", "文化娱乐", "身体动起来", "一直想做", "关系连接", "NPC传话"];
const PARK_TASK_CATEGORIES = ALL_TASK_CATEGORIES;
const CULTURE_TASK_CATEGORIES = ALL_TASK_CATEGORIES;

/**
 * Operator-reviewed GCJ-02 candidates for the Shenzhen-only formal Flash
 * catalog. Every district has two public, no-purchase-required places. The
 * staging seed route still reverse-geocodes every coordinate through Tencent
 * Maps before it may persist these rows as approved.
 */
export const FLASH_LOCATION_SEEDS: FlashLocationSeed[] = [
  { code: "NS-SEAWORLD-ART", name: "海上世界文化艺术中心外围广场", district: "南山区", address: "深圳市南山区望海路1187号海上世界文化艺术中心外围广场", latitude: 22.4806000, longitude: 113.9171000, destinationType: "culture_space", tags: ["文化", "滨水", "公共广场", "免费"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅使用文化艺术中心外围开放广场；无需入馆、进店或消费，避开临水边缘和闭馆后封闭区域。" },
  { code: "NS-NANTOU", name: "南头古城公共街区", district: "南山区", address: "深圳市南山区南山大道南头古城", latitude: 22.5373061, longitude: 113.9242904, destinationType: "culture_space", tags: ["古城", "街区", "免费"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅在开放公共街巷活动；不要求进店、消费、拍摄或与商户互动。" },
  { code: "FT-UPPERHILLS", name: "深业上城公共空间", district: "福田区", address: "深圳市福田区皇岗路5001号深业上城公共空间", latitude: 22.5650000, longitude: 114.0670000, destinationType: "public_place", tags: ["街区", "连廊", "公共空间", "免费"], taskCategories: ALL_TASK_CATEGORIES, safetyNotes: "仅使用开放街区、公共连廊和休息区；无需进店或消费，闭店后停用且不在通道内聚集。" },
  { code: "FT-BOOK-CITY", name: "深圳书城中心城公共阅读区", district: "福田区", address: "深圳市福田区福中一路深圳书城中心城公共阅读区", latitude: 22.5466000, longitude: 114.0596000, destinationType: "culture_space", tags: ["阅读", "文化", "公共空间", "免费"], taskCategories: CULTURE_TASK_CATEGORIES, safetyNotes: "仅使用免费开放的公共阅读区；无需购买书籍或消费，遵守开放时间并保持安静。" },
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
  category: z.enum(["城市出发", "文化娱乐", "身体动起来", "一直想做", "关系连接", "NPC传话"]),
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
  const invitation = FLASH_INVITATION_DEFINITIONS.find((item) => item.code === value.code);
  if (!invitation) throw new Error(`Missing Flash invitation definition for ${value.code}`);
  const outcomeOptions = invitation.kind === "npc_message"
    ? [
      { id: "relayed_original", label: "嗯，原话带到了" },
      { id: "relayed_rephrased", label: "说了，不过换了个说法" },
      { id: "not_relayed", label: "见到了，最后没说" },
      { id: "forgot", label: "这次给忘了" },
      { id: "changed_mind", label: "后来觉得不说更好" },
    ]
    : invitation.code === "T06" || invitation.code === "T10"
      ? [
        { id: "liked", label: "比想象中更喜欢" },
        { id: "continuing", label: "看了一点，还想继续" },
        { id: "not_for_me", label: "不太对胃口" },
        { id: "switched", label: "最后换了一部" },
        { id: "not_started", label: "还没打开" },
      ]
    : [
      { id: "completed", label: "做了，还挺不错" },
      { id: "started", label: "只开了个头" },
      { id: "not_done", label: "还没顾上" },
      { id: "changed_mind", label: "后来不想做了" },
      { id: "did_something_else", label: "我换了件别的事" },
    ];
  const sourceNpcSlug = invitation.npcSlugs[0] ?? "";
  const lifeFollowUp: Record<string, string> = {
    alang: "我还记得上次那件事。后来你去了哪里？没去也没关系，我想听听。",
    lizi: "你回来啦！上次那件事后来怎么样？快讲给我听，哪种结果都算后续。",
    momo: "我记得我们上次说的事……后来呢？慢慢讲，我在听。",
    shiqi: "上次那件事，我一直留着一个问号。后来发生了什么？没发生也算答案。",
    atuan: "回来就好。前阵子那件事后来怎么样？做没做成，我都想听你说说。",
  };
  const relayFollowUp: Record<string, string> = {
    alang: `后来碰见${invitation.targetNpcName}了吗？那句话，不说也没事。`,
    lizi: `你后来见到${invitation.targetNpcName}了吗？我有点好奇！`,
    momo: `后来遇见${invitation.targetNpcName}了吗？那句话……随你怎么处理。`,
    shiqi: `后来见到${invitation.targetNpcName}了吗？我想知道那句话去了哪里。`,
    atuan: `后来碰见${invitation.targetNpcName}了吗？没来得及说也不要紧。`,
  };
  return {
    code: invitation.code,
    category: invitation.category,
    title: invitation.title,
    brief: invitation.brief,
    dialogueIntro: invitation.brief,
    requestCopy: invitation.brief,
    instructions: invitation.instructions,
    tags: invitation.tags,
    npcSlugs: invitation.npcSlugs,
    durationDays: 7,
    baseWeight: 100,
    safetyLevel: "L1",
    safetyNotes: "无验收、无惩罚、无强制消费；可随时拒绝或改变主意。",
    feedbackPrompts: [{
      id: invitation.kind === "npc_message" ? "relay_outcome" : "invitation_outcome",
      prompt: invitation.kind === "npc_message"
        ? (relayFollowUp[sourceNpcSlug] ?? `后来遇见${invitation.targetNpcName}了吗？`)
        : (lifeFollowUp[sourceNpcSlug] ?? "前阵子聊的那件事，后来怎么样了？"),
      options: outcomeOptions,
    }],
  };
}

const parsedCatalog = catalogSchema.parse({
  npcs: npcData,
  tasks: FLASH_INVITATION_DEFINITIONS.map(makeTaskFeelLikeAConversation),
});

export const FLASH_NPC_SEEDS = parsedCatalog.npcs as FlashNpcSeed[];
export const FLASH_TASK_SEEDS = parsedCatalog.tasks as FlashTaskSeed[];

export const FLASH_DELIVERY_COPY_BY_NPC: Record<string, string> = {
  alang: "原来后来是这样。谢谢你回来告诉我，这段路现在也有我一小份记忆了。",
  lizi: "原来是这样！我就知道等你回来讲，会比任务本身更有意思。",
  momo: "嗯，我听见了。谢谢你愿意把这段小小的后来讲给我。",
  shiqi: "问号有答案了。不是因为你一定做成了，是因为你真的回来告诉了我。",
  atuan: "好，我收到了。做成、只做了一点，或者改变主意，都不影响我高兴你回来。",
};

const FLASH_LIFE_DELIVERY_COPY_BY_NPC: Record<string, Record<string, string>> = {
  alang: {
    completed: "所以你真的去了。你看到的那一小段城市，现在也被我记住了。",
    started: "只走了一点也够。路不是非要走完，才算真的出发过。",
    not_done: "没去也没关系。至少你回来告诉我了，这件事还没有被悄悄忘掉。",
    changed_mind: "那就不去了。会转身的人，通常比只顾往前的人更知道自己要去哪。",
    did_something_else: "原来风把你带去了别处。也行，我更想听你最后选的那条路。",
  },
  lizi: {
    completed: "你真的把它变成今天的一部分了。快留一个最好玩的细节给我，下次接着讲。",
    started: "开了头就不再只是“想做”了。剩下的先别急，我已经开始期待后续了。",
    not_done: "被我逮到啦。没关系，今天没发生的事也算后续，你肯回来就行。",
    changed_mind: "不喜欢就换，别对一个旧计划讲礼貌。这个决定反而很像你。",
    did_something_else: "擅自改剧情是吧？可以，这个版本听起来更有意思。下次讲细一点。",
  },
  momo: {
    completed: "嗯，我听见了。谢谢你把那一小段时间留给自己，也留了一点给我听。",
    started: "一点点就够了。有些事情轻轻碰一下，比用力完成更适合今天。",
    not_done: "没关系。有些事暂时只适合被记得，不一定现在就要发生。",
    changed_mind: "那就放下吧。你不需要为了过去的一个念头，勉强现在的自己。",
    did_something_else: "原来你去了另一边。只要那是你真正想选的，就很好。",
  },
  shiqi: {
    completed: "问号有答案了。不是因为你一定做成了，是因为你真的让它发生了一次。",
    started: "五分钟已经足够留下痕迹。零和一之间，通常比一和一百之间更远。",
    not_done: "记录：这次没有发生。别小看它，空白也是一种准确结果。",
    changed_mind: "结论更新：这件事现在不值得继续。及时删掉错误选项，很有效率。",
    did_something_else: "你改了实验条件。结果反而更像你自己的答案，我接受。",
  },
  atuan: {
    completed: "好，我收到了。你愿意为今天的自己做这件小事，我听着就很踏实。",
    started: "做一点就很好。生活不是考勤表，不用把每一格都填满。",
    not_done: "没做也没关系。你肯回来坐一会儿、说一句后来，我就很高兴了。",
    changed_mind: "那就不做了。照顾自己有时候是开始，有时候也是及时停下。",
    did_something_else: "换一件也好。计划是拿来照顾生活的，不是让生活迁就计划。",
  },
};

const FLASH_RELAY_DELIVERY_COPY_BY_NPC: Record<string, Record<string, string>> = {
  alang: {
    relayed_original: "原话到了就好。有些话走得慢一点，也还是能找到地方落下。",
    relayed_rephrased: "换成你的说法也好。话经过一个人，本来就会带上一点新的风。",
    not_relayed: "没说也没关系。你当时一定看见了什么，才决定把它留下。",
    forgot: "忘了就忘了。真要紧的话，也许它还会自己绕回来。",
    changed_mind: "那就别说了。谢谢你没有只把自己当成一条传话的路。",
  },
  lizi: {
    relayed_original: "真的带到啦？好，我现在有点想知道它听完是什么表情。",
    relayed_rephrased: "你还给它换了个版本？可以，这下有一半也算你的故事了。",
    not_relayed: "见到了却没说——这里面肯定有个理由。没关系，我尊重你的现场判断。",
    forgot: "居然忘了。好吧，这次先放过你，反正我们还有下一次碰见。",
    changed_mind: "那就不说。临时改变主意不叫失败，叫你真的参与了这件事。",
  },
  momo: {
    relayed_original: "嗯，谢谢你。那句话终于不用一直留在我这里了。",
    relayed_rephrased: "换一种说法也好。你觉得舒服的方式，比原句完整更重要。",
    not_relayed: "没说也没关系。沉默有时候不是空白，是你替大家留的位置。",
    forgot: "忘了就算了。不是每句话都一定要赶上某一次见面。",
    changed_mind: "好，那就留在这里。谢谢你认真想过它该不该被说出去。",
  },
  shiqi: {
    relayed_original: "信息完整抵达。现在我更好奇，它会怎么处理这个答案。",
    relayed_rephrased: "发生了转译。意料之中——语言经过人，总会留下指纹。",
    not_relayed: "信息在最后一步停下了。可以，你拥有终止传递的判断权。",
    forgot: "变量丢失。没关系，这也证明记忆不是可靠的快递系统。",
    changed_mind: "你撤回了传递。合理，有些信息经过思考后，本来就该留在原地。",
  },
  atuan: {
    relayed_original: "好，辛苦你把话带到了。现在可以把这件事从心里放下来一点。",
    relayed_rephrased: "用你的方式说也很好。让人听得舒服，比一字不差更重要。",
    not_relayed: "没说就没说。你在现场觉得不合适，那份分寸比任务重要。",
    forgot: "忘了没关系。你不是来替谁完成指标的，下次见面还是照常坐会儿。",
    changed_mind: "那就不说了。谢谢你替这句话多想了一步，也替自己守住了选择。",
  },
};

const FLASH_MOVIE_DELIVERY_COPY_BY_TASK: Record<string, Record<string, string>> = {
  T06: {
    liked: "我就知道，你片单里肯定藏着漏网之鱼。先把最喜欢的那一段记住，下次我要听完整版。",
    continuing: "那就别急着一次看完。能让你愿意回来继续，它已经赢过片单里不少名字了。",
    not_for_me: "那就关掉，别对一部电影讲礼貌。你愿意试过一次，它就没资格继续占着你的期待了。",
    switched: "擅自改剧情是吧？可以，这个结局反而更像你。下次记得告诉我，你最后选中了哪一部。",
    not_started: "原来“下次一定”本人就在这里。没关系，我先替你记着——不过下次见面，可别还拿同一句糊弄我。",
  },
  T10: {
    liked: "原来它还在原来的地方等你。有些喜欢没有过期，只是很久没被想起来。",
    continuing: "那就慢慢看。旧喜欢不用一次重温完，它已经认出你回来了。",
    not_for_me: "嗯，那也很好。不是它突然变差了，是你已经走到别的地方了。",
    switched: "你最后还是选了别的。没关系，现在真正想看的，比过去喜欢过的更诚实。",
    not_started: "没关系。有些东西暂时只适合被记得，不一定非要重新打开。",
  },
};

export function resolveFlashDeliveryCopy(input: {
  npcSlug: string;
  taskCode: string;
  invitationKind?: "destination_exploration" | "life_invitation" | "npc_message";
  optionId?: string;
  fallback?: string;
}): string {
  if (input.optionId) {
    const movieCopy = FLASH_MOVIE_DELIVERY_COPY_BY_TASK[input.taskCode]?.[input.optionId];
    if (movieCopy) return movieCopy;
    const outcomeCopy = input.invitationKind === "npc_message"
      ? FLASH_RELAY_DELIVERY_COPY_BY_NPC[input.npcSlug]?.[input.optionId]
      : input.invitationKind === "life_invitation"
        ? FLASH_LIFE_DELIVERY_COPY_BY_NPC[input.npcSlug]?.[input.optionId]
        : undefined;
    if (outcomeCopy) return outcomeCopy;
  }
  return input.fallback
    ?? FLASH_DELIVERY_COPY_BY_NPC[input.npcSlug]
    ?? "好，我记住了。谢谢你愿意回来告诉我。";
}

/**
 * Curated draft voice frames used only by the explicit seed command. The
 * composed copy is persisted on each NPC/task link. An operator must explicitly
 * approve each task before production selection can read it; runtime never asks
 * an LLM to improvise a mission.
 */
export function buildFlashNpcTaskRequestCopy(npcSlug: string, task: FlashTaskSeed): string {
  const isMessage = task.tags.includes("invitation:npc_message");
  const frame: Record<string, (brief: string) => string> = {
    alang: (brief) => isMessage
      ? `有句话我自己没赶上说。${brief} 碰见了就帮我带到，没碰见算了。`
      : `我忽然想到，这件事也许适合现在的你。${brief} 出发以后，记得回来讲给我听。`,
    lizi: (brief) => isMessage
      ? `我有句话托你捎一下！${brief} 怎么说都行，别有压力。`
      : `欸，我想把今天轻轻往前推一下：${brief} 先开始一点点，回来我要听你的版本。`,
    momo: (brief) => isMessage
      ? `有句话……如果刚好遇见了，帮我带一下。${brief}`
      : `现在留一点安静给自己，好吗？${brief} 下次见面，你愿意说多少，我就听多少。`,
    shiqi: (brief) => isMessage
      ? `有句话需要经过第三个人，结果可能会不一样。${brief} 你自己决定怎么说。`
      : `我想知道，今天从这里开始会发生什么。${brief} 回来告诉我结果，哪种结果都算。`,
    atuan: (brief) => isMessage
      ? `下次要是碰见了，替我说一句。${brief} 忘了也没关系。`
      : `先照顾一下今天的自己吧。${brief} 不用做得漂亮，回来让我知道你过得怎么样。`,
  };
  return (frame[npcSlug] ?? ((brief) => brief))(task.brief);
}

if (FLASH_NPC_SEEDS.length !== 5 || FLASH_TASK_SEEDS.length !== 30) {
  throw new Error("Built-in Flash catalog must contain exactly 5 NPCs and 30 tasks");
}
