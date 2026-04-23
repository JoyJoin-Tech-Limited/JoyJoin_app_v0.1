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
