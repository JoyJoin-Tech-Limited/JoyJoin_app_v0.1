import type { Express, Request, Response } from "express";
import { blindBoxEvents, eventPoolGroups, eventPoolRegistrations, eventPools, icebreakerSessions, userInterests, users } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { getBlindBoxEventParticipantAccess, getIcebreakerSessionParticipantAccess } from "../../lib/icebreakerAccess";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { icebreakerRepo } from "../../repositories/icebreakerRepo";

type SessionParticipant = {
  userId: string;
  displayName: string;
  archetype: string | null;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
};

type GroupRegistrationRow = {
  userId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryArchetype: string | null;
  archetype: string | null;
};

type ProfileRow = {
  id: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryArchetype: string | null;
  archetype: string | null;
};

type MatchedAttendee = {
  userId?: string;
  displayName?: string;
  archetype?: string;
  topInterests?: string[];
};

export interface IcebreakerSessionDetailsResponse {
  id: string;
  eventId: string | null;
  eventSource: "blind_box" | "pool_group";
  eventTitle: string;
  eventType: string;
  expectedAttendees: number;
  atmosphereType: string;
  participants: SessionParticipant[];
}

function buildDisplayName(user: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  return user.displayName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "参与者";
}

function buildInterestMap(rows: Array<{ userId: string; topPriorities: unknown; selections: unknown }>) {
  return new Map(
    rows.map((row) => {
      const topPriorities = Array.isArray(row.topPriorities)
        ? row.topPriorities
            .map((entry: any) => (typeof entry?.label === "string" ? entry.label : null))
            .filter((label): label is string => Boolean(label))
        : [];
      const selections = Array.isArray(row.selections)
        ? row.selections
            .map((entry: any) => (typeof entry?.label === "string" ? entry.label : null))
            .filter((label): label is string => Boolean(label))
        : [];

      return [
        row.userId,
        {
          topicsHappy: topPriorities,
          interests: topPriorities.length > 0 ? topPriorities : selections.slice(0, 5),
        },
      ];
    }),
  );
}

async function loadInterestRows(userIds: string[]) {
  if (userIds.length === 0) return [];

  return db
    .select({
      userId: userInterests.userId,
      topPriorities: userInterests.topPriorities,
      selections: userInterests.selections,
    })
    .from(userInterests)
    .where(inArray(userInterests.userId, userIds));
}

async function loadGroupSessionPayload(sessionId: string) {
  const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
  if (!session?.groupId) return null;

  const [group] = await db
    .select()
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, session.groupId))
    .limit(1);

  if (!group) return null;

  const [pool] = await db.select().from(eventPools).where(eq(eventPools.id, group.poolId)).limit(1);
  if (!pool) return null;

  const registrations = await db
    .select({
      userId: eventPoolRegistrations.userId,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      primaryArchetype: users.primaryArchetype,
      archetype: users.archetype,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .where(eq(eventPoolRegistrations.assignedGroupId, group.id))
    .orderBy(eventPoolRegistrations.registeredAt);

  const userIds = registrations.map((registration: GroupRegistrationRow) => registration.userId);
  const interestMap = buildInterestMap(await loadInterestRows(userIds));

  const participants: SessionParticipant[] = registrations.map((registration: GroupRegistrationRow) => {
    const interests = interestMap.get(registration.userId);
    return {
      userId: registration.userId,
      displayName: buildDisplayName(registration),
      archetype: registration.primaryArchetype ?? registration.archetype ?? null,
      interests: interests?.interests,
      topicsHappy: interests?.topicsHappy,
      topicsAvoid: [],
    };
  });

  return buildIcebreakerSessionDetailsResponse({
    id: session.id,
    eventId: null,
    eventSource: "pool_group" as const,
    eventTitle: pool.title,
    eventType: pool.eventType,
    expectedAttendees: session.expectedAttendees ?? group.memberCount ?? participants.length,
    atmosphereType: session.atmosphereType ?? (pool.eventType === "酒局" ? "lively" : "balanced"),
    participants,
  });
}

async function loadBlindBoxSessionPayload(sessionId: string) {
  const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
  if (!session?.blindBoxEventId) return null;

  const [event] = await db
    .select()
    .from(blindBoxEvents)
    .where(eq(blindBoxEvents.id, session.blindBoxEventId))
    .limit(1);

  if (!event) return null;

  const matchedAttendees: MatchedAttendee[] = Array.isArray(event.matchedAttendees)
    ? (event.matchedAttendees as MatchedAttendee[])
    : [];
  const attendeeUserIds = matchedAttendees
    .map((attendee) => (typeof attendee?.userId === "string" ? attendee.userId : null))
    .filter((userId): userId is string => Boolean(userId));

  const attendeeMap = new Map(
    matchedAttendees.map((attendee: any) => [attendee?.userId, attendee]),
  );

  const profileRows = attendeeUserIds.length
    ? await db
        .select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
          primaryArchetype: users.primaryArchetype,
          archetype: users.archetype,
        })
        .from(users)
        .where(inArray(users.id, attendeeUserIds))
    : [];

  const profileMap = new Map<string, ProfileRow>(
    profileRows.map((profile: ProfileRow) => [profile.id, profile]),
  );
  const interestMap = buildInterestMap(await loadInterestRows(attendeeUserIds));

  const participants: SessionParticipant[] = attendeeUserIds.map((userId: string) => {
    const attendee = attendeeMap.get(userId) ?? {};
    const profile = profileMap.get(userId);
    const interests = interestMap.get(userId);

    return {
      userId,
      displayName:
        (typeof attendee.displayName === "string" && attendee.displayName) ||
        (profile ? buildDisplayName(profile) : "参与者"),
      archetype:
        (typeof attendee.archetype === "string" && attendee.archetype) ||
        profile?.primaryArchetype ||
        profile?.archetype ||
        null,
      interests: interests?.interests ?? (Array.isArray(attendee.topInterests) ? attendee.topInterests : undefined),
      topicsHappy: interests?.topicsHappy,
      topicsAvoid: [],
    };
  });

  return buildIcebreakerSessionDetailsResponse({
    id: session.id,
    eventId: event.id,
    eventSource: "blind_box" as const,
    eventTitle: event.title,
    eventType: event.eventType,
    expectedAttendees: session.expectedAttendees ?? event.totalParticipants ?? participants.length,
    atmosphereType: session.atmosphereType ?? (event.eventType === "酒局" ? "lively" : "balanced"),
    participants,
  });
}

export function buildIcebreakerSessionDetailsResponse(
  input: IcebreakerSessionDetailsResponse,
): IcebreakerSessionDetailsResponse {
  return input;
}

export function registerIcebreakerSessionRoutes(app: Express): void {
  app.get("/api/events/:eventId/session", async (req: Request, res: Response) => {
    try {
      const userId = requireAuthenticatedUserId(req, res);
      if (!userId) return;

      const access = await getBlindBoxEventParticipantAccess(req.params.eventId, userId);
      if (!access.allowed) {
        return res.status(access.status).json(access.body);
      }

      const session = await icebreakerRepo.getIcebreakerSessionByBlindBoxEventId(req.params.eventId);

      if (!session) {
        return res.json(null);
      }

      const checkins = await icebreakerRepo.getSessionCheckins(session.id);
      return res.json({
        sessionId: session.id,
        checkedInCount: checkins.length,
        expectedAttendees: session.expectedAttendees || access.event.totalParticipants || 0,
        currentPhase: session.currentPhase,
      });
    } catch (error) {
      logger.error("Failed to get event session", {
        route: "/api/events/:eventId/session",
        eventId: req.params.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to get session" });
    }
  });

  app.post("/api/events/:eventId/session", async (req: Request, res: Response) => {
    try {
      const userId = requireAuthenticatedUserId(req, res);
      if (!userId) return;

      const access = await getBlindBoxEventParticipantAccess(req.params.eventId, userId);
      if (!access.allowed) {
        return res.status(access.status).json(access.body);
      }

      const existingSession = await icebreakerRepo.getIcebreakerSessionByBlindBoxEventId(req.params.eventId);
      if (existingSession) {
        return res.json({ sessionId: existingSession.id });
      }

      const createdSession = await icebreakerRepo.createIcebreakerSession({
        blindBoxEventId: req.params.eventId,
        currentPhase: "warmup",
        expectedAttendees: access.event.totalParticipants || 0,
        atmosphereType: access.event.eventType === "酒局" ? "lively" : "balanced",
        hostUserId: userId,
        startedAt: new Date(),
      });

      logger.info("Created event icebreaker session", {
        route: "/api/events/:eventId/session",
        eventId: req.params.eventId,
        userId,
        sessionId: createdSession.id,
      });

      return res.json({ sessionId: createdSession.id });
    } catch (error: any) {
      if (error?.code === "23505" || error?.message?.includes("unique constraint")) {
        const existingSession = await icebreakerRepo.getIcebreakerSessionByBlindBoxEventId(req.params.eventId);
        if (existingSession) {
          return res.json({ sessionId: existingSession.id });
        }
      }

      logger.error("Failed to create event session", {
        route: "/api/events/:eventId/session",
        eventId: req.params.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/icebreaker/session/:sessionId", async (req: Request, res: Response) => {
    try {
      const userId = requireAuthenticatedUserId(req, res);
      if (!userId) return;

      const access = await getIcebreakerSessionParticipantAccess(req.params.sessionId, userId);
      if (!access.allowed) {
        return res.status(access.status).json(access.body);
      }

      const payload =
        access.session.groupId
          ? await loadGroupSessionPayload(req.params.sessionId)
          : await loadBlindBoxSessionPayload(req.params.sessionId);

      if (!payload) {
        return res.status(404).json({ message: "Icebreaker session not found" });
      }

      return res.json(payload);
    } catch (error) {
      logger.error("Failed to get icebreaker session details", {
        route: "/api/icebreaker/session/:sessionId",
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to get icebreaker session details" });
    }
  });
}
