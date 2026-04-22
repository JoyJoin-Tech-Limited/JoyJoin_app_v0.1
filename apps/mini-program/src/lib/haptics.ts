import Taro from '@tarojs/taro'

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning'

const HAPTIC_STYLES: Record<Exclude<HapticType, 'warning'>, 'light' | 'medium' | 'heavy'> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'heavy',
}

function canVibrate(): boolean {
  return Taro.canIUse('vibrateShort') || Taro.canIUse('vibrateLong')
}

/**
 * Trigger haptic feedback. Silently fails if not supported.
 *
 * Usage:
 *   haptics('light')   // question answer tap
 *   haptics('medium')  // milestone reached
 *   haptics('heavy')   // completion
 *   haptics('success') // step completed successfully
 */
export function haptics(type: HapticType) {
  if (!canVibrate()) return

  try {
    if (type === 'warning') {
      Taro.vibrateLong()
      return
    }
    const style = HAPTIC_STYLES[type]
    Taro.vibrateShort({ type: style })
  } catch {
    // silently ignore
  }
}
