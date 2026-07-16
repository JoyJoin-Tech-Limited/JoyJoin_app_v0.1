import { ZodError } from "zod";

import { personalStoryExperienceSnapshotSchema } from "@shared/schema/personalStory";

import {
  claimNextPersonalStoryUpdateJob,
  completePersonalStoryUpdateJob,
  failPersonalStoryUpdateJob,
  insertPersonalStoryChapterIfAbsent,
  recordPersonalStoryJobProgress,
} from "../repositories/personalStoryRepo";
import { generatePersonalStoryChapter } from "../services/personalStoryGenerationService";
import { getFeatureFlag } from "../lib/featureFlags";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 3_000;

let interval: ReturnType<typeof setInterval> | null = null;
let started = false;
let processing = false;

function errorCodeFor(error: unknown): string {
  if (error instanceof ZodError) return "invalid_source_snapshot";
  if (error instanceof Error && error.message === "PERSONAL_STORY_JOB_LEASE_LOST") {
    return "job_lease_lost";
  }
  if (error instanceof Error && error.message === "PERSONAL_STORY_NOVEL_NOT_FOUND") {
    return "novel_not_found";
  }
  if (
    error instanceof Error &&
    error.message === "PERSONAL_STORY_NO_EMBELLISHMENT_REJECTED"
  ) {
    return "no_embellishment_rejection";
  }
  if (
    error instanceof Error &&
    error.message === "PERSONAL_STORY_ALL_PROVIDERS_FAILED"
  ) {
    return "all_providers_failed";
  }
  if (
    error instanceof Error &&
    error.message === "PERSONAL_STORY_INVALID_MODEL_OUTPUT"
  ) {
    return "invalid_model_output";
  }
  return "chapter_processing_failed";
}

/**
 * Process at most one durable update job. Each source is committed as its own
 * append-only chapter before the cursor advances. A crash after the insert but
 * before cursor advancement is safe: the source uniqueness constraint turns
 * the replay into an idempotent read and processing continues from there.
 */
export async function processPersonalStoryJobOnce(): Promise<boolean> {
  try {
    if (!(await getFeatureFlag("personalStoryEnabled", false))) {
      return false;
    }
  } catch {
    logger.error("[PersonalStoryWorker] Feature flag resolution failed", {
      errorCode: "feature_flag_resolution_failed",
    });
    return false;
  }

  const job = await claimNextPersonalStoryUpdateJob();
  if (!job) return false;
  const leaseToken = job.leaseToken;
  if (!leaseToken) {
    logger.error("[PersonalStoryWorker] Claimed job missing fencing token", {
      jobId: job.id,
      errorCode: "job_lease_token_missing",
    });
    return true;
  }

  let generatedCount = job.generatedCount;
  try {
    const sources = job.sourceSnapshot.map((source) =>
      personalStoryExperienceSnapshotSchema.parse(source),
    );

    for (let index = job.nextSourceIndex; index < sources.length; index += 1) {
      const source = sources[index];
      const generated = await generatePersonalStoryChapter(source);
      await insertPersonalStoryChapterIfAbsent({
        jobId: job.id,
        leaseToken,
        novelId: job.novelId,
        userId: job.userId,
        source,
        title: generated.title,
        body: generated.body,
        keywordHash: generated.keywordHash,
        provider: generated.provider,
        model: generated.model,
        promptVersion: generated.promptVersion,
        fallbackUsed: generated.fallbackUsed,
      });

      generatedCount += 1;
      const retainedLease = await recordPersonalStoryJobProgress(
        job.id,
        job.userId,
        leaseToken,
        index + 1,
        generatedCount,
      );
      if (!retainedLease) throw new Error("PERSONAL_STORY_JOB_LEASE_LOST");
    }

    const completed = await completePersonalStoryUpdateJob(
      job.id,
      job.userId,
      leaseToken,
      generatedCount,
    );
    if (!completed) throw new Error("PERSONAL_STORY_JOB_LEASE_LOST");

    logger.info("[PersonalStoryWorker] Update completed", {
      jobId: job.id,
      generatedCount,
    });
  } catch (error) {
    const errorCode = errorCodeFor(error);
    const failureRecorded = await failPersonalStoryUpdateJob(
      job.id,
      job.userId,
      leaseToken,
      generatedCount,
      errorCode,
    );
    logger.error("[PersonalStoryWorker] Update failed", {
      jobId: job.id,
      generatedCount,
      errorCode,
      failureRecorded,
    });
  }

  return true;
}

async function tick(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    await processPersonalStoryJobOnce();
  } catch {
    // Missing rollout DDL or a transient database outage must not become an
    // unhandled interval rejection. The next tick retries after operators
    // restore the dependency; no source cursor was advanced.
    logger.error("[PersonalStoryWorker] Poll failed", {
      errorCode: "worker_poll_failed",
    });
  } finally {
    processing = false;
  }
}

export function startPersonalStoryWorker(): void {
  if (started) return;
  started = true;
  void tick();
  interval = setInterval(() => void tick(), POLL_INTERVAL_MS);
  interval.unref?.();
  logger.info("[PersonalStoryWorker] Started", { pollIntervalMs: POLL_INTERVAL_MS });
}

export function stopPersonalStoryWorker(): void {
  if (interval) clearInterval(interval);
  interval = null;
  started = false;
  logger.info("[PersonalStoryWorker] Stopped");
}

export function isPersonalStoryWorkerRunning(): boolean {
  return started;
}
