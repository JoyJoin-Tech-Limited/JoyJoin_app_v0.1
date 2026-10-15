import { logger } from "./logger";
import { getWechatAccessToken } from "./wechatMsgSecCheck";

/**
 * WeChat 小程序码 (wxacode.getUnlimited) for the personality share poster.
 *
 * The poster is a static image — friends cannot tap it. A mini-program code
 * is the only direct conversion lever: long-press the received image →
 * WeChat recognizes the code → opens the personality-test intro page with
 * the sharer's referral code in `scene` (`ic=<code>`, parsed client-side by
 * apps/mini-program/src/lib/referral/shareQrScene.ts).
 *
 * Policy: FAIL-OPEN. Missing app config, token failure, WeChat errcode, or
 * transport errors all return null — the caller (share poster) then renders
 * a copy-only CTA band instead of a code.
 *
 * Docs: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/wxacode.getUnlimited.html
 */

const WXACODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit";
const REQUEST_TIMEOUT_MS = 5_000;

/** Landing page for code arrivals — the personality-test intro. */
const QR_TARGET_PAGE = "pages/onboarding/personality-test/index";

/** Scene prefix kept in sync with the client parser (shareQrScene.ts). */
export const SHARE_QR_SCENE_PREFIX = "ic=";

/** WeChat scene rules: ≤32 chars, restricted charset. Our codes are 6-char lowercase. */
const SCENE_CODE_PATTERN = /^[a-z0-9]+$/;

export function buildShareQrScene(referralCode: string): string | null {
  const code = referralCode.trim().toLowerCase();
  if (!SCENE_CODE_PATTERN.test(code)) return null;
  const scene = `${SHARE_QR_SCENE_PREFIX}${code}`;
  return scene.length <= 32 ? scene : null;
}

interface CachedQrCode {
  bytes: Buffer;
  expiresAt: number;
}

/** QR bytes are stable per referral code (page + scene fixed) — cache a week. */
const QR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const QR_CACHE_MAX_ENTRIES = 200;
const qrCache = new Map<string, CachedQrCode>();

function readCache(scene: string): Buffer | null {
  const entry = qrCache.get(scene);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    qrCache.delete(scene);
    return null;
  }
  return entry.bytes;
}

function writeCache(scene: string, bytes: Buffer): void {
  if (qrCache.size >= QR_CACHE_MAX_ENTRIES) {
    const oldestKey = qrCache.keys().next().value;
    if (oldestKey !== undefined) qrCache.delete(oldestKey);
  }
  qrCache.set(scene, { bytes, expiresAt: Date.now() + QR_CACHE_TTL_MS });
}

/** Test-only escape hatch. */
export function clearShareQrCodeCache(): void {
  qrCache.clear();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`shareQrCode timeout after ${ms}ms`)), ms);
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

export interface ShareQrCodeResult {
  bytes: Buffer;
  cacheHit: boolean;
}

/**
 * Fetch (or reuse) the mini-program code PNG for a referral code.
 * Returns null on any failure — callers must treat null as "render copy-only".
 */
export async function getShareQrCodeImage(referralCode: string): Promise<ShareQrCodeResult | null> {
  const scene = buildShareQrScene(referralCode);
  if (!scene) {
    logger.warn("[shareQrCode] referral code rejected by scene whitelist", { length: referralCode.length });
    return null;
  }

  const cached = readCache(scene);
  if (cached) {
    return { bytes: cached, cacheHit: true };
  }

  const token = await getWechatAccessToken();
  if (!token) {
    logger.warn("[shareQrCode] no WeChat access token available");
    return null;
  }

  try {
    const res = await withTimeout(
      fetch(`${WXACODE_URL}?access_token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene,
          page: QR_TARGET_PAGE,
          // check_path=false: the target page exists but trial/dev builds
          // must not be rejected by WeChat's published-page validation.
          check_path: false,
          env_version: process.env.APP_MODE === "production" ? "release" : "trial",
          width: 430,
          // Solid white background — the code sits in a white chip on the
          // purple CTA band; transparent (is_hyaline) codes scan poorly.
          is_hyaline: false,
        }),
      }),
      REQUEST_TIMEOUT_MS,
    );

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) {
      // Error path returns JSON: { errcode, errmsg }
      const data = (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null;
      logger.warn("[shareQrCode] wxacode.getUnlimited rejected", { errcode: data?.errcode, errmsg: data?.errmsg });
      return null;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) {
      logger.warn("[shareQrCode] wxacode.getUnlimited returned empty body");
      return null;
    }

    writeCache(scene, bytes);
    return { bytes, cacheHit: false };
  } catch (err) {
    logger.warn("[shareQrCode] wxacode.getUnlimited fetch error", { error: String(err) });
    return null;
  }
}
