import type { Express, Request, Response } from "express";
import type {
  PersonalStoryDocument,
  PersonalStoryResponse,
  PersonalStoryUpdateResponse,
  PersonalStoryUpdateJobView,
} from "@shared/schema/personalStory";

import { isProviderAvailable } from "../../ai/creativeModelRouter";
import { getFeatureFlag } from "../../lib/featureFlags";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { aiEndpointLimiter } from "../../rateLimiter";
import {
  createOrGetPersonalStoryUpdateJob,
  ensurePersonalStoryNovel,
  getActivePersonalStoryUpdateJob,
  getLatestPersonalStoryUpdateJob,
  listMissingPersonalStoryExperiences,
  listPersonalStoryChapters,
  toPersonalStoryChapterView,
  toPersonalStoryUpdateJobView,
} from "../../repositories/personalStoryRepo";

const STORY_ROUTE = "/api/personal-story";
const UPDATE_ROUTE = "/api/personal-story/update";
const UPDATE_STATUS_ROUTE = "/api/personal-story/update-status";
const STORY_TITLE = "你的故事，正在慢慢长大";
const STORY_SUBTITLE = "每次真实出发，都会在这里变成同一部只属于你的连续小说。";

function isPersonalStoryAIAvailable(): boolean {
  return isProviderAvailable("minimax") || isProviderAvailable("deepseek");
}

async function getUpdateAvailability(): Promise<{
  featureEnabled: boolean;
  providerEnabled: boolean;
  aiEnabled: boolean;
  canUpdate: boolean;
}> {
  const [featureEnabled, providerEnabled] = await Promise.all([
    getFeatureFlag("personalStoryEnabled", false),
    Promise.resolve(isPersonalStoryAIAvailable()),
  ]);
  const enabled = featureEnabled && providerEnabled;
  return {
    featureEnabled,
    providerEnabled,
    aiEnabled: enabled,
    canUpdate: enabled,
  };
}

function disabledUpdateJob(): PersonalStoryUpdateJobView {
  return { status: "disabled", updatedAt: null };
}

async function loadPersonalStoryContext(userId: string) {
  const novel = await ensurePersonalStoryNovel(userId);
  const [chapters, updateJob] = await Promise.all([
    listPersonalStoryChapters(userId, novel.id),
    getLatestPersonalStoryUpdateJob(userId),
  ]);
  const lastGeneratedAt = chapters.reduce<Date | null>(
    (latest, chapter) =>
      !latest || chapter.generatedAt > latest ? chapter.generatedAt : latest,
    null,
  );
  const story: PersonalStoryDocument = {
    title: STORY_TITLE,
    subtitle: STORY_SUBTITLE,
    coverImageUrl: null,
    updatedAt: lastGeneratedAt?.toISOString() ?? null,
    chapters: chapters.map(toPersonalStoryChapterView),
  };
  return { novel, story, updateJob };
}

export function registerPersonalStoryRoutes(app: Express): void {
  app.get(STORY_ROUTE, async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const reqLogger = logger.child({
      request_id: req.requestId,
      route: STORY_ROUTE,
    });
    try {
      const availability = await getUpdateAvailability();
      if (!availability.featureEnabled) {
        return res.status(503).json({
          error: "PERSONAL_STORY_DISABLED",
          message: "我的故事暂未开放",
        });
      }
      const { story, updateJob } = await loadPersonalStoryContext(userId);
      const response: PersonalStoryResponse = {
        story,
        updateJob: availability.canUpdate
          ? updateJob
            ? toPersonalStoryUpdateJobView(updateJob)
            : null
          : disabledUpdateJob(),
        aiEnabled: availability.aiEnabled,
        canUpdate: availability.canUpdate,
      };
      return res.status(200).json(response);
    } catch (error) {
      reqLogger.error("Failed to load personal story", {
        errorCode: "personal_story_load_failed",
      });
      return res.status(500).json({ message: "暂时无法打开我的故事，请稍后再试" });
    }
  });

  app.post(
    UPDATE_ROUTE,
    aiEndpointLimiter,
    async (req: Request, res: Response) => {
      const userId = requireAuthenticatedUserId(req, res);
      if (!userId) return;

      const reqLogger = logger.child({
        request_id: req.requestId,
        route: UPDATE_ROUTE,
      });
      try {
        const availability = await getUpdateAvailability();
        if (!availability.featureEnabled) {
          const response: PersonalStoryUpdateResponse = {
            accepted: false,
            noNewExperiences: false,
            story: null,
            updateJob: disabledUpdateJob(),
          };
          return res.status(403).json({
            ...response,
            message: "故事更新暂未开放",
          });
        }
        const { novel, story, updateJob: latestJob } = await loadPersonalStoryContext(userId);
        if (!availability.providerEnabled) {
          const response: PersonalStoryUpdateResponse = {
            accepted: false,
            noNewExperiences: false,
            story,
            updateJob: disabledUpdateJob(),
          };
          return res.status(503).json({
            ...response,
            message: "故事更新服务暂时不可用，旧章节不会受影响",
          });
        }

        const existingJob = await getActivePersonalStoryUpdateJob(userId);
        if (existingJob) {
          const response: PersonalStoryUpdateResponse = {
            accepted: true,
            noNewExperiences: false,
            story,
            updateJob: toPersonalStoryUpdateJobView(existingJob),
          };
          return res.status(202).json(response);
        }

        const missingSources = await listMissingPersonalStoryExperiences(
          userId,
          novel.id,
        );
        if (missingSources.length === 0) {
          const response: PersonalStoryUpdateResponse = {
            accepted: false,
            noNewExperiences: true,
            story,
            updateJob: latestJob ? toPersonalStoryUpdateJobView(latestJob) : null,
          };
          return res.status(200).json(response);
        }

        const job = await createOrGetPersonalStoryUpdateJob(
          userId,
          novel.id,
          missingSources,
        );
        const response: PersonalStoryUpdateResponse = {
          accepted: true,
          noNewExperiences: false,
          story,
          updateJob: toPersonalStoryUpdateJobView(job),
        };
        return res.status(202).json(response);
      } catch (error) {
        reqLogger.error("Failed to enqueue personal story update", {
          errorCode: "personal_story_update_enqueue_failed",
        });
        return res.status(500).json({ message: "故事更新没有开始，请稍后重试" });
      }
    },
  );

  app.get(UPDATE_STATUS_ROUTE, async (req: Request, res: Response) => {
    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    try {
      const availability = await getUpdateAvailability();
      if (!availability.featureEnabled) {
        return res.status(200).json({
          updateJob: disabledUpdateJob(),
          aiEnabled: false,
          canUpdate: false,
        });
      }
      const job = await getLatestPersonalStoryUpdateJob(userId);
      return res.status(200).json({
        updateJob: availability.canUpdate
          ? job
            ? toPersonalStoryUpdateJobView(job)
            : null
          : disabledUpdateJob(),
        aiEnabled: availability.aiEnabled,
        canUpdate: availability.canUpdate,
      });
    } catch {
      return res.status(500).json({ message: "暂时无法获取故事更新状态" });
    }
  });
}
