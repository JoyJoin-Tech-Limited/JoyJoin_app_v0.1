import { logger } from "./logger";

export type BotChannel = "ops" | "critical" | "finance";

interface BotConfig {
  key: string;
  baseUrl: string;
}

const BOT_KEYS: Record<BotChannel, BotConfig> = {
  ops: {
    key: process.env.WECOM_OPS_BOT_KEY || process.env.WECOM_BOT_KEY || "",
    baseUrl: process.env.WECOM_BOT_WEBHOOK || "https://qyapi.weixin.qq.com/cgi-bin/webhook/send",
  },
  critical: {
    key: process.env.WECOM_CRITICAL_BOT_KEY || "",
    baseUrl: process.env.WECOM_BOT_WEBHOOK || "https://qyapi.weixin.qq.com/cgi-bin/webhook/send",
  },
  finance: {
    key: process.env.WECOM_FINANCE_BOT_KEY || "",
    baseUrl: process.env.WECOM_BOT_WEBHOOK || "https://qyapi.weixin.qq.com/cgi-bin/webhook/send",
  },
};

const TIMEOUT_MS = parseInt(process.env.WECOM_BOT_TIMEOUT_MS || "10000", 10);

const ADMIN_BASE_URL = process.env.ADMIN_URL || process.env.APP_URL || "";

/**
 * In-memory debounce aggregator for high-frequency events.
 * Aggregates multiple same-type notifications into a single message.
 */
const debounceMap = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();

function debounceNotification(
  botKey: string,
  typeKey: string,
  aggregator: (count: number) => { title: string; lines: string[] },
  windowMs = 5000,
): void {
  const mapKey = `${botKey}:${typeKey}`;
  const existing = debounceMap.get(mapKey);
  if (existing) {
    existing.count++;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => {
      const msg = aggregator(existing.count);
      sendRawWeComMarkdown(botKey, msg.title, msg.lines, []);
      debounceMap.delete(mapKey);
    }, windowMs);
    return;
  }
  debounceMap.set(mapKey, {
    count: 1,
    timer: setTimeout(() => {
      const msg = aggregator(1);
      sendRawWeComMarkdown(botKey, msg.title, msg.lines, []);
      debounceMap.delete(mapKey);
    }, windowMs),
  });
}

export interface WeComNotifyOptions {
  title: string;
  lines: string[];
  mentionedMobileList?: string[];
  channel?: BotChannel;
}

export async function sendWeComMarkdown(options: WeComNotifyOptions): Promise<boolean> {
  const channel = options.channel || "ops";
  const config = BOT_KEYS[channel];
  if (!config.key) {
    logger.debug(`WeCom bot "${channel}" not configured; skipping notification`, { title: options.title });
    return false;
  }
  return sendRawWeComMarkdown(config.key, options.title, options.lines, options.mentionedMobileList);
}

async function sendRawWeComMarkdown(
  botKey: string,
  title: string,
  lines: string[],
  mentionedMobileList?: string[],
): Promise<boolean> {
  const baseUrl = BOT_KEYS.ops.baseUrl;
  const webhookUrl = `${baseUrl}?key=${botKey}`;

  const content = [
    `**${title}**`,
    "",
    ...lines,
  ].join("\n");

  const encoder = new TextEncoder();
  const safeContent = encoder.encode(content).length > 4000
    ? content.slice(0, 3996) + "\n…"
    : content;

  const body: Record<string, unknown> = {
    msgtype: "markdown",
    markdown: { content: safeContent },
  };

  if (mentionedMobileList && mentionedMobileList.length > 0) {
    body.markdown = {
      content: safeContent,
      mentioned_mobile_list: mentionedMobileList,
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
      logger.warn("WeCom bot HTTP error", { status: res.status, title });
      return false;
    }

    const json = (await res.json()) as { errcode: number; errmsg: string };

    if (json.errcode === 0) {
      logger.info("WeCom notification sent", { title });
      return true;
    }
    logger.warn("WeCom bot API error", { errcode: json.errcode, errmsg: json.errmsg, title });
    return false;
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = (err as Error)?.name === "AbortError";
    logger.warn(
      isTimeout ? `WeCom bot timeout after ${TIMEOUT_MS}ms` : "WeCom bot request failed",
      { error: String(err), title },
    );
    return false;
  }
}

export function buildAdminUrl(path: string): string {
  return `${ADMIN_BASE_URL}${path}`;
}

export function sanitizeUserPayload(user: {
  id?: string;
  displayName?: string | null;
  gender?: string | null;
  birthdate?: string | Date | null;
  primaryArchetype?: string | null;
  currentCity?: string | null;
  educationLevel?: string | null;
  occupationId?: string | null;
  industryNicheLabel?: string | null;
  intent?: string[] | null;
  lifeStage?: string | null;
  relationshipStatus?: string | null;
  referralSource?: string | null;
}): {
  userId: string;
  displayName: string;
  gender: string;
  age: number | null;
  archetype: string;
  city: string;
  education: string;
  occupation: string;
  intentList: string;
  lifeStage: string;
  relationshipStatus: string;
} {
  const age = user.birthdate
    ? Math.floor(
        (Date.now() - new Date(user.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;
  return {
    userId: user.id || "unknown",
    displayName: user.displayName || "未知用户",
    gender: user.gender || "未设置",
    age,
    archetype: user.primaryArchetype || "未完成",
    city: user.currentCity || "未设置",
    education: user.educationLevel || "未设置",
    occupation: user.industryNicheLabel || user.occupationId || "未设置",
    intentList: user.intent?.join("、") || "未设置",
    lifeStage: user.lifeStage || "未设置",
    relationshipStatus: user.relationshipStatus || "未设置",
  };
}

export async function notifyOpsMarkdown(title: string, lines: string[], mentionedMobileList?: string[]): Promise<boolean> {
  return sendWeComMarkdown({ title, lines, mentionedMobileList, channel: "ops" });
}

export async function notifyCriticalMarkdown(title: string, lines: string[], mentionedMobileList?: string[]): Promise<boolean> {
  return sendWeComMarkdown({ title, lines, mentionedMobileList, channel: "critical" });
}

export async function notifyFinanceMarkdown(title: string, lines: string[], mentionedMobileList?: string[]): Promise<boolean> {
  return sendWeComMarkdown({ title, lines, mentionedMobileList, channel: "finance" });
}

export async function notifyCityUnlockThreshold(city: string, count: number, threshold: number): Promise<void> {
  await notifyOpsMarkdown("🎯 城市解锁阈值达成", [
    `城市：**${city}**`,
    `当前关注人数：**${count} 人**`,
    `解锁阈值：**${threshold} 人** ✅`,
    "",
    "该城市已达到可调研阈值，请评估是否启动场地调研。",
    "",
    `[查看解锁看板 →](${buildAdminUrl("/admin/cities/unlock-report")})`,
  ]);
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
  totalGroups: number;
  daysUntilEvent: number;
  reasonBreakdown: Record<string, number>;
}

export async function notifyVenueUnassigned(payload: VenueUnassignedNotifyPayload): Promise<void> {
  const reasonLabels: Record<string, string> = {
    budget_mismatch: "预算不匹配",
    capacity_insufficient: "容量不足",
    no_available_slots: "无可用时段",
    slot_fully_booked_at_save: "时段已满",
    no_suitable_venue: "无合适场地",
    contract_expired: "合同已过期",
  };

  const reasonLines = Object.entries(payload.reasonBreakdown).map(
    ([reason, count]) => `- ${reasonLabels[reason] || reason}：**${count} 组**`,
  );

  const actionGuide = payload.daysUntilEvent <= 1
    ? "联系场地供应商 / 调整分组方案 / 联系受影响用户改期"
    : "评估场地资源，优先联系已有合作场地";

  await notifyCriticalMarkdown("🚨 场地分配异常", [
    `活动池：**${payload.poolTitle}**`,
    `日期：**${payload.poolDate}**（${payload.daysUntilEvent} 天后）`,
    `未分配：**${payload.unassignedCount} 组 / 共 ${payload.totalGroups} 组**`,
    "",
    "原因分析：",
    ...reasonLines,
    "",
    `**建议操作：** ${actionGuide}`,
    "",
    `[立即处理 →](${buildAdminUrl(`/admin/pools/${encodeURIComponent(payload.poolTitle)}`)})`,
  ]);
}

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
    `状态：**${statusLabels[payload.oldStatus]}** → **${statusLabels[payload.newStatus]}**`,
  ];
  if (payload.reason) {
    lines.push("", `原因：**${payload.reason}**`);
  }
  lines.push("", `[查看场地详情 →](${buildAdminUrl("/admin/venues")})`);

  await notifyOpsMarkdown(title, lines);
}

export { debounceNotification, sendRawWeComMarkdown };
