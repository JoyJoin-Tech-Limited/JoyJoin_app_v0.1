import { logger } from "../../lib/logger";
import type { Express } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { aiEndpointLimiter } from "../../rateLimiter";
import { db } from "../../db";
import {
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  users,
  userInterests,
  blindBoxEvents,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { loadInterestSignalsByUserIds } from "./helpers";

export function registerMatchExplanationRoutes(app: Express): void {
  // ============ Match Explanation & Ice-Breaker API ============

  // Get match explanations for an event pool group
  app.get('/api/event-pool-groups/:groupId/match-explanations', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the group
      const group = await db.query.eventPoolGroups.findFirst({
        where: eq(eventPoolGroups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Check if user is in this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, groupId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }

      // Get all group members
      const groupMembers = await db.query.eventPoolRegistrations.findMany({
        where: eq(eventPoolRegistrations.assignedGroupId, groupId),
      });

      // Get full user info for group members
      const memberIds = groupMembers.map((m: any) => m.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
      });

      const { matchExplanationService } = await import('../../matchExplanationService');

      // Load user interests (with heat levels) for deep interest overlap detection
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );
      const registrationByUserId = new Map<string, { eventIntent?: string[] | null }>(
        groupMembers.map((r: any) => [r.userId as string, r] as const)
      );

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level: number }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;
        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
          intent: m.intent ?? null,
          eventIntent: registrationByUserId.get(m.id)?.eventIntent ?? null,
        };
      });

      // Get event pool info for event type
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, group.poolId),
      });

      const groupAnalysis = await matchExplanationService.generateGroupAnalysis(
        groupId,
        matchMembers,
        pool?.eventType || '饭局'
      );

      res.json({
        groupId,
        overallChemistry: groupAnalysis.overallChemistry,
        groupDynamics: groupAnalysis.groupDynamics,
        explanations: groupAnalysis.pairExplanations,
        iceBreakers: groupAnalysis.iceBreakers,
        meta: {
          generatedAt: groupAnalysis.generatedAt,
          fromCache: groupAnalysis.fromCache,
          provider: groupAnalysis.provider,
          fallbackUsed: groupAnalysis.fallbackUsed,
          promptVersion: groupAnalysis.promptVersion,
        },
      });
    } catch (error: any) {
      logger.error('[Match Explanations] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate match explanations', error: error.message });
    }
  });

  // Get ice-breakers for an event pool group (part of 活动工具包)
  app.get('/api/event-pool-groups/:groupId/ice-breakers', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the group
      const group = await db.query.eventPoolGroups.findFirst({
        where: eq(eventPoolGroups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Check membership
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, groupId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }

      // Get group members
      const groupMembers = await db.query.eventPoolRegistrations.findMany({
        where: eq(eventPoolRegistrations.assignedGroupId, groupId),
      });

      const memberIds = groupMembers.map((m: any) => m.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
      });
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);

      const { matchExplanationService } = await import('../../matchExplanationService');

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level?: number | null }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;

        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
        };
      });

      // Get event pool info for event type
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, group.poolId),
      });

      const iceBreakerResult = await matchExplanationService.generateIceBreakers(
        matchMembers,
        pool?.eventType || '饭局'
      );

      res.json({
        iceBreakers: iceBreakerResult.iceBreakers,
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
        promptVersion: iceBreakerResult.promptVersion,
        meta: {
          generatedAt: new Date().toISOString(),
          fromCache: false,
          provider: iceBreakerResult.providerUsed,
          fallbackUsed: iceBreakerResult.fallbackUsed,
          promptVersion: iceBreakerResult.promptVersion,
        },
      });
    } catch (error: any) {
      logger.error('[Ice-Breakers] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate ice-breakers', error: error.message });
    }
  });

  // Match explanations for blind box events (using matchedAttendees field)

  // Conversation topics for event participants (DeepSeek AI)
  app.post('/api/events/:eventId/conversation-topics', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Try to find blind box event first
      const blindBoxEvent = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!blindBoxEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Verify user is a participant
      const matchedAttendees = blindBoxEvent.matchedAttendees as any[];
      const isParticipant = blindBoxEvent.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this event' });
      }

      // SECURITY: Only use validated participant IDs from the event data
      // Never trust caller-provided userIds to prevent data exfiltration
      const validParticipantIds = matchedAttendees?.map((a: any) => a.userId) || [];
      
      if (validParticipantIds.length === 0) {
        return res.json({
          topics: [],
          commonInterests: [],
          generatedAt: new Date().toISOString(),
        });
      }

      // Only fetch minimal profile data needed for topic generation
      const participants = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${validParticipantIds})`,
        columns: {
          id: true,
          displayName: true,
          archetype: true,
          interestsTop: true,
          topicsHappy: true,
          topicsAvoid: true,
        },
      });
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(validParticipantIds);

      const { generateConversationTopics } = await import('../../conversationTopicsService');
      
      const profiles = participants.map((p: any) => ({
        displayName: p.displayName || '嘉宾',
        archetype: p.archetype,
        interests: p.interestsTop || undefined,
        topicsHappy: p.topicsHappy || undefined,
        topicsAvoid: p.topicsAvoid || undefined,
        interestSignals: interestSignalsByUserId.get(p.id) ?? undefined,
      }));

      const result = await generateConversationTopics(profiles, blindBoxEvent.eventType || '饭局');
      res.json(result);
    } catch (error: any) {
      logger.error('[Conversation Topics] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate conversation topics', error: error.message });
    }
  });

  // Profile spotlight for tablemates (auth-gated, limited to event participants)
  app.get('/api/events/:eventId/spotlight/:targetUserId', requireAuth, async (req: any, res) => {
    try {
      const { eventId, targetUserId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the blind box event
      const blindBoxEvent = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!blindBoxEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Verify requesting user is a participant
      const matchedAttendees = blindBoxEvent.matchedAttendees as any[];
      const isParticipant = blindBoxEvent.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this event' });
      }

      // SECURITY: Only allow viewing profiles of event participants
      const isTargetParticipant = blindBoxEvent.userId === targetUserId ||
        matchedAttendees?.some((a: any) => a.userId === targetUserId);

      if (!isTargetParticipant) {
        return res.status(403).json({ message: 'Target user is not a participant' });
      }

      // Fetch minimal profile data for spotlight
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        columns: {
          id: true,
          displayName: true,
          archetype: true,
          secondaryArchetype: true,
          industry: true,
          interestsTop: true,
          socialStyle: true,
          ageVisibility: true,
          workVisibility: true,
          birthdate: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate age based on visibility preference
      let age: number | undefined;
      let ageRange: string | undefined;
      
      if (targetUser.birthdate && targetUser.ageVisibility !== 'hide_all') {
        const birthDate = new Date(targetUser.birthdate + 'T00:00:00');
        const today = new Date();
        const exactAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        const adjustedAge = (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) ? exactAge - 1 : exactAge;
        
        // PRIVACY: Only show age range, never exact age
        if (targetUser.ageVisibility === 'show_age_range') {
          // Calculate age range (e.g., "25-29", "30-34")
          const lowerBound = Math.floor(adjustedAge / 5) * 5;
          const upperBound = lowerBound + 4;
          ageRange = `${lowerBound}-${upperBound}`;
        }
      }

      res.json({
        profile: {
          userId: targetUser.id,
          displayName: targetUser.displayName || '神秘嘉宾',
          archetype: targetUser.archetype,
          secondaryArchetype: targetUser.secondaryArchetype,
          industry: targetUser.workVisibility !== 'hide_all' ? targetUser.industry : undefined,
          ageRange: ageRange,
          interests: targetUser.interestsTop || [],
          socialStyle: targetUser.socialStyle,
          ageVisible: targetUser.ageVisibility !== 'hide_all',
          industryVisible: targetUser.workVisibility !== 'hide_all',
        },
      });
    } catch (error: any) {
      logger.error('[Profile Spotlight] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
    }
  });

  // Admin endpoint to regenerate explanations for an event pool
  app.post('/api/admin/event-pools/:poolId/regenerate-explanations', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { poolId } = req.params;

      // Get all groups in this pool
      const groups = await db.query.eventPoolGroups.findMany({
        where: eq(eventPoolGroups.poolId, poolId),
      });

      if (groups.length === 0) {
        return res.status(404).json({ message: 'No groups found for this pool' });
      }

      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, poolId),
      });

      const { matchExplanationService } = await import('../../matchExplanationService');
      const allAnalyses = [];

      for (const group of groups) {
        const groupMembers = await db.query.eventPoolRegistrations.findMany({
          where: eq(eventPoolRegistrations.assignedGroupId, group.id),
        });

        const memberIds = groupMembers.map((m: any) => m.userId);
        const members = await db.query.users.findMany({
          where: sql`${users.id} = ANY(${memberIds})`,
        });
        const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);
        const registrationByUserId = new Map<string, { eventIntent?: string[] | null }>(
          groupMembers.map((r: any) => [r.userId as string, r] as const)
        );

        const matchMembers = members.map((m: any) => ({
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
          intent: m.intent ?? null,
          eventIntent: registrationByUserId.get(m.id)?.eventIntent ?? null,
        }));

        const analysis = await matchExplanationService.generateGroupAnalysis(
          group.id,
          matchMembers,
          pool?.eventType || '饭局'
        );

        allAnalyses.push({
          ...analysis,
          groupNumber: group.groupNumber,
        });
      }

      res.json({
        poolId,
        groupCount: allAnalyses.length,
        analyses: allAnalyses,
      });
    } catch (error: any) {
      logger.error('[Admin Match Explanations] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to regenerate explanations', error: error.message });
    }
  });

}
