import { db } from "./db";
import {
  coupons,
  eventPoolRegistrations,
  invitationUses,
  invitations,
  userCoupons,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./lib/logger";
import type { MatchGroup } from "./poolMatchingService";

/**
 * 处理邀请奖励：为成功匹配的邀请关系发放优惠券
 */
export async function processInvitationRewards(
  poolId: string,
  groups: MatchGroup[],
): Promise<void> {
  // 查找邀请奖励优惠券（管理员需要预先创建code为"INVITE_REWARD"的优惠券）
  const [inviteRewardCoupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, "INVITE_REWARD"))
    .limit(1);

  if (!inviteRewardCoupon || !inviteRewardCoupon.isActive) {
    logger.info(
      "[Invitation Reward] No active INVITE_REWARD coupon found, skipping rewards",
    );
    return;
  }

  // 获取该pool的所有成功匹配的用户
  const allMatchedUserIds = groups.flatMap((g) =>
    g.members.map((m) => m.userId),
  );

  // 查找所有涉及该pool的邀请使用记录
  const poolRegistrations = await db
    .select()
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId));

  const registrationIds = poolRegistrations.map((r: any) => r.id);

  if (registrationIds.length === 0) return;

  const inviteUses = await db
    .select()
    .from(invitationUses)
    .where(inArray(invitationUses.poolRegistrationId, registrationIds));

  type InviteUseRow = typeof inviteUses[number];

  // Batch-load all invitations referenced by eligible inviteUses
  const eligibleInviteUses = inviteUses.filter(
    (iu: InviteUseRow) => !iu.rewardIssued && iu.invitationId,
  );
  const invitationIds = eligibleInviteUses.map((iu: InviteUseRow) => iu.invitationId!);
  const invitationRows =
    invitationIds.length > 0
      ? await db
          .select()
          .from(invitations)
          .where(inArray(invitations.id, invitationIds))
      : [];
  interface InvitationRow {
    id: string;
    inviterId: string;
  }
  const invitationMap = new Map(
    (invitationRows as InvitationRow[]).map((inv) => [inv.id, inv]),
  );

  // 对于每个邀请使用记录，检查是否成功匹配到同一局
  for (const inviteUse of eligibleInviteUses) {
    const invitation = invitationMap.get(inviteUse.invitationId!);
    if (!invitation) continue;

    const inviterId = invitation.inviterId;
    const inviteeId = inviteUse.inviteeId;

    // 检查inviter和invitee是否都在匹配用户列表中
    if (
      !allMatchedUserIds.includes(inviterId) ||
      !allMatchedUserIds.includes(inviteeId)
    ) {
      continue;
    }

    // 检查他们是否在同一个group中
    let matchedTogether = false;
    for (const group of groups) {
      const groupUserIds = group.members.map((m) => m.userId);
      if (
        groupUserIds.includes(inviterId) &&
        groupUserIds.includes(inviteeId)
      ) {
        matchedTogether = true;
        break;
      }
    }

    if (matchedTogether) {
      // 发放优惠券给邀请人
      try {
        await db.insert(userCoupons).values({
          userId: inviterId,
          couponId: inviteRewardCoupon.id,
          source: "invitation_reward",
          sourceId: invitation.id,
          isUsed: false,
        });

        // 标记奖励已发放
        await db
          .update(invitationUses)
          .set({
            matchedTogether: true,
            rewardIssued: true,
            matchedAt: new Date(),
          })
          .where(eq(invitationUses.id, inviteUse.id));

        logger.info(
          `[Invitation Reward] Issued coupon to user ${inviterId} for inviting ${inviteeId}`,
        );
      } catch (error) {
        logger.error(
          `[Invitation Reward] Failed to issue coupon:`,
          { error: String(error) },
        );
      }
    }
  }
}
