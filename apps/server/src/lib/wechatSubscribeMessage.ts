import { inArray } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { logger } from "./logger";
import { getWechatAccessToken } from "./wechatMsgSecCheck";
import { subscribeMessageSendsRepo } from "../repositories/subscribeMessageSendsRepo";

/**
 * WeChat 订阅消息 (subscribe message) — server-side send, 3-template set.
 *
 * Grant flow: the mini-program calls `wx.requestSubscribeMessage` from the
 * registration-ceremony 「开启活动消息提醒」 button (template IDs from
 * `TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS`); each acceptance licenses ONE send
 * on that template. The three templates cover one full event lifecycle:
 *
 *   result   报名结果提醒 (WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS)
 *            → 排桌完成 XOR 未成行退款 (mutually exclusive per registration)
 *            fields: 活动名称 thing4 / 活动时间 time15 / 温馨提示 thing7
 *   reminder 活动状态提醒 (WECHAT_SUBSCRIBE_TMPL_EVENT_REMINDER)
 *            → 活动当天早上提醒 XOR 候补席位空出 (安心补位 Phase 1)
 *            fields: 活动名称 thing1 / 活动时间 time2 / 活动地点 thing6 / 温馨提示 thing4
 *   recap    活动评价提醒 (WECHAT_SUBSCRIBE_TMPL_RECAP)
 *            → 活动后 T+1 回顾 + 反馈召唤
 *            fields: 活动名称 thing1 / 活动时间 time4 / 温馨提示 thing3
 *
 * ⚠️ The field keys are NOT sequential and differ per template (WeChat
 * numbers them from the chosen library template, and adding a subset of
 * fields does not renumber). The values above are the authoritative keys
 * read from the WeChat `wxaapi/newtmpl/gettemplate` API on 2026-09-16.
 * Never guess them: run `npm run verify:subscribe-templates` when a template
 * is re-created or its fields are edited, and update TEMPLATES below.
 *
 * Policy: FAIL-OPEN. Missing template id, transport errors, and user refusals
 * (errcode 43101) log and return; matching/refund side effects must never
 * break because a push didn't land. Idempotency: every send claims a
 * (user, moment, pool) slot in the subscribe_message_sends ledger first.
 */

const SEND_URL = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send";
const REQUEST_TIMEOUT_MS = 3_000;

/** Landing page when the user taps the message — events tab (足迹). */
const LANDING_PAGE = "pages/events/index";

/** WeChat `thing` fields cap at 20 chars. */
function clampThing(value: string): string {
  return value.length > 20 ? `${value.slice(0, 19)}…` : value;
}

function formatEventTime(date: Date | null): string {
  if (!date) return "时间待定";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface SubscribePushContext {
  poolId: string;
  poolTitle: string;
  eventTime: Date | null;
  /** 温馨提示 field (≤20 chars). */
  hint: string;
  /** 活动地点 field (reminder template only). */
  venue?: string;
}

type TemplateKey = "result" | "reminder" | "recap";
type Moment = "match_success" | "refund" | "event_day" | "recap";

const TEMPLATES: Record<
  TemplateKey,
  {
    envVar: string;
    buildData: (ctx: SubscribePushContext) => Record<string, { value: string }>;
  }
> = {
  result: {
    envVar: "WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS",
    buildData: (ctx) => ({
      thing4: { value: clampThing(ctx.poolTitle) },
      time15: { value: formatEventTime(ctx.eventTime) },
      thing7: { value: clampThing(ctx.hint) },
    }),
  },
  reminder: {
    envVar: "WECHAT_SUBSCRIBE_TMPL_EVENT_REMINDER",
    buildData: (ctx) => ({
      thing1: { value: clampThing(ctx.poolTitle) },
      time2: { value: formatEventTime(ctx.eventTime) },
      thing6: { value: clampThing(ctx.venue?.trim() || "详见活动页") },
      thing4: { value: clampThing(ctx.hint) },
    }),
  },
  recap: {
    envVar: "WECHAT_SUBSCRIBE_TMPL_RECAP",
    buildData: (ctx) => ({
      thing1: { value: clampThing(ctx.poolTitle) },
      time4: { value: formatEventTime(ctx.eventTime) },
      thing3: { value: clampThing(ctx.hint) },
    }),
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`subscribeMessage timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function sendOne(
  token: string,
  templateId: string,
  openid: string,
  data: Record<string, { value: string }>,
  moment: Moment,
): Promise<void> {
  let result: { errcode?: number; errmsg?: string };
  try {
    const res = await withTimeout(
      fetch(`${SEND_URL}?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touser: openid,
          template_id: templateId,
          page: LANDING_PAGE,
          miniprogram_state: process.env.APP_MODE === "production" ? "formal" : "trial",
          lang: "zh_CN",
          data,
        }),
      }),
      REQUEST_TIMEOUT_MS,
    );
    result = (await res.json()) as { errcode?: number; errmsg?: string };
  } catch (err) {
    // Transport error / timeout — fail-open (per-recipient isolation lives
    // in sendTemplateToUsers; a failed send never aborts the batch).
    logger.warn("[SubscribeMsg] transport error, push skipped", {
      openid,
      moment,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (result.errcode === 0) {
    logger.info("[SubscribeMsg] message sent", { openid, moment });
    return;
  }
  if (result.errcode === 43101) {
    // User refused the grant (or grant already consumed) — expected, quiet.
    logger.info("[SubscribeMsg] user not subscribed (43101), skipping", { openid, moment });
    return;
  }
  logger.warn("[SubscribeMsg] send failed", { openid, moment, errcode: result.errcode, errmsg: result.errmsg });
}

async function sendTemplateToUsers(
  moment: Moment,
  templateKey: TemplateKey,
  memberUserIds: string[],
  ctx: SubscribePushContext,
): Promise<void> {
  const template = TEMPLATES[templateKey];
  const templateId = process.env[template.envVar];
  // Dark until the template id is configured — the whole channel ships off.
  if (!templateId || memberUserIds.length === 0) {
    return;
  }

  try {
    const rows: Array<{ id: string; openid: string | null }> = await db
      .select({ id: users.id, openid: users.wechatOpenId })
      .from(users)
      .where(inArray(users.id, memberUserIds));
    const recipients = rows.filter(
      (row: { id: string; openid: string | null }): row is { id: string; openid: string } =>
        typeof row.openid === "string" && row.openid.length > 0,
    );
    if (recipients.length === 0) {
      logger.info("[SubscribeMsg] no openids resolved", { moment, count: memberUserIds.length });
      return;
    }

    const token = await getWechatAccessToken();
    if (!token) {
      logger.warn("[SubscribeMsg] no access token, push skipped", { moment, count: recipients.length });
      return;
    }

    const data = template.buildData(ctx);
    await Promise.all(
      recipients.map(async (recipient: { id: string; openid: string }) => {
        try {
          const claimed = await subscribeMessageSendsRepo.tryClaimSend({
            userId: recipient.id,
            poolId: ctx.poolId,
            moment,
            templateId,
          });
          if (!claimed) return; // a previous run/tick already handled this slot
          await sendOne(token, templateId, recipient.openid, data, moment);
        } catch (err) {
          logger.warn("[SubscribeMsg] send error", {
            openid: recipient.openid,
            moment,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
  } catch (err) {
    logger.warn("[SubscribeMsg] push failed (fail-open)", {
      moment,
      error: err instanceof Error ? err.message : String(err),
      count: memberUserIds.length,
    });
  }
}

/** 排桌完成 (match success) — result template. */
export async function sendMatchSuccessSubscribeMessages(
  memberUserIds: string[],
  ctx: Omit<SubscribePushContext, "hint"> & { hint?: string },
): Promise<void> {
  await sendTemplateToUsers("match_success", "result", memberUserIds, {
    ...ctx,
    hint: ctx.hint ?? "排桌完成，点击查看同桌伙伴",
  });
}

/** 未成行/取消/塌组退款 — result template (mutually exclusive with match_success per registration). */
export async function sendRefundSubscribeMessages(
  userIds: string[],
  ctx: SubscribePushContext,
): Promise<void> {
  await sendTemplateToUsers("refund", "result", userIds, ctx);
}

/** 活动当天早上提醒 — reminder template (carries venue). */
export async function sendEventDayReminders(
  userIds: string[],
  ctx: SubscribePushContext,
): Promise<void> {
  await sendTemplateToUsers("event_day", "reminder", userIds, ctx);
}

/** 活动后 T+1 回顾 + 反馈召唤 — recap template. */
export async function sendRecapReminders(
  userIds: string[],
  ctx: SubscribePushContext,
): Promise<void> {
  await sendTemplateToUsers("recap", "recap", userIds, ctx);
}
