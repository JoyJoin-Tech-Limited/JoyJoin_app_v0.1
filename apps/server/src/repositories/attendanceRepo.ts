import { eventAttendance, users, events } from "@shared/schema";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { logAdminAudit } from "../lib/adminAuditLogger";

export interface AttendanceRepository {
  getAttendanceStatus(eventId: string, userId: string): Promise<{ status: string; estimatedLateMinutes?: number | null; absentReason?: string | null } | null>;
  updateAttendanceStatus(eventId: string, userId: string, status: string, estimatedLateMinutes?: number | null, absentReason?: string | null): Promise<void>;
  getEventAttendanceSummary(eventId: string): Promise<Array<{ userId: string; displayName: string; archetype: string | null; status: string; estimatedLateMinutes: number | null; absentReason: string | null; }>>;
  adminOverrideAttendanceStatus(eventId: string, userId: string, status: string, adminId: string): Promise<void>;
}

export const attendanceRepo: AttendanceRepository = {
  async getAttendanceStatus(eventId: string, userId: string): Promise<{ status: string; estimatedLateMinutes?: number | null; absentReason?: string | null } | null> {
    const result = await db.execute(sql`
      SELECT attendance_status as status, estimated_late_minutes, absent_reason
      FROM event_attendance
      WHERE blind_box_event_id = ${eventId} AND user_id = ${userId}
      LIMIT 1
    `);
    if (!result.rows[0]) return null;
    const row = result.rows[0] as any;
    return {
      status: row.status ?? 'pending',
      estimatedLateMinutes: row.estimated_late_minutes ?? null,
      absentReason: row.absent_reason ?? null,
    };
  },

  async updateAttendanceStatus(eventId: string, userId: string, status: string, estimatedLateMinutes?: number | null, absentReason?: string | null): Promise<void> {
    const result = await db.execute(sql`
      INSERT INTO event_attendance (blind_box_event_id, user_id, attendance_status, estimated_late_minutes, absent_reason, attendance_status_updated_at)
      VALUES (${eventId}, ${userId}, ${status}, ${estimatedLateMinutes ?? null}, ${absentReason ?? null}, NOW())
      ON CONFLICT (blind_box_event_id, user_id) WHERE blind_box_event_id IS NOT NULL
      DO UPDATE SET
        attendance_status = EXCLUDED.attendance_status,
        estimated_late_minutes = EXCLUDED.estimated_late_minutes,
        absent_reason = EXCLUDED.absent_reason,
        attendance_status_updated_at = EXCLUDED.attendance_status_updated_at
    `);
    if (!result.rowCount) {
      throw new Error(`Failed to persist attendance status for event ${eventId} and user ${userId}`);
    }
  },

  async getEventAttendanceSummary(eventId: string): Promise<Array<{ userId: string; displayName: string; archetype: string | null; status: string; estimatedLateMinutes: number | null; absentReason: string | null; }>> {
    // Join matched_attendees JSONB (from blind_box_events) with any existing event_attendance rows
    const result = await db.execute(sql`
      SELECT
        attendee->>'userId' AS "userId",
        COALESCE(u.display_name, u.first_name, 'Unknown') AS "displayName",
        u.archetype,
        COALESCE(ea.attendance_status, 'pending') AS status,
        ea.estimated_late_minutes AS "estimatedLateMinutes",
        ea.absent_reason AS "absentReason"
      FROM blind_box_events bbe,
           jsonb_array_elements(bbe.matched_attendees) AS attendee
      LEFT JOIN users u ON u.id = attendee->>'userId'
      LEFT JOIN event_attendance ea
             ON ea.blind_box_event_id = bbe.id
            AND ea.user_id = attendee->>'userId'
      WHERE bbe.id = ${eventId}
    `);
    return result.rows as any[];
  },

  async adminOverrideAttendanceStatus(eventId: string, userId: string, status: string, adminId: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO event_attendance (blind_box_event_id, user_id, attendance_status, estimated_late_minutes, absent_reason, attendance_status_updated_at)
      VALUES (${eventId}, ${userId}, ${status}, NULL, NULL, NOW())
      ON CONFLICT (blind_box_event_id, user_id) WHERE blind_box_event_id IS NOT NULL
      DO UPDATE SET
        attendance_status = EXCLUDED.attendance_status,
        estimated_late_minutes = NULL,
        absent_reason = NULL,
        attendance_status_updated_at = EXCLUDED.attendance_status_updated_at
    `);
    console.log(`[AdminOverride] Admin ${adminId} overrode attendance status for user ${userId} in event ${eventId} to ${status}`);

    logAdminAudit({
      action: 'ATTENDANCE_OVERRIDE',
      adminId,
      targetEntityType: 'event_attendance',
      targetEntityId: `${eventId}:${userId}`,
      context: { eventId, userId, newStatus: status },
    });
  }
};
