import {
  couponUsage,
  coupons,
  eventPoolRegistrations,
  eventPools,
  invitations,
  invitationUses,
  notifications,
  payments,
  subscriptions,
  userCoupons,
} from "@shared/schema";
import * as schema from "@shared/schema";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "../db";
import { eventCreditsRepo } from "./eventCreditsRepo";
import { resolveEffectivePreferenceDNA } from "../lib/matchCompass";
import { resolveOptionalRegistrationAttribution } from "../lib/eventPoolRegistration";
import { logger } from "../lib/logger"; 
import { users } from "@shared/schema";

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
  title: "悦聚卡已激活",
  message: "您的悦聚卡已激活，开始探索精彩活动吧！",
};

const bundleNotification = {
  category: "activities",
  type: "subscription_activated",
  title: "悦聚月卡已激活",
  message: "您的悦聚月卡已生效，期待和你见面！",
};

const eventPackNotification = {
  category: "activities",
  type: "event_pack_credited",
  title: "连局包已到账",
  message: "连局包已生效，可直接报名活动盲盒。",
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
    barThemes: toStringArray(source.barThemes),
    alcoholComfort: toStringArray(source.alcoholComfort),
    barBudgetRange: toStringArray(source.barBudgetRange),
    // 双人成行: optional invitation/duo code carried over the payment hop.
    invitationCode:
      typeof source.invitationCode === "string" && source.invitationCode.trim() !== ""
        ? source.invitationCode.trim()
        : null,
  };
}

export const paymentFulfillmentRepo = {
  async finalizeConfirmedPayment(
    params: FinalizeConfirmedPaymentParams
  ): Promise<FinalizeConfirmedPaymentResult> {
    return db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
      logger.info("Starting payment fulfillment transaction", {
        wechat_order_id: params.wechatOrderId,
        transaction_id: params.transactionId,
      });

      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.wechatOrderId, params.wechatOrderId))
        .limit(1);

      if (!payment) {
        logger.warn("Payment fulfillment: order not found", {
          wechat_order_id: params.wechatOrderId,
        });
        return { payment: null, alreadyCompleted: false };
      }

      if (payment.status === "completed") {
        logger.info("Payment fulfillment: already completed", {
          payment_id: payment.id,
          wechat_order_id: params.wechatOrderId,
        });
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
          logger.info("Payment fulfillment: completed concurrently", {
            payment_id: payment.id,
            wechat_order_id: params.wechatOrderId,
          });
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

        logger.error("Payment fulfillment: failed to update payment status", {
          payment_id: payment.id,
          wechat_order_id: params.wechatOrderId,
        });
        throw new Error(`Failed to update payment ${payment.id}`);
      }

      logger.info("Payment status updated to completed", {
        payment_id: updatedPayment.id,
        payment_type: updatedPayment.paymentType,
        related_id: updatedPayment.relatedId,
        wechat_order_id: params.wechatOrderId,
      });

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
        logger.info("Fulfilling event payment registration", {
          payment_id: updatedPayment.id,
          pool_id: updatedPayment.relatedId,
          user_id: updatedPayment.userId,
          has_event_registration_payload: !!updatedPayment.eventRegistrationPayload,
          budget_range: eventRegistrationPayload?.budgetRange,
        });
        const [pool] = await tx
          .select({ id: eventPools.id })
          .from(eventPools)
          .where(eq(eventPools.id, updatedPayment.relatedId))
          .limit(1);

        if (!pool) {
          logger.error("Event pool not found during payment fulfillment", {
            payment_id: updatedPayment.id,
            pool_id: updatedPayment.relatedId,
          });
          throw new Error(`Event pool ${updatedPayment.relatedId} not found`);
        }

        const [user] = await tx
          .select({
            archetype: users.archetype,
            primaryArchetype: users.primaryArchetype,
            defaultPreferenceStrictness: users.defaultPreferenceStrictness,
            defaultAcceptPairs: users.defaultAcceptPairs,
            defaultGenderComposition: users.defaultGenderComposition,
            defaultPreferredDistricts: users.defaultPreferredDistricts,
            defaultKolComfort: users.defaultKolComfort,
          })
          .from(users)
          .where(eq(users.id, updatedPayment.userId))
          .limit(1);

        const dna = user ? resolveEffectivePreferenceDNA(user) : null;

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
            barThemes: eventRegistrationPayload?.barThemes ?? [],
            alcoholComfort: eventRegistrationPayload?.alcoholComfort ?? [],
            barBudgetRange: eventRegistrationPayload?.barBudgetRange ?? [],
            matchStatus: "pending",
            preferenceStrictness: dna?.strictness ?? 50,
            acceptPairs: dna?.acceptPairs ?? true,
            genderCompositionPreference: dna?.genderComposition ?? null,
            preferredDistricts: dna?.preferredDistricts ?? null,
            kolComfortLevel: dna?.kolComfort ?? null,
          })
          .onConflictDoNothing({
            target: [eventPoolRegistrations.poolId, eventPoolRegistrations.userId],
          })
          .returning({ id: eventPoolRegistrations.id });

        if (inserted.length > 0) {
          logger.info("Event registration created from payment fulfillment", {
            payment_id: updatedPayment.id,
            registration_id: inserted[0].id,
            pool_id: updatedPayment.relatedId,
            user_id: updatedPayment.userId,
          });
          await tx
            .update(eventPools)
            .set({
              totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(eventPools.id, updatedPayment.relatedId));

          // 双人成行 / invitation binding over the payment hop: the invitee
          // presented a code at register-with-payment time; mirror the
          // invitation_uses write from POST /api/event-pools/:id/register so
          // duo pairs bind for paid invitees too. Guards match that route
          // (expiry, self-invite, duo pool-scope, dedup). Referral codes stay
          // untouched (they are not carried over the payment hop today).
          const invitationCode = eventRegistrationPayload?.invitationCode;
          if (invitationCode) {
            const [invitation] = await tx
              .select()
              .from(invitations)
              .where(eq(invitations.code, invitationCode))
              .limit(1);

            const attribution = resolveOptionalRegistrationAttribution({
              userId: updatedPayment.userId,
              poolId: updatedPayment.relatedId,
              invitation: invitation ?? null,
            });

            if (attribution.kind === "invitation") {
              const [existingUse] = await tx
                .select({ id: invitationUses.id })
                .from(invitationUses)
                .where(and(
                  eq(invitationUses.invitationId, attribution.invitationId),
                  eq(invitationUses.inviteeId, updatedPayment.userId),
                ))
                .limit(1);

              if (!existingUse) {
                await tx.insert(invitationUses).values({
                  invitationId: attribution.invitationId,
                  inviteeId: updatedPayment.userId,
                  poolRegistrationId: inserted[0].id,
                });

                await tx
                  .update(invitations)
                  .set({ totalAcceptances: sql`COALESCE(total_acceptances, 0) + 1` })
                  .where(eq(invitations.id, attribution.invitationId));
              }
            } else if (attribution.kind === "discard") {
              logger.warn("Discarding unusable invitation during payment fulfillment", {
                payment_id: updatedPayment.id,
                pool_id: updatedPayment.relatedId,
                user_id: updatedPayment.userId,
                reason: attribution.reason,
              });
            }
          }
        } else {
          logger.warn("Event registration insert skipped by conflict; payment fulfilled without incrementing pool count", {
            payment_id: updatedPayment.id,
            pool_id: updatedPayment.relatedId,
            user_id: updatedPayment.userId,
          });
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
    return db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
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
