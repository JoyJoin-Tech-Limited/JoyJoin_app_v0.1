import { type ChatMessage, chatMessages, chatReports, type ChatReport, type InsertChatReport, type User, users } from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";

export interface ModerationRepository {
  getModerationStats(): Promise<any>;
  getAllReports(): Promise<any[]>;
  getPendingReports(): Promise<any[]>;
  updateReportStatus(id: string, status: string, adminNotes?: string): Promise<any>;
  createModerationLog(data: any): Promise<any>;
  getModerationLogs(): Promise<any[]>;
  createChatReport(data: InsertChatReport): Promise<ChatReport>;
  getChatReports(status?: string): Promise<Array<ChatReport & { reporter: User; reportedUser: User; message: ChatMessage }>>;
  getChatReport(id: string): Promise<(ChatReport & { reporter: User; reportedUser: User; message: ChatMessage }) | undefined>;
  updateChatReport(
    id: string,
    updates: { status?: string; reviewedBy?: string; reviewNotes?: string; actionTaken?: string },
  ): Promise<ChatReport>;
}

export const moderationRepo: ModerationRepository = {
  async getModerationStats(): Promise<any> {
    const totalReports = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM reports
    `);

    const pendingReports = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM reports WHERE status = 'pending'
    `);

    const resolvedReports = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM reports WHERE status = 'resolved'
    `);

    const bannedUsers = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM users WHERE is_banned = true
    `);

    return {
      totalReports: totalReports.rows[0].count,
      pendingReports: pendingReports.rows[0].count,
      resolvedReports: resolvedReports.rows[0].count,
      bannedUsers: bannedUsers.rows[0].count,
    };
  },

  async getAllReports(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        r.*,
        u1.first_name as reporter_first_name,
        u1.last_name as reporter_last_name,
        u1.email as reporter_email,
        u2.first_name as reported_first_name,
        u2.last_name as reported_last_name,
        u2.email as reported_email
      FROM reports r
      LEFT JOIN users u1 ON r.reporter_id = u1.id
      LEFT JOIN users u2 ON r.reported_user_id = u2.id
      ORDER BY r.created_at DESC
    `);
    return result.rows;
  },

  async getPendingReports(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        r.*,
        u1.first_name as reporter_first_name,
        u1.last_name as reporter_last_name,
        u1.email as reporter_email,
        u2.first_name as reported_first_name,
        u2.last_name as reported_last_name,
        u2.email as reported_email
      FROM reports r
      LEFT JOIN users u1 ON r.reporter_id = u1.id
      LEFT JOIN users u2 ON r.reported_user_id = u2.id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `);
    return result.rows;
  },

  async updateReportStatus(id: string, status: string, adminNotes?: string): Promise<any> {
    const result = await db.execute(sql`
      UPDATE reports 
      SET status = ${status}, admin_notes = ${adminNotes || null}, resolved_at = ${status === "resolved" ? new Date() : null}
      WHERE id = ${id}
      RETURNING *
    `);
    return result.rows[0];
  },

  async createModerationLog(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO moderation_logs (admin_id, action, target_user_id, reason, notes)
      VALUES (${data.adminId}, ${data.action}, ${data.targetUserId}, ${data.reason || null}, ${data.notes || null})
      RETURNING *
    `);
    return result.rows[0];
  },

  async getModerationLogs(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        ml.*,
        u1.first_name as admin_first_name,
        u1.last_name as admin_last_name,
        u2.first_name as target_first_name,
        u2.last_name as target_last_name,
        u2.email as target_email
      FROM moderation_logs ml
      LEFT JOIN users u1 ON ml.admin_id = u1.id
      LEFT JOIN users u2 ON ml.target_user_id = u2.id
      ORDER BY ml.created_at DESC
      LIMIT 100
    `);
    return result.rows;
  },

  async createChatReport(data: InsertChatReport): Promise<ChatReport> {
    const [report] = await db.insert(chatReports).values(data).returning();
    return report;
  },

  async getChatReports(status?: string): Promise<Array<ChatReport & { reporter: User; reportedUser: User; message: ChatMessage }>> {
    const query = db
      .select({
        report: chatReports,
        reporter: users,
        reportedUser: users,
        message: chatMessages,
      })
      .from(chatReports)
      .leftJoin(users, eq(chatReports.reportedBy, users.id))
      .leftJoin(users as any, eq(chatReports.reportedUserId, (users as any).id))
      .leftJoin(chatMessages, eq(chatReports.messageId, chatMessages.id))
      .orderBy(desc(chatReports.createdAt));

    const results: any = status
      ? await query.where(eq(chatReports.status, status))
      : await query;

    return results.map((r: any) => ({
      ...r.report,
      reporter: r.reporter,
      reportedUser: r.reportedUser,
      message: r.message,
    }));
  },

  async getChatReport(id: string): Promise<(ChatReport & { reporter: User; reportedUser: User; message: ChatMessage }) | undefined> {
    const result: any = await db
      .select({
        report: chatReports,
        reporter: users,
        reportedUser: users,
        message: chatMessages,
      })
      .from(chatReports)
      .leftJoin(users, eq(chatReports.reportedBy, users.id))
      .leftJoin(users as any, eq(chatReports.reportedUserId, (users as any).id))
      .leftJoin(chatMessages, eq(chatReports.messageId, chatMessages.id))
      .where(eq(chatReports.id, id))
      .limit(1);

    if (!result || result.length === 0) return undefined;

    return {
      ...result[0].report,
      reporter: result[0].reporter,
      reportedUser: result[0].reportedUser,
      message: result[0].message,
    };
  },

  async updateChatReport(
    id: string,
    updates: { status?: string; reviewedBy?: string; reviewNotes?: string; actionTaken?: string },
  ): Promise<ChatReport> {
    const [report] = await db
      .update(chatReports)
      .set({ ...updates, reviewedAt: new Date() })
      .where(eq(chatReports.id, id))
      .returning();
    return report;
  },
};
