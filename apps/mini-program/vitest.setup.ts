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

// Taro's h5 component layer forwards mini-program-only props (lazyLoad,
// hoverClass, canvasId…) onto DOM nodes under JSDOM, and React logs an
// "unknown prop / event handler" line per render — pure noise that buries
// real warnings. Filter exactly those known Taro props; everything else
// still reaches the real console.error.
const TARO_DOM_PROP_WARNING = /React does not recognize the `(lazyLoad|canvasId|disableScroll|showLocation|hoverClass|hoverStartTime|hoverStayTime|scrollY)` prop|Unknown event handler property `(onTap|onMarkerTap)`/;
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && TARO_DOM_PROP_WARNING.test(args[0])) return;
  originalConsoleError(...args);
};
