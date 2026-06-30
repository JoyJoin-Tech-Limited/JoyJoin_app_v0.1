import Taro from '@tarojs/taro'

/**
 * Reads the OS-level reduced-motion preference from WeChat system info.
 * Returns false when the API is unavailable or throws.
 */
export function getSystemReducedMotion(): boolean {
  try {
    return Boolean((Taro.getSystemInfoSync() as unknown as { reduceMotion?: boolean }).reduceMotion)
  } catch {
    return false
  }
}
