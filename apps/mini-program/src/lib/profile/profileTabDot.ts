import Taro from '@tarojs/taro'

// P0-5 (2026-10-22): cross-tab persistence for the 我的 tab dot. The profile
// page writes the live pending-equipment-draw count here; tab pages that
// never mounted the profile page read it as a fallback so the dot survives
// tab switches and sessions. Last-writer-wins is correct: only the profile
// page's equipment query owns this number.
const KEY = 'joyjoin_profile_tab_dot_count'

export function writeProfileTabDotCount(count: number): void {
  try {
    Taro.setStorageSync(KEY, Math.max(0, Math.floor(count)))
  } catch {
    // Storage failures must never break the page — the dot is a nicety.
  }
}

export function readProfileTabDotCount(): number {
  try {
    const value = Taro.getStorageSync(KEY)
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
  } catch {
    return 0
  }
}
