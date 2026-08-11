import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  flashAcceptRequestSchema,
  flashAnswerRequestSchema,
  flashFeedbackRequestSchema,
  flashPreferenceUpdateSchema,
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
  arriveAtFlashAssignment,
  assertFlashRuntimeReady,
  deliverFlashTaskToNpc,
  feedbackFlashAssignment,
  FlashServiceError,
  getFlashAssignment,
  getFlashEncounter,
  getFlashHome,
  getFlashPreferenceSettings,
  getFlashStoryFragments,
  locateFlashAppearance,
  patchFlashPreferenceSettings,
  removeFlashPreferenceTag,
  rerollFlashEncounterOffer,
  respondToFlashOffer,
  retryFlashTask,
} from "../../services/flashService";
import { startFlashBackgroundJobs } from "../../services/flashScheduleService";

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
    return sendFlashError(res, error);
  }
}

function userId(req: Request, res: Response): string | null {
  return requireAuthenticatedUserId(req, res);
}

function parseEncounterCoordinate(body: unknown):
  | { success: true; data: { latitude: number; longitude: number; coordinateSystem: "gcj02" } }
  | { success: false; code: "FLASH_LOCATION_REQUIRED" } {
  if (!body || typeof body !== "object") return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  const value = body as Record<string, unknown>;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number") {
    return { success: false, code: "FLASH_LOCATION_REQUIRED" };
  }
  const parsed = flashTestCoordinateSchema.safeParse(value);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, code: "FLASH_LOCATION_REQUIRED" };
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

function sendCoordinateError(res: Response, code: "FLASH_LOCATION_REQUIRED" | "FLASH_OUTSIDE_SHENZHEN") {
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
      logSafeRouteFailure(req, null, error);
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/appearances/:id/locate", ...guards, flashLocateEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const appearanceId = idParamSchema.safeParse(req.params.id);
    if (!appearanceId.success) return res.status(400).json({ code: "FLASH_APPEARANCE_NOT_FOUND", error: "无效的相遇编号" });
    const forceArrivalForTesting = await isAnyLocationArrivalTestEnabled();
    const coordinate = parseEncounterCoordinate(req.body);
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await locateFlashAppearance({
        userId: authenticatedUserId,
        appearanceId: appearanceId.data,
        forceArrivalForTesting,
        ...coordinate.data,
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
      return res.json(await getFlashEncounter({
        encounterId: encounterId.data,
        userId: authenticatedUserId,
        allowSameEncounterDeliveryForTesting: await isAnyLocationArrivalTestEnabled(),
        allowStoryReplay: isStoryReplayRequest(req),
      }));
    } catch (error) {
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/story/fragments", ...guards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashStoryFragments(authenticatedUserId));
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
        allowStoryReplay: isStoryReplayRequest(req),
      }));
    } catch (error) {
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
      return sendFlashError(res, error);
    }
  });

  app.post("/api/alang/flash/assignments/:id/arrive", ...guards, retiredFlashTaskFlow, geoEndpointLimiter, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    const assignmentId = idParamSchema.safeParse(req.params.id);
    if (!assignmentId.success) return res.status(404).json({ code: "FLASH_TASK_NOT_FOUND", error: "没有找到这个委托" });
    const forceArrivalForTesting = await isAnyLocationArrivalTestEnabled();
    const coordinate = parseEncounterCoordinate(req.body);
    if (!coordinate.success) return sendCoordinateError(res, coordinate.code);
    try {
      return res.json(await arriveAtFlashAssignment({
        assignmentId: assignmentId.data,
        userId: authenticatedUserId,
        forceArrivalForTesting,
        ...coordinate.data,
      }));
    } catch (error) {
      // Never log the request body or raw coordinate.
      logSafeRouteFailure(req, assignmentId.data, error);
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
      return sendFlashError(res, error);
    }
  });

  app.get("/api/alang/flash/preferences", ...preferenceGuards, async (req, res) => {
    const authenticatedUserId = userId(req, res);
    if (!authenticatedUserId) return;
    try {
      return res.json(await getFlashPreferenceSettings(authenticatedUserId));
    } catch (error) {
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
      return sendFlashError(res, error);
    }
  });
}
