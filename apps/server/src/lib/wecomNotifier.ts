/**
 * WeCom (企业微信) group bot notification helper.
 *
 * Lightweight wrapper around WeCom bot webhook for server-side notifications.
 * Uses native fetch with timeout. Falls back gracefully if WECOM_BOT_KEY is not set.
 *
 * Environment:
 *   WECOM_BOT_KEY        – Required for actual delivery. Bot webhook key.
 *   WECOM_BOT_WEBHOOK    – Optional. Full webhook URL override.
 *   WECOM_BOT_TIMEOUT_MS – Optional. Request timeout (default: 10000).
 */

import { logger } from "./logger";

const BOT_KEY = process.env.WECOM_BOT_KEY || "";
const BOT_WEBHOOK_BASE =
  process.env.WECOM_BOT_WEBHOOK || "https://qyapi.weixin.qq.com/cgi-bin/webhook/send";
const TIMEOUT_MS = parseInt(process.env.WECOM_BOT_TIMEOUT_MS || "10000", 10);

export interface WeComNotifyOptions {
  /** Message title / header (bold in markdown) */
  title: string;
  /** Message body lines */
  lines: string[];
  /** Optional: mention @all or specific mobiles */
  mentionedMobileList?: string[];
}

/**
 * Send a markdown notification to the configured WeCom group bot.
 *
 * Returns `true` if the message was accepted by WeCom API.
 * Returns `false` silently if WECOM_BOT_KEY is not configured (dev / test env).
 */
export async function sendWeComMarkdown(options: WeComNotifyOptions): Promise<boolean> {
  if (!BOT_KEY) {
    logger.debug("WeCom bot not configured (WECOM_BOT_KEY missing); skipping notification", { title: options.title });
    return false;
  }

  const webhookUrl = `${BOT_WEBHOOK_BASE}?key=${BOT_KEY}`;

  const content = [
    `**${options.title}**`,
    "",
    ...options.lines,
  ].join("\n");

  // Truncate to WeCom markdown limit (4096 bytes)
  const safeContent = content.length > 4000 ? content.slice(0, 3996) + "\n…" : content;

  const body: Record<string, unknown> = {
    msgtype: "markdown",
    markdown: { content: safeContent },
  };

  if (options.mentionedMobileList && options.mentionedMobileList.length > 0) {
    body.markdown = {
      content: safeContent,
      mentioned_mobile_list: options.mentionedMobileList,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      logger.warn("WeCom bot HTTP error", { status: res.status, title: options.title });
      return false;
    }

    const json = (await res.json()) as { errcode: number; errmsg: string };

    if (json.errcode === 0) {
      logger.info("WeCom notification sent", { title: options.title });
      return true;
    } else {
      logger.warn("WeCom bot API error", { errcode: json.errcode, errmsg: json.errmsg, title: options.title });
      return false;
    }
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = (err as Error)?.name === "AbortError";
    logger.warn(
      isTimeout ? `WeCom bot timeout after ${TIMEOUT_MS}ms` : "WeCom bot request failed",
      { error: String(err), title: options.title }
    );
    return false;
  }
}

/**
 * Convenience wrapper for city-unlock threshold notifications.
 */
export async function notifyCityUnlockThreshold(city: string, count: number, threshold: number): Promise<void> {
  await sendWeComMarkdown({
    title: "🎯 城市解锁阈值达成",
    lines: [
      `城市：**${city}**`,
      `当前关注人数：**${count} 人**`,
      `解锁阈值：**${threshold} 人** ✅`,
      "",
      `该城市已达到可调研阈值，请评估是否启动场地调研。`,
      "",
      `[查看解锁看板 →](${process.env.APP_URL || ""}/admin/cities/unlock-report)`,
    ],
  });
}

export interface VenueOnboardingNotifyPayload {
  venueName: string;
  venueCity: string;
  venueArea?: string;
  oldStatus: string;
  newStatus: string;
  adminName: string;
  reason?: string;
}

export interface VenueUnassignedNotifyPayload {
  poolTitle: string;
  poolCity: string;
  poolDistrict?: string;
  poolDate: string;
  unassignedCount: number;
  reasonBreakdown: Record<string, number>;
}

/**
 * Convenience wrapper for unassigned venue group alerts.
 */
export async function notifyVenueUnassigned(payload: VenueUnassignedNotifyPayload): Promise<void> {
  const reasonLabels: Record<string, string> = {
    budget_mismatch: "预算不匹配",
    capacity_insufficient: "容量不足",
    no_available_slots: "无可用时段",
    slot_fully_booked_at_save: "时段已满",
    no_suitable_venue: "无合适场地",
  };

  const reasonLines = Object.entries(payload.reasonBreakdown).map(
    ([reason, count]) => `- ${reasonLabels[reason] || reason}：**${count} 组**`
  );

  await sendWeComMarkdown({
    title: "⚠️ 场地分配异常",
    lines: [
      `活动池：**${payload.poolTitle}**`,
      `城市：**${payload.poolCity}${payload.poolDistrict ? " · " + payload.poolDistrict : ""}**`,
      `日期：**${payload.poolDate}**`,
      `未分配组数：**${payload.unassignedCount} 组**`,
      "",
      "原因 breakdown：",
      ...reasonLines,
      "",
      `[查看活动池详情 →](${process.env.APP_URL || ""}/admin/pools)`,
    ],
  });
}

/**
 * Convenience wrapper for venue onboarding status transitions.
 */
export async function notifyVenueOnboardingStatusChange(payload: VenueOnboardingNotifyPayload): Promise<void> {
  const statusLabels: Record<string, string> = {
    draft: "草稿",
    pending_review: "待审核",
    active: "正式合作",
    suspended: "已暂停",
  };
  const isSubmit = payload.newStatus === "pending_review";
  const isReject = payload.newStatus === "draft" && payload.oldStatus === "pending_review";
  if (!isSubmit && !isReject) return;

  const title = isSubmit ? "🏠 新场地待审核" : "❌ 场地审核驳回";
  const lines = [
    `场地：**${payload.venueName}**`,
    `城市：**${payload.venueCity}${payload.venueArea ? " · " + payload.venueArea : ""}**`,
    `操作人：**${payload.adminName}**`,
    isSubmit
      ? `状态：**${statusLabels[payload.oldStatus]}** → **${statusLabels[payload.newStatus]}**`
      : `状态：**${statusLabels[payload.oldStatus]}** → **${statusLabels[payload.newStatus]}**`,
  ];
  if (payload.reason) {
    lines.push("", `原因：**${payload.reason}**`);
  }
  lines.push(
    "",
    `[查看场地详情 →](${process.env.APP_URL || ""}/admin/venues)`,
  );

  await sendWeComMarkdown({ title, lines });
}
