import {
  couponUsage,
  coupons,
  eventPoolRegistrations,
  eventPools,
  notifications,
  payments,
  subscriptions,
} from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "../db";

type PaymentRecord = typeof payments.$inferSelect;

export interface FinalizeConfirmedPaymentParams {
  wechatOrderId: string;
  transactionId: string;
}

export interface FinalizeConfirmedPaymentResult {
  payment: PaymentRecord | null;
  alreadyCompleted: boolean;
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

const eventNotification = {
  category: "activities",
  type: "event_confirmed",
  title: "活动报名成功",
  message: "您的活动报名已确认，期待与您见面！",
};

function getNotificationForPayment(payment: PaymentRecord) {
  if (payment.paymentType === "event_bundle") {
    return bundleNotification;
  }

  if (payment.paymentType === "subscription") {
    return subscriptionNotification;
  }

  return eventNotification;
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
        .where(eq(payments.id, payment.id))
        .returning();

      if (!updatedPayment) {
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
      }

      if (
        (updatedPayment.paymentType === "subscription" ||
          updatedPayment.paymentType === "event_bundle") &&
        updatedPayment.relatedId
      ) {
        await tx
          .update(subscriptions)
          .set({
            status: "active",
            paymentId: updatedPayment.id,
          })
          .where(eq(subscriptions.id, updatedPayment.relatedId));
      } else if (updatedPayment.paymentType === "event" && updatedPayment.relatedId) {
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
};
