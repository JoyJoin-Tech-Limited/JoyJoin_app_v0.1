import Taro from '@tarojs/taro'

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'slotTick' | 'slotLand' | 'cardReveal'

const HAPTIC_STYLES: Record<Exclude<HapticType, 'warning' | 'slotTick' | 'slotLand' | 'cardReveal'>, 'light' | 'medium' | 'heavy'> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'heavy',
}

const SLOT_HAPTIC_MAP: Record<Extract<HapticType, 'slotTick' | 'slotLand' | 'cardReveal'>, { type: 'light' | 'medium' | 'heavy'; count: number }> = {
  slotTick: { type: 'light', count: 1 },
  slotLand: { type: 'medium', count: 1 },
  cardReveal: { type: 'heavy', count: 2 },
}

type VibrateApi = 'vibrateShort' | 'vibrateLong'

function canUseVibrateApi(apiName: VibrateApi): boolean {
  const api = apiName === 'vibrateShort' ? Taro.vibrateShort : Taro.vibrateLong
  if (typeof api !== 'function') return false

  // Some WeChat/Taro runtime bundles expose vibration but omit canIUse.
  // Feature detection must never make an optional effect block a primary CTA.
  if (typeof Taro.canIUse !== 'function') return true

  try {
    return Taro.canIUse(apiName)
  } catch {
    return true
  }
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
  try {
    if (type === 'warning') {
      if (canUseVibrateApi('vibrateLong')) {
        Taro.vibrateLong()
      } else if (canUseVibrateApi('vibrateShort')) {
        Taro.vibrateShort({ type: 'heavy' })
      }
      return
    }

    if (!canUseVibrateApi('vibrateShort')) return

    if (type === 'slotTick' || type === 'slotLand' || type === 'cardReveal') {
      const config = SLOT_HAPTIC_MAP[type]
      for (let i = 0; i < config.count; i++) {
        Taro.vibrateShort({ type: config.type })
      }
      return
    }

    const style = HAPTIC_STYLES[type]
    Taro.vibrateShort({ type: style })
  } catch {
    // silently ignore
  }
}
