import { logger } from "../../lib/logger";
import type { Express } from "express";
import { db } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { matchingThresholds, poolMatchingLogs, eventPools, insertChatReportSchema, insertChatLogSchema } from "@shared/schema";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { notifyAbuseReport } from "../../lib/wecomNotifications";
import { MATCHING_THRESHOLD_FALLBACKS } from "../../lib/matchingThresholds";
import { users } from "@shared/schema";

export function registerMatchingAdminRoutes(app: Express): void {
  // ============ CHAT REPORTS & MODERATION ROUTES ============
  
  // POST /api/chat-reports - User creates a report
  app.post("/api/chat-reports", requireAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const validatedData = insertChatReportSchema.parse(req.body);
      
      const report = await storage.createChatReport(validatedData);
      
      // WeCom notification for abuse report (fire-and-forget)
      void (async () => {
        try {
          const [reportee] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, validatedData.reportedUserId));
          const [reporter] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, validatedData.reportedBy));
          const severity = validatedData.reportType === "hate_speech" || validatedData.reportType === "harassment" ? "high" as const : "medium" as const;
          await notifyAbuseReport({
            severity,
            reportCategory: validatedData.reportType,
            reportedUserDisplayName: reportee?.displayName || "未知用户",
            reporterPseudo: reporter?.displayName || "匿名用户",
            eventContext: validatedData.eventId || undefined,
            reportReasonSnippet: validatedData.description || "无描述",
            reportId: report.id,
          });
        } catch (notifyErr) {
          logger.warn("Failed to send abuse report WeCom notification", { error: String(notifyErr) });
        }
      })();
      
      res.json(report);
    } catch (error: any) {
      logger.error("Error creating chat report", { error: String(error) });
      res.status(400).json({ message: error.message || "Failed to create report" });
    }
  });

  // GET /api/admin/chat-reports - Admin gets all reports with optional status filter
  app.get("/api/admin/chat-reports", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      
      const reports = await storage.getChatReports(status as string | undefined);
      
      res.json(reports);
    } catch (error: any) {
      logger.error("Error fetching chat reports", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // GET /api/admin/chat-reports/:id - Admin gets single report with context
  app.get("/api/admin/chat-reports/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const session = req.session as any;
      const adminUserId = session.userId;
      
      const report = await storage.getChatReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Record moderation log for viewing the report
      await storage.createModerationLog({
        adminUserId,
        action: "view_report",
        targetType: "chat_report",
        targetId: id,
        details: { reportId: id, reportType: report.reportType },
      });
      
      res.json(report);
    } catch (error: any) {
      logger.error("Error fetching chat report", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // PATCH /api/admin/chat-reports/:id - Admin reviews/processes a report
  app.patch("/api/admin/chat-reports/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { id } = req.params;
      const session = req.session as any;
      const adminUserId = session.userId;
      
      const { status, reviewNotes, actionTaken } = req.body;
      
      if (!status || !["reviewed", "dismissed", "action_taken"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const report = await storage.updateChatReport(id, {
        status,
        reviewedBy: adminUserId,
        reviewNotes,
        actionTaken,
      });
      
      // Record moderation log
      await storage.createModerationLog({
        adminUserId,
        action: "review_report",
        targetType: "chat_report",
        targetId: id,
        details: { 
          reportId: id, 
          status, 
          actionTaken,
          reviewNotes: reviewNotes || null,
        },
      });
      
      res.json(report);
    } catch (error: any) {
      logger.error("Error updating chat report", { error: String(error) });
      res.status(400).json({ message: error.message || "Failed to update report" });
    }
  });

  // ============ INTERACTION LOGS ROUTES ============
  
  // POST /api/interaction-logs - Internal logging endpoint
  app.post("/api/interaction-logs", async (req, res) => {
    try {
      const validatedData = insertChatLogSchema.parse(req.body);
      
      const log = await storage.createInteractionLog(validatedData);
      
      res.json(log);
    } catch (error: any) {
      logger.error("Error creating interaction log", { error: String(error) });
      res.status(400).json({ message: error.message || "Failed to create log" });
    }
  });

  // GET /api/admin/interaction-logs - Admin queries logs with filters
  app.get("/api/admin/interaction-logs", requireAdmin, async (req, res) => {
    try {
      const { eventId, userId, severity, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (eventId) filters.eventId = eventId as string;
      if (userId) filters.userId = userId as string;
      if (severity) filters.severity = severity as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const logs = await storage.getInteractionLogs(filters);
      
      res.json(logs);
    } catch (error: any) {
      logger.error("Error fetching interaction logs", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // GET /api/admin/interaction-logs/stats - Admin gets log statistics
  app.get("/api/admin/interaction-logs/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getInteractionLogStats();
      
      res.json(stats);
    } catch (error: any) {
      logger.error("Error fetching interaction log stats", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ REALTIME MATCHING CONFIGURATION ROUTES ============
  const resolveMatchingThresholdCreatorId = (req: any): string => {
    return req.adminAccount?.id ?? req.session?.userId ?? "unknown";
  };
  const clampPercent = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : fallback;
  };
  const clampPredictiveRerankShift = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(2, Math.max(0, Math.round(parsed))) : fallback;
  };
  
  // GET /api/admin/matching-thresholds - Get current matching threshold config
  app.get("/api/admin/matching-thresholds", requireAdmin, async (req, res) => {
    try {
      const [activeConfig] = await db
        .select()
        .from(matchingThresholds)
        .where(eq(matchingThresholds.isActive, true))
        .limit(1);
      
      if (!activeConfig) {
        // Return default config if none exists (single source: lib/matchingThresholds)
        return res.json({ ...MATCHING_THRESHOLD_FALLBACKS });
      }
      
      res.json(activeConfig);
    } catch (error: any) {
      logger.error("Error fetching matching thresholds", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch thresholds" });
    }
  });
  
  // PUT /api/admin/matching-thresholds - Update matching threshold config
  app.put("/api/admin/matching-thresholds", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const userId = resolveMatchingThresholdCreatorId(req);
      
      // Deactivate current config
      await db
        .update(matchingThresholds)
        .set({ isActive: false })
        .where(eq(matchingThresholds.isActive, true));
      
      // Create new config
      const [newConfig] = await db
        .insert(matchingThresholds)
        .values({
          highCompatibilityThreshold: req.body.highCompatibilityThreshold || MATCHING_THRESHOLD_FALLBACKS.highCompatibilityThreshold,
          mediumCompatibilityThreshold: req.body.mediumCompatibilityThreshold || MATCHING_THRESHOLD_FALLBACKS.mediumCompatibilityThreshold,
          lowCompatibilityThreshold: req.body.lowCompatibilityThreshold || MATCHING_THRESHOLD_FALLBACKS.lowCompatibilityThreshold,
          timeDecayEnabled: req.body.timeDecayEnabled ?? true,
          timeDecayRate: req.body.timeDecayRate || 5,
          minThresholdAfterDecay: req.body.minThresholdAfterDecay || 50,
          minGroupSizeForMatch: req.body.minGroupSizeForMatch || 4,
          optimalGroupSize: req.body.optimalGroupSize || 6,
          scanIntervalMinutes: req.body.scanIntervalMinutes || 60,
          predictiveRerankEnabled: req.body.predictiveRerankEnabled ?? false,
          predictiveRerankExposurePercent: clampPercent(req.body.predictiveRerankExposurePercent, 50),
          predictiveRerankMaxPositionShift: clampPredictiveRerankShift(req.body.predictiveRerankMaxPositionShift, 2),
          predictiveRerankConfidenceThreshold: clampPercent(req.body.predictiveRerankConfidenceThreshold, 70),
          predictiveRerankAutoDisableEnabled: req.body.predictiveRerankAutoDisableEnabled ?? true,
          predictiveRerankMinShadowExperiments: req.body.predictiveRerankMinShadowExperiments ?? 10,
          predictiveRerankAutoDisabledAt: null,
          predictiveRerankAutoDisabledReason: null,
          isActive: true,
          createdBy: userId,
          notes: req.body.notes || null,
        })
        .returning();
      
      res.json(newConfig);
    } catch (error: any) {
      logger.error("Error updating matching thresholds", { error: String(error) });
      res.status(500).json({ message: "Failed to update thresholds" });
    }
  });
  
  // GET /api/admin/matching-logs - Get matching scan logs with filters
  app.get("/api/admin/matching-logs", requireAdmin, async (req, res) => {
    try {
      const { poolId, scanType, decision, limit = 50 } = req.query;
      
      let query = db.select().from(poolMatchingLogs);
      
      const conditions: any[] = [];
      if (poolId) conditions.push(eq(poolMatchingLogs.poolId, poolId as string));
      if (scanType) conditions.push(eq(poolMatchingLogs.scanType, scanType as string));
      if (decision) conditions.push(eq(poolMatchingLogs.decision, decision as string));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const logs = await query
        .orderBy(desc(poolMatchingLogs.createdAt))
        .limit(parseInt(limit as string));
      
      // Enrich with pool titles
      const enrichedLogs = await Promise.all(
        logs.map(async (log: any) => {
          const [pool] = await db
            .select({ title: eventPools.title })
            .from(eventPools)
            .where(eq(eventPools.id, log.poolId))
            .limit(1);
          
          return {
            ...log,
            poolTitle: pool?.title || "未知活动池",
          };
        })
      );
      
      res.json(enrichedLogs);
    } catch (error: any) {
      logger.error("Error fetching matching logs", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });
  
  // POST /api/admin/pools/:id/scan - Manually trigger pool scan
  app.post("/api/admin/pools/:id/scan", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const poolId = req.params.id;
      const { scanPoolAndMatch } = await import("../../poolRealtimeMatchingService");
      
      const result = await scanPoolAndMatch(poolId, "manual", "admin_manual");
      
      res.json(result);
    } catch (error: any) {
      logger.error("Error triggering pool scan", { error: String(error) });
      res.status(500).json({ message: "Failed to trigger scan", error: error.message });
    }
  });
}
