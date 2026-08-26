/**
 * Error Copy Baselines — 🔴🟡 Constraint
 *
 * Standardised error messages factory functions.
 * - Toast errors (7-12 chars): System UI, no mascot
 * - Full-page errors: 悦仔 Voice, with mascot interpolation
 */

import { DEFAULT_MASCOT_DISPLAY_NAME } from '../mascotConfig.js';
import { getToneForSurface, validateCopyTone } from './toneMap.js';
import type { Surface } from './toneMap.js';

/** Copy returned by `getErrorMessage` when a code has no template — shared
 *  sentinel so consumers can detect "no mapping exists" without duplicating
 *  the literal (N-5 fragility fix). */
export const ERROR_CODE_GENERIC_FALLBACK = '出了点问题，稍后再试';

export type ErrorCode =
  | 'network'
  | 'timeout'
  | 'server'
  | 'submit-failed'
  | 'load-failed'
  | 'generate-failed'
  | 'payment-failed'
  | 'payment-declined'
  | 'session-expired'
  | 'not-found'
  | 'forbidden'
  | 'rate-limited'
  | 'save-failed'
  | 'cancel-failed'
  | 'create-failed'
  | 'switch-failed'
  | 'logout-failed'
  | 'copy-failed'
  | 'operation-failed'
  | 'sync-failed'
  | 'skip-failed'
  | 'auth-timeout'
  | 'offline-preflight'
  | 'offline-draft-safe'
  | 'login-failed'
  | 'restart-failed'
  | 'navigate-failed'
  | 'POOL_CANCELLED'
  | 'POOL_CLOSED'
  | 'REGISTRATION_DEADLINE_PASSED'
  | 'POOL_FULL'
  | 'REGISTRATION_FAILED'
  | 'REGISTRATION_DISABLED'
  | 'PAYMENTS_DISABLED';

interface ErrorTemplate {
  /** Surface type — determines tone mode */
  surface: Extract<Surface, 'toast-error' | 'full-page-error'>;
  /** Default message (no interpolation needed) */
  default: string;
  /** Template with masking for mascot name insertion. {{mascotName}} is the placeholder */
  mascot?: string;
}

const ERROR_TEMPLATES: Record<ErrorCode, ErrorTemplate> = {
  network: {
    surface: 'toast-error',
    default: '网络不太稳，再试试吧',
  },
  timeout: {
    surface: 'toast-error',
    default: '请求超时，再点一次就好',
  },
  server: {
    surface: 'toast-error',
    default: '服务器有点忙，稍后再试',
  },
  'submit-failed': {
    surface: 'toast-error',
    default: '提交没成功，再试一次',
    mascot: '{{mascotName}}没提交成功，再试一次就好~',
  },
  'load-failed': {
    surface: 'full-page-error',
    default: '加载没成功',
    mascot: '{{mascotName}}遇到点小麻烦，再试试看~',
  },
  'generate-failed': {
    surface: 'full-page-error',
    default: '生成没成功',
    mascot: '{{mascotName}}没编出来，重新试试吧~',
  },
  'payment-failed': {
    surface: 'toast-error',
    default: '支付未成功，再试一次即可',
  },
  'payment-declined': {
    surface: 'full-page-error',
    default: '支付被拒绝了',
    mascot: '{{mascotName}}确认过了，这次支付没通过，换种方式再试试？',
  },
  'session-expired': {
    surface: 'toast-error',
    default: '登录已过期，请重新登录',
    mascot: '{{mascotName}}发现登录状态失效了，重新登录一次~',
  },
  'not-found': {
    surface: 'toast-error',
    default: '内容找不到了',
  },
  forbidden: {
    surface: 'toast-error',
    default: '没有权限查看',
  },
  'rate-limited': {
    surface: 'toast-error',
    default: '操作太频繁，稍等一会儿',
  },
  'save-failed': {
    surface: 'toast-error',
    default: '保存没成功，再试试',
  },
  'cancel-failed': {
    surface: 'toast-error',
    default: '取消失败，再试一次',
  },
  'create-failed': {
    surface: 'toast-error',
    default: '创建没成功，再试试',
  },
  'switch-failed': {
    surface: 'toast-error',
    default: '切换没成功，再试试',
    mascot: '{{mascotName}}没换成，再点一次试试~',
  },
  'logout-failed': {
    surface: 'toast-error',
    default: '退出登录没成功，再试试',
  },
  'copy-failed': {
    surface: 'toast-error',
    default: '复制没成功，手动试试',
  },
  'operation-failed': {
    surface: 'toast-error',
    default: '操作没成功，再试试',
    mascot: '{{mascotName}}没操作成功，再试一次~',
  },
  'sync-failed': {
    surface: 'full-page-error',
    default: '同步没成功',
    mascot: '{{mascotName}}帮你同步结果时遇到了点小状况，再试一次~',
  },
  // PR-8 onboarding failure surfaces — mascot variants feed the compact
  // inline error row (XiaoyueInlineError) via getErrorForSurface(code,
  // 'inline-error'); toast defaults stay for system-level surfaces.
  'skip-failed': {
    surface: 'toast-error',
    default: '跳过没成功，再试一次',
    mascot: '{{mascotName}}没跳过这一步，再试一次~',
  },
  'auth-timeout': {
    surface: 'toast-error',
    default: '网络请求超时，请稍后再试',
    mascot: '{{mascotName}}等了一会儿还没连上，再试一次？',
  },
  'offline-preflight': {
    surface: 'toast-error',
    default: '网络好像断开了，连上后再试试',
    mascot: '{{mascotName}}发现网络断开了，连上后再试试~',
  },
  'offline-draft-safe': {
    surface: 'toast-error',
    default: '网络好像断开了，内容已暂存，连上后重新提交就好',
    mascot: '{{mascotName}}发现网络断开了，填好的内容已经暂存，连上后重新提交就好~',
  },
  'login-failed': {
    surface: 'toast-error',
    default: '登录没成功，检查下网络再试试',
    mascot: '{{mascotName}}没登录成功，再试一次就好~',
  },
  'restart-failed': {
    surface: 'toast-error',
    default: '重新开始失败，请检查网络后重试',
    mascot: '{{mascotName}}没能重新开始，再试一次~',
  },
  'navigate-failed': {
    surface: 'toast-error',
    default: '页面跳转失败，请重试',
    mascot: '{{mascotName}}没打开下一页，再点一次~',
  },
  POOL_CANCELLED: {
    surface: 'toast-error',
    default: '本场活动已取消',
  },
  POOL_CLOSED: {
    surface: 'toast-error',
    default: '本场活动已结束报名',
  },
  REGISTRATION_DEADLINE_PASSED: {
    surface: 'toast-error',
    default: '报名时间已截止',
  },
  POOL_FULL: {
    surface: 'toast-error',
    default: '本场活动报名已满',
  },
  REGISTRATION_FAILED: {
    surface: 'toast-error',
    default: '提交没成功，再试一次',
  },
  REGISTRATION_DISABLED: {
    surface: 'toast-error',
    default: '报名通道暂时关闭',
  },
  PAYMENTS_DISABLED: {
    surface: 'full-page-error',
    default: '支付功能维护中',
    mascot: '{{mascotName}}正在升级支付系统，稍后回来试试~',
  },
};

/**
 * Get error message for a given error code.
 * Auto-selects tone based on surface (toast vs full-page).
 *
 * @param code - ErrorCode
 * @param context - Optional context
 * @param context.mascotName - Override mascot name (defaults to MASCOT_NAME)
 * @returns Error message string
 */
export function getErrorMessage(
  code: ErrorCode,
  context?: { mascotName?: string }
): string {
  const template = ERROR_TEMPLATES[code];
  if (!template) {
    return ERROR_CODE_GENERIC_FALLBACK;
  }

  const mascotName = context?.mascotName ?? DEFAULT_MASCOT_DISPLAY_NAME;

  if (template.surface === 'full-page-error' && template.mascot) {
    return template.mascot.replace(/\{\{mascotName\}\}/g, mascotName);
  }

  return template.default;
}

/**
 * Get error message for a specific surface, overriding the default surface.
 * Use this when a full-page error surface needs a toast-level message, or
 * when a compact inline error row needs the 悦仔-voice (mascot) variant.
 */
export function getErrorForSurface(
  code: ErrorCode,
  surface: 'toast-error' | 'full-page-error' | 'inline-error',
  context?: { mascotName?: string }
): string {
  const template = ERROR_TEMPLATES[code];

  if (!template) {
    return surface === 'full-page-error' || surface === 'inline-error'
      ? `${context?.mascotName ?? DEFAULT_MASCOT_DISPLAY_NAME}遇到点问题，稍后再试试~`
      : ERROR_CODE_GENERIC_FALLBACK;
  }

  // If the template doesn't have a mascot variant, return default regardless
  if (!template.mascot) {
    return template.default;
  }

  const mascotName = context?.mascotName ?? DEFAULT_MASCOT_DISPLAY_NAME;

  if (surface === 'full-page-error' || surface === 'inline-error') {
    return template.mascot.replace(/\{\{mascotName\}\}/g, mascotName);
  }

  return template.default;
}

/**
 * PR-8: full-stage failure copy for the personality-test results ErrorStage
 * and the completing-error stage. Centralised so the 悦仔 voice stays
 * governed (zero emoji, WeChat-review vocabulary) instead of drifting as
 * hardcoded strings inside page components.
 */
export const ONBOARDING_ERROR_STAGE_COPY = {
  resultsError: {
    offlineTitle: '网络好像断开了',
    offlineBody: '请检查网络连接后点击重试，结果已经保存在本地。',
    offlineHint: '恢复网络后，点「再试试」就能继续揭晓。',
    interruptedTitle: '揭晓过程被打断了',
    fallbackBody: '同步遇到小状况，再试一次就好~',
    retryHint: '点「再试试」会重新获取结果，不会重复答题。',
    retryBusyLabel: '正在同步…',
    retryLabel: '再试试',
    retryTooltip: '网络波动时可能需要多试一次',
    restartLabel: '重新测试一次',
  },
  completingError: {
    title: '同步遇到小状况',
    serverBusyBody: '服务器开小差了，稍后再试',
    fallbackBody: `${DEFAULT_MASCOT_DISPLAY_NAME}马上帮你重试~`,
    handoffFailedBody: '结果页没打开，点下面再试一次~',
    syncFailedBody: '结果同步出了点小状况，再试一次就好~',
    retryLabel: '重新打开结果',
  },
} as const;

/**
 * Emoji are banned from error copy (zero-emoji guardrail): reactions and
 * status icons come from JoyJoinIcon / mascot art, never raw emoji.
 */
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

/**
 * Validate all error templates against tone constraints.
 * Returns a map of violations per error code.
 *
 * - `default` copy is validated against its own surface's tone mode.
 * - `mascot` variants are validated against the `inline-error`/full-page
 *   tone mode (yuezai-voice), even when the template's default surface is a
 *   toast — the mascot variant is only ever consumed on 悦仔-voice surfaces.
 * - Both variants must be emoji-free.
 */
export function validateAllErrorTones(): Record<string, string[]> {
  const violations: Record<string, string[]> = {};

  for (const [code, template] of Object.entries(ERROR_TEMPLATES)) {
    const mode = getToneForSurface(template.surface);
    const v = validateCopyTone(template.default, mode);
    if (EMOJI_PATTERN.test(template.default)) {
      v.push('Emoji not allowed in error copy');
    }
    if (v.length > 0) {
      violations[code] = v;
    }
    if (template.mascot) {
      const resolved = template.mascot.replace(/\{\{mascotName\}\}/g, DEFAULT_MASCOT_DISPLAY_NAME);
      const mascotMode = getToneForSurface('inline-error');
      const v2 = validateCopyTone(resolved, mascotMode);
      if (EMOJI_PATTERN.test(resolved)) {
        v2.push('Emoji not allowed in error copy');
      }
      if (v2.length > 0) {
        violations[`${code}(mascot)`] = v2;
      }
    }
  }

  return violations;
}
