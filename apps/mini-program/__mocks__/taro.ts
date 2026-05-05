import { vi } from 'vitest'

// Stub common Taro APIs for test environments.
// Tests that need specific behavior should use vi.mock('@tarojs/taro') inline instead.

const taro = {
  request: vi.fn().mockResolvedValue({ data: {}, statusCode: 200 }),
  login: vi.fn().mockResolvedValue({ code: 'mock-wx-code' }),
  navigateTo: vi.fn().mockResolvedValue({}),
  redirectTo: vi.fn().mockResolvedValue({}),
  reLaunch: vi.fn().mockResolvedValue({}),
  switchTab: vi.fn().mockResolvedValue({}),
  navigateBack: vi.fn().mockResolvedValue({}),
  showToast: vi.fn().mockResolvedValue({}),
  showLoading: vi.fn().mockResolvedValue({}),
  hideLoading: vi.fn().mockResolvedValue({}),
  showModal: vi.fn().mockResolvedValue({ confirm: true }),
  setStorageSync: vi.fn(),
  getStorageSync: vi.fn().mockReturnValue(null),
  removeStorageSync: vi.fn(),
  getSystemInfoSync: vi.fn().mockReturnValue({
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
  }),
  createSelectorQuery: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    boundingClientRect: vi.fn().mockReturnThis(),
    exec: vi.fn((cb: Function) => cb && cb([])),
  }),
  getCurrentPages: vi.fn().mockReturnValue([]),
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
  useReady: vi.fn(),
  usePullDownRefresh: vi.fn(),
  useReachBottom: vi.fn(),
  usePageScroll: vi.fn(),
  eventCenter: {
    on: vi.fn(),
    off: vi.fn(),
    trigger: vi.fn(),
  },
}

export default taro
