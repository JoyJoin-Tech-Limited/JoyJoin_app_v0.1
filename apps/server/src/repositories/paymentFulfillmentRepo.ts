import {
  couponUsage,
  coupons,
  eventPoolRegistrations,
  eventPools,
  notifications,
  payments,
  subscriptions,
  userCoupons,
} from "@shared/schema";
import * as schema from "@shared/schema";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "../db";
import { eventCreditsRepo } from "./eventCreditsRepo";

type PaymentRecord = typeof payments.$inferSelect;

export interface FinalizeConfirmedPaymentParams {
  wechatOrderId: string;
  transactionId: string;
}

export interface FinalizeConfirmedPaymentResult {
  payment: PaymentRecord | null;
  alreadyCompleted: boolean;
}

export interface FinalizeRefundedPaymentParams {
  wechatOrderId: string;
}

export interface FinalizeRefundedPaymentResult {
  payment: PaymentRecord | null;
  alreadyRefunded: boolean;
}

const subscriptionNotification = {
  category: "activities",
  type: "subscription_activated",
  title: "会员订阅成功",
  message: "您的JoyJoin会员已激活，开始探索精彩活动吧！",
};

const bundleNotification = {
  category: "activities",
  type: "subscription_activated",
  title: "悦聚月度礼包已激活",
  message: "您的本月活动礼包已生效，尽情参加本月所有悦聚活动吧！",
};

const eventPackNotification = {
  category: "activities",
  type: "event_pack_credited",
  title: "活动次数包已到账",
  message: "活动次数包已生效，可直接报名活动盲盒。",
};

const eventNotification = {
  category: "activities",
  type: "event_confirmed",
  title: "活动报名成功",
  message: "您的活动报名已确认，期待与您见面！",
};

function getNotificationForPayment(payment: PaymentRecord) {
  if (payment.paymentType === "event_pack") {
    return eventPackNotification;
  }

  if (payment.paymentType === "event_bundle") {
    return bundleNotification;
  }

  if (payment.paymentType === "subscription") {
    return subscriptionNotification;
  }

  return eventNotification;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeEventRegistrationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;
  return {
    budgetRange: toStringArray(source.budgetRange),
    preferredLanguages: toStringArray(source.preferredLanguages),
    tasteIntensity: toStringArray(source.tasteIntensity),
    cuisinePreferences: toStringArray(source.cuisinePreferences),
    eventIntent: toStringArray(source.eventIntent),
    dietaryRestrictions: toStringArray(source.dietaryRestrictions),
  };
}

export const paymentFulfillmentRepo = {
  async finalizeConfirmedPayment(
    params: FinalizeConfirmedPaymentParams
  ): Promise<FinalizeConfirmedPaymentResult> {
    return db.transaction(async (tx: NeonDatabase<typeof schema>) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.wechatOrderId, params.wechatOrderId))
        .limit(1);

      if (!payment) {
        return { payment: null, alreadyCompleted: false };
      }

      if (payment.status === "completed") {
        return { payment, alreadyCompleted: true };
      }

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: "completed",
          wechatTransactionId: params.transactionId,
          paidAt: new Date(),
        })
        .where(and(eq(payments.id, payment.id), ne(payments.status, "completed")))
        .returning();

      if (!updatedPayment) {
        const [latestPayment] = await tx
          .select({ status: payments.status })
          .from(payments)
          .where(eq(payments.id, payment.id))
          .limit(1);

        if (latestPayment?.status === "completed") {
          return {
            payment: {
              ...payment,
              status: "completed",
              wechatTransactionId: payment.wechatTransactionId ?? params.transactionId,
              paidAt: payment.paidAt ?? new Date(),
            },
            alreadyCompleted: true,
          };
        }

        throw new Error(`Failed to update payment ${payment.id}`);
      }

      if (updatedPayment.couponId) {
        await tx.insert(couponUsage).values({
          couponId: updatedPayment.couponId,
          userId: updatedPayment.userId,
          paymentId: updatedPayment.id,
          discountApplied: updatedPayment.discountAmount ?? 0,
        });

        await tx
          .update(coupons)
          .set({
            usedCount: sql`${coupons.usedCount} + 1`,
          })
          .where(eq(coupons.id, updatedPayment.couponId));

        const [availableUserCoupon] = await tx
          .select({ id: userCoupons.id })
          .from(userCoupons)
          .where(
            and(
              eq(userCoupons.userId, updatedPayment.userId),
              eq(userCoupons.couponId, updatedPayment.couponId),
              eq(userCoupons.isUsed, false),
            ),
          )
          .limit(1);

        if (availableUserCoupon) {
          await tx
            .update(userCoupons)
            .set({
              isUsed: true,
              usedAt: new Date(),
            })
            .where(eq(userCoupons.id, availableUserCoupon.id));
        }
      }

      if (updatedPayment.paymentType === "event_pack") {
        if (!updatedPayment.relatedId) {
          throw new Error(`Event pack payment ${updatedPayment.id} is missing a plan type`);
        }

        await eventCreditsRepo.grantCreditsForPayment(tx, {
          paymentId: updatedPayment.id,
          userId: updatedPayment.userId,
          planType: updatedPayment.relatedId,
        });
      } else if (
        (updatedPayment.paymentType === "subscription" ||
          updatedPayment.paymentType === "event_bundle") &&
        updatedPayment.relatedId
      ) {
        const activatedSubscriptions = await tx
          .update(subscriptions)
          .set({
            status: "active",
            paymentId: updatedPayment.id,
          })
          .where(
            and(
              eq(subscriptions.id, updatedPayment.relatedId),
              eq(subscriptions.userId, updatedPayment.userId),
            ),
          )
          .returning({ id: subscriptions.id });

        if (activatedSubscriptions.length === 0) {
          throw new Error(
            `Subscription ${updatedPayment.relatedId} does not exist or does not belong to user ${updatedPayment.userId}`,
          );
        }
      } else if (updatedPayment.paymentType === "event" && updatedPayment.relatedId) {
        const eventRegistrationPayload = normalizeEventRegistrationPayload(
          updatedPayment.eventRegistrationPayload,
        );
        const [pool] = await tx
          .select({ id: eventPools.id })
          .from(eventPools)
          .where(eq(eventPools.id, updatedPayment.relatedId))
          .limit(1);

        if (!pool) {
          throw new Error(`Event pool ${updatedPayment.relatedId} not found`);
        }

        const inserted = await tx
          .insert(eventPoolRegistrations)
          .values({
            poolId: updatedPayment.relatedId,
            userId: updatedPayment.userId,
            budgetRange: eventRegistrationPayload?.budgetRange ?? [],
            preferredLanguages: eventRegistrationPayload?.preferredLanguages ?? [],
            tasteIntensity: eventRegistrationPayload?.tasteIntensity ?? [],
            cuisinePreferences: eventRegistrationPayload?.cuisinePreferences ?? [],
            eventIntent: eventRegistrationPayload?.eventIntent ?? [],
            dietaryRestrictions: eventRegistrationPayload?.dietaryRestrictions ?? [],
            matchStatus: "pending",
          })
          .onConflictDoNothing({
            target: [eventPoolRegistrations.poolId, eventPoolRegistrations.userId],
          })
          .returning({ id: eventPoolRegistrations.id });

        if (inserted.length > 0) {
          await tx
            .update(eventPools)
            .set({
              totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(eventPools.id, updatedPayment.relatedId));
        }
      }

      const notification = getNotificationForPayment(updatedPayment);
      await tx.insert(notifications).values({
        userId: updatedPayment.userId,
        category: notification.category,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedResourceId: updatedPayment.relatedId,
        isRead: false,
      });

      return { payment: updatedPayment, alreadyCompleted: false };
    });
  },

  async finalizeRefundedPayment(
    params: FinalizeRefundedPaymentParams,
  ): Promise<FinalizeRefundedPaymentResult> {
    return db.transaction(async (tx: NeonDatabase<typeof schema>) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.wechatOrderId, params.wechatOrderId))
        .limit(1);

      if (!payment) {
        return { payment: null, alreadyRefunded: false };
      }

      if (payment.status === "refunded") {
        return { payment, alreadyRefunded: true };
      }

      if (payment.paymentType === "event_pack") {
        await eventCreditsRepo.reverseCreditsForPayment(tx, {
          paymentId: payment.id,
          userId: payment.userId,
        });
      }

      if (payment.couponId) {
        const couponUsageRows = await tx
          .select({ id: couponUsage.id })
          .from(couponUsage)
          .where(eq(couponUsage.paymentId, payment.id));

        if (couponUsageRows.length > 0) {
          await tx.delete(couponUsage).where(eq(couponUsage.paymentId, payment.id));

          await tx
            .update(coupons)
            .set({
              usedCount: sql`greatest(${coupons.usedCount} - ${couponUsageRows.length}, 0)`,
            })
            .where(eq(coupons.id, payment.couponId));

          const [userCouponToRestore] = await tx
            .select({ id: userCoupons.id })
            .from(userCoupons)
            .where(
              and(
                eq(userCoupons.userId, payment.userId),
                eq(userCoupons.couponId, payment.couponId),
                eq(userCoupons.isUsed, true),
              ),
            )
            .orderBy(desc(userCoupons.usedAt), desc(userCoupons.createdAt))
            .limit(1);

          if (userCouponToRestore) {
            await tx
              .update(userCoupons)
              .set({
                isUsed: false,
                usedAt: null,
              })
              .where(eq(userCoupons.id, userCouponToRestore.id));
          }
        }
      }

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: "refunded",
        })
        .where(and(eq(payments.id, payment.id), ne(payments.status, "refunded")))
        .returning();

      if (!updatedPayment) {
        const [latestPayment] = await tx
          .select()
          .from(payments)
          .where(eq(payments.id, payment.id))
          .limit(1);

        if (latestPayment?.status === "refunded") {
          return { payment: latestPayment, alreadyRefunded: true };
        }

        throw new Error(`Failed to update refunded payment ${payment.id}`);
      }

      if (
        (updatedPayment.paymentType === "subscription" ||
          updatedPayment.paymentType === "event_bundle") &&
        updatedPayment.relatedId
      ) {
        await tx
          .update(subscriptions)
          .set({
            status: "cancelled",
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, updatedPayment.relatedId));
      }

      return { payment: updatedPayment, alreadyRefunded: false };
    });
  },
};
