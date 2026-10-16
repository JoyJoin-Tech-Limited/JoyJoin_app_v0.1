import { and, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { eventPoolGroups, eventPoolRegistrations, eventPools, notifications } from "@shared/schema";
import { db } from "../db";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";
import { sendEventDayReminders, sendRecapReminders } from "./wechatSubscribeMessage";
import { notificationsRepo } from "../repositories/notificationsRepo";

/**
 * Subscribe-message reminder scheduler (notification-strategy batch 2 + 4).
 *
 * Two scheduled moments, both ledger-idempotent via subscribe_message_sends
 * (user, moment, pool) claims, both fail-open, both gated by the
 * `subscribeRemindersEnabled` feature flag (DB, default on) plus the
 * template env vars (unset = silent no-op):
 *
 *   event_day — pools whose dateTime falls 3–12h ahead. Sends during local
 *               waking hours only (08:00–22:00); for a typical 19:00 event
 *               the window opens at 07:00 and the first tick ≥08:00 delivers
 *               the "今天见" reminder with the group's venue attached.
 *   recap     — pools whose dateTime passed 20–30h ago. The T+1 "回顾已生成，
 *               来说一句感受吧" call-back that routes emotional afterglow into
 *               feedback (profile iteration) and reconnecting with tablemates.
 *
 * Same posture as the venue-TBD retry scheduler: a tick error is logged and
 * retried next tick; it never stops the scheduler.
 */

export const SUBSCRIBE_REMINDER_INTERVAL_MS = 10 * 60 * 1000;

const EVENT_DAY_MIN_AHEAD_MS = 3 * 60 * 60 * 1000;
const EVENT_DAY_MAX_AHEAD_MS = 12 * 60 * 60 * 1000;
const RECAP_MIN_AGO_MS = 20 * 60 * 60 * 1000;
const RECAP_MAX_AGO_MS = 30 * 60 * 60 * 1000;

/** Local-hour send gates — never push in the middle of the night. */
const EVENT_DAY_SEND_HOURS = { start: 8, end: 22 } as const;
const RECAP_SEND_HOURS = { start: 9, end: 21 } as const;

type SchedulerLogger = {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
};

export interface SubscribeReminderDependencies {
  logger: SchedulerLogger;
  now: () => Date;
  isEnabled: () => Promise<boolean>;
  sendEventDay: typeof sendEventDayReminders;
  sendRecap: typeof sendRecapReminders;
  /**
   * D8 no-grant fallback (2026-10-16): in-app activities notifications fanned
   * out to recap recipients in the same tick. Injectable for tests.
   */
  createFeedbackInvites: (poolId: string, userIds: string[]) => Promise<number>;
}

function inSendHours(date: Date, hours: { start: number; end: number }): boolean {
  const hour = date.getHours();
  return hour >= hours.start && hour < hours.end;
}

export type ReminderMoment = "event_day" | "recap";

/**
 * Pure moment decision (unit-tested): given a matched pool's dateTime and
 * now, which reminder — if any — should fire this tick. Hour gates keep
 * pushes inside waking hours; the SQL window in run() is a superset of both
 * windows so this function is the single source of truth.
 */
export function resolvePoolReminderMoment(poolDateTime: Date, now: Date): ReminderMoment | null {
  const diffMs = poolDateTime.getTime() - now.getTime();
  if (
    diffMs > EVENT_DAY_MIN_AHEAD_MS &&
    diffMs <= EVENT_DAY_MAX_AHEAD_MS &&
    inSendHours(now, EVENT_DAY_SEND_HOURS)
  ) {
    return "event_day";
  }
  if (
    diffMs <= -RECAP_MIN_AGO_MS &&
    diffMs >= -RECAP_MAX_AGO_MS &&
    inSendHours(now, RECAP_SEND_HOURS)
  ) {
    return "recap";
  }
  return null;
}

interface PoolRow {
  id: string;
  title: string | null;
  dateTime: Date | null;
}

/** Superset scan: matched pools whose dateTime falls inside either window.
 *  Cancelled pools are excluded (a "今天见" push for a cancelled event is
 *  wrong information — the refund push is that moment's channel instead). */
async function findMatchedPoolsInReminderRange(now: Date): Promise<PoolRow[]> {
  const rows: PoolRow[] = await db
    .select({ id: eventPools.id, title: eventPools.title, dateTime: eventPools.dateTime })
    .from(eventPools)
    .where(
      and(
        isNotNull(eventPools.matchedAt),
        ne(eventPools.status, "cancelled"),
        // Test pools (is_test_pool=true) are tester+synthetic-bot fixtures —
        // pushing real WeChat subscribe messages for them is spam.
        eq(eventPools.isTestPool, false),
        gte(eventPools.dateTime, new Date(now.getTime() - RECAP_MAX_AGO_MS)),
        lte(eventPools.dateTime, new Date(now.getTime() + EVENT_DAY_MAX_AHEAD_MS)),
      ),
    );
  return rows;
}

interface MatchedMemberRow {
  userId: string;
  assignedGroupId: string | null;
}

async function findMatchedMembers(poolId: string): Promise<MatchedMemberRow[]> {
  const rows: MatchedMemberRow[] = await db
    .select({
      userId: eventPoolRegistrations.userId,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
    })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        // P0 fix (2026-10-16): poolCompletionSweep flips matched registrations
        // to matchStatus='completed' at event start +3h, so a 'matched'-only
        // query returns ZERO rows by the time the recap window (T+20–30h)
        // arrives — recap pushes silently never delivered since 2026-10-06.
        // Both statuses mean "this user attended/was placed". 'unmatched'
        // stays excluded (they went through the refund path instead).
        inArray(eventPoolRegistrations.matchStatus, ["matched", "completed"]),
      ),
    );
  return rows;
}

async function findGroupVenues(poolId: string): Promise<Map<string, string>> {
  const rows: Array<{ id: string; venueName: string | null }> = await db
    .select({ id: eventPoolGroups.id, venueName: eventPoolGroups.venueName })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.venueName) map.set(row.id, row.venueName);
  }
  return map;
}

/**
 * D8 no-grant fallback (2026-10-16 feedback activation): every recap recipient
 * ALSO gets an in-app activities notification, because WeChat subscribe-message
 * grants are one-shot — a refused/consumed grant (43101) would otherwise leave
 * the user with zero召回. Push is easy to miss, the in-app row persists; the
 * two channels deliberately complement each other (plan §5.3).
 *
 * Idempotent via select-then-insert on (userId, type='feedback_invite',
 * relatedResourceId=poolId) — the same precedent as the mutual_match
 * notification in social.ts; the scheduler tick is single-threaded and the
 * 10-minute replay must never duplicate. Fail-open per recipient: one bad
 * insert never aborts the batch. Copy stays service-tone 排桌/合拍 vocabulary
 * with zero incentive language (WeChat bans marketing in reminder surfaces).
 */
export const FEEDBACK_INVITE_NOTIFICATION = {
  type: "feedback_invite",
  category: "activities",
  title: "昨晚的活动怎么样？",
  message: "来说一句感受，帮下次排桌更合拍",
} as const;

export async function createFeedbackInviteNotifications(
  poolId: string,
  userIds: string[],
): Promise<number> {
  let created = 0;
  for (const userId of userIds) {
    try {
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.type, FEEDBACK_INVITE_NOTIFICATION.type),
            eq(notifications.relatedResourceId, poolId),
          ),
        )
        .limit(1);
      if (existing) continue;
      await notificationsRepo.createNotification({
        userId,
        category: FEEDBACK_INVITE_NOTIFICATION.category,
        type: FEEDBACK_INVITE_NOTIFICATION.type,
        title: FEEDBACK_INVITE_NOTIFICATION.title,
        message: FEEDBACK_INVITE_NOTIFICATION.message,
        relatedResourceId: poolId,
      });
      created += 1;
    } catch (error) {
      logger.warn("[SubscribeReminder] feedback invite notification failed (fail-open)", {
        poolId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (created > 0) {
    logger.info("[SubscribeReminder] feedback invite notifications created", { poolId, created });
  }
  return created;
}

export function createSubscribeReminderScheduler(
  dependencies: SubscribeReminderDependencies = {
    logger,
    now: () => new Date(),
    isEnabled: () => getFeatureFlag("subscribeRemindersEnabled", true),
    sendEventDay: sendEventDayReminders,
    sendRecap: sendRecapReminders,
    createFeedbackInvites: createFeedbackInviteNotifications,
  },
) {
  let stopped = false;
  let interval: NodeJS.Timeout | null = null;

  const run = async () => {
    if (stopped) return;
    try {
      if (!(await dependencies.isEnabled())) {
        return;
      }
      const now = dependencies.now();
      const pools = await findMatchedPoolsInReminderRange(now);

      for (const pool of pools) {
        if (!pool.dateTime) continue;
        const moment = resolvePoolReminderMoment(new Date(pool.dateTime), now);
        if (!moment) continue;
        const eventTime = new Date(pool.dateTime);

        if (moment === "event_day") {
          const [members, venueByGroup] = await Promise.all([
            findMatchedMembers(pool.id),
            findGroupVenues(pool.id),
          ]);
          if (members.length === 0) continue;
          // Members of one group share its venue; send per group so the
          // 活动地点 field is accurate per table.
          const byGroup = new Map<string, string[]>();
          const ungrouped: string[] = [];
          for (const member of members) {
            if (member.assignedGroupId && venueByGroup.has(member.assignedGroupId)) {
              const list = byGroup.get(member.assignedGroupId) ?? [];
              list.push(member.userId);
              byGroup.set(member.assignedGroupId, list);
            } else {
              ungrouped.push(member.userId);
            }
          }
          for (const [groupId, userIds] of byGroup) {
            await dependencies.sendEventDay(userIds, {
              poolId: pool.id,
              poolTitle: pool.title || "活动",
              eventTime,
              venue: venueByGroup.get(groupId),
              hint: "今天见！先来集结房间报到",
            });
          }
          if (ungrouped.length > 0) {
            await dependencies.sendEventDay(ungrouped, {
              poolId: pool.id,
              poolTitle: pool.title || "活动",
              eventTime,
              hint: "今天见！先来集结房间报到",
            });
          }
        } else {
          const members = await findMatchedMembers(pool.id);
          if (members.length === 0) continue;
          const memberIds = members.map((member) => member.userId);
          await dependencies.sendRecap(
            memberIds,
            {
              poolId: pool.id,
              poolTitle: pool.title || "活动",
              eventTime,
              // 2026-10-16: service-tone summons into the feedback page
              // (≤20 chars, zero incentive language per WeChat policy; the
              // reward copy lives on the feedback page itself).
              hint: "来聊聊感受，帮下次排桌更合拍",
            },
          );
          // D8 no-grant fallback: fan out the in-app feedback_invite
          // notification to every recap recipient regardless of push grant
          // state (the server only learns about refusals at send time).
          // Idempotent across the 10-min ticks; test pools never reach this
          // branch (excluded in findMatchedPoolsInReminderRange).
          await dependencies.createFeedbackInvites(pool.id, memberIds);
        }
      }
    } catch (error) {
      dependencies.logger.error("[SubscribeReminder] tick failed; will retry next tick", {
        component: "subscribe_reminder",
        failOpen: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    start() {
      stopped = false;
      interval = setInterval(() => {
        void run();
      }, SUBSCRIBE_REMINDER_INTERVAL_MS);
      interval.unref?.();
      return interval;
    },
    stop() {
      stopped = true;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    },
    run,
    isStopped() {
      return stopped;
    },
  };
}

export function startSubscribeReminderScheduler(): NodeJS.Timeout {
  return createSubscribeReminderScheduler().start();
}
