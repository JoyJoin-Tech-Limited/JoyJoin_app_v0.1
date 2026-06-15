import { vi } from 'vitest'

// Stub common Taro APIs for test environments.
// Tests that need specific behavior should use vi.mock('@tarojs/taro') inline instead.

export const request = vi.fn().mockResolvedValue({ data: {}, statusCode: 200 })
export const login = vi.fn().mockResolvedValue({ code: 'mock-wx-code' })
export const navigateTo = vi.fn().mockResolvedValue({})
export const redirectTo = vi.fn().mockResolvedValue({})
export const reLaunch = vi.fn().mockResolvedValue({})
export const switchTab = vi.fn().mockResolvedValue({})
export const navigateBack = vi.fn().mockResolvedValue({})
export const showToast = vi.fn().mockResolvedValue({})
export const showLoading = vi.fn().mockResolvedValue({})
export const hideLoading = vi.fn().mockResolvedValue({})
export const showModal = vi.fn().mockResolvedValue({ confirm: true })
export const setStorageSync = vi.fn()
export const getStorageSync = vi.fn().mockReturnValue(null)
export const removeStorageSync = vi.fn()
export const getImageInfo = vi.fn().mockResolvedValue({
  width: 100,
  height: 100,
  path: 'tmp://mock-image',
})
export const getSystemInfoSync = vi.fn().mockReturnValue({
  brand: 'test',
  model: 'test',
  system: 'test',
  platform: 'devtools',
  screenWidth: 375,
  screenHeight: 812,
  windowWidth: 375,
  windowHeight: 667,
  statusBarHeight: 44,
  pixelRatio: 2,
  SDKVersion: '3.0.0',
})
export const createSelectorQuery = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  boundingClientRect: vi.fn().mockReturnThis(),
  exec: vi.fn((cb: Function) => cb && cb([])),
})
export const getCurrentPages = vi.fn().mockReturnValue([])
export const useRouter = vi.fn().mockReturnValue({ params: {}, path: '' })
export const useDidShow = vi.fn()
export const useDidHide = vi.fn()
export const useReady = vi.fn()
export const usePullDownRefresh = vi.fn()
export const useReachBottom = vi.fn()
export const usePageScroll = vi.fn()
export const eventCenter = {
  on: vi.fn(),
  off: vi.fn(),
  trigger: vi.fn(),
}

const taro = {
  request,
  login,
  navigateTo,
  redirectTo,
  reLaunch,
  switchTab,
  navigateBack,
  showToast,
  showLoading,
  hideLoading,
  showModal,
  setStorageSync,
  getStorageSync,
  removeStorageSync,
  getImageInfo,
  getSystemInfoSync,
  createSelectorQuery,
  getCurrentPages,
  useRouter,
  useDidShow,
  useDidHide,
  useReady,
  usePullDownRefresh,
  useReachBottom,
  usePageScroll,
  eventCenter,
}

export default taro
