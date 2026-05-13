import type { Express } from "express";
import { db } from "../../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { events } from "@shared/schema";
import * as schema from "@shared/schema";
import type { ChatMessage, User } from "@shared/schema";
import { insertEventFeedbackSchema } from "@shared/schema";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";

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
          } catch (connError) {
            logger.error(`[Connections] Error upserting connection`, { from: userId, to: selectedUserId, error: String(connError) });
          }
        }
      }

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
