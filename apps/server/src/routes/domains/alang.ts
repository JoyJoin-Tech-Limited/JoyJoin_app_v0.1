import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import { getFeatureFlag } from "../../lib/featureFlags";
import { isSingleTestMode } from "../../lib/isSingleTestMode";
import {
  getActiveMissions,
  getActiveInternalMissionBySlug,
  getMissionProgress,
  getMissionProgresses,
  createMissionProgress,
  updateMissionProgress,
  updateMissionProgressIfCurrent,
  archiveStory,
  getStoryArchivesByUser,
  getStoryArchiveById,
  getStoryArchiveByProgressId,
  deleteMissionProgress,
  seedDemoMissionIfNeeded,
} from "../../repositories/alangRepo";
import {
  loadMissionContent,
  getNodeById,
  invalidateMissionCache,
} from "../../services/alangContentService";
import {
  checkGpsArrival,
  computeStageFromNodeType,
  isGpsNode,
} from "../../lib/alang/alangGeoFence";
import {
  canRevealCompanionDestination,
  redactMissionCoordinates,
} from "../../lib/alang/alangDisclosure";
import { resolveAlangArrivalTarget } from "../../lib/alang/alangTargetResolver";
import {
  alangCoordinateSchema,
  alangGpsPointSchema,
  type AlangGpsPoint,
} from "@shared/alang/missionTypes";
import {
  ALANG_TEST_COORDINATE_SYSTEM,
  ALANG_TEST_MAX_DISTANCE_METERS,
  alangHaversineDistanceMeters,
  validateAlangTestPointConfiguration,
} from "@shared/alang/testPointValidation";
import type { AlangMission, AlangMissionProgress } from "@shared/schema";
import {
  ALANG_ARRIVAL_MIN_STABLE_COUNT,
  ALANG_ARRIVAL_RADIUS_METERS,
} from "@shared/alang/constants";
import type { AlangDebugResetResponse } from "@shared/api/alang";

async function gateAlangEnabled(res: Response): Promise<boolean> {
  const enabled = await getFeatureFlag("alangEnabled", false);
  if (!enabled) {
    res.status(503).json({ error: "ALANG_DISABLED" });
    return false;
  }
  return true;
}

export function isAlangDebugMode(): boolean {
  return (process.env.APP_MODE ?? "production") !== "production" && isSingleTestMode();
}

async function gateAlangDebug(res: Response): Promise<boolean> {
  if (!isAlangDebugMode()) {
    res.status(404).json({ error: "NOT_FOUND" });
    return false;
  }
  if (!(await gateAlangEnabled(res))) return false;
  return true;
}

async function gateAlangRetest(res: Response): Promise<boolean> {
  if (!isAlangDebugMode()) {
    res.status(403).json({ error: "ALANG_RETEST_FORBIDDEN" });
    return false;
  }
  if (!(await gateAlangEnabled(res))) return false;
  return true;
}

function requireAlangUserId(req: Request, res: Response): string | null {
  return requireAuthenticatedUserId(req, res);
}

function requestLogger(req: Request) {
  return logger.child({ request_id: req.requestId });
}

function normalizeGpsHistory(value: unknown): AlangGpsPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    const parsed = alangGpsPointSchema.safeParse(point);
    return parsed.success ? [parsed.data] : [];
  });
}

const alangStartMissionSchema = z.object({
  targetLocation: alangCoordinateSchema,
  companionEndLocation: alangCoordinateSchema,
  coordinateSystem: z.literal(ALANG_TEST_COORDINATE_SYSTEM),
}).strict();

const alangMockGpsSchema = z.union([
  z.object({ mode: z.literal("arrive") }).strict(),
  z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).strict(),
]);

function hasRequestBody(body: unknown): boolean {
  return !!body
    && typeof body === "object"
    && !Array.isArray(body)
    && Object.keys(body as Record<string, unknown>).length > 0;
}

function storedTestCoordinate(coordinate: { latitude: number; longitude: number }) {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    radiusMeters: ALANG_ARRIVAL_RADIUS_METERS,
    coordinateSystem: ALANG_TEST_COORDINATE_SYSTEM,
  } as const;
}

function progressTestPointValidation(progress: AlangMissionProgress | null) {
  if (!progress) return { valid: false as const, reason: "invalid_coordinate" as const };
  const targetCoordinateSystem = progress.targetLocation
    && typeof progress.targetLocation === "object"
    && "coordinateSystem" in progress.targetLocation
    ? progress.targetLocation.coordinateSystem
    : null;
  const companionCoordinateSystem = progress.companionEndLocation
    && typeof progress.companionEndLocation === "object"
    && "coordinateSystem" in progress.companionEndLocation
    ? progress.companionEndLocation.coordinateSystem
    : null;
  if (targetCoordinateSystem !== ALANG_TEST_COORDINATE_SYSTEM
    || companionCoordinateSystem !== ALANG_TEST_COORDINATE_SYSTEM) {
    return { valid: false as const, reason: "invalid_coordinate" as const };
  }
  return validateAlangTestPointConfiguration(
    progress.targetLocation,
    progress.companionEndLocation,
  );
}

function progressMatchesTestConfiguration(
  progress: AlangMissionProgress,
  configuration: {
    targetLocation: { latitude: number; longitude: number };
    companionEndLocation: { latitude: number; longitude: number };
  },
): boolean {
  const persisted = progressTestPointValidation(progress);
  if (!persisted.valid) return false;

  return alangHaversineDistanceMeters(
    persisted.targetLocation,
    configuration.targetLocation,
  ) <= 1
    && alangHaversineDistanceMeters(
      persisted.companionEndLocation,
      configuration.companionEndLocation,
    ) <= 1;
}

function resolveProgressArrivalTarget(options: {
  mission: AlangMission;
  progress: AlangMissionProgress;
  content: NonNullable<Awaited<ReturnType<typeof loadMissionContent>>>;
  kind: "search" | "companion";
  currentNode?: ReturnType<typeof getNodeById>;
}) {
  return resolveAlangArrivalTarget({
    ...options,
    requireProgressCoordinates: isAlangDebugMode(),
  });
}

type LoadedMissionContent = NonNullable<Awaited<ReturnType<typeof loadMissionContent>>>;

function resolveSingleTestSearchEntry(content: LoadedMissionContent) {
  const nodeHistory: string[] = [];
  const visited = new Set<string>();
  let nodeId: string | undefined = content.startNodeId;

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = getNodeById(content, nodeId);
    if (!node) return null;
    nodeHistory.push(node.id);
    if (node.type === "search_gate") {
      return { node, nodeHistory };
    }
    nodeId = node.nextNodeId;
  }

  return null;
}

export function registerAlangRoutes(app: Express): void {
  // Synchronize the reviewed internal story once per process. The database is
  // runtime authority, so a changed approved content version must not remain
  // stuck behind the original insert-only seed.
  let contentSynchronized = false;
  let contentSyncPromise: Promise<void> | null = null;

  const ensureDemoContent = async (req: Request): Promise<void> => {
    if (contentSynchronized) return;
    if (!contentSyncPromise) {
      contentSyncPromise = seedDemoMissionIfNeeded()
        .then((changed) => {
          if (changed) invalidateMissionCache("alang-demo");
          contentSynchronized = true;
        })
        .catch((error: unknown) => {
          contentSyncPromise = null;
          requestLogger(req).error("[Alang] demo mission synchronization failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
    await contentSyncPromise;
  };

  // ─── Public: List missions ───
  app.get("/api/alang/missions", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    await ensureDemoContent(req);

    try {
      const missions = await getActiveMissions();
      const progresses = await getMissionProgresses(userId, missions.map((mission) => mission.id));
      const progressByMissionId = new Map(
        progresses.map((progress) => [progress.missionId, progress] as const)
      );
      const result = missions.map((m) => {
        const progress = progressByMissionId.get(m.id);
        return {
          id: m.id,
          slug: m.slug,
          title: m.title,
          description: m.description,
          status: progress?.status ?? "not_started",
          stage: progress?.stage ?? "not_started",
          currentNodeId: progress?.currentNodeId ?? undefined,
          progressPercent: computeProgressPercent(m, progress ?? null),
          isDebugSession: progress?.isDebugSession ?? false,
        };
      });
      res.json(result);
    } catch (error: any) {
      requestLogger(req).error("[Alang] list missions error", { error: error?.message });
      res.status(500).json({ error: "FAILED_TO_LIST_MISSIONS" });
    }
  });

  // ─── Public: Mission detail ───
  app.get("/api/alang/missions/:slug", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      if (slug === "alang-demo") await ensureDemoContent(req);
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const content = await loadMissionContent(slug);
      const progress = await getMissionProgress(userId, mission.id);
      const completedArchive = progress?.status === "completed"
        ? await getStoryArchiveByProgressId(progress.id)
        : null;
      const testConfigurationInvalid = isAlangDebugMode()
        && !!progress
        && !progressTestPointValidation(progress).valid;
      const routeDestination = canRevealCompanionDestination(progress)
        && content
        && progress
        && !testConfigurationInvalid
        ? resolveProgressArrivalTarget({ mission, progress, content, kind: "companion" })
        : null;

      res.json({
        id: mission.id,
        slug: mission.slug,
        title: mission.title,
        description: mission.description,
        content: content ? redactMissionCoordinates(content) : null,
        routeDestination: routeDestination
          ? {
              latitude: routeDestination.latitude,
              longitude: routeDestination.longitude,
            }
          : undefined,
        testConfigurationInvalid: testConfigurationInvalid || undefined,
        myProgress: progress
          ? {
              progressId: progress.id,
              stage: progress.stage,
              currentNodeId: progress.currentNodeId,
              nodeHistory: progress.nodeHistory ?? [],
              choicesMade: progress.choicesMade ?? [],
              status: progress.status,
              isDebugSession: progress.isDebugSession,
              arrivedAt: progress.arrivedAt?.toISOString(),
              completedAt: progress.completedAt?.toISOString(),
              archiveId: completedArchive?.id,
            }
          : null,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] get mission detail error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_GET_MISSION" });
    }
  });

  // ─── Public: Start mission ───
  app.post("/api/alang/missions/:slug/start", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      if (slug === "alang-demo") await ensureDemoContent(req);
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }

      const debugMode = isAlangDebugMode();
      const requestHasBody = hasRequestBody(req.body);
      if (requestHasBody && !debugMode) {
        res.status(403).json({ error: "ALANG_TEST_POINTS_FORBIDDEN" });
        return;
      }

      const parsedConfiguration = requestHasBody
        ? alangStartMissionSchema.safeParse(req.body)
        : null;
      if (requestHasBody && !parsedConfiguration?.success) {
        res.status(400).json({ error: "ALANG_TEST_POINTS_INVALID" });
        return;
      }

      const validatedConfiguration = parsedConfiguration?.success
        ? validateAlangTestPointConfiguration(
            parsedConfiguration.data.targetLocation,
            parsedConfiguration.data.companionEndLocation,
          )
        : null;
      if (validatedConfiguration && !validatedConfiguration.valid) {
        res.status(400).json({
          error: "ALANG_TEST_POINTS_INVALID",
          reason: validatedConfiguration.reason,
        });
        return;
      }

      const configuredSearchEntry = validatedConfiguration?.valid
        ? resolveSingleTestSearchEntry(content)
        : null;
      if (validatedConfiguration?.valid && !configuredSearchEntry) {
        res.status(500).json({ error: "INVALID_SEARCH_NODE" });
        return;
      }

      let progress = await getMissionProgress(userId, mission.id);
      if (progress && progress.status === "in_progress") {
        if (debugMode && validatedConfiguration?.valid) {
          const hasReachedConfiguredSearch = progress.currentNodeId === configuredSearchEntry!.node.id
            || (progress.nodeHistory ?? []).includes(configuredSearchEntry!.node.id);
          const isSameConfiguredRun = progress.isDebugSession === true
            && progressMatchesTestConfiguration(progress, validatedConfiguration);
          if (hasReachedConfiguredSearch
            && !["not_started", "configuring"].includes(progress.stage)) {
            if (!isSameConfiguredRun) {
              res.status(409).json({ error: "ALANG_RECONFIG_REQUIRES_RESET" });
              return;
            }
            res.json({
              progressId: progress.id,
              stage: progress.stage,
              currentNodeId: progress.currentNodeId,
              nodeHistory: progress.nodeHistory ?? [],
              choicesMade: progress.choicesMade ?? [],
            });
            return;
          }
          if (!["not_started", "configuring"].includes(progress.stage)) {
            res.status(409).json({ error: "ALANG_RECONFIG_REQUIRES_RESET" });
            return;
          }
          if (!progress.currentNodeId) {
            res.status(409).json({ error: "ALANG_RECONFIG_REQUIRES_RESET" });
            return;
          }
          const expectedCurrentNodeId = progress.currentNodeId;
          const updated = await updateMissionProgressIfCurrent(progress.id, expectedCurrentNodeId, {
            currentNodeId: configuredSearchEntry!.node.id,
            nodeHistory: Array.from(new Set([
              ...(progress.nodeHistory ?? []),
              ...configuredSearchEntry!.nodeHistory,
            ])),
            stage: computeStageFromNodeType(configuredSearchEntry!.node.type),
            targetLocation: storedTestCoordinate(validatedConfiguration.targetLocation),
            companionEndLocation: storedTestCoordinate(validatedConfiguration.companionEndLocation),
            isDebugSession: true,
            debugMarkers: Array.from(new Set([
              ...(progress.debugMarkers ?? []),
              "test-points-configured",
            ])),
          });
          if (updated) {
            progress = updated;
          } else {
            const winner = await getMissionProgress(userId, mission.id);
            const winnerIsSameConfiguredSearch = !!winner
              && winner.status === "in_progress"
              && winner.stage === "searching"
              && winner.currentNodeId === configuredSearchEntry!.node.id
              && winner.isDebugSession === true
              && progressMatchesTestConfiguration(winner, validatedConfiguration);
            if (!winnerIsSameConfiguredSearch) {
              res.status(409).json({ error: "ALANG_RECONFIG_REQUIRES_RESET" });
              return;
            }
            progress = winner!;
          }
        } else if (debugMode && !progressTestPointValidation(progress).valid) {
          res.status(409).json({ error: "ALANG_TEST_POINTS_REQUIRED" });
          return;
        }

        res.json({
          progressId: progress.id,
          stage: progress.stage,
          currentNodeId: progress.currentNodeId,
          nodeHistory: progress.nodeHistory ?? [],
          choicesMade: progress.choicesMade ?? [],
        });
        return;
      }

      if (progress?.status === "completed") {
        const archive = await getStoryArchiveByProgressId(progress.id);
        res.json({
          progressId: progress.id,
          stage: progress.stage,
          currentNodeId: progress.currentNodeId ?? content.startNodeId,
          nodeHistory: progress.nodeHistory ?? [],
          choicesMade: progress.choicesMade ?? [],
          completed: true,
          archiveId: archive?.id,
        });
        return;
      }

      if (progress?.status === "abandoned") {
        // Abandoned runs can restart; completed archives require explicit debug reset.
        await deleteMissionProgress(userId, mission.id);
        progress = null;
      }

      if (debugMode && !validatedConfiguration?.valid) {
        res.status(400).json({ error: "ALANG_TEST_POINTS_REQUIRED" });
        return;
      }

      const startNode = getNodeById(content, content.startNodeId);
      if (!startNode) {
        res.status(500).json({ error: "INVALID_START_NODE" });
        return;
      }

      let initialNode = configuredSearchEntry?.node ?? startNode;
      const nodeHistory = configuredSearchEntry?.nodeHistory ?? [startNode.id];
      if (!configuredSearchEntry && startNode.type === "event_card" && startNode.nextNodeId) {
        const eventDetailNode = getNodeById(content, startNode.nextNodeId);
        if (eventDetailNode?.type === "event_detail") {
          initialNode = eventDetailNode;
          nodeHistory.push(eventDetailNode.id);
        }
      }

      progress = await createMissionProgress({
        userId,
        missionId: mission.id,
        currentNodeId: initialNode.id,
        nodeHistory,
        choicesMade: [],
        gpsHistory: [],
        status: "in_progress",
        stage: computeStageFromNodeType(initialNode.type),
        ...(validatedConfiguration?.valid
          ? {
              targetLocation: storedTestCoordinate(validatedConfiguration.targetLocation),
              companionEndLocation: storedTestCoordinate(validatedConfiguration.companionEndLocation),
              isDebugSession: true,
              debugMarkers: ["test-points-configured"],
            }
          : {}),
      });

      // A concurrent start can win the unique (user, mission) insert. The
      // repository then returns that winning row, which is safe to reuse only
      // when it represents the same configured search run. Point comparison
      // allows only a 1 m serialization tolerance.
      if (validatedConfiguration?.valid
        && (progress.stage !== "searching"
          || progress.currentNodeId !== configuredSearchEntry!.node.id
          || progress.isDebugSession !== true
          || !progressMatchesTestConfiguration(progress, validatedConfiguration))) {
        res.status(409).json({ error: "ALANG_RECONFIG_REQUIRES_RESET" });
        return;
      }

      res.json({
        progressId: progress.id,
        stage: progress.stage,
        currentNodeId: progress.currentNodeId,
        nodeHistory: progress.nodeHistory ?? [],
        choicesMade: progress.choicesMade ?? [],
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] start mission error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_START" });
    }
  });

  // ─── Public: Report progress (node advance) ───
  app.post("/api/alang/missions/:slug/progress", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    const parse = z.object({ nodeId: z.string() }).safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "INVALID_INPUT" });
      return;
    }

    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress || progress.status !== "in_progress") {
        res.status(409).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }
      if (isAlangDebugMode() && !progressTestPointValidation(progress).valid) {
        res.status(409).json({ error: "ALANG_TEST_POINTS_REQUIRED" });
        return;
      }

      const nodeId = parse.data.nodeId;
      if (progress.currentNodeId === nodeId) {
        res.json({ ok: true, stage: progress.stage, currentNodeId: nodeId });
        return;
      }

      const currentNode = getNodeById(content, progress.currentNodeId ?? "");
      const nextNode = getNodeById(content, nodeId);
      if (currentNode && isGpsNode(currentNode.type)) {
        res.status(409).json({ error: "GPS_REQUIRED" });
        return;
      }
      if (!currentNode || !nextNode || currentNode.nextNodeId !== nodeId) {
        res.status(409).json({ error: "INVALID_STAGE_TRANSITION" });
        return;
      }

      const nodeHistory = (progress.nodeHistory ?? []).includes(nodeId)
        ? progress.nodeHistory ?? []
        : [...(progress.nodeHistory ?? []), nodeId];
      const stage = computeStageFromNodeType(nextNode.type);

      const updated = await updateMissionProgress(progress.id, {
        currentNodeId: nodeId,
        nodeHistory,
        stage,
      });

      if (!updated?.currentNodeId) {
        res.status(409).json({ error: "PROGRESS_UPDATE_CONFLICT" });
        return;
      }
      res.json({ ok: true, stage: updated.stage, currentNodeId: updated.currentNodeId });
    } catch (error: any) {
      requestLogger(req).error("[Alang] progress error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_UPDATE_PROGRESS" });
    }
  });

  // ─── Public: GPS report + arrival check ───
  app.post("/api/alang/missions/:slug/gps", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    const parse = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().nonnegative().optional(),
        timestamp: z.number(),
        targetOverride: z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          radiusMeters: z.literal(ALANG_ARRIVAL_RADIUS_METERS),
        }).optional(),
      })
      .safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "INVALID_INPUT" });
      return;
    }

    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress || progress.status !== "in_progress") {
        res.status(409).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }

      const currentNode = getNodeById(content, progress.currentNodeId ?? "");
      if (!currentNode || !isGpsNode(currentNode.type)) {
        res.status(400).json({ error: "NOT_GPS_NODE" });
        return;
      }
      if (isAlangDebugMode() && !progressTestPointValidation(progress).valid) {
        res.status(422).json({ error: "ALANG_TEST_POINTS_INVALID" });
        return;
      }

      const target = resolveProgressArrivalTarget({
        mission,
        progress,
        content,
        kind: currentNode.type === "companion_move" ? "companion" : "search",
        currentNode,
      });
      if (!target) {
        res.status(isAlangDebugMode() ? 422 : 500).json({
          error: isAlangDebugMode() ? "ALANG_TEST_POINTS_INVALID" : "NO_TARGET_LOCATION",
        });
        return;
      }

      const debugTargetOverride = isAlangDebugMode() && parse.data.targetOverride
        ? parse.data.targetOverride
        : null;
      if (debugTargetOverride && alangHaversineDistanceMeters(debugTargetOverride, target) > 1) {
        res.status(409).json({ error: "ALANG_TEST_POINT_MISMATCH" });
        return;
      }

      const gpsPoint: AlangGpsPoint = {
        latitude: parse.data.latitude,
        longitude: parse.data.longitude,
        ts: parse.data.timestamp,
        accuracy: parse.data.accuracy,
      };

      // Arrival only needs the latest stability window; never retain a route trace.
      const gpsHistory = [
        ...normalizeGpsHistory(progress.gpsHistory)
          .slice(-(ALANG_ARRIVAL_MIN_STABLE_COUNT - 1)),
        gpsPoint,
      ];
      const arrival = checkGpsArrival(
        gpsPoint.latitude,
        gpsPoint.longitude,
        target,
        gpsHistory,
      );
      if (isAlangDebugMode() && arrival.distanceMeters > ALANG_TEST_MAX_DISTANCE_METERS) {
        res.json({
          arrived: false,
          configurationInvalid: true,
          distanceMeters: Math.round(arrival.distanceMeters * 100) / 100,
          radiusMeters: arrival.radiusMeters,
          stableCount: 0,
          nodeId: progress.currentNodeId,
          stage: progress.stage,
        });
        return;
      }

      let updates: Partial<typeof progress> = {
        gpsHistory,
        ...(debugTargetOverride
          ? {
              isDebugSession: true,
              debugMarkers: [...(progress.debugMarkers ?? []), "target-override"],
            }
          : {}),
      };
      if (arrival.arrived && currentNode.nextNodeId) {
        const nodeHistory = (progress.nodeHistory ?? []).includes(currentNode.nextNodeId)
          ? progress.nodeHistory ?? []
          : [...(progress.nodeHistory ?? []), currentNode.nextNodeId];
        const nextNode = getNodeById(content, currentNode.nextNodeId);
        const nextStage = computeStageFromNodeType(nextNode?.type ?? "unknown");
        updates = {
          ...updates,
          currentNodeId: currentNode.nextNodeId,
          nodeHistory,
          stage: nextStage,
          ...(nextStage === "arrived" ? { arrivedAt: new Date() } : {}),
        };
      }

      await updateMissionProgress(progress.id, updates);

      res.json({
        arrived: arrival.arrived,
        distanceMeters: Math.round(arrival.distanceMeters * 100) / 100,
        radiusMeters: arrival.radiusMeters,
        stableCount: arrival.stableCount,
        nodeId: updates.currentNodeId ?? progress.currentNodeId,
        stage: updates.stage ?? progress.stage,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] gps error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_PROCESS_GPS" });
    }
  });

  // ─── Public: Submit choice ───
  app.post("/api/alang/missions/:slug/choice", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    const parse = z.object({ nodeId: z.string(), choiceIndex: z.number().int().min(0) }).safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "INVALID_INPUT" });
      return;
    }

    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress || progress.status !== "in_progress") {
        res.status(409).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }

      const node = getNodeById(content, parse.data.nodeId);
      if (!node || node.type !== "dialogue") {
        res.status(400).json({ error: "NOT_DIALOGUE_NODE" });
        return;
      }

      const choice = node.choices?.[parse.data.choiceIndex];
      if (!choice) {
        res.status(400).json({ error: "INVALID_CHOICE_INDEX" });
        return;
      }

      const existingChoice = (progress.choicesMade ?? []).find(
        (item) => item.nodeId === parse.data.nodeId
      );
      if (existingChoice) {
        if (existingChoice.choiceIndex !== parse.data.choiceIndex) {
          res.status(409).json({ error: "CHOICE_ALREADY_MADE" });
          return;
        }
        res.json({
          nextNodeId: choice.nextNodeId,
          response: choice.response,
          moodShift: choice.moodShift,
          stage: computeStageFromNodeType(getNodeById(content, choice.nextNodeId)?.type ?? "unknown"),
          replayed: true,
        });
        return;
      }

      if (progress.currentNodeId !== parse.data.nodeId) {
        res.status(409).json({ error: "STALE_DIALOGUE_NODE" });
        return;
      }

      const choicesMade = [
        ...(progress.choicesMade ?? []),
        { nodeId: parse.data.nodeId, choiceIndex: parse.data.choiceIndex, label: choice.label },
      ];
      const nodeHistory = (progress.nodeHistory ?? []).includes(choice.nextNodeId)
        ? progress.nodeHistory ?? []
        : [...(progress.nodeHistory ?? []), choice.nextNodeId];
      const nextNode = getNodeById(content, choice.nextNodeId);
      const stage = computeStageFromNodeType(nextNode?.type ?? "unknown");

      const updated = await updateMissionProgressIfCurrent(
        progress.id,
        parse.data.nodeId,
        {
        currentNodeId: choice.nextNodeId,
        nodeHistory,
        choicesMade,
        stage,
        },
      );
      if (!updated) {
        res.status(409).json({ error: "CHOICE_UPDATE_CONFLICT" });
        return;
      }

      res.json({
        nextNodeId: choice.nextNodeId,
        response: choice.response,
        moodShift: choice.moodShift,
        stage,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] choice error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_PROCESS_CHOICE" });
    }
  });

  // ─── Public: Recover mission ───
  app.get("/api/alang/missions/:slug/recover", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress || progress.status !== "in_progress") {
        res.status(404).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }
      const testConfigurationInvalid = isAlangDebugMode()
        && !progressTestPointValidation(progress).valid;
      const routeDestination = canRevealCompanionDestination(progress)
        && !testConfigurationInvalid
        ? resolveProgressArrivalTarget({ mission, progress, content, kind: "companion" })
        : null;

      res.json({
        progressId: progress.id,
        stage: progress.stage,
        currentNodeId: progress.currentNodeId,
        nodeHistory: progress.nodeHistory ?? [],
        choicesMade: progress.choicesMade ?? [],
        routeDestination: routeDestination
          ? {
              latitude: routeDestination.latitude,
              longitude: routeDestination.longitude,
            }
          : undefined,
        testConfigurationInvalid: testConfigurationInvalid || undefined,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] recover error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_RECOVER" });
    }
  });

  // ─── Public: Complete mission ───
  app.post("/api/alang/missions/:slug/complete", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress) {
        res.status(404).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      // Recover both ordinary retries and the edge case where archive insert
      // committed but the progress update did not.
      const existingArchive = await getStoryArchiveByProgressId(progress.id);
      if (existingArchive) {
        if (progress.status !== "completed") {
          await updateMissionProgress(progress.id, {
            status: "completed",
            completedAt: existingArchive.completedAt,
            stage: "completed",
          });
        }
        requestLogger(req).info("[Alang] mission completion replayed", {
          slug,
          progressId: progress.id,
          archiveId: existingArchive.id,
        });
        res.json({ archiveId: existingArchive.id, completed: true });
        return;
      }

      if (progress.status !== "in_progress" && progress.status !== "completed") {
        res.status(409).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }

      const resultNode = getNodeById(content, progress.currentNodeId ?? "");
      if (!resultNode || resultNode.type !== "result_card" || progress.stage !== "result") {
        res.status(409).json({ error: "RESULT_NOT_READY" });
        return;
      }
      const resultContent = resultNode.content;
      const visitedNodes = (progress.nodeHistory ?? [])
        .map((nodeId) => getNodeById(content, nodeId))
        .filter((node): node is NonNullable<typeof node> => node !== null);
      const closingLines = visitedNodes.flatMap((node) =>
        node.type === "closing" ? node.content.closingLines ?? [] : []
      );
      const companionLines = visitedNodes.flatMap((node) =>
        node.type === "companion_move" ? node.content.companionLines ?? [] : []
      );
      const completedAt = new Date();

      const { archive, created } = await archiveStory({
        userId,
        missionId: mission.id,
        progressId: progress.id,
        title: mission.title,
        locationName: resultContent.locationLabel ?? "未知地点",
        completedAt,
        finalMood: resultContent.finalMood ?? "完成",
        closingLine: closingLines.join(" "),
        summaryLine: resultContent.summaryLine ?? "",
        nodeHistory: progress.nodeHistory ?? [],
        choicesMade: progress.choicesMade ?? [],
        companionLines,
        isDebugSession: progress.isDebugSession ?? false,
      });

      await updateMissionProgress(progress.id, {
        status: "completed",
        completedAt: archive.completedAt,
        stage: "completed",
      });

      requestLogger(req).info("[Alang] mission completion persisted", {
        slug,
        progressId: progress.id,
        archiveId: archive.id,
        created,
      });
      res.json({ archiveId: archive.id, completed: true });
    } catch (error: any) {
      requestLogger(req).error("[Alang] complete error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_COMPLETE" });
    }
  });

  // ─── Public: Abandon mission ───
  app.post("/api/alang/missions/:slug/abandon", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress) {
        res.status(404).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      if (progress.status === "completed") {
        res.status(409).json({ error: "MISSION_ALREADY_COMPLETED" });
        return;
      }
      if (progress.status === "abandoned") {
        res.json({ ok: true });
        return;
      }

      await updateMissionProgress(progress.id, {
        status: "abandoned",
        abandonedAt: new Date(),
        stage: "abandoned",
      });

      res.json({ ok: true });
    } catch (error: any) {
      requestLogger(req).error("[Alang] abandon error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_ABANDON" });
    }
  });

  // ─── Public: List archives ───
  app.get("/api/alang/archives", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    try {
      const archives = await getStoryArchivesByUser(userId);
      res.json(
        archives.map((a) => ({
          id: a.id,
          missionId: a.missionId,
          title: a.title,
          locationName: a.locationName,
          completedAt: a.completedAt,
          finalMood: a.finalMood,
          summaryLine: a.summaryLine,
          isDebugSession: a.isDebugSession,
        }))
      );
    } catch (error: any) {
      requestLogger(req).error("[Alang] list archives error", { error: error?.message });
      res.status(500).json({ error: "FAILED_TO_LIST_ARCHIVES" });
    }
  });

  // ─── Public: Archive detail ───
  app.get("/api/alang/archives/:archiveId", async (req: Request, res: Response) => {
    if (!(await gateAlangEnabled(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { archiveId } = req.params;
    try {
      const archive = await getStoryArchiveById(archiveId);
      if (!archive || archive.userId !== userId) {
        res.status(404).json({ error: "ARCHIVE_NOT_FOUND" });
        return;
      }

      res.json({
        id: archive.id,
        missionId: archive.missionId,
        title: archive.title,
        locationName: archive.locationName,
        completedAt: archive.completedAt,
        finalMood: archive.finalMood,
        closingLine: archive.closingLine,
        summaryLine: archive.summaryLine,
        nodeHistory: archive.nodeHistory,
        choicesMade: archive.choicesMade,
        companionLines: archive.companionLines,
        isDebugSession: archive.isDebugSession,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] archive detail error", { archiveId, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_GET_ARCHIVE" });
    }
  });

  // ─── Debug: Force node ───
  app.post("/api/alang/debug/missions/:slug/force-node", async (req: Request, res: Response) => {
    if (!(await gateAlangDebug(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    const parse = z.object({ nodeId: z.string() }).safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "INVALID_INPUT" });
      return;
    }

    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress) {
        res.status(404).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }
      const node = getNodeById(content, parse.data.nodeId);
      if (!node) {
        res.status(400).json({ error: "NODE_NOT_FOUND" });
        return;
      }

      const nodeHistory = [...(progress.nodeHistory ?? []), parse.data.nodeId];
      const debugMarkers = [...(progress.debugMarkers ?? []), `force-node:${parse.data.nodeId}`];
      const stage = computeStageFromNodeType(node.type);

      await updateMissionProgress(progress.id, {
        currentNodeId: parse.data.nodeId,
        nodeHistory,
        stage,
        isDebugSession: true,
        debugMarkers,
      });

      res.json({ ok: true, stage, currentNodeId: parse.data.nodeId });
    } catch (error: any) {
      requestLogger(req).error("[Alang] debug force-node error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_FORCE_NODE" });
    }
  });

  // ─── Debug: Reset ───
  app.post("/api/alang/debug/missions/:slug/reset", async (req: Request, res: Response) => {
    if (!(await gateAlangRetest(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const resetResult = await deleteMissionProgress(userId, mission.id);
      requestLogger(req).info("[Alang] internal retest reset", {
        actingUserId: userId,
        missionSlug: slug,
        deletedProgressCount: resetResult.deletedProgressCount,
        deletedArchiveCount: resetResult.deletedArchiveCount,
        resetAt: new Date().toISOString(),
        environment: process.env.APP_MODE ?? "unset",
      });
      const response: AlangDebugResetResponse = { reset: true, ...resetResult };
      res.json(response);
    } catch (error: any) {
      requestLogger(req).error("[Alang] debug reset error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_RESET" });
    }
  });

  // ─── Debug: Mock GPS ───
  app.post("/api/alang/debug/missions/:slug/mock-gps", async (req: Request, res: Response) => {
    if (!(await gateAlangDebug(res))) return;
    const userId = requireAlangUserId(req, res);
    if (!userId) return;

    const { slug } = req.params;
    const parse = alangMockGpsSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "INVALID_INPUT" });
      return;
    }

    try {
      const mission = await getActiveInternalMissionBySlug(slug);
      if (!mission) {
        res.status(404).json({ error: "MISSION_NOT_FOUND" });
        return;
      }

      const progress = await getMissionProgress(userId, mission.id);
      if (!progress || progress.status !== "in_progress") {
        res.status(409).json({ error: "NO_ACTIVE_PROGRESS" });
        return;
      }

      const content = await loadMissionContent(slug);
      if (!content) {
        res.status(500).json({ error: "CONTENT_NOT_LOADED" });
        return;
      }

      const currentNode = getNodeById(content, progress.currentNodeId ?? "");
      if (!currentNode || !isGpsNode(currentNode.type)) {
        res.status(400).json({ error: "NOT_GPS_NODE" });
        return;
      }
      if (!progressTestPointValidation(progress).valid) {
        res.status(422).json({ error: "ALANG_TEST_POINTS_INVALID" });
        return;
      }

      const target = resolveProgressArrivalTarget({
        mission,
        progress,
        content,
        kind: currentNode.type === "companion_move" ? "companion" : "search",
        currentNode,
      });
      if (!target) {
        res.status(422).json({ error: "ALANG_TEST_POINTS_INVALID" });
        return;
      }

      const manualPoint = "latitude" in parse.data ? parse.data : null;
      const mockArrival = manualPoint === null;
      const now = Date.now();
      const gpsPoint: AlangGpsPoint = {
        latitude: mockArrival
          ? target.latitude + (2 / 111_000)
          : manualPoint.latitude,
        longitude: mockArrival ? target.longitude : manualPoint.longitude,
        ts: now,
        accuracy: 1,
      };

      const gpsHistory = mockArrival
        ? Array.from({ length: ALANG_ARRIVAL_MIN_STABLE_COUNT }, (_, index) => ({
            ...gpsPoint,
            ts: now + index,
          }))
        : [
            ...normalizeGpsHistory(progress.gpsHistory)
              .slice(-(ALANG_ARRIVAL_MIN_STABLE_COUNT - 1)),
            gpsPoint,
          ];
      const arrival = checkGpsArrival(
        gpsPoint.latitude,
        gpsPoint.longitude,
        target,
        gpsHistory,
      );

      let updates: Partial<typeof progress> = {
        gpsHistory,
        isDebugSession: true,
        debugMarkers: [
          ...(progress.debugMarkers ?? []),
          mockArrival ? "mock-gps:arrive" : "mock-gps",
        ],
      };

      if (arrival.arrived && currentNode.nextNodeId) {
        const nodeHistory = (progress.nodeHistory ?? []).includes(currentNode.nextNodeId)
          ? progress.nodeHistory ?? []
          : [...(progress.nodeHistory ?? []), currentNode.nextNodeId];
        const nextNode = getNodeById(content, currentNode.nextNodeId);
        const nextStage = computeStageFromNodeType(nextNode?.type ?? "unknown");
        updates = {
          ...updates,
          currentNodeId: currentNode.nextNodeId,
          nodeHistory,
          stage: nextStage,
          ...(nextStage === "arrived" ? { arrivedAt: new Date() } : {}),
        };
      }

      await updateMissionProgress(progress.id, updates);

      res.json({
        arrived: arrival.arrived,
        distanceMeters: Math.round(arrival.distanceMeters * 100) / 100,
        radiusMeters: arrival.radiusMeters,
        stableCount: arrival.stableCount,
        nodeId: updates.currentNodeId ?? progress.currentNodeId,
        stage: updates.stage ?? progress.stage,
        debug: true,
      });
    } catch (error: any) {
      requestLogger(req).error("[Alang] debug mock-gps error", { slug, error: error?.message });
      res.status(500).json({ error: "FAILED_TO_MOCK_GPS" });
    }
  });
}

function computeProgressPercent(mission: AlangMission, progress: AlangMissionProgress | null): number {
  if (!progress || !progress.nodeHistory) return 0;
  const content = mission.contentJson as { nodes?: Array<{ id: string }> } | null;
  if (!content?.nodes) return 0;
  const total = content.nodes.length;
  const visited = new Set(progress.nodeHistory).size;
  return Math.min(100, Math.round((visited / total) * 100));
}
