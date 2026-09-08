/**
 * Admin read-models for the invite/referral domain.
 *
 * Backing tables (packages/shared/src/schema/_definitions.ts):
 *   invitations          — event-scoped + pool-scoped (duo) invite links
 *   invitation_uses      — one row per successful invite acceptance
 *   referral_codes       — permanent per-user referral code
 *   referral_conversions — one row per referral signup conversion
 *
 * All queries are aggregate/grouped SQL — no row-by-row loops.
 */

import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  eventPools,
  invitationUses,
  invitations,
  referralCodes,
  referralConversions,
  users,
} from "@shared/schema";

export interface ReferralStats {
  invitations: {
    totalSent: number;
    totalClicks: number;
    totalUses: number;
    matchedTogether: number;
    duoInvites: number;
  };
  referrals: {
    totalCodes: number;
    totalClicks: number;
    totalConversions: number;
    inviterRewardsIssued: number;
    inviteeRewardsIssued: number;
  };
  funnel: {
    invitationClickToUse: number | null;
    referralClickToConversion: number | null;
  };
  abuse: {
    selfInvitationUses: number;
    selfReferralConversions: number;
    totalSelfReferralFlags: number;
  };
  topInviters: Array<{ userId: string; displayName: string | null; count: number }>;
  topReferrers: Array<{ userId: string; displayName: string | null; count: number }>;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export async function getReferralStats(): Promise<ReferralStats> {
  const [
    invitationTotals,
    invitationUseTotals,
    referralCodeTotals,
    referralConversionTotals,
    topInviterRows,
    topReferrerRows,
    selfInvitationRows,
    selfReferralRows,
  ] = await Promise.all([
    db
      .select({
        totalSent: sql<number>`count(*)::int`,
        totalClicks: sql<number>`coalesce(sum(${invitations.totalClicks}), 0)::int`,
        duoInvites: sql<number>`count(*) filter (where ${invitations.invitationType} = 'duo')::int`,
      })
      .from(invitations),
    db
      .select({
        totalUses: sql<number>`count(*)::int`,
        matchedTogether: sql<number>`count(*) filter (where ${invitationUses.matchedTogether})::int`,
      })
      .from(invitationUses),
    db
      .select({
        totalCodes: sql<number>`count(*)::int`,
        totalClicks: sql<number>`coalesce(sum(${referralCodes.totalClicks}), 0)::int`,
      })
      .from(referralCodes),
    db
      .select({
        totalConversions: sql<number>`count(*)::int`,
        inviterRewardsIssued: sql<number>`count(*) filter (where ${referralConversions.inviterRewardIssued})::int`,
        inviteeRewardsIssued: sql<number>`count(*) filter (where ${referralConversions.inviteeRewardIssued})::int`,
      })
      .from(referralConversions),
    // Top 20 inviters by actual acceptances (invitation_uses), not links created.
    db
      .select({
        userId: invitations.inviterId,
        displayName: users.displayName,
        count: sql<number>`count(*)::int`,
      })
      .from(invitationUses)
      .innerJoin(invitations, eq(invitationUses.invitationId, invitations.id))
      .leftJoin(users, eq(invitations.inviterId, users.id))
      .groupBy(invitations.inviterId, users.displayName)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    // Top 20 referral-code owners by conversions.
    db
      .select({
        userId: referralCodes.userId,
        displayName: users.displayName,
        count: sql<number>`count(*)::int`,
      })
      .from(referralConversions)
      .innerJoin(referralCodes, eq(referralConversions.referralCodeId, referralCodes.id))
      .leftJoin(users, eq(referralCodes.userId, users.id))
      .groupBy(referralCodes.userId, users.displayName)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    // Abuse signal: inviter accepted their own invite.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitationUses)
      .innerJoin(invitations, eq(invitationUses.invitationId, invitations.id))
      .where(sql`${invitations.inviterId} = ${invitationUses.inviteeId}`),
    // Abuse signal: referral code owner converted themselves.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralConversions)
      .innerJoin(referralCodes, eq(referralConversions.referralCodeId, referralCodes.id))
      .where(sql`${referralCodes.userId} = ${referralConversions.invitedUserId}`),
  ]);

  const inv = invitationTotals[0] ?? { totalSent: 0, totalClicks: 0, duoInvites: 0 };
  const uses = invitationUseTotals[0] ?? { totalUses: 0, matchedTogether: 0 };
  const codes = referralCodeTotals[0] ?? { totalCodes: 0, totalClicks: 0 };
  const conversions = referralConversionTotals[0] ?? {
    totalConversions: 0,
    inviterRewardsIssued: 0,
    inviteeRewardsIssued: 0,
  };
  const selfInvitationUses = selfInvitationRows[0]?.count ?? 0;
  const selfReferralConversions = selfReferralRows[0]?.count ?? 0;

  return {
    invitations: {
      totalSent: inv.totalSent,
      totalClicks: inv.totalClicks,
      totalUses: uses.totalUses,
      matchedTogether: uses.matchedTogether,
      duoInvites: inv.duoInvites,
    },
    referrals: {
      totalCodes: codes.totalCodes,
      totalClicks: codes.totalClicks,
      totalConversions: conversions.totalConversions,
      inviterRewardsIssued: conversions.inviterRewardsIssued,
      inviteeRewardsIssued: conversions.inviteeRewardsIssued,
    },
    funnel: {
      invitationClickToUse: ratio(uses.totalUses, inv.totalClicks),
      referralClickToConversion: ratio(conversions.totalConversions, codes.totalClicks),
    },
    abuse: {
      selfInvitationUses,
      selfReferralConversions,
      totalSelfReferralFlags: selfInvitationUses + selfReferralConversions,
    },
    topInviters: topInviterRows,
    topReferrers: topReferrerRows,
  };
}

// ── Duo invite listing ──────────────────────────────────────────────────────

export type DuoInviteStatus = "pending" | "bound" | "expired";

export interface DuoInviteListParams {
  poolId?: string;
  status?: DuoInviteStatus;
  page: number;
  pageSize: number;
}

export interface DuoInviteListItem {
  id: string;
  code: string;
  invitationType: string | null;
  inviterId: string;
  inviterDisplayName: string | null;
  inviteeId: string | null;
  inviteeDisplayName: string | null;
  poolId: string | null;
  poolTitle: string | null;
  poolCity: string | null;
  poolDateTime: Date | null;
  status: DuoInviteStatus;
  createdAt: Date | null;
  expiresAt: Date | null;
  boundAt: Date | null;
}

const inviteeUsers = alias(users, "duo_invitee_users");

/** invitation_uses row exists for this invitation (duo bind marker). */
const boundExists: SQL = sql`exists (
  select 1 from ${invitationUses}
  where ${invitationUses.invitationId} = ${invitations.id}
)`;

function buildDuoWhere(params: DuoInviteListParams, now: Date): SQL {
  const conditions: SQL[] = [eq(invitations.invitationType, "duo")];
  if (params.poolId) {
    conditions.push(eq(invitations.poolId, params.poolId));
  }
  if (params.status === "bound") {
    conditions.push(boundExists);
  } else if (params.status === "expired") {
    conditions.push(sql`not ${boundExists}`);
    conditions.push(sql`${invitations.expiresAt} < ${now}`);
  } else if (params.status === "pending") {
    conditions.push(sql`not ${boundExists}`);
    conditions.push(sql`(${invitations.expiresAt} is null or ${invitations.expiresAt} >= ${now})`);
  }
  return and(...conditions)!;
}

export async function listDuoInvites(params: DuoInviteListParams): Promise<{
  items: DuoInviteListItem[];
  total: number;
}> {
  const now = new Date();
  const whereClause = buildDuoWhere(params, now);
  const offset = (params.page - 1) * params.pageSize;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: invitations.id,
        code: invitations.code,
        invitationType: invitations.invitationType,
        inviterId: invitations.inviterId,
        inviterDisplayName: users.displayName,
        inviteeId: invitationUses.inviteeId,
        inviteeDisplayName: inviteeUsers.displayName,
        boundAt: invitationUses.createdAt,
        poolId: invitations.poolId,
        poolTitle: eventPools.title,
        poolCity: eventPools.city,
        poolDateTime: eventPools.dateTime,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .leftJoin(users, eq(invitations.inviterId, users.id))
      .leftJoin(invitationUses, eq(invitationUses.invitationId, invitations.id))
      .leftJoin(inviteeUsers, eq(invitationUses.inviteeId, inviteeUsers.id))
      .leftJoin(eventPools, eq(invitations.poolId, eventPools.id))
      .where(whereClause)
      .orderBy(desc(invitations.createdAt))
      .limit(params.pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitations)
      .where(whereClause),
  ]);

  const items: DuoInviteListItem[] = rows.map((row: (typeof rows)[number]) => {
    const bound = row.inviteeId !== null;
    const expired =
      !bound && row.expiresAt !== null && new Date(row.expiresAt).getTime() < now.getTime();
    return {
      ...row,
      status: bound ? "bound" : expired ? "expired" : "pending",
    };
  });

  return { items, total: countRows[0]?.count ?? 0 };
}
