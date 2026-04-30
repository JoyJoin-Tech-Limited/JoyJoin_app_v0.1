import { type RegistrationSession, registrationSessions } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";

export interface RegistrationTelemetryRepository {
  createRegistrationSession(data: {
    sessionMode: string;
    userId?: string;
    deviceChannel?: string;
    userAgent?: string;
  }): Promise<RegistrationSession>;
  updateRegistrationSession(
    id: string,
    updates: Partial<{
      userId: string;
      l1CompletedAt: Date;
      l2EnrichedAt: Date;
      completedAt: Date;
      abandonedAt: Date;
      lastTouchAt: Date;
      l3Confidence: string;
      l3ConfidenceSource: string;
      messageCount: number;
      l2FieldsFilledCount: number;
      fatigueReminderTriggered: boolean;
      metadata: any;
    }>,
  ): Promise<RegistrationSession>;
  getRegistrationSessionStats(): Promise<{
    totalStarted: number;
    totalCompleted: number;
    avgCompletionTimeMinutes: number;
    avgL3Confidence: number;
    completedLast7Days: number;
    completedPrevious7Days: number;
  }>;
}

export const registrationTelemetryRepo: RegistrationTelemetryRepository = {
  async createRegistrationSession(data: {
    sessionMode: string;
    userId?: string;
    deviceChannel?: string;
    userAgent?: string;
  }): Promise<RegistrationSession> {
    const [session] = await db
      .insert(registrationSessions)
      .values({
        sessionMode: data.sessionMode,
        userId: data.userId,
        deviceChannel: data.deviceChannel,
        userAgent: data.userAgent,
        startedAt: new Date(),
        lastTouchAt: new Date(),
      })
      .returning();
    return session;
  },

  async updateRegistrationSession(
    id: string,
    updates: Partial<{
      userId: string;
      l1CompletedAt: Date;
      l2EnrichedAt: Date;
      completedAt: Date;
      abandonedAt: Date;
      lastTouchAt: Date;
      l3Confidence: string;
      l3ConfidenceSource: string;
      messageCount: number;
      l2FieldsFilledCount: number;
      fatigueReminderTriggered: boolean;
      metadata: any;
    }>,
  ): Promise<RegistrationSession> {
    const [session] = await db
      .update(registrationSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(registrationSessions.id, id))
      .returning();
    return session;
  },

  async getRegistrationSessionStats(): Promise<{
    totalStarted: number;
    totalCompleted: number;
    avgCompletionTimeMinutes: number;
    avgL3Confidence: number;
    completedLast7Days: number;
    completedPrevious7Days: number;
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [startedResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(registrationSessions);
    const totalStarted = startedResult?.count || 0;

    const [completedResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(registrationSessions)
      .where(sql`${registrationSessions.completedAt} IS NOT NULL`);
    const totalCompleted = completedResult?.count || 0;

    const [timeResult] = await db
      .select({
        avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${registrationSessions.completedAt} - ${registrationSessions.startedAt})) / 60)`,
      })
      .from(registrationSessions)
      .where(sql`${registrationSessions.completedAt} IS NOT NULL`);
    const avgCompletionTimeMinutes = timeResult?.avgMinutes ? Math.round(timeResult.avgMinutes * 10) / 10 : 0;

    const [confidenceResult] = await db
      .select({
        avgConfidence: sql<number>`AVG(${registrationSessions.l3Confidence}::numeric)`,
      })
      .from(registrationSessions)
      .where(sql`${registrationSessions.l3Confidence} IS NOT NULL`);
    const avgL3Confidence = confidenceResult?.avgConfidence || 0;

    const [last7Result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(registrationSessions)
      .where(
        and(
          sql`${registrationSessions.completedAt} IS NOT NULL`,
          sql`${registrationSessions.completedAt} > ${sevenDaysAgo}`,
        ),
      );
    const completedLast7Days = last7Result?.count || 0;

    const [prev7Result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(registrationSessions)
      .where(
        and(
          sql`${registrationSessions.completedAt} IS NOT NULL`,
          sql`${registrationSessions.completedAt} > ${fourteenDaysAgo}`,
          sql`${registrationSessions.completedAt} <= ${sevenDaysAgo}`,
        ),
      );
    const completedPrevious7Days = prev7Result?.count || 0;

    return {
      totalStarted,
      totalCompleted,
      avgCompletionTimeMinutes,
      avgL3Confidence,
      completedLast7Days,
      completedPrevious7Days,
    };
  },
};
