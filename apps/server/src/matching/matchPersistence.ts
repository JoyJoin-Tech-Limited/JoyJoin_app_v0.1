/**
 * Match-result persistence: guarded transaction, group/event/attendance writes,
 * stranded-user marking, and post-commit side effects.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { db } from "../db";
import {
  blindBoxEvents,
  eventAttendance,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  events,
} from "@shared/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getFeatureFlag } from "../lib/featureFlags";
import { generateEventThemeTitle } from "../services/eventThemeTitleGenerator";
import { executePostMatchCommitSideEffects } from "../lib/matchingPostMatchEffects";
import type { MatchGroup, SaveMatchResultsOptions } from "./poolMatchingTypes";

/**
 * 保存匹配结果到数据库
 *
 * A: Core DB writes are wrapped in a single transaction so the pool can never
 *    be left in a partial state if any write fails mid-way.
 * B: An atomic pool-status CAS (active → matching) acts as an execution guard:
 *    only one matching run can commit for a given pool at a time.  If the guard
 *    is already held the call throws immediately and no duplicate groups are
 *    created.
 *
 * Side-effects that are intentionally kept OUTSIDE the transaction:
 *   - WebSocket notifications (cannot be rolled back, sent after commit)
 *   - Venue assignment (best-effort, non-critical)
 *   - Async theme generation / title broadcast (fire-and-forget)
 *   - Invitation reward coupons (best-effort, separate idempotency guard)
 */
export async function saveMatchResults(
  poolId: string,
  groups: MatchGroup[],
  options?: SaveMatchResultsOptions,
): Promise<void> {
  // 获取活动池信息用于通知
  const [pool] = await db.select().from(eventPools).where(eq(eventPools.id, poolId));

  if (!pool) {
    throw new Error(`[Pool Matching] Pool not found: ${poolId}`);
  }

  // B: Execution guard — atomically set status from 'active' to 'matching'.
  // If 0 rows are updated another run is already in progress; bail out safely.
  const guardResult = await db
    .update(eventPools)
    .set({ status: "matching", updatedAt: new Date() })
    .where(and(eq(eventPools.id, poolId), eq(eventPools.status, "active")))
    .returning({ id: eventPools.id });

  if (guardResult.length === 0) {
    throw new Error(`[Pool Matching] Guard rejected: pool ${poolId} is not in 'active' state — concurrent or duplicate run prevented`);
  }

  const operatorReviewEnabled = await getFeatureFlag('matchingOperatorReviewEnabled', false);
  if (operatorReviewEnabled) {
    logger.info(`[Pool Matching] Operator review enabled for pool ${poolId}; groups will be held pending review`);
  }
  // Precompute theme-title metadata outside the transaction so DB locks are held
  // only during the actual persistence work.
  const themeMetadata = await Promise.all(groups.map(async (group, i) => {
    const memberUserIds = group.members.map(m => m.userId);
    try {
      const themeTitleResult = await generateEventThemeTitle(memberUserIds, poolId);
      logger.info(`[Pool Matching] Generated event theme title for group ${i + 1}: ${themeTitleResult.eventThemeTitle} - ${themeTitleResult.themeTagline} ${themeTitleResult.emoji}`);
      return {
        eventThemeTitle: themeTitleResult.eventThemeTitle,
        themeTagline: themeTitleResult.themeTagline,
        themeEmoji: themeTitleResult.emoji,
        themeReasoning: themeTitleResult.reasoning,
      };
    } catch (error) {
      logger.error(`[Pool Matching] Failed to generate event theme title for group ${i + 1}:`, { error: error instanceof Error ? error.message : String(error) });
      return {
        eventThemeTitle: null,
        themeTagline: null,
        themeEmoji: null,
        themeReasoning: null,
      };
    }
  }));

  // Collect per-group data needed for WebSocket notifications (populated inside tx)
  // and fire-and-forget theme generation tasks are rebuilt in the shared side-effect
  // runner so the same runner can be invoked from admin approval.
  const persistedGroupIds: string[] = [];

  try {
    // A: Single transaction wrapping all core DB mutations
    await (db as any).transaction(async (tx: any) => {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const memberUserIds = group.members.map(m => m.userId);
        const { eventThemeTitle, themeTagline, themeEmoji, themeReasoning } = themeMetadata[i];
        const predictiveAudit = options?.predictiveRerankSummary?.audits?.find(
          (audit) => audit.finalRank === i + 1,
        );

        // 1. 创建小组记录
        const [groupRecord] = await tx.insert(eventPoolGroups).values({
          poolId,
          groupNumber: i + 1,
          memberCount: group.members.length,
          avgChemistryScore: group.avgChemistryScore,
          diversityScore: group.diversityScore,
          communicationBalance: group.communicationBalance,
          overallScore: group.overallScore,
          temperatureLevel: group.temperatureLevel,
          matchExplanation: group.explanation,
          predictiveExperimentArm: options?.predictiveExperimentArm ?? null,
          predictiveModelVersion: options?.predictiveRerankSummary?.modelVersion ?? null,
          predictiveRerankApplied: options?.predictiveRerankApplied ?? false,
          predictiveRerankAudit: predictiveAudit ? {
            ...predictiveAudit,
            experimentArm: options?.predictiveExperimentArm ?? null,
            applied: options?.predictiveRerankApplied ?? false,
            confidenceThreshold: options?.predictiveRerankSummary?.confidenceThreshold ?? null,
            maxPositionShift: options?.predictiveRerankSummary?.maxPositionShift ?? null,
            reason: options?.predictiveRerankSummary?.reason ?? null,
            autoDisabledReason: options?.predictiveRerankSummary?.autoDisabledReason ?? null,
          } : null,
          theme: eventThemeTitle,
          subtitle: themeTagline,
          themeEmoji: themeEmoji,
          themeReasoning: themeReasoning,
          themeGeneratedAt: (eventThemeTitle || themeTagline || themeEmoji || themeReasoning) ? new Date() : null,
          status: "confirmed",
          operatorReviewStatus: operatorReviewEnabled ? "pending" : "none",
        }).returning();
        if (groupRecord?.id) {
          persistedGroupIds.push(groupRecord.id);
        }

        // 2. 更新用户报名状态
        const memberRegistrationIds = group.members.map(m => m.registrationId);
        await tx.update(eventPoolRegistrations)
          .set({
            matchStatus: operatorReviewEnabled ? "pending" : "matched",
            assignedGroupId: groupRecord.id,
            matchScore: group.overallScore,
            updatedAt: new Date()
          })
          .where(inArray(eventPoolRegistrations.id, memberRegistrationIds));

        // 2.5 创建对应的events记录
        const location = pool?.district ? `${pool.city} ${pool.district}` : pool?.city || "待定";
        const [eventRecord] = await tx.insert(events).values({
          title: `${pool?.title || "盲盒活动"} - 第${i + 1}组`,
          description: `来自活动池匹配：${pool?.description || ""}\n匹配分数: ${group.overallScore}\n化学反应: ${group.temperatureLevel}`,
          dateTime: pool?.dateTime || new Date(),
          location: location,
          area: pool?.district || null,
          maxAttendees: group.members.length,
          currentAttendees: group.members.length,
          hostId: pool?.createdBy || null,
          status: "matched",
          iconName: pool?.eventType === "饭局" ? "utensils" : pool?.eventType === "酒局" ? "wine" : "calendar",
        }).returning();

        // 2.6 为每个成员创建eventAttendance记录（批量插入，避免 N+1）
        if (group.members.length > 0) {
          await tx.insert(eventAttendance).values(
            group.members.map((member) => ({
              eventId: eventRecord.id,
              userId: member.userId,
              status: "confirmed",
            })),
          );
        }

        // 2.7 创建blind_box_events记录（确保确认出席流程可用）
        const [blindBoxEventRecord] = await tx.insert(blindBoxEvents).values({
          poolId,
          userId: memberUserIds[0] || pool.createdBy || "",
          title: pool?.title ?? "盲盒匹配活动",
          eventType: pool?.eventType ?? "饭局",
          city: pool?.city ?? "",
          district: pool?.district ?? "",
          dateTime: pool?.dateTime ?? new Date(),
          budgetTier: pool?.budgetTier ?? "",
          status: "matched",
          progress: 100,
          currentParticipants: group.members.length,
          totalParticipants: group.members.length,
          matchedAttendees: group.members.map((m) => ({
            userId: m.userId,
            archetype: m.archetype,
          })),
          matchExplanation: group.explanation ?? null,
        }).returning();

        // 2.8 将生成的 events / blind_box_events 记录关联到小组，便于拒绝时清理
        await tx.update(eventPoolGroups)
          .set({
            eventId: eventRecord.id,
            blindBoxEventId: blindBoxEventRecord?.id ?? null,
            updatedAt: new Date(),
          })
          .where(eq(eventPoolGroups.id, groupRecord.id));


        logger.info(`[Pool Matching] Created event ${eventRecord.id} for group ${i + 1} with ${memberUserIds.length} attendees`);
      }

      // 4. 更新活动池状态 → 'matched'
      await tx.update(eventPools)
        .set({
          status: "matched",
          successfulMatches: groups.reduce((sum, g) => sum + g.members.length, 0),
          matchedAt: new Date(),
          updatedAt: new Date(),
          operatorReviewStatus: operatorReviewEnabled ? "pending" : "none",
        })
        .where(eq(eventPools.id, poolId));

      // 5. 标记未匹配用户
      // Only mark the truly stranded: registrations still pending AND not
      // assigned to any group in step 2. With the operator-review gate enabled,
      // step 2 leaves matched members at 'pending' too — without the
      // assignedGroupId-IS-NULL guard this step would flip them to 'unmatched',
      // wiping the group out of the 足迹 list and breaking confirm-attendance.
      await tx.update(eventPoolRegistrations)
        .set({
          matchStatus: "unmatched",
          updatedAt: new Date()
        })
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending"),
            isNull(eventPoolRegistrations.assignedGroupId)
          )
        );
    });
  } catch (error) {
    logger.error(`[Pool Matching] Transaction failed for pool ${poolId}, resetting status`, { error: String(error) });
    // If the transaction failed, reset the pool status back to 'active' so it can be retried.
    // (If the guard CAS succeeded but the tx failed, status is still 'matching' — we reset it.)
    try {
      await db.update(eventPools)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(eventPools.id, poolId));
    } catch (resetErr) {
      logger.error(`[Pool Matching] ⚠️ Failed to reset pool status after transaction error:`, { error: resetErr instanceof Error ? resetErr.message : String(resetErr) });
    }
    throw error;
  }

  // ── Post-commit side effects ──────────────────────────────────────────────
  // When operator review is enabled, groups are persisted but the matching is not
  // finalized. Side effects run only after an operator approves the review.
  if (operatorReviewEnabled) {
    logger.info(`[Pool Matching] Pool ${poolId} held for operator review; skipping notifications, venue assignment and invitation rewards`);
    return;
  }

  await executePostMatchCommitSideEffects(poolId, groups, persistedGroupIds, pool);
}
