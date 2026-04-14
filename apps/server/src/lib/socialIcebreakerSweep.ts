import { logger } from './logger';
import { sweepExpiredSessions } from './socialIcebreakerStore';

export const SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface SweepLogger {
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

export function createSocialIcebreakerSweepScheduler(
  dependencies: SocialIcebreakerSweepDependencies = {
    logger,
    sweepExpiredSessions,
  },
) {
  let disabled = false;
  let interval: NodeJS.Timeout | null = null;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const disableAfterFailure = (error: unknown) => {
    if (disabled) {
      return;
    }

    disabled = true;
    clear();
    dependencies.logger.error('Disabled social icebreaker TTL sweep after failure', {
      component: 'social_icebreaker_ttl_sweep',
      failOpen: true,
      disableFutureSweeps: true,
      ...getSweepErrorContext(error),
    });
  };

  const run = async () => {
    if (disabled) {
      return;
    }

    try {
      await dependencies.sweepExpiredSessions();
    } catch (error) {
      disableAfterFailure(error);
    }
  };

  return {
    start() {
      interval = setInterval(() => {
        void run();
      }, SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);
      interval.unref?.();
      return interval;
    },
    stop() {
      disabled = true;
      clear();
    },
    run,
    isDisabled() {
      return disabled;
    },
  };
}

export function startSocialIcebreakerSweep(): NodeJS.Timeout {
  return createSocialIcebreakerSweepScheduler().start();
}