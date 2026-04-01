import { blindBoxEvents, eventPoolGroups } from "@shared/schema";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";

export interface EventPoolsRepository {
  getBlindBoxEventAdmin(id: string): Promise<any>;
  markBlindBoxEventCompleted(blindBoxEventId: string): Promise<void>;
  markEventPoolGroupCompleted(groupId: string): Promise<void>;
}

export const eventPoolsRepo: EventPoolsRepository = {
  async getBlindBoxEventAdmin(id: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        e.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        u.email as creator_email,
        u.phone_number as creator_phone
      FROM blind_box_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ${id}
    `);
    return result.rows[0];
  },

  async markEventPoolGroupCompleted(groupId: string): Promise<void> {
    await db
      .update(eventPoolGroups)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(eventPoolGroups.id, groupId));

    console.log(`[Storage] Marked event pool group ${groupId} as completed`);
  },

  async markBlindBoxEventCompleted(blindBoxEventId: string): Promise<void> {
    await db
      .update(blindBoxEvents)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(blindBoxEvents.id, blindBoxEventId));

    console.log(`[Storage] Marked blind box event ${blindBoxEventId} as completed`);
  },
};
