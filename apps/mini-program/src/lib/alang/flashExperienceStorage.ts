import Taro from '@tarojs/taro'

export const FLASH_INTRO_ACK_STORAGE_KEY = 'jj_flash_intro_ack'
export const FLASH_INTRO_ACK_VERSION = 'flash-intro-v1'

export function hasAcknowledgedFlashIntro(): boolean {
  try {
    return Taro.getStorageSync(FLASH_INTRO_ACK_STORAGE_KEY) === FLASH_INTRO_ACK_VERSION
  } catch {
    return false
  }
}

export function markFlashIntroAcknowledged(): void {
  try {
    Taro.setStorageSync(FLASH_INTRO_ACK_STORAGE_KEY, FLASH_INTRO_ACK_VERSION)
  } catch {
    // A failed convenience marker safely re-shows the introduction next time.
    // Server preferences and WeChat permission state remain authoritative.
  }
}
