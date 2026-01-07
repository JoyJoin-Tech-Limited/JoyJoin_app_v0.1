import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shouldShowGuide, resetGuideState } from '../useGuideFlow';

// Mock localStorage and window
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Setup global mocks
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', { value: globalThis });

describe('useGuideFlow', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('shouldShowGuide', () => {
    it('应该在首次访问时返回 true', () => {
      expect(shouldShowGuide()).toBe(true);
    });

    it('应该在设置 guideSeen 标志后返回 false', () => {
      localStorageMock.setItem('joyjoin_guide_seen', 'true');
      expect(shouldShowGuide()).toBe(false);
    });
  });

  describe('resetGuideState', () => {
    it('应该重置引导状态', () => {
      localStorageMock.setItem('joyjoin_guide_seen', 'true');
      expect(shouldShowGuide()).toBe(false);
      
      resetGuideState();
      expect(shouldShowGuide()).toBe(true);
    });
  });
});
