import { logger } from "../../lib/logger";
import type { Express } from "express";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { storage } from "../../storage";
import { validateContentSafe, contentViolationResponse } from "../../lib/contentSafety";
import { db } from "../../db";
import { contentFilterLogs, users } from "@shared/schema";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { contentFilterLogReviewSchema, ContentFilterReviewStatuses } from "@shared/api";

export function registerAdminOperationsRoutes(app: Express): void {
  // ============ ADMIN FEEDBACK MANAGEMENT ============

  // Get all feedbacks with filters
  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const { eventId, minRating, maxRating, startDate, endDate, hasDeepFeedback } = req.query;
      
      const filters: any = {};
      if (eventId) filters.eventId = eventId as string;
      if (minRating) filters.minRating = parseInt(minRating as string);
      if (maxRating) filters.maxRating = parseInt(maxRating as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (hasDeepFeedback !== undefined) filters.hasDeepFeedback = hasDeepFeedback === 'true';
      
      const feedbacks = await storage.getAllFeedbacks(filters);
      res.json(feedbacks);
    } catch (error) {
      logger.error("Error fetching feedbacks", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch feedbacks" });
    }
  });

  // Get feedback stats
  app.get("/api/admin/feedback/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getFeedbackStats();
      res.json(stats);
    } catch (error) {
      logger.error("Error fetching feedback stats", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  // Get single feedback by ID
  app.get("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const feedback = await storage.getFeedbackById(id);
      
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      
      res.json(feedback);
    } catch (error) {
      logger.error("Error fetching feedback", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ============ CONTENT MANAGEMENT ============

  // Get all contents (with optional type filter)
  app.get("/api/admin/contents", requireAdmin, async (req, res) => {
    try {
      const { type } = req.query;
      const contents = await storage.getAllContents(type as string | undefined);
      res.json(contents);
    } catch (error) {
      logger.error("Error fetching contents", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch contents" });
    }
  });

  // Get single content
  app.get("/api/admin/contents/:id", requireAdmin, async (req, res) => {
    try {
      const content = await storage.getContent(req.params.id);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      logger.error("Error fetching content", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  // Create content
  app.post("/api/admin/contents", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const session = req.session as any;
      const content = await storage.createContent({
        ...req.body,
        createdBy: session.userId,
      });
      res.json(content);
    } catch (error) {
      logger.error("Error creating content", { error: String(error) });
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  // Update content
  app.patch("/api/admin/contents/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const content = await storage.updateContent(req.params.id, req.body);
      res.json(content);
    } catch (error) {
      logger.error("Error updating content", { error: String(error) });
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  // Delete content
  app.delete("/api/admin/contents/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteContent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error("Error deleting content", { error: String(error) });
      res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // Publish content (update status to published and set published_at)
  app.post("/api/admin/contents/:id/publish", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      const { sendNotification } = req.body;

      const content = await storage.updateContent(req.params.id, {
        status: 'published',
        publishedAt: new Date(),
      });

      // If sendNotification is true and content type is announcement, send notification to all users
      if (sendNotification && content.type === 'announcement') {
        const users = await storage.getAllUsers();
        const userIds = users.map(u => u.id);
        
        if (userIds.length > 0) {
          await storage.createBroadcastNotification({
            sentBy: adminId,
            category: 'discover',
            type: 'admin_announcement',
            title: content.title,
            message: content.content?.substring(0, 100), // Limit to 100 characters
            userIds,
          });
        }
      }

      res.json(content);
    } catch (error) {
      logger.error("Error publishing content", { error: String(error) });
      res.status(500).json({ message: "Failed to publish content" });
    }
  });

  // Get published contents (public endpoint for users)
  app.get("/api/contents/:type", async (req, res) => {
    try {
      const contents = await storage.getPublishedContents(req.params.type);
      res.json(contents);
    } catch (error) {
      logger.error("Error fetching published contents", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch contents" });
    }
  });

  // ============ ADMIN NOTIFICATION MANAGEMENT ============

  // Get admin notification history
  app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const notifications = await storage.getAdminNotifications(adminId);
      res.json({ notifications });
    } catch (error) {
      logger.error("Error fetching admin notifications", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Broadcast notification to multiple users
  app.post("/api/admin/notifications/broadcast", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const { category, type, title, message, userIds } = req.body;
      
      if (!category || !type || !title || !userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Content safety gate for admin-authored notification text
      for (const [field, value] of Object.entries({ title, message })) {
        if (typeof value === 'string' && value.trim().length > 0) {
          const safetyResult = validateContentSafe(value, field);
          if (!safetyResult.safe) {
            return res.status(400).json({
              ...contentViolationResponse(safetyResult.violation!).body,
              adminOverride: true,
            });
          }
        }
      }

      const result = await storage.createBroadcastNotification({
        sentBy: adminId,
        category,
        type,
        title,
        message,
        userIds,
      });
      
      res.json({ success: true, sent: result.sent });
    } catch (error) {
      logger.error("Error broadcasting notification", { error: String(error) });
      res.status(500).json({ message: "Failed to broadcast notification" });
    }
  });

  // Send notification to a single user
  app.post("/api/admin/notifications/send", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const { userId, category, type, title, message } = req.body;
      
      if (!userId || !category || !type || !title) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Content safety gate for admin-authored notification text
      for (const [field, value] of Object.entries({ title, message })) {
        if (typeof value === 'string' && value.trim().length > 0) {
          const safetyResult = validateContentSafe(value, field);
          if (!safetyResult.safe) {
            return res.status(400).json({
              ...contentViolationResponse(safetyResult.violation!).body,
              adminOverride: true,
            });
          }
        }
      }

      const result = await storage.createBroadcastNotification({
        sentBy: adminId,
        category,
        type,
        title,
        message,
        userIds: [userId],
      });
      
      res.json({ success: true, sent: result.sent });
    } catch (error) {
      logger.error("Error sending notification", { error: String(error) });
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Get notification stats
  app.get("/api/admin/notifications/:id/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getNotificationStats(req.params.id);
      res.json(stats);
    } catch (error) {
      logger.error("Error fetching notification stats", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ─── Content filter logs ───────────────────────────────────────────

  app.get("/api/admin/content-filter/logs", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const {
        userId,
        violationType,
        severity,
        field,
        reviewStatus,
        missFlag,
        from,
        to,
        page = '1',
        pageSize = '20',
      } = req.query as Record<string, string | undefined>;

      const conditions = [];
      if (userId) conditions.push(eq(contentFilterLogs.userId, userId));
      if (violationType) conditions.push(eq(contentFilterLogs.violationType, violationType));
      if (severity) conditions.push(eq(contentFilterLogs.severity, severity));
      if (field) conditions.push(eq(contentFilterLogs.field, field));
      if (reviewStatus) {
        // Validate against the shared union (single source of truth for allowed values)
        if (!(ContentFilterReviewStatuses as readonly string[]).includes(reviewStatus)) {
          return res.status(400).json({ message: "Invalid reviewStatus filter" });
        }
        conditions.push(eq(contentFilterLogs.reviewStatus, reviewStatus));
      }
      if (missFlag !== undefined) {
        if (missFlag !== 'true' && missFlag !== 'false') {
          return res.status(400).json({ message: "Invalid missFlag filter (expected 'true' or 'false')" });
        }
        conditions.push(eq(contentFilterLogs.missFlag, missFlag === 'true'));
      }
      if (from) conditions.push(gte(contentFilterLogs.createdAt, new Date(from)));
      if (to) conditions.push(lte(contentFilterLogs.createdAt, new Date(to)));

      const limit = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

      // Reviewer displayName needs an aliased users join — a second plain
      // leftJoin(users, ...) throws `Alias "users" is already used in this query`.
      const reviewer = alias(users, "reviewer");

      const [rows, countResult] = await Promise.all([
        db.select({
          id: contentFilterLogs.id,
          userId: contentFilterLogs.userId,
          displayName: users.displayName,
          field: contentFilterLogs.field,
          violationType: contentFilterLogs.violationType,
          severity: contentFilterLogs.severity,
          matchedKeywords: contentFilterLogs.matchedKeywords,
          inputPreview: contentFilterLogs.inputPreview,
          source: contentFilterLogs.source,
          createdAt: contentFilterLogs.createdAt,
          reviewStatus: contentFilterLogs.reviewStatus,
          reviewedBy: contentFilterLogs.reviewedBy,
          reviewedAt: contentFilterLogs.reviewedAt,
          missFlag: contentFilterLogs.missFlag,
          reviewNote: contentFilterLogs.reviewNote,
          reviewedByDisplayName: reviewer.displayName,
        })
        .from(contentFilterLogs)
        .leftJoin(users, eq(contentFilterLogs.userId, users.id))
        .leftJoin(reviewer, eq(contentFilterLogs.reviewedBy, reviewer.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(contentFilterLogs.createdAt))
        .limit(limit)
        .offset(offset),
        db.select({ count: sql<number>`count(*)` })
        .from(contentFilterLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
      ]);

      res.json({
        rows,
        total: countResult[0]?.count ?? 0,
        page: Math.max(parseInt(page, 10) || 1, 1),
        pageSize: limit,
      });
    } catch (error) {
      logger.error("Error fetching content filter logs", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch content filter logs" });
    }
  });

  // PATCH /api/admin/content-filter/logs/:id — moderation review overlay (S2)
  // Operator+ only. Effective changes are audit-logged with before/after
  // snapshots; identical repeat PATCH is a true no-op (changed:false, no audit).
  app.patch("/api/admin/content-filter/logs/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const id = req.params.id;

      const parsed = contentFilterLogReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid review payload",
          details: parsed.error.flatten(),
        });
      }
      const { reviewStatus, missFlag, note } = parsed.data;
      const noteValue = (note ?? "").trim();

      // Fetch current row (minimal shape for comparison + audit before-state)
      const [existing] = await db
        .select({
          id: contentFilterLogs.id,
          reviewStatus: contentFilterLogs.reviewStatus,
          missFlag: contentFilterLogs.missFlag,
          reviewNote: contentFilterLogs.reviewNote,
        })
        .from(contentFilterLogs)
        .where(eq(contentFilterLogs.id, id));

      if (!existing) {
        return res.status(404).json({ message: "Content filter log not found" });
      }

      const nextStatus = reviewStatus ?? existing.reviewStatus;
      const nextMiss = missFlag ?? existing.missFlag;
      // Effective change = status change, missFlag toggle, or a NEW non-empty
      // note (a repeat PATCH with the same stored note is a true no-op — AC5).
      const effective =
        nextStatus !== existing.reviewStatus ||
        nextMiss !== existing.missFlag ||
        (noteValue.length > 0 && noteValue !== (existing.reviewNote ?? ""));

      if (effective) {
        await db
          .update(contentFilterLogs)
          .set({
            reviewStatus: nextStatus,
            missFlag: nextMiss,
            // Note replaces prior note only when a new one is provided;
            // status-only changes keep the existing rationale.
            reviewNote: noteValue.length > 0 ? noteValue : existing.reviewNote,
            reviewedBy: getActingAdminId(req),
            reviewedAt: new Date(),
          })
          .where(eq(contentFilterLogs.id, id));

        logAdminAudit({
          action: 'CONTENT_FILTER_LOG_REVIEWED',
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: 'content_filter_log',
          targetEntityId: id,
          before: { reviewStatus: existing.reviewStatus, missFlag: existing.missFlag },
          after: { reviewStatus: nextStatus, missFlag: nextMiss },
          context: noteValue.length > 0 ? { note: noteValue } : undefined,
        });
      }

      // Full row snapshot for the response (same shape as the GET rows).
      const reviewer = alias(users, "reviewer");
      const [row] = await db
        .select({
          id: contentFilterLogs.id,
          userId: contentFilterLogs.userId,
          displayName: users.displayName,
          field: contentFilterLogs.field,
          violationType: contentFilterLogs.violationType,
          severity: contentFilterLogs.severity,
          matchedKeywords: contentFilterLogs.matchedKeywords,
          inputPreview: contentFilterLogs.inputPreview,
          source: contentFilterLogs.source,
          createdAt: contentFilterLogs.createdAt,
          reviewStatus: contentFilterLogs.reviewStatus,
          reviewedBy: contentFilterLogs.reviewedBy,
          reviewedAt: contentFilterLogs.reviewedAt,
          missFlag: contentFilterLogs.missFlag,
          reviewNote: contentFilterLogs.reviewNote,
          reviewedByDisplayName: reviewer.displayName,
        })
        .from(contentFilterLogs)
        .leftJoin(users, eq(contentFilterLogs.userId, users.id))
        .leftJoin(reviewer, eq(contentFilterLogs.reviewedBy, reviewer.id))
        .where(eq(contentFilterLogs.id, id));

      res.json({ changed: effective, row });
    } catch (error) {
      logger.error("Error reviewing content filter log", { error: String(error) });
      res.status(500).json({ message: "Failed to review content filter log" });
    }
  });
}
