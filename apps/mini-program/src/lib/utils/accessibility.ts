import Taro from '@tarojs/taro'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'

/**
 * Reads the OS-level reduced-motion preference from WeChat system info.
 * Returns false when the API is unavailable or throws.
 */
export function getSystemReducedMotion(): boolean {
  try {
    return getSystemReducedMotionCompat()
  } catch {
    return false
  }
}
