import {
  type IcebreakerSession,
  type IcebreakerCheckin,
  type IcebreakerReadyVote,
  type IcebreakerActivityLog,
  type InsertIcebreakerSession,
  type InsertIcebreakerCheckin,
  type InsertIcebreakerReadyVote,
  type InsertIcebreakerActivityLog,
  type User,
  icebreakerSessions,
  icebreakerCheckins,
  icebreakerReadyVotes,
  icebreakerActivityLogs,
  users,
  eventAttendance,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, sql } from "drizzle-orm";

export interface IcebreakerRepository {
  getIcebreakerSession(id: string): Promise<IcebreakerSession | undefined>;
  getIcebreakerSessionByEventId(eventId: string): Promise<IcebreakerSession | undefined>;
  getIcebreakerSessionByGroupId(groupId: string): Promise<IcebreakerSession | undefined>;
  getIcebreakerSessionByBlindBoxEventId(blindBoxEventId: string): Promise<IcebreakerSession | undefined>;
  createIcebreakerSession(data: InsertIcebreakerSession): Promise<IcebreakerSession>;
  updateIcebreakerSession(id: string, updates: Partial<IcebreakerSession>): Promise<IcebreakerSession>;
  getSessionCheckins(sessionId: string): Promise<Array<IcebreakerCheckin & { user: User }>>;
  getUserCheckin(sessionId: string, userId: string): Promise<IcebreakerCheckin | undefined>;
  createCheckin(data: InsertIcebreakerCheckin): Promise<IcebreakerCheckin>;
  updateCheckin(id: string, updates: Partial<IcebreakerCheckin>): Promise<IcebreakerCheckin>;
  assignNumberPlates(sessionId: string): Promise<IcebreakerCheckin[]>;
  getSessionReadyVotes(sessionId: string, phase: string): Promise<IcebreakerReadyVote[]>;
  getUserReadyVote(sessionId: string, userId: string, phase: string): Promise<IcebreakerReadyVote | undefined>;
  createReadyVote(data: InsertIcebreakerReadyVote): Promise<IcebreakerReadyVote>;
  getReadyVoteCount(sessionId: string, phase: string): Promise<number>;
  createActivityLog(data: InsertIcebreakerActivityLog): Promise<IcebreakerActivityLog>;
  getSessionActivityLogs(sessionId: string): Promise<IcebreakerActivityLog[]>;
  markSessionAttendanceCompleted(sessionId: string, eventId: string): Promise<void>;
}

export const icebreakerRepo: IcebreakerRepository = {
  async getIcebreakerSession(id: string): Promise<IcebreakerSession | undefined> {
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, id));
    return session;
  },

  async getIcebreakerSessionByEventId(eventId: string): Promise<IcebreakerSession | undefined> {
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.eventId, eventId));
    return session;
  },

  async getIcebreakerSessionByGroupId(groupId: string): Promise<IcebreakerSession | undefined> {
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.groupId, groupId));
    return session;
  },

  async getIcebreakerSessionByBlindBoxEventId(blindBoxEventId: string): Promise<IcebreakerSession | undefined> {
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.blindBoxEventId, blindBoxEventId));
    return session;
  },

  async createIcebreakerSession(data: InsertIcebreakerSession): Promise<IcebreakerSession> {
    const [session] = await db.insert(icebreakerSessions).values(data).returning();
    return session;
  },

  async updateIcebreakerSession(id: string, updates: Partial<IcebreakerSession>): Promise<IcebreakerSession> {
    const [session] = await db
      .update(icebreakerSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(icebreakerSessions.id, id))
      .returning();
    return session;
  },

  async getSessionCheckins(sessionId: string): Promise<Array<IcebreakerCheckin & { user: User }>> {
    const checkins = await db
      .select()
      .from(icebreakerCheckins)
      .innerJoin(users, eq(icebreakerCheckins.userId, users.id))
      .where(eq(icebreakerCheckins.sessionId, sessionId))
      .orderBy(icebreakerCheckins.numberPlate);

    return checkins.map((row: any) => ({
      ...row.icebreaker_checkins,
      user: row.users,
    }));
  },

  async getUserCheckin(sessionId: string, userId: string): Promise<IcebreakerCheckin | undefined> {
    const [checkin] = await db
      .select()
      .from(icebreakerCheckins)
      .where(and(eq(icebreakerCheckins.sessionId, sessionId), eq(icebreakerCheckins.userId, userId)));
    return checkin;
  },

  async createCheckin(data: InsertIcebreakerCheckin): Promise<IcebreakerCheckin> {
    const [checkin] = await db.insert(icebreakerCheckins).values(data).returning();
    return checkin;
  },

  async updateCheckin(id: string, updates: Partial<IcebreakerCheckin>): Promise<IcebreakerCheckin> {
    const [checkin] = await db
      .update(icebreakerCheckins)
      .set(updates)
      .where(eq(icebreakerCheckins.id, id))
      .returning();
    return checkin;
  },

  async assignNumberPlates(sessionId: string): Promise<IcebreakerCheckin[]> {
    const checkins = await db
      .select()
      .from(icebreakerCheckins)
      .where(eq(icebreakerCheckins.sessionId, sessionId));

    const shuffled = [...checkins].sort(() => Math.random() - 0.5);
    const updated: IcebreakerCheckin[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      const [checkin] = await db
        .update(icebreakerCheckins)
        .set({ numberPlate: i + 1 })
        .where(eq(icebreakerCheckins.id, shuffled[i].id))
        .returning();
      updated.push(checkin);
    }

    return updated.sort((a, b) => (a.numberPlate || 0) - (b.numberPlate || 0));
  },

  async getSessionReadyVotes(sessionId: string, phase: string): Promise<IcebreakerReadyVote[]> {
    return db
      .select()
      .from(icebreakerReadyVotes)
      .where(and(eq(icebreakerReadyVotes.sessionId, sessionId), eq(icebreakerReadyVotes.phase, phase)));
  },

  async getUserReadyVote(sessionId: string, userId: string, phase: string): Promise<IcebreakerReadyVote | undefined> {
    const [vote] = await db
      .select()
      .from(icebreakerReadyVotes)
      .where(and(
        eq(icebreakerReadyVotes.sessionId, sessionId),
        eq(icebreakerReadyVotes.userId, userId),
        eq(icebreakerReadyVotes.phase, phase),
      ));
    return vote;
  },

  async createReadyVote(data: InsertIcebreakerReadyVote): Promise<IcebreakerReadyVote> {
    const [vote] = await db.insert(icebreakerReadyVotes).values(data).returning();
    return vote;
  },

  async getReadyVoteCount(sessionId: string, phase: string): Promise<number> {
    const votes = await icebreakerRepo.getSessionReadyVotes(sessionId, phase);
    return votes.length;
  },

  async createActivityLog(data: InsertIcebreakerActivityLog): Promise<IcebreakerActivityLog> {
    const [log] = await db.insert(icebreakerActivityLogs).values(data).returning();
    return log;
  },

  async getSessionActivityLogs(sessionId: string): Promise<IcebreakerActivityLog[]> {
    return db
      .select()
      .from(icebreakerActivityLogs)
      .where(eq(icebreakerActivityLogs.sessionId, sessionId))
      .orderBy(desc(icebreakerActivityLogs.createdAt));
  },

  async markSessionAttendanceCompleted(sessionId: string, eventId: string): Promise<void> {
    const checkins = await icebreakerRepo.getSessionCheckins(sessionId);
    const userIds = checkins.map((c) => c.userId);

    if (userIds.length === 0) return;

    await db
      .update(eventAttendance)
      .set({ status: "attended" })
      .where(and(eq(eventAttendance.eventId, eventId), sql`${eventAttendance.userId} = ANY(${userIds})`));

    console.log(`[Storage] Marked ${userIds.length} users as attended for event ${eventId}`);
  },
};
