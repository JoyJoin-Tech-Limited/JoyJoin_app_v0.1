import type { Express } from "express";
import { db } from "../../db";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { events } from "@shared/schema";
import * as schema from "@shared/schema";
import type { ChatMessage, User } from "@shared/schema";
import { insertEventFeedbackSchema } from "@shared/schema";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";
import { shellCache } from "../../lib/shellCache";
import { validateContentSafe, validateContentSafeAsync, contentViolationResponse } from "../../lib/contentSafety";
import { recordViolation } from "../../abuseDetection";

function firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function getEventChatDisplayName(user: Pick<User, 'displayName' | 'firstName' | 'lastName'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return firstNonEmptyString(user.displayName, fullName) ?? '参与者';
}

function toEventChatParticipantSummary(
  user: Pick<User, 'id' | 'displayName' | 'firstName' | 'lastName' | 'archetype' | 'profileImageUrl' | 'wechatAvatarUrl'>,
): {
  id: string;
  displayName: string;
  firstName: string | null;
  nickname: string;
  archetype: string | null;
  profileImageUrl: string | null;
} {
  const displayName = getEventChatDisplayName(user);

  return {
    id: user.id,
    displayName,
    firstName: user.firstName ?? null,
    nickname: displayName,
    archetype: user.archetype ?? null,
    profileImageUrl: firstNonEmptyString(user.profileImageUrl, user.wechatAvatarUrl) ?? null,
  };
}

function toEventChatMessageSummary(message: ChatMessage & { user: User }) {
  return {
    ...message,
    user: toEventChatParticipantSummary(message.user),
  };
}

export function registerSocialRoutes(app: Express): void {
  // GET /api/events/:eventId/participants — table roster for the feedback
  // mutual-contact picker (2026-07-28: the picker called this endpoint since
  // the flow shipped, but it was never implemented — step 2 was permanently
  // empty in production). Resolves all three event id families behind one
  // privacy-minimal shape; the viewer is excluded server-side.
  app.get('/api/events/:eventId/participants', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

      type ParticipantRow = {
        id: string;
        displayName: string;
        firstName: string | null;
        archetype: string | null;
      };
      const seen = new Set<string>();
      const participants: ParticipantRow[] = [];
      const push = (row: ParticipantRow) => {
        if (!row.id || row.id === userId || seen.has(row.id)) return;
        seen.add(row.id);
        participants.push(row);
      };

      // Path 1 — blind-box event id: the finalized per-user event row carries
      // the table roster in matchedAttendees (populated at match time).
      const [blindBoxEvent] = await db
        .select({
          userId: schema.blindBoxEvents.userId,
          matchedAttendees: schema.blindBoxEvents.matchedAttendees,
        })
        .from(schema.blindBoxEvents)
        .where(eq(schema.blindBoxEvents.id, eventId))
        .limit(1);

      if (blindBoxEvent) {
        if (blindBoxEvent.userId !== userId) {
          return res.status(403).json({ message: 'Not a participant of this event' });
        }
        const attendees = Array.isArray(blindBoxEvent.matchedAttendees)
          ? (blindBoxEvent.matchedAttendees as Array<{ userId?: string; displayName?: string; archetype?: string | null }>)
          : [];
        for (const attendee of attendees) {
          if (!attendee?.userId) continue;
          push({
            id: attendee.userId,
            displayName: attendee.displayName?.trim() || '参与者',
            firstName: null,
            archetype: attendee.archetype ?? null,
          });
        }
        return res.json(participants);
      }

      // Path 2 — event pool id: resolve the viewer's matched group, then list
      // the group's matched members.
      const [pool] = await db
        .select({ id: schema.eventPools.id })
        .from(schema.eventPools)
        .where(eq(schema.eventPools.id, eventId))
        .limit(1);

      if (pool) {
        const [myRegistration] = await db
          .select({ assignedGroupId: schema.eventPoolRegistrations.assignedGroupId })
          .from(schema.eventPoolRegistrations)
          .where(
            and(
              eq(schema.eventPoolRegistrations.poolId, eventId),
              eq(schema.eventPoolRegistrations.userId, userId),
            ),
          )
          .limit(1);

        if (!myRegistration) {
          return res.status(403).json({ message: 'Not a participant of this event' });
        }
        if (!myRegistration.assignedGroupId) {
          // Registered but not matched yet — nothing to pick from.
          return res.json([]);
        }

        const memberRows = await db
          .select({
            id: schema.users.id,
            displayName: schema.users.displayName,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            archetype: schema.users.archetype,
          })
          .from(schema.eventPoolRegistrations)
          .innerJoin(schema.users, eq(schema.eventPoolRegistrations.userId, schema.users.id))
          .where(
            and(
              eq(schema.eventPoolRegistrations.assignedGroupId, myRegistration.assignedGroupId),
              eq(schema.eventPoolRegistrations.matchStatus, 'matched'),
            ),
          );

        for (const row of memberRows) {
          push({
            id: row.id,
            displayName: getEventChatDisplayName(row),
            firstName: row.firstName ?? null,
            archetype: row.archetype ?? null,
          });
        }
        return res.json(participants);
      }

      // Path 3 — legacy events.id: attendance roster (cancelled seats excluded).
      const attendeeRows = await db
        .select({
          id: schema.users.id,
          displayName: schema.users.displayName,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          archetype: schema.users.archetype,
        })
        .from(schema.eventAttendance)
        .innerJoin(schema.users, eq(schema.eventAttendance.userId, schema.users.id))
        .where(
          and(
            eq(schema.eventAttendance.eventId, eventId),
            ne(schema.eventAttendance.status, 'cancelled'),
          ),
        );

      for (const row of attendeeRows) {
        push({
          id: row.id,
          displayName: getEventChatDisplayName(row),
          firstName: row.firstName ?? null,
          archetype: row.archetype ?? null,
        });
      }
      return res.json(participants);
    } catch (error) {
      logger.error("Error fetching event participants", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  app.get('/api/events/:eventId/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

      const [event] = await db.select().from(events).where(eq(events.id, eventId));

      let eventDateTime = event?.dateTime;
      if (!event) {
        const blindBoxEvent = await storage.getBlindBoxEventById(eventId, userId);
        if (!blindBoxEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        eventDateTime = blindBoxEvent.dateTime;
      }

      const now = new Date();
      const eventTime = new Date(eventDateTime);
      const hoursUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const chatUnlocked = hoursUntilEvent <= 24;

      if (!chatUnlocked) {
        return res.json({
          chatUnlocked: false,
          hoursUntilUnlock: Math.max(0, hoursUntilEvent - 24),
          messages: [],
        });
      }

      const messages = await storage.getEventMessages(eventId);
      res.json({
        chatUnlocked: true,
        hoursUntilUnlock: 0,
        messages: messages.map(toEventChatMessageSummary),
      });
    } catch (error) {
      logger.error("Error fetching messages", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/events/:eventId/messages', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

      logger.warn('Blocked event chat write because the feature is under compliance freeze', {
        route: '/api/events/:eventId/messages',
        eventId,
        userId,
      });

      return res.status(503).json({
        message: '活动群聊暂不可用',
        featureUnavailable: true,
      });
    } catch (error) {
      logger.error("Error blocking message creation", { error: String(error) });
      res.status(500).json({ message: "Failed to apply event chat freeze" });
    }
  });

  app.post('/api/events/:eventId/feedback', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const result = insertEventFeedbackSchema.safeParse({
        ...req.body,
        eventId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Content-moderation gate (S1): per-field SYNC tier-0 checks (zero
      // network), then ONE tier-1 check on the concatenated text (single
      // 250ms budget, single WeChat call). On violation: block 400 +
      // recordViolation EXACTLY ONCE.
      const feedbackData: any = result.data;
      const feedbackTextFields: string[] = [];
      for (const candidate of [
        feedbackData.feedback,
        feedbackData.atmosphereNote,
        feedbackData.improvementOther,
        feedbackData.conversationNotes,
        feedbackData.futurePreferencesOther,
        feedbackData.additionalMatchPoints,
      ]) {
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          feedbackTextFields.push(candidate);
        }
      }
      const attendeeTraits = feedbackData.attendeeTraits ?? {};
      for (const trait of Object.values(attendeeTraits)) {
        const note = (trait as any)?.improvementNote;
        if (typeof note === "string" && note.trim().length > 0) {
          feedbackTextFields.push(note);
        }
      }
      for (const fieldText of feedbackTextFields) {
        const syncResult = validateContentSafe(fieldText, "eventFeedback");
        if (!syncResult.safe && syncResult.violation) {
          await recordViolation(userId, syncResult.violation.type, syncResult.violation.severity);
          return res.status(400).json(contentViolationResponse(syncResult.violation).body);
        }
      }
      const concatenatedFeedback = feedbackTextFields.join("\n");
      if (concatenatedFeedback.trim().length > 0) {
        const asyncResult = await validateContentSafeAsync(concatenatedFeedback, "eventFeedback", { userId });
        if (!asyncResult.safe && asyncResult.violation) {
          await recordViolation(userId, asyncResult.violation.type, asyncResult.violation.severity);
          return res.status(400).json(contentViolationResponse(asyncResult.violation).body);
        }
      }

      const { wechatContactId } = req.body;
      if (wechatContactId && typeof wechatContactId === 'string' && wechatContactId.trim()) {
        const currentUser = await storage.getUser(userId);
        if (!currentUser?.wechatContactId) {
          await storage.updateUserWechatId(userId, wechatContactId.trim());
        }
      }

      const feedback = await storage.createEventFeedback(userId, result.data);

      try {
        const { awardXPAndCoins } = await import('../../gamificationService');
        const xpResult = await awardXPAndCoins(userId, 'feedback_basic', eventId, feedback.id);
        logger.info(`[Gamification] Awarded basic feedback XP to user ${userId}`, { xpResult });
      } catch (xpError) {
        logger.error("Error awarding feedback XP", { error: String(xpError) });
      }

      if (feedback.connections && feedback.connections.length > 0) {
        for (const selectedUserId of feedback.connections) {
          if (selectedUserId === userId) {
            logger.warn(`[Connections] User ${userId} attempted self-selection — skipped`);
            continue;
          }
          try {
            await storage.upsertConnection(eventId, userId, selectedUserId);
            shellCache.invalidateUser(userId);
            shellCache.invalidateUser(selectedUserId);
          } catch (connError) {
            logger.error(`[Connections] Error upserting connection`, { from: userId, to: selectedUserId, error: String(connError) });
          }
        }
      }

      // Always invalidate the submitter's shell cache so the Connections tab
      // can move from feedback-pending to feedback-complete / connections.
      shellCache.invalidateUser(userId);

      const MUTUAL_MATCH_NOTIFICATION_WINDOW_MS = 60_000;
      try {
        const freshMutualRows = await storage.getMutualConnections(eventId, userId);
        for (const conn of freshMutualRows) {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          const isNew = conn.revealedAt && (Date.now() - new Date(conn.revealedAt).getTime()) < MUTUAL_MATCH_NOTIFICATION_WINDOW_MS;
          if (isNew && otherUserId !== userId) {
            try {
              const existing = await db
                .select({ id: schema.notifications.id })
                .from(schema.notifications)
                .where(
                  and(
                    eq(schema.notifications.userId, otherUserId),
                    eq(schema.notifications.type, 'mutual_match'),
                    eq(schema.notifications.relatedResourceId, eventId)
                  )
                )
                .limit(1);
              if (existing.length === 0) {
                await storage.createNotification({
                  userId: otherUserId,
                  category: 'chat',
                  type: 'mutual_match',
                  title: '🎉 新的双向匹配',
                  message: `你和一位参与者互相选择了对方！查看Ta的微信号吧`,
                  relatedResourceId: eventId,
                });
              }
            } catch (notifError) {
              logger.error(`[Connections] Failed to notify other user`, { otherUserId, error: String(notifError) });
            }
          }
        }
      } catch (notifLoopError) {
        logger.error(`[Connections] Failed to process mutual match notifications`, { error: String(notifLoopError) });
      }

      const mutualConnectionRows = await storage.getMutualConnections(eventId, userId);
      const mutualMatches = await Promise.all(
        mutualConnectionRows.map(async (conn: any) => {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          const snapshotWechatId =
            conn.userAId === userId ? conn.userBWechatId : conn.userAWechatId;
          const otherUser = await storage.getUser(otherUserId);
          return {
            userId: otherUserId,
            displayName: otherUser?.displayName || otherUser?.firstName || "参与者",
            archetype: otherUser?.archetype ?? null,
            wechatContactId: snapshotWechatId ?? otherUser?.wechatContactId ?? null,
          };
        })
      );

      const responsePayload = { ...feedback, mutualMatches };
      const shadowRecommendationInput = {
        source: 'event_feedback',
        eventId,
        feedbackId: feedback.id,
        userId,
        wouldMeetAgain:
          feedback.hasNewConnections ??
          (Array.isArray(feedback.connections) ? feedback.connections.length > 0 : mutualMatches.length > 0),
        wouldAttendAgain: feedback.wouldAttendAgain ?? null,
        hasNewConnections: feedback.hasNewConnections ?? (mutualMatches.length > 0 ? true : null),
        atmosphereScore: feedback.atmosphereScore ?? feedback.rating ?? null,
        connectionStatus: feedback.connectionStatus ?? null,
        connectionCount: Array.isArray(feedback.connections) ? feedback.connections.length : null,
        mutualConnectionCount: mutualMatches.length,
        conversationComfort: feedback.conversationComfort ?? null,
        connectionRadar:
          feedback.connectionRadar && typeof feedback.connectionRadar === 'object'
            ? feedback.connectionRadar
            : null,
      };

      res.json(responsePayload);

      setImmediate(() => {
        void import('../../matchingWeightsService')
          .then(({ matchingWeightsService }) => matchingWeightsService.recordShadowRecommendation(shadowRecommendationInput))
          .catch((shadowError) => {
            logger.error('Failed to record shadow recommendation from event_feedback', {
              eventId,
              feedbackId: feedback.id,
              userId,
              error: String(shadowError),
            });
          });
      });
    } catch (error) {
      logger.error("Error creating feedback", { error: String(error) });
      res.status(500).json({ message: "Failed to create feedback" });
    }
  });

  app.post('/api/insight-feedback', async (req: any, res) => {
    try {
      const { trigger, pillar, confidence, feedback, timestamp } = req.body;

      if (!trigger || !feedback || !['up', 'down'].includes(feedback)) {
        return res.status(400).json({ error: 'Invalid feedback data' });
      }

      logger.info('[Insight Feedback]', {
        trigger,
        pillar,
        confidence,
        feedback,
        timestamp,
        sessionId: req.session?.id || 'anonymous'
      });

      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error) {
      logger.error("Error saving insight feedback", { error: String(error) });
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });
}
