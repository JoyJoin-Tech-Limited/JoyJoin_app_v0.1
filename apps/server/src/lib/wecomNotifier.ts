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
