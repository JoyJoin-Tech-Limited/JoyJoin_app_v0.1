import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { getFeatureFlag } from "../../lib/featureFlags";
import { renderShareClipMp4 } from "../../lib/shareClipRenderer";
import { shareClipLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";

/**
 * Phase 3 / B3 (2026-08-01): animated share clip route.
 *
 * POST /api/personality/share-clip
 * Body: { archetype, archetypeNameCn, displayName?, blendLine?, archetypeImageUrl? }
 * Returns: video/mp4 bytes (short muted looping clip of the reveal moment).
 *
 * Feature-flagged via `shareAnimatedClipEnabled` (default false). ffmpeg is a
 * hard dependency at runtime; a missing binary maps to 503 so the client
 * falls back to the static poster.
 */

const shareClipSchema = z.object({
  archetype: z.string().min(1).max(32),
  archetypeNameCn: z.string().min(1).max(12),
  displayName: z.string().max(24).optional(),
  blendLine: z.string().max(48).optional(),
  archetypeImageUrl: z.string().url().max(512).optional(),
});

export function registerShareClipRoutes(app: Express): void {
  app.post(
    "/api/personality/share-clip",
    requireAuth,
    shareClipLimiter,
    async (req: any, res) => {
      try {
        const enabled = await getFeatureFlag("shareAnimatedClipEnabled", false);
        if (!enabled) {
          return res.status(503).json({ message: "Animated share clip is disabled" });
        }

        const parsed = shareClipSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Invalid share clip request", errors: parsed.error.format() });
        }

        // SSRF guard: only allow archetype art from our own CDN origin.
        const imageUrl = parsed.data.archetypeImageUrl;
        if (imageUrl && !imageUrl.startsWith("https://joyjoinapp.com/static/")) {
          return res.status(400).json({ message: "archetypeImageUrl must be a JoyJoin CDN URL" });
        }

        const mp4 = await renderShareClipMp4(parsed.data);

        logger.info("[ShareClip] rendered animated share clip", {
          userId: req.user?.id,
          archetype: parsed.data.archetype,
          bytes: mp4.length,
        });

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", String(mp4.length));
        res.setHeader("Cache-Control", "private, no-store");
        return res.send(mp4);
      } catch (error) {
        logger.error("[ShareClip] render failed", { error: String(error) });
        return res.status(503).json({ message: "Animated share clip unavailable" });
      }
    },
  );
}
