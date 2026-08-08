import type { Express } from "express";
import { z } from "zod";

import {
  FLASH_DELIVERY_COPY_BY_NPC,
  buildFlashNpcTaskRequestCopy,
  type FlashTaskSeed,
} from "@shared/alang/flashCatalog";
import { featureFlags, type FlashAvailabilityWindow, type FlashFeedbackPrompt } from "@shared/schema";

import { requireAdmin, requireOperatorOrAbove, requireSuperAdmin } from "../../adminAuth";
import { db } from "../../db";
import { logAdminAudit, type AdminAuditAction } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { isCanonicalFlashNpcSlug, matchesCanonicalFlashNpcWeekdays } from "../../lib/flashNpcPolicy";
import { logger } from "../../lib/logger";
import { getFeatureFlag, refreshFeatureFlag } from "../../lib/featureFlags";
import { reverseGeocodeCoordinate, TencentMapValidationError } from "./geo";
import {
  createFlashEncounterLocation,
  createFlashNpc,
  createFlashTaskDestination,
  createFlashTaskTemplate,
  getFlashSchedulePlanByDate,
  getFlashSchedulePlanById,
  listFlashEncounterLocations,
  listFlashNpcLocationLinks,
  listFlashNpcs,
  listFlashNpcTaskLinks,
  listFlashSchedulingInputs,
  listFlashTaskDestinationLinks,
  listFlashTaskDestinations,
  listFlashTaskTemplates,
  publishFlashSchedulePlan,
  replaceFlashNpcLocationLinks,
  replaceFlashNpcTaskLinks,
  replaceFlashTaskDestinationLinks,
  seedBuiltinFlashCatalog,
  updateFlashEncounterLocation,
  updateFlashNpc,
  updateFlashTaskDestination,
  updateFlashTaskTemplate,
  withdrawActiveFlashAssignmentsForDestination,
  withdrawOfferedFlashEncountersForTaskTemplate,
} from "../../repositories/flashRepo";
import {
  listFlashStoryAdmin,
  publishFlashStorySeason,
  reviewFlashStoryEpisode,
  updateFlashStoryEpisode,
} from "../../repositories/flashStoryRepo";
import {
  addServiceDays,
  generateOrReplaceFlashScheduleDraftForAdmin,
  previewPublishedFlashScheduleRegenerationForAdmin,
  replacePublishedFlashScheduleForAdmin,
  shenzhenDateString,
  validateAndReplaceFlashScheduleDraftForAdmin,
  updateUpcomingFlashShiftForAdmin,
  validateFlashScheduleDraft,
} from "../../services/flashScheduleService";
import { getFlashFeatureReadiness } from "../../services/flashService";
import {
  FlashManualHoldError,
  getFlashManualHoldStatus,
  startFlashManualHoldForAdmin,
  stopFlashManualHoldForAdmin,
} from "../../services/flashManualHoldService";

const SHENZHEN_DISTRICTS = [
  "南山区",
  "福田区",
  "罗湖区",
  "宝安区",
  "龙岗区",
  "盐田区",
  "龙华区",
  "坪山区",
  "光明区",
  "大鹏新区",
] as const;

const TASK_CATEGORIES = [
  "城市出发",
  "文化娱乐",
  "身体动起来",
  "一直想做",
  "关系连接",
  "NPC传话",
] as const;
const uuidSchema = z.string().uuid();
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const animalSpeciesSchema = z.string().trim().min(1).max(20);
const serviceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "日期无效");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const storyContentSchema = z.object({
  opening: z.string().trim().min(1).max(240),
  action: z.string().trim().min(1).max(300),
  discovery: z.string().trim().min(1).max(300),
  question: z.object({
    id: z.string().trim().min(1).max(80),
    prompt: z.string().trim().min(1).max(100),
    options: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(60),
      tags: z.array(z.string()).max(10).default([]),
    })).min(2).max(3),
  }),
  responseByOption: z.record(z.string(), z.string().trim().min(1).max(240)),
  effectsByOption: z.record(z.string(), z.array(z.object({
    dimension: z.enum(["trust", "attachment", "intervention", "truth"]),
    delta: z.number().int().min(-3).max(3),
    flag: z.string().trim().min(1).max(80).optional(),
  }).strict()).min(1).max(4)).optional(),
  echoByFlag: z.record(z.string(), z.string().trim().min(1).max(180)).optional(),
  personalizedFallbackByOption: z.record(z.string(), z.string().trim().min(1).max(300)).optional(),
  closing: z.string().trim().min(1).max(300),
}).strict();

const storyMotionSchema = z.object({
  ambient: z.enum(["none", "breathe", "drift"]),
  blinkAssetUrl: z.string().url().optional(),
  blinkIntervalSeconds: z.number().int().min(3).max(20).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.blinkIntervalSeconds && !value.blinkAssetUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["blinkAssetUrl"], message: "启用眨眼前必须上传审核过的眨眼帧" });
  }
});

const storyEpisodePatchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(120).optional(),
  content: storyContentSchema.optional(),
  motion: storyMotionSchema.optional(),
  isActive: z.boolean().optional(),
  fragment: z.object({
    category: z.enum(["object", "past", "relationship", "key"]),
    title: z.string().trim().min(1).max(120),
    fact: z.string().trim().min(1).max(300),
    assetUrl: z.string().url().nullable().optional(),
  }).strict().optional(),
}).strict();

const dialogueOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(40),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
}).strict();

const dialogueQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(2).max(80),
  options: z.array(dialogueOptionSchema).min(2).max(5),
}).strict();

const npcPatchSchema = z.object({
  name: z.string().trim().min(1).max(12).optional(),
  species: animalSpeciesSchema.optional(),
  personalitySummary: z.string().trim().min(4).max(160).optional(),
  inviteLine: z.string().trim().min(4).max(120).optional(),
  voiceGuide: z.array(z.string().trim().min(1).max(240)).min(1).max(12).optional(),
  dialogueQuestions: z.array(dialogueQuestionSchema).min(1).max(2).optional(),
  eligibleWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  oneShiftProbability: z.number().int().min(0).max(100).optional(),
  twoShiftProbability: z.number().int().min(0).max(100).optional(),
  minShiftMinutes: z.number().int().min(180).max(300).optional(),
  maxShiftMinutes: z.number().int().min(180).max(300).optional(),
  minGapMinutes: z.number().int().min(90).max(720).optional(),
  themeColor: hexColorSchema.optional(),
  avatarUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).max(99).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

const availabilityWindowSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
}).strict().superRefine((value, context) => {
  const start = minutesFromTime(value.startTime);
  const end = minutesFromTime(value.endTime);
  if (start < 9 * 60 || end > 21 * 60 || end <= start) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "地点可用时间必须位于 09:00–21:00" });
  }
});

const locationFields = {
  name: z.string().trim().min(1).max(50),
  city: z.literal("深圳").default("深圳"),
  district: z.enum(SHENZHEN_DISTRICTS),
  address: z.string().trim().min(4).max(160),
  latitude: z.number().finite().min(22.35).max(22.95),
  longitude: z.number().finite().min(113.7).max(114.75),
  approvalStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  safetyNotes: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().default(true),
};

const encounterLocationCreateSchema = z.object({
  ...locationFields,
  availabilityWindows: z.array(availabilityWindowSchema).min(1).max(21),
  npcIds: z.array(uuidSchema).max(100).default([]),
}).strict().superRefine(validateApprovedEncounterLocation);

const encounterLocationPatchSchema = z.object({
  name: locationFields.name.optional(),
  city: z.literal("深圳").optional(),
  district: locationFields.district.optional(),
  address: locationFields.address.optional(),
  latitude: locationFields.latitude.optional(),
  longitude: locationFields.longitude.optional(),
  approvalStatus: locationFields.approvalStatus.optional(),
  safetyNotes: locationFields.safetyNotes,
  isActive: z.boolean().optional(),
  availabilityWindows: z.array(availabilityWindowSchema).min(1).max(21).optional(),
  npcIds: z.array(uuidSchema).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

const taskDestinationCreateSchema = z.object({
  ...locationFields,
  destinationType: z.enum(["public_place", "shop_exterior", "park", "culture_space"]).default("public_place"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
}).strict().superRefine(validateApprovedDestination);

const taskDestinationPatchSchema = z.object({
  name: locationFields.name.optional(),
  city: z.literal("深圳").optional(),
  district: locationFields.district.optional(),
  address: locationFields.address.optional(),
  latitude: locationFields.latitude.optional(),
  longitude: locationFields.longitude.optional(),
  approvalStatus: locationFields.approvalStatus.optional(),
  safetyNotes: locationFields.safetyNotes,
  isActive: z.boolean().optional(),
  destinationType: z.enum(["public_place", "shop_exterior", "park", "culture_space"]).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

const feedbackOptionSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(40),
}).strict();

const feedbackPromptSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  prompt: z.string().trim().min(2).max(100),
  options: z.array(feedbackOptionSchema).min(2).max(5),
}).strict();

const taskTemplateFields = {
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
  category: z.enum(TASK_CATEGORIES),
  title: z.string().trim().min(2).max(40),
  brief: z.string().trim().min(4).max(160),
  instructions: z.string().trim().min(6).max(280),
  dialogueIntro: z.string().trim().min(4).max(160),
  feedbackPrompts: z.array(feedbackPromptSchema).min(1).max(2),
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  durationDays: z.literal(7).default(7),
  baseWeight: z.number().int().min(1).max(1000).default(100),
  safetyLevel: z.enum(["L1", "L2"]),
  safetyNotes: z.string().trim().min(8).max(280),
  isHumanReviewed: z.boolean().default(false),
  isActive: z.boolean().default(false),
  npcIds: z.array(uuidSchema).min(1).max(100),
  destinationIds: z.array(uuidSchema).max(200).default([]),
};

const taskTemplateCreateSchema = z.object(taskTemplateFields).strict();
const taskTemplatePatchSchema = z.object({
  expectedContentVersion: z.number().int().positive(),
  code: taskTemplateFields.code.optional(),
  category: taskTemplateFields.category.optional(),
  title: taskTemplateFields.title.optional(),
  brief: taskTemplateFields.brief.optional(),
  instructions: taskTemplateFields.instructions.optional(),
  dialogueIntro: taskTemplateFields.dialogueIntro.optional(),
  feedbackPrompts: taskTemplateFields.feedbackPrompts.optional(),
  tags: taskTemplateFields.tags.optional(),
  durationDays: z.literal(7).optional(),
  baseWeight: taskTemplateFields.baseWeight.optional(),
  safetyLevel: taskTemplateFields.safetyLevel.optional(),
  safetyNotes: taskTemplateFields.safetyNotes.optional(),
  isHumanReviewed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  npcIds: z.array(uuidSchema).min(1).max(100).optional(),
  destinationIds: z.array(uuidSchema).max(200).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

const scheduleShiftSchema = z.object({
  id: uuidSchema.optional(),
  npcId: uuidSchema,
  locationId: uuidSchema,
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(["draft", "cancelled"]).default("draft"),
  source: z.enum(["generated", "fallback", "manual"]).default("manual"),
}).strict();

const scheduleUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.literal("draft").optional(),
  shifts: z.array(scheduleShiftSchema).max(200),
}).strict();

const schedulePublishSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

const upcomingShiftUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    expectedVersion: z.number().int().positive(),
    shift: scheduleShiftSchema.omit({ id: true, status: true }).extend({ status: z.literal("published").optional() }),
  }).strict(),
  z.object({
    action: z.literal("cancel"),
    expectedVersion: z.number().int().positive(),
  }).strict(),
]);

const scheduleRegenerationPreviewSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

const scheduleRegenerationReplaceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  generationSeed: z.string().trim().min(1).max(80),
  previewDigest: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(4, "请填写重新生成原因").max(200),
}).strict();

const manualHoldStartSchema = z.object({
  npcId: uuidSchema,
  locationId: uuidSchema,
}).strict();

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function validateApprovedEncounterLocation(
  value: { approvalStatus: string; isActive: boolean; safetyNotes?: string | null; npcIds: string[] },
  context: z.RefinementCtx,
) {
  if (value.approvalStatus !== "approved" || !value.isActive) return;
  if (!value.safetyNotes?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["safetyNotes"], message: "审核通过前请填写安全备注" });
  }
  if (value.npcIds.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["npcIds"], message: "审核通过的地点至少关联一位 NPC" });
  }
}

function validateApprovedDestination(
  value: { approvalStatus: string; isActive: boolean; safetyNotes?: string | null },
  context: z.RefinementCtx,
) {
  if (value.approvalStatus === "approved" && value.isActive && !value.safetyNotes?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["safetyNotes"], message: "审核通过前请填写安全备注" });
  }
}

async function verifyApprovedShenzhenCoordinate(value: {
  approvalStatus: string;
  isActive: boolean;
  district: string;
  latitude: number;
  longitude: number;
}, requestId?: string) {
  if (value.approvalStatus !== "approved" || !value.isActive) return;
  const resolved = await reverseGeocodeCoordinate({
    latitude: value.latitude,
    longitude: value.longitude,
  }, {
    failClosed: true,
    requestId,
    purpose: "flash-location-approval",
  });
  if (!resolved.success || resolved.source !== "tencent") {
    throw new Error("FLASH_ADMIN_INVALID:地图服务尚未完成真实行政区校验，请稍后重试审核");
  }
  if (resolved.city?.replace(/市$/, "") !== "深圳" || resolved.district !== value.district) {
    throw new Error(`FLASH_ADMIN_INVALID:坐标反查结果为${resolved.city ?? "未知城市"} ${resolved.district ?? "未知区"}，与深圳 ${value.district}不一致`);
  }
}

function normalizeFeedbackPrompts(prompts: z.infer<typeof feedbackPromptSchema>[]): FlashFeedbackPrompt[] {
  return prompts.map((prompt, promptIndex) => ({
    id: prompt.id ?? `feedback_${promptIndex + 1}`,
    prompt: prompt.prompt,
    options: prompt.options.map((option, optionIndex) => ({
      id: option.id ?? `option_${optionIndex + 1}`,
      label: option.label,
    })),
  }));
}

function safeNpcAudit(row: any) {
  if (!row) return undefined;
  return {
    name: row.name,
    species: row.species,
    eligibleWeekdays: row.eligibleWeekdays,
    oneShiftProbability: row.oneShiftProbability,
    twoShiftProbability: row.twoShiftProbability,
    minShiftMinutes: row.minShiftMinutes,
    maxShiftMinutes: row.maxShiftMinutes,
    minGapMinutes: row.minGapMinutes,
    isActive: row.isActive,
  };
}

function safeLocationAudit(row: any) {
  if (!row) return undefined;
  return {
    name: row.name,
    district: row.district,
    approvalStatus: row.approvalStatus,
    isActive: row.isActive,
  };
}

function safeTaskAudit(row: any) {
  if (!row) return undefined;
  return {
    code: row.code,
    category: row.category,
    title: row.title,
    contentVersion: row.contentVersion,
    reviewStatus: row.reviewStatus,
    isHumanReviewed: row.isHumanReviewed,
    isActive: row.isActive,
  };
}

function audit(
  req: any,
  action: AdminAuditAction,
  targetEntityType: string,
  targetEntityId?: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  context?: Record<string, unknown>,
) {
  logAdminAudit({
    action,
    adminId: getActingAdminId(req),
    adminRole: req.adminRole,
    targetEntityType,
    targetEntityId,
    before,
    after,
    context,
  });
}

function retiredFlashTaskAdmin(_req: any, res: any) {
  return res.status(410).json({
    code: "FLASH_TASK_FLOW_RETIRED",
    error: "旧任务库已转为历史只读，请在第一季故事中维护正式内容",
  });
}

function validationFailure(res: any, error: z.ZodError) {
  return res.status(400).json({
    code: "FLASH_ADMIN_INVALID_INPUT",
    message: error.issues[0]?.message ?? "提交内容不完整",
    issues: error.issues,
  });
}

function routeFailure(req: any, res: any, label: string, error: unknown) {
  if (error instanceof TencentMapValidationError) {
    const response = {
      RATE_LIMIT_QPS: {
        status: 429,
        code: "FLASH_ADMIN_MAP_QPS_LIMIT_REACHED",
        message: "腾讯地图请求过于频繁，请稍后重试",
      },
      RATE_LIMIT_DAILY: {
        status: 429,
        code: "FLASH_ADMIN_MAP_DAILY_QUOTA_REACHED",
        message: "腾讯地图每日调用额度达到限制",
      },
      KEY_INVALID: {
        status: 503,
        code: "FLASH_ADMIN_MAP_KEY_INVALID",
        message: "腾讯地图 Key 无效，请检查服务配置",
      },
      KEY_NOT_ENABLED: {
        status: 503,
        code: "FLASH_ADMIN_MAP_KEY_NOT_ENABLED",
        message: "腾讯地图 WebService 未开启",
      },
      PERMISSION_ERROR: {
        status: 503,
        code: "FLASH_ADMIN_MAP_PERMISSION",
        message: "腾讯地图权限配置异常",
      },
      SIGNATURE_ERROR: {
        status: 503,
        code: "FLASH_ADMIN_MAP_SIGNATURE",
        message: "腾讯地图签名配置异常",
      },
      REQUEST_ERROR: {
        status: 400,
        code: "FLASH_ADMIN_MAP_INVALID_PARAMETERS",
        message: "腾讯地图拒绝了校验参数，请检查地点坐标后重试",
      },
      NETWORK_ERROR: {
        status: 503,
        code: "FLASH_ADMIN_MAP_NETWORK",
        message: "腾讯地图服务连接失败",
      },
      UPSTREAM_UNKNOWN: {
        status: 502,
        code: "FLASH_ADMIN_MAP_UPSTREAM",
        message: "腾讯地图返回未识别错误，请按请求编号查询服务端诊断日志",
      },
    }[error.category];
    return res.status(response.status).json({
      code: response.code,
      category: error.category,
      message: response.message,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[FlashAdmin] ${label}`, { error: message, adminId: getActingAdminId(req) });
  if (message.startsWith("FLASH_ADMIN_")) {
    const [code, statusText] = message.split(":", 2);
    const status = code.includes("NOT_FOUND") ? 404 : code.includes("CONFLICT") ? 409 : 400;
    return res.status(status).json({ code, message: statusText || "操作没有完成" });
  }
  return res.status(500).json({ code: "FLASH_ADMIN_FAILED", message: "操作没有完成，请稍后再试" });
}

async function enrichedNpcs(executor: any = db) {
  const [npcs, links] = await Promise.all([
    listFlashNpcs(executor),
    listFlashNpcLocationLinks(executor),
  ]);
  return npcs.map((npc: any) => ({
    ...npc,
    locationIds: links.filter((link: any) => link.npcId === npc.id && link.isActive).map((link: any) => link.locationId),
  }));
}

async function enrichedEncounterLocations(executor: any = db) {
  const [locations, links] = await Promise.all([
    listFlashEncounterLocations(executor),
    listFlashNpcLocationLinks(executor),
  ]);
  return locations.map((location: any) => ({
    ...location,
    npcIds: links.filter((link: any) => link.locationId === location.id && link.isActive).map((link: any) => link.npcId),
  }));
}

async function enrichedTaskTemplates(executor: any = db) {
  const [templates, npcLinks, destinationLinks] = await Promise.all([
    listFlashTaskTemplates(executor),
    listFlashNpcTaskLinks(executor),
    listFlashTaskDestinationLinks(executor),
  ]);
  return templates.map((template: any) => {
    const activeNpcLinks = npcLinks.filter((link: any) => link.taskTemplateId === template.id && link.isActive);
    return {
      ...template,
      npcIds: activeNpcLinks.map((link: any) => link.npcId),
      // Admin-only evidence for human review. These are the exact persisted
      // strings used at runtime, not a client-side approximation of NPC voice.
      npcCopies: activeNpcLinks.map((link: any) => ({
        npcId: link.npcId,
        requestCopy: link.requestCopy,
        deliveryCopy: link.deliveryCopy,
      })),
      destinationIds: destinationLinks
        .filter((link: any) => link.taskTemplateId === template.id && link.isActive)
        .map((link: any) => link.destinationId),
    };
  });
}

function sortedStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hasFlashTaskContentChange(current: any, patch: Record<string, unknown>): boolean {
  const scalarKeys = [
    "code",
    "category",
    "title",
    "brief",
    "instructions",
    "dialogueIntro",
    "durationDays",
    "baseWeight",
    "safetyLevel",
    "safetyNotes",
  ] as const;
  for (const key of scalarKeys) {
    if (!(key in patch)) continue;
    const next = key === "code" && typeof patch[key] === "string"
      ? patch[key].toUpperCase()
      : patch[key];
    if (next !== current[key]) return true;
  }
  if ("feedbackPrompts" in patch && !sameJson(normalizeFeedbackPrompts(patch.feedbackPrompts as any), current.feedbackPrompts)) return true;
  if ("tags" in patch && !sameJson(sortedStrings(patch.tags), sortedStrings(current.tags))) return true;
  if ("npcIds" in patch && !sameJson(sortedStrings(patch.npcIds), sortedStrings(current.npcIds))) return true;
  if ("destinationIds" in patch && !sameJson(sortedStrings(patch.destinationIds), sortedStrings(current.destinationIds))) return true;
  return false;
}

async function enrichSchedule(schedule: any, executor: any = db) {
  if (!schedule) return { plan: null, shifts: [] };
  const [npcs, locations] = await Promise.all([
    listFlashNpcs(executor),
    listFlashEncounterLocations(executor),
  ]);
  const npcById = new Map(npcs.map((npc: any) => [npc.id, npc]));
  const locationById = new Map(locations.map((location: any) => [location.id, location]));
  return {
    plan: schedule.plan,
    shifts: schedule.shifts.map((shift: any) => {
      const npc: any = npcById.get(shift.npcId);
      const location: any = locationById.get(shift.locationId);
      return {
        ...shift,
        npc: npc ? { id: npc.id, slug: npc.slug, name: npc.name } : null,
        location: location ? { id: location.id, name: location.name, district: location.district } : null,
      };
    }),
  };
}

async function scheduleValidationContext(executor: any = db) {
  const inputs = await listFlashSchedulingInputs(executor);
  const npcsById = new Map<string, any>(inputs.npcs.map((npc: any) => [npc.id, npc]));
  const locationsByNpc = new Map<string, any[]>();
  for (const link of inputs.links) {
    const current = locationsByNpc.get(link.npcId) ?? [];
    current.push({
      id: link.locationId,
      name: link.locationName,
      district: link.district,
      availabilityWindows: link.availabilityWindows,
      weight: link.weight,
    });
    locationsByNpc.set(link.npcId, current);
  }
  return { inputs, npcsById, locationsByNpc };
}

function parseDraftShifts(shifts: z.infer<typeof scheduleShiftSchema>[]) {
  return shifts.filter((shift) => shift.status !== "cancelled").map((shift) => ({
    npcId: shift.npcId,
    locationId: shift.locationId,
    startsAt: new Date(shift.startsAt),
    endsAt: new Date(shift.endsAt),
    source: shift.source,
  }));
}

function taskLinkCopy(npcSlug: string, brief: string) {
  return buildFlashNpcTaskRequestCopy(npcSlug, { brief } as FlashTaskSeed);
}

async function assertTaskCanActivate(taskId: string, executor: any = db) {
  const [tasks, npcLinks, destinationLinks, destinations] = await Promise.all([
    listFlashTaskTemplates(executor),
    listFlashNpcTaskLinks(executor),
    listFlashTaskDestinationLinks(executor),
    listFlashTaskDestinations(executor),
  ]);
  const task = tasks.find((candidate: any) => candidate.id === taskId);
  if (!task) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到任务模板");
  if (!task.isHumanReviewed || task.reviewStatus !== "active") {
    throw new Error("FLASH_ADMIN_CONFLICT:任务尚未完成人工审核");
  }
  if (!npcLinks.some((link: any) => link.taskTemplateId === taskId && link.isActive)) {
    throw new Error("FLASH_ADMIN_CONFLICT:任务至少需要关联一位 NPC");
  }
  const readyDestinationIds = new Set(destinations
    .filter((destination: any) => destination.isActive && destination.approvalStatus === "approved")
    .map((destination: any) => destination.id));
  if (!destinationLinks.some((link: any) => (
    link.taskTemplateId === taskId && link.isActive && readyDestinationIds.has(link.destinationId)
  ))) {
    throw new Error("FLASH_ADMIN_CONFLICT:任务至少需要关联一个已审核目的地");
  }
}

export function registerAdminAlangRoutes(app: Express): void {
  app.get("/api/admin/alang/readiness", requireAdmin, async (req, res) => {
    try {
      res.json(await getFlashFeatureReadiness());
    } catch (error) {
      routeFailure(req, res, "readiness failed", error);
    }
  });

  app.get("/api/admin/alang/overview", requireAdmin, async (req, res) => {
    try {
      const readiness = await getFlashFeatureReadiness();
      if (!readiness.schemaReady) {
        res.json({ readiness, counts: {}, today: null, nextDraft: null });
        return;
      }
      const today = shenzhenDateString(new Date());
      const tomorrow = addServiceDays(today, 1);
      const [npcs, locations, destinations, templates, todaySchedule, tomorrowSchedule] = await Promise.all([
        listFlashNpcs(),
        listFlashEncounterLocations(),
        listFlashTaskDestinations(),
        listFlashTaskTemplates(),
        getFlashSchedulePlanByDate(today),
        getFlashSchedulePlanByDate(tomorrow),
      ]);
      const [enrichedToday, enrichedTomorrow] = await Promise.all([
        enrichSchedule(todaySchedule),
        enrichSchedule(tomorrowSchedule),
      ]);
      res.json({
        readiness,
        counts: {
          activeNpcs: npcs.filter((npc: any) => npc.isActive).length,
          activeEncounterLocations: locations.filter((location: any) => location.isActive && location.approvalStatus === "approved").length,
          approvedTaskDestinations: destinations.filter((destination: any) => destination.isActive && destination.approvalStatus === "approved").length,
          activeTaskTemplates: templates.filter((template: any) => template.isActive && template.isHumanReviewed).length,
          publishedShiftsToday: todaySchedule?.shifts.filter((shift: any) => shift.status === "published").length ?? 0,
        },
        today: enrichedToday,
        nextDraft: enrichedTomorrow,
      });
    } catch (error) {
      routeFailure(req, res, "overview failed", error);
    }
  });

  app.get("/api/admin/alang/test-arrival", requireAdmin, async (_req, res) => {
    const available = (process.env.APP_MODE ?? "production") !== "production";
    const configured = await getFeatureFlag("flashAnyLocationArrivalTestEnabled", false);
    res.json({ available, enabled: available && configured });
  });

  app.put("/api/admin/alang/test-arrival", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = z.object({ enabled: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    if ((process.env.APP_MODE ?? "production") === "production") {
      return void res.status(403).json({
        code: "FLASH_TEST_ARRIVAL_PRODUCTION_FORBIDDEN",
        message: "生产环境不允许跳过实际到达校验",
      });
    }
    try {
      const key = "flashAnyLocationArrivalTestEnabled";
      const before = await getFeatureFlag(key, false);
      const adminId = getActingAdminId(req);
      await db.insert(featureFlags).values({
        key,
        value: String(parsed.data.enabled),
        description: "街头盲盒非生产环境任意地点到达测试",
        updatedBy: adminId,
      }).onConflictDoUpdate({
        target: featureFlags.key,
        set: {
          value: String(parsed.data.enabled),
          description: "街头盲盒非生产环境任意地点到达测试",
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      });
      await refreshFeatureFlag(key);
      audit(req, "FEATURE_FLAG_UPDATED", "feature_flag", key,
        { enabled: before }, { enabled: parsed.data.enabled });
      res.json({ available: true, enabled: parsed.data.enabled });
    } catch (error) {
      routeFailure(req, res, "test arrival toggle failed", error);
    }
  });

  app.get("/api/admin/alang/manual-holds", requireAdmin, async (req, res) => {
    try {
      res.json(await getFlashManualHoldStatus());
    } catch (error) {
      routeFailure(req, res, "manual hold status failed", error);
    }
  });

  app.post("/api/admin/alang/manual-holds/start", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = manualHoldStartSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actorId = getActingAdminId(req);
      const result = await startFlashManualHoldForAdmin({
        ...parsed.data,
        actorId,
      });
      audit(req, "FLASH_MANUAL_HOLD_STARTED", "flash_shift", result.hold.appearanceId, undefined, {
        availabilityMode: "manual_hold",
        npcId: result.hold.npc.id,
        npcName: result.hold.npc.name,
        locationId: result.hold.location.id,
        locationName: result.hold.location.name,
        created: result.created,
      });
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      if (error instanceof FlashManualHoldError) {
        return void res.status(error.status).json({ code: error.code, message: error.message });
      }
      routeFailure(req, res, "manual hold start failed", error);
    }
  });

  app.post("/api/admin/alang/manual-holds/:appearanceId/stop", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = uuidSchema.safeParse(req.params.appearanceId);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const result = await stopFlashManualHoldForAdmin({
        appearanceId: parsed.data,
        actorId: getActingAdminId(req),
      });
      if (result.stopped && result.hold) {
        audit(req, "FLASH_MANUAL_HOLD_STOPPED", "flash_shift", result.hold.appearanceId, {
          availabilityMode: "manual_hold",
          npcId: result.hold.npc.id,
          locationId: result.hold.location.id,
          active: true,
        }, {
          availabilityMode: "manual_hold",
          npcId: result.hold.npc.id,
          locationId: result.hold.location.id,
          active: false,
        });
      }
      res.json(result);
    } catch (error) {
      if (error instanceof FlashManualHoldError) {
        return void res.status(error.status).json({ code: error.code, message: error.message });
      }
      routeFailure(req, res, "manual hold stop failed", error);
    }
  });

  app.post("/api/admin/alang/catalog/seed", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const readiness = await getFlashFeatureReadiness();
      if (!readiness.schemaReady) {
        res.status(503).json({ code: "FLASH_SCHEMA_NOT_READY", message: "请先完成并核验数据库迁移" });
        return;
      }
      const result = await seedBuiltinFlashCatalog();
      audit(req, "FLASH_CATALOG_SEEDED", "flash_catalog", "builtin-v1", undefined, {
        npcCount: result.npcCount,
        taskCount: result.taskCount,
      });
      res.json(result);
    } catch (error) {
      routeFailure(req, res, "catalog seed failed", error);
    }
  });

  app.get("/api/admin/alang/npcs", requireAdmin, async (req, res) => {
    try {
      res.json({ items: await enrichedNpcs() });
    } catch (error) {
      routeFailure(req, res, "NPC list failed", error);
    }
  });

  app.post("/api/admin/alang/npcs", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const body = z.object({
      slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
      name: z.string().trim().min(1).max(12),
      species: animalSpeciesSchema,
      personalitySummary: z.string().trim().min(4).max(160),
      inviteLine: z.string().trim().min(4).max(120),
      voiceGuide: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
      dialogueQuestions: z.array(dialogueQuestionSchema).min(1).max(2),
      eligibleWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
      oneShiftProbability: z.number().int().min(0).max(100).default(35),
      twoShiftProbability: z.number().int().min(0).max(100).default(65),
      minShiftMinutes: z.number().int().min(180).max(300).default(180),
      maxShiftMinutes: z.number().int().min(180).max(300).default(300),
      minGapMinutes: z.number().int().min(90).max(720).default(90),
      themeColor: hexColorSchema,
      avatarUrl: z.string().url().nullable().optional(),
      sortOrder: z.number().int().min(0).max(99).default(0),
      isActive: z.boolean().default(false),
    }).strict().superRefine((value, context) => {
      if (value.oneShiftProbability + value.twoShiftProbability !== 100) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["twoShiftProbability"], message: "1 班与 2 班概率之和必须为 100" });
      }
      if (value.maxShiftMinutes < value.minShiftMinutes) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxShiftMinutes"], message: "最长班次不能短于最短班次" });
      }
    }).safeParse(req.body);
    if (!body.success) return void validationFailure(res, body.error);
    try {
      const created = await createFlashNpc(body.data as any);
      audit(req, "FLASH_NPC_CREATED", "flash_npc", created.id, undefined, safeNpcAudit(created));
      res.status(201).json(created);
    } catch (error) {
      routeFailure(req, res, "NPC create failed", error);
    }
  });

  app.patch("/api/admin/alang/npcs/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = npcPatchSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const current = (await listFlashNpcs()).find((npc: any) => npc.id === req.params.id);
      if (!current) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到这位 NPC");
      const next = { ...current, ...parsed.data };
      if (next.oneShiftProbability + next.twoShiftProbability !== 100) {
        throw new Error("FLASH_ADMIN_INVALID:1 班与 2 班概率之和必须为 100");
      }
      if (next.maxShiftMinutes < next.minShiftMinutes) {
        throw new Error("FLASH_ADMIN_INVALID:最长班次不能短于最短班次");
      }
      if (
        parsed.data.eligibleWeekdays !== undefined
        && isCanonicalFlashNpcSlug(current.slug)
        && !matchesCanonicalFlashNpcWeekdays(current.slug, next.eligibleWeekdays)
      ) {
        return void res.status(400).json({
          code: "FLASH_ADMIN_CANONICAL_WEEKDAYS_FIXED",
          message: "正式版角色的固定上线星期不能修改",
        });
      }
      const updated = await updateFlashNpc(req.params.id, parsed.data as any);
      audit(req, "FLASH_NPC_UPDATED", "flash_npc", req.params.id, safeNpcAudit(current), safeNpcAudit(updated));
      res.json(updated);
    } catch (error) {
      routeFailure(req, res, "NPC update failed", error);
    }
  });

  app.get("/api/admin/alang/encounter-locations", requireAdmin, async (req, res) => {
    try {
      res.json({ items: await enrichedEncounterLocations() });
    } catch (error) {
      routeFailure(req, res, "encounter location list failed", error);
    }
  });

  app.post("/api/admin/alang/encounter-locations", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = encounterLocationCreateSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      const { npcIds, ...values } = parsed.data;
      await verifyApprovedShenzhenCoordinate(parsed.data, req.requestId);
      const created = await db.transaction(async (tx: any) => {
        const row = await createFlashEncounterLocation({
          ...values,
          coordinateSystem: "gcj02",
          lastReviewedAt: values.approvalStatus === "approved" ? new Date() : null,
          reviewedBy: values.approvalStatus === "approved" ? actor : null,
        } as any, tx);
        await replaceFlashNpcLocationLinks(row.id, npcIds, tx);
        return row;
      });
      audit(req, "FLASH_ENCOUNTER_LOCATION_CREATED", "flash_encounter_location", created.id, undefined, safeLocationAudit(created), { npcCount: npcIds.length });
      res.status(201).json({ ...created, npcIds });
    } catch (error) {
      routeFailure(req, res, "encounter location create failed", error);
    }
  });

  app.patch("/api/admin/alang/encounter-locations/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = encounterLocationPatchSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      const locations = await enrichedEncounterLocations();
      const current = locations.find((location: any) => location.id === req.params.id);
      if (!current) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到闪现地点");
      const reviewBoundFields = ["name", "district", "address", "latitude", "longitude", "availabilityWindows", "safetyNotes", "npcIds"] as const;
      const reviewBoundContentChanged = reviewBoundFields.some((key) => parsed.data[key] !== undefined);
      const requiresFreshReview = current.approvalStatus === "approved" && reviewBoundContentChanged;
      const valuesWithReview = {
        ...parsed.data,
        ...(requiresFreshReview ? {
          approvalStatus: "pending_review" as const,
          isActive: false,
          lastReviewedAt: null,
          reviewedBy: null,
        } : parsed.data.approvalStatus === "approved" ? {
          lastReviewedAt: new Date(),
          reviewedBy: actor,
        } : {}),
      };
      const next = { ...current, ...valuesWithReview, npcIds: parsed.data.npcIds ?? current.npcIds };
      const safety = z.object({
        approvalStatus: z.string(),
        isActive: z.boolean(),
        safetyNotes: z.string().nullable().optional(),
        npcIds: z.array(z.string()),
      }).superRefine(validateApprovedEncounterLocation).safeParse(next);
      if (!safety.success) return void validationFailure(res, safety.error);
      await verifyApprovedShenzhenCoordinate(next, req.requestId);
      const { npcIds, ...values } = valuesWithReview;
      const updated = await db.transaction(async (tx: any) => {
        const row = await updateFlashEncounterLocation(req.params.id, values as any, tx);
        if (!row) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到闪现地点");
        if (npcIds) await replaceFlashNpcLocationLinks(row.id, npcIds, tx);
        return row;
      });
      audit(req, "FLASH_ENCOUNTER_LOCATION_UPDATED", "flash_encounter_location", req.params.id, safeLocationAudit(current), safeLocationAudit(updated), {
        npcCount: next.npcIds.length,
        requiresFreshReview,
      });
      res.json({ ...updated, npcIds: next.npcIds });
    } catch (error) {
      routeFailure(req, res, "encounter location update failed", error);
    }
  });

  app.get("/api/admin/alang/task-destinations", requireAdmin, async (req, res) => {
    try {
      res.json({ items: await listFlashTaskDestinations() });
    } catch (error) {
      routeFailure(req, res, "task destination list failed", error);
    }
  });

  app.post("/api/admin/alang/task-destinations", requireAdmin, requireOperatorOrAbove, retiredFlashTaskAdmin, async (req, res) => {
    const parsed = taskDestinationCreateSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      await verifyApprovedShenzhenCoordinate(parsed.data, req.requestId);
      const created = await createFlashTaskDestination({
        ...parsed.data,
        coordinateSystem: "gcj02",
        lastReviewedAt: parsed.data.approvalStatus === "approved" ? new Date() : null,
        reviewedBy: parsed.data.approvalStatus === "approved" ? actor : null,
      } as any);
      audit(req, "FLASH_TASK_DESTINATION_CREATED", "flash_task_destination", created.id, undefined, safeLocationAudit(created));
      res.status(201).json(created);
    } catch (error) {
      routeFailure(req, res, "task destination create failed", error);
    }
  });

  app.patch("/api/admin/alang/task-destinations/:id", requireAdmin, requireOperatorOrAbove, retiredFlashTaskAdmin, async (req, res) => {
    const parsed = taskDestinationPatchSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      const current = (await listFlashTaskDestinations()).find((destination: any) => destination.id === req.params.id);
      if (!current) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到任务目的地");
      const reviewBoundFields = ["name", "district", "address", "latitude", "longitude", "destinationType", "safetyNotes"] as const;
      const reviewBoundContentChanged = reviewBoundFields.some((key) => (
        parsed.data[key] !== undefined && parsed.data[key] !== current[key]
      ));
      const requiresFreshReview = current.approvalStatus === "approved" && reviewBoundContentChanged;
      const now = new Date();
      const values = {
        ...parsed.data,
        ...(requiresFreshReview ? {
          approvalStatus: "draft" as const,
          isActive: false,
          lastReviewedAt: null,
          reviewedBy: null,
        } : parsed.data.approvalStatus === "approved" ? { lastReviewedAt: now, reviewedBy: actor } : {}),
      };
      const next = { ...current, ...values };
      const safety = z.object({
        approvalStatus: z.string(),
        isActive: z.boolean(),
        safetyNotes: z.string().nullable().optional(),
      }).superRefine(validateApprovedDestination).safeParse(next);
      if (!safety.success) return void validationFailure(res, safety.error);
      await verifyApprovedShenzhenCoordinate(next, req.requestId);
      const result = await db.transaction(async (tx: any) => {
        const updated = await updateFlashTaskDestination(req.params.id, values as any, tx);
        if (!updated) throw new Error("FLASH_ADMIN_NOT_FOUND:任务目的地不存在");
        const withdrawn = updated.approvalStatus !== "approved" || !updated.isActive
          ? await withdrawActiveFlashAssignmentsForDestination(
              updated.id,
              "地点已由运营撤回，为了安全，这个任务已经结束",
              now,
              tx,
            )
          : { assignmentCount: 0, encounterCount: 0 };
        return { updated, withdrawn };
      });
      audit(req, "FLASH_TASK_DESTINATION_UPDATED", "flash_task_destination", req.params.id, safeLocationAudit(current), safeLocationAudit(result.updated), {
        requiresFreshReview,
        withdrawnAssignments: result.withdrawn.assignmentCount,
        withdrawnOffers: result.withdrawn.encounterCount,
      });
      res.json(result.updated);
    } catch (error) {
      routeFailure(req, res, "task destination update failed", error);
    }
  });

  app.get("/api/admin/alang/task-templates", requireAdmin, async (req, res) => {
    try {
      res.json({ items: await enrichedTaskTemplates() });
    } catch (error) {
      routeFailure(req, res, "task template list failed", error);
    }
  });

  app.post("/api/admin/alang/task-templates", requireAdmin, requireOperatorOrAbove, retiredFlashTaskAdmin, async (req, res) => {
    const parsed = taskTemplateCreateSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    if (parsed.data.isHumanReviewed) {
      return void res.status(409).json({
        code: "FLASH_ADMIN_REVIEW_REQUIRES_SAVED_COPY",
        error: "请先保存任务，再核对各 NPC 的最终话术后完成人工审核",
      });
    }
    try {
      const actor = getActingAdminId(req);
      const { npcIds, destinationIds, isHumanReviewed, ...input } = parsed.data;
      const created = await db.transaction(async (tx: any) => {
        const row = await createFlashTaskTemplate({
          ...input,
          code: input.code.toUpperCase(),
          feedbackPrompts: normalizeFeedbackPrompts(input.feedbackPrompts),
          contentVersion: 1,
          reviewStatus: isHumanReviewed ? "active" : "pending_review",
          isHumanReviewed,
          reviewedBy: isHumanReviewed ? actor : null,
          reviewedAt: isHumanReviewed ? new Date() : null,
          isActive: false,
        } as any, tx);
        const npcs = await listFlashNpcs(tx);
        const selected = npcs.filter((npc: any) => npcIds.includes(npc.id));
        await replaceFlashNpcTaskLinks(row.id, selected.map((npc: any) => ({
          npcId: npc.id,
          requestCopy: taskLinkCopy(npc.slug, input.dialogueIntro),
          deliveryCopy: FLASH_DELIVERY_COPY_BY_NPC[npc.slug] ?? "我收到了，谢谢你替我去看。",
        })), tx);
        await replaceFlashTaskDestinationLinks(row.id, destinationIds, tx);
        return row;
      });
      audit(req, "FLASH_TASK_TEMPLATE_CREATED", "flash_task_template", created.id, undefined, safeTaskAudit(created), {
        npcCount: npcIds.length,
        destinationCount: destinationIds.length,
      });
      res.status(201).json({ ...created, npcIds, destinationIds });
    } catch (error) {
      routeFailure(req, res, "task template create failed", error);
    }
  });

  app.patch("/api/admin/alang/task-templates/:id", requireAdmin, requireOperatorOrAbove, retiredFlashTaskAdmin, async (req, res) => {
    const parsed = taskTemplatePatchSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      const current = (await enrichedTaskTemplates()).find((task: any) => task.id === req.params.id);
      if (!current) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到任务模板");
      const contentChanged = hasFlashTaskContentChange(current, parsed.data as Record<string, unknown>);
      const { expectedContentVersion, npcIds, destinationIds, isHumanReviewed, isActive, ...input } = parsed.data;
      if (contentChanged && isHumanReviewed) {
        throw new Error("FLASH_ADMIN_CONFLICT:请先保存内容修改，再重新打开并核对各 NPC 的最终话术后审核");
      }
      const reviewed = isHumanReviewed ?? (contentChanged ? false : current.isHumanReviewed);
      const updated = await db.transaction(async (tx: any) => {
        const desiredActive = contentChanged && !reviewed ? false : isActive;
        const row = await updateFlashTaskTemplate(req.params.id, expectedContentVersion, {
          ...input,
          ...(input.code ? { code: input.code.toUpperCase() } : {}),
          ...(input.feedbackPrompts ? { feedbackPrompts: normalizeFeedbackPrompts(input.feedbackPrompts) } : {}),
          ...(contentChanged ? { contentVersion: expectedContentVersion + 1 } : {}),
          ...(isHumanReviewed !== undefined || contentChanged ? {
            isHumanReviewed: reviewed,
            reviewStatus: reviewed ? "active" : "pending_review",
            reviewedBy: reviewed ? actor : null,
            reviewedAt: reviewed ? new Date() : null,
          } : {}),
          ...(desiredActive !== undefined ? { isActive: desiredActive } : {}),
        } as any, tx);
        if (!row) throw new Error("FLASH_ADMIN_CONFLICT:任务内容已被其他人修改，请刷新后重新审核");
        const npcs = await listFlashNpcs(tx);
        const effectiveNpcIds = npcIds ?? current.npcIds;
        if (npcIds) {
          const selected = npcs.filter((npc: any) => effectiveNpcIds.includes(npc.id));
          await replaceFlashNpcTaskLinks(row.id, selected.map((npc: any) => ({
            npcId: npc.id,
            requestCopy: taskLinkCopy(npc.slug, input.dialogueIntro ?? row.dialogueIntro),
            deliveryCopy: FLASH_DELIVERY_COPY_BY_NPC[npc.slug] ?? "我收到了，谢谢你替我去看。",
          })), tx);
        } else if (contentChanged && input.dialogueIntro) {
          const selected = npcs.filter((npc: any) => effectiveNpcIds.includes(npc.id));
          await replaceFlashNpcTaskLinks(row.id, selected.map((npc: any) => ({
            npcId: npc.id,
            requestCopy: taskLinkCopy(npc.slug, input.dialogueIntro!),
            deliveryCopy: FLASH_DELIVERY_COPY_BY_NPC[npc.slug] ?? "我收到了，谢谢你替我去看。",
          })), tx);
        }
        if (destinationIds) await replaceFlashTaskDestinationLinks(row.id, destinationIds, tx);
        if ((desiredActive ?? current.isActive) === true) await assertTaskCanActivate(row.id, tx);
        const withdrawnOfferCount = await withdrawOfferedFlashEncountersForTaskTemplate(row.id, new Date(), tx);
        return { row, withdrawnOfferCount };
      });
      const final = (await enrichedTaskTemplates()).find((task: any) => task.id === req.params.id);
      audit(req, "FLASH_TASK_TEMPLATE_UPDATED", "flash_task_template", req.params.id, safeTaskAudit(current), safeTaskAudit(final), {
        npcCount: final?.npcIds.length ?? 0,
        destinationCount: final?.destinationIds.length ?? 0,
        withdrawnOffers: updated.withdrawnOfferCount,
      });
      res.json(final);
    } catch (error) {
      routeFailure(req, res, "task template update failed", error);
    }
  });

  app.get("/api/admin/alang/schedules", requireAdmin, async (req, res) => {
    const parsed = serviceDateSchema.safeParse(req.query.date);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      res.json(await enrichSchedule(await getFlashSchedulePlanByDate(parsed.data)));
    } catch (error) {
      routeFailure(req, res, "schedule read failed", error);
    }
  });

  app.post("/api/admin/alang/schedules/generate", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = z.object({ date: serviceDateSchema }).strict().safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const today = shenzhenDateString(new Date());
      if (parsed.data.date !== addServiceDays(today, 1)) {
        throw new Error("FLASH_ADMIN_INVALID:只能生成深圳次日草案");
      }
      const generated = await generateOrReplaceFlashScheduleDraftForAdmin(
        parsed.data.date,
        getActingAdminId(req),
      );
      if (!generated.ok) {
        const status = generated.code === "FLASH_SCHEDULE_PUBLISHED" || generated.code === "FLASH_SCHEDULE_CAS_CONFLICT" ? 409 : 422;
        res.status(status).json({
          code: generated.code,
          message: generated.code === "FLASH_SCHEDULE_INVALID"
            ? "没有生成可安全发布的次日班次，请检查 NPC 地点关联与可用时间"
            : "草案状态已经变化，请刷新后再试",
          errors: "validation" in generated ? generated.validation?.errors : undefined,
        });
        return;
      }
      const result = { plan: generated.plan, shifts: generated.shifts };
      audit(req, "FLASH_SCHEDULE_DRAFT_GENERATED", "flash_schedule", generated.plan?.id, undefined, {
        serviceDate: parsed.data.date,
        shiftCount: generated.shifts?.length ?? 0,
      }, { skippedNpcCount: generated.skippedNpcIds?.length ?? 0 });
      res.json(await enrichSchedule(result));
    } catch (error) {
      routeFailure(req, res, "schedule generate failed", error);
    }
  });

  app.post("/api/admin/alang/schedules/:id/regeneration-preview", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = scheduleRegenerationPreviewSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const preview = await previewPublishedFlashScheduleRegenerationForAdmin(
        req.params.id,
        parsed.data.expectedVersion,
      );
      if (!preview.ok) {
        const status = preview.code === "FLASH_SCHEDULE_NOT_FOUND"
          ? 404
          : preview.code === "FLASH_SCHEDULE_INVALID"
            ? 422
            : 409;
        return void res.status(status).json({
          code: preview.code,
          message: preview.code === "FLASH_SCHEDULE_INVALID"
            ? "没有生成可安全发布的新排班，请检查 NPC 和地点配置"
            : "这份排班当前不能重新生成，请刷新后再试",
          errors: "validation" in preview ? preview.validation?.errors : undefined,
        });
      }
      const enriched = await enrichSchedule({ plan: preview.plan, shifts: preview.shifts });
      res.json({
        ...enriched,
        generationSeed: preview.generationSeed,
        previewDigest: preview.previewDigest,
      });
    } catch (error) {
      routeFailure(req, res, "schedule regeneration preview failed", error);
    }
  });

  app.post("/api/admin/alang/schedules/:id/regenerate", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = scheduleRegenerationReplaceSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const before = await getFlashSchedulePlanById(req.params.id);
      if (!before) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到排班");
      const replaced = await replacePublishedFlashScheduleForAdmin({
        planId: req.params.id,
        expectedVersion: parsed.data.expectedVersion,
        actor: getActingAdminId(req),
        generationSeed: parsed.data.generationSeed,
        previewDigest: parsed.data.previewDigest,
      });
      if (!replaced.ok) {
        const status = replaced.code === "FLASH_SCHEDULE_NOT_FOUND"
          ? 404
          : replaced.code === "FLASH_SCHEDULE_INVALID"
            ? 422
            : 409;
        return void res.status(status).json({
          code: replaced.code,
          message: replaced.code === "FLASH_SCHEDULE_INVALID"
            ? "新排班没有通过安全校验"
            : "排班状态已经变化，请刷新后重新生成",
          errors: "validation" in replaced ? replaced.validation?.errors : undefined,
        });
      }
      audit(req, "FLASH_SCHEDULE_REGENERATED", "flash_schedule", replaced.plan.id, {
        version: before.plan.version,
        shiftCount: before.shifts.filter((shift: any) => shift.status === "published").length,
      }, {
        version: replaced.plan.version,
        shiftCount: replaced.shifts.length,
      }, {
        reason: parsed.data.reason,
        serviceDate: replaced.plan.serviceDate,
      });
      res.json(await enrichSchedule({ plan: replaced.plan, shifts: replaced.shifts }));
    } catch (error) {
      routeFailure(req, res, "schedule regeneration replace failed", error);
    }
  });

  app.put("/api/admin/alang/schedules/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = scheduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const existing = await getFlashSchedulePlanById(req.params.id);
      if (!existing) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到排班草案");
      if (existing.plan.status !== "draft") throw new Error("FLASH_ADMIN_CONFLICT:已发布排班不能编辑");
      const shifts = parseDraftShifts(parsed.data.shifts);
      const updated = await validateAndReplaceFlashScheduleDraftForAdmin({
        planId: existing.plan.id,
        expectedVersion: parsed.data.expectedVersion,
        actor: getActingAdminId(req),
        shifts,
      });
      if (!updated.ok) {
        const status = updated.code === "FLASH_SCHEDULE_INVALID" ? 422 : updated.code === "FLASH_SCHEDULE_NOT_FOUND" ? 404 : 409;
        res.status(status).json({
          code: updated.code,
          message: updated.code === "FLASH_SCHEDULE_INVALID" ? "排班没有通过安全校验" : "草案已被其他人修改，请刷新",
          errors: "validation" in updated ? updated.validation?.errors : undefined,
        });
        return;
      }
      audit(req, "FLASH_SCHEDULE_DRAFT_UPDATED", "flash_schedule", existing.plan.id, {
        version: existing.plan.version,
        shiftCount: existing.shifts.length,
      }, {
        version: updated.plan.version,
        shiftCount: shifts.length,
      });
      res.json(await enrichSchedule({ plan: updated.plan, shifts: updated.shifts }));
    } catch (error) {
      routeFailure(req, res, "schedule update failed", error);
    }
  });

  app.patch("/api/admin/alang/schedules/:id/shifts/:shiftId", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = upcomingShiftUpdateSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const before = await getFlashSchedulePlanById(req.params.id);
      const shiftBefore = before?.shifts.find((shift: any) => shift.id === req.params.shiftId);
      const updated = await updateUpcomingFlashShiftForAdmin({
        planId: req.params.id,
        shiftId: req.params.shiftId,
        expectedVersion: parsed.data.expectedVersion,
        actor: getActingAdminId(req),
        cancel: parsed.data.action === "cancel",
        shift: parsed.data.action === "update" ? {
          npcId: parsed.data.shift.npcId,
          locationId: parsed.data.shift.locationId,
          startsAt: new Date(parsed.data.shift.startsAt),
          endsAt: new Date(parsed.data.shift.endsAt),
          source: parsed.data.shift.source,
        } : undefined,
      });
      if (!updated.ok) {
        const status = updated.code === "FLASH_SCHEDULE_NOT_FOUND" ? 404 : updated.code === "FLASH_SCHEDULE_INVALID" ? 422 : 409;
        return void res.status(status).json({
          code: updated.code,
          message: updated.code === "FLASH_SHIFT_ALREADY_STARTED"
            ? "班次已经开始或已结束，不能再调整"
            : updated.code === "FLASH_SCHEDULE_INVALID"
              ? "调整后的班次没有通过安全校验"
              : "排班状态已经变化，请刷新后重试",
          errors: "validation" in updated ? updated.validation?.errors : undefined,
        });
      }
      const shiftAfter = updated.shifts.find((shift: any) => shift.id === req.params.shiftId);
      audit(
        req,
        parsed.data.action === "cancel" ? "FLASH_UPCOMING_SHIFT_CANCELLED" : "FLASH_UPCOMING_SHIFT_UPDATED",
        "flash_shift",
        req.params.shiftId,
        shiftBefore ? { npcId: shiftBefore.npcId, locationId: shiftBefore.locationId, startsAt: shiftBefore.startsAt, endsAt: shiftBefore.endsAt, status: shiftBefore.status } : undefined,
        shiftAfter ? { npcId: shiftAfter.npcId, locationId: shiftAfter.locationId, startsAt: shiftAfter.startsAt, endsAt: shiftAfter.endsAt, status: shiftAfter.status } : undefined,
        { serviceDate: updated.plan.serviceDate },
      );
      res.json(await enrichSchedule({ plan: updated.plan, shifts: updated.shifts }));
    } catch (error) {
      routeFailure(req, res, "upcoming shift update failed", error);
    }
  });

  app.post("/api/admin/alang/schedules/:id/publish", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = schedulePublishSchema.safeParse(req.body ?? {});
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const actor = getActingAdminId(req);
      const published = await db.transaction(async (tx: any) => {
        const existing = await getFlashSchedulePlanById(req.params.id, tx);
        if (!existing) throw new Error("FLASH_ADMIN_NOT_FOUND:没有找到排班草案");
        if (existing.plan.status !== "draft") throw new Error("FLASH_ADMIN_CONFLICT:这份排班已经发布或失效");
        if (existing.shifts.length === 0) throw new Error("FLASH_ADMIN_CONFLICT:空草案不能发布");
        const context = await scheduleValidationContext(tx);
        const validation = validateFlashScheduleDraft({
          serviceDate: existing.plan.serviceDate,
          shifts: existing.shifts.map((shift: any) => ({
            npcId: shift.npcId,
            locationId: shift.locationId,
            startsAt: shift.startsAt,
            endsAt: shift.endsAt,
            source: shift.source,
          })),
          npcsById: context.npcsById,
          locationsByNpc: context.locationsByNpc,
        });
        if (!validation.valid) {
          throw new Error(`FLASH_ADMIN_INVALID:${validation.errors.join(",")}`);
        }
        const result = await publishFlashSchedulePlan({
          planId: existing.plan.id,
          expectedVersion: parsed.data.expectedVersion,
          now: new Date(),
          actor,
        }, tx);
        if (!result) throw new Error("FLASH_ADMIN_CONFLICT:草案已被其他人修改，请刷新");
        return result;
      });
      const result = await getFlashSchedulePlanById(published.id);
      audit(req, "FLASH_SCHEDULE_PUBLISHED", "flash_schedule", published.id, undefined, {
        serviceDate: published.serviceDate,
        version: published.version,
      });
      res.json(await enrichSchedule(result));
    } catch (error) {
      routeFailure(req, res, "schedule publish failed", error);
    }
  });

  app.get("/api/admin/alang/story", requireAdmin, async (_req, res) => {
    try {
      res.json(await listFlashStoryAdmin());
    } catch (error) {
      routeFailure(_req, res, "story list failed", error);
    }
  });

  app.patch("/api/admin/alang/story/episodes/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = storyEpisodePatchSchema.safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    const { expectedVersion, fragment, ...values } = parsed.data;
    try {
      const before = (await listFlashStoryAdmin()).episodes.find((item: any) => item.episode.id === req.params.id)?.episode;
      const updated = await updateFlashStoryEpisode(req.params.id, expectedVersion, values, fragment);
      if (!updated) return void res.status(409).json({ code: "FLASH_STORY_VERSION_CONFLICT", error: "内容已被其他人修改，请刷新后再试" });
      audit(req, "FLASH_STORY_EPISODE_UPDATED", "flash_story_episode", updated.id, before, updated);
      res.json(updated);
    } catch (error) {
      routeFailure(req, res, "story episode update failed", error);
    }
  });

  app.post("/api/admin/alang/story/episodes/:id/review", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const parsed = z.object({ expectedVersion: z.number().int().positive() }).strict().safeParse(req.body);
    if (!parsed.success) return void validationFailure(res, parsed.error);
    try {
      const updated = await reviewFlashStoryEpisode(req.params.id, parsed.data.expectedVersion);
      if (!updated) return void res.status(409).json({ code: "FLASH_STORY_VERSION_CONFLICT", error: "内容版本已变化，请刷新后重新审核" });
      audit(req, "FLASH_STORY_EPISODE_REVIEWED", "flash_story_episode", updated.id, undefined, { contentVersion: updated.contentVersion });
      res.json(updated);
    } catch (error) {
      routeFailure(req, res, "story episode review failed", error);
    }
  });

  app.post("/api/admin/alang/story/seasons/:id/publish", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const published = await publishFlashStorySeason(req.params.id, getActingAdminId(req));
      if (!published) return void res.status(409).json({ code: "FLASH_STORY_INCOMPLETE", error: "必须正好有 15 个启用且已审核的故事单元才能发布" });
      audit(req, "FLASH_STORY_SEASON_PUBLISHED", "flash_story_season", published.id, undefined, { version: published.version });
      res.json(published);
    } catch (error) {
      routeFailure(req, res, "story season publish failed", error);
    }
  });
}
