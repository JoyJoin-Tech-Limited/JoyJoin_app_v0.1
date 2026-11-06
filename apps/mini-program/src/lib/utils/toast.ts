import Taro from '@tarojs/taro'
import { TOAST_DEFAULT_MS, TOAST_ERROR_MS, TOAST_SHORT_MS } from './uiConstants'

export type ToastTone = 'neutral' | 'success' | 'error'

/**
 * Thin native-toast adapter. Tones only provide default icon/duration;
 * every native Taro option is forwarded and explicit caller values win.
 */
export type AppToastOptions = Parameters<typeof Taro.showToast>[0] & {
  tone?: ToastTone
}

const TONE_DEFAULTS = {
  neutral: { icon: 'none', duration: TOAST_DEFAULT_MS },
  success: { icon: 'success', duration: TOAST_SHORT_MS },
  error: { icon: 'error', duration: TOAST_ERROR_MS },
} as const

export function showAppToast(options: AppToastOptions): ReturnType<typeof Taro.showToast> {
  const { tone = 'neutral', ...nativeOptions } = options
  return Taro.showToast({
    ...TONE_DEFAULTS[tone],
    ...nativeOptions,
  })
}
