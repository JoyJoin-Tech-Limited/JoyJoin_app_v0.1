import { describe, expect, it } from "vitest";
import {
  canWriteFlashAdmin,
  formatEligibleWeekdays,
  formatFeedbackPromptLines,
  getShenzhenDatePair,
  parseCommaList,
  parseFeedbackPromptLines,
  toShenzhenIso,
  unpackFlashCollection,
} from "../flashAdmin";

describe("flashAdmin helpers", () => {
  it("keeps viewer read-only and allows operator roles", () => {
    expect(canWriteFlashAdmin("viewer")).toBe(false);
    expect(canWriteFlashAdmin(undefined)).toBe(false);
    expect(canWriteFlashAdmin("operator")).toBe(true);
    expect(canWriteFlashAdmin("super_admin")).toBe(true);
  });

  it("normalizes direct and enveloped collection responses", () => {
    expect(unpackFlashCollection([{ id: "1" }])).toEqual([{ id: "1" }]);
    expect(unpackFlashCollection({ npcs: [{ id: "2" }] })).toEqual([{ id: "2" }]);
    expect(unpackFlashCollection({ items: [] })).toEqual([]);
    expect(unpackFlashCollection(null)).toEqual([]);
  });

  it("orders weekdays from Monday through Sunday", () => {
    expect(formatEligibleWeekdays([5, 2, 7, 2])).toBe("周二、周五、周日");
  });

  it("returns Shenzhen calendar dates across UTC day boundaries", () => {
    expect(getShenzhenDatePair(new Date("2026-07-20T16:30:00.000Z"))).toEqual({
      today: "2026-07-21",
      tomorrow: "2026-07-22",
    });
  });

  it("normalizes comma-separated operator input", () => {
    expect(parseCommaList("安静, 城市观察，安静\n夜景")).toEqual(["安静", "城市观察", "夜景"]);
  });

  it("creates an explicit Shenzhen timestamp", () => {
    expect(toShenzhenIso("2026-07-21", "09:30")).toBe("2026-07-21T09:30:00+08:00");
  });

  it("parses structured feedback prompts with stable IDs", () => {
    const existing = [{
      id: "impression",
      prompt: "旧问题",
      options: [{ id: "calm", label: "安静" }, { id: "lively", label: "热闹" }],
    }];
    const result = parseFeedbackPromptLines("这里感觉怎么样？｜很安静｜有活力", existing);
    expect(result.error).toBeUndefined();
    expect(result.prompts[0]).toEqual({
      id: "impression",
      prompt: "这里感觉怎么样？",
      options: [{ id: "calm", label: "很安静" }, { id: "lively", label: "有活力" }],
    });
    expect(formatFeedbackPromptLines(result.prompts)).toBe("这里感觉怎么样？｜很安静｜有活力");
  });

  it("rejects feedback prompt rows without two options", () => {
    expect(parseFeedbackPromptLines("这里怎么样？｜不错").error).toContain("两个选项");
  });
});
