import type { Express } from "express";
import { getFeatureFlag } from "../../lib/featureFlags";
import { logger } from "../../lib/logger";

/**
 * Public, auth-free feature flags for the anonymous onboarding surface.
 *
 * Only flags that are safe to disclose to an unauthenticated client belong
 * here. Each value is a boolean; no user, cohort, or internal state leaks.
 */
const PUBLIC_FLAG_KEYS = ["onboardingLoginTimingExperiment"] as const;

export function registerPublicConfigRoutes(app: Express): void {
  app.get("/api/public/features", async (_req, res) => {
    try {
      const entries = await Promise.all(
        PUBLIC_FLAG_KEYS.map(async (key) => [key, await getFeatureFlag(key, false)] as const),
      );
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(Object.fromEntries(entries));
    } catch (error) {
      logger.warn("Public feature flag lookup failed; failing closed", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ onboardingLoginTimingExperiment: false });
    }
  });
}
