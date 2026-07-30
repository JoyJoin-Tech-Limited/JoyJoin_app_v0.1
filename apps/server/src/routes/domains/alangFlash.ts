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
} from "@shared/alang/flashTypes";

import { getFeatureFlag } from "../../lib/featureFlags";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { requireAuth } from "../../middleware/auth";
import { flashLocateEndpointLimiter, geoEndpointLimiter } from "../../rateLimiter";
import {
  abandonFlashTask,
  answerFlashEncounter,
  arriveAtFlashAssignment,
  assertFlashRuntimeReady,
  deliverFlashTaskToNpc,
  feedbackFlashAssignment,
  FlashServiceError,
  getFlashAssignment,
  getFlashEncounter,
  getFlashHome,
  getFlashPreferenceSettings,
  locateFlashAppearance,
  patchFlashPreferenceSettings,
  removeFlashPreferenceTag,
  rerollFlashEncounterOffer,
  respondToFlashOffer,
  retryFlashTask,
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
    promptId: z.string().min(1).max(80),
    optionId: z.string().min(1).max(80),
  }).strict()).max(2).optional(),
}).strict();
const SHENZHEN_DISTRICTS = new Set([
  "南山区", "福田区", "罗湖区", "宝安区", "龙岗区",
  "盐田区", "龙华区", "坪山区", "光明区", "大鹏新区",
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
    if (!(await getFeatureFlag("alangEnabled", false))) {
      return res.status(503).json({ code: "FLASH_DISABLED", error: "街头盲盒暂时休息中" });
    }
    await assertFlashRuntimeReady();
    return next();
  } catch (error) {
    return sendFlashError(res, error);
  }
}

function userId(req: Request, res: Response): string | null {
  return requireAuthenticatedUserId(req, res);
}

async function parseShenzhenCoordinate(body: unknown, enforceShenzhenBoundary = true): Promise<
  | { success: true; data: { latitude: number; longitude: number; coordinateSystem: "gcj02"; district: string } }
  | { success: false; code: "FLASH_LOCATION_REQUIRED" | "FLASH_OUTSIDE_SHENZHEN" | "FLASH_LOCATION_UNAVAILABLE" }
> {
  if (!body || typeof body !== "object") return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  const value = body as Record<string, unknown>;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number") {
    return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  }
  if (!enforceShenzhenBoundary) {
    const parsed = flashTestCoordinateSchema.safeParse(value);
    return parsed.success
      ? { success: true, data: { ...parsed.data, district: "" } }
      : { success: false, code: "FLASH_LOCATION_REQUIRED" };
  }
  if (
    value.latitude < FLASH_SHENZHEN_BOUNDS.minLatitude
    || value.latitude > FLASH_SHENZHEN_BOUNDS.maxLatitude
    || value.longitude < FLASH_SHENZHEN_BOUNDS.minLongitude
    || value.longitude > FLASH_SHENZHEN_BOUNDS.maxLongitude
  ) {
    return { success: false, code: "FLASH_OUTSIDE_SHENZHEN" };
  }
  const parsed = flashCoordinateSchema.safeParse(value);
  if (!parsed.success) return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  // Flash coordinates are one-shot: bypass the generic geocoder cache so the
  // raw user position is discarded when this request completes.
  const resolved = await reverseGeocodeCoordinate(parsed.data, { cache: false });
  if (resolved.source !== "tencent") {
    return { success: false, code: "FLASH_LOCATION_UNAVAILABLE" };
  }
  if (resolved.city !== FLASH_CITY || !resolved.district || !SHENZHEN_DISTRICTS.has(resolved.district)) {
    return { success: false, code: "FLASH_OUTSIDE_SHENZHEN" };
  }
  return { success: true, data: { ...parsed.data, district: resolved.district } };
}

async function shouldEnforceShenzhenBoundary(): Promise<boolean> {
  if ((process.env.APP_MODE ?? "production") === "production") return true;
  return getFeatureFlag("flashShenzhenLocationGateEnabled", true);
}

function sendCoordinateError(res: Response, code: "FLASH_LOCATION_REQUIRED" | "FLASH_OUTSIDE_SHENZHEN" | "FLASH_LOCATION_UNAVAILABLE") {
  const status = code === "FLASH_OUTSIDE_SHENZHEN" ? 403 : code === "FLASH_LOCATION_UNAVAILABLE" ? 503 : 400;
  return res.status(status).json({
    code,
    error: code === "FLASH_OUTSIDE_SHENZHEN"
      ? "街头盲盒目前只在深圳开放"
      : code === "FLASH_LOCATION_UNAVAILABLE"
        ? "暂时无法确认你是否在深圳，请稍后再试"
        : "需要定位权限才能参加街头盲盒",
  });
}

export function registerAlangFlashRoutes(app: Express): void {
  if (process.env.NODE_ENV !== "test") startFlashBackgroundJobs();

  const guards = [requireAuth, requireFlashReady] as const;

  // Coordinates stay in a JSON body so reverse proxies never place them in URL logs.
  app.post("/api/alang/flash/home", ...guards, geoEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const coordinate = await parseShenzhenCoordinate(req.body, await shouldEnforceShenzhenBoundary());
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await getFlashHome({
        userId: authenticatedUserId,
      }));
    } catch (error) {
      logSafeRouteFailure(req, null, error);
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/appearances/:id/locate", ...guards, flashLocateEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const appearanceId = idParamSchema.safeParse(req.params.id);
    if (!appearanceId.success) return res.status(400).json({ code: "FLASH_APPEARANCE_NOT_FOUND", error: "无效的街头盲盒编号" });
    const coordinate = await parseShenzhenCoordinate(req.body, await shouldEnforceShenzhenBoundary());
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await locateFlashAppearance({
        userId: authenticatedUserId,
        appearanceId: appearanceId.data,
        latitude: coordinate.data.latitude,
        longitude: coordinate.data.longitude,
        contextDistrict: coordinate.data.district,
      }));
    } catch (error) {
      // Never log the request body or raw coordinate.
      logSafeRouteFailure(req, appearanceId.data, error);
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/encounters/:id", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    try {
      return res.json(await getFlashEncounter({ encounterId: encounterId.data, userId: authenticatedUserId }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/answer", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
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
      }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/reroll", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const encounterId = idParamSchema.safeParse(req.params.id);
    if (!encounterId.success) return res.status(404).json({ code: "FLASH_ENCOUNTER_NOT_FOUND", error: "没有找到这次相遇" });
    try {
      return res.json(await rerollFlashEncounterOffer({ encounterId: encounterId.data, userId: authenticatedUserId }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/accept", ...guards, async (req, res) => {
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
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/encounters/:id/deliver", ...guards, async (req, res) => {
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
      }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/assignments/:id", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    try {
      return res.json(await getFlashAssignment({ assignmentId: assignmentId.data, userId: authenticatedUserId }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/arrive", ...guards, geoEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    const coordinate = await parseShenzhenCoordinate(req.body, await shouldEnforceShenzhenBoundary());
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await arriveAtFlashAssignment({
        assignmentId: assignmentId.data,
        userId: authenticatedUserId,
        latitude: coordinate.data.latitude,
        longitude: coordinate.data.longitude,
      }));
    } catch (error) {
      // Never log the request body or raw coordinate.
      logSafeRouteFailure(req, assignmentId.data, error);
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/feedback", ...guards, async (req, res) => {
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
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/abandon", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    try {
      return res.json(await abandonFlashTask({ assignmentId: assignmentId.data, userId: authenticatedUserId }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/retry", ...guards, async (req, res) => {
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
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/preferences", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashPreferenceSettings(authenticatedUserId));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.put("/api/alang/flash/preferences", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const body = flashPreferenceUpdateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ code: "FLASH_INVALID_TASK_STATE", error: "偏好设置格式不正确" });
    try {
      return res.json(await patchFlashPreferenceSettings({ userId: authenticatedUserId, update: body.data }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.delete("/api/alang/flash/preferences/tags/:id", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const tagId = idParamSchema.safeParse(req.params.id);
    if (!tagId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个标签" });
    try {
      return res.json(await removeFlashPreferenceTag({ userId: authenticatedUserId, tagId: tagId.data }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });
}
