import { blindBoxEvents, eventAttendance, events, type BlindBoxEvent } from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";

export interface BlindBoxEventsRepository {
  getAllBlindBoxEvents(): Promise<Array<BlindBoxEvent>>;
  getUserBlindBoxEvents(userId: string): Promise<Array<BlindBoxEvent>>;
  getBlindBoxEventById(eventId: string, userId: string): Promise<BlindBoxEvent | undefined>;
  createBlindBoxEvent(
    userId: string,
    eventData: {
      date: string;
      time: string;
      eventType: string;
      city: string;
      area: string;
      budget: string[];
      acceptNearby?: boolean;
      selectedLanguages?: string[];
      selectedTasteIntensity?: string[];
      selectedCuisines?: string[];
      inviteFriends?: boolean;
      friendsCount?: number;
    },
  ): Promise<BlindBoxEvent>;
  updateBlindBoxEventPreferences(
    eventId: string,
    userId: string,
    preferences: {
      budget?: string[];
      acceptNearby?: boolean;
      selectedLanguages?: string[];
      selectedTasteIntensity?: string[];
      selectedCuisines?: string[];
    },
  ): Promise<BlindBoxEvent>;
  cancelBlindBoxEvent(eventId: string, userId: string): Promise<BlindBoxEvent>;
  setBlindBoxEventMatchData(
    eventId: string,
    userId: string,
    matchData: {
      matchedAttendees: any[];
      matchExplanation?: string;
    },
  ): Promise<BlindBoxEvent>;
  getAllBlindBoxEventsAdmin(): Promise<any[]>;
  getBlindBoxEventAdmin(id: string): Promise<any>;
  updateBlindBoxEventAdmin(id: string, updates: any): Promise<any>;
}

export const blindBoxEventsRepo: BlindBoxEventsRepository = {
  async getAllBlindBoxEvents(): Promise<Array<BlindBoxEvent>> {
    return await db.select().from(blindBoxEvents);
  },

  async getUserBlindBoxEvents(userId: string): Promise<Array<BlindBoxEvent>> {
    const eventsResult = await db
      .select()
      .from(blindBoxEvents)
      .where(eq(blindBoxEvents.userId, userId))
      .orderBy(desc(blindBoxEvents.dateTime));
    return eventsResult;
  },

  async getBlindBoxEventById(eventId: string, userId: string): Promise<BlindBoxEvent | undefined> {
    const [event] = await db
      .select()
      .from(blindBoxEvents)
      .where(eq(blindBoxEvents.id, eventId));

    if (event && event.status !== "matched" && event.userId !== userId) {
      return undefined;
    }

    return event;
  },

  async createBlindBoxEvent(
    userId: string,
    eventData: {
      date: string;
      time: string;
      eventType: string;
      city: string;
      area: string;
      budget: string[];
      acceptNearby?: boolean;
      selectedLanguages?: string[];
      selectedTasteIntensity?: string[];
      selectedCuisines?: string[];
      inviteFriends?: boolean;
      friendsCount?: number;
    },
  ): Promise<BlindBoxEvent> {
    const district = eventData.area.includes("•")
      ? eventData.area.split("•")[1]
      : eventData.area;

    const parseWeekday = (weekdayStr: string): number => {
      const weekdayMap: Record<string, number> = {
        周日: 0,
        周一: 1,
        周二: 2,
        周三: 3,
        周四: 4,
        周五: 5,
        周六: 6,
      };
      return weekdayMap[weekdayStr] ?? 0;
    };

    const getNextWeekdayDate = (weekdayStr: string, timeStr: string): Date => {
      const targetWeekday = parseWeekday(weekdayStr);
      const now = new Date();
      const currentWeekday = now.getDay();

      let daysUntil = targetWeekday - currentWeekday;
      if (daysUntil <= 0) {
        daysUntil += 7;
      }

      const [hours, minutes] = timeStr.split(":").map(Number);
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + daysUntil);
      targetDate.setHours(hours, minutes, 0, 0);

      return targetDate;
    };

    const dateTime = getNextWeekdayDate(eventData.date, eventData.time);
    const title = `${eventData.date} ${eventData.time} · ${eventData.eventType}`;
    const budgetTier = eventData.budget.join("/");
    const invitedCount = eventData.inviteFriends ? (eventData.friendsCount || 1) : 0;

    const [newEvent] = await db
      .insert(blindBoxEvents)
      .values({
        userId,
        title,
        eventType: eventData.eventType,
        city: eventData.city,
        district,
        dateTime,
        budgetTier,
        selectedLanguages: eventData.selectedLanguages || null,
        selectedTasteIntensity: eventData.selectedTasteIntensity || null,
        selectedCuisines: eventData.selectedCuisines || null,
        acceptNearby: eventData.acceptNearby || false,
        invitedCount,
        invitedJoined: 0,
        status: "pending_match",
        progress: 0,
        etaMinutes: 120,
      })
      .returning();

    const [correspondingEvent] = await db
      .insert(events)
      .values({
        title,
        description: `${eventData.eventType} · ${budgetTier}`,
        dateTime,
        location: `${district}`,
        area: district,
        price: null,
        maxAttendees: 6,
        currentAttendees: 1,
        hostId: userId,
        status: "upcoming",
      })
      .returning();

    await db
      .insert(eventAttendance)
      .values({
        eventId: correspondingEvent.id,
        userId,
        status: "confirmed",
      });

    return newEvent;
  },

  async updateBlindBoxEventPreferences(
    eventId: string,
    userId: string,
    preferences: {
      budget?: string[];
      acceptNearby?: boolean;
      selectedLanguages?: string[];
      selectedTasteIntensity?: string[];
      selectedCuisines?: string[];
    },
  ): Promise<BlindBoxEvent> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (preferences.budget && preferences.budget.length > 0) {
      updateData.budgetTier = preferences.budget.join("/");
    }

    if (preferences.acceptNearby !== undefined) {
      updateData.acceptNearby = preferences.acceptNearby;
    }

    if (preferences.selectedLanguages !== undefined) {
      updateData.selectedLanguages = preferences.selectedLanguages.length > 0 ? preferences.selectedLanguages : null;
    }

    if (preferences.selectedTasteIntensity !== undefined) {
      updateData.selectedTasteIntensity =
        preferences.selectedTasteIntensity.length > 0 ? preferences.selectedTasteIntensity : null;
    }

    if (preferences.selectedCuisines !== undefined) {
      updateData.selectedCuisines = preferences.selectedCuisines.length > 0 ? preferences.selectedCuisines : null;
    }

    const [event] = await db
      .update(blindBoxEvents)
      .set(updateData)
      .where(
        and(
          eq(blindBoxEvents.id, eventId),
          eq(blindBoxEvents.userId, userId),
          eq(blindBoxEvents.status, "pending_match"),
        ),
      )
      .returning();

    if (!event) {
      throw new Error("Event not found or cannot be updated");
    }

    return event;
  },

  async cancelBlindBoxEvent(eventId: string, userId: string): Promise<BlindBoxEvent> {
    const [event] = await db
      .update(blindBoxEvents)
      .set({
        status: "canceled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(blindBoxEvents.id, eventId),
          eq(blindBoxEvents.userId, userId),
          eq(blindBoxEvents.status, "pending_match"),
        ),
      )
      .returning();

    if (!event) {
      throw new Error("Event not found or cannot be canceled");
    }

    return event;
  },

  async setBlindBoxEventMatchData(
    eventId: string,
    userId: string,
    matchData: {
      matchedAttendees: any[];
      matchExplanation?: string;
    },
  ): Promise<BlindBoxEvent> {
    const [event] = await db
      .update(blindBoxEvents)
      .set({
        status: "matched",
        matchedAttendees: matchData.matchedAttendees as any,
        matchExplanation: matchData.matchExplanation,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(blindBoxEvents.id, eventId),
          eq(blindBoxEvents.userId, userId),
        ),
      )
      .returning();

    if (!event) {
      throw new Error("Event not found");
    }

    return event;
  },

  async getAllBlindBoxEventsAdmin(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        e.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        u.email as creator_email
      FROM blind_box_events e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
    `);
    return result.rows;
  },

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

  async updateBlindBoxEventAdmin(id: string, updates: any): Promise<any> {
    const setData: any = {};
    if (updates.status !== undefined) setData.status = updates.status;

    if (Object.keys(setData).length === 0) {
      return blindBoxEventsRepo.getBlindBoxEventAdmin(id);
    }

    const [result] = await db
      .update(blindBoxEvents)
      .set(setData)
      .where(eq(blindBoxEvents.id, id))
      .returning();
    return result;
  },
};
