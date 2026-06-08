import type { Express } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger";
import { notifyErrorSpike } from "../../lib/wecomNotifications";

const errorSpikeSchema = z.object({
  businessImpact: z.string().min(1),
  affectedUserCount: z.number().int().min(0),
  endpointName: z.string().min(1),
  errorRate: z.number().min(0).max(100),
  sampleCount: z.number().int().min(0),
  firstSeenAt: z.string().min(1),
  durationMinutes: z.number().int().min(0),
  serviceName: z.string().min(1),
  actionGuide: z.string().min(1),
  secret: z.string().min(1),
});

const WEBHOOK_SECRET = process.env.MONITORING_WEBHOOK_SECRET || "";

export function registerMonitoringWebhookRoutes(app: Express): void {
  app.post("/api/monitoring/error-spike", async (req, res) => {
    try {
      const parsed = errorSpikeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });
      }

      const { secret, ...payload } = parsed.data;

      if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
        return res.status(401).json({ message: "Invalid secret" });
      }

      await notifyErrorSpike({
        ...payload,
        businessImpact: payload.businessImpact,
        affectedUserCount: payload.affectedUserCount,
        endpointName: payload.endpointName,
        errorRate: payload.errorRate,
        sampleCount: payload.sampleCount,
        firstSeenAt: payload.firstSeenAt,
        durationMinutes: payload.durationMinutes,
        serviceName: payload.serviceName,
        actionGuide: payload.actionGuide,
      });

      res.json({ ok: true });
    } catch (error) {
      logger.error("Error processing error-spike webhook", { error: String(error) });
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });
}
