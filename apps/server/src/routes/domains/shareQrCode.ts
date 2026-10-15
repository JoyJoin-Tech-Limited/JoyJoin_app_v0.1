import type { Express } from "express";
import { requireAuth } from "../../middleware/auth";
import { getFeatureFlag } from "../../lib/featureFlags";
import { getOrCreateUserReferralCode } from "../../lib/referralCode";
import { getShareQrCodeImage } from "../../lib/wechatShareQrCode";
import { shareQrCodeLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";

/**
 * Share poster mini-program code (2026-10-14).
 *
 * POST /api/personality/share-qrcode
 * Returns: image/png bytes — a wxacode.getUnlimited code carrying the
 * caller's referral code in `scene` (`ic=<code>`), landing on the
 * personality-test intro page. The mini-program draws it into the share
 * poster's CTA band; friends long-press the received image to jump straight
 * into the test, and the scene code feeds the existing
 * pendingReferralCode → login-with-test attribution pipeline.
 *
 * Fail-open contract: flag off, missing WeChat config, or any WeChat
 * failure → 503, and the client renders a copy-only CTA band instead.
 * Guests are rejected by requireAuth and get the same copy-only band.
 */
export function registerShareQrCodeRoutes(app: Express): void {
  app.post(
    "/api/personality/share-qrcode",
    requireAuth,
    shareQrCodeLimiter,
    async (req: any, res) => {
      try {
        const enabled = await getFeatureFlag("shareQrCodeEnabled", true);
        if (!enabled) {
          return res.status(503).json({ message: "Share QR code is disabled" });
        }

        const userId = req.session?.userId;
        if (!userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const referralCode = await getOrCreateUserReferralCode(userId);
        const qr = await getShareQrCodeImage(referralCode);
        if (!qr) {
          return res.status(503).json({ message: "Share QR code unavailable" });
        }

        logger.info("[ShareQrCode] served mini-program code", {
          userId,
          cacheHit: qr.cacheHit,
          bytes: qr.bytes.length,
        });

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", String(qr.bytes.length));
        res.setHeader("Cache-Control", "private, no-store");
        return res.send(qr.bytes);
      } catch (error) {
        logger.error("[ShareQrCode] request failed", { error: String(error) });
        return res.status(503).json({ message: "Share QR code unavailable" });
      }
    },
  );
}
