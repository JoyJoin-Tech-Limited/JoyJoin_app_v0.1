import { eventPools } from "@shared/schema";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";
import { wsService } from "../wsService";
import type { PoolMatchedData } from "@shared/wsEvents";
import { notificationsRepo } from "../repositories/notificationsRepo";
import { generateAndSaveEventTheme } from "../eventThemeGeneratorService";
import { processInvitationRewards } from "../poolMatchingInvitationRewards";
import { assignVenuesToGroups, saveVenueAssignments } from "../venueAssignmentService";
import { notifyPoolMatched, notifyVenueAssignmentResult } from "./wecomNotifications/matching";
import type { MatchGroup } from "../poolMatchingService";

/**
 * Run all post-match commit side effects. This is shared between the normal
 * saveMatchResults flow and the operator-review approval flow so that side
 * effects (notifications, venue assignment, invitation rewards) are only ever
 * triggered once the formed groups are finalized.
 */
export async function executePostMatchCommitSideEffects(
  poolId: string,
  groups: MatchGroup[],
  groupIds: string[],
  pool: typeof eventPools.$inferSelect,
): Promise<void> {
  if (groupIds.length !== groups.length) {
    logger.warn(
      `[Pool Matching] Group ID count mismatch for pool ${poolId}: ${groupIds.length} IDs vs ${groups.length} groups; falling back to available IDs`
    );
  }

  const notificationQueue: Array<{ memberUserIds: string[]; notificationData: PoolMatchedData }> = [];
  const themeGenTasks: Array<{ groupId: string; memberUserIds: string[] }> = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupId = groupIds[i];
    if (!groupId) {
      logger.warn(`[Pool Matching] Could not find group ID for group ${i + 1} in pool ${poolId}; skipping notification`);
      continue;
    }
    const memberUserIds = group.members.map((m) => m.userId);
    notificationQueue.push({
      memberUserIds,
      notificationData: {
        poolId,
        poolTitle: pool.title || "活动池",
        groupId,
        groupNumber: i + 1,
        matchScore: group.overallScore,
        memberCount: group.members.length,
        temperatureLevel: group.temperatureLevel,
      },
    });
    themeGenTasks.push({ groupId, memberUserIds });
  }

  // 3. 发送WebSocket通知 and persist DB notifications (outside transaction)
  for (const { memberUserIds, notificationData } of notificationQueue) {
    memberUserIds.forEach((userId) => {
      wsService.broadcastToUser(userId, {
        type: "POOL_MATCHED",
        data: notificationData,
        timestamp: new Date().toISOString(),
      });
    });
    logger.info(`[Pool Matching] Sent POOL_MATCHED notification to ${memberUserIds.length} users for group ${notificationData.groupNumber}`);

    // Persist match_success notifications so badge counts update
    try {
      await Promise.all(
        memberUserIds.map((userId) =>
          notificationsRepo.createNotification({
            userId,
            category: "activities",
            type: "match_success",
            title: "匹配成功！",
            message: `你在「${notificationData.poolTitle}」的桌友匹配已完成，去看看你的新伙伴吧`,
            relatedResourceId: notificationData.groupId,
          })
        )
      );
      logger.info(`[Pool Matching] Created match_success notifications for ${memberUserIds.length} users`);
    } catch (notificationError) {
      logger.error("[Pool Matching] Failed to create match_success notifications", {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
      });
    }
  }

  // 1.5 Generate and save event themes (fire-and-forget)
  for (const { groupId, memberUserIds } of themeGenTasks) {
    generateAndSaveEventTheme(groupId, memberUserIds, poolId)
      .then(() => logger.info(`[Pool Matching] ✅ Generated event theme for group ${groupId}`))
      .catch((err: unknown) => logger.error(`[Pool Matching] ⚠️ Theme generation failed for group ${groupId}:`, { error: err instanceof Error ? err.message : String(err) }));
  }

  // 6. 发放邀请奖励优惠券 (Invitation Reward Coupons)
  try {
    await processInvitationRewards(poolId, groups);
    logger.info(`[Pool Matching] ✅ Invitation rewards processed for pool ${poolId}`);
  } catch (error) {
    logger.error(`[Pool Matching] ⚠️ Failed to process invitation rewards for pool ${poolId}:`, { error: error instanceof Error ? error.message : String(error) });
  }

  // 7. 自动分配场地 (Automatic Venue Assignment)
  const venueAssignmentEnabled = await getFeatureFlag("venueAssignmentEnabled", true);

  if (venueAssignmentEnabled) {
    logger.info(`[Pool Matching] ✅ ${groups.length} groups created, starting venue assignment...`);

    try {
      const { assignments, unassigned } = await assignVenuesToGroups(
        groups,
        poolId,
        pool?.dateTime || new Date(),
        pool?.city || "",
        pool?.district,
        pool?.eventType || "饭局"
      );

      // Save venue assignments to database
      await saveVenueAssignments(
        poolId,
        pool?.dateTime || new Date(),
        assignments,
        unassigned,
        pool ? { title: pool.title, city: pool.city, district: pool.district } : undefined
      );

      logger.info(`[Pool Matching] ✅ Venue assignment complete: ${assignments.size}/${groups.length} groups assigned, ${unassigned.size} unassigned`);

      // Venue assignment result WeCom notification (fire-and-forget)
      void (async () => {
        try {
          const venueEntries = Array.from(assignments.entries());
          const unassignedEntries = Array.from(unassigned.entries());
          const topVenue = venueEntries.length > 0 ? venueEntries[0][1].venue.brandName || venueEntries[0][1].venue.name : undefined;
          const uniqueVenues = new Set(venueEntries.map(([, a]) => a.venue.brandName || a.venue.name)).size;
          const reasonBreakdown: Record<string, number> = {};
          for (const [, reason] of unassignedEntries) {
            reasonBreakdown[reason] = (reasonBreakdown[reason] || 0) + 1;
          }
          const reasonSummary = Object.entries(reasonBreakdown)
            .map(([r, c]) => `${r}: ${c}组`).join("; ");

          await notifyVenueAssignmentResult({
            poolTitle: pool?.title || poolId,
            poolDate: pool?.dateTime ? new Date(pool.dateTime).toLocaleString("zh-CN") : "待定",
            poolId,
            venuesAssigned: assignments.size,
            venuesUnassigned: unassigned.size,
            totalGroups: groups.length,
            topVenueName: topVenue,
            uniqueVenueCount: uniqueVenues > 0 ? uniqueVenues : undefined,
            unassignedReasonBreakdown: unassigned.size > 0 ? reasonSummary : undefined,
          });
        } catch (err) {
          logger.warn("[Pool Matching] ⚠️ Venue assignment result notification failed", { error: String(err) });
        }
      })();

      // Send venue-assignment notifications to group members
      void (async () => {
        try {
          for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const groupNum = i + 1;
            const assignment = assignments.get(groupNum);
            const unassignedReason = unassigned.get(groupNum);
            const memberUserIds = group.members.map((m) => m.userId);

            if (assignment) {
              await Promise.all(
                memberUserIds.map((userId) =>
                  notificationsRepo.createNotification({
                    userId,
                    category: "activities",
                    type: "venue_assigned",
                    title: "场地已确定",
                    message: `活动场地：${assignment.venue.brandName || assignment.venue.name}，地址：${assignment.venue.address || "详见活动页"}`,
                    relatedResourceId: poolId,
                  })
                )
              );
            } else if (unassignedReason) {
              await Promise.all(
                memberUserIds.map((userId) =>
                  notificationsRepo.createNotification({
                    userId,
                    category: "activities",
                    type: "venue_tbd",
                    title: "地点待定",
                    message: "我们正在为您协调最佳场地，活动前会通知您具体地点",
                    relatedResourceId: poolId,
                  })
                )
              );
            }
          }
        } catch (notifyErr) {
          logger.warn("[Pool Matching] Venue assignment notification failed", { error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr) });
        }
      })();
    } catch (error) {
      logger.error(`[Pool Matching] ⚠️ Venue assignment failed:`, { error: error instanceof Error ? error.message : String(error) });
      // Don't throw - matching already succeeded, venue assignment is best-effort
    }
  } else {
    logger.info(`[Pool Matching] ⏸️ Venue assignment skipped (VENUE_ASSIGNMENT_ENABLED=false)`);
  }

  // Pool matching notification (fire-and-forget)
  void (async () => {
    try {
      const totalMatched = groups.reduce((sum, g) => sum + g.members.length, 0);
      const totalRegistrations = pool?.totalRegistrations ?? totalMatched;
      const unmatched = Math.max(0, totalRegistrations - totalMatched);
      const overallScore = groups.length > 0
        ? groups.reduce((sum, g) => sum + g.overallScore, 0) / groups.length
        : 0;
      const chemScore = groups.length > 0
        ? groups.reduce((sum, g) => sum + g.avgChemistryScore, 0) / groups.length
        : 0;
      const maleC = groups.flatMap((g) => g.members).filter((m: any) => m.gender === "男性").length;
      const femaleC = groups.flatMap((g) => g.members).filter((m: any) => m.gender === "女性").length;

      await notifyPoolMatched({
        poolTitle: pool?.title || "未知活动",
        poolDate: pool?.dateTime ? new Date(pool.dateTime).toLocaleString("zh-CN") : "待定",
        totalRegistrations,
        matchedCount: totalMatched,
        unmatchedCount: unmatched,
        groupsFormed: groups.length,
        avgOverallScore: overallScore,
        avgChemistryScore: chemScore,
        genderBalanceSummary: `${maleC}♂ ${femaleC}♀`,
        matchDurationMin: 0,
        poolId,
      });
    } catch (err: any) {
      logger.error(`[Pool Matching] ⚠️ Matching notification failed:`, { error: String(err) });
    }
  })();

  // 8. 异步生成活动主题标题并广播 (Async Event Theme Title Generation & Broadcast)
  setImmediate(() => {
    void (async () => {
      logger.info(`[Pool Matching] Starting async event theme title generation for ${groups.length} groups...`);

      try {
        const { generateAndAssignEventThemeTitle } = await import("../eventThemeTitleGenerator");

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const groupId = groupIds[i];

          if (!groupId) continue;

          try {
            const themeTitleResult = await generateAndAssignEventThemeTitle(
              groupId,
              group,
              pool?.eventType || "饭局"
            );

            if (themeTitleResult) {
              const memberUserIds = group.members.map((m) => m.userId);

              memberUserIds.forEach((userId) => {
                wsService.broadcastToUser(userId, {
                  type: "EVENT_THEME_TITLE_REVEALED",
                  data: {
                    poolId,
                    groupId,
                    eventThemeTitle: themeTitleResult.eventThemeTitle,
                    themeTagline: themeTitleResult.themeTagline,
                    themeEmoji: themeTitleResult.themeEmoji,
                    themeHighlights: themeTitleResult.themeHighlights,
                    themeVibe: themeTitleResult.themeVibe,
                  },
                  timestamp: new Date().toISOString(),
                });
              });

              logger.info(`[Pool Matching] ✅ Event theme title revealed for group ${i + 1}: ${themeTitleResult.themeEmoji} ${themeTitleResult.eventThemeTitle}`);
            }
          } catch (error) {
            logger.error(`[Pool Matching] ⚠️ Event theme title generation failed for group ${i + 1}:`, { error: error instanceof Error ? error.message : String(error) });
          }
        }
      } catch (error) {
        logger.error(`[Pool Matching] ⚠️ Async event theme title generation failed:`, { error: error instanceof Error ? error.message : String(error) });
      }
    })();
  });
}
