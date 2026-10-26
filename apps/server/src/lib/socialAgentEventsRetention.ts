import {
  deleteExpiredSocialAgentEvents,
  SOCIAL_AGENT_EVENTS_RETENTION_DEFAULT_BATCH_SIZE,
} from "../repositories/socialAgentEventsRepo";
import { logger } from "./logger";

/** Independent daily retention; never shares the 5-minute session TTL sweep. */
export const SOCIAL_AGENT_EVENTS_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const SOCIAL_AGENT_EVENTS_RETENTION_MAX_BATCHES_PER_RUN = 20;

interface RetentionLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface SocialAgentEventsRetentionDependencies {
  logger: RetentionLogger;
  now: () => Date;
  deleteBatch: (options: { now: Date; batchSize: number }) => Promise<number>;
  batchSize: number;
  maxBatchesPerRun: number;
  intervalMs: number;
}

export interface SocialAgentEventsRetentionRunResult {
  deletedCount: number;
  batchCount: number;
  /** True when the per-run cap was reached with a full final batch. */
  hasMore: boolean;
  /** Cleanup errors are observed and swallowed so traffic is never affected. */
  failed: boolean;
}

export function createSocialAgentEventsRetentionScheduler(
  dependencies: SocialAgentEventsRetentionDependencies = {
    logger,
    now: () => new Date(),
    deleteBatch: (options) => deleteExpiredSocialAgentEvents(options),
    batchSize: SOCIAL_AGENT_EVENTS_RETENTION_DEFAULT_BATCH_SIZE,
    maxBatchesPerRun: SOCIAL_AGENT_EVENTS_RETENTION_MAX_BATCHES_PER_RUN,
    intervalMs: SOCIAL_AGENT_EVENTS_RETENTION_INTERVAL_MS,
  },
) {
  let stopped = false;
  let running = false;
  let interval: NodeJS.Timeout | null = null;

  const run = async (): Promise<SocialAgentEventsRetentionRunResult | undefined> => {
    if (stopped || running) return undefined;
    running = true;

    // One fixed clock/cutoff for every batch in this run.
    const now = dependencies.now();
    let deletedCount = 0;
    let batchCount = 0;
    let lastBatchSize = 0;

    try {
      while (batchCount < dependencies.maxBatchesPerRun) {
        lastBatchSize = await dependencies.deleteBatch({
          now,
          batchSize: dependencies.batchSize,
        });
        batchCount += 1;
        deletedCount += lastBatchSize;
        if (lastBatchSize < dependencies.batchSize) break;
      }

      const hasMore =
        batchCount === dependencies.maxBatchesPerRun &&
        lastBatchSize === dependencies.batchSize;
      if (deletedCount > 0 || hasMore) {
        dependencies.logger.info("[SocialAgentEventsRetention] cleanup batch completed", {
          component: "social_agent_events_retention",
          runAt: now.toISOString(),
          deletedCount,
          batchCount,
          hasMore,
        });
      }
      return { deletedCount, batchCount, hasMore, failed: false };
    } catch (error) {
      // Retention is best-effort housekeeping. A missing relation, transient DB
      // failure, or partial batch must never block requests/session lifecycle.
      dependencies.logger.error(
        "[SocialAgentEventsRetention] cleanup failed; will retry next interval",
        {
          component: "social_agent_events_retention",
          failOpen: true,
          willRetryNextInterval: true,
          deletedCount,
          batchCount,
          error: error instanceof Error ? error.message : String(error),
          code: typeof (error as { code?: unknown })?.code === "string"
            ? (error as { code: string }).code
            : undefined,
        },
      );
      return {
        deletedCount,
        batchCount,
        hasMore: true,
        failed: true,
      };
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (interval) return;
      stopped = false;
      // Immediate catch-up is asynchronous and internally fail-open.
      void run();
      interval = setInterval(() => void run(), dependencies.intervalMs);
      interval.unref?.();
      dependencies.logger.info("[SocialAgentEventsRetention] scheduler started", {
        component: "social_agent_events_retention",
        intervalMs: dependencies.intervalMs,
        batchSize: dependencies.batchSize,
        maxBatchesPerRun: dependencies.maxBatchesPerRun,
      });
    },
    stop() {
      stopped = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
    runOnce: run,
    isStopped() {
      return stopped;
    },
  };
}

let singleton: ReturnType<typeof createSocialAgentEventsRetentionScheduler> | null = null;

export function startSocialAgentEventsRetentionScheduler(): void {
  if (singleton) return;
  singleton = createSocialAgentEventsRetentionScheduler();
  singleton.start();
}
