import {
  eventCreditGrants,
  eventCreditRedemptions,
  pricingSettings,
  users,
} from "@shared/schema";
import * as schema from "@shared/schema";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "../db";

const DEFAULT_PACK_EXPIRY_DAYS = 90;
const PACK_CREDIT_BY_PLAN: Record<string, number> = {
  pack_3: 3,
  pack_6: 6,
};

type DatabaseLike = NeonDatabase<typeof schema>;

type ActiveGrantRow = {
  id: string;
  remainingCredits: number;
  expiresAt: Date | null;
};

function getNow(): Date {
  return new Date();
}

function getPackCredits(planType: string): number {
  const credits = PACK_CREDIT_BY_PLAN[planType];
  if (!credits) {
    throw new Error(`Unsupported event pack plan type: ${planType}`);
  }
  return credits;
}

async function findPackPricingPlan(tx: DatabaseLike, planType: string) {
  const [plan] = await tx
    .select({
      planType: pricingSettings.planType,
      durationDays: pricingSettings.durationDays,
    })
    .from(pricingSettings)
    .where(eq(pricingSettings.planType, planType))
    .limit(1);

  return plan ?? null;
}

async function reconcileUserCreditCache(tx: DatabaseLike, userId: string): Promise<void> {
  const now = getNow();
  const [summary] = await tx
    .select({
      totalCredits: sql<number>`coalesce(sum(${eventCreditGrants.remainingCredits}), 0)::int`,
      nextExpiry: sql<Date | null>`min(${eventCreditGrants.expiresAt})`,
    })
    .from(eventCreditGrants)
    .where(
      and(
        eq(eventCreditGrants.userId, userId),
        isNull(eventCreditGrants.refundedAt),
        gt(eventCreditGrants.remainingCredits, 0),
        or(isNull(eventCreditGrants.expiresAt), gt(eventCreditGrants.expiresAt, now)),
      ),
    );

  await tx
    .update(users)
    .set({
      eventCredits: summary?.totalCredits ?? 0,
      eventCreditsExpiry: summary?.nextExpiry ?? null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}

async function getActiveGrants(tx: DatabaseLike, userId: string): Promise<ActiveGrantRow[]> {
  const now = getNow();
  const rows = await tx
    .select({
      id: eventCreditGrants.id,
      remainingCredits: eventCreditGrants.remainingCredits,
      expiresAt: eventCreditGrants.expiresAt,
    })
    .from(eventCreditGrants)
    .where(
      and(
        eq(eventCreditGrants.userId, userId),
        isNull(eventCreditGrants.refundedAt),
        gt(eventCreditGrants.remainingCredits, 0),
        or(isNull(eventCreditGrants.expiresAt), gt(eventCreditGrants.expiresAt, now)),
      ),
    )
    .orderBy(asc(eventCreditGrants.expiresAt), asc(eventCreditGrants.createdAt));

  return rows as ActiveGrantRow[];
}

async function getAvailableCreditCountInternal(tx: DatabaseLike, userId: string): Promise<number> {
  const now = getNow();
  const [summary] = await tx
    .select({
      totalCredits: sql<number>`coalesce(sum(${eventCreditGrants.remainingCredits}), 0)::int`,
    })
    .from(eventCreditGrants)
    .where(
      and(
        eq(eventCreditGrants.userId, userId),
        isNull(eventCreditGrants.refundedAt),
        gt(eventCreditGrants.remainingCredits, 0),
        or(isNull(eventCreditGrants.expiresAt), gt(eventCreditGrants.expiresAt, now)),
      ),
    );

  return summary?.totalCredits ?? 0;
}

export const eventCreditsRepo = {
  getPackCredits,

  async getAvailableCreditCount(userId: string): Promise<number> {
    return getAvailableCreditCountInternal(db, userId);
  },

  async grantCreditsForPayment(
    tx: DatabaseLike,
    params: { paymentId: string; userId: string; planType: string },
  ): Promise<{ creditsGranted: number; expiresAt: Date | null }> {
    const existingGrant = await tx
      .select({ id: eventCreditGrants.id, expiresAt: eventCreditGrants.expiresAt })
      .from(eventCreditGrants)
      .where(eq(eventCreditGrants.paymentId, params.paymentId))
      .limit(1);

    if (existingGrant[0]) {
      return {
        creditsGranted: 0,
        expiresAt: existingGrant[0].expiresAt ?? null,
      };
    }

    const creditsGranted = getPackCredits(params.planType);
    const pricingPlan = await findPackPricingPlan(tx, params.planType);
    const expiryDays = pricingPlan?.durationDays ?? DEFAULT_PACK_EXPIRY_DAYS;
    const expiresAt = expiryDays
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;
    const now = getNow();

    await tx.insert(eventCreditGrants).values({
      userId: params.userId,
      paymentId: params.paymentId,
      planType: params.planType,
      grantedCredits: creditsGranted,
      remainingCredits: creditsGranted,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    await reconcileUserCreditCache(tx, params.userId);

    return {
      creditsGranted,
      expiresAt,
    };
  },

  async consumeCreditForPoolRegistration(
    tx: DatabaseLike,
    params: { userId: string; poolId: string; registrationId: string },
  ): Promise<{ grantId: string }> {
    const grants = await getActiveGrants(tx, params.userId);

    for (const grant of grants) {
      const [updatedGrant] = await tx
        .update(eventCreditGrants)
        .set({
          remainingCredits: sql`${eventCreditGrants.remainingCredits} - 1`,
          updatedAt: getNow(),
        })
        .where(
          and(
            eq(eventCreditGrants.id, grant.id),
            gt(eventCreditGrants.remainingCredits, 0),
            or(isNull(eventCreditGrants.expiresAt), gt(eventCreditGrants.expiresAt, getNow())),
            isNull(eventCreditGrants.refundedAt),
          ),
        )
        .returning({ id: eventCreditGrants.id });

      if (!updatedGrant) {
        continue;
      }

      await tx.insert(eventCreditRedemptions).values({
        grantId: grant.id,
        userId: params.userId,
        poolId: params.poolId,
        registrationId: params.registrationId,
        creditsUsed: 1,
      });

      await reconcileUserCreditCache(tx, params.userId);
      return { grantId: grant.id };
    }

    throw new Error("No available event-pack credits remain");
  },

  async getRefundBlockerCount(tx: DatabaseLike, paymentId: string): Promise<number> {
    const [summary] = await tx
      .select({
        redemptionCount: sql<number>`count(${eventCreditRedemptions.id})::int`,
      })
      .from(eventCreditGrants)
      .leftJoin(eventCreditRedemptions, eq(eventCreditRedemptions.grantId, eventCreditGrants.id))
      .where(eq(eventCreditGrants.paymentId, paymentId));

    return summary?.redemptionCount ?? 0;
  },

  async getRefundBlockerCountForPayment(paymentId: string): Promise<number> {
    return this.getRefundBlockerCount(db, paymentId);
  },

  async reverseCreditsForPayment(
    tx: DatabaseLike,
    params: { paymentId: string; userId: string },
  ): Promise<{ creditsReversed: number }> {
    const blockerCount = await this.getRefundBlockerCount(tx, params.paymentId);
    if (blockerCount > 0) {
      throw new Error("Cannot automatically refund an event pack after credits have been used");
    }

    const [summary] = await tx
      .select({
        creditsToReverse: sql<number>`coalesce(sum(${eventCreditGrants.remainingCredits}), 0)::int`,
      })
      .from(eventCreditGrants)
      .where(
        and(
          eq(eventCreditGrants.paymentId, params.paymentId),
          isNull(eventCreditGrants.refundedAt),
        ),
      );

    const creditsReversed = summary?.creditsToReverse ?? 0;
    if (creditsReversed === 0) {
      return { creditsReversed: 0 };
    }

    await tx
      .update(eventCreditGrants)
      .set({
        refundedAt: getNow(),
        remainingCredits: 0,
        updatedAt: getNow(),
      })
      .where(
        and(
          eq(eventCreditGrants.paymentId, params.paymentId),
          isNull(eventCreditGrants.refundedAt),
        ),
      );

    await reconcileUserCreditCache(tx, params.userId);

    return { creditsReversed };
  },
};
