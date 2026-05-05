// Mock WeChat Mini Program globals for test environment
import { vi } from 'vitest';

(globalThis as any).wx = {
  getStorageSync: vi.fn().mockReturnValue(null),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  request: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  navigateBack: vi.fn(),
  login: vi.fn().mockResolvedValue({ code: 'mock-code' }),
  getUserInfo: vi.fn().mockResolvedValue({ userInfo: {} }),
};
