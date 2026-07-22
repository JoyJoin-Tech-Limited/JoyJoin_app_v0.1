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
