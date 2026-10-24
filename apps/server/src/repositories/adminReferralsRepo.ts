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

import { and, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  eventPoolRegistrations,
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
  /** S1: filter to conflicted (`true`) / clean (`false`) duo bindings. */
  conflict?: boolean;
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
  /**
   * S1 (one-partner-per-pool) read-only conflict marker: this invitation is
   * part of an overlap — the same invitation has 2+ valid duo bindings, or
   * its invitee holds 2+ valid duo bindings in the same pool. Valid = both
   * sides registered in the pool (same definition as the write-side guard).
   * Display/filter only — no data is mutated here.
   */
  hasConflict: boolean;
}

// ── S1 conflict detection (pure core + repo wiring) ─────────────────────────

export interface DuoValidBindingRow {
  invitationId: string;
  inviteeId: string;
  poolId: string | null;
}

/**
 * Map valid duo-binding rows to the set of CONFLICTED invitation ids.
 *
 * A conflict exists when either:
 *   - the same invitation carries 2+ valid bindings (second invitee consumed
 *     a claimed code — pre-guard legacy rows or a double-consume race), or
 *   - the same invitee holds 2+ valid bindings in the same pool (via
 *     different invitations).
 *
 * Pure + order-independent (counting, then threshold) — unit-tested directly.
 */
export function computeDuoConflictInvitationIds(
  rows: DuoValidBindingRow[],
): Set<string> {
  const countByInvitation = new Map<string, number>();
  const countByInviteePool = new Map<string, number>();
  for (const row of rows) {
    countByInvitation.set(
      row.invitationId,
      (countByInvitation.get(row.invitationId) ?? 0) + 1,
    );
    const inviteePoolKey = `${row.inviteeId}|${row.poolId ?? ""}`;
    countByInviteePool.set(
      inviteePoolKey,
      (countByInviteePool.get(inviteePoolKey) ?? 0) + 1,
    );
  }
  const conflictedInviteePools = new Set(
    [...countByInviteePool]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );

  const ids = new Set<string>();
  for (const row of rows) {
    if ((countByInvitation.get(row.invitationId) ?? 0) > 1) {
      ids.add(row.invitationId);
      continue;
    }
    if (conflictedInviteePools.has(`${row.inviteeId}|${row.poolId ?? ""}`)) {
      ids.add(row.invitationId);
    }
  }
  return ids;
}

const inviteeUsers = alias(users, "duo_invitee_users");

/** invitation_uses row exists for this invitation (duo bind marker). */
const boundExists: SQL = sql`exists (
  select 1 from ${invitationUses}
  where ${invitationUses.invitationId} = ${invitations.id}
)`;

function buildDuoWhere(
  params: DuoInviteListParams,
  now: Date,
  conflictInvitationIds: Set<string>,
): SQL | undefined {
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
  // S1 conflict filter: an empty conflict set means NO invitation can match
  // `conflict=true` (handled by the caller's early return) and `conflict=false`
  // needs no condition at all (everything is clean).
  if (params.conflict === true && conflictInvitationIds.size > 0) {
    conditions.push(inArray(invitations.id, [...conflictInvitationIds]));
  } else if (params.conflict === false && conflictInvitationIds.size > 0) {
    conditions.push(notInArray(invitations.id, [...conflictInvitationIds]));
  }
  return and(...conditions);
}

export async function listDuoInvites(params: DuoInviteListParams): Promise<{
  items: DuoInviteListItem[];
  total: number;
}> {
  const now = new Date();
  const offset = (params.page - 1) * params.pageSize;

  // S1: load every VALID duo binding (both sides registered in the
  // invitation's pool — same definition as the write-side guard) and derive
  // the conflicted-invitation set in one pass. Runs unconditionally because
  // the per-item hasConflict marker needs it even without the filter; admin
  // surface, single grouped scan, no N+1.
  const inviterRegs = alias(eventPoolRegistrations, "duo_conflict_inviter_regs");
  const validBindingRows: DuoValidBindingRow[] = await db
    .select({
      invitationId: invitationUses.invitationId,
      inviteeId: invitationUses.inviteeId,
      poolId: invitations.poolId,
    })
    .from(invitationUses)
    .innerJoin(
      invitations,
      and(
        eq(invitations.id, invitationUses.invitationId),
        eq(invitations.invitationType, "duo"),
      ),
    )
    .innerJoin(
      eventPoolRegistrations,
      and(
        eq(eventPoolRegistrations.id, invitationUses.poolRegistrationId),
        eq(eventPoolRegistrations.poolId, invitations.poolId),
      ),
    )
    .innerJoin(
      inviterRegs,
      and(
        eq(inviterRegs.poolId, invitations.poolId),
        eq(inviterRegs.userId, invitations.inviterId),
      ),
    );

  const conflictInvitationIds = computeDuoConflictInvitationIds(validBindingRows);

  // conflict=true with an empty conflict set can never match — short-circuit
  // (inArray with an empty list would emit degenerate SQL).
  if (params.conflict === true && conflictInvitationIds.size === 0) {
    return { items: [], total: 0 };
  }

  const whereClause = buildDuoWhere(params, now, conflictInvitationIds);

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
      hasConflict: conflictInvitationIds.has(row.id),
    };
  });

  return { items, total: countRows[0]?.count ?? 0 };
}
