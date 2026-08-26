import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  FLASH_CITY,
  FLASH_SHENZHEN_BOUNDS,
  flashAcceptRequestSchema,
  flashAnswerRequestSchema,
  flashCoordinateSchema,
  flashFeedbackRequestSchema,
  flashPreferenceUpdateSchema,
  flashStoryAdvanceRequestSchema,
} from "@shared/alang/flashTypes";

import { getFeatureFlag } from "../../lib/featureFlags";
import { isSingleTestMode } from "../../lib/isSingleTestMode";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { requireAuth } from "../../middleware/auth";
import { flashLocateEndpointLimiter, geoEndpointLimiter } from "../../rateLimiter";
import {
  abandonFlashTask,
  answerFlashEncounter,
  advanceFlashV2Story,
  arriveAtFlashAssignment,
  assertFlashRuntimeReady,
  deliverFlashTaskToNpc,
  feedbackFlashAssignment,
  FlashServiceError,
  getFlashAssignment,
  getFlashEncounter,
  getFlashHome,
  getFlashPreferenceSettings,
  getFlashStoryArchive,
  getFlashStoryFragments,
  locateFlashAppearance,
  patchFlashPreferenceSettings,
  removeFlashPreferenceTag,
  rerollFlashEncounterOffer,
  respondToFlashOffer,
  retryFlashTask,
  submitFlashStoryInteraction,
} from "../../services/flashService";
import { startFlashBackgroundJobs } from "../../services/flashScheduleService";
import { reverseGeocodeCoordinate } from "./geo";

const idParamSchema = z.string().uuid();
const flashTestCoordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  coordinateSystem: z.literal("gcj02"),
});
const deliveryRequestSchema = z.object({
  assignmentId: z.string().uuid(),
  answers: z.array(z.object({
    promptId: z.string().min(1),
    optionId: z.string().min(1),
  }).strict()).max(2).optional(),
}).strict();
/** 叙事动作层结果提交（AC-02）：只接受节点与结果枚举 id，不接收手势轨迹或文本。 */
const flashStoryInteractionRequestSchema = z.object({
  nodeId: z.string().trim().min(1).max(80),
  resultId: z.string().trim().min(1).max(80),
}).strict();

const SHENZHEN_DISTRICTS = new Set([
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
]);

function sendFlashError(res: Response, error: unknown): Response {
  if (error instanceof FlashServiceError) {
    return res.status(error.status).json({ code: error.code, error: error.message });
  }
  return res.status(500).json({ code: "FLASH_INTERNAL_ERROR", error: "街头盲盒暂时走神了，请稍后再试" });
}

function logSafeRouteFailure(req: Request, resourceId: string | null, error: unknown): void {
  logger.warn("[Flash] request failed", {
    request_id: req.requestId,
    resourceId,
    code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR",
  });
}

async function requireFlashReady(_req: Request, res: Response, next: NextFunction) {
  try {
    await assertFlashRuntimeReady();
    return next();
  } catch (error) {
    logger.warn("[Flash] route failure", { request_id: _req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
    return sendFlashError(res, error);
  }
}

function sendFlashDisabled(res: Response): Response {
  return res.status(503).json({ code: "FLASH_DISABLED", error: "街头盲盒暂时休息中" });
}

async function requireFlashEnabled(_req: Request, res: Response, next: NextFunction) {
  try {
    return (await getFeatureFlag("alangEnabled", false)) ? next() : sendFlashDisabled(res);
  } catch (error) {
    logger.warn("[Flash] route failure", { request_id: _req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
    return sendFlashError(res, error);
  }
}

function userId(req: Request, res: Response): string | null {
  return requireAuthenticatedUserId(req, res);
}

async function parseEncounterCoordinate(body: unknown, enforceShenzhenBoundary = true, resolveDistrict = false): Promise<
  | { success: true; data: { latitude: number; longitude: number; coordinateSystem: "gcj02" } }
  | { success: false; code: "FLASH_LOCATION_REQUIRED" | "FLASH_OUTSIDE_SHENZHEN" | "FLASH_LOCATION_UNAVAILABLE" }
> {
  if (!body || typeof body !== "object") return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  const value = body as Record<string, unknown>;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number") {
    return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  }
  if (
    enforceShenzhenBoundary
    && (
      value.latitude < FLASH_SHENZHEN_BOUNDS.minLatitude
      || value.latitude > FLASH_SHENZHEN_BOUNDS.maxLatitude
      || value.longitude < FLASH_SHENZHEN_BOUNDS.minLongitude
      || value.longitude > FLASH_SHENZHEN_BOUNDS.maxLongitude
    )
  ) {
    return { success: false, code: "FLASH_OUTSIDE_SHENZHEN" };
  }

  const parsed = (enforceShenzhenBoundary ? flashCoordinateSchema : flashTestCoordinateSchema).safeParse(value);
  if (!parsed.success) return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  if (!enforceShenzhenBoundary && !resolveDistrict) {
    return { success: true, data: parsed.data };
  }

  // Flash coordinates are one-shot: bypass the generic geocoder cache so the
  // raw user position is discarded when this request completes.
  const resolved = await reverseGeocodeCoordinate(parsed.data, { cache: false });
  if (resolved.source !== "tencent") {
    return { success: true, data: parsed.data };
  }
  const city = resolved.city?.replace(/市$/, "");
  const district = city === FLASH_CITY && resolved.district && SHENZHEN_DISTRICTS.has(resolved.district)
    ? resolved.district
    : "";
  if (enforceShenzhenBoundary && !district) {
    return { success: false, code: "FLASH_OUTSIDE_SHENZHEN" };
  }
  return { success: true, data: parsed.data };
}

async function shouldEnforceShenzhenBoundary(): Promise<boolean> {
  if ((process.env.APP_MODE ?? "production") === "production") return true;
  return getFeatureFlag("flashShenzhenLocationGateEnabled", true);
}

async function isAnyLocationArrivalTestEnabled(): Promise<boolean> {
  if ((process.env.APP_MODE ?? "production") === "production") return false;
  return getFeatureFlag("flashAnyLocationArrivalTestEnabled", false);
}

function isStoryReplayRequest(req: Request): boolean {
  return (process.env.APP_MODE ?? "production") !== "production"
    && req.query.replay === "1"
    && isSingleTestMode();
}

function sendCoordinateError(
  res: Response,
  code: "FLASH_LOCATION_REQUIRED" | "FLASH_OUTSIDE_SHENZHEN" | "FLASH_LOCATION_UNAVAILABLE",
) {
  if (code === "FLASH_LOCATION_UNAVAILABLE") {
    return res.status(503).json({
      code,
      error: "地图服务暂时无法校验位置，请稍后再试",
    });
  }
  return res.status(code === "FLASH_OUTSIDE_SHENZHEN" ? 403 : 400).json({
    code,
    error: code === "FLASH_OUTSIDE_SHENZHEN" ? "街头盲盒目前只在深圳开放" : "需要定位权限才能参加街头盲盒",
  });
}

function retiredFlashTaskFlow(_req: Request, res: Response) {
  return res.status(410).json({
    code: "FLASH_TASK_FLOW_RETIRED",
    error: "旧任务链已经结束，请从在线角色进入当前故事",
  });
}

export function registerAlangFlashRoutes(app: Express): void {
  if (process.env.NODE_ENV !== "test") startFlashBackgroundJobs();

  const guards = [requireAuth, requireFlashReady] as const;
  const preferenceGuards = [requireAuth, requireFlashEnabled] as const;

  // Coordinates stay in a JSON body so reverse proxies never place them in URL logs.
  // The home list is deliberately location-free. GPS starts only after the
  // user selects an NPC and explicitly opens the foreground map.
  app.post("/api/alang/flash/home", ...guards, geoEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashHome({ userId: authenticatedUserId }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/appearances/:id/locate", ...guards, flashLocateEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const appearanceId = idParamSchema.safeParse(req.params.id);
    if (!appearanceId.success) return res.status(400).json({ code: "FLASH_APPEARANCE_NOT_FOUND", error: "无效的相遇编号" });
    const forceArrivalForTesting = await isAnyLocationArrivalTestEnabled();
    const coordinate = await parseEncounterCoordinate(
      req.body,
      forceArrivalForTesting ? false : await shouldEnforceShenzhenBoundary(),
      true,
    );
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await locateFlashAppearance({
        userId: authenticatedUserId,
        appearanceId: appearanceId.data,
        forceArrivalForTesting,
        ...coordinate.data,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      // Never log the request body or raw coordinate.
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/encounters/:id", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    try {
      return res.json(await getFlashEncounter({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        allowSameEncounterDeliveryForTesting: await isAnyLocationArrivalTestEnabled(),
        allowStoryReplay: isStoryReplayRequest(req),
        requestId: req.requestId,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/story/fragments", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashStoryFragments(authenticatedUserId));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  // 谜案档案台 MVP（AC-05）：已解锁碎片 + 派生印记 + 未解线索。DTO 由服务端
  // 批量装配，不含坐标/距离/排班/路线/私人回复（SEC-02）。
  app.get("/api/alang/flash/story/archive", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashStoryArchive(authenticatedUserId));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/story-advance", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    const body = flashStoryAdvanceRequestSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ code: "FLASH_V2_NOT_AVAILABLE", error: "无效的故事重玩状态" });
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    try {
      return res.json(await advanceFlashV2Story({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        ...body.data,
        allowStoryReplay: isStoryReplayRequest(req),
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/answer", ...guards, async (req, res) => {    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    const body = flashAnswerRequestSchema.safeParse(req.body);
    if (!encounterId.success || !body.success) {
      return res.status(400).json({ code: "FLASH_INVALID_DIALOGUE_OPTION", error: "这个回答已经失效" });
    }
    try {
      return res.json(await answerFlashEncounter({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        ...body.data,
        allowStoryReplay: isStoryReplayRequest(req),
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  // 叙事动作层：interaction 节点结果提交（AC-02）。开关关闭时服务端透明降级
  // 为审核过的默认结果（AC-07），无效节点/结果返回稳定 4xx 且不推进状态。
  app.post("/api/alang/flash/encounters/:id/story-interaction", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    const body = flashStoryInteractionRequestSchema.safeParse(req.body);
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    if (!body.success) {
      return res.status(400).json({ code: "FLASH_V2_UNKNOWN_RESULT", error: "这个操作结果已经失效，请刷新后再试" });
    }
    try {
      return res.json(await submitFlashStoryInteraction({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        ...body.data,
        requestId: req.requestId,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/reroll", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    try {
      return res.json(await rerollFlashEncounterOffer({ encounterId: encounterId.data, userId: authenticatedUserId }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/accept", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    const body = flashAcceptRequestSchema.safeParse(req.body ?? {});
    if (!encounterId.success || !body.success) {
      return res.status(400).json({ code: "FLASH_INVALID_TASK_STATE", error: "无法处理这个委托" });
    }
    try {
      return res.json(await respondToFlashOffer({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        accepted: body.data.accepted,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/deliver", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    const body = deliveryRequestSchema.safeParse(req.body);
    if (!encounterId.success || !body.success) {
      return res.status(400).json({ code: "FLASH_INVALID_TASK_STATE", error: "无法交付这个委托" });
    }
    try {
      return res.json(await deliverFlashTaskToNpc({
        encounterId: encounterId.data,
        assignmentId: body.data.assignmentId,
        userId: authenticatedUserId,
        answers: body.data.answers,
        allowSameEncounterDeliveryForTesting: await isAnyLocationArrivalTestEnabled(),
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/assignments/:id", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    try {
      return res.json(await getFlashAssignment({ assignmentId: assignmentId.data, userId: authenticatedUserId }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/arrive", ...guards, retiredFlashTaskFlow, geoEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    const forceArrivalForTesting = await isAnyLocationArrivalTestEnabled();
    const coordinate = await parseEncounterCoordinate(
      req.body,
      forceArrivalForTesting ? false : await shouldEnforceShenzhenBoundary(),
      false,
    );
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await arriveAtFlashAssignment({
        assignmentId: assignmentId.data,
        userId: authenticatedUserId,
        forceArrivalForTesting,
        ...coordinate.data,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      // Never log the request body or raw coordinate.
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/feedback", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    const body = flashFeedbackRequestSchema.safeParse(req.body);
    if (!assignmentId.success || !body.success) {
      return res.status(400).json({ code: "FLASH_INVALID_TASK_STATE", error: "请选择有效的到达感受" });
    }
    try {
      return res.json(await feedbackFlashAssignment({
        assignmentId: assignmentId.data,
        userId: authenticatedUserId,
        ...body.data,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/abandon", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    try {
      return res.json(await abandonFlashTask({ assignmentId: assignmentId.data, userId: authenticatedUserId }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/retry", ...guards, retiredFlashTaskFlow, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) {
      return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个任务" });
    }
    const enabled = (process.env.APP_MODE ?? "production") !== "production"
      && await getFeatureFlag("flashTaskRetryTestEnabled", false);
    if (!enabled) {
      return res.status(403).json({
        code: "FLASH_TASK_RETRY_DISABLED",
        error: "任务复测模式未开启",
      });
    }
    try {
      return res.json(await retryFlashTask({
        assignmentId: assignmentId.data,
        userId: authenticatedUserId,
      }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/preferences", ...preferenceGuards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashPreferenceSettings(authenticatedUserId));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.put("/api/alang/flash/preferences", ...preferenceGuards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const body = flashPreferenceUpdateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ code: "FLASH_INVALID_TASK_STATE", error: "偏好设置格式不正确" });
    try {
      return res.json(await patchFlashPreferenceSettings({ userId: authenticatedUserId, update: body.data }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });

  app.delete("/api/alang/flash/preferences/tags/:id", ...preferenceGuards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const tagId = idParamSchema.safeParse(req.params.id);
    if (!tagId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个标签" });
    try {
      return res.json(await removeFlashPreferenceTag({ userId: authenticatedUserId, tagId: tagId.data }));
    } catch (error) {
      logger.warn("[Flash] route failure", { request_id: req.requestId, code: error instanceof FlashServiceError ? error.code : "FLASH_INTERNAL_ERROR" });
      return sendFlashError(res, error);
    }
  });
}
