import type { Express } from "express";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { storage } from "../../storage";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";

type DbTransaction = NeonDatabase<typeof schema>;

async function verifySessionAccess(sessionId: string, userId: string, db: any, schema: any): Promise<boolean> {
  const { icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = schema;
  const { eq, and } = await import('drizzle-orm');

  const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
  if (!session) return false;

  if (session.groupId) {
    const registration = await db.select()
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, session.groupId)
        )
      )
      .limit(1);
    return registration.length > 0;
  } else if (session.blindBoxEventId) {
    const event = await storage.getBlindBoxEventById(session.blindBoxEventId, userId);
    if (!event) return false;
    const matchedAttendees = (Array.isArray(event.matchedAttendees) ? event.matchedAttendees : []) as Array<{ userId?: string }>;
    return matchedAttendees.some((a: any) => a.userId === userId);
  }

  return false;
}

export function registerIcebreakerGameRoutes(app: Express): void {
  app.post('/api/icebreaker/game/generate-cards', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId, eventId, groupId, roundNumber, cardsCount, aiRatio } = req.body;
      
      if (!sessionId && !eventId && !groupId) {
        return res.status(400).json({ message: "sessionId, eventId, or groupId required" });
      }
      
      const { generateMixedCards } = await import('../../icebreakerCardGenerationService');
      const { db } = await import('../../db');
      const { 
        icebreakerSessions, 
        icebreakerGameCards, 
        icebreakerGameProgress,
        users,
        userInterests,
        eventPoolRegistrations,
        eventPoolGroups,
        assessmentSessions,
      } = await import('@shared/schema');
      const { eq, and, inArray, sql, desc, isNotNull } = await import('drizzle-orm');
      
      // Find or create icebreaker session
      let session;
      if (sessionId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
        session = sessions[0];
      } else if (eventId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.blindBoxEventId, eventId)).limit(1);
        session = sessions[0];
        
        if (!session) {
          // Create new session for blind box event
          const [newSession] = await db.insert(icebreakerSessions).values({
            blindBoxEventId: eventId,
            currentPhase: 'icebreaker',
            phaseStartedAt: new Date(),
          }).returning();
          session = newSession;
        }
      } else if (groupId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.groupId, groupId)).limit(1);
        session = sessions[0];
        
        if (!session) {
          // Create new session for pool group
          const [newSession] = await db.insert(icebreakerSessions).values({
            groupId: groupId,
            currentPhase: 'icebreaker',
            phaseStartedAt: new Date(),
          }).returning();
          session = newSession;
        }
      }
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Verify user authorization to access this session
      const isAuthorized = await verifySessionAccess(session.id, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      // Get attendees data for personalization
      let attendees: any[] = [];
      
      if (session.groupId) {
        // Pool event - get group members
        const [group] = await db.select().from(eventPoolGroups).where(eq(eventPoolGroups.id, session.groupId)).limit(1);
        if (group && group.members) {
          const memberIds = (group.members as any[]).map((m: any) => m.userId).filter(Boolean);
          if (memberIds.length > 0) {
            attendees = await db.select({
              id: users.id,
              displayName: users.displayName,
              birthdate: users.birthdate,
              gender: users.gender,
              educationLevel: users.educationLevel,
              industryCategory: users.industryCategory,
              industrySegment: users.industrySegment,
              relationshipStatus: users.relationshipStatus,
              primaryArchetype: users.primaryArchetype,
              secondaryArchetype: users.secondaryArchetype,
              conversationMode: users.conversationMode,
              conversationEnergy: users.conversationEnergy,
            }).from(users).where(inArray(users.id, memberIds));
          }
        }
      } else if (session.blindBoxEventId) {
        // Blind box event - get matched attendees
        const event = await storage.getBlindBoxEventById(session.blindBoxEventId, userId);
        if (event && event.matchedAttendees) {
          const attendeeUserIds = (event.matchedAttendees as any[]).map((a: any) => a.userId).filter(Boolean);
          if (attendeeUserIds.length > 0) {
            attendees = await db.select({
              id: users.id,
              displayName: users.displayName,
              birthdate: users.birthdate,
              gender: users.gender,
              educationLevel: users.educationLevel,
              industryCategory: users.industryCategory,
              industrySegment: users.industrySegment,
              relationshipStatus: users.relationshipStatus,
              primaryArchetype: users.primaryArchetype,
              secondaryArchetype: users.secondaryArchetype,
              conversationMode: users.conversationMode,
              conversationEnergy: users.conversationEnergy,
            }).from(users).where(inArray(users.id, attendeeUserIds));
          }
        }
      }
      
      // Enrich with interests and trait scores
      for (const attendee of attendees) {
        // Get interests
        const [interests] = await db.select().from(userInterests).where(eq(userInterests.userId, attendee.id)).limit(1);
        if (interests && interests.selections) {
          attendee.interests = (interests.selections as any[]).map((s: any) => s.label);
          attendee.topPriorities = interests.topPriorities;
        }
        
        // Get personality trait scores from assessment results using Drizzle query builder
        const [assessment] = await db
          .select({
            traitScores: assessmentSessions.traitScores,
            primaryArchetype: assessmentSessions.primaryArchetype,
          })
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.userId, attendee.id),
              isNotNull(assessmentSessions.completedAt)
            )
          )
          .orderBy(desc(assessmentSessions.completedAt))
          .limit(1);
        
        if (assessment) {
          attendee.traitScores = assessment.traitScores;
        }
        
        // Get intent from pool registration if available
        if (session.groupId) {
          const [registration] = await db.select()
            .from(eventPoolRegistrations)
            .where(and(
              eq(eventPoolRegistrations.userId, attendee.id),
              eq(eventPoolRegistrations.assignedGroupId, session.groupId)
            ))
            .limit(1);
          if (registration && registration.intent) {
            attendee.intent = registration.intent;
          }
        }
      }
      
      // Generate cards
      const round = roundNumber || 1;
      const count = cardsCount || 3;
      const ratio = aiRatio !== undefined ? aiRatio : 70;
      
      const { cards, sources } = await generateMixedCards(attendees, round, count, ratio);
      
      // Save cards to database
      const savedCards = [];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const source = sources[i];
        
        const [savedCard] = await db.insert(icebreakerGameCards).values({
          sessionId: session.id,
          cardType: card.cardType,
          content: card.content,
          hint: card.hint,
          category: card.category,
          difficulty: card.difficulty,
          voteOptions: card.voteOptions ? card.voteOptions : null,
          missionType: card.missionType,
          unlockCondition: card.unlockCondition,
          isAiGenerated: source === 'ai',
          generationSource: source === 'ai' ? 'ai_deepseek' : 'curated',
          aiRecommendReason: card.aiRecommendReason,
          personalizedFor: {
            archetypes: attendees.map(a => a.primaryArchetype).filter(Boolean),
            interests: Array.from(new Set(attendees.flatMap(a => a.interests || []))).slice(0, 10),
            industries: attendees.map(a => a.industryCategory).filter(Boolean),
          },
          roundNumber: round,
          displayOrder: i,
          isRevealed: false,
          interactionCount: 0,
          skipCount: 0,
        }).returning();
        
        savedCards.push(savedCard);
      }
      
      // Update or create game progress
      const [progress] = await db.select().from(icebreakerGameProgress).where(eq(icebreakerGameProgress.sessionId, session.id)).limit(1);
      
      if (!progress) {
        await db.insert(icebreakerGameProgress).values({
          sessionId: session.id,
          totalRounds: 5,
          roundDurationMinutes: 20,
          currentRound: round,
          roundStartedAt: new Date(),
          gameStartedAt: round === 1 ? new Date() : undefined,
          aiGenerationRatio: ratio,
          cardsPerRound: count,
          roundHistory: [{ round, startedAt: new Date(), cardsGenerated: cards.length }],
        });
      } else {
        // Update existing progress
        const history = (progress.roundHistory as any[]) || [];
        history.push({ round, startedAt: new Date(), cardsGenerated: cards.length });
        
        await db.update(icebreakerGameProgress)
          .set({
            currentRound: round,
            roundStartedAt: new Date(),
            roundHistory: history,
            updatedAt: new Date(),
          })
          .where(eq(icebreakerGameProgress.sessionId, session.id));
      }
      
      res.json({
        sessionId: session.id,
        cards: savedCards,
        roundNumber: round,
        totalCards: savedCards.length,
        aiGeneratedCount: sources.filter(s => s === 'ai').length,
        curatedCount: sources.filter(s => s === 'curated').length,
      });
    } catch (error) {
      console.error("Error generating icebreaker cards:", error);
      res.status(500).json({ message: "Failed to generate cards", error: String(error) });
    }
  });
  app.get('/api/icebreaker/game/cards/:sessionId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId } = req.params;
      const { roundNumber } = req.query;
      
      const { db } = await import('../../db');
      const { icebreakerGameCards, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      let query = db.select().from(icebreakerGameCards).where(eq(icebreakerGameCards.sessionId, sessionId));
      
      if (roundNumber) {
        query = db.select().from(icebreakerGameCards).where(
          and(
            eq(icebreakerGameCards.sessionId, sessionId),
            eq(icebreakerGameCards.roundNumber, parseInt(roundNumber))
          )
        );
      }
      
      const cards = await query.orderBy(icebreakerGameCards.roundNumber, icebreakerGameCards.displayOrder);
      
      res.json({ cards });
    } catch (error) {
      console.error("Error fetching icebreaker cards:", error);
      res.status(500).json({ message: "Failed to fetch cards" });
    }
  });
  app.post('/api/icebreaker/game/interact', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { cardId, sessionId, interactionType, voteOptionId, reaction } = req.body;
      
      if (!cardId || !sessionId || !interactionType) {
        return res.status(400).json({ message: "cardId, sessionId, and interactionType required" });
      }
      
      const { db } = await import('../../db');
      const { icebreakerCardInteractions, icebreakerGameCards, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      // Use transaction to prevent race conditions and ensure atomic updates
      await db.transaction(async (tx: DbTransaction) => {
        // For vote interactions, check for duplicate votes first
        if (interactionType === 'vote') {
          const existingVote = await tx
            .select()
            .from(icebreakerCardInteractions)
            .where(
              and(
                eq(icebreakerCardInteractions.cardId, cardId),
                eq(icebreakerCardInteractions.userId, userId),
                eq(icebreakerCardInteractions.interactionType, 'vote')
              )
            )
            .limit(1);
          
          if (existingVote.length > 0) {
            throw new Error('User has already voted on this card');
          }
        }
        
        // Record interaction
        await tx.insert(icebreakerCardInteractions).values({
          cardId,
          userId,
          sessionId,
          interactionType,
          voteOptionId,
          reaction,
        });
        
        // Lock the card row and update interaction counts atomically
        const [card] = await tx
          .select()
          .from(icebreakerGameCards)
          .where(eq(icebreakerGameCards.id, cardId))
          .limit(1)
          .for('update');
        
        if (card) {
          const newCount = (card.interactionCount || 0) + 1;
          const newSkipCount = interactionType === 'skip' ? (card.skipCount || 0) + 1 : card.skipCount;
          
          await tx
            .update(icebreakerGameCards)
            .set({ 
              interactionCount: newCount, 
              skipCount: newSkipCount,
              updatedAt: new Date(),
            })
            .where(eq(icebreakerGameCards.id, cardId));
          
          // For vote cards, update vote results under the same lock
          if (interactionType === 'vote' && voteOptionId && card.voteOptions) {
            const currentResults = (card.voteResults as Record<string, number>) || {};
            currentResults[voteOptionId] = (currentResults[voteOptionId] || 0) + 1;
            
            await tx
              .update(icebreakerGameCards)
              .set({ voteResults: currentResults })
              .where(eq(icebreakerGameCards.id, cardId));
          }
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording card interaction:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to record interaction";
      res.status(error instanceof Error && error.message.includes('already voted') ? 409 : 500)
        .json({ message: errorMessage });
    }
  });
  app.get('/api/icebreaker/game/progress/:sessionId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId } = req.params;
      
      const { db } = await import('../../db');
      const { icebreakerGameProgress, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      const [progress] = await db.select().from(icebreakerGameProgress).where(eq(icebreakerGameProgress.sessionId, sessionId)).limit(1);
      
      if (!progress) {
        return res.status(404).json({ message: "Game progress not found" });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching game progress:", error);
      res.status(500).json({ message: "Failed to fetch game progress" });
    }
  });
}
