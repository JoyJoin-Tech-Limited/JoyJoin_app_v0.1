// Mock WeChat Mini Program globals for test environment
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Required by @tarojs/components (Taro web-components use these globals)
(globalThis as any).ENABLE_INNER_HTML = false;
(globalThis as any).ENABLE_ADJACENT_HTML = false;
(globalThis as any).ENABLE_CLONE_NODE = false;
(globalThis as any).ENABLE_CONTAINS = false;
(globalThis as any).ENABLE_SIZE_APIS = false;
(globalThis as any).ENABLE_TEMPLATE_CONTENT = false;

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
