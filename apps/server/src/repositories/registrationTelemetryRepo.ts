import { sql } from "drizzle-orm";
import { db } from "../db";

export interface RegistrationtelemetryRepository {
createRegistrationSession(data: { sessionMode: string; userId?: string; deviceChannel?: string; userAgent?: string }): Promise<any>;

updateRegistrationSession(id: string, updates: Partial<{
  userId: string;

getRegistrationSessionStats(): Promise<{
  totalStarted: number;

}

export const registrationtelemetryRepo: RegistrationtelemetryRepository = {
async createRegistrationSession(data: { sessionMode: string; userId?: string; deviceChannel?: string; userAgent?: string }): Promise<RegistrationSession> {


async updateRegistrationSession(id: string, updates: Partial<{
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
}>): Promise<RegistrationSession> {
  const [session] = await db
    .update(registrationSessions)
    .set({ ...updates, updatedAt: new Date() })


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

  // Total started sessions
  const [startedResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })

};
