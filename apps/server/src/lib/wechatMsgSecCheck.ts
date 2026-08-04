import { logger } from "./logger";
import type { ViolationType } from "../contentFilter";

/**
 * WeChat 文本内容安全 (msgSecCheck) — Tier-1 semantic moderation layer.
 *
 * Runs ABOVE the deterministic Tier-0 keyword filter (contentFilter.ts).
 * msgSecCheck catches semantic evasions (谐音梗, 拆字, context-dependent abuse)
 * that keyword lists structurally cannot. Policy: FAIL-OPEN — any transport
 * error, timeout, or unexpected errcode passes content through; only explicit
 * "risky" verdicts block.
 *
 * Docs: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
 */

const MSG_SEC_CHECK_URL = "https://api.weixin.qq.com/wxa/msg_sec_check";
const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const REQUEST_TIMEOUT_MS = 3_000;
const TOKEN_SAFETY_MARGIN_MS = 10 * 60 * 1000; // refresh 10min before expiry

/** WeChat security labels → JoyJoin ViolationType (best-effort mapping). */
const LABEL_TO_VIOLATION: Record<number, ViolationType> = {
  20001: "spam", // 广告
  20002: "political", // 时政
  20003: "pornographic", // 色情
  20004: "harassment", // 辱骂
  20005: "illegal", // 违法犯罪
  20006: "illegal", // 毒品
  20007: "political", // 宗教
  20008: "violent", // 暴恐
  20009: "political", // 政治敏感
  20010: "illegal", // 涉枪涉爆
  20011: "illegal", // 诈骗
  20012: "pornographic", // 低俗
  20013: "harassment", // 版权
};

const SEVERE_LABELS = new Set<number>([
  20002, 20003, 20005, 20006, 20007, 20008, 20009, 20010, 20011,
]);

export interface WechatRiskVerdict {
  risky: boolean;
  label?: number;
  traceId?: string;
  violationType?: ViolationType;
  severity?: "warning" | "severe";
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
/** Single-flight guard: concurrent warm/get share one in-flight fetch. */
let tokenFetchPromise: Promise<string | null> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`msgSecCheck timeout after ${ms}ms`)), ms);
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

async function fetchAccessToken(): Promise<string | null> {
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }
  tokenFetchPromise = doFetchAccessToken().finally(() => {
    tokenFetchPromise = null;
  });
  return tokenFetchPromise;
}

async function doFetchAccessToken(): Promise<string | null> {
  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;
  if (!appid || !secret) {
    logger.warn("[msgSecCheck] WECHAT_APPID/WECHAT_SECRET missing, Tier-1 moderation disabled");
    return null;
  }

  const url = `${TOKEN_URL}?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
  try {
    const res = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS);
    const data = (await res.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
    if (data.access_token && typeof data.expires_in === "number") {
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000 - TOKEN_SAFETY_MARGIN_MS),
      };
      return data.access_token;
    }
    logger.warn("[msgSecCheck] access_token fetch failed", { errcode: data.errcode, errmsg: data.errmsg });
  } catch (err) {
    logger.warn("[msgSecCheck] access_token fetch error", { error: String(err) });
  }
  return null;
}

export async function getWechatAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  return fetchAccessToken();
}

/**
 * Fire-and-forget token pre-warm so the critical path never pays for the
 * access-token round-trip (no-op when a fresh token is already cached).
 */
export function warmWechatAccessToken(): void {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return;
  }
  void fetchAccessToken().catch(() => {});
}

/** Exposed for tests: force token re-fetch. */
export function resetWechatAccessTokenCache(): void {
  cachedToken = null;
}

async function callMsgSecCheck(
  token: string,
  content: string,
  openid: string,
): Promise<{
  errcode: number;
  errmsg?: string;
  suggest?: "pass" | "review" | "risky";
  label?: number;
  traceId?: string;
}> {
  const url = `${MSG_SEC_CHECK_URL}?access_token=${encodeURIComponent(token)}`;
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 2,
        openid,
        scene: 2, // 评论/答案
        content,
      }),
    }),
    REQUEST_TIMEOUT_MS,
  );
  const data = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
    result?: { suggest?: "pass" | "review" | "risky"; label?: number };
    trace_id?: string;
  };
  return {
    errcode: data.errcode ?? -1,
    errmsg: data.errmsg,
    suggest: data.result?.suggest,
    label: data.result?.label,
    traceId: data.trace_id,
  };
}

/**
 * Run one msgSecCheck request with a single token-refresh retry for
 * token-invalid errcodes. Returns null on any non-blocking failure (fail-open).
 */
export async function checkTextWithMsgSecCheck(content: string, openid: string): Promise<WechatRiskVerdict | null> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 5000) return null;

  let token = await getWechatAccessToken();
  if (!token) return null;

  try {
    let result = await callMsgSecCheck(token, trimmed, openid);

    if (result.errcode === 40001 || result.errcode === 42001) {
      // Stale/expired token — refresh once and retry
      resetWechatAccessTokenCache();
      token = await getWechatAccessToken();
      if (!token) return null;
      result = await callMsgSecCheck(token, trimmed, openid);
    }

    if (result.errcode === 87014) {
      return {
        risky: true,
        label: result.label,
        traceId: result.traceId,
        violationType: mapLabel(result.label),
        severity: severityForLabel(result.label),
      };
    }

    if (result.errcode !== 0) {
      // Unexpected errcode (quota, invalid openid, …) — fail-open
      logger.warn("[msgSecCheck] unexpected errcode, failing open", {
        errcode: result.errcode,
        errmsg: result.errmsg,
        traceId: result.traceId,
      });
      return null;
    }

    if (result.suggest === "risky") {
      return {
        risky: true,
        label: result.label,
        traceId: result.traceId,
        violationType: mapLabel(result.label),
        severity: result.label !== undefined && SEVERE_LABELS.has(result.label) ? "severe" : "warning",
      };
    }

    return { risky: false, label: result.label, traceId: result.traceId };
  } catch (err) {
    // Transport error / timeout — fail-open
    logger.warn("[msgSecCheck] request failed, failing open", { error: String(err) });
    return null;
  }
}

export function mapLabel(label?: number): ViolationType {
  if (label === undefined) return "harassment";
  return LABEL_TO_VIOLATION[label] ?? "harassment";
}

export function severityForLabel(label?: number): "warning" | "severe" {
  return label !== undefined && SEVERE_LABELS.has(label) ? "severe" : "warning";
}
