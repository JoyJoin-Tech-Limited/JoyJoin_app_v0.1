import { logger } from './logger';
import { sweepExpiredSessions } from './socialIcebreakerStore';

export const SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * W8 (AC-W8.2): a transient sweep failure (e.g. a momentary pooler hiccup) must
 * not permanently disable housekeeping. The scheduler retries with exponential
 * backoff (capped) and only stops on an explicit `stop()`. Every failure is
 * logged fail-open so the API process is never taken down by the sweep.
 */
export const SWEEP_RETRY_BASE_DELAY_MS = 30_000;
export const SWEEP_RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

interface SweepLogger {
  info(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
}

interface SocialIcebreakerSweepDependencies {
  logger: SweepLogger;
  sweepExpiredSessions: () => Promise<void>;
}

function getSweepErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: unknown; cause?: { code?: unknown } };

    return {
      error: error.message,
      code: typeof errorWithCode.code === 'string' ? errorWithCode.code : undefined,
      causeCode: typeof errorWithCode.cause?.code === 'string' ? errorWithCode.cause.code : undefined,
    };
  }

  return {
    error: String(error),
  };
}

/** Exponential backoff (30s, 60s, 2m, 4m, then capped at 5m). */
export function sweepRetryDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return SWEEP_RETRY_BASE_DELAY_MS;
  const delay = SWEEP_RETRY_BASE_DELAY_MS * 2 ** (consecutiveFailures - 1);
  return Math.min(delay, SWEEP_RETRY_MAX_DELAY_MS);
}

export function createSocialIcebreakerSweepScheduler(
  dependencies: SocialIcebreakerSweepDependencies = {
    logger,
    sweepExpiredSessions,
  },
) {
  let stopped = false;
  let interval: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let consecutiveFailures = 0;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = (delayMs: number) => {
    if (stopped) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void run();
    }, delayMs);
    retryTimer.unref?.();
  };

  const run = async () => {
    if (stopped) {
      return;
    }

    try {
      await dependencies.sweepExpiredSessions();
      if (consecutiveFailures > 0) {
        dependencies.logger.info('Social icebreaker TTL sweep recovered after failure', {
          component: 'social_icebreaker_ttl_sweep',
          previousConsecutiveFailures: consecutiveFailures,
        });
      }
      consecutiveFailures = 0;
    } catch (error) {
      // W8 (AC-W8.2): NEVER disable on failure — retry with backoff. Only an
      // explicit stop() halts housekeeping for good.
      consecutiveFailures += 1;
      const retryInMs = sweepRetryDelayMs(consecutiveFailures);
      dependencies.logger.error('Social icebreaker TTL sweep failed; retrying with backoff', {
        component: 'social_icebreaker_ttl_sweep',
        failOpen: true,
        disableFutureSweeps: false,
        consecutiveFailures,
        retryInMs,
        ...getSweepErrorContext(error),
      });
      scheduleRetry(retryInMs);
    }
  };

  return {
    start() {
      stopped = false;
      interval = setInterval(() => {
        void run();
      }, SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);
      interval.unref?.();
      return interval;
    },
    stop() {
      stopped = true;
      consecutiveFailures = 0;
      clear();
    },
    run,
    /** True only after `stop()` — a transient failure no longer disables the sweep. */
    isDisabled() {
      return stopped;
    },
    /** Number of consecutive failed sweeps (0 after a recovery). */
    getConsecutiveFailures() {
      return consecutiveFailures;
    },
  };
}

export function startSocialIcebreakerSweep(): NodeJS.Timeout {
  return createSocialIcebreakerSweepScheduler().start();
}
