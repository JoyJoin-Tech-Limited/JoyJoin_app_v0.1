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
  },
  'sync-failed': {
    surface: 'full-page-error',
    default: '同步没成功',
    mascot: '{{mascotName}}帮你同步结果时遇到了点小状况，再试一次~',
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

  const mascotName = context?.mascotName ?? '悦仔';

  if (template.surface === 'full-page-error' && template.mascot) {
    return template.mascot.replace(/\{\{mascotName\}\}/g, mascotName);
  }

  return template.default;
}

/**
 * Get error message for a specific surface, overriding the default surface.
 * Use this when a full-page error surface needs a toast-level message.
 */
export function getErrorForSurface(
  code: ErrorCode,
  surface: 'toast-error' | 'full-page-error',
  context?: { mascotName?: string }
): string {
  const template = ERROR_TEMPLATES[code];

  if (!template) {
    return surface === 'full-page-error'
      ? `${context?.mascotName ?? '悦仔'}遇到点问题，稍后再试试~`
      : ERROR_CODE_GENERIC_FALLBACK;
  }

  // If the template doesn't have a mascot variant, return default regardless
  if (!template.mascot) {
    return template.default;
  }

  const mascotName = context?.mascotName ?? '悦仔';

  if (surface === 'full-page-error') {
    return template.mascot.replace(/\{\{mascotName\}\}/g, mascotName);
  }

  return template.default;
}

/**
 * Validate all error templates against tone constraints.
 * Returns a map of violations per error code.
 */
export function validateAllErrorTones(): Record<string, string[]> {
  const violations: Record<string, string[]> = {};

  for (const [code, template] of Object.entries(ERROR_TEMPLATES)) {
    const mode = getToneForSurface(template.surface);
    const v = validateCopyTone(template.default, mode);
    if (v.length > 0) {
      violations[code] = v;
    }
    if (template.mascot) {
      const resolved = template.mascot.replace(/\{\{mascotName\}\}/g, '悦仔');
      const v2 = validateCopyTone(resolved, mode);
      if (v2.length > 0) {
        violations[`${code}(mascot)`] = v2;
      }
    }
  }

  return violations;
}
