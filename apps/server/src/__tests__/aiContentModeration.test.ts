import { describe, it, expect, vi } from "vitest";
import { moderateGeneratedContent, toModerationChecks } from "../lib/aiContentModeration";
import { logAITrace } from "../lib/aiTraceLogger";

// Mock logAITrace so tests don't need to set up the full AI trace infrastructure.
vi.mock("../lib/aiTraceLogger", () => ({
  logAITrace: vi.fn(),
}));

describe("aiContentModeration", () => {
  describe("moderateGeneratedContent", () => {
    it("returns safe when all text fields are clean", () => {
      const result = moderateGeneratedContent(
        [
          { field: "headline", text: "你好，今天天气不错" },
          { field: "analysis", text: "这是一段正常的分析内容" },
        ],
        {
          domain: "test",
          feature: "testFeature",
          provider: "deepseek",
          model: "deepseek-chat",
          latencyMs: 100,
          promptVersion: "test-v1",
        }
      );

      expect(result.safe).toBe(true);
    });

    it("returns unsafe on the first violating field and includes violation details", () => {
      const result = moderateGeneratedContent(
        [
          { field: "headline", text: "你好" },
          { field: "analysis", text: "你这个傻逼" },
          { field: "summary", text: "另一段内容" },
        ],
        {
          domain: "test",
          feature: "testFeature",
          provider: "deepseek",
          model: "deepseek-chat",
          latencyMs: 100,
          promptVersion: "test-v1",
        }
      );

      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.field).toBe("analysis");
        expect(result.violation).toBeDefined();
        expect(result.violation!.type).toBe("harassment");
        expect(result.violation!.severity).toBe("warning");
      }
    });

    it("skips empty or undefined text fields", () => {
      const result = moderateGeneratedContent(
        [
          { field: "headline", text: undefined },
          { field: "analysis", text: "   " },
          { field: "summary", text: "正常内容" },
        ],
        {
          domain: "test",
          feature: "testFeature",
          provider: "deepseek",
          model: "deepseek-chat",
          latencyMs: 100,
          promptVersion: "test-v1",
        }
      );

      expect(result.safe).toBe(true);
    });

    it("logs a structured AI trace when moderation fails", () => {
      moderateGeneratedContent(
        [{ field: "body", text: "约炮" }],
        {
          domain: "test",
          feature: "testFeature",
          provider: "deepseek",
          model: "deepseek-chat",
          latencyMs: 100,
          promptVersion: "test-v1",
          traceId: "trace-123",
        }
      );

      expect(logAITrace).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "trace-123",
          domain: "test",
          feature: "testFeature",
          success: false,
          fallbackUsed: true,
          errorCode: "content_safety",
        })
      );
    });
  });

  describe("toModerationChecks", () => {
    it("collects string fields and skips null/undefined", () => {
      const checks = toModerationChecks({
        headline: "标题",
        analysis: undefined,
        summary: null,
      });

      expect(checks).toEqual([{ field: "headline", text: "标题" }]);
    });
  });
});
