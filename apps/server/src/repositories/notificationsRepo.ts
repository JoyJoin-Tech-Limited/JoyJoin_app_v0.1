import { type Notification, type NotificationCounts, notifications } from "@shared/schema";
import { db } from "../db";
import { and, eq, sql } from "drizzle-orm";

export interface NotificationsRepository {
  getNotificationCounts(userId: string): Promise<NotificationCounts>;
  markNotificationsAsRead(userId: string, category: string): Promise<void>;
  createNotification(data: { userId: string; category: string; type: string; title: string; message?: string; relatedResourceId?: string }): Promise<void>;
  getAdminNotifications(adminId: string): Promise<Array<Notification & { recipientCount: number; readCount: number }>>;
  createBroadcastNotification(data: { sentBy: string; category: string; type: string; title: string; message?: string; userIds: string[] }): Promise<{ sent: number }>;
  getNotificationStats(notificationId: string): Promise<{ recipientCount: number; readCount: number }>;
}

export const notificationsRepo: NotificationsRepository = {
  async getNotificationCounts(userId: string): Promise<NotificationCounts> {
    const result = await db
      .select({
        category: notifications.category,
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .groupBy(notifications.category);

    const counts: NotificationCounts = {
      discover: 0,
      activities: 0,
      chat: 0,
      total: 0,
    };

    result.forEach((row: { category: string | null; count: number }) => {
      const count = Number(row.count) || 0;
      if (row.category === "discover") counts.discover = count;
      if (row.category === "activities") counts.activities = count;
      if (row.category === "chat") counts.chat = count;
      counts.total += count;
    });

    return counts;
  },

  async markNotificationsAsRead(userId: string, category: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.category, category), eq(notifications.isRead, false)));
  },

  async createNotification(data: { userId: string; category: string; type: string; title: string; message?: string; relatedResourceId?: string }): Promise<void> {
    await db.insert(notifications).values({
      userId: data.userId,
      category: data.category,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedResourceId: data.relatedResourceId,
      isRead: false,
    });
  },

  async getAdminNotifications(adminId: string): Promise<Array<Notification & { recipientCount: number; readCount: number }>> {
    const result = await db.execute(sql`
      WITH grouped_notifications AS (
        SELECT 
          MIN(n.id) as id,
          MIN(n.user_id) as user_id,
          n.category,
          n.type,
          n.title,
          n.message,
          n.related_resource_id,
          n.sent_by,
          n.is_broadcast,
          n.created_at,
          COUNT(*) as recipient_count,
          SUM(CASE WHEN n.is_read THEN 1 ELSE 0 END) as read_count
        FROM notifications n
        WHERE n.sent_by = ${adminId}
        GROUP BY n.title, n.message, n.category, n.type, n.related_resource_id, n.sent_by, n.is_broadcast, n.created_at
        ORDER BY n.created_at DESC
      )
      SELECT * FROM grouped_notifications
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      type: row.type,
      title: row.title,
      message: row.message,
      relatedResourceId: row.related_resource_id,
      isRead: false,
      sentBy: row.sent_by,
      isBroadcast: row.is_broadcast,
      createdAt: row.created_at,
      recipientCount: Number(row.recipient_count) || 0,
      readCount: Number(row.read_count) || 0,
    }));
  },

  async createBroadcastNotification(data: { sentBy: string; category: string; type: string; title: string; message?: string; userIds: string[] }): Promise<{ sent: number }> {
    if (data.userIds.length === 0) {
      return { sent: 0 };
    }

    const values = data.userIds.map((userId) => ({
      userId,
      category: data.category,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
      sentBy: data.sentBy,
      isBroadcast: true,
    }));

    await db.insert(notifications).values(values);
    return { sent: data.userIds.length };
  },

  async getNotificationStats(notificationId: string): Promise<{ recipientCount: number; readCount: number }> {
    const notification = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notification.length === 0) {
      return { recipientCount: 0, readCount: 0 };
    }

    const n = notification[0];
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as recipient_count,
        SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read_count
      FROM notifications
      WHERE title = ${n.title}
        AND message = ${n.message}
        AND sent_by = ${n.sentBy}
        AND created_at = ${n.createdAt}
    `);

    const row = result.rows[0] as any;
    return {
      recipientCount: Number(row.recipient_count) || 0,
      readCount: Number(row.read_count) || 0,
    };
  },
};
