/**
 * WeChat contact ID validator — single source of truth for both server and
 * mini-program (wechat-id-collection-spec-20261016 §4.3).
 *
 * Rules: WeChat IDs are 6–20 chars, letter-first, letters/digits/underscore/
 * dash only. `wxid_`-prefixed values are WeChat's system-default identifiers
 * and cannot be searched/added by other users — accepting one would exchange
 * a dead ID, so they are rejected with a dedicated reason.
 *
 * Copy constants live here too so both ends render identical guidance.
 */

export const WECHAT_CONTACT_ID_MAX_LENGTH = 20;

/** 6–20 chars, letter-first, letters/digits/underscore/dash. */
const WECHAT_CONTACT_ID_REGEX = /^[A-Za-z][A-Za-z0-9_-]{5,19}$/;

const WCID_SYSTEM_PREFIX_REGEX = /^wxid_/i;

export type WechatContactIdError = 'format' | 'wxid-prefix';

export type WechatContactIdValidation =
  | { ok: true; value: string }
  | { ok: false; reason: WechatContactIdError };

export function validateWechatContactId(raw: string): WechatContactIdValidation {
  const value = raw.trim();
  if (WCID_SYSTEM_PREFIX_REGEX.test(value)) {
    return { ok: false, reason: 'wxid-prefix' };
  }
  if (!WECHAT_CONTACT_ID_REGEX.test(value)) {
    return { ok: false, reason: 'format' };
  }
  return { ok: true, value };
}

/** Persistent hint rendered under the input (not a placeholder — placeholders
 *  vanish once the user types). */
export const WECHAT_ID_FORMAT_HINT = '字母开头，6-20 位，可含数字、下划线、减号';

/** Inline error for the wxid_ system-ID case. */
export const WECHAT_ID_WCID_PREFIX_HINT =
  'wxid_ 开头的是系统号，别人搜不到；填你自己设置的微信号';

/** One-time semantics reassurance (set-once → works for every future event). */
export const WECHAT_ID_SET_ONCE_HINT = '设置一次，之后每局互选都自动生效';
