import Taro from '@tarojs/taro'

/**
 * P0 E1 (2026-10-20 E-track): icebreaker draft persistence — pure storage
 * helpers. Key shape: `jj_draft_${sessionId}_${phase}_${userId}`.
 *
 * Lifecycle contract (enforced by hooks/useIcebreakerDraft + call sites):
 *   - input → debounced write (≤ ICEBREAKER_DRAFT_DEBOUNCE_MS, latest wins)
 *   - mount → component restores via readIcebreakerDraft
 *   - submit success OR phase switch → clearIcebreakerDraft
 *   - app kill → no cleanup runs, so the draft survives and restores on
 *     re-entry (the E1 incident shape: host advance / kill → draft lost)
 *
 * Registered as the `jj_draft_` prefix in lib/auth/userScopedStorage.ts
 * (user-scoped — cleared on hard reset). WeChat sync storage API used
 * directly; every call is try/catch because a full/unavailable store must
 * never break gameplay (draft is best-effort).
 */

export const ICEBREAKER_DRAFT_DEBOUNCE_MS = 400

export function buildIcebreakerDraftKey(sessionId: string, phase: string, userId: string): string {
  return `jj_draft_${sessionId}_${phase}_${userId}`
}

export function readIcebreakerDraft(key: string): string | null {
  try {
    const value = Taro.getStorageSync<string>(key)
    return typeof value === 'string' && value !== '' ? value : null
  } catch {
    return null
  }
}

export function writeIcebreakerDraft(key: string, value: string): void {
  try {
    Taro.setStorageSync(key, value)
  } catch {
    // Storage full / bridge down — draft is best-effort, gameplay wins.
  }
}

export function clearIcebreakerDraft(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {
    // Key may not exist — idempotent by design.
  }
}
