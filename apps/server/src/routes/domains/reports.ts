import type { Express } from "express";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { reports, users } from "@shared/schema";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { createRateLimiter } from "../../rateLimiter";
import { validateContentSafeAsync } from "../../lib/contentSafety";
import { recordViolation } from "../../abuseDetection";
import { logger } from "../../lib/logger";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import {
  AI_CONTENT_REPORT_CATEGORY,
  createReportRequestSchema,
  aiContentReportListQuerySchema,
} from "@shared/api";

/**
 * Reports domain router.
 *
 * Exposes:
 *   POST  /api/reports                      — authenticated users submit reports
 *   GET   /api/admin/reports/ai-content     — operator/super_admin list AI-content reports
 *   PATCH /api/admin/reports/ai-content/:id — operator/super_admin resolve/dismiss
 */

const reviewAiContentReportSchema = z.object({
  action: z.enum(["resolved", "dismissed"]),
  note: z.string().trim().max(2000).optional(),
});

const reportSubmissionLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5, // 5 reports per user per window
  keyPrefix: "report",
});

export function registerReportRoutes(app: Express): void {
  app.post("/api/reports", requireAuth, reportSubmissionLimiter, async (req, res) => {
    try {
      const parsed = createReportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid report body",
          errors: parsed.error.format(),
        });
      }

      const { category, description, relatedEventId, reportedUserId } = parsed.data;

      const userId = req.session.userId as string;

      const safety = await validateContentSafeAsync(description, "reportDescription", { userId });
      if (!safety.safe) {
        await recordViolation(userId, safety.violation!.type, safety.violation!.severity);
        return res.status(400).json({
          message: safety.violation?.message ?? "内容包含不当用语，请修改后重试",
          code: "CONTENT_VIOLATION",
          violation: safety.violation,
        });
      }

      const [report] = await db
        .insert(reports)
        .values({
          reporterId: userId,
          category,
          description,
          relatedEventId: relatedEventId ?? null,
          reportedUserId: reportedUserId ?? null,
          status: "pending",
        })
        .returning();

      logger.info("[Reports] created", {
        reportId: report.id,
        category,
        userId,
      });

      return res.status(201).json({
        id: report.id,
        category: report.category,
        status: report.status,
      });
    } catch (error) {
      logger.error("[Reports] create failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to create report" });
    }
  });

  app.get("/api/admin/reports/ai-content", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const query = aiContentReportListQuerySchema.parse(req.query);
      const { status, page, pageSize } = query;

      const conditions = [eq(reports.category, AI_CONTENT_REPORT_CATEGORY)];
      if (status) {
        conditions.push(eq(reports.status, status));
      }
      const whereClause = and(...conditions);

      const offset = (page - 1) * pageSize;

      const [rows, countResult] = await Promise.all([
        db
          .select({
            report: reports,
            reporterDisplayName: users.displayName,
            reporterWechatNickname: users.wechatNickname,
          })
          .from(reports)
          .leftJoin(users, eq(reports.reporterId, users.id))
          .where(whereClause)
          .orderBy(desc(reports.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql`count(*)::int`.as("count") })
          .from(reports)
          .where(whereClause),
      ]);

      const total = (countResult[0]?.count as number) ?? 0;

      type AIContentReportRow = {
        report: typeof reports.$inferSelect;
        reporterDisplayName: string | null;
        reporterWechatNickname: string | null;
      };

      return res.json({
        reports: rows.map((r: AIContentReportRow) => ({
          ...r.report,
          reporterDisplayName: r.reporterDisplayName,
          reporterWechatNickname: r.reporterWechatNickname,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: error.format(),
        });
      }
      logger.error("[AdminReports] ai-content list failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to load AI-content reports" });
    }
  });

  app.patch("/api/admin/reports/ai-content/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = reviewAiContentReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid review payload",
          errors: parsed.error.issues,
        });
      }
      const { action, note } = parsed.data;

      const [report] = await db
        .select()
        .from(reports)
        .where(and(eq(reports.id, req.params.id), eq(reports.category, AI_CONTENT_REPORT_CATEGORY)))
        .limit(1);

      if (!report) {
        return res.status(404).json({ message: "AI-content report not found" });
      }

      // Idempotent: already in the requested terminal state.
      if (report.status === action) {
        return res.json({ ...report, alreadyReviewed: true });
      }

      // reviewedBy FK → users.id. RBAC admin sessions carry adminAccountId
      // (not a users.id), so only persist a reviewer when the acting session
      // is a legacy user-backed admin; the RBAC identity is always captured
      // in the audit record below.
      const sessionUserId = (req.session as any)?.userId ?? null;

      const [updated] = await db
        .update(reports)
        .set({
          status: action,
          reviewedBy: sessionUserId,
          reviewedAt: new Date(),
          resolution: note ?? null,
        })
        .where(
          and(
            eq(reports.id, report.id),
            // NULL-safe concurrent-update guard: legacy rows can carry a
            // SQL NULL status, which `eq(status, 'pending')` never matches
            // (NULL = 'pending' is UNKNOWN) → permanent 409. IS NOT DISTINCT
            // FROM treats NULL = NULL as equal.
            sql`${reports.status} is not distinct from ${report.status ?? "pending"}`,
          ),
        )
        .returning();

      if (!updated) {
        return res.status(409).json({ message: "Report was updated concurrently — refresh and retry" });
      }

      logAdminAudit({
        action: "AI_CONTENT_REPORT_REVIEWED",
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: "report",
        targetEntityId: report.id,
        before: { status: report.status },
        after: { status: action },
        context: { category: AI_CONTENT_REPORT_CATEGORY, note: note ?? null },
      });

      logger.info("[AdminReports] ai-content report reviewed", {
        reportId: report.id,
        action,
        adminId: getActingAdminId(req),
      });

      return res.json(updated);
    } catch (error) {
      logger.error("[AdminReports] ai-content review failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to review AI-content report" });
    }
  });
}
