import { useDidShow } from '@tarojs/taro'

/**
 * Reset boolean flags when the page is re-shown (e.g. swipe-back, foreground).
 * Defensive guard against transient navigation/submit states surviving
 * the WeChat page-stack hide/show cycle.
 */
export function useResetOnShow(...setters: Array<(v: boolean) => void>) {
  useDidShow(() => setters.forEach((fn) => fn(false)))
}
