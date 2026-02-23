import { describe, it, expect, beforeEach, vi } from "vitest";
import { shouldShowGuide, resetGuideState } from "../useGuideFlow";

describe('useGuideFlow', () => {
  describe('shouldShowGuide (deprecated)', () => {
    it('应该总是返回 true（已废弃，服务端驱动）', () => {
      expect(shouldShowGuide()).toBe(true);
    });
  });

  describe('resetGuideState (deprecated)', () => {
    it('调用不应抛出错误（已废弃）', () => {
      expect(() => resetGuideState()).not.toThrow();
    });
  });
});
